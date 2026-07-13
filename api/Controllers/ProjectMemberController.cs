using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProjectMembersController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        [HttpGet("project/{projectId}")]
        public async Task<IActionResult> GetProjectMembers(string projectId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(userId))
                {
                    await _SupMan.UpdateLastOnlineAsync(userId);
                }

                var response = await _client.From<ProjectMember>()
                    .Where(pm => pm.ProjectId == projectId)
                    .Get();

                var members = response.Models.Select(m => new
                {
                    m.MemberId,
                    m.ProjectId,
                    m.UserId,
                    m.Role, 
                    JoinedAt = m.JoinedAt?.ToString("o") 
                }).ToList();

                return Ok(members);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpPost]
        public async Task<IActionResult> AddProjectMember([FromBody] AddProjectMemberDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var error = Validator.ValidateRole(dto.Role);
                if (error != null)
                    return BadRequest(new { message = error });


                await _SupMan.UpdateLastOnlineAsync(userId);

                var existing = await _client.From<ProjectMember>()
                    .Where(pm => pm.ProjectId == dto.ProjectId && pm.UserId == dto.UserId)
                    .Get();

                if (existing.Models.Count != 0)
                    return BadRequest("Пользователь уже является участником проекта");

                var newMember = new ProjectMember
                {
                    MemberId = Guid.NewGuid().ToString(),
                    ProjectId = dto.ProjectId,
                    UserId = dto.UserId,
                    Role = dto.Role,
                    JoinedAt = DateTime.UtcNow
                };

                var response = await _client.From<ProjectMember>().Insert(newMember);
                var created = response.Models.FirstOrDefault();

                if (created == null)
                    return BadRequest("Не удалось добавить участника");

                return Ok(new
                {
                    created.MemberId, 
                    created.ProjectId,
                    created.UserId, 
                    created.Role, 
                    JoinedAt = created.JoinedAt?.ToString("o") 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpDelete("{memberId}")]
        public async Task<IActionResult> RemoveProjectMember(string memberId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                await _client.From<ProjectMember>()
                    .Where(pm => pm.MemberId == memberId)
                    .Delete();

                return Ok(new { message = "Участник удалён" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpPost("find-by-email")]
        public async Task<IActionResult> FindUserByEmail([FromBody] FindByEmailDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);

                if (!string.IsNullOrEmpty(currentUserId))
                {
                    await _SupMan.UpdateLastOnlineAsync(currentUserId);
                }

                var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");
                var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_KEY");

                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {serviceKey}");
                http.DefaultRequestHeaders.Add("apikey", serviceKey);

                var response = await http.GetAsync($"{supabaseUrl}/auth/v1/admin/users");

                if (!response.IsSuccessStatusCode)
                {
                    return NotFound(new { message = "Пользователь не найден" });
                }

                var result = await response.Content.ReadFromJsonAsync<AuthUsersResponse>();

                if (result?.Users == null)
                {
                    return NotFound(new { message = "Пользователь не найден" });
                }

                var searchEmail = dto.Email.ToLower().Trim();
                var authUser = result.Users.FirstOrDefault(u =>
                    u.Email?.ToLower().Trim() == searchEmail
                );

                if (authUser == null)
                {
                    return NotFound(new { message = "Пользователь не найден" });
                }

                var userData = await _client.From<User>()
                    .Where(u => u.UserId == authUser.Id)
                    .Get();

                if (userData.Models.Count == 0)
                {
                    return NotFound(new { message = "Пользователь не найден" });
                }

                var user = userData.Models.First();

                return Ok(new
                {
                    user.UserId,
                    user.Nickname,
                    user.AvatarUrl,
                    user.RealName,
                    user.Age,
                    user.City,
                    user.Workplace,
                    user.ProfileRole,
                    user.HardSkills,
                    user.SoftSkills,
                    user.Description,
                    user.Contacts,
                    LastOnlineAt = user.LastOnlineAt?.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpPut("{memberId}/role")]
        public async Task<IActionResult> UpdateMemberRole(string memberId, [FromBody] UpdateRoleDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var error = Validator.ValidateRole(dto.Role);
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var member = await _client.From<ProjectMember>()
                    .Where(m => m.MemberId == memberId)
                    .Get();

                if (member.Models.Count == 0)
                    return NotFound(new { message = "Участник не найден" });

                var memberData = member.Models.First();

                await _client.From<ProjectMember>()
                    .Where(m => m.MemberId == memberId)
                    .Set(m => m.Role, dto.Role)
                    .Update();

                return Ok(new
                {
                    memberData.MemberId,
                    memberData.ProjectId,
                    memberData.UserId,
                    dto.Role,
                    JoinedAt = memberData.JoinedAt?.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        public class UpdateRoleDto
        {
            public string Role { get; set; } = string.Empty;
        }
    }

    public class FindByEmailDto
    {
        public string Email { get; set; } = string.Empty;
    }

    public class AuthUsersResponse
    {
        public List<AuthUserResponse> Users { get; set; } = [];
    }

    public class AuthUserResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Aud { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public class AddProjectMemberDto
    {
        public string ProjectId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string Role { get; set; } = "Участник";
    }
}