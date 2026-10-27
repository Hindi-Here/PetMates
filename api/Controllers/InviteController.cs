using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InviteController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Получить входящие приглашения
        [HttpGet("incoming")]
        public async Task<IActionResult> GetIncomingInvites()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var invites = await _client.From<Invite>()
                    .Where(i => i.UserId == userId)
                    .Get();

                var result = new List<object>();

                foreach (var invite in invites.Models)
                {
                    var project = await _client.From<Project>()
                        .Where(p => p.ProjectId == invite.ProjectId)
                        .Get();
                    var projectData = project.Models.FirstOrDefault();

                    var ownerId = projectData?.OwnerId;
                    var ownerData = string.IsNullOrEmpty(ownerId)
                        ? null
                        : await _SupMan.GetUserCachedAsync(ownerId);

                    result.Add(new
                    {
                        invite.InviteId,
                        invite.UserId,
                        invite.ProjectId,
                        ProjectTitle = projectData?.Title ?? "Unknown",
                        invite.Role,
                        invite.Status,
                        InviterId = ownerId, 
                        InviterName = ownerData?.Nickname ?? "Unknown",
                        CreatedAt = invite.CreatedAt.ToString("o")
                    });
                }

                return Ok(result);
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Получить исходящие приглашения
        [HttpGet("outgoing")]
        public async Task<IActionResult> GetOutgoingInvites()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var projects = await _client.From<Project>()
                    .Where(p => p.OwnerId == userId)
                    .Get();

                var projectIds = projects.Models.Select(p => p.ProjectId).ToList();

                if (projectIds.Count == 0)
                    return Ok(new List<object>());

                var invites = (await _client.From<Invite>()
                    .Filter("project_id", Supabase.Postgrest.Constants.Operator.In, projectIds)
                    .Get()).Models;

                var result = new List<object>();

                foreach (var invite in invites)
                {
                    var user = await _client.From<User>()
                        .Where(u => u.UserId == invite.UserId)
                        .Get();
                    var userData = user.Models.FirstOrDefault();

                    var project = projects.Models.FirstOrDefault(p => p.ProjectId == invite.ProjectId);

                    result.Add(new
                    {
                        invite.InviteId,
                        invite.UserId,
                        UserName = userData?.Nickname ?? "Unknown",
                        invite.ProjectId,
                        ProjectTitle = project?.Title ?? "Unknown",
                        invite.Role,
                        invite.Status,
                        CreatedAt = invite.CreatedAt.ToString("o")
                    });
                }

                return Ok(result);
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Создать приглашение
        [HttpPost]
        [EnableRateLimiting("write")]
        public async Task<IActionResult> CreateInvite([FromBody] CreateInviteDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var actor = await _SupMan.GetActorAsync(authHeader);
                if (actor == null)
                    return Unauthorized();

                var project = (await _client.From<Project>().Where(p => p.ProjectId == dto.ProjectId && p.OwnerId == actor.UserId).Get()).Models.FirstOrDefault();
                if (project == null)
                    return Forbid();

                var roleError = Validator.ValidateRole(dto.Role);
                if (roleError != null)
                    return BadRequest(new { message = roleError });

                var vacancyExists = await _client.From<Vacancy>()
                    .Where(v => v.ProjectId == dto.ProjectId && v.Title == dto.Role).Get();
                if (vacancyExists.Models.Count == 0)
                    return BadRequest(new { message = "В проекте нет заявки с такой ролью" });

                if (await _SupMan.IsBlockedBetweenAsync(actor.UserId, dto.UserId))
                    return BadRequest(new { message = "Невозможно отправить приглашение этому пользователю" });

                if (dto.UserId == actor.UserId)
                    return BadRequest(new { message = "Нельзя пригласить самого себя" });

                var target = await _SupMan.GetUserCachedAsync(dto.UserId);
                if (target == null)
                    return NotFound(new { message = "Пользователь не найден" });
                if (target.IsBanned)
                    return BadRequest(new { message = "Нельзя пригласить заблокированного пользователя" });

                var isMember = await _client.From<ProjectMember>().Where(pm => pm.ProjectId == dto.ProjectId && pm.UserId == dto.UserId).Get();
                if (isMember.Models.Count > 0)
                    return BadRequest(new { message = "Пользователь уже в команде" });

                var existingInvite = await _client.From<Invite>()
                    .Where(i => i.ProjectId == dto.ProjectId)
                    .Where(i => i.UserId == dto.UserId)
                    .Where(i => i.Status == "pending")
                    .Get();

                if (existingInvite.Models.Count != 0)
                    return BadRequest(new { message = "Приглашение уже отправлено" });

                var newInvite = new Invite
                {
                    InviteId = Guid.NewGuid().ToString(),
                    UserId = dto.UserId,
                    ProjectId = dto.ProjectId,
                    Role = dto.Role,
                    Status = "pending",
                    CreatedAt = DateTime.UtcNow
                };

                var response = await _client.From<Invite>().Insert(newInvite);
                var created = response.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest(new { message = "Не удалось создать приглашение" });

                var me = await _SupMan.GetUserCachedAsync(actor.UserId);
                var ctx = new Dictionary<string, object> { ["projectName"] = project.Title, ["vacancyName"] = dto.Role };
                await _SupMan.SendNotificationAsync(actor.UserId, "invite", project.ProjectId, "invite_sent", new(ctx));
                await _SupMan.SendNotificationAsync(dto.UserId, "invite", project.ProjectId, "invite_received",
                    new(ctx) { ["nickname"] = me?.Nickname ?? "Пользователь" });

                return Ok(new { created.InviteId, created.UserId, created.ProjectId, created.Role, created.Status, CreatedAt = created.CreatedAt.ToString("o") });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Принять
        [HttpPost("{inviteId}/accept")]
        [EnableRateLimiting("write")]
        public Task<IActionResult> Accept(string inviteId) => Decide(inviteId, true);

        // Отклонить
        [HttpPost("{inviteId}/decline")]
        [EnableRateLimiting("write")]
        public Task<IActionResult> Decline(string inviteId) => Decide(inviteId, false);

        private async Task<IActionResult> Decide(string inviteId, bool accept)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null)
                    return Unauthorized();

                var invite = (await _client.From<Invite>().Where(i => i.InviteId == inviteId).Get()).Models.FirstOrDefault();
                if (invite == null)
                    return NotFound();
                if (invite.UserId != actor.UserId)
                    return Forbid();

                var project = (await _client.From<Project>().Where(p => p.ProjectId == invite.ProjectId).Get()).Models.FirstOrDefault();

                await _client.From<Invite>().Where(i => i.InviteId == inviteId).Delete();

                if (project != null)
                {
                    var me = await _SupMan.GetUserCachedAsync(actor.UserId);
                    await _SupMan.SendNotificationAsync(project.OwnerId, "invite", project.ProjectId,
                        accept ? "invite_accepted" : "invite_rejected",
                        new() { ["projectName"] = project.Title, ["vacancyName"] = invite.Role, ["nickname"] = me?.Nickname ?? "Пользователь" });
                }
                return Ok(new { message = accept ? "Приглашение принято" : "Приглашение отклонено" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить приглашение (отправитель или получатель)
        [HttpDelete("{inviteId}")]
        public async Task<IActionResult> DeleteInvite(string inviteId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var invite = await _client.From<Invite>()
                    .Where(i => i.InviteId == inviteId)
                    .Get();

                if (invite.Models.Count == 0)
                    return NotFound("Приглашение не найдено");

                var inviteData = invite.Models.First();

                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == inviteData.ProjectId)
                    .Get();

                var proj = project.Models.FirstOrDefault();
                if (proj == null || proj.OwnerId != userId)
                    return Forbid();

                await _client.From<Invite>()
                    .Where(i => i.InviteId == inviteId)
                    .Delete();

                var me = await _SupMan.GetUserCachedAsync(userId);
                await _SupMan.SendNotificationAsync(inviteData.UserId, "invite", proj.ProjectId, "invite_cancelled",
                    new() { ["projectName"] = proj.Title, ["vacancyName"] = inviteData.Role, ["nickname"] = me?.Nickname ?? "Пользователь" });

                return Ok(new { message = "Приглашение удалено" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}