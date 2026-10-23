using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;
using System.Collections.Concurrent;
using System.ComponentModel;

namespace api.Support
{
    public class UserCounts(Dictionary<string, int> projects, Dictionary<string, int> ratings)
    {
        public Dictionary<string, int> ProjectCounts { get; set; } = projects;
        public Dictionary<string, int> RatingCounts { get; set; } = ratings;
    }

    public class VacancyListItem(Models.Vacancy v, Models.Project p, int count, string? nick, bool banned)
    {
        public Models.Vacancy Vacancy { get; set; } = v; public Models.Project Project { get; set; } = p; public int MembersCount { get; set; } = count; public string? OwnerNickname { get; set; } = nick; public bool OwnerIsBanned { get; set; } = banned;
    }

    public class EventListItem(Models.Event e, Models.User o, int count)
    {
        public Models.Event Event { get; set; } = e; public Models.User Owner { get; set; } = o; public int MembersCount { get; set; } = count;
    }
    public class TeamMemberCardRow
    {
        public string? Nickname { get; set; }
        public string? AvatarUrl { get; set; }
        public string? RealName { get; set; }
        public int? Age { get; set; }
        public string? City { get; set; }
        public string? Workplace { get; set; }
        public string? ProfileRole { get; set; }
        public string? SystemRole { get; set; }
        public bool IsBanned { get; set; }
        public string? HardSkills { get; set; }
        public string? SoftSkills { get; set; }
        public DateTimeOffset? LastOnlineAt { get; set; }
    }

    // Режимы
    public static class CacheStale
    {
        public static readonly TimeSpan Short = TimeSpan.FromSeconds(30);
        public static readonly TimeSpan Medium = TimeSpan.FromMinutes(2);
        public static readonly TimeSpan Long = TimeSpan.FromMinutes(5);
    }

    // Ключи
    public static class CacheKeys
    {
        public static string Token(string hash) => $"auth:token:{hash}";
        public static string Access(string userId) => $"user:{userId}:access";
        public static string OnlineTouch(string userId) => $"user:{userId}:online";
        public static string ProjectMembers(string projectId) => $"project:{projectId}:members";
        public static string Comments(string type, string id) => $"comments:{type}:{id}";

        public const string UsersAll = "users:all";
        public const string UserCounts = "users:counts";
        public const string VacanciesAll = "vacancies:all";
        public const string EventsAll = "events:all";

        public static class Tags
        {
            public const string Users = "users";
            public const string Projects = "projects";
            public const string Vacancies = "vacancies";
            public const string Events = "events";

            public static string User(string id) => $"user:{id}";
            public static string Project(string id) => $"project:{id}";
            public static string Comments(string type, string id) => $"comments:{type}:{id}";
        }
    }

    // Кеш и инвалидация (используется два типа: HybridCache и IMemory из-за проблем сериализации через разные библиотеки у Supabase и HybridCache)
    [ImmutableObject(true)]
    public sealed record Snapshot<T>(T Value);

    [ImmutableObject(true)]
    public sealed record UserAccess(string? Role, bool IsBanned, bool Exists);

    public sealed class AppCache(HybridCache cache, IMemoryCache memory)
    {
        public ValueTask<T> GetOrCreateAsync<T>(
            string key, Func<CancellationToken, ValueTask<T>> factory,
            TimeSpan ttl, IEnumerable<string>? tags = null)
            => cache.GetOrCreateAsync(key, factory,
                new HybridCacheEntryOptions { Expiration = ttl, LocalCacheExpiration = ttl }, tags);

        private readonly ConcurrentDictionary<string, CancellationTokenSource> _tagTokens = new();
        private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

        private IChangeToken TokenFor(string tag) =>
            new CancellationChangeToken(_tagTokens.GetOrAdd(tag, _ => new CancellationTokenSource()).Token);

        public async ValueTask<Snapshot<T>> SnapshotAsync<T>(
            string key, Func<Task<T>> load, TimeSpan ttl, params string[] tags)
        {
            var cacheKey = "snap:" + key;
            if (memory.TryGetValue(cacheKey, out Snapshot<T>? hit) && hit is not null) return hit;

            var gate = _locks.GetOrAdd(cacheKey, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            try
            {
                if (memory.TryGetValue(cacheKey, out hit) && hit is not null) return hit;

                var tokens = tags.Append("*").Select(TokenFor).ToList();

                var value = new Snapshot<T>(await load());

                var options = new MemoryCacheEntryOptions().SetAbsoluteExpiration(ttl);
                foreach (var t in tokens) options.AddExpirationToken(t);
                memory.Set(cacheKey, value, options);
                return value;
            }
            finally { gate.Release(); }
        }

        public ValueTask RemoveAsync(string key) => cache.RemoveAsync(key);

        public ValueTask InvalidateAsync(params string[] tags)
        {
            foreach (var tag in tags)
                if (_tagTokens.TryRemove(tag, out var cts)) { cts.Cancel(); cts.Dispose(); }
            return cache.RemoveByTagAsync(tags);
        }

        public ValueTask UserChangedAsync(string userId) =>
            InvalidateAsync(CacheKeys.Tags.User(userId), CacheKeys.Tags.Users);
        public ValueTask ProjectChangedAsync(string projectId) =>
            InvalidateAsync(CacheKeys.Tags.Projects, CacheKeys.Tags.Project(projectId));
        public ValueTask VacanciesChangedAsync() => InvalidateAsync(CacheKeys.Tags.Vacancies);
        public ValueTask EventsChangedAsync() => InvalidateAsync(CacheKeys.Tags.Events);
        public ValueTask CommentsChangedAsync(string type, string id) =>
            InvalidateAsync(CacheKeys.Tags.Comments(type, id));
        public ValueTask EverythingChangedAsync() => InvalidateAsync("*");
    }
}
