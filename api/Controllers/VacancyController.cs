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

        [HttpGet]
        public async Task<IActionResult> GetAllVacancies([FromQuery] string? search,  [FromQuery] string searchField = "name", [FromQuery] string sortField = "date", [FromQuery] bool sortAsc = false)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(userId))
                {
                    await _SupMan.UpdateLastOnlineAsync(userId);
                }

                var response = await _client.From<Vacancy>()
                    .Where(v => v.IsOpen == true)
                    .Get();

                var enriched = new List<(Vacancy Vacancy, Project? Project, int MembersCount, string? OwnerNickname)>();

                foreach (var v in response.Models)
                {
                    var project = await _client.From<Project>()
                        .Where(p => p.ProjectId == v.ProjectId)
                        .Get();
                    var projectData = project.Models.FirstOrDefault();

                    var membersResponse = await _client.From<ProjectMember>()
                        .Where(pm => pm.ProjectId == v.ProjectId)
                        .Get();

                    string? ownerNickname = null;
                    if (projectData != null)
                    {
                        var owner = await _client.From<User>().Where(u => u.UserId == projectData.OwnerId).Get();
                        ownerNickname = owner.Models.FirstOrDefault()?.Nickname;
                    }

                    enriched.Add((v, projectData, membersResponse.Models.Count, ownerNickname));
                }

                var query = search?.Trim().ToLower();
                if (!string.IsNullOrEmpty(query))
                {
                    enriched = enriched.Where(e =>
                    {
                        switch (searchField)
                        {
                            case "name":
                                return e.Vacancy.Title?.ToLower().Contains(query) == true;
                            case "tag":
                                return SupportManager.ParseSkills(string.Join(" ", e.Vacancy.RequiredTags ?? []))
                                    .Any(t => t.ToLower().Contains(query));
                            case "author":
                                return e.OwnerNickname?.ToLower().Contains(query) == true;
                            case "project":
                                return e.Project?.Title?.ToLower().Contains(query) == true;
                            default:
                                return true;
                        }
                    }).ToList();
                }

                enriched = sortField switch
                {
                    "date" => sortAsc
                        ? enriched.OrderBy(e => e.Vacancy.PublishedAt).ToList()
                        : enriched.OrderByDescending(e => e.Vacancy.PublishedAt).ToList(),
                    "alphabet" => sortAsc
                        ? enriched.OrderBy(e => e.Vacancy.Title).ToList()
                        : enriched.OrderByDescending(e => e.Vacancy.Title).ToList(),
                    "count" => sortAsc
                        ? enriched.OrderBy(e => e.Project?.RatingCount ?? 0).ToList()
                        : enriched.OrderByDescending(e => e.Project?.RatingCount ?? 0).ToList(),
                    "activity" => sortAsc
                        ? enriched.OrderBy(e => e.MembersCount).ToList()
                        : enriched.OrderByDescending(e => e.MembersCount).ToList(),
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
                    RatingCount = e.Project?.RatingCount ?? 0
                });

                return Ok(vacancies);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetProjectVacancies(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(userId))
                {
                    await _SupMan.UpdateLastOnlineAsync(userId);
                }

                var response = await _client.From<Vacancy>()
                    .Where(v => v.ProjectId == projectId)
                    .Get();

                var vacancies = new List<object>();

                foreach (var v in response.Models)
                {
                    var project = await _client.From<Project>()
                        .Where(p => p.ProjectId == v.ProjectId)
                        .Get();

                    var projectData = project.Models.FirstOrDefault();

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

                if (dto.Title != null) v.Title = dto.Title;
                if (dto.Role != null) v.Role = dto.Role;
                if (dto.Description != null) v.Description = dto.Description;
                if (dto.RequiredTags != null) v.RequiredTags = dto.RequiredTags;
                if (dto.IsOpen.HasValue) v.IsOpen = dto.IsOpen.Value;

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
    }
}