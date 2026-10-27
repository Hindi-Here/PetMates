using api.Models;
using api.Support;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
            catch (Exception ex) { return this.Fail(ex); }
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
            catch (Exception ex) { return this.Fail(ex); }
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
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Отправить отклик
        [HttpPost]
        [EnableRateLimiting("write")]
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
                if (await _SupMan.IsBlockedBetweenAsync(actor.UserId, projectData.OwnerId))
                    return BadRequest(new { message = "Невозможно откликнуться на этот проект" });

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

                var me = await _SupMan.GetUserCachedAsync(actor.UserId);
                var ctx = new Dictionary<string, object>
                {
                    ["projectName"] = projectData.Title,
                    ["vacancyName"] = vacancy.Title,
                };
                await _SupMan.SendNotificationAsync(actor.UserId, "response", projectData.ProjectId, "response_sent", new(ctx));
                await _SupMan.SendNotificationAsync(projectData.OwnerId, "response", projectData.ProjectId, "response_received",
                    new(ctx) { ["nickname"] = me?.Nickname ?? "Пользователь" });

                return Ok(new { created.ResponseId, created.UserId, created.VacancyId, created.Status, CreatedAt = created.CreatedAt.ToString("o") });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить отклик (отменить)
        [HttpDelete("{responseId}")]
        [EnableRateLimiting("write")]
        public async Task<IActionResult> DeleteResponse(string responseId)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null)
                    return Unauthorized();

                var resp = (await _client.From<Response>().Where(r => r.ResponseId == responseId).Get()).Models.FirstOrDefault();
                if (resp == null)
                    return NotFound();
                if (resp.UserId != actor.UserId)
                    return Forbid();

                var vac = (await _client.From<Vacancy>().Where(v => v.VacancyId == resp.VacancyId).Get()).Models.FirstOrDefault();
                var project = vac == null ? null
                    : (await _client.From<Project>().Where(p => p.ProjectId == vac.ProjectId).Get()).Models.FirstOrDefault();

                await _client.From<Response>().Where(r => r.ResponseId == responseId).Delete();

                if (project != null)
                {
                    var me = await _SupMan.GetUserCachedAsync(actor.UserId);
                    await _SupMan.SendNotificationAsync(project.OwnerId, "response", project.ProjectId, "response_cancelled",
                        new() { ["projectName"] = project.Title, ["vacancyName"] = vac!.Title, ["nickname"] = me?.Nickname ?? "Пользователь" });
                }
                return Ok(new { message = "Отклик удалён" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Принять
        [HttpPost("{responseId}/accept")]
        [EnableRateLimiting("write")]
        public Task<IActionResult> Accept(string responseId) => Decide(responseId, true);

        // Октлонить
        [HttpPost("{responseId}/decline")]
        [EnableRateLimiting("write")]
        public Task<IActionResult> Decline(string responseId) => Decide(responseId, false);

        private async Task<IActionResult> Decide(string responseId, bool accept)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null)
                    return Unauthorized();

                var resp = (await _client.From<Response>().Where(r => r.ResponseId == responseId).Get()).Models.FirstOrDefault();
                if (resp == null)
                    return NotFound();

                var vac = (await _client.From<Vacancy>().Where(v => v.VacancyId == resp.VacancyId).Get()).Models.FirstOrDefault();
                var project = vac == null ? null
                    : (await _client.From<Project>().Where(p => p.ProjectId == vac.ProjectId).Get()).Models.FirstOrDefault();
                if (vac == null || project == null || project.OwnerId != actor.UserId)
                    return Forbid();

                await _client.From<Response>().Where(r => r.ResponseId == responseId).Delete();

                await _SupMan.SendNotificationAsync(resp.UserId, "response", project.ProjectId,
                    accept ? "response_accepted" : "response_rejected",
                    new() { ["projectName"] = project.Title, ["vacancyName"] = vac.Title });

                return Ok(new { message = accept ? "Отклик принят" : "Отклик отклонён" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}