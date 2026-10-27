using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Supabase;
using System.Text.Json;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectMemberController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Получить участников проекта (команды)
        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetProjectMembers(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (!string.IsNullOrEmpty(userId)) await _SupMan.UpdateLastOnlineAsync(userId);

                var proj = (await _client.From<Project>().Where(p => p.ProjectId == projectId).Get()).Models.FirstOrDefault();
                if (proj == null || !await _SupMan.CanViewProject(proj, userId, await _SupMan.IsStaffAsync(userId)))
                    return NotFound();

                return Ok(await _SupMan.GetProjectMemberCardsAsync(projectId));
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Добавить участника в команду
        [HttpPost]
        public async Task<IActionResult> AddProjectMember([FromBody] AddProjectMemberDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null) return Unauthorized();

                if (!await _SupMan.IsProjectOwnerAsync(dto.ProjectId, actor.UserId)) return Forbid();

                var error = Validator.ValidateRole(dto.Role);
                if (error != null)
                    return BadRequest(new { message = error });

                var target = await _SupMan.GetUserCachedAsync(dto.UserId);
                if (target == null)
                    return NotFound(new { message = "Пользователь не найден" });
                if (target.IsBanned)
                    return BadRequest(new { message = "Нельзя добавить заблокированного пользователя" });
                if (await _SupMan.IsBlockedBetweenAsync(actor.UserId, dto.UserId))
                    return BadRequest(new { message = "Невозможно добавить этого пользователя" });

                var existing = await _client.From<ProjectMember>()
                    .Where(pm => pm.ProjectId == dto.ProjectId && pm.UserId == dto.UserId).Get();

                if (existing.Models.Count != 0)
                    return BadRequest(new { message = "Пользователь уже является участником проекта" });

                var newMember = new ProjectMember
                {
                    MemberId = Guid.NewGuid().ToString(),
                    ProjectId = dto.ProjectId,
                    UserId = dto.UserId,
                    Role = dto.Role,
                    JoinedAt = DateTime.UtcNow
                };

                var response = await _client.From<ProjectMember>().Insert(newMember);
                await _SupMan.Cache.ProjectChangedAsync(dto.ProjectId);

                var created = response.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest(new { message = "Не удалось добавить участника" });

                var projTitle = (await _client.From<Project>().Where(p => p.ProjectId == dto.ProjectId).Get()).Models.FirstOrDefault()?.Title ?? "Проект";
                await _SupMan.SendNotificationAsync(actor.UserId, "project", dto.ProjectId, "added",
                    new() { ["nickname"] = target.Nickname ?? "Пользователь", ["projectName"] = projTitle, ["role"] = dto.Role });
                await _SupMan.SendNotificationAsync(dto.UserId, "project", dto.ProjectId, "added_self",
                    new() { ["projectName"] = projTitle, ["role"] = dto.Role });

                return Ok(new { created.MemberId, created.ProjectId, created.UserId, created.Role, JoinedAt = created.JoinedAt?.ToString("o") });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить участника проекта
        [HttpDelete("{memberId}")]
        public async Task<IActionResult> RemoveProjectMember(string memberId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                var memberResp = await _client.From<ProjectMember>().Where(pm => pm.MemberId == memberId).Get();
                var member = memberResp.Models.FirstOrDefault();
                if (member == null)
                    return NotFound();

                var proj = (await _client.From<Project>().Where(p => p.ProjectId == member.ProjectId).Get()).Models.FirstOrDefault();
                if (proj == null || proj.OwnerId != actor.UserId) return Forbid();

                if (member.UserId == proj.OwnerId)
                    return BadRequest(new { message = "Владельца нельзя исключить из проекта" });

                await _client.From<ProjectMember>().Where(pm => pm.MemberId == memberId).Delete();
                await _SupMan.Cache.ProjectChangedAsync(member.ProjectId);

                var removed = await _SupMan.GetUserCachedAsync(member.UserId);
                await _SupMan.SendNotificationAsync(proj.OwnerId, "project", proj.ProjectId, "removed",
                    new() { ["nickname"] = removed?.Nickname ?? "Пользователь", ["projectName"] = proj.Title });
                await _SupMan.SendNotificationAsync(member.UserId, "project", proj.ProjectId, "removed_self",
                    new() { ["projectName"] = proj.Title });

                return Ok(new { message = "Участник удалён" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Найти участника команды по его никнейму
        [EnableRateLimiting("lookup")]
        [HttpGet("find-by-nickname")]
        public async Task<IActionResult> FindByNickname([FromQuery] string nickname)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null)
                    return Unauthorized();

                var nick = nickname?.Trim() ?? "";
                if (nick.Length < Limits.Auth.NicknameMin || nick.Length > Limits.Auth.NicknameMax)
                    return NotFound(new { message = "Пользователь не найден" });

                var user = (await _SupMan.GetAllUsersAsync()).FirstOrDefault(u =>
                    !u.IsBanned && string.Equals(u.Nickname, nick, StringComparison.OrdinalIgnoreCase));
                if (user == null)
                    return NotFound(new { message = "Пользователь не найден" });

                return Ok(new { user.UserId, user.Nickname });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Выйти из проекта
        [EnableRateLimiting("write")]
        [HttpDelete("{memberId}/leave")]
        public async Task<IActionResult> LeaveProject(string memberId)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null)
                    return Unauthorized();

                var member = (await _client.From<ProjectMember>().Where(pm => pm.MemberId == memberId).Get()).Models.FirstOrDefault();
                if (member == null)
                    return NotFound();
                if (member.UserId != actor.UserId)
                    return Forbid();

                var proj = (await _client.From<Project>().Where(p => p.ProjectId == member.ProjectId).Get()).Models.FirstOrDefault();
                if (proj == null)
                    return NotFound();
                if (proj.OwnerId == actor.UserId)
                    return BadRequest(new { message = "Владелец не может покинуть проект. Удалите проект." });

                await _client.From<ProjectMember>().Where(pm => pm.MemberId == memberId).Delete();
                await _SupMan.Cache.ProjectChangedAsync(member.ProjectId);

                var me = await _SupMan.GetUserCachedAsync(actor.UserId);
                await _SupMan.SendNotificationAsync(proj.OwnerId, "project", proj.ProjectId, "removed",
                    new() { ["nickname"] = me?.Nickname ?? "Пользователь", ["projectName"] = proj.Title });

                return Ok(new { message = "Вы покинули проект" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Обновить роль участника проекта
        [HttpPut("{memberId}/role")]
        public async Task<IActionResult> UpdateMemberRole(string memberId, [FromBody] UpdateRoleDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                var error = Validator.ValidateRole(dto.Role);
                if (error != null)
                    return BadRequest(new { message = error });

                var member = await _client.From<ProjectMember>().Where(m => m.MemberId == memberId).Get();
                var memberData = member.Models.FirstOrDefault();
                if (memberData == null)
                    return NotFound(new { message = "Участник не найден" });

                if (!await _SupMan.IsProjectOwnerAsync(memberData.ProjectId, actor.UserId)) return Forbid();

                var memberUser = await _SupMan.GetUserCachedAsync(memberData.UserId);
                if (memberUser?.IsBanned == true)
                    return BadRequest(new { message = "Роль заблокированного участника менять нельзя" });

                await _client.From<ProjectMember>()
                    .Where(m => m.MemberId == memberId)
                    .Set(m => m.Role, dto.Role)
                    .Update();

                await _SupMan.Cache.ProjectChangedAsync(memberData.ProjectId);

                var proj = (await _client.From<Project>().Where(p => p.ProjectId == memberData.ProjectId).Get()).Models.FirstOrDefault();
                if (proj != null)
                {
                    await _SupMan.SendNotificationAsync(proj.OwnerId, "project", proj.ProjectId, "role_changed",
                        new() { ["nickname"] = memberUser?.Nickname ?? "Пользователь", ["projectName"] = proj.Title, ["role"] = dto.Role });
                    await _SupMan.SendNotificationAsync(memberData.UserId, "project", proj.ProjectId, "role_changed_self",
                        new() { ["projectName"] = proj.Title, ["role"] = dto.Role });
                }

                return Ok(new { memberData.MemberId, memberData.ProjectId, memberData.UserId, dto.Role, JoinedAt = memberData.JoinedAt?.ToString("o") });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось обновить роль" });
            }
        }
    }
}