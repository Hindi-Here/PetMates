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
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось загрузить участников" });
            }
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
                if (error != null) return BadRequest(new { message = error });

                var target = await _SupMan.GetUserCachedAsync(dto.UserId);
                if (target == null) return NotFound(new { message = "Пользователь не найден" });
                if (target.IsBanned) return BadRequest(new { message = "Нельзя добавить заблокированного пользователя" });

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
                if (created == null) return BadRequest(new { message = "Не удалось добавить участника" });

                return Ok(new { created.MemberId, created.ProjectId, created.UserId, created.Role, JoinedAt = created.JoinedAt?.ToString("o") });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось добавить участника" });
            }
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

                return Ok(new { message = "Участник удалён" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось удалить участника" });
            }
        }

        // Найти участника по почте
        [EnableRateLimiting("lookup")]
        [HttpPost("find-by-email")]
        public async Task<IActionResult> FindUserByEmail([FromBody] FindByEmailDto dto)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null) return Unauthorized();

                var ownsProject = (await _client.From<Project>().Where(p => p.OwnerId == actor.UserId).Limit(1).Get()).Models.Count > 0;
                if (!ownsProject)
                    return Forbid();

                var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");
                var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_KEY");

                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {serviceKey}");
                http.DefaultRequestHeaders.Add("apikey", serviceKey);

                var response = await http.GetAsync($"{supabaseUrl}/auth/v1/admin/users");
                if (!response.IsSuccessStatusCode)
                    return NotFound(new { message = "Пользователь не найден" });

                var result = await response.Content.ReadFromJsonAsync<AuthUsersResponse>();
                if (result?.Users == null)
                    return NotFound(new { message = "Пользователь не найден" });

                var searchEmail = dto.Email.ToLower().Trim();
                var authUser = result.Users.FirstOrDefault(u => u.Email?.ToLower().Trim() == searchEmail);
                if (authUser == null)
                    return NotFound(new { message = "Пользователь не найден" });

                var userData = await _client.From<User>().Where(u => u.UserId == authUser.Id).Get();
                if (userData.Models.Count == 0)
                    return NotFound(new { message = "Пользователь не найден" });

                var user = userData.Models.First();
                if (user.IsBanned)
                    return NotFound(new { message = "Пользователь не найден" });

                return Ok(new { user.UserId, user.Nickname });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Ошибка поиска пользователя" });
            }
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

                return Ok(new { memberData.MemberId, memberData.ProjectId, memberData.UserId, dto.Role, JoinedAt = memberData.JoinedAt?.ToString("o") });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось обновить роль" });
            }
        }
    }
}