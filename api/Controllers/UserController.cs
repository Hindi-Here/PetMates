using api.Models;
using api.Support; 
using Microsoft.AspNetCore.Mvc;
using Supabase;
using Supabase.Postgrest;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        [HttpGet]
        public async Task<IActionResult> GetAllUsers([FromQuery] string? search, [FromQuery] string searchField = "name", [FromQuery] string sortField = "date",[FromQuery] bool sortAsc = false)
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

                var query = search?.Trim().ToLower();
                if (!string.IsNullOrEmpty(query))
                {
                    users = users.Where(u =>
                    {
                        switch (searchField)
                        {
                            case "name":
                                return u.Nickname?.ToLower().Contains(query) == true ||
                                       u.RealName?.ToLower().Contains(query) == true;
                            case "tag":
                                return SupportManager.ParseSkills(u.HardSkills).Any(t => t.ToLower().Contains(query));
                            case "role":
                                return u.ProfileRole?.ToLower().Contains(query) == true;
                            default:
                                return true;
                        }
                    }).ToList();
                }

                Dictionary<string, int> projectCounts = [];
                Dictionary<string, int> ratingCounts = [];

                if (sortField == "project_count")
                {
                    foreach (var u in users)
                    {
                        var owned = await _client.From<Project>().Where(p => p.OwnerId == u.UserId).Get();
                        projectCounts[u.UserId] = owned.Models.Count;
                    }
                }
                else if (sortField == "_count")
                {
                    foreach (var u in users)
                    {
                        var ratings = await _client.From<ProjectRating>().Where(r => r.UserId == u.UserId).Get();
                        ratingCounts[u.UserId] = ratings.Models.Count;
                    }
                }

                IEnumerable<User> sorted = sortField switch
                {
                    "date" => sortAsc ? users.OrderBy(u => u.CreatedAt) : users.OrderByDescending(u => u.CreatedAt),
                    "alphabet" => sortAsc ? users.OrderBy(u => u.Nickname) : users.OrderByDescending(u => u.Nickname),
                    "activity" => sortAsc ? users.OrderBy(u => u.LastOnlineAt) : users.OrderByDescending(u => u.LastOnlineAt),
                    "project_count" => sortAsc
                        ? users.OrderBy(u => projectCounts.GetValueOrDefault(u.UserId, 0))
                        : users.OrderByDescending(u => projectCounts.GetValueOrDefault(u.UserId, 0)),
                    "_count" => sortAsc
                        ? users.OrderBy(u => ratingCounts.GetValueOrDefault(u.UserId, 0))
                        : users.OrderByDescending(u => ratingCounts.GetValueOrDefault(u.UserId, 0)),
                    _ => users
                };

                var result = sorted.Select(u => new
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

        [HttpGet("search")]
        public async Task<IActionResult> SearchUsers([FromQuery] string query)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
                    return Ok(new List<object>());

                var users = await _client.From<User>()
                    .Filter("nickname", Constants.Operator.ILike, $"%{query.Trim()}%")
                    .Limit(20)
                    .Get();

                var result = users.Models
                    .Where(u => u.UserId != currentUserId)
                    .Select(u => new
                    {
                        u.UserId,
                        u.Nickname,
                        u.AvatarUrl
                    });

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}