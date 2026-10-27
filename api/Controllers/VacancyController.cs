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
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var isStaff = viewer.IsStaff;

                var enriched = (await _SupMan.GetVacancyListAsync())
                    .Where(e => isStaff ? (!showBannedOnly || e.OwnerIsBanned) : !e.OwnerIsBanned)
                    .Select(e => (e.Vacancy, Project: (Project?)e.Project, e.MembersCount, e.OwnerNickname, e.OwnerIsBanned, e.OwnerSystemRole))
                    .ToList();

                var query = search?.Trim().ToLower();
                if (!string.IsNullOrEmpty(query))
                {
                    enriched = [.. enriched.Where(e => searchField switch
                    {
                        "name" => e.Vacancy.Title?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                        "tag" => SupportManager.ParseSkills(string.Join(" ", e.Vacancy.RequiredTags ?? []))
                                                    .Any(t => t.Contains(query, StringComparison.CurrentCultureIgnoreCase)),
                        "author" => e.OwnerNickname?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                        "project" => e.Project?.Title?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                        _ => true,
                    })];
                }

                enriched = sortField switch
                {
                    "date" => sortAsc ? [.. enriched.OrderBy(e => e.Vacancy.PublishedAt)] : [.. enriched.OrderByDescending(e => e.Vacancy.PublishedAt)],
                    "alphabet" => sortAsc ? [.. enriched.OrderBy(e => e.Vacancy.Title)] : [.. enriched.OrderByDescending(e => e.Vacancy.Title)],
                    "count" => sortAsc ? [.. enriched.OrderBy(e => e.Project?.RatingCount ?? 0)] : [.. enriched.OrderByDescending(e => e.Project?.RatingCount ?? 0)],
                    "activity" => sortAsc ? [.. enriched.OrderBy(e => e.MembersCount)] : [.. enriched.OrderByDescending(e => e.MembersCount)],
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
                    e.Project?.OwnerId,
                    e.OwnerSystemRole,
                    e.OwnerIsBanned
                });

                return Ok(vacancies);
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Получить все заявки проекта
        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetProjectVacancies(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = await _SupMan.GetUserIdAsync(authHeader);
                if (!string.IsNullOrEmpty(currentUserId)) await _SupMan.UpdateLastOnlineAsync(currentUserId);

                var proj = (await _client.From<Project>().Where(p => p.ProjectId == projectId).Get()).Models.FirstOrDefault();
                if (proj == null || !await _SupMan.CanViewProject(proj, currentUserId, await _SupMan.IsStaffAsync(currentUserId)))
                    return NotFound();

                var response = await _client.From<Vacancy>().Where(v => v.ProjectId == projectId).Get();

                var vacancies = response.Models.Select(v => new
                {
                    v.VacancyId,
                    v.ProjectId,
                    ProjectTitle = proj.Title,
                    v.Title,
                    v.Role,
                    v.Description,
                    v.RequiredTags,
                    v.IsOpen,
                    PublishedAt = v.PublishedAt?.ToString("o"),
                    proj.RatingCount,
                    proj.OwnerId,
                    OwnerSystemRole = proj.OwnerId != null ? "user" : null,
                    OwnerIsBanned = false
                }).ToList();

                return Ok(vacancies);
            }
            catch (Exception ex) { return this.Fail(ex); }
        }


        // Создать заявку
        [HttpPost]
        public async Task<IActionResult> CreateVacancy([FromBody] CreateVacancyDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                if (!await _SupMan.IsProjectOwnerAsync(dto.ProjectId, actor.UserId)) return Forbid();

                var tagsJoined = dto.RequiredTags != null ? string.Join(" ", dto.RequiredTags) : null;
                var error = Validator.ValidateVacancy(dto.Title, dto.Description, tagsJoined);
                if (error != null)
                    return BadRequest(new { message = error });

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
                await _SupMan.Cache.VacanciesChangedAsync();

                var created = response.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest(new { message = "Не удалось создать заявку" });

                return Ok(new { created.VacancyId, created.ProjectId, created.Title, created.Role, created.Description, created.RequiredTags, created.IsOpen, PublishedAt = created.PublishedAt?.ToString("o") });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Редактировать заявку
        [HttpPut("{vacancyId}")]
        public async Task<IActionResult> UpdateVacancy(string vacancyId, [FromBody] UpdateVacancyDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                var v = (await _client.From<Vacancy>().Where(x => x.VacancyId == vacancyId).Get()).Models.FirstOrDefault();
                if (v == null)
                    return NotFound();

                if (!await _SupMan.IsProjectOwnerAsync(v.ProjectId, actor.UserId))
                    return Forbid();

                var titleToValidate = dto.Title ?? v.Title;
                var descToValidate = dto.Description ?? v.Description;
                var tagsToValidate = dto.RequiredTags != null ? string.Join(" ", dto.RequiredTags) : (v.RequiredTags != null ? string.Join(" ", v.RequiredTags) : null);

                var error = Validator.ValidateVacancy(titleToValidate, descToValidate, tagsToValidate);
                if (error != null)
                    return BadRequest(new { message = error });

                await _client.From<Vacancy>()
                    .Where(x => x.VacancyId == vacancyId)
                    .Set(x => x.Title, titleToValidate)
                    .Set(x => x.Role, dto.Role ?? v.Role)
                    .Set(x => x.Description, descToValidate)
                    .Set(x => x.RequiredTags, dto.RequiredTags ?? v.RequiredTags)
                    .Set(x => x.IsOpen, dto.IsOpen ?? v.IsOpen)
                    .Update();

                await _SupMan.Cache.VacanciesChangedAsync();

                return Ok(new { v.VacancyId, v.ProjectId, Title = titleToValidate, Role = dto.Role ?? v.Role, Description = descToValidate, RequiredTags = dto.RequiredTags ?? v.RequiredTags, IsOpen = dto.IsOpen ?? v.IsOpen, PublishedAt = v.PublishedAt?.ToString("o") });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить заявку
        [HttpDelete("{vacancyId}")]
        public async Task<IActionResult> DeleteVacancy(string vacancyId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                var v = (await _client.From<Vacancy>().Where(x => x.VacancyId == vacancyId).Get()).Models.FirstOrDefault();
                if (v == null)
                    return NotFound();

                if (!await _SupMan.IsProjectOwnerAsync(v.ProjectId, actor.UserId))
                    return Forbid();

                var projTitle = (await _client.From<Project>().Where(p => p.ProjectId == v.ProjectId).Get()).Models.FirstOrDefault()?.Title ?? "Проект";
                var responders = (await _client.From<Response>().Where(r => r.VacancyId == vacancyId).Get())
                    .Models.Select(r => r.UserId).Distinct().ToList();
                var invites = (await _client.From<Invite>()
                    .Where(i => i.ProjectId == v.ProjectId && i.Role == v.Title && i.Status == "pending").Get()).Models;
                var inviteIds = invites.Select(i => i.InviteId).ToList();
                var invitees = invites.Select(i => i.UserId).Distinct().ToList();

                await _client.From<Vacancy>().Where(x => x.VacancyId == vacancyId).Delete();
                if (inviteIds.Count > 0)
                    await _client.From<Invite>().Where(i => inviteIds.Contains(i.InviteId)).Delete();
                await _SupMan.Cache.VacanciesChangedAsync();

                foreach (var uid in responders)
                    await _SupMan.SendNotificationAsync(uid, "response", v.ProjectId, "responses_revoked_vacancy_deleted",
                        new() { ["projectName"] = projTitle, ["vacancyName"] = v.Title });
                foreach (var uid in invitees)
                    await _SupMan.SendNotificationAsync(uid, "invite", v.ProjectId, "invites_revoked_vacancy_deleted",
                        new() { ["projectName"] = projTitle, ["vacancyName"] = v.Title });

                return Ok(new { message = "Заявка удалена" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}