using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using Supabase.Postgrest;
using System.Text.Json;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Получить список проектов текущего пользователя
        [HttpGet("my")]
        public async Task<IActionResult> GetMyProjects()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
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

                    projects.Add(new
                    {
                        p.ProjectId,
                        p.Title,
                        p.ShortDescription,
                        p.FullDescription,
                        Status = SupportManager.ToRuStatus(p.Status),
                        StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                        p.RatingCount,
                        CreatedAt = p.CreatedAt?.ToString("o"),
                        p.OwnerId,
                        MembersCount = membersResponse.Models.Count
                    });
                }

                return Ok(projects);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Получить проект по ID
        [HttpGet("{projectId}")]
        public async Task<IActionResult> GetProject(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
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

                bool isStaff = await _SupMan.IsStaffAsync(userId!);
                if (!await _SupMan.CanViewProject(project, userId, isStaff))
                    return NotFound();

                return Ok(new
                {
                    project.ProjectId,
                    project.Title,
                    project.ShortDescription,
                    project.FullDescription,
                    Status = SupportManager.ToRuStatus(project.Status),
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

        // Получить список проектов пользователя по его ID
        [HttpGet("by-user/{userId}")]
        public async Task<IActionResult> GetUserProjects(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = await _SupMan.GetUserIdAsync(authHeader);
                if (!string.IsNullOrEmpty(currentUserId))
                {
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);
                }

                bool isStaff = await _SupMan.IsStaffAsync(currentUserId!);
                var projectsResponse = await _client.From<Project>()
                    .Where(p => p.OwnerId == userId)
                    .Get();

                var projects = new List<object>();
                foreach (var p in projectsResponse.Models)
                {
                    if (!await _SupMan.CanViewProject(p, currentUserId, isStaff))
                        continue;

                    var membersResponse = await _client.From<ProjectMember>()
                        .Where(pm => pm.ProjectId == p.ProjectId)
                        .Get();

                    projects.Add(new
                    {
                        p.ProjectId,
                        p.Title,
                        p.ShortDescription,
                        p.FullDescription,
                        Status = SupportManager.ToRuStatus(p.Status),
                        StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                        p.RatingCount,
                        p.IsPrivate,
                        CreatedAt = p.CreatedAt?.ToString("o"),
                        p.OwnerId,
                        MembersCount = membersResponse.Models.Count
                    });
                }

                return Ok(projects);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Создать проект
        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] CreateProjectDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var error = Validator.ValidateProject(dto.Title, dto.ShortDescription);
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var newProject = new Project
                {
                    ProjectId = Guid.NewGuid().ToString(),
                    OwnerId = userId,
                    Title = dto.Title,
                    ShortDescription = dto.ShortDescription,
                    FullDescription = dto.FullDescription,
                    Status = SupportManager.ToEnumStatus(dto.Status ?? "В процессе"),
                    StatusChangedAt = DateTime.UtcNow,
                    RatingCount = 0,
                    IsPrivate = dto.IsPrivate,
                    CreatedAt = DateTime.UtcNow
                };

                var projectResponse = await _client.From<Project>().Insert(newProject);
                var created = projectResponse.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest("Не удалось создать проект");

                var ownerMember = new ProjectMember
                {
                    MemberId = Guid.NewGuid().ToString(),
                    ProjectId = created.ProjectId,
                    UserId = userId,
                    Role = "Капитан",
                    JoinedAt = DateTime.UtcNow
                };
                await _client.From<ProjectMember>().Insert(ownerMember);

                await _SupMan.Cache.ProjectChangedAsync(created.ProjectId);

                return Ok(new
                {
                    created.ProjectId,
                    created.Title,
                    created.ShortDescription,
                    created.FullDescription,
                    Status = SupportManager.ToRuStatus(created.Status),
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

        // Удалить проект
        [HttpDelete("{projectId}")]
        public async Task<IActionResult> DeleteProject(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var response = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();

                if (response.Models.Count == 0)
                    return NotFound();

                await _client.From<Project>().Where(p => p.ProjectId == projectId).Delete();

                await _SupMan.Cache.ProjectChangedAsync(projectId);

                return Ok(new { message = "Проект успешно удалён" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Получить рейтинг
        [HttpGet("{projectId}/rating")]
        public async Task<IActionResult> GetUserRating(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var rating = await _client.From<ProjectRating>()
                    .Where(r => r.ProjectId == projectId && r.UserId == userId)
                    .Get();

                return Ok(new { hasRated = rating.Models.Count != 0 });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Оценить
        [HttpPost("{projectId}/rating")]
        public async Task<IActionResult> AddRating(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var existingRating = await _client.From<ProjectRating>()
                    .Where(r => r.ProjectId == projectId && r.UserId == userId)
                    .Get();

                if (existingRating.Models.Count != 0)
                    return BadRequest("Вы уже оценили этот проект");

                await _client.From<ProjectRating>().Insert(new ProjectRating
                {
                    RatingId = Guid.NewGuid().ToString(),
                    UserId = userId,
                    ProjectId = projectId,
                    CreatedAt = DateTime.UtcNow
                });

                var project = await _client.From<Project>().Where(p => p.ProjectId == projectId).Get();
                if (project.Models.Count != 0)
                {
                    await _client.From<Project>()
                        .Where(p => p.ProjectId == projectId)
                        .Set(p => p.RatingCount, project.Models.First().RatingCount + 1)
                        .Update();
                }

                await _SupMan.Cache.ProjectChangedAsync(projectId);

                return Ok(new { success = true, ratingCount = project.Models.First().RatingCount + 1 });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Убрать оценку
        [HttpDelete("{projectId}/rating")]
        public async Task<IActionResult> RemoveRating(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var rating = await _client.From<ProjectRating>()
                    .Where(r => r.ProjectId == projectId && r.UserId == userId)
                    .Get();

                if (rating.Models.Count == 0)
                    return NotFound(new { message = "Оценка не найдена" });

                await _client.From<ProjectRating>().Delete(rating.Models.First());

                var project = await _client.From<Project>().Where(p => p.ProjectId == projectId).Get();
                if (project.Models.Count != 0)
                {
                    var updatedRatingCount = Math.Max(0, project.Models.First().RatingCount - 1);
                    await _client.From<Project>()
                        .Where(p => p.ProjectId == projectId)
                        .Set(p => p.RatingCount, updatedRatingCount)
                        .Update();

                    await _SupMan.Cache.ProjectChangedAsync(projectId);

                    return Ok(new { success = true, ratingCount = updatedRatingCount });
                }

                return Ok(new { success = true, ratingCount = 0 });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Получить избранные
        [HttpGet("user/{userId}/favorites")]
        public async Task<IActionResult> GetUserFavorites(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = await _SupMan.GetUserIdAsync(authHeader);
                if (!string.IsNullOrEmpty(currentUserId))
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);

                var ratings = await _client.From<ProjectRating>().Where(r => r.UserId == userId).Get();
                var favoriteProjects = new List<object>();
                bool isStaff = await _SupMan.IsStaffAsync(currentUserId!);

                foreach (var rating in ratings.Models)
                {
                    var project = await _client.From<Project>().Where(p => p.ProjectId == rating.ProjectId).Get();
                    if (project.Models.Count == 0) continue;

                    var p = project.Models.First();
                    var ownerResponse = await _client.From<User>().Where(u => u.UserId == p.OwnerId).Get();
                    var owner = ownerResponse.Models.FirstOrDefault();

                    if (owner == null || (owner.IsBanned == true && !isStaff))
                        continue;

                    if (!await _SupMan.CanViewProject(p, currentUserId, isStaff))
                        continue;

                    var membersResponse = await _client.From<ProjectMember>().Where(pm => pm.ProjectId == p.ProjectId).Get();

                    favoriteProjects.Add(new
                    {
                        p.ProjectId,
                        p.Title,
                        p.ShortDescription,
                        p.FullDescription,
                        Status = SupportManager.ToRuStatus(p.Status),
                        StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                        p.RatingCount,
                        CreatedAt = p.CreatedAt?.ToString("o"),
                        p.OwnerId,
                        p.IsPrivate,
                        MembersCount = membersResponse.Models.Count,
                        RatedAt = rating.CreatedAt?.ToString("o")
                    });
                }

                return Ok(favoriteProjects);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Получить проекты, где пользователь участник
        [HttpGet("user/{userId}/member")]
        public async Task<IActionResult> GetUserMemberProjects(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = await _SupMan.GetUserIdAsync(authHeader);
                if (!string.IsNullOrEmpty(currentUserId))
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);

                var memberProjects = await _client.From<ProjectMember>().Where(pm => pm.UserId == userId).Get();
                var projects = new List<object>();
                bool isStaff = await _SupMan.IsStaffAsync(currentUserId!);

                foreach (var member in memberProjects.Models)
                {
                    var projectResponse = await _client.From<Project>()
                        .Where(p => p.ProjectId == member.ProjectId && p.OwnerId != userId)
                        .Get();

                    if (projectResponse.Models.Count == 0) continue;

                    var p = projectResponse.Models.First();
                    if (!await _SupMan.CanViewProject(p, currentUserId, isStaff)) continue;

                    var membersResponse = await _client.From<ProjectMember>().Where(pm => pm.ProjectId == p.ProjectId).Get();

                    projects.Add(new
                    {
                        p.ProjectId,
                        p.Title,
                        p.ShortDescription,
                        p.FullDescription,
                        Status = SupportManager.ToRuStatus(p.Status),
                        StatusChangedAt = p.StatusChangedAt?.ToString("o"),
                        p.RatingCount,
                        CreatedAt = p.CreatedAt?.ToString("o"),
                        p.OwnerId,
                        p.IsPrivate,
                        MembersCount = membersResponse.Models.Count,
                        MemberRole = member.Role
                    });
                }

                return Ok(projects);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // ЧЕРНОВИКИ

        // Получить черновик проекта
        [HttpGet("{projectId}/draft")]
        public async Task<IActionResult> GetDraft(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ownerCheck = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (ownerCheck.Models.Count == 0) return NotFound();

                var draftResponse = await _client.From<ProjectDraft>().Where(d => d.ProjectId == projectId).Get();
                var draft = draftResponse.Models.FirstOrDefault();

                if (draft == null) return Ok(null);

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
                        : JsonSerializer.Deserialize<Dictionary<string, string>>(draft.EditedRoles),
                    DeletedMediaFiles = SupportManager.ParseDeletedMediaFiles(draft.DeletedMediaFiles)
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Редактировать черновик
        [HttpPut("{projectId}/draft")]
        public async Task<IActionResult> SaveDraft(string projectId, [FromBody] SaveDraftDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var projectError = Validator.ValidateProject(dto.Title, dto.ShortDescription);
                if (projectError != null)
                    return BadRequest(new { message = projectError });

                var ownerCheck = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (ownerCheck.Models.Count == 0) return NotFound();

                var descriptionError = Validator.ValidateProjectDescription(dto.FullDescription);
                if (descriptionError != null)
                    return BadRequest(new { message = descriptionError });

                var draft = new ProjectDraft
                {
                    ProjectId = projectId,
                    Title = dto.Title,
                    ShortDescription = dto.ShortDescription,
                    FullDescription = dto.FullDescription,
                    Status = !string.IsNullOrEmpty(dto.Status) ? SupportManager.ToEnumStatus(dto.Status) : null,
                    IsPrivate = dto.IsPrivate,
                    VacanciesDraft = dto.Vacancies != null ? JsonSerializer.Serialize(dto.Vacancies) : null,
                    DeletedVacancyIds = dto.DeletedVacancyIds != null ? JsonSerializer.Serialize(dto.DeletedVacancyIds) : null,
                    DeletedMemberIds = dto.DeletedMemberIds != null ? JsonSerializer.Serialize(dto.DeletedMemberIds) : null,
                    EditedRoles = dto.EditedRoles != null ? JsonSerializer.Serialize(dto.EditedRoles) : null,
                    DeletedMediaFiles = dto.DeletedMediaFiles != null ? JsonSerializer.Serialize(dto.DeletedMediaFiles) : null,
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

        // Удалить черновик
        [HttpDelete("{projectId}/draft")]
        public async Task<IActionResult> DiscardDraft(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ownerCheck = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (ownerCheck.Models.Count == 0) return NotFound();

                var draftFiles = await _client.Storage.From("ProjectMediaDraft").List(projectId);
                if (draftFiles != null && draftFiles.Count > 0)
                {
                    foreach (var file in draftFiles)
                    {
                        if (!string.IsNullOrEmpty(file.Name))
                        {
                            await _client.Storage.From("ProjectMediaDraft").Remove($"{projectId}/{file.Name}");
                        }
                    }
                }

                await _client.From<ProjectDraft>().Where(d => d.ProjectId == projectId).Delete();

                return Ok(new { message = "Черновик отменён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Сохранить черновик (удаляется)
        [HttpPost("{projectId}/commit")]
        public async Task<IActionResult> CommitDraft(string projectId, [FromBody] CommitProjectDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var projectError = Validator.ValidateProject(dto.Title, dto.ShortDescription);
                if (projectError != null)
                    return BadRequest(new { message = projectError });

                var response = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();

                var project = response.Models.FirstOrDefault();
                if (project == null)
                    return NotFound();

                var descriptionError = Validator.ValidateProjectDescription(dto.FullDescription);
                if (descriptionError != null)
                    return BadRequest(new { message = descriptionError });

                var draftResponse = await _client.From<ProjectDraft>().Where(d => d.ProjectId == projectId).Get();
                var draft = draftResponse.Models.FirstOrDefault();

                var finalDescription = dto.FullDescription ?? project.FullDescription ?? "";

                var deletedFileNames = SupportManager.ParseDeletedMediaFiles(draft?.DeletedMediaFiles);

                if (deletedFileNames.Count > 0)
                {
                    foreach (var fileName in deletedFileNames)
                    {
                        await _client.Storage.From("ProjectMedia").Remove($"{projectId}/{fileName}");
                    }
                }

                var draftFiles = await _client.Storage.From("ProjectMediaDraft").List(projectId);
                if (draftFiles != null && draftFiles.Count > 0)
                {
                    foreach (var f in draftFiles)
                    {
                        if (string.IsNullOrEmpty(f.Name)) continue;

                        var draftPath = $"{projectId}/{f.Name}";

                        var bytes = await _client.Storage.From("ProjectMediaDraft")
                            .Download(draftPath, (Supabase.Storage.TransformOptions?)null);

                        if (bytes != null && bytes.Length > 0)
                        {
                            await _client.Storage.From("ProjectMedia")
                                .Upload(bytes, draftPath, new Supabase.Storage.FileOptions
                                {
                                    Upsert = false,
                                    ContentType = draftPath.EndsWith(".gif") ? "image/gif" : "image/webp",
                                    CacheControl = "31536000"
                                });

                            var oldUrl = _client.Storage.From("ProjectMediaDraft").GetPublicUrl(draftPath);
                            var newUrl = _client.Storage.From("ProjectMedia").GetPublicUrl(draftPath);
                            finalDescription = finalDescription.Replace(oldUrl, newUrl);

                            await _client.Storage.From("ProjectMediaDraft").Remove(draftPath);
                        }
                    }
                }

                var newTitle = dto.Title ?? project.Title;
                var newShort = dto.ShortDescription ?? project.ShortDescription;
                var newStatus = !string.IsNullOrEmpty(dto.Status) ? SupportManager.ToEnumStatus(dto.Status) : project.Status;
                var newIsPrivate = dto.IsPrivate ?? project.IsPrivate;
                var statusChanged = newStatus != project.Status;

                await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId)
                    .Set(p => p.Title, newTitle)
                    .Set(p => p.ShortDescription!, newShort)
                    .Set(p => p.FullDescription!, finalDescription)
                    .Set(p => p.Status, newStatus)
                    .Set(p => p.StatusChangedAt!, statusChanged ? DateTime.UtcNow : project.StatusChangedAt)
                    .Set(p => p.IsPrivate, newIsPrivate)
                    .Update();

                await _client.From<ProjectDraft>().Where(d => d.ProjectId == projectId).Delete();

                await _SupMan.Cache.ProjectChangedAsync(projectId);

                return Ok(new { message = "Проект сохранён", fullDescription = finalDescription });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // МЕДИА

        // Получить список всех медиа
        [HttpGet("{projectId}/media")]
        public async Task<IActionResult> GetMedia(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var project = await _client.From<Project>().Where(p => p.ProjectId == projectId).Get();
                if (project.Models.Count == 0) return NotFound();

                bool isStaff = await _SupMan.IsStaffAsync(userId);
                if (!await _SupMan.CanViewProject(project.Models.First(), userId, isStaff)) return Forbid();

                var draftResponse = await _client.From<ProjectDraft>().Where(d => d.ProjectId == projectId).Get();
                var draft = draftResponse.Models.FirstOrDefault();

                var deletedFileNames = SupportManager.ParseDeletedMediaFiles(draft?.DeletedMediaFiles);

                var result = new List<object>();

                var cleanFiles = await _client.Storage.From("ProjectMedia").List(projectId);
                if (cleanFiles != null)
                {
                    foreach (var file in cleanFiles)
                    {
                        if (string.IsNullOrEmpty(file.Name) || deletedFileNames.Contains(file.Name))
                            continue;

                        var publicUrl = _client.Storage.From("ProjectMedia").GetPublicUrl($"{projectId}/{file.Name}");
                        result.Add(new
                        {
                            name = file.Name,
                            url = publicUrl,
                            size = SupportManager.GetFileSize(file),
                            uploadedAt = file.CreatedAt ?? DateTime.UtcNow,
                            isDraft = false
                        });
                    }
                }

                var draftFiles = await _client.Storage.From("ProjectMediaDraft").List(projectId);
                if (draftFiles != null)
                {
                    foreach (var file in draftFiles)
                    {
                        if (string.IsNullOrEmpty(file.Name)) continue;

                        var publicUrl = _client.Storage.From("ProjectMediaDraft").GetPublicUrl($"{projectId}/{file.Name}");
                        result.Add(new
                        {
                            name = file.Name,
                            url = publicUrl,
                            size = SupportManager.GetFileSize(file),
                            uploadedAt = file.CreatedAt ?? DateTime.UtcNow,
                            isDraft = true
                        });
                    }
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Загрузка медиа
        [HttpPost("{projectId}/media/draft")]
        [RequestSizeLimit(Limits.Upload.MediaRequestBytes)]
        public async Task<IActionResult> UploadDraftMedia(string projectId, [FromForm] IFormFile file)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (project.Models.Count == 0) return Forbid();

                var (imageError, ext) = Validator.ValidateEventImage(file);
                if (imageError != null) return BadRequest(new { message = imageError });

                using var input = file.OpenReadStream();
                if (!ImageOptimizer.TryOptimize(input, ImageKind.Media, ext, out var optimized, out var optError))
                    return BadRequest(new { message = optError });

                var currentTotal = await _SupMan.GetTotalProjectMediaSize(projectId);
                if (currentTotal + optimized!.Bytes.Length > Limits.Upload.MediaTotalMaxBytes)
                    return BadRequest(new { message = $"Общий размер вложений не должен превышать {Limits.Upload.MediaTotalMaxBytes / Limits.MB} МБ" });

                var fileName = $"{Guid.NewGuid()}{optimized.Extension}";
                var path = $"{projectId}/{fileName}";

                await _client.Storage.From("ProjectMediaDraft").Upload(optimized.Bytes, path,
                    new Supabase.Storage.FileOptions
                    {
                        Upsert = false,
                        ContentType = optimized.ContentType,
                        CacheControl = "31536000"
                    });

                var publicUrl = _client.Storage.From("ProjectMediaDraft").GetPublicUrl(path);
                return Ok(new { url = publicUrl, fileName, size = optimized.Bytes.Length });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить медиа
        [HttpDelete("{projectId}/media/{fileName}")]
        public async Task<IActionResult> DeleteMedia(string projectId, string fileName)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId && p.OwnerId == userId)
                    .Get();
                if (project.Models.Count == 0) return Forbid();

                var draftFiles = await _client.Storage.From("ProjectMediaDraft").List(projectId);
                var isDraftFile = draftFiles?.Any(f => f.Name == fileName) == true;

                if (isDraftFile)
                {
                    await _client.Storage.From("ProjectMediaDraft").Remove($"{projectId}/{fileName}");
                    return Ok(new { message = "Черновой файл удалён" });
                }

                var draftResponse = await _client.From<ProjectDraft>().Where(d => d.ProjectId == projectId).Get();
                var draft = draftResponse.Models.FirstOrDefault();

                var deletedFileNames = SupportManager.ParseDeletedMediaFiles(draft?.DeletedMediaFiles);

                if (!deletedFileNames.Contains(fileName))
                    deletedFileNames.Add(fileName);

                var updatedJson = JsonSerializer.Serialize(deletedFileNames);

                if (draft == null)
                {
                    await _client.From<ProjectDraft>().Insert(new ProjectDraft
                    {
                        ProjectId = projectId,
                        DeletedMediaFiles = updatedJson,
                        UpdatedAt = DateTime.UtcNow
                    }, new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
                }
                else
                {
                    await _client.From<ProjectDraft>()
                        .Where(d => d.ProjectId == projectId)
                        .Set(d => d.DeletedMediaFiles!, updatedJson)
                        .Set(d => d.UpdatedAt!, DateTime.UtcNow)
                        .Update();
                }

                return Ok(new { message = "Файл помечен на удаление" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}