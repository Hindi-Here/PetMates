using api.Models;
using api.Support; 
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Supabase.Postgrest;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController(Supabase.Client client, SupportManager SupMan, AppCache cache) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        private readonly AppCache _cache = cache;

        // Получить пользователей с возможностью поиска и сортировки
        [HttpGet]
        public async Task<IActionResult> GetAllUsers([FromQuery] string? search, [FromQuery] string searchField = "name", [FromQuery] string sortField = "date", [FromQuery] bool sortAsc = false, [FromQuery] bool showBannedOnly = false, [FromQuery] bool showStaffOnly = false)
        {
            try
            {
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var isStaff = viewer.IsStaff;

                var users = await _SupMan.GetAllUsersAsync();
                var counts = await _SupMan.GetUserCountsAsync();
                var projectCounts = counts.ProjectCounts;
                var ratingCounts = counts.RatingCounts;

                if (!isStaff)
                {
                    users = [.. users.Where(u => !u.IsBanned)];
                }
                else if (showBannedOnly)
                {
                    users = [.. users.Where(u => u.IsBanned)];
                }

                if (showStaffOnly)
                {
                    users = [.. users.Where(u => Roles.IsStaff(u.SystemRole))];
                }

                var query = search?.Trim().ToLower();
                if (!string.IsNullOrEmpty(query))
                {
                    users = [.. users.Where(u => searchField switch
                    {
                        "name" => u.Nickname?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true || u.RealName?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                        "tag" => SupportManager.ParseSkills(u.HardSkills).Any(t => t.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase)),
                        "role" => u.ProfileRole?.ToLower().Contains(query, StringComparison.CurrentCultureIgnoreCase) == true,
                        _ => true,
                    })];
                        }

                IEnumerable<User> sorted = sortField switch
                {
                    "date" => sortAsc ? users.OrderBy(u => u.CreatedAt) : users.OrderByDescending(u => u.CreatedAt),
                    "alphabet" => sortAsc ? users.OrderBy(u => u.Nickname) : users.OrderByDescending(u => u.Nickname),
                    "activity" => sortAsc ? users.OrderBy(u => u.LastOnlineAt) : users.OrderByDescending(u => u.LastOnlineAt),
                    "project_count" => sortAsc ? users.OrderBy(u => projectCounts.GetValueOrDefault(u.UserId ?? "", 0)) : users.OrderByDescending(u => projectCounts.GetValueOrDefault(u.UserId ?? "", 0)),
                    "_count" => sortAsc ? users.OrderBy(u => ratingCounts.GetValueOrDefault(u.UserId ?? "", 0)) : users.OrderByDescending(u => ratingCounts.GetValueOrDefault(u.UserId ?? "", 0)),
                    _ => users
                };

                var result = sorted.Take(Limits.Search.ListMax).Select(u => new
                {
                    userId = u.UserId,
                    nickname = u.Nickname,
                    avatarUrl = u.AvatarUrl,
                    realName = u.RealName,
                    age = u.Age,
                    city = u.City,
                    workplace = u.Workplace,
                    profileRole = u.ProfileRole,
                    systemRole = u.SystemRole,
                    isBanned = u.IsBanned,
                    hardSkills = SupportManager.ParseSkills(u.HardSkills),
                    lastOnlineAt = u.LastOnlineAt?.ToString("o"),
                    isOnline = SupportManager.IsOnline(u.LastOnlineAt),
                    lastSeen = SupportManager.FormatLastSeen(u.LastOnlineAt),
                    activityCount = counts.ActivityCounts.GetValueOrDefault(u.UserId ?? "", 0)
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Получить профиль пользователя по его идентификатору
        [HttpGet("{userId}")]
        [AllowBanned]
        public async Task<IActionResult> GetUserProfile(string userId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var viewer = await _SupMan.GetViewerAsync(authHeader);
                var selfId = await _SupMan.GetUserIdAsync(authHeader);

                if (!string.IsNullOrEmpty(selfId)) await _SupMan.UpdateLastOnlineAsync(selfId);

                var user = await _SupMan.GetUserCachedAsync(userId);
                if (user == null) return NotFound();

                var canSeeAll = viewer.IsStaff || selfId == userId;

                if (user.IsBanned && !canSeeAll)
                {
                    return Ok(new { user.UserId, isBanned = true });
                }

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
                    systemRole = user.SystemRole,
                    isBanned = user.IsBanned,
                    bannedReason = canSeeAll ? user.BannedReason : null,
                    hardSkills = SupportManager.ParseSkills(user.HardSkills),
                    softSkills = SupportManager.ParseSkills(user.SoftSkills),
                    lastOnlineAt = user.LastOnlineAt?.ToString("o"),
                    user.Contacts,
                    createdAt = user.CreatedAt?.ToString("o"),
                    isOnline = SupportManager.IsOnline(user.LastOnlineAt),
                    lastSeen = SupportManager.FormatLastSeen(user.LastOnlineAt)
                });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Поиск пользователей по никнейму
        [HttpGet("search")]
        [EnableRateLimiting("lookup")]
        public async Task<IActionResult> SearchUsers([FromQuery] string query)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var currentUserId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < Limits.Search.UserQueryMin)
                    return Ok(new List<object>());

                var safeQuery = query.Trim().Replace("%", "").Replace("_", "");

                var users = await _client.From<User>()
                    .Filter("nickname", Constants.Operator.ILike, $"%{safeQuery}%")
                    .Limit(Limits.Search.UserResultsMax)
                    .Get();

                var result = users.Models
                    .Where(u => u.UserId != currentUserId && !u.IsBanned)
                    .Select(u => new
                    {
                        u.UserId,
                        u.Nickname,
                        u.AvatarUrl
                    });

                return Ok(result);
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}