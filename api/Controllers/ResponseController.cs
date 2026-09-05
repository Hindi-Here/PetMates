using api.Models;
using api.Support;
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
                var userId = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(userId))
                {
                    await _SupMan.UpdateLastOnlineAsync(userId);
                }

                var vacancies = await _client.From<Vacancy>()
                    .Where(v => v.ProjectId == projectId)
                    .Get();

                var vacancyIds = vacancies.Models.Select(v => v.VacancyId).ToList();

                if (vacancyIds.Count == 0)
                    return Ok(new List<object>());

                var allResponses = await _client.From<Response>().Get();
                var responses = allResponses.Models
                    .Where(r => vacancyIds.Contains(r.VacancyId))
                    .ToList();

                var result = new List<object>();

                foreach (var response in responses)
                {
                    var user = await _client.From<User>()
                        .Where(u => u.UserId == response.UserId)
                        .Get();
                    var userData = user.Models.FirstOrDefault();

                    var vacancy = vacancies.Models.FirstOrDefault(v => v.VacancyId == response.VacancyId);

                    var project = await _client.From<Project>()
                        .Where(p => p.ProjectId == projectId)
                        .Get();
                    var projectData = project.Models.FirstOrDefault();

                    result.Add(new
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
                    });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Получить исходящие отклики
        [HttpGet("outgoing/{userId}")]
        public async Task<IActionResult> GetOutgoingResponses(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);

                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var responses = await _client.From<Response>()
                    .Where(r => r.UserId == userId)
                    .Get();

                var result = new List<object>();

                foreach (var response in responses.Models)
                {
                    var vacancy = await _client.From<Vacancy>()
                        .Where(v => v.VacancyId == response.VacancyId)
                        .Get();
                    var vacancyData = vacancy.Models.FirstOrDefault();

                    var vacancyProjectId = vacancyData?.ProjectId;
                    var project = string.IsNullOrEmpty(vacancyProjectId)
                        ? await _client.From<Project>().Get()
                        : await _client.From<Project>()
                            .Where(p => p.ProjectId == vacancyProjectId)
                            .Get();
                    var projectData = project.Models.FirstOrDefault();

                    result.Add(new
                    {
                        response.ResponseId,
                        response.UserId,
                        response.VacancyId,
                        VacancyTitle = vacancyData?.Title ?? "Unknown",
                        ProjectId = projectData?.ProjectId ?? "Unknown",
                        ProjectTitle = projectData?.Title ?? "Unknown",
                        response.Status,
                        CreatedAt = response.CreatedAt.ToString("o")
                    });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Проверка отклика
        [HttpGet("check/{vacancyId}")]
        public async Task<IActionResult> CheckResponse(string vacancyId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var allResponses = await _client.From<Response>().Get();
                var hasResponded = allResponses.Models
                    .Any<Response>(r => r.VacancyId == vacancyId && r.UserId == userId);

                return Ok(new { hasResponded });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Отправить отклик
        [HttpPost]
        public async Task<IActionResult> CreateResponse([FromBody] CreateResponseDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var vacancy = await _client.From<Vacancy>()
                    .Where(v => v.VacancyId == dto.VacancyId)
                    .Get();

                if (vacancy.Models.Count == 0)
                    return NotFound("Вакансия не найдена");

                var vacancyData = vacancy.Models.First();

                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == vacancyData.ProjectId)
                    .Get();

                if (project.Models.Count == 0)
                    return NotFound("Проект не найден");

                var projectData = project.Models.First();

                if (projectData.OwnerId == userId)
                    return BadRequest(new { message = "Нельзя откликнуться на свой проект" });

                var allResponses = await _client.From<Response>().Get();
                var existingResponse = allResponses.Models
                    .Find(r => r.VacancyId == dto.VacancyId && r.UserId == dto.UserId);

                if (existingResponse != null)
                    return BadRequest(new { message = "Вы уже откликнулись на эту вакансию" });

                var newResponse = new Response
                {
                    ResponseId = Guid.NewGuid().ToString(),
                    UserId = dto.UserId,
                    VacancyId = dto.VacancyId,
                    Status = dto.Status,
                    CreatedAt = DateTime.UtcNow
                };

                var response = await _client.From<Response>().Insert(newResponse);
                var created = response.Models.FirstOrDefault();

                if (created == null)
                    return BadRequest("Не удалось создать отклик");

                return Ok(new
                {
                    created.ResponseId,
                    created.UserId,
                    created.VacancyId,
                    created.Status,
                    CreatedAt = created.CreatedAt.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить отклик (отменить)
        [HttpDelete("{responseId}")]
        public async Task<IActionResult> DeleteResponse(string responseId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                await _client.From<Response>()
                    .Where(r => r.ResponseId == responseId)
                    .Delete();

                return Ok(new { message = "Отклик удален" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}