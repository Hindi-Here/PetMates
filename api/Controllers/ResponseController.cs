using api.Models;
using api.Support;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ResponseController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Получить отклики
        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetProjectResponses(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                if (!await _SupMan.IsProjectOwnerAsync(projectId, actor.UserId))
                    return Forbid();

                var vacancies = await _client.From<Vacancy>().Where(v => v.ProjectId == projectId).Get();
                var vacancyIds = vacancies.Models.Select(v => v.VacancyId).ToList();
                if (vacancyIds.Count == 0)
                    return Ok(new List<object>());

                var responses = (await _client.From<Response>().Filter("vacancy_id", Supabase.Postgrest.Constants.Operator.In, vacancyIds).Get()).Models;
                var projectData = (await _client.From<Project>().Where(p => p.ProjectId == projectId).Get()).Models.FirstOrDefault();
                var users = (await _SupMan.GetAllUsersAsync()).Where(u => u.UserId != null).ToDictionary(u => u.UserId!);

                var result = responses.Select(response =>
                {
                    users.TryGetValue(response.UserId, out var userData);
                    var vacancy = vacancies.Models.FirstOrDefault(v => v.VacancyId == response.VacancyId);
                    return new
                    {
                        response.ResponseId,
                        response.UserId,
                        UserNickname = userData?.Nickname ?? "Unknown",
                        response.VacancyId,
                        VacancyTitle = vacancy?.Title ?? "Unknown",
                        ProjectId = projectId,
                        ProjectTitle = projectData?.Title ?? "Unknown",
                        response.Status,
                        CreatedAt = response.CreatedAt.ToString("o")
                    };
                }).ToList();

                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось загрузить отклики" });
            }
        }

        // Получить исходящие отклики
        [HttpGet("outgoing/{userId}")]
        public async Task<IActionResult> GetOutgoingResponses(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                if (userId != actor.UserId)
                    return Forbid();

                var responses = await _client.From<Response>().Where(r => r.UserId == userId).Get();
                var result = new List<object>();

                foreach (var response in responses.Models)
                {
                    var vacancy = (await _client.From<Vacancy>().Where(v => v.VacancyId == response.VacancyId).Get()).Models.FirstOrDefault();
                    if (vacancy == null) continue;

                    var project = (await _client.From<Project>().Where(p => p.ProjectId == vacancy.ProjectId).Get()).Models.FirstOrDefault();

                    result.Add(new
                    {
                        response.ResponseId,
                        response.UserId,
                        response.VacancyId,
                        VacancyTitle = vacancy.Title ?? "Unknown",
                        ProjectId = project?.ProjectId ?? "Unknown",
                        ProjectTitle = project?.Title ?? "Unknown",
                        response.Status,
                        CreatedAt = response.CreatedAt.ToString("o")
                    });
                }
                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось загрузить исходящие отклики" });
            }
        }

        // Проверка отклика
        [HttpGet("check/{vacancyId}")]
        public async Task<IActionResult> CheckResponse(string vacancyId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var existing = await _client.From<Response>().Where(r => r.VacancyId == vacancyId && r.UserId == userId).Get();
                return Ok(new { hasResponded = existing.Models.Count != 0 });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Ошибка проверки отклика" });
            }
        }

        // Отправить отклик
        [HttpPost]
        public async Task<IActionResult> CreateResponse([FromBody] CreateResponseDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                var vacancy = (await _client.From<Vacancy>().Where(v => v.VacancyId == dto.VacancyId).Get()).Models.FirstOrDefault();
                if (vacancy == null)
                    return NotFound(new { message = "Вакансия не найдена" });

                var projectData = (await _client.From<Project>().Where(p => p.ProjectId == vacancy.ProjectId).Get()).Models.FirstOrDefault();
                if (projectData == null)
                    return NotFound(new { message = "Проект не найден" });

                if (!vacancy.IsOpen) return BadRequest(new { message = "Заявка закрыта" });
                if (!await _SupMan.CanViewProject(projectData, actor.UserId, false))
                    return NotFound(new { message = "Проект недоступен" });
                if (projectData.OwnerId == actor.UserId)
                    return BadRequest(new { message = "Нельзя откликнуться на свой проект" });

                var alreadyMember = await _client.From<ProjectMember>().Where(pm => pm.ProjectId == projectData.ProjectId && pm.UserId == actor.UserId).Get();
                if (alreadyMember.Models.Count > 0)
                    return BadRequest(new { message = "Вы уже в команде проекта" });

                var existingResponse = await _client.From<Response>().Where(r => r.VacancyId == dto.VacancyId && r.UserId == actor.UserId).Get();
                if (existingResponse.Models.Count != 0)
                    return BadRequest(new { message = "Вы уже откликнулись на эту вакансию" });

                var newResponse = new Response
                {
                    ResponseId = Guid.NewGuid().ToString(),
                    UserId = actor.UserId, 
                    VacancyId = dto.VacancyId,
                    Status = "pending", 
                    CreatedAt = DateTime.UtcNow
                };

                var response = await _client.From<Response>().Insert(newResponse);
                var created = response.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest(new { message = "Не удалось создать отклик" });

                return Ok(new { created.ResponseId, created.UserId, created.VacancyId, created.Status, CreatedAt = created.CreatedAt.ToString("o") });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось создать отклик" });
            }
        }

        // Удалить отклик (отменить)
        [HttpDelete("{responseId}")]
        public async Task<IActionResult> DeleteResponse(string responseId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                var resp = (await _client.From<Response>().Where(r => r.ResponseId == responseId).Get()).Models.FirstOrDefault();
                if (resp == null)
                    return NotFound();

                var vac = (await _client.From<Vacancy>().Where(v => v.VacancyId == resp.VacancyId).Get()).Models.FirstOrDefault();
                var ownerId = vac == null ? null : (await _client.From<Project>().Where(p => p.ProjectId == vac.ProjectId).Get()).Models.FirstOrDefault()?.OwnerId;

                if (resp.UserId != actor.UserId && ownerId != actor.UserId)
                    return Forbid();

                await _client.From<Response>().Where(r => r.ResponseId == responseId).Delete();
                return Ok(new { message = "Отклик удален" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось удалить отклик" });
            }
        }
    }
}