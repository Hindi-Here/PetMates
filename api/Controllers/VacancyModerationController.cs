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
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null) return Unauthorized();
                if (!actor.IsStaff) return Forbid();

                var error = Validator.ValidateModerationReason(dto.Reason);
                if (error != null) return BadRequest(new { message = error });

                var vacancyResponse = await _client.From<Vacancy>().Where(v => v.VacancyId == vacancyId).Get();
                var vacancy = vacancyResponse.Models.FirstOrDefault();
                if (vacancy == null) return NotFound();

                var project = await _client.From<Project>().Where(p => p.ProjectId == vacancy.ProjectId).Get();
                var projectData = project.Models.FirstOrDefault();

                if (projectData == null || projectData.IsPrivate) return NotFound();

                if (projectData.OwnerId == actor.UserId)
                    return BadRequest(new { message = "Свою заявку удаляйте обычным способом" });

                if (!RoleRules.CanModerate(actor.Role, await _SupMan.GetRoleAsync(projectData.OwnerId)))
                    return Forbid();

                var reason = dto.Reason!.Trim();
                var vacancyTitle = vacancy.Title;

                var ownerNickname = "Пользователь";
                if (!string.IsNullOrEmpty(projectData.OwnerId))
                {
                    var ownerUser = await _client.From<User>().Where(u => u.UserId == projectData.OwnerId).Get();
                    ownerNickname = ownerUser.Models.FirstOrDefault()?.Nickname ?? "Пользователь";
                }

                var vacancyResponses = await _client.From<Response>().Where(r => r.VacancyId == vacancyId).Get();
                var affectedResponders = vacancyResponses.Models.Select(r => r.UserId).Distinct().ToList();

                var affectedInvitees = new List<string>();
                var invitesToDelete = new List<string>();

                if (!string.IsNullOrEmpty(projectData.OwnerId))
                {
                    var invites = await _client.From<Invite>()
                        .Where(i => i.ProjectId == vacancy.ProjectId && i.Role == vacancyTitle && i.Status == "pending")
                        .Get();
                    affectedInvitees = [.. invites.Models.Select(i => i.UserId).Distinct()];
                    invitesToDelete = [.. invites.Models.Select(i => i.InviteId)];
                }

                await _client.From<Vacancy>().Where(v => v.VacancyId == vacancyId).Delete();

                if (invitesToDelete.Count > 0)
                {
                    await _client.From<Invite>().Where(i => invitesToDelete.Contains(i.InviteId)).Delete();
                }

                await _SupMan.Cache.VacanciesChangedAsync();

                if (!string.IsNullOrEmpty(projectData.OwnerId))
                {
                    await _SupMan.SendNotificationAsync(projectData.OwnerId, "response", vacancyId, "vacancy_deleted_by_moderator", new Dictionary<string, object>
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

                await _SupMan.SendNotificationAsync(actor.UserId, "response", vacancyId, "moderator_deleted_vacancy", new Dictionary<string, object>
                {
                    { "vacancyName", vacancyTitle },
                    { "reason", reason }
                });

                return Ok(new { message = "Заявка удалена модератором" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}