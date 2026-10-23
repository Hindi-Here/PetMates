using api.Models;
using Microsoft.Extensions.Caching.Hybrid;
using Supabase.Postgrest;
using System.ComponentModel;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace api.Support
{
    public static class Roles
    {
        public const string User = "user";
        public const string Moderator = "moderator";
        public const string Admin = "admin";

        public static bool IsStaff(string? role) => role is Moderator or Admin;
    }

    public record Viewer(string? UserId, string? Role)
    {
        public bool IsAuthenticated => !string.IsNullOrEmpty(UserId);
        public bool IsStaff => Roles.IsStaff(Role);
    }

    public static class Mappers
    {
        public static object ProfileResponse(User profile, string? email = null) => new
        {
            email,
            userId = profile.UserId,
            nickname = profile.Nickname,
            avatarUrl = profile.AvatarUrl,
            realName = profile.RealName,
            age = profile.Age,
            gender = profile.Gender,
            country = profile.Country,
            city = profile.City,
            workplace = profile.Workplace,
            profileRole = profile.ProfileRole,
            systemRole = profile.SystemRole,
            description = profile.Description,
            hardSkills = profile.HardSkills,
            softSkills = profile.SoftSkills,
            contacts = profile.Contacts,
            lastOnlineAt = profile.LastOnlineAt,
            createdAt = profile.CreatedAt,
        };

        public static Dictionary<string, object?> ToCard(Event ev, User owner, int membersCount) => new()
        {
            ["eventId"] = ev.EventId,
            ["ownerId"] = ev.OwnerId,
            ["title"] = ev.Title,
            ["shortDescription"] = ev.ShortDescription,
            ["status"] = SupportManager.ToRuStatus(ev.Status),
            ["statusChangedAt"] = ev.StatusChangedAt?.ToString("o"),
            ["eventStartDate"] = SupportManager.NormalizeDate(ev.EventStartDate),
            ["eventEndDate"] = SupportManager.NormalizeDate(ev.EventEndDate),
            ["isPrivate"] = ev.IsPrivate,
            ["registrationState"] = SupportManager.GetRegistrationState(ev),
            ["ratingCount"] = ev.RatingCount,
            ["membersCount"] = membersCount,
            ["createdAt"] = ev.CreatedAt?.ToString("o"),
            ["ownerSystemRole"] = owner.SystemRole ?? Roles.User,
            ["ownerIsBanned"] = owner.IsBanned
        };

        public static object ToUserCard(User u) => new
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
            lastSeen = SupportManager.FormatLastSeen(u.LastOnlineAt)
        };

        public static object ToApplicationMine(EventApplication a) => new
        {
            applicationId = a.ApplicationId,
            status = a.Status,
            answers = SupportManager.ParseAnswers(a.Answers),
            decisionComment = a.DecisionComment,
            createdAt = a.CreatedAt?.ToString("o"),
            updatedAt = a.UpdatedAt?.ToString("o")
        };

        public static object ToApplicationListItem(EventApplication a, User applicant)
        {
            var first = SupportManager.ParseAnswers(a.Answers).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Value));
            var snippet = first?.Value.Trim().ReplaceLineEndings(" ");
            if (snippet != null && snippet.Length > 160)
                snippet = snippet[..160] + "…";

            return new
            {
                applicationId = a.ApplicationId,
                status = a.Status,
                createdAt = a.CreatedAt?.ToString("o"),
                updatedAt = a.UpdatedAt?.ToString("o"),
                applicant = new
                {
                    userId = applicant.UserId,
                    nickname = applicant.Nickname,
                    avatarUrl = applicant.AvatarUrl,
                    profileRole = applicant.ProfileRole,
                    isBanned = applicant.IsBanned
                },
                snippetLabel = first?.Label,
                snippet
            };
        }
    }



    public partial class SupportManager(Supabase.Client client, AppCache cache)
    {
        private readonly Supabase.Client _client = client;
        private static readonly Regex MentionRegex = MyRegex();

        private readonly AppCache _cache = cache;

        public AppCache Cache => _cache;

        // Получение токена пользователя
        public async Task<string?> GetUserIdAsync(string? authHeader)
        {
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return null;

            var token = authHeader["Bearer ".Length..].Trim();
            if (string.IsNullOrEmpty(token) || token == "undefined" || token == "null")
                return null;

            var key = CacheKeys.Token(ComputeTokenHash(token));
            var id = await _cache.GetOrCreateAsync<string?>(key, async ct =>
            {
                try { return (await _client.Auth.GetUser(token))?.Id; }
                catch { return null; }
            }, CacheStale.Short);

            if (id is null)
                await _cache.RemoveAsync(key);

            return id;
        }

        // Роль и бан из кэша
        public async Task<UserAccess> GetAccessAsync(string userId)
        {
            var key = CacheKeys.Access(userId);
            var access = await _cache.GetOrCreateAsync(key, async ct =>
            {
                var r = await _client.From<User>().Where(u => u.UserId == userId).Get();
                var u = r.Models.FirstOrDefault();
                return new UserAccess(u?.SystemRole, u?.IsBanned ?? false, u != null);
            }, CacheStale.Short, [CacheKeys.Tags.User(userId)]);

            if (!access.Exists)
                await _cache.RemoveAsync(key);

            return access;
        }


        // Вычисление хэша токена для ключа кэша
        private static string ComputeTokenHash(string token)
        {
            var bytes = System.Security.Cryptography.SHA256.HashData(
                System.Text.Encoding.UTF8.GetBytes(token));
            return Convert.ToBase64String(bytes);
        }

        // Получить роль
        public async Task<string?> GetRoleAsync(string? userId) =>
            string.IsNullOrEmpty(userId) ? null : (await GetAccessAsync(userId)).Role;

        // Является ли роль стафф?
        public async Task<bool> IsStaffAsync(string? userId) =>
            Roles.IsStaff(await GetRoleAsync(userId));

        // Определение зрителя
        public async Task<Viewer> GetViewerAsync(string? authHeader)
        {
            var userId = await GetUserIdAsync(authHeader);
            if (string.IsNullOrEmpty(userId)) return new Viewer(null, null);

            await UpdateLastOnlineAsync(userId);

            var access = await GetAccessAsync(userId);
            if (!access.Exists || access.IsBanned) return new Viewer(null, null);

            return new Viewer(userId, access.Role);
        }

        // Совпадает ли введённый никнейм с никнеймом в метаданных аккаунта
        public static bool IsNicknameValid(Supabase.Gotrue.User userAuth, string? nickname)
        {
            var currentNickname = userAuth.UserMetadata?
                .GetValueOrDefault("nickname")?.ToString() ?? "";

            return !string.IsNullOrWhiteSpace(nickname) &&
                   string.Equals(nickname.Trim(), currentNickname.Trim(), StringComparison.OrdinalIgnoreCase);
        }

        // Обновление онлайна не чаще раза в 30 секунд (CacheTtl.Short)
        public async Task UpdateLastOnlineAsync(string userId)
        {
            await _cache.GetOrCreateAsync(CacheKeys.OnlineTouch(userId), async ct =>
            {
                try
                {
                    await _client.From<User>().Where(u => u.UserId == userId)
                        .Set(u => u.LastOnlineAt!, DateTime.UtcNow).Update(cancellationToken: ct);
                }
                catch { }
                return true;
            }, CacheStale.Short);
        }

        // Склонение
        public static string Plural(long n, string one, string few, string many)
        {
            var abs = Math.Abs(n) % 100;
            if (abs is > 10 and < 20) return many;
            return (abs % 10) switch
            {
                1 => one,
                >= 2 and <= 4 => few,
                _ => many
            };
        }

        // Время онлайна
        public static string FormatLastSeen(DateTimeOffset? lastOnlineAt)
        {
            if (!lastOnlineAt.HasValue) return "давно";

            var diff = DateTimeOffset.UtcNow - lastOnlineAt.Value;

            if (diff.TotalMinutes < 1) return "только что";

            if (diff.TotalMinutes < 60)
            {
                var minutes = (int)diff.TotalMinutes;
                return $"{minutes} {Plural(minutes, "минуту", "минуты", "минут")} назад";
            }
            if (diff.TotalHours < 24)
            {
                var hours = (int)diff.TotalHours;
                return $"{hours} {Plural(hours, "час", "часа", "часов")} назад";
            }
            if (diff.TotalDays < 30)
            {
                var days = (int)diff.TotalDays;
                return $"{days} {Plural(days, "день", "дня", "дней")} назад";
            }
            if (diff.TotalDays < 365)
            {
                var months = (int)(diff.TotalDays / 30);
                return $"{months} {Plural(months, "месяц", "месяца", "месяцев")} назад";
            }

            var years = (int)(diff.TotalDays / 365);
            return $"{years} {Plural(years, "год", "года", "лет")} назад";
        }

        // Онлайн ли пользователь?
        public static bool IsOnline(DateTimeOffset? lastOnlineAt)
        {
            if (!lastOnlineAt.HasValue) return false;
            var diff = DateTimeOffset.UtcNow - lastOnlineAt.Value;
            return diff.TotalMinutes < Limits.OnlineThresholdMinutes && diff.TotalMinutes >= 0;
        }

        // Парсинг навыков из строки
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

        // Создать уведомление
        public async Task SendNotificationAsync(
            string userId, string referenceType, string referenceId, string eventType,
            Dictionary<string, object>? contextData = null)
        {
            try
            {
                var data = contextData ?? [];
                data["eventType"] = eventType;

                var notification = new Notification
                {
                    NotificationId = Guid.NewGuid().ToString(),
                    UserId = userId,
                    ReferenceId = referenceId,
                    ReferenceType = referenceType,
                    ContextData = JsonSerializer.Serialize(data),
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<Notification>().Insert(
                    notification,
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
            }
            catch (Exception){ }
        }

        // Извлечь данные контекста из JSON
        public static Dictionary<string, object?> ExtractContextData(object? contextData)
        {
            if (contextData == null)
                return [];

            if (contextData is Dictionary<string, object?> dict)
                return dict;

            if (contextData is Dictionary<string, JsonElement> jsonDict)
            {
                var result = new Dictionary<string, object?>();
                foreach (var kvp in jsonDict)
                {
                    result[kvp.Key] = ExtractValueFromJsonElement(kvp.Value);
                }
                return result;
            }

            if (contextData is JsonElement jsonElement)
            {
                var result = new Dictionary<string, object?>();
                foreach (var prop in jsonElement.EnumerateObject())
                {
                    result[prop.Name] = ExtractValueFromJsonElement(prop.Value);
                }
                return result;
            }

            if (contextData is string jsonString)
            {
                try
                {
                    using var doc = JsonDocument.Parse(jsonString);
                    var root = doc.RootElement;

                    if (root.ValueKind == JsonValueKind.Object)
                    {
                        var result = new Dictionary<string, object?>();
                        foreach (var prop in root.EnumerateObject())
                        {
                            result[prop.Name] = ExtractValueFromJsonElement(prop.Value);
                        }
                        return result;
                    }
                }
                catch
                {
                }
            }

            return [];
        }

        // Извлечь значение из JsonElement
        public static object? ExtractValueFromJsonElement(JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString(),
                JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Null => null,
                JsonValueKind.Object => element.EnumerateObject()
                    .ToDictionary(p => p.Name, p => ExtractValueFromJsonElement(p.Value)),
                JsonValueKind.Array => element.EnumerateArray()
                    .Select(ExtractValueFromJsonElement).ToList(),
                _ => element.ToString()
            };
        }

        // Статусы мероприятий
        private static readonly Dictionary<string, string> StatusToEnum = new()
        {
            { "В процессе", "in_progress" },
            { "Завершён", "completed" },
            { "Приостановлен", "paused" }
        };

        // Статусы мероприятий
        private static readonly Dictionary<string, string> EnumToStatus = new()
        {
            { "in_progress", "В процессе" },
            { "completed", "Завершён" },
            { "paused", "Приостановлен" }
        };

        public static string ToEnumStatus(string? status) =>
            status != null && StatusToEnum.TryGetValue(status, out var s) ? s : "in_progress";

        public static string ToRuStatus(string? enumStatus) =>
            enumStatus != null && EnumToStatus.TryGetValue(enumStatus, out var s) ? s : "В процессе";

        // Размер файла из метаданных (если есть)
        public static long GetFileSize(Supabase.Storage.FileObject file)
        {
            if (file.MetaData != null && file.MetaData.TryGetValue("size", out var sizeObj))
            {
                if (sizeObj is JsonElement je && je.TryGetInt64(out var size)) return size;
                if (long.TryParse(sizeObj?.ToString(), out var parsed)) return parsed;
            }
            return 0;
        }

        // Список файлов проекта, помеченных на удаление в черновике
        public static List<string> ParseDeletedMediaFiles(string? json) =>
            string.IsNullOrEmpty(json)
                ? []
                : JsonSerializer.Deserialize<List<string>>(json) ?? [];

        // Подписи типов обращений
        private static readonly Dictionary<string, string> ReportTypeLabels = new()
        {
            { "bug", "БАГ" },
            { "complaint", "ЖАЛОБА" },
            { "suggestion", "ПРЕДЛОЖЕНИЕ" },
            { "opinion", "МНЕНИЕ" },
        };

        // Подпись типа обращения
        public static string GetReportTypeLabel(string? type) =>
            ReportTypeLabels.TryGetValue(type ?? "", out var label) ? label : "МНЕНИЕ";

        // Проверка прав на просмотр проекта (используем GetAccessAsync)
        public async Task<bool> CanViewProject(Project project, string? currentUserId, bool isStaff)
        {
            var owner = await GetAccessAsync(project.OwnerId);
            if (owner.IsBanned && !isStaff)
                return false;

            if (!project.IsPrivate)
                return true;

            if (string.IsNullOrEmpty(currentUserId))
                return false;

            if (project.OwnerId == currentUserId)
                return true;

            var membership = await _client.From<ProjectMember>()
                .Where(pm => pm.ProjectId == project.ProjectId && pm.UserId == currentUserId)
                .Get();

            return membership.Models.Count > 0;
        }

        // Получить общий размер медиа проекта
        public async Task<long> GetTotalProjectMediaSize(string projectId)
        {
            long total = 0;

            var draftResponse = await _client.From<ProjectDraft>().Where(d => d.ProjectId == projectId).Get();
            var draft = draftResponse.Models.FirstOrDefault();
            var deletedFileNames = ParseDeletedMediaFiles(draft?.DeletedMediaFiles);

            var cleanFiles = await _client.Storage.From("ProjectMedia").List(projectId);
            if (cleanFiles != null)
            {
                foreach (var f in cleanFiles)
                {
                    if (string.IsNullOrEmpty(f.Name) || deletedFileNames.Contains(f.Name)) continue;
                    total += GetFileSize(f);
                }
            }

            var draftFiles = await _client.Storage.From("ProjectMediaDraft").List(projectId);
            if (draftFiles != null)
            {
                foreach (var f in draftFiles)
                {
                    if (string.IsNullOrEmpty(f.Name)) continue;
                    total += GetFileSize(f);
                }
            }

            return total;
        }

        // Парс полей формы
        public static List<EventFormField> ParseFormFields(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try { return JsonSerializer.Deserialize<List<EventFormField>>(json) ?? []; }
            catch { return []; }
        }

        // Парс этапов
        public static List<EventStageItem> ParseStages(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try { return JsonSerializer.Deserialize<List<EventStageItem>>(json) ?? []; }
            catch { return []; }
        }

        // Парс ответов
        public static List<EventApplicationAnswer> ParseAnswers(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try { return JsonSerializer.Deserialize<List<EventApplicationAnswer>>(json) ?? []; }
            catch { return []; }
        }

        // Парс черновика
        public static object? ParseDraft(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            try { return JsonSerializer.Deserialize<JsonElement>(raw); }
            catch { return null; }
        }

        // Парс даты
        public static DateTime ParseDate(string value) =>
            DateTime.ParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture);

        // Нормализация даты
        public static string? NormalizeDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;

            if (DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var exact))
                return exact.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            return DateTime.TryParse(value, CultureInfo.CurrentCulture, DateTimeStyles.None, out var any)
                ? any.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                : null;
        }

        // Состояние приёма заявок
        public static string GetRegistrationState(Event ev)
        {
            var startText = NormalizeDate(ev.EventStartDate);
            var endText = NormalizeDate(ev.EventEndDate);

            if (ev.Status != "in_progress" || startText == null || endText == null)
                return "closed";

            var today = DateTime.UtcNow.Date;
            var windows = new List<(DateTime Start, DateTime End)>();

            foreach (var s in ParseStages(ev.Stages).Where(s => s.AcceptsApplications))
            {
                if (DateTime.TryParseExact(s.StartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var a)
                    && DateTime.TryParseExact(s.EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var b))
                    windows.Add((a, b));
            }

            if (windows.Count == 0)
                windows.Add((ParseDate(startText), ParseDate(endText)));

            if (windows.Any(w => today >= w.Start && today <= w.End)) return "open";
            return windows.Any(w => today < w.Start) ? "upcoming" : "closed";
        }

        // Снимок ответов по текущей форме
        public static List<EventApplicationAnswer> BuildAnswers(Event ev, List<EventApplicationAnswerInput> inputs)
        {
            var values = inputs.ToDictionary(i => i.FieldId, i => i.Value?.Trim() ?? "");

            return [.. ParseFormFields(ev.ApplicationForm).Select(f => new EventApplicationAnswer
            {
                FieldId = f.Id,
                Label = f.Label,
                Required = f.Required,
                Value = values.GetValueOrDefault(f.Id, "")
            })];
        }

        // Мероприятие, если оно доступно пользователю
        public async Task<Event?> GetViewableEvent(string eventId, string? userId)
        {
            var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
            var ev = response.Models.FirstOrDefault();
            if (ev == null) return null;

            var isStaff = await IsStaffAsync(userId);
            return await CanView(ev, userId, isStaff) ? ev : null;
        }

        // Проверка прав на просмотр
        public async Task<bool> CanView(Event ev, string? currentUserId, bool isStaff)
        {
            if (isStaff) return true;

            var owner = await GetAccessAsync(ev.OwnerId);
            if (owner.IsBanned && ev.OwnerId != currentUserId) return false;

            if (!ev.IsPrivate) return true;
            if (string.IsNullOrEmpty(currentUserId)) return false;
            if (ev.OwnerId == currentUserId) return true;

            var membership = await _client.From<EventMember>()
                .Where(m => m.EventId == ev.EventId && m.UserId == currentUserId)
                .Get();

            return membership.Models.Count > 0;
        }

        // Собрать карточки для списка (с фильтрацией по видимости)
        public async Task<List<object>> BuildCards(IEnumerable<Event> events, string? currentUserId, bool isStaff)
        {
            var allUsers = await GetAllUsersAsync();
            var usersDict = allUsers.Where(u => u.UserId != null).ToDictionary(u => u.UserId!);

            var result = new List<object>();

            foreach (var ev in events.OrderByDescending(e => e.CreatedAt))
            {
                if (!usersDict.TryGetValue(ev.OwnerId, out var owner)) continue;

                if (!await CanView(ev, currentUserId, isStaff))
                    continue;

                var members = await _client.From<EventMember>().Where(m => m.EventId == ev.EventId).Get();
                result.Add(Mappers.ToCard(ev, owner, members.Models.Count));
            }
            return result;
        }

        // Количество оценок мероприятия
        public async Task<int> GetRatingCount(string eventId)
        {
            var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
            return response.Models.FirstOrDefault()?.RatingCount ?? 0;
        }

        // Мероприятие с деталями для страницы
        public async Task<Dictionary<string, object?>?> LoadDetails(string eventId, string? currentUserId, bool isStaff)
        {
            var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
            var ev = response.Models.FirstOrDefault();
            if (ev == null)
                return null;

            var owner = await GetUserCachedAsync(ev.OwnerId);
            if (owner == null) return null;

            if (!await CanView(ev, currentUserId, isStaff)) return null;

            var members = await _client.From<EventMember>().Where(m => m.EventId == eventId).Get();

            var card = Mappers.ToCard(ev, owner, members.Models.Count);
            card["description"] = ev.Description;
            card["participantLimit"] = ev.ParticipantLimit;
            card["stages"] = ParseStages(ev.Stages);
            card["applicationForm"] = ParseFormFields(ev.ApplicationForm);
            card["results"] = ev.Results;

            return card;
        }

        // Проверка, является ли пользователь владельцем мероприятия
        public async Task<bool> IsOwner(string eventId, string userId)
        {
            var r = await _client.From<Event>()
                .Where(e => e.EventId == eventId && e.OwnerId == userId)
                .Get();
            return r.Models.Count > 0;
        }

        // Мероприятие, если пользователь — его владелец
        public async Task<Event?> GetOwnedEvent(string eventId, string userId)
        {
            var response = await _client.From<Event>()
                .Where(e => e.EventId == eventId && e.OwnerId == userId)
                .Get();
            return response.Models.FirstOrDefault();
        }

        // Удалить все файлы мероприятия из хранилища
        public async Task DeleteEventMedia(string eventId)
        {
            var folders = new[] { eventId }.Concat(Validator.EventMediaSections.Select(s => $"{eventId}/{s}"));

            foreach (var folder in folders)
            {
                try
                {
                    var files = await _client.Storage.From("EventMedia").List(folder);
                    var paths = (files ?? [])
                        .Where(f => !string.IsNullOrEmpty(f.Name))
                        .Select(f => $"{folder}/{f.Name}")
                        .ToList();
                    if (paths.Count > 0)
                        await _client.Storage.From("EventMedia").Remove(paths);
                }
                catch (Exception) { }
            }
        }

        // Достигнут ли лимит участников
        public async Task<bool> IsLimitReached(Event ev)
        {
            if (ev.ParticipantLimit == null) return false;

            var members = await _client.From<EventMember>().Where(m => m.EventId == ev.EventId).Get();
            return members.Models.Count >= ev.ParticipantLimit;
        }

        // Заявка пользователя на мероприятие
        public async Task<EventApplication?> FindMyApplication(string eventId, string userId)
        {
            var response = await _client.From<EventApplication>()
                .Where(a => a.EventId == eventId && a.UserId == userId)
                .Get();
            return response.Models.FirstOrDefault();
        }

        // Полная заявка для страницы автора
        public async Task<Dictionary<string, object?>?> LoadApplicationDetail(Event ev, string applicationId)
        {
            var response = await _client.From<EventApplication>()
                .Where(a => a.ApplicationId == applicationId && a.EventId == ev.EventId)
                .Get();
            var app = response.Models.FirstOrDefault();
            if (app == null) return null;

            var applicant = await GetUserCachedAsync(app.UserId);
            if (applicant == null) return null;

            var members = await _client.From<EventMember>().Where(m => m.EventId == ev.EventId).Get();

            return new Dictionary<string, object?>
            {
                ["applicationId"] = app.ApplicationId,
                ["status"] = app.Status,
                ["answers"] = ParseAnswers(app.Answers),
                ["decisionComment"] = app.DecisionComment,
                ["createdAt"] = app.CreatedAt?.ToString("o"),
                ["updatedAt"] = app.UpdatedAt?.ToString("o"),
                ["applicant"] = Mappers.ToUserCard(applicant),
                ["membersCount"] = members.Models.Count,
                ["participantLimit"] = ev.ParticipantLimit
            };
        }

        // Очистить черновик подраздела (после сохранения или отмены)
        public async Task ClearDraft(string eventId, string section)
        {
            try
            {
                var query = _client.From<EventDraft>().Where(d => d.EventId == eventId);
                query = section switch
                {
                    "general" => query.Set(d => d.General!, null),
                    "form" => query.Set(d => d.Form!, null),
                    _ => query.Set(d => d.Results!, null)
                };
                await query.Update();
            }
            catch (Exception) { }
        }

        // Удаление комментария с проверкой наличия дочерних комментариев
        public async Task DeleteOrSoftDelete(Comment comment, bool isModeratorDeleting)
        {
            var childrenResponse = await _client.From<Comment>()
                .Where(c => c.ParentCommentId == comment.CommentId)
                .Get();

            if (childrenResponse.Models.Count == 0)
            {
                await _client.From<Comment>()
                    .Where(c => c.CommentId == comment.CommentId)
                    .Delete();

                if (!string.IsNullOrEmpty(comment.ParentCommentId))
                {
                    await CleanupAncestorIfOrphaned(comment.ParentCommentId);
                }
            }
            else
            {
                await _client.From<Comment>()
                    .Where(c => c.CommentId == comment.CommentId)
                    .Set(c => c.IsDeleted, true)
                    .Set(c => c.DeletedByModerator, isModeratorDeleting)
                    .Set(c => c.UpdatedAt!, DateTime.UtcNow)
                    .Update();
            }
        }

        // Очистить родительский комментарий, если у него не осталось дочерних
        public async Task CleanupAncestorIfOrphaned(string parentId)
        {
            var parentResponse = await _client.From<Comment>()
                .Where(c => c.CommentId == parentId)
                .Get();

            var parent = parentResponse.Models.FirstOrDefault();
            if (parent == null || !parent.IsDeleted)
                return;

            var siblingsResponse = await _client.From<Comment>()
                .Where(c => c.ParentCommentId == parentId)
                .Get();

            if (siblingsResponse.Models.Count > 0)
                return;

            await _client.From<Comment>()
                .Where(c => c.CommentId == parentId)
                .Delete();

            if (!string.IsNullOrEmpty(parent.ParentCommentId))
            {
                await CleanupAncestorIfOrphaned(parent.ParentCommentId);
            }
        }

        // Может ли пользователь комментировать объект
        public async Task<bool> CanAccessReference(string referenceType, string referenceId, string userId)
        {
            if (referenceType == "project")
            {
                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == referenceId)
                    .Get();
                var p = project.Models.FirstOrDefault();
                if (p == null) return false;

                if (!p.IsPrivate) return true;
                if (p.OwnerId == userId) return true;

                var membership = await _client.From<ProjectMember>()
                    .Where(pm => pm.ProjectId == referenceId && pm.UserId == userId)
                    .Get();
                return membership.Models.Count > 0;
            }

            if (referenceType == "event")
            {
                var evResponse = await _client.From<Event>().Where(e => e.EventId == referenceId).Get();
                var ev = evResponse.Models.FirstOrDefault();
                if (ev == null) return false;
                if (!ev.IsPrivate || ev.OwnerId == userId) return true;

                var membership = await _client.From<EventMember>()
                    .Where(m => m.EventId == referenceId && m.UserId == userId)
                    .Get();
                return membership.Models.Count > 0;
            }

            return true;
        }

        // Является ли пользователь владельцем объекта (проекта или мероприятия)
        public async Task<bool> IsReferenceOwner(string referenceType, string referenceId, string userId)
        {
            if (referenceType == "project")
            {
                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == referenceId && p.OwnerId == userId)
                    .Get();
                return project.Models.Count > 0;
            }

            if (referenceType == "event")
            {
                var owned = await _client.From<Event>()
                    .Where(e => e.EventId == referenceId && e.OwnerId == userId)
                    .Get();
                return owned.Models.Count > 0;
            }

            return false;
        }

        // Упоминания @nickname в комментарии
        public async Task ProcessMentions(Comment comment, string authorId)
        {
            var matches = MentionRegex.Matches(comment.Content ?? "");
            if (matches.Count == 0) return;

            var nicknames = matches.Select(m => m.Groups[1].Value).Distinct().ToList();

            var allUsers = await GetAllUsersAsync();
            var usersByNickname = allUsers.Where(u => !string.IsNullOrEmpty(u.Nickname))
                                          .ToDictionary(u => u.Nickname!, u => u, StringComparer.OrdinalIgnoreCase);

            var authorNickname = usersByNickname.TryGetValue(authorId, out var author) ? (author.Nickname ?? "Пользователь") : "Пользователь";

            foreach (var nickname in nicknames)
            {
                if (!usersByNickname.TryGetValue(nickname, out var mentionedUser)) continue;
                if (mentionedUser.UserId == authorId) continue;

                var mention = new CommentMention
                {
                    MentionId = Guid.NewGuid().ToString(),
                    CommentId = comment.CommentId,
                    MentionedUserId = mentionedUser.UserId!,
                    CreatedAt = DateTime.UtcNow
                };

                try
                {
                    await _client.From<CommentMention>().Insert(mention, new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
                }
                catch { continue; }

                await SendNotificationAsync(
                    mentionedUser.UserId!, "comment", comment.ReferenceId, "comment_mention",
                    new Dictionary<string, object> { ["nickname"] = authorNickname, ["commentId"] = comment.CommentId });
            }
        }

        // Кого затрагивает блокировка
        public async Task<(List<(string ResponderId, string ProjectName, string VacancyName)> Responders, List<(string InviteeId, string ProjectName, string Role)> Invitees)> GetPendingThirdParties(string ownerId)
        {
            var responders = new List<(string, string, string)>();
            var invitees = new List<(string, string, string)>();

            var projects = await _client.From<Project>().Where(p => p.OwnerId == ownerId).Get();

            foreach (var project in projects.Models)
            {
                var vacancies = await _client.From<Vacancy>().Where(v => v.ProjectId == project.ProjectId).Get();
                foreach (var vacancy in vacancies.Models)
                {
                    var vacancyResponses = await _client.From<Response>()
                        .Where(r => r.VacancyId == vacancy.VacancyId && r.Status == "pending")
                        .Get();
                    foreach (var responderId in vacancyResponses.Models.Select(r => r.UserId).Distinct())
                        responders.Add((responderId, project.Title, vacancy.Title));
                }

                var invites = await _client.From<Invite>()
                    .Where(i => i.ProjectId == project.ProjectId && i.Status == "pending")
                    .Get();
                foreach (var invite in invites.Models)
                    invitees.Add((invite.UserId, project.Title, invite.Role));
            }

            return (responders, invitees);
        }

        // Убедиться, что пользователь является участником переписки
        public async Task EnsureParticipant(string conversationId, string participantUserId)
        {
            var existing = await _client.From<ConversationParticipant>()
                .Where(p => p.ConversationId == conversationId && p.UserId == participantUserId)
                .Get();

            if (existing.Models.Count > 0) return;

            try
            {
                await _client.From<ConversationParticipant>().Insert(
                    new ConversationParticipant
                    {
                        ParticipantId = Guid.NewGuid().ToString(),
                        ConversationId = conversationId,
                        UserId = participantUserId
                    },
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
            }
            catch { }
        }

        // КЕШ

        // Все пользователи: основа для списков, комментариев, профилей
        public async Task<List<User>> GetAllUsersAsync() =>
            (await _cache.SnapshotAsync(CacheKeys.UsersAll,
                async () => (await _client.From<User>().Get()).Models,
                CacheStale.Short, CacheKeys.Tags.Users)).Value;

        // Профиль по id
        public async Task<Models.User?> GetUserCachedAsync(string userId)
        {
            var u = (await GetAllUsersAsync()).FirstOrDefault(x => x.UserId == userId);
            if (u != null) return u;

            var r = await _client.From<User>().Where(x => x.UserId == userId).Get();
            u = r.Models.FirstOrDefault();
            if (u != null)
            {
                await _cache.InvalidateAsync(CacheKeys.Tags.Users);
            }
            return u;
        }

        // Счётчики для сортировки пользователей
        public async Task<UserCounts> GetUserCountsAsync() =>
            (await _cache.SnapshotAsync(CacheKeys.UserCounts, async () =>
            {
                var projects = (await _client.From<Project>().Get()).Models
                    .GroupBy(p => p.OwnerId).ToDictionary(g => g.Key, g => g.Count());
                var ratings = (await _client.From<ProjectRating>().Get()).Models
                    .GroupBy(r => r.UserId).ToDictionary(g => g.Key, g => g.Count());
                return new UserCounts(projects, ratings);
            }, CacheStale.Medium, CacheKeys.Tags.Projects)).Value;

        // Все открытые заявки публичных проектов
        public async Task<List<VacancyListItem>> GetVacancyListAsync() =>
            (await _cache.SnapshotAsync(CacheKeys.VacanciesAll, async () =>
            {
                var vacancies = (await _client.From<Vacancy>().Where(v => v.IsOpen == true).Get()).Models;
                var projects = (await _client.From<Project>().Get()).Models
                    .Where(p => !p.IsPrivate).ToDictionary(p => p.ProjectId);
                var owners = (await GetAllUsersAsync())
                    .Where(u => u.UserId != null).ToDictionary(u => u.UserId!);
                var members = (await _client.From<ProjectMember>().Get()).Models 
                    .GroupBy(m => m.ProjectId).ToDictionary(g => g.Key, g => g.Count());

                var list = new List<VacancyListItem>();
                foreach (var v in vacancies)
                {
                    if (!projects.TryGetValue(v.ProjectId, out var p)) continue;
                    owners.TryGetValue(p.OwnerId, out var owner);
                    list.Add(new VacancyListItem(v, p, members.GetValueOrDefault(p.ProjectId),
                                 owner?.Nickname, owner?.IsBanned == true));
                }
                return list;
            }, CacheStale.Medium, CacheKeys.Tags.Vacancies, CacheKeys.Tags.Projects, CacheKeys.Tags.Users)).Value;

        // Все публичные мероприятия
        public async Task<List<EventListItem>> GetPublicEventsAsync() =>
            (await _cache.SnapshotAsync(CacheKeys.EventsAll, async () =>
            {
                var events = (await _client.From<Event>().Where(e => e.IsPrivate == false).Get()).Models;
                var owners = (await GetAllUsersAsync())
                    .Where(u => u.UserId != null).ToDictionary(u => u.UserId!);
                var members = (await _client.From<EventMember>().Get()).Models
                    .GroupBy(m => m.EventId).ToDictionary(g => g.Key, g => g.Count());

                var list = new List<EventListItem>();
                foreach (var ev in events)
                    if (owners.TryGetValue(ev.OwnerId, out var o))
                        list.Add(new EventListItem(ev, o, members.GetValueOrDefault(ev.EventId)));
                return list;
            }, CacheStale.Medium, CacheKeys.Tags.Events, CacheKeys.Tags.Users)).Value;

        // Команда проекта
        public async Task<List<object>> GetProjectMemberCardsAsync(string projectId) =>
            (await _cache.SnapshotAsync(CacheKeys.ProjectMembers(projectId), async () =>
            {
                var response = await _client.From<ProjectMember>()
                    .Where(pm => pm.ProjectId == projectId).Get();

                var result = new List<object>();
                foreach (var m in response.Models)
                {
                    var rpcResult = await _client.Rpc("get_team_member_card",
                        new Dictionary<string, object> { { "p_user_id", m.UserId } });

                    var rows = JsonSerializer.Deserialize<List<TeamMemberCardRow>>(rpcResult.Content ?? "[]");
                    var user = rows?.FirstOrDefault();
                    if (user == null) continue;

                    result.Add(new
                    {
                        m.MemberId,
                        m.ProjectId,
                        m.UserId,
                        m.Role,
                        JoinedAt = m.JoinedAt?.ToString("o"),
                        user.Nickname,
                        user.AvatarUrl,
                        user.RealName,
                        user.Age,
                        user.City,
                        user.Workplace,
                        user.ProfileRole,
                        user.SystemRole,
                        user.IsBanned,
                        user.HardSkills,
                        user.SoftSkills,
                        LastOnlineAt = user.LastOnlineAt?.ToString("o"),
                        IsOnline = IsOnline(user.LastOnlineAt),
                        LastSeen = FormatLastSeen(user.LastOnlineAt)
                    });
                }
                return result;
            }, CacheStale.Short, CacheKeys.Tags.Project(projectId), CacheKeys.Tags.Users)).Value;

        // Комментарии
        public async Task<List<object>> GetCommentsAsync(string type, string id) =>
            (await _cache.SnapshotAsync(CacheKeys.Comments(type, id), async () =>
            {
                var comments = await _client.From<Comment>() 
                    .Where(c => c.ReferenceType == type && c.ReferenceId == id)
                    .Order(c => c.CreatedAt!, Supabase.Postgrest.Constants.Ordering.Ascending).Get();

                var users = (await GetAllUsersAsync())
                    .Where(u => u.UserId != null).ToDictionary(u => u.UserId!);

                var result = new List<object>();
                foreach (var c in comments.Models)
                {
                    User? u = null;
                    if (!string.IsNullOrEmpty(c.UserId)) users.TryGetValue(c.UserId, out u);
                    result.Add(new
                    {
                        c.CommentId,
                        c.UserId,
                        u?.Nickname,
                        u?.AvatarUrl,
                        c.ParentCommentId,
                        Content = c.IsDeleted ? null : c.Content,
                        AuthorSystemRole = u?.SystemRole,
                        c.IsEdited,
                        c.IsDeleted,
                        c.DeletedByModerator,
                        CreatedAt = c.CreatedAt?.ToString("o"),
                        UpdatedAt = c.UpdatedAt?.ToString("o")
                    });
                }
                return result;
            }, CacheStale.Medium, CacheKeys.Tags.Comments(type, id), CacheKeys.Tags.Users)).Value;


        [GeneratedRegex(@"@([a-zA-Z0-9_]+)", RegexOptions.Compiled)]
        private static partial Regex MyRegex();
    }
}