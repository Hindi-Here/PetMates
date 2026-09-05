using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using System.Linq;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserModerationController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;
        private const string RoleUser = "user";
        private const string RoleModerator = "moderator";
        private const string RoleAdmin = "admin";

        // Роль этого пользователя
        private async Task<string?> GetCurrentUserRole(string userId)
        {
            var response = await _client.From<User>().Where(u => u.UserId == userId).Get();
            return response.Models.FirstOrDefault()?.SystemRole;
        }

        // Бан пользовател
        [HttpPut("{targetUserId}/ban")]
        public async Task<IActionResult> BanUser(string targetUserId, [FromBody] BanUserDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var currentRole = await GetCurrentUserRole(currentUserId);
                if (currentRole != RoleModerator && currentRole != RoleAdmin)
                    return Forbid();

                var targetRole = await GetCurrentUserRole(targetUserId);
                if (currentRole == RoleModerator && targetRole != RoleUser)
                    return Forbid();

                var targetUserResponse = await _client.From<User>().Where(u => u.UserId == targetUserId).Get();
                var targetUser = targetUserResponse.Models.FirstOrDefault();

                await _client.From<User>()
                    .Where(u => u.UserId == targetUserId)
                    .Set(u => u.IsBanned, true)
                    .Set(u => u.BannedAt!, DateTime.UtcNow)
                    .Set(u => u.BannedReason!, dto.Reason)
                    .Set(u => u.BannedBy!, currentUserId)
                    .Update();

                var (responders, invitees) = await GetPendingThirdParties(targetUserId);

                foreach (var (responderId, projectName, vacancyName) in responders)
                {
                    await SendModerationNotification(responderId, "response", targetUserId, "response_paused_owner_banned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "vacancyName", vacancyName }
                    });
                }

                foreach (var (inviteeId, projectName, role) in invitees)
                {
                    await SendModerationNotification(inviteeId, "invite", targetUserId, "invite_paused_owner_banned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "role", role }
                    });
                }

                await SendModerationNotification(currentUserId, "system", targetUserId, "moderator_banned_user", new Dictionary<string, object>
                {
                    { "nickname", targetUser?.Nickname ?? "Пользователь" }
                });

                return Ok(new { message = "Пользователь заблокирован" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Разбан пользователя
        [HttpPut("{targetUserId}/unban")]
        public async Task<IActionResult> UnbanUser(string targetUserId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var currentRole = await GetCurrentUserRole(currentUserId);
                if (currentRole != RoleModerator && currentRole != RoleAdmin)
                    return Forbid();

                var targetUserResponse = await _client.From<User>().Where(u => u.UserId == targetUserId).Get();
                var targetUser = targetUserResponse.Models.FirstOrDefault();

                await _client.From<User>()
                    .Where(u => u.UserId == targetUserId)
                    .Set(u => u.IsBanned, false)
                    .Set(u => u.BannedAt!, null)
                    .Set(u => u.BannedReason!, null)
                    .Set(u => u.BannedBy!, null)
                    .Update();

                var (responders, invitees) = await GetPendingThirdParties(targetUserId);

                foreach (var (responderId, projectName, vacancyName) in responders)
                {
                    await SendModerationNotification(responderId, "response", targetUserId, "response_resumed_owner_unbanned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "vacancyName", vacancyName }
                    });
                }

                foreach (var (inviteeId, projectName, role) in invitees)
                {
                    await SendModerationNotification(inviteeId, "invite", targetUserId, "invite_resumed_owner_unbanned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "role", role }
                    });
                }

                await SendModerationNotification(targetUserId, "system", targetUserId, "unbanned", []);

                await SendModerationNotification(currentUserId, "system", targetUserId, "moderator_unbanned_user", new Dictionary<string, object>
                {
                    { "nickname", targetUser?.Nickname ?? "Пользователь" }
                });

                return Ok(new { message = "Пользователь разблокирован" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Изменить роль
        [HttpPut("{targetUserId}/role")]
        public async Task<IActionResult> SetRole(string targetUserId, [FromBody] SetRoleDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var currentRole = await GetCurrentUserRole(currentUserId);
                if (currentRole != RoleAdmin)
                    return Forbid();

                if (dto.Role != RoleUser && dto.Role != RoleModerator && dto.Role != RoleAdmin)
                    return BadRequest(new { message = "Недопустимая роль" });

                var previousRole = await GetCurrentUserRole(targetUserId);

                var targetUserResponse = await _client.From<User>().Where(u => u.UserId == targetUserId).Get();
                var targetUser = targetUserResponse.Models.FirstOrDefault();

                await _client.From<User>()
                    .Where(u => u.UserId == targetUserId)
                    .Set(u => u.SystemRole!, dto.Role)
                    .Update();

                string targetEventType = dto.Role switch
                {
                    RoleAdmin => "promoted_to_admin",
                    RoleModerator => "promoted_to_moderator",
                    _ when previousRole == RoleAdmin => "demoted_from_admin",
                    _ => "demoted_from_moderator",
                };
                await SendModerationNotification(targetUserId, "system", targetUserId, targetEventType, new Dictionary<string, object> { { "role", dto.Role } });

                string moderatorEventType = (dto.Role == RoleAdmin || dto.Role == RoleModerator) ? "moderator_promoted_user" : "moderator_demoted_user";
                await SendModerationNotification(currentUserId, "system", targetUserId, moderatorEventType, new Dictionary<string, object>
                {
                    { "role", dto.Role },
                    { "nickname", targetUser?.Nickname ?? "Пользователь" }
                });

                return Ok(new { message = "Роль обновлена" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Получить данные о забаненном пользователе
        private async Task<(List<(string ResponderId, string ProjectName, string VacancyName)> Responders, List<(string InviteeId, string ProjectName, string Role)> Invitees)> GetPendingThirdParties(string ownerId)
        {
            var responders = new List<(string, string, string)>();
            var invitees = new List<(string, string, string)>();

            var projects = await _client.From<Project>().Where(p => p.OwnerId == ownerId).Get();

            foreach (var project in projects.Models)
            {
                var vacancies = await _client.From<Vacancy>().Where(v => v.ProjectId == project.ProjectId).Get();
                foreach (var vacancy in vacancies.Models)
                {
                    var vacancyResponses = await _client.From<Response>()
                        .Where(r => r.VacancyId == vacancy.VacancyId && r.Status == "pending")
                        .Get();
                    foreach (var responderId in vacancyResponses.Models.Select(r => r.UserId).Distinct())
                        responders.Add((responderId, project.Title, vacancy.Title));
                }

                var invites = await _client.From<Invite>()
                    .Where(i => i.ProjectId == project.ProjectId && i.Status == "pending")
                    .Get();
                foreach (var invite in invites.Models)
                    invitees.Add((invite.UserId, project.Title, invite.Role));
            }

            return (responders, invitees);
        }

        // Пользователи, связанные с заблокированным пользователем, уведомляются о приостановке их заявок и приглашений
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

    public class BanUserDto { public string? Reason { get; set; } }
    public class SetRoleDto { public string Role { get; set; } = string.Empty; }
}