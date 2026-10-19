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

        // Удалить проект 
        [HttpDelete("{projectId}")]
        public async Task<IActionResult> DeleteProject(string projectId, [FromBody] DeleteProjectWithReasonDto dto)
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

                await _SupMan.SendNotificationAsync(ownerId, "project", projectId, "project_deleted_by_moderator", new Dictionary<string, object>
                {
                    { "projectName", projectTitle },
                    { "reason", reason }
                });

                foreach (var responderId in affectedResponders)
                {
                    await _SupMan.SendNotificationAsync(responderId, "response", projectId, "responses_revoked_project_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "projectName", projectTitle }
                    });
                }

                foreach (var inviteeId in affectedInvitees)
                {
                    await _SupMan.SendNotificationAsync(inviteeId, "invite", projectId, "invites_revoked_project_deleted_by_moderator", new Dictionary<string, object>
                    {
                        { "projectName", projectTitle },
                        { "nickname", ownerNickname }
                    });
                }

                await _SupMan.SendNotificationAsync(currentUserId, "project", projectId, "moderator_deleted_project", new Dictionary<string, object>
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
    }
}