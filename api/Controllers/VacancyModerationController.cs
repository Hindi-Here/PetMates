using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using System.Collections.Generic;
using System.Linq;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VacancyModerationController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        private const string RoleModerator = "moderator";
        private const string RoleAdmin = "admin";

        // Удалить заявку
        [HttpDelete("{vacancyId}")]
        public async Task<IActionResult> DeleteVacancy(string vacancyId, [FromBody] DeleteVacancyWithReasonDto dto)
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

                var vacancyResponse = await _client.From<Vacancy>().Where(v => v.VacancyId == vacancyId).Get();
                var vacancy = vacancyResponse.Models.FirstOrDefault();
                if (vacancy == null)
                    return NotFound();

                var project = await _client.From<Project>().Where(p => p.ProjectId == vacancy.ProjectId).Get();
                var projectData = project.Models.FirstOrDefault();
                var ownerId = projectData?.OwnerId;
                var vacancyTitle = vacancy.Title;
                var reason = dto.Reason ?? "не указана";

                var ownerNickname = "Пользователь";
                if (!string.IsNullOrEmpty(ownerId))
                {
                    var ownerUser = await _client.From<User>().Where(u => u.UserId == ownerId).Get();
                    ownerNickname = ownerUser.Models.FirstOrDefault()?.Nickname ?? "Пользователь";
                }

                var vacancyResponses = await _client.From<Response>().Where(r => r.VacancyId == vacancyId).Get();
                var affectedResponders = vacancyResponses.Models.Select(r => r.UserId).Distinct().ToList();

                var affectedInvitees = new List<string>();
                if (!string.IsNullOrEmpty(ownerId))
                {
                    var invites = await _client.From<Invite>()
                        .Where(i => i.ProjectId == vacancy.ProjectId && i.Role == vacancyTitle && i.Status == "pending")
                        .Get();
                    affectedInvitees = [.. invites.Models.Select(i => i.UserId).Distinct()];
                }

                await _client.From<Vacancy>()
                    .Where(v => v.VacancyId == vacancyId)
                    .Delete();

                if (!string.IsNullOrEmpty(ownerId))
                {
                    await SendModerationNotification(ownerId, "response", vacancyId, "vacancy_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "vacancyName", vacancyTitle },
                        { "reason", reason }
                    });
                }

                foreach (var responderId in affectedResponders)
                {
                    await SendModerationNotification(responderId, "response", vacancyId, "responses_revoked_vacancy_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "vacancyName", vacancyTitle }
                    });
                }

                foreach (var inviteeId in affectedInvitees)
                {
                    await SendModerationNotification(inviteeId, "invite", vacancyId, "invites_revoked_vacancy_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "vacancyName", vacancyTitle },
                        { "nickname", ownerNickname }
                    });
                }

                await SendModerationNotification(currentUserId, "response", vacancyId, "moderator_deleted_vacancy", new Dictionary<string, object>
                {
                    { "vacancyName", vacancyTitle },
                    { "reason", reason }
                });

                return Ok(new { message = "Заявка удалена модератором" });
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

    public class DeleteVacancyWithReasonDto { public string? Reason { get; set; } }
}