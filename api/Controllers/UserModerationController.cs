using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserModerationController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Бан пользователя
        [HttpPut("{targetUserId}/ban")]
        public async Task<IActionResult> BanUser(string targetUserId, [FromBody] BanUserDto dto)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null) return Unauthorized();
                if (!actor.IsStaff) return Forbid();
                if (targetUserId == actor.UserId)
                    return BadRequest(new { message = "Нельзя заблокировать самого себя" });

                var targetUser = (await _SupMan.System.From<User>().Where(u => u.UserId == targetUserId).Get())
                    .Models.FirstOrDefault();
                if (targetUser == null) return NotFound();
                if (targetUser.IsBanned) return BadRequest(new { message = "Пользователь уже заблокирован" });
                if (!RoleRules.CanModerate(actor.Role, targetUser.SystemRole)) return Forbid();

                if (RoleRules.Normalize(targetUser.SystemRole) == Roles.Admin && await _SupMan.CountActiveAdminsAsync() <= 1)
                    return BadRequest(new { message = "Нельзя заблокировать последнего администратора" });

                var error = Validator.ValidateRequiredText(dto.Reason, Limits.Moderation.ReasonMax, "Причина");
                if (error != null) return BadRequest(new { message = error });

                await _SupMan.System.From<User>()
                    .Where(u => u.UserId == targetUserId)
                    .Set(u => u.IsBanned, true)
                    .Set(u => u.BannedAt!, DateTime.UtcNow)
                    .Set(u => u.BannedReason!, dto.Reason)
                    .Set(u => u.BannedBy!, actor.UserId)
                    .Update();

                await _SupMan.Cache.UserChangedAsync(targetUserId);

                var (responders, invitees) = await _SupMan.GetPendingThirdParties(targetUserId);

                foreach (var (responderId, projectName, vacancyName) in responders)
                {
                    await _SupMan.SendNotificationAsync(responderId, "response", targetUserId, "response_paused_owner_banned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "vacancyName", vacancyName }
                    });
                }

                foreach (var (inviteeId, projectName, role) in invitees)
                {
                    await _SupMan.SendNotificationAsync(inviteeId, "invite", targetUserId, "invite_paused_owner_banned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "role", role }
                    });
                }

                await _SupMan.SendNotificationAsync(actor.UserId, "system", targetUserId, "moderator_banned_user", new Dictionary<string, object>
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
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null) return Unauthorized();
                if (!actor.IsStaff) return Forbid();

                var targetUser = (await _SupMan.System.From<User>().Where(u => u.UserId == targetUserId).Get())
                    .Models.FirstOrDefault();
                if (targetUser == null) return NotFound();
                if (!targetUser.IsBanned) return BadRequest(new { message = "Пользователь не заблокирован" });
                if (!RoleRules.CanModerate(actor.Role, targetUser.SystemRole)) return Forbid();

                await _SupMan.System.From<User>()
                    .Where(u => u.UserId == targetUserId)
                    .Set(u => u.IsBanned, false)
                    .Set(u => u.BannedAt!, null)
                    .Set(u => u.BannedReason!, null)
                    .Set(u => u.BannedBy!, null)
                    .Update();

                await _SupMan.Cache.UserChangedAsync(targetUserId);

                var (responders, invitees) = await _SupMan.GetPendingThirdParties(targetUserId);

                foreach (var (responderId, projectName, vacancyName) in responders)
                {
                    await _SupMan.SendNotificationAsync(responderId, "response", targetUserId, "response_resumed_owner_unbanned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "vacancyName", vacancyName }
                    });
                }

                foreach (var (inviteeId, projectName, role) in invitees)
                {
                    await _SupMan.SendNotificationAsync(inviteeId, "invite", targetUserId, "invite_resumed_owner_unbanned", new Dictionary<string, object>
                    {
                        { "projectName", projectName },
                        { "role", role }
                    });
                }

                await _SupMan.SendNotificationAsync(targetUserId, "system", targetUserId, "unbanned", []);

                await _SupMan.SendNotificationAsync(actor.UserId, "system", targetUserId, "moderator_unbanned_user", new Dictionary<string, object>
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

        // Обновить роль участника (назначить/снять)
        [HttpPut("{targetUserId}/role")]
        public async Task<IActionResult> SetRole(string targetUserId, [FromBody] SetRoleDto dto)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null) return Unauthorized();
                if (!actor.IsAdmin) return Forbid();
                if (targetUserId == actor.UserId)
                    return BadRequest(new { message = "Нельзя изменить собственную роль" });

                if (dto.Role != Roles.User && dto.Role != Roles.Moderator && dto.Role != Roles.Admin)
                    return BadRequest(new { message = "Недопустимая роль" });

                var targetUser = (await _SupMan.System.From<User>().Where(u => u.UserId == targetUserId).Get())
                    .Models.FirstOrDefault();
                if (targetUser == null) return NotFound();

                var previousRole = RoleRules.Normalize(targetUser.SystemRole);
                if (previousRole == dto.Role) return BadRequest(new { message = "Эта роль уже назначена" });
                if (previousRole == Roles.Admin && await _SupMan.CountActiveAdminsAsync() <= 1)
                    return BadRequest(new { message = "Нельзя снять последнего администратора" });

                await _SupMan.System.From<User>()
                    .Where(u => u.UserId == targetUserId)
                    .Set(u => u.SystemRole!, dto.Role)
                    .Update();

                await _SupMan.Cache.UserChangedAsync(targetUserId);

                string targetEventType = dto.Role switch
                {
                    Roles.Admin => "promoted_to_admin",
                    Roles.Moderator => "promoted_to_moderator",
                    _ when previousRole == Roles.Admin => "demoted_from_admin",
                    _ => "demoted_from_moderator",
                };

                await _SupMan.SendNotificationAsync(targetUserId, "system", targetUserId, targetEventType, new Dictionary<string, object> { { "role", dto.Role } });

                string moderatorEventType = (dto.Role == Roles.Admin || dto.Role == Roles.Moderator) ? "moderator_promoted_user" : "moderator_demoted_user";
                await _SupMan.SendNotificationAsync(actor.UserId, "system", targetUserId, moderatorEventType, new Dictionary<string, object>
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
    }
}