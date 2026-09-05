using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectModerationController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;
        private const string RoleModerator = "moderator";
        private const string RoleAdmin = "admin";

        // Удалить проект
        [HttpDelete("{projectId}")]
        public async Task<IActionResult> DeleteProject(string projectId, [FromBody] DeleteProjectWithReasonDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var currentUser = await _client.From<User>().Where(u => u.UserId == currentUserId).Get();
                var currentRole = currentUser.Models.FirstOrDefault()?.SystemRole;
                if (currentRole != RoleModerator && currentRole != RoleAdmin)
                    return Forbid();

                var response = await _client.From<Project>().Where(p => p.ProjectId == projectId).Get();
                var project = response.Models.FirstOrDefault();
                if (project == null)
                    return NotFound();

                if (project.IsPrivate)
                    return NotFound();

                var ownerId = project.OwnerId;
                var projectTitle = project.Title;
                var reason = dto.Reason ?? "не указана";

                var ownerUser = await _client.From<User>().Where(u => u.UserId == ownerId).Get();
                var ownerNickname = ownerUser.Models.FirstOrDefault()?.Nickname ?? "Пользователь";

                var vacancies = await _client.From<Vacancy>().Where(v => v.ProjectId == projectId).Get();
                var vacancyIds = vacancies.Models.Select(v => v.VacancyId).ToList();

                var affectedResponders = new HashSet<string>();
                foreach (var vacancyId in vacancyIds)
                {
                    var vacancyResponses = await _client.From<Response>().Where(r => r.VacancyId == vacancyId).Get();
                    foreach (var r in vacancyResponses.Models)
                        affectedResponders.Add(r.UserId);
                }

                var invites = await _client.From<Invite>().Where(i => i.ProjectId == projectId).Get();
                var affectedInvitees = invites.Models.Select(i => i.UserId).Distinct().ToList();

                await _client.From<Project>()
                    .Where(p => p.ProjectId == projectId)
                    .Delete();

                await SendModerationNotification(ownerId, "project", projectId, "project_deleted_by_moderator", new Dictionary<string, object>
                {
                    { "projectName", projectTitle },
                    { "reason", reason }
                });

                foreach (var responderId in affectedResponders)
                {
                    await SendModerationNotification(responderId, "response", projectId, "responses_revoked_project_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "projectName", projectTitle }
                    });
                }

                foreach (var inviteeId in affectedInvitees)
                {
                    await SendModerationNotification(inviteeId, "invite", projectId, "invites_revoked_project_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "projectName", projectTitle },
                        { "nickname", ownerNickname }
                    });
                }

                await SendModerationNotification(currentUserId, "project", projectId, "moderator_deleted_project", new Dictionary<string, object>
                {
                    { "projectName", projectTitle },
                    { "reason", reason }
                });

                return Ok(new { message = "Проект удалён модератором" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Отправить уведомление
        private async Task SendModerationNotification(string userId, string referenceType, string referenceId, string eventType, Dictionary<string, object> contextData)
        {
            try
            {
                contextData["eventType"] = eventType;
                var notification = new Notification
                {
                    NotificationId = Guid.NewGuid().ToString(),
                    UserId = userId,
                    ReferenceId = referenceId,
                    ReferenceType = referenceType,
                    ContextData = System.Text.Json.JsonSerializer.Serialize(contextData),
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };
                await _client.From<Notification>().Insert(notification, new Supabase.Postgrest.QueryOptions { Returning = Supabase.Postgrest.QueryOptions.ReturnType.Minimal });
            }
            catch (Exception){}
        }
    }

    public class DeleteProjectWithReasonDto { public string? Reason { get; set; } }
}