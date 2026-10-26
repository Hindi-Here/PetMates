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
            var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
            if (actor == null || !actor.IsStaff) return Forbid();

            var project = (await _client.From<Project>().Where(p => p.ProjectId == projectId).Get()).Models.FirstOrDefault();
            if (project == null) return NotFound();

            if (!RoleRules.CanModerate(actor.Role, await _SupMan.GetRoleAsync(project.OwnerId)))
                return Forbid();

            var error = Validator.ValidateModerationReason(dto.Reason);
            if (error != null) return BadRequest(new { message = error });

            await _SupMan.DeleteProjectCoreAsync(projectId, reason: dto.Reason!.Trim(), isModeration: true);

            return Ok(new { message = "Проект удалён модератором" });
        }
    }
}