using api.Models;
using Supabase;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;

namespace api.Support
{
    public class SupportManager(Client client)
    {
        private readonly Client _client = client;
        private const int ONLINE_THRESHOLD_MINUTES = 2;

        // get user id from token access
        private string? GetToken(string token)
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var jsonToken = handler.ReadToken(token) as JwtSecurityToken;
                return jsonToken?.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
            }
            catch
            {
                return null;
            }
        }

        public string? GetUserId(string? authHeader)
        {
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return null;

            var token = authHeader["Bearer ".Length..].Trim();
            if (string.IsNullOrEmpty(token)) return null;

            return GetToken(token);
        }

        // update last online by user id in database
        public async Task UpdateLastOnlineAsync(string userId)
        {
            try
            {
                await _client.From<User>()
                    .Where(u => u.UserId == userId)
                    .Set(u => u.LastOnlineAt!, DateTime.UtcNow)
                    .Update();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Failed to update last_online_at for {userId}: {ex.Message}");
            }
        }

        // formatted last online for user-client
        public static string FormatLastSeen(DateTimeOffset? lastOnlineAt)
        {
            if (!lastOnlineAt.HasValue) return "давно";

            var diff = DateTime.UtcNow - lastOnlineAt.Value;

            if (diff.TotalMinutes < 1) return "только что";
            if (diff.TotalMinutes < 60)
            {
                var mins = (int)diff.TotalMinutes;
                var ending = mins >= 5 && mins < 21 ? "" :
                             mins % 10 == 1 ? "у" :
                             mins % 10 >= 2 && mins % 10 <= 4 ? "ы" : "";
                return $"{mins} минут{ending} назад";
            }
            if (diff.TotalHours < 24)
            {
                var hours = (int)diff.TotalHours;
                var ending = hours >= 5 && hours < 21 ? "ов" :
                             hours % 10 == 1 ? "" :
                             hours % 10 >= 2 && hours % 10 <= 4 ? "а" : "ов";
                return $"{hours} час{ending} назад";
            }
            if (diff.TotalDays < 30)
            {
                var days = (int)diff.TotalDays;
                var ending = days % 10 == 1 && days % 100 != 11 ? "" :
                             days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20) ? "я" : "ей";
                return $"{days} дн{ending} назад";
            }
            if (diff.TotalDays < 365)
            {
                var months = (int)(diff.TotalDays / 30);
                var ending = months >= 5 && months < 21 ? "ев" :
                             months % 10 == 1 ? "ец" :
                             months % 10 >= 2 && months % 10 <= 4 ? "ца" : "ев";
                return $"{months} мес{ending} назад";
            }

            var years = (int)(diff.TotalDays / 365);
            var endingYear = years >= 5 && years < 21 ? "лет" :
                             years % 10 == 1 ? "" :
                             years % 10 >= 2 && years % 10 <= 4 ? "а" : "лет";
            return $"{years} год{endingYear} назад";
        }

        // check on online user
        public static bool IsOnline(DateTimeOffset? lastOnlineAt)
        {
            if (!lastOnlineAt.HasValue) return false;
            var diff = DateTimeOffset.UtcNow - lastOnlineAt.Value;
            return diff.TotalMinutes < ONLINE_THRESHOLD_MINUTES && diff.TotalMinutes >= 0;
        }

        // parse skill line in tags
        public static List<string> ParseSkills(string? skills)
        {
            if (string.IsNullOrEmpty(skills)) return [];
            try
            {
                var skillsList = JsonSerializer.Deserialize<List<string>>(skills);
                return skillsList ?? [];
            }
            catch
            {
                return [.. skills.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(s => s.StartsWith('#'))];
            }
        }
    }
}