using api.Models;
using api.Support; 
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        [HttpGet]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var id = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(id))
                {
                    await _SupMan.UpdateLastOnlineAsync(id);
                }

                var response = await _client.From<User>().Get();
                var users = response.Models;

                var result = users.Select(u => new
                {
                    userId = u.UserId,
                    nickname = u.Nickname,
                    avatarUrl = u.AvatarUrl,
                    realName = u.RealName,
                    age = u.Age,
                    city = u.City,
                    workplace = u.Workplace,
                    profileRole = u.ProfileRole,
                    hardSkills = SupportManager.ParseSkills(u.HardSkills),
                    lastOnlineAt = u.LastOnlineAt?.ToString("o"),
                    isOnline = SupportManager.IsOnline(u.LastOnlineAt),
                    lastSeen = SupportManager.FormatLastSeen(u.LastOnlineAt),
                }).ToList();

                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("{userId}")]
        public async Task<IActionResult> GetUserProfile(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var id = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(id))
                {
                    await _SupMan.UpdateLastOnlineAsync(id);
                }

                var response = await _client.From<User>()
                    .Where(u => u.UserId == userId)
                    .Get();

                var user = response.Models.FirstOrDefault();
                if (user == null) return NotFound();

                return Ok(new
                {
                    user.UserId,
                    user.Nickname,
                    user.AvatarUrl,
                    user.RealName,
                    user.Age,
                    user.Gender,
                    user.Country,
                    user.City,
                    user.Workplace,
                    user.ProfileRole,
                    user.Description,
                    hardSkills = SupportManager.ParseSkills(user.HardSkills),
                    softSkills = SupportManager.ParseSkills(user.SoftSkills),
                    lastOnlineAt = user.LastOnlineAt?.ToString("o"),
                    user.Contacts,
                    createdAt = user.CreatedAt?.ToString("o"),
                    isOnline = SupportManager.IsOnline(user.LastOnlineAt),
                    lastSeen = SupportManager.FormatLastSeen(user.LastOnlineAt)
                });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
    }
}