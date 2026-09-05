using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
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
                var userId = _SupMan.GetUserId(authHeader);
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
                    var owner = string.IsNullOrEmpty(ownerId)
                        ? await _client.From<User>().Get()
                        : await _client.From<User>()
                            .Where(u => u.UserId == ownerId)
                            .Get();
                    var ownerData = owner.Models.FirstOrDefault();

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
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Получить исходящие приглашения
        [HttpGet("outgoing")]
        public async Task<IActionResult> GetOutgoingInvites()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var projects = await _client.From<Project>()
                    .Where(p => p.OwnerId == userId)
                    .Get();

                var projectIds = projects.Models.Select(p => p.ProjectId).ToList();

                if (projectIds.Count == 0)
                    return Ok(new List<object>());

                var allInvites = await _client.From<Invite>().Get();
                var invites = allInvites.Models
                    .Where(i => projectIds.Contains(i.ProjectId))
                    .ToList();

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
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Создать приглашение
        [HttpPost]
        public async Task<IActionResult> CreateInvite([FromBody] CreateInviteDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == dto.ProjectId && p.OwnerId == userId)
                    .Get();

                if (project.Models.Count == 0)
                    return Unauthorized("Вы не владелец этого проекта");

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
                    Status = dto.Status,
                    CreatedAt = DateTime.UtcNow
                };

                var response = await _client.From<Invite>().Insert(newInvite);
                var created = response.Models.FirstOrDefault();

                if (created == null)
                    return BadRequest("Не удалось создать приглашение");

                return Ok(new
                {
                    created.InviteId,
                    created.UserId,
                    created.ProjectId,
                    created.Role,
                    created.Status,
                    CreatedAt = created.CreatedAt.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Обновить статус приглашения (принять/отклонить)
        [HttpPut("{inviteId}/status")]
        public async Task<IActionResult> UpdateInviteStatus(string inviteId, [FromBody] object data)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var invite = await _client.From<Invite>()
                    .Where(i => i.InviteId == inviteId)
                    .Get();

                if (invite.Models.Count == 0)
                    return NotFound("Приглашение не найдено");

                var inviteData = invite.Models.First();

                if (inviteData.UserId != userId)
                    return Unauthorized("Вы не получатель этого приглашения");

                var status = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(
                    System.Text.Json.JsonSerializer.Serialize(data));

                var newStatus = status?["status"] ?? "pending";

                inviteData.Status = newStatus;

                await _client.From<Invite>()
                    .Where(i => i.InviteId == inviteId)
                    .Set(i => i.Status, newStatus)
                    .Update();

                return Ok(new { message = "Статус обновлён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить приглашение (отправитель или получатель)
        [HttpDelete("{inviteId}")]
        public async Task<IActionResult> DeleteInvite(string inviteId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
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

                if (project.Models.FirstOrDefault()?.OwnerId != userId && inviteData.UserId != userId)
                    return Unauthorized("Вы не можете удалить это приглашение");

                await _client.From<Invite>()
                    .Where(i => i.InviteId == inviteId)
                    .Delete();

                return Ok(new { message = "Приглашение удалено" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}