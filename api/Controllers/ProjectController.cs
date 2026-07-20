using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using System.Text.Json;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectsController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        private static readonly Dictionary<string, string> StatusToEnum = new()
        {
            { "В процессе", "in_progress" },
            { "Завершён", "completed" },
            { "Приостановлен", "paused" }
        };

        private static readonly Dictionary<string, string> EnumToStatus = new()
        {
            { "in_progress", "В процессе" },
            { "completed", "Завершён" },
            { "paused", "Приостановлен" }
        };

        private static string ToEnumStatus(string status) => StatusToEnum.TryGetValue(status, out var enumStatus)
                ? enumStatus
                : "in_progress";

        private static string ToRuStatus(string enumStatus) => EnumToStatus.TryGetValue(enumStatus, out var ruStatus)
                ? ruStatus
                : "В процессе";

        [HttpGet("my")]
        public async Task<IActionResult> GetMyProjects()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var projectsResponse = await _client.From<Project>()
                    .Where(p => p.OwnerId == userId)
                    .Get();

                var projects = new List<object>();

                foreach (var p in projectsResponse.Models)
                {
                    var membersResponse = await _client.From<ProjectMember>()
                        .Where(pm => pm.ProjectId == p.ProjectId)
                        .Get();

                    var membersCount = membersResponse.Models.Count;

                    projects.Add(new
                    {
                        p.ProjectId,
                        p.Title,
                        p.ShortDescription,
                        p.FullDescription,
                        Status = ToRuStatus(p.Status),
                        StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                        p.RatingCount,
                        CreatedAt = p.CreatedAt?.ToString("o"),
                        p.OwnerId,
                        MembersCount = membersCount
                    });
                }

                return Ok(projects);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("{projectId}")]
        public async Task<IActionResult> GetProject(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(userId))
                {
                    await _SupMan.UpdateLastOnlineAsync(userId);
                }

                var response = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId)
                    .Get();

                var project = response.Models.FirstOrDefault();
                if (project == null)
                    return NotFound();

                if (!await CanViewProject(project, userId))
                    return NotFound();

                return Ok(new
                {
                    project.ProjectId,
                    project.Title,
                    project.ShortDescription,
                    project.FullDescription,
                    Status = ToRuStatus(project.Status),
                    StatusChangedAt = project.StatusChangedAt?.ToString("o"),
                    project.RatingCount,
                    project.IsPrivate,
                    CreatedAt = project.CreatedAt?.ToString("o"),
                    project.OwnerId
                });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("by-user/{userId}")]
        public async Task<IActionResult> GetUserProjects(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(currentUserId))
                {
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);
                }

                var projectsResponse = await _client.From<Project>()
                    .Where(p => p.OwnerId == userId)
                    .Get();

                var projects = new List<object>();

                foreach (var p in projectsResponse.Models)
                {
                    if (!await CanViewProject(p, currentUserId))
                        continue;

                    var membersResponse = await _client.From<ProjectMember>()
                        .Where(pm => pm.ProjectId == p.ProjectId)
                        .Get();

                    var membersCount = membersResponse.Models.Count;

                    projects.Add(new
                    {
                        p.ProjectId,
                        p.Title,
                        p.ShortDescription,
                        p.FullDescription,
                        Status = ToRuStatus(p.Status),
                        StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                        p.RatingCount,
                        p.IsPrivate,
                        CreatedAt = p.CreatedAt?.ToString("o"),
                        p.OwnerId,
                        MembersCount = membersCount
                    });
                }

                return Ok(projects);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] CreateProjectDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized();
                }

                await _SupMan.UpdateLastOnlineAsync(userId);

                var newProject = new Project
                {
                    ProjectId = Guid.NewGuid().ToString(),
                    OwnerId = userId,
                    Title = dto.Title,
                    ShortDescription = dto.ShortDescription,
                    FullDescription = dto.FullDescription,
                    Status = ToEnumStatus(dto.Status ?? "В процессе"),
                    StatusChangedAt = DateTime.UtcNow,
                    RatingCount = 0,
                    IsPrivate = dto.IsPrivate,
                    CreatedAt = DateTime.UtcNow
                };

                var projectResponse = await _client.From<Project>().Insert(newProject);
                var created = projectResponse.Models.FirstOrDefault();

                if (created == null)
                {
                    return BadRequest("Не удалось создать проект");
                }

                var ownerMember = new ProjectMember
                {
                    MemberId = Guid.NewGuid().ToString(),
                    ProjectId = created.ProjectId,
                    UserId = userId,
                    Role = "Капитан",
                    JoinedAt = DateTime.UtcNow
                };

                var memberResponse = await _client.From<ProjectMember>().Insert(ownerMember);
                var createdMember = memberResponse.Models.FirstOrDefault();

                return Ok(new
                {
                    created.ProjectId,
                    created.Title,
                    created.ShortDescription,
                    created.FullDescription,
                    Status = ToRuStatus(created.Status),
                    StatusChangedAt = created.StatusChangedAt?.ToString("o"),
                    created.RatingCount,
                    CreatedAt = created.CreatedAt?.ToString("o"),
                    created.OwnerId,
                    MembersCount = 1
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpDelete("{projectId}")]
        public async Task<IActionResult> DeleteProject(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var response = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();

                var project = response.Models.FirstOrDefault();
                if (project == null)
                    return NotFound();

                await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId)
                    .Delete();

                return Ok(new { message = "Проект успешно удалён" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("{projectId}/rating")]
        public async Task<IActionResult> GetUserRating(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var rating = await _client.From<ProjectRating>()
                    .Where(r => r.ProjectId == projectId && r.UserId == userId)
                    .Get();

                var hasRated = rating.Models.Count != 0;

                return Ok(new { hasRated });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpPost("{projectId}/rating")]
        public async Task<IActionResult> AddRating(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var existingRating = await _client.From<ProjectRating>()
                    .Where(r => r.ProjectId == projectId && r.UserId == userId)
                    .Get();

                if (existingRating.Models.Count != 0)
                    return BadRequest("Вы уже оценили этот проект");

                var newRating = new ProjectRating
                {
                    RatingId = Guid.NewGuid().ToString(),
                    UserId = userId,
                    ProjectId = projectId,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<ProjectRating>().Insert(newRating);

                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId)
                    .Get();

                if (project.Models.Count != 0)
                {
                    var updatedRatingCount = project.Models.First().RatingCount + 1;

                    await _client.From<Project>()
                        .Where(p => p.ProjectId == projectId)
                        .Set(p => p.RatingCount, updatedRatingCount)
                        .Update();
                }

                return Ok(new { success = true, ratingCount = project.Models.First().RatingCount + 1 });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpDelete("{projectId}/rating")]
        public async Task<IActionResult> RemoveRating(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);

                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var rating = await _client.From<ProjectRating>()
                    .Where(r => r.ProjectId == projectId && r.UserId == userId)
                    .Get();

                if (rating.Models.Count == 0)
                {
                    return NotFound(new { message = "Оценка не найдена" });
                }

                var ratingToDelete = rating.Models.First();
                await _client.From<ProjectRating>().Delete(ratingToDelete);

                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId)
                    .Get();

                if (project.Models.Count != 0)
                {
                    var currentCount = project.Models.First().RatingCount;
                    var updatedRatingCount = Math.Max(0, currentCount - 1);

                    await _client.From<Project>()
                        .Where(p => p.ProjectId == projectId)
                        .Set(p => p.RatingCount, updatedRatingCount)
                        .Update();

                    return Ok(new { success = true, ratingCount = updatedRatingCount });
                }

                return Ok(new { success = true, ratingCount = 0 });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("user/{userId}/favorites")]
        public async Task<IActionResult> GetUserFavorites(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);

                if (!string.IsNullOrEmpty(currentUserId))
                {
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);
                }

                var ratings = await _client.From<ProjectRating>()
                    .Where(r => r.UserId == userId)
                    .Get();

                var favoriteProjects = new List<object>();

                foreach (var rating in ratings.Models)
                {
                    var project = await _client.From<Project>()
                        .Where(p => p.ProjectId == rating.ProjectId)
                        .Get();

                    if (project.Models.Count != 0)
                    {
                        var p = project.Models.First();

                        if (!await CanViewProject(p, currentUserId))
                            continue;

                        var membersResponse = await _client.From<ProjectMember>()
                            .Where(pm => pm.ProjectId == p.ProjectId)
                            .Get();

                        var membersCount = membersResponse.Models.Count;

                        favoriteProjects.Add(new
                        {
                            p.ProjectId,
                            p.Title,
                            p.ShortDescription,
                            p.FullDescription,
                            Status = ToRuStatus(p.Status),
                            StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                            p.RatingCount,
                            CreatedAt = p.CreatedAt?.ToString("o"),
                            p.OwnerId,
                            p.IsPrivate,
                            MembersCount = membersCount,
                            RatedAt = rating.CreatedAt?.ToString("o")
                        });
                    }
                }

                return Ok(favoriteProjects);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("user/{userId}/member")]
        public async Task<IActionResult> GetUserMemberProjects(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);

                if (!string.IsNullOrEmpty(currentUserId))
                {
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);
                }

                var memberProjects = await _client.From<ProjectMember>()
                    .Where(pm => pm.UserId == userId)
                    .Get();

                var projects = new List<object>();

                foreach (var member in memberProjects.Models)
                {
                    var projectResponse = await _client.From<Project>()
                        .Where(p => p.ProjectId == member.ProjectId && p.OwnerId != userId)
                        .Get();

                    if (projectResponse.Models.Count != 0)
                    {
                        var p = projectResponse.Models.First();

                        if (!await CanViewProject(p, currentUserId))
                            continue;

                        var membersResponse = await _client.From<ProjectMember>()
                            .Where(pm => pm.ProjectId == p.ProjectId)
                            .Get();

                        var membersCount = membersResponse.Models.Count;

                        projects.Add(new
                        {
                            p.ProjectId,
                            p.Title,
                            p.ShortDescription,
                            p.FullDescription,
                            Status = ToRuStatus(p.Status),
                            StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                            p.RatingCount,
                            CreatedAt = p.CreatedAt?.ToString("o"),
                            p.OwnerId,
                            p.IsPrivate,
                            MembersCount = membersCount,
                            MemberRole = member.Role
                        });
                    }
                }

                return Ok(projects);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Черновики

        [HttpGet("{projectId}/draft")]
        public async Task<IActionResult> GetDraft(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var ownerCheck = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (ownerCheck.Models.Count == 0)
                    return NotFound();

                var draftResponse = await _client.From<ProjectDraft>()
                    .Where(d => d.ProjectId == projectId)
                    .Get();
                var draft = draftResponse.Models.FirstOrDefault();

                if (draft == null)
                    return Ok(null);

                return Ok(new
                {
                    draft.Title,
                    draft.ShortDescription,
                    draft.FullDescription,
                    draft.Status,
                    draft.IsPrivate,
                    Vacancies = string.IsNullOrEmpty(draft.VacanciesDraft)
                        ? null
                        : JsonSerializer.Deserialize<List<VacancyDraftItem>>(draft.VacanciesDraft),
                    DeletedVacancyIds = string.IsNullOrEmpty(draft.DeletedVacancyIds)
                        ? null
                        : JsonSerializer.Deserialize<List<string>>(draft.DeletedVacancyIds),
                    DeletedMemberIds = string.IsNullOrEmpty(draft.DeletedMemberIds)
                        ? null
                        : JsonSerializer.Deserialize<List<string>>(draft.DeletedMemberIds),
                    EditedRoles = string.IsNullOrEmpty(draft.EditedRoles)
                        ? null
                        : JsonSerializer.Deserialize<Dictionary<string, string>>(draft.EditedRoles)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPut("{projectId}/draft")]
        public async Task<IActionResult> SaveDraft(string projectId, [FromBody] SaveDraftDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var ownerCheck = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (ownerCheck.Models.Count == 0)
                    return NotFound();

                var draft = new ProjectDraft
                {
                    ProjectId = projectId,
                    Title = dto.Title,
                    ShortDescription = dto.ShortDescription,
                    FullDescription = dto.FullDescription,
                    Status = !string.IsNullOrEmpty(dto.Status) ? ToEnumStatus(dto.Status) : null,
                    IsPrivate = dto.IsPrivate,
                    VacanciesDraft = dto.Vacancies != null ? JsonSerializer.Serialize(dto.Vacancies) : null,
                    DeletedVacancyIds = dto.DeletedVacancyIds != null ? JsonSerializer.Serialize(dto.DeletedVacancyIds) : null,
                    DeletedMemberIds = dto.DeletedMemberIds != null ? JsonSerializer.Serialize(dto.DeletedMemberIds) : null,
                    EditedRoles = dto.EditedRoles != null ? JsonSerializer.Serialize(dto.EditedRoles) : null,
                    UpdatedAt = DateTime.UtcNow
                };

                await _client.From<ProjectDraft>().Upsert(draft);

                return Ok(new { message = "Черновик сохранён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpDelete("{projectId}/draft")]
        public async Task<IActionResult> DiscardDraft(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var ownerCheck = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (ownerCheck.Models.Count == 0)
                    return NotFound();

                await _client.From<ProjectDraft>()
                    .Where(d => d.ProjectId == projectId)
                    .Delete();

                return Ok(new { message = "Черновик отменён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpPost("{projectId}/commit")]
        public async Task<IActionResult> CommitDraft(string projectId, [FromBody] CommitProjectDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var response = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();

                var project = response.Models.FirstOrDefault();
                if (project == null)
                    return NotFound();

                var newTitle = dto.Title ?? project.Title;
                var newShort = dto.ShortDescription ?? project.ShortDescription;
                var newFull = dto.FullDescription ?? project.FullDescription;
                var newStatus = !string.IsNullOrEmpty(dto.Status) ? ToEnumStatus(dto.Status) : project.Status;
                var newIsPrivate = dto.IsPrivate ?? project.IsPrivate;
                var statusChanged = newStatus != project.Status;

                await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId)
                    .Set(p => p.Title, newTitle)
                    .Set(p => p.ShortDescription!, newShort)
                    .Set(p => p.FullDescription!, newFull)
                    .Set(p => p.Status, newStatus)
                    .Set(p => p.StatusChangedAt!, statusChanged ? DateTime.UtcNow : project.StatusChangedAt)
                    .Set(p => p.IsPrivate, newIsPrivate)
                    .Update();

                await _client.From<ProjectDraft>()
                    .Where(d => d.ProjectId == projectId)
                    .Delete();

                return Ok(new { message = "Проект сохранён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        private async Task<bool> CanViewProject(Project project, string? currentUserId)
        {
            if (!project.IsPrivate)
                return true;

            if (string.IsNullOrEmpty(currentUserId))
                return false;

            if (project.OwnerId == currentUserId)
                return true;

            var membership = await _client.From<ProjectMember>()
                .Where(pm => pm.ProjectId == project.ProjectId && pm.UserId == currentUserId)
                .Get();

            return membership.Models.Count > 0;
        }
    }

    public class CreateProjectDto
    {
        public string Title { get; set; } = string.Empty;
        public string? ShortDescription { get; set; }
        public string? FullDescription { get; set; }
        public string? Status { get; set; }
        public bool IsPrivate { get; set; } = false;
    }

    public class SaveDraftDto
    {
        public string? Title { get; set; }
        public string? ShortDescription { get; set; }
        public string? FullDescription { get; set; }
        public string? Status { get; set; }
        public bool? IsPrivate { get; set; }

        public List<VacancyDraftItem>? Vacancies { get; set; }
        public List<string>? DeletedVacancyIds { get; set; }
        public List<string>? DeletedMemberIds { get; set; }
        public Dictionary<string, string>? EditedRoles { get; set; }
    }

    public class CommitProjectDto
    {
        public string? Title { get; set; }
        public string? ShortDescription { get; set; }
        public string? FullDescription { get; set; }
        public string? Status { get; set; }
        public bool? IsPrivate { get; set; }
    }

    public class VacancyDraftItem
    {
        public string VacancyId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> RequiredTags { get; set; } = [];
        public bool IsNew { get; set; }
        public bool IsModified { get; set; }
    }
}