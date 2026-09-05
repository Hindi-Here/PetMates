using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VacancyController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Получить все заявки с фильтрацией и сортировкой
        [HttpGet]
        public async Task<IActionResult> GetAllVacancies([FromQuery] string? search, [FromQuery] string searchField = "name", [FromQuery] string sortField = "date", [FromQuery] bool sortAsc = false, [FromQuery] bool showBannedOnly = false)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);

                if (!string.IsNullOrEmpty(currentUserId))
                {
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);
                }

                var currentRole = string.IsNullOrEmpty(currentUserId) ? null : await GetCurrentUserRole(currentUserId);
                var isStaff = currentRole == "moderator" || currentRole == "admin";

                var response = await _client.From<Vacancy>()
                    .Where(v => v.IsOpen == true)
                    .Get();

                var enriched = new List<(Vacancy Vacancy, Project? Project, int MembersCount, string? OwnerNickname, bool OwnerBanned)>();

                foreach (var v in response.Models)
                {
                    var project = await _client.From<Project>()
                        .Where(p => p.ProjectId == v.ProjectId)
                        .Get();

                    var projectData = project.Models.FirstOrDefault();
                    if (projectData == null || projectData.IsPrivate) continue;

                    var ownerResponse = await _client.From<User>()
                        .Where(u => u.UserId == projectData.OwnerId)
                        .Get();

                    var owner = ownerResponse.Models.FirstOrDefault();
                    var ownerBanned = owner?.IsBanned == true;

                    if (!isStaff && ownerBanned)
                        continue;
                    if (isStaff && showBannedOnly && !ownerBanned)
                        continue;

                    var membersResponse = await _client.From<ProjectMember>()
                        .Where(pm => pm.ProjectId == v.ProjectId)
                        .Get();

                    enriched.Add((v, projectData, membersResponse.Models.Count, owner?.Nickname, ownerBanned));
                }

                var query = search?.Trim().ToLower();
                if (!string.IsNullOrEmpty(query))
                {
                    enriched = [.. enriched.Where(e =>
                    {
                        return searchField switch
                        {
                            "name" => e.Vacancy.Title?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                            "tag" => SupportManager.ParseSkills(string.Join(" ", e.Vacancy.RequiredTags ?? []))
                                                        .Any(t => t.Contains(query, StringComparison.CurrentCultureIgnoreCase)),
                            "author" => e.OwnerNickname?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                            "project" => e.Project?.Title?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                            _ => true,
                        };
                    })];
                }

                enriched = sortField switch
                {
                    "date" => sortAsc
                        ? [.. enriched.OrderBy(e => e.Vacancy.PublishedAt)]
                        : [.. enriched.OrderByDescending(e => e.Vacancy.PublishedAt)],
                    "alphabet" => sortAsc
                        ? [.. enriched.OrderBy(e => e.Vacancy.Title)]
                        : [.. enriched.OrderByDescending(e => e.Vacancy.Title)],
                    "count" => sortAsc
                        ? [.. enriched.OrderBy(e => e.Project?.RatingCount ?? 0)]
                        : [.. enriched.OrderByDescending(e => e.Project?.RatingCount ?? 0)],
                    "activity" => sortAsc
                        ? [.. enriched.OrderBy(e => e.MembersCount)]
                        : [.. enriched.OrderByDescending(e => e.MembersCount)],
                    _ => enriched
                };

                var vacancies = enriched.Select(e => new
                {
                    e.Vacancy.VacancyId,
                    e.Vacancy.ProjectId,
                    ProjectTitle = e.Project?.Title ?? "Unknown",
                    ProjectShortDesc = e.Project?.ShortDescription ?? "",
                    e.Vacancy.Title,
                    e.Vacancy.Role,
                    e.Vacancy.Description,
                    e.Vacancy.RequiredTags,
                    PublishedAt = e.Vacancy.PublishedAt?.ToString("o"),
                    e.MembersCount,
                    RatingCount = e.Project?.RatingCount ?? 0,
                    e.OwnerBanned
                });

                return Ok(vacancies);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Роль этого пользователя
        private async Task<string?> GetCurrentUserRole(string userId)
        {
            var response = await _client.From<User>().Where(u => u.UserId == userId).Get();
            return response.Models.FirstOrDefault()?.SystemRole;
        }

        // Получить все заявки проекта
        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetProjectVacancies(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);

                if (!string.IsNullOrEmpty(currentUserId))
                {
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);
                }

                bool isStaff = await IsUserStaff(currentUserId!);

                var response = await _client.From<Vacancy>()
                    .Where(v => v.ProjectId == projectId)
                    .Get();

                var vacancies = new List<object>();
                int hiddenCount = 0;

                foreach (var v in response.Models)
                {
                    var project = await _client.From<Project>()
                        .Where(p => p.ProjectId == v.ProjectId)
                        .Get();

                    var projectData = project.Models.FirstOrDefault();
                    if (projectData == null) continue;

                    var ownerResponse = await _client.From<User>()
                        .Where(u => u.UserId == projectData.OwnerId)
                        .Get();

                    var owner = ownerResponse.Models.FirstOrDefault();

                    if (owner == null || (owner.IsBanned == true && !isStaff))
                    {
                        hiddenCount++;
                        continue;
                    }

                    vacancies.Add(new
                    {
                        v.VacancyId,
                        v.ProjectId,
                        ProjectTitle = projectData?.Title ?? "Unknown",
                        v.Title,
                        v.Role,
                        v.Description,
                        v.RequiredTags,
                        v.IsOpen,
                        PublishedAt = v.PublishedAt?.ToString("o"),
                        RatingCount = projectData?.RatingCount ?? 0
                    });
                }

                return Ok(vacancies);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Создать заявку
        [HttpPost]
        public async Task<IActionResult> CreateVacancy([FromBody] CreateVacancyDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var tagsJoined = dto.RequiredTags != null ? string.Join(" ", dto.RequiredTags) : null;
                var error = Validator.ValidateVacancy(dto.Title, dto.Description, tagsJoined);
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var newVacancy = new Vacancy
                {
                    VacancyId = Guid.NewGuid().ToString(),
                    ProjectId = dto.ProjectId,
                    Title = dto.Title,
                    Role = dto.Role,
                    Description = dto.Description,
                    RequiredTags = dto.RequiredTags!,
                    IsOpen = true,
                    PublishedAt = DateTime.UtcNow
                };

                var response = await _client.From<Vacancy>().Insert(newVacancy);
                var created = response.Models.FirstOrDefault();

                if (created == null)
                    return BadRequest("Не удалось создать заявку");

                return Ok(new
                {
                    created.VacancyId,
                    created.ProjectId,
                    created.Title,
                    created.Role,
                    created.Description,
                    created.RequiredTags,
                    created.IsOpen,
                    PublishedAt = created.PublishedAt?.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Редактировать заявку
        [HttpPut("{vacancyId}")]
        public async Task<IActionResult> UpdateVacancy(string vacancyId, [FromBody] UpdateVacancyDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var tagsJoined = dto.RequiredTags != null ? string.Join(" ", dto.RequiredTags) : null;
                var error = Validator.ValidateVacancy(dto.Title, dto.Description, tagsJoined);
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var vacancy = await _client.From<Vacancy>()
                    .Where(v => v.VacancyId == vacancyId)
                    .Get();

                if (vacancy.Models.Count == 0)
                    return NotFound();

                var v = vacancy.Models.First();

                if (dto.Title != null)
                    v.Title = dto.Title;
                if (dto.Role != null)
                    v.Role = dto.Role;
                if (dto.Description != null)
                    v.Description = dto.Description;
                if (dto.RequiredTags != null)
                    v.RequiredTags = dto.RequiredTags;
                if (dto.IsOpen.HasValue)
                    v.IsOpen = dto.IsOpen.Value;

                await _client.From<Vacancy>()
                    .Where(v => v.VacancyId == vacancyId)
                    .Set(v => v.Title, v.Title)
                    .Set(v => v.Role, v.Role)
                    .Set(v => v.Description, v.Description)
                    .Set(v => v.RequiredTags, v.RequiredTags)
                    .Set(v => v.IsOpen, v.IsOpen)
                    .Update();

                return Ok(new
                {
                    v.VacancyId,
                    v.ProjectId,
                    v.Title,
                    v.Role,
                    v.Description,
                    v.RequiredTags,
                    v.IsOpen,
                    PublishedAt = v.PublishedAt?.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить заявку
        [HttpDelete("{vacancyId}")]
        public async Task<IActionResult> DeleteVacancy(string vacancyId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                await _client.From<Vacancy>()
                    .Where(v => v.VacancyId == vacancyId)
                    .Delete();

                return Ok(new { message = "Заявка удалена" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Является ли юзер администратором или модератором
        private async Task<bool> IsUserStaff(string userId)
        {
            if (string.IsNullOrEmpty(userId))
            {
                return false;
            }

            var user = await _client.From<User>()
                .Where(u => u.UserId == userId)
                .Get();

            var role = user.Models.FirstOrDefault()?.SystemRole;
            bool isStaff = role == "admin" || role == "moderator";

            return isStaff;
        }
    }
}