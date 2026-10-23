using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VacancyModerationController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Удалить заявку
        [HttpDelete("{vacancyId}")]
        public async Task<IActionResult> DeleteVacancy(string vacancyId, [FromBody] DeleteVacancyWithReasonDto dto)
        {
            try
            {
                var currentUserId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var currentRole = await _SupMan.GetRoleAsync(currentUserId);
                if (currentRole != Roles.Moderator && currentRole != Roles.Admin)
                    return Forbid();

                var error = Validator.ValidateModerationReason(dto.Reason);
                if (error != null)
                    return BadRequest(new { message = error });

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
                    ownerNickname = ownerUser.Models.FirstOrDefault()?.Nickname ?? "П aльзователь";
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

                await _SupMan.Cache.VacanciesChangedAsync();

                if (!string.IsNullOrEmpty(ownerId))
                {
                    await _SupMan.SendNotificationAsync(ownerId, "response", vacancyId, "vacancy_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "vacancyName", vacancyTitle },
                        { "reason", reason }
                    });
                }

                foreach (var responderId in affectedResponders)
                {
                    await _SupMan.SendNotificationAsync(responderId, "response", vacancyId, "responses_revoked_vacancy_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "vacancyName", vacancyTitle }
                    });
                }

                foreach (var inviteeId in affectedInvitees)
                {
                    await _SupMan.SendNotificationAsync(inviteeId, "invite", vacancyId, "invites_revoked_vacancy_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "vacancyName", vacancyTitle },
                        { "nickname", ownerNickname }
                    });
                }

                await _SupMan.SendNotificationAsync(currentUserId, "response", vacancyId, "moderator_deleted_vacancy", new Dictionary<string, object>
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
    }
}