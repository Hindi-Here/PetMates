using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase.Postgrest;
using System.Globalization;
using System.Text.Json;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class EventController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        private const string RoleUser = "user";
        private const string RoleModerator = "moderator";
        private const string RoleAdmin = "admin";

        private static readonly Dictionary<string, string> StatusToEnum = new()
        {
            { "В процессе", "in_progress" },
            { "Завершён", "completed" },
            { "Приостановлен", "paused" }
        };

        private static readonly Dictionary<string, string> EnumToStatus = new()
        {
            { "in_progress", "В процессе" },
            { "completed", "Завершён" },
            { "paused", "Приостановлен" }
        };

        private static List<EventFormField> GetAllFormFields(Event ev) => ParseFormFields(ev.ApplicationForm);

        private static string ToEnumStatus(string status) =>
            StatusToEnum.TryGetValue(status, out var s) ? s : "in_progress";

        private static string ToRuStatus(string enumStatus) =>
            EnumToStatus.TryGetValue(enumStatus, out var s) ? s : "В процессе";

        // Мои мероприятия / мероприятия пользователя
        [HttpGet("by-user/{userId}")]
        public async Task<IActionResult> GetUserEvents(string userId)
        {
            try
            {
                var (currentUserId, isStaff) = await GetViewer();

                var response = await _client.From<Event>()
                    .Where(e => e.OwnerId == userId)
                    .Get();

                return Ok(await BuildCards(response.Models, currentUserId, isStaff));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Мероприятия, в которых пользователь участник (кроме собственных)
        [HttpGet("user/{userId}/member")]
        public async Task<IActionResult> GetUserMemberEvents(string userId)
        {
            try
            {
                var (currentUserId, isStaff) = await GetViewer();

                var memberships = await _client.From<EventMember>()
                    .Where(m => m.UserId == userId)
                    .Get();

                var events = new List<Event>();
                foreach (var m in memberships.Models)
                {
                    var r = await _client.From<Event>()
                        .Where(e => e.EventId == m.EventId && e.OwnerId != userId)
                        .Get();
                    var ev = r.Models.FirstOrDefault();
                    if (ev != null) events.Add(ev);
                }

                return Ok(await BuildCards(events, currentUserId, isStaff));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Избранные (оценённые) мероприятия пользователя
        [HttpGet("user/{userId}/favorites")]
        public async Task<IActionResult> GetUserFavoriteEvents(string userId)
        {
            try
            {
                var (currentUserId, isStaff) = await GetViewer();

                var ratings = await _client.From<EventRating>()
                    .Where(r => r.UserId == userId)
                    .Get();

                var events = new List<Event>();
                foreach (var rating in ratings.Models)
                {
                    var r = await _client.From<Event>()
                        .Where(e => e.EventId == rating.EventId)
                        .Get();
                    var ev = r.Models.FirstOrDefault();
                    if (ev != null) events.Add(ev);
                }

                return Ok(await BuildCards(events, currentUserId, isStaff));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Получить мероприятие по ID
        [HttpGet("{eventId}")]
        public async Task<IActionResult> GetEvent(string eventId)
        {
            try
            {
                var (currentUserId, isStaff) = await GetViewer();
                var details = await LoadDetails(eventId, currentUserId, isStaff);
                return details == null ? NotFound() : Ok(details);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Список публичных мероприятий с поиском и сортировкой
        [HttpGet]
        public async Task<IActionResult> GetAllEvents([FromQuery] string? search, [FromQuery] string searchField = "name", [FromQuery] string sortField = "date", [FromQuery] bool sortAsc = false, [FromQuery] bool showBannedOnly = false)
        {
            try
            {
                var (_, isStaff) = await GetViewer();

                var response = await _client.From<Event>().Where(e => e.IsPrivate == false).Get();

                var owners = new Dictionary<string, User?>();
                var items = new List<(Event Event, User Owner, int MembersCount)>();

                foreach (var ev in response.Models)
                {
                    if (!owners.TryGetValue(ev.OwnerId, out var owner))
                    {
                        owner = await GetUser(ev.OwnerId);
                        owners[ev.OwnerId] = owner;
                    }

                    if (owner == null) continue;
                    if (!isStaff && owner.IsBanned) continue;
                    if (isStaff && showBannedOnly && !owner.IsBanned) continue;

                    var members = await _client.From<EventMember>().Where(m => m.EventId == ev.EventId).Get();
                    items.Add((ev, owner, members.Models.Count));
                }

                var query = search?.Trim();
                if (!string.IsNullOrEmpty(query))
                {
                    items = [.. items.Where(i => searchField == "author"
                        ? i.Owner.Nickname?.Contains(query, StringComparison.CurrentCultureIgnoreCase) == true
                        : i.Event.Title.Contains(query, StringComparison.CurrentCultureIgnoreCase))];
                }

                items = sortField switch
                {
                    "event_date" => sortAsc
                        ? [.. items.OrderBy(i => NormalizeDate(i.Event.EventStartDate))]
                        : [.. items.OrderByDescending(i => NormalizeDate(i.Event.EventStartDate))],
                    "alphabet" => sortAsc
                        ? [.. items.OrderBy(i => i.Event.Title)]
                        : [.. items.OrderByDescending(i => i.Event.Title)],
                    "count" => sortAsc
                        ? [.. items.OrderBy(i => i.Event.RatingCount)]
                        : [.. items.OrderByDescending(i => i.Event.RatingCount)],
                    "count_users" => sortAsc
                        ? [.. items.OrderBy(i => i.MembersCount)]
                        : [.. items.OrderByDescending(i => i.MembersCount)],
                    _ => sortAsc
                        ? [.. items.OrderBy(i => i.Event.CreatedAt)]
                        : [.. items.OrderByDescending(i => i.Event.CreatedAt)],
                };

                return Ok(items.Select(i => ToCard(i.Event, i.Owner, i.MembersCount)));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Участники мероприятия: организатор + принятые участники
        [HttpGet("{eventId}/members")]
        public async Task<IActionResult> GetEventMembers(string eventId)
        {
            try
            {
                var (currentUserId, isStaff) = await GetViewer();

                var evResponse = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
                var ev = evResponse.Models.FirstOrDefault();
                if (ev == null) return NotFound();

                var ownerResponse = await _client.From<User>().Where(u => u.UserId == ev.OwnerId).Get();
                var owner = ownerResponse.Models.FirstOrDefault();
                if (owner == null || !await CanView(ev, owner, currentUserId, isStaff))
                    return NotFound();

                var memberships = await _client.From<EventMember>().Where(m => m.EventId == eventId).Get();

                var members = new List<object>();
                foreach (var m in memberships.Models.OrderBy(m => m.JoinedAt))
                {
                    var userResponse = await _client.From<User>().Where(u => u.UserId == m.UserId).Get();
                    var u = userResponse.Models.FirstOrDefault();

                    if (u == null || (u.IsBanned && !isStaff)) continue;

                    members.Add(ToUserCard(u));
                }

                return Ok(new { organizer = ToUserCard(owner), members });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Создать мероприятие
        [HttpPost]
        public async Task<IActionResult> CreateEvent([FromBody] CreateEventDto dto)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var error = Validator.ValidateEventCreate(dto);
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var newEvent = new Event
                {
                    OwnerId = userId,
                    Title = dto.Title.Trim(),
                    ShortDescription = dto.ShortDescription,
                    Status = ToEnumStatus(dto.Status ?? "В процессе"),
                    StatusChangedAt = DateTime.UtcNow,
                    EventStartDate = dto.EventStartDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    EventEndDate = dto.EventEndDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    IsPrivate = dto.IsPrivate,
                    RatingCount = 0,
                    CreatedAt = DateTime.UtcNow
                };

                var response = await _client.From<Event>().Insert(newEvent);
                var created = response.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest("Не удалось создать мероприятие");

                var cards = await BuildCards([created], userId, false);
                return Ok(cards.FirstOrDefault());
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // Удалить своё мероприятие
        [HttpDelete("{eventId}")]
        public async Task<IActionResult> DeleteEvent(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var response = await _client.From<Event>()
                    .Where(e => e.EventId == eventId && e.OwnerId == userId)
                    .Get();

                if (response.Models.Count == 0)
                    return NotFound();

                await _client.From<Event>().Where(e => e.EventId == eventId).Delete();
                await DeleteEventMedia(eventId);

                return Ok(new { message = "Мероприятие успешно удалено" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Сохранить подраздел «Общее» (только владелец)
        [HttpPut("{eventId}")]
        public async Task<IActionResult> UpdateEvent(string eventId, [FromBody] UpdateEventDto dto)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var response = await _client.From<Event>()
                    .Where(e => e.EventId == eventId && e.OwnerId == userId)
                    .Get();
                var ev = response.Models.FirstOrDefault();
                if (ev == null)
                    return NotFound();

                var error = Validator.ValidateEventUpdate(dto);
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var newStatus = ToEnumStatus(dto.Status ?? "В процессе");
                var stagesJson = JsonSerializer.Serialize(dto.Stages ?? []);

                await _client.From<Event>()
                    .Where(e => e.EventId == eventId)
                    .Set(e => e.Title, dto.Title.Trim())
                    .Set(e => e.ShortDescription!, dto.ShortDescription!.Trim())
                    .Set(e => e.Description!, dto.Description ?? "")
                    .Set(e => e.Status, newStatus)
                    .Set(e => e.StatusChangedAt!, newStatus != ev.Status ? DateTime.UtcNow : ev.StatusChangedAt)
                    .Set(e => e.IsPrivate, dto.IsPrivate)
                    .Set(e => e.EventStartDate!, dto.EventStartDate!.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
                    .Set(e => e.EventEndDate!, dto.EventEndDate!.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
                    .Set(e => e.ParticipantLimit!, dto.ParticipantLimit)
                    .Set(e => e.Stages, stagesJson)
                    .Update();

                await ClearDraft(eventId, "general");

                var details = await LoadDetails(eventId, userId, false);
                return details == null ? NotFound() : Ok(details);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Сохранить форму заявки (только владелец)
        [HttpPut("{eventId}/form")]
        public async Task<IActionResult> UpdateEventForm(string eventId, [FromBody] UpdateEventFormDto dto)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (!await IsOwner(eventId, userId))
                    return NotFound();

                var fields = dto.Fields ?? [];
                var error = Validator.ValidateEventForm(fields);
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var cleaned = fields
                    .Select(f => new EventFormField { Id = f.Id.Trim(), Label = f.Label.Trim(), Required = f.Required })
                    .ToList();

                await _client.From<Event>()
                    .Where(e => e.EventId == eventId)
                    .Set(e => e.ApplicationForm, JsonSerializer.Serialize(cleaned))
                    .Update();

                await ClearDraft(eventId, "form");

                var details = await LoadDetails(eventId, userId, false);
                return details == null ? NotFound() : Ok(details);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Сохранить результаты (только владелец)
        [HttpPut("{eventId}/results")]
        public async Task<IActionResult> UpdateEventResults(string eventId, [FromBody] UpdateEventResultsDto dto)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (!await IsOwner(eventId, userId))
                    return NotFound();

                var error = Validator.ValidateEventResults(dto.Results);
                if (error != null)
                    return BadRequest(new { message = error });

                var results = dto.Results ?? "";

                await _SupMan.UpdateLastOnlineAsync(userId);

                await _client.From<Event>()
                    .Where(e => e.EventId == eventId)
                    .Set(e => e.Results!, results)
                    .Update();

                await ClearDraft(eventId, "results");

                var details = await LoadDetails(eventId, userId, false);
                return details == null ? NotFound() : Ok(details);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Оценил ли текущий пользователь мероприятие
        [HttpGet("{eventId}/rating")]
        public async Task<IActionResult> GetUserRating(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var rating = await _client.From<EventRating>()
                    .Where(r => r.EventId == eventId && r.UserId == userId)
                    .Get();

                return Ok(new { hasRated = rating.Models.Count != 0 });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Оценить
        [HttpPost("{eventId}/rating")]
        public async Task<IActionResult> AddRating(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await GetViewableEvent(eventId, userId);
                if (ev == null) return NotFound();

                if (ev.OwnerId == userId)
                    return BadRequest("Нельзя оценить собственное мероприятие");

                var existing = await _client.From<EventRating>()
                    .Where(r => r.EventId == eventId && r.UserId == userId)
                    .Get();
                if (existing.Models.Count != 0)
                    return BadRequest("Вы уже оценили это мероприятие");

                await _client.From<EventRating>().Insert(
                    new EventRating { EventId = eventId, UserId = userId, CreatedAt = DateTime.UtcNow },
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });

                return Ok(new { success = true, ratingCount = await GetRatingCount(eventId) });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Убрать оценку
        [HttpDelete("{eventId}/rating")]
        public async Task<IActionResult> RemoveRating(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var rating = await _client.From<EventRating>()
                    .Where(r => r.EventId == eventId && r.UserId == userId)
                    .Get();
                if (rating.Models.Count == 0)
                    return NotFound(new { message = "Оценка не найдена" });

                await _client.From<EventRating>()
                    .Where(r => r.EventId == eventId && r.UserId == userId)
                    .Delete();

                return Ok(new { success = true, ratingCount = await GetRatingCount(eventId) });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Моя заявка на мероприятие
        [HttpGet("{eventId}/applications/me")]
        public async Task<IActionResult> GetMyEventApplication(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var app = await FindMyApplication(eventId, userId);
                return app == null ? NoContent() : Ok(ToApplicationMine(app));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Подать заявку
        [HttpPost("{eventId}/applications")]
        public async Task<IActionResult> SubmitApplication(string eventId, [FromBody] SubmitEventApplicationDto dto)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await GetViewableEvent(eventId, userId);
                if (ev == null) return NotFound();

                if (ev.OwnerId == userId)
                    return BadRequest(new { message = "Нельзя подать заявку на собственное мероприятие" });

                var state = GetRegistrationState(ev);
                if (state != "open")
                    return BadRequest(new { message = state == "upcoming" ? "Регистрация ещё не началась" : "Регистрация закрыта" });

                if (await FindMyApplication(eventId, userId) != null)
                    return BadRequest(new { message = "Вы уже подали заявку на это мероприятие" });

                var membership = await _client.From<EventMember>()
                    .Where(m => m.EventId == eventId && m.UserId == userId)
                    .Get();
                if (membership.Models.Count > 0)
                    return BadRequest(new { message = "Вы уже участник этого мероприятия" });

                if (await IsLimitReached(ev))
                    return BadRequest(new { message = "Достигнут лимит участников" });

                var inputs = dto.Answers ?? [];
                var error = Validator.ValidateEventApplication(inputs, GetAllFormFields(ev));
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var now = DateTime.UtcNow;
                var response = await _client.From<EventApplication>().Insert(new EventApplication
                {
                    EventId = eventId,
                    UserId = userId,
                    Status = "pending",
                    Answers = JsonSerializer.Serialize(BuildAnswers(ev, inputs)),
                    CreatedAt = now,
                    UpdatedAt = now
                });

                var created = response.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest(new { message = "Не удалось отправить заявку" });

                return Ok(ToApplicationMine(created));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Отправить заявку повторно после доработки
        [HttpPut("{eventId}/applications/me")]
        public async Task<IActionResult> ResubmitApplication(string eventId, [FromBody] SubmitEventApplicationDto dto)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var app = await FindMyApplication(eventId, userId);
                if (app == null) return NotFound();

                if (app.Status != "revision" && app.Status != "rejected")
                    return BadRequest(new { message = "Заявку можно изменить после запроса доработки или отказа" });

                var ev = await GetViewableEvent(eventId, userId);
                if (ev == null) return NotFound();

                if (app.Status == "rejected")
                {
                    if (GetRegistrationState(ev) != "open")
                        return BadRequest(new { message = "Приём заявок завершён" });
                    if (await IsLimitReached(ev))
                        return BadRequest(new { message = "Достигнут лимит участников" });
                }

                var inputs = dto.Answers ?? [];
                var error = Validator.ValidateEventApplication(inputs, GetAllFormFields(ev));
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                await _client.From<EventApplication>()
                    .Where(a => a.ApplicationId == app.ApplicationId)
                    .Set(a => a.Answers, JsonSerializer.Serialize(BuildAnswers(ev, inputs)))
                    .Set(a => a.Status, "pending")
                    .Set(a => a.DecisionComment!, null)
                    .Set(a => a.UpdatedAt!, DateTime.UtcNow)
                    .Update();

                var updated = await FindMyApplication(eventId, userId);
                return updated == null ? NotFound() : Ok(ToApplicationMine(updated));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Отозвать свою заявку
        [HttpDelete("{eventId}/applications/me")]
        public async Task<IActionResult> WithdrawApplication(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var app = await FindMyApplication(eventId, userId);
                if (app == null) return NotFound();

                if (app.Status is not ("pending" or "revision" or "rejected"))
                    return BadRequest(new { message = "Решение по заявке уже принято" });

                await _client.From<EventApplication>()
                    .Where(a => a.ApplicationId == app.ApplicationId)
                    .Delete();

                return Ok(new { message = "Заявка отозвана" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Список заявок (только автор)
        [HttpGet("{eventId}/applications")]
        public async Task<IActionResult> GetApplications(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await IsOwner(eventId, userId)) return NotFound();

                var response = await _client.From<EventApplication>()
                    .Where(a => a.EventId == eventId && a.Status != "rejected")
                    .Get();

                var users = new Dictionary<string, User?>();
                var result = new List<object>();

                foreach (var app in response.Models.OrderByDescending(a => a.CreatedAt))
                {
                    if (!users.TryGetValue(app.UserId, out var applicant))
                    {
                        applicant = await GetUser(app.UserId);
                        users[app.UserId] = applicant;
                    }
                    if (applicant == null) continue;

                    result.Add(ToApplicationListItem(app, applicant));
                }

                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Полная заявка (только автор)
        [HttpGet("{eventId}/applications/{applicationId}")]
        public async Task<IActionResult> GetApplication(string eventId, string applicationId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await GetOwnedEvent(eventId, userId);
                if (ev == null) return NotFound();

                var detail = await LoadApplicationDetail(ev, applicationId);
                return detail == null ? NotFound() : Ok(detail);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Решение автора: принять / отклонить / вернуть на доработку
        [HttpPut("{eventId}/applications/{applicationId}/decision")]
        public async Task<IActionResult> DecideApplication(string eventId, string applicationId, [FromBody] EventApplicationDecisionDto dto)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await GetOwnedEvent(eventId, userId);
                if (ev == null) return NotFound();

                var error = Validator.ValidateEventApplicationDecision(dto);
                if (error != null)
                    return BadRequest(new { message = error });

                var appResponse = await _client.From<EventApplication>()
                    .Where(a => a.ApplicationId == applicationId && a.EventId == eventId)
                    .Get();
                var app = appResponse.Models.FirstOrDefault();
                if (app == null) return NotFound();

                if (app.Status != "pending" && app.Status != "revision")
                    return BadRequest(new { message = "Решение по этой заявке уже принято" });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var comment = string.IsNullOrWhiteSpace(dto.Comment) ? null : dto.Comment.Trim();

                if (dto.Decision == "accept")
                {
                    var applicant = await GetUser(app.UserId);
                    if (applicant == null) return NotFound();
                    if (applicant.IsBanned)
                        return BadRequest(new { message = "Нельзя принять заблокированного пользователя" });

                    var existing = await _client.From<EventMember>()
                        .Where(m => m.EventId == eventId && m.UserId == app.UserId)
                        .Get();

                    if (existing.Models.Count == 0)
                    {
                        if (await IsLimitReached(ev))
                            return BadRequest(new { message = "Достигнут лимит участников" });

                        await _client.From<EventMember>().Insert(
                            new EventMember { EventId = eventId, UserId = app.UserId, JoinedAt = DateTime.UtcNow },
                            new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
                    }
                }

                var newStatus = dto.Decision switch
                {
                    "accept" => "accepted",
                    "reject" => "rejected",
                    _ => "revision"
                };

                await _client.From<EventApplication>()
                    .Where(a => a.ApplicationId == applicationId)
                    .Set(a => a.Status, newStatus)
                    .Set(a => a.DecisionComment!, comment)
                    .Update();

                var detail = await LoadApplicationDetail(ev, applicationId);
                return detail == null ? NotFound() : Ok(detail);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

          // МЕДИА

        // Список медиа мероприятия
        [HttpGet("{eventId}/media/{section}")]
        public async Task<IActionResult> GetMedia(string eventId, string section)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await IsOwner(eventId, userId)) return NotFound();

                var sectionError = Validator.ValidateEventMediaSection(section);
                if (sectionError != null) return BadRequest(new { message = sectionError });

                var folder = $"{eventId}/{section}";
                var files = await _client.Storage.From("EventMedia").List(folder);
                var result = (files ?? [])
                    .Where(f => !string.IsNullOrEmpty(f.Name))
                    .Select(f => new
                    {
                        name = f.Name,
                        url = _client.Storage.From("EventMedia").GetPublicUrl($"{folder}/{f.Name}"),
                        size = GetFileSize(f),
                        uploadedAt = f.CreatedAt ?? DateTime.UtcNow
                    });

                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Загрузить изображение в подраздел (владелец)
        [HttpPost("{eventId}/media/{section}")]
        [RequestSizeLimit(52_000_000)]
        public async Task<IActionResult> UploadMedia(string eventId, string section, [FromForm] IFormFile file)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await IsOwner(eventId, userId)) return Forbid();

                var sectionError = Validator.ValidateEventMediaSection(section);
                if (sectionError != null) return BadRequest(new { message = sectionError });

                var (imageError, extension) = Validator.ValidateEventImage(file);
                if (imageError != null) return BadRequest(new { message = imageError });

                var folder = $"{eventId}/{section}";

                const long maxTotalSize = 50 * 1024 * 1024;
                var existing = await _client.Storage.From("EventMedia").List(folder);
                var currentTotal = (existing ?? []).Sum(GetFileSize);
                if (currentTotal + file.Length > maxTotalSize)
                    return BadRequest(new { message = "Общий размер вложений не должен превышать 50 МБ" });

                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                var bytes = stream.ToArray();

                var fileName = $"{Guid.NewGuid()}{extension}";
                var path = $"{folder}/{fileName}";

                await _client.Storage.From("EventMedia").Upload(bytes, path, new Supabase.Storage.FileOptions
                {
                    Upsert = false,
                    ContentType = extension switch
                    {
                        ".png" => "image/png",
                        ".jpg" => "image/jpeg",
                        ".webp" => "image/webp",
                        _ => "image/gif"
                    }
                });

                var url = _client.Storage.From("EventMedia").GetPublicUrl(path);
                return Ok(new { url, fileName, size = bytes.Length });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Удалить изображение подраздела (владелец)
        [HttpDelete("{eventId}/media/{section}/{fileName}")]
        public async Task<IActionResult> DeleteMedia(string eventId, string section, string fileName)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await IsOwner(eventId, userId)) return Forbid();

                var error = Validator.ValidateEventMediaSection(section) ?? Validator.ValidateEventMediaFileName(fileName);
                if (error != null) return BadRequest(new { message = error });

                await _client.Storage.From("EventMedia").Remove([$"{eventId}/{section}/{fileName}"]);
                return Ok(new { message = "Файл удалён" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // МОДЕРАЦИЯ

        // Удалить мероприятие модератором/администратором
        [HttpDelete("{eventId}/moderation")]
        public async Task<IActionResult> ModerationDeleteEvent(string eventId, [FromBody] DeleteEventWithReasonDto dto)
        {
            try
            {
                var currentUserId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var currentRole = await GetRole(currentUserId);
                if (currentRole != RoleModerator && currentRole != RoleAdmin)
                    return Forbid();

                var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
                var ev = response.Models.FirstOrDefault();
                if (ev == null || ev.IsPrivate)
                    return NotFound();

                var ownerRole = await GetRole(ev.OwnerId);
                if (currentRole == RoleModerator && (ownerRole ?? RoleUser) != RoleUser)
                    return Forbid();

                var reason = string.IsNullOrWhiteSpace(dto.Reason) ? "не указана" : dto.Reason.Trim();

                await _client.From<Event>().Where(e => e.EventId == eventId).Delete();
                await DeleteEventMedia(eventId);

                await SendNotification(ev.OwnerId, eventId, "event_deleted_by_moderator", new Dictionary<string, object>
                {
                    { "eventName", ev.Title },
                    { "reason", reason }
                });

                await SendNotification(currentUserId, eventId, "moderator_deleted_event", new Dictionary<string, object>
                {
                    { "eventName", ev.Title },
                    { "reason", reason }
                });

                return Ok(new { message = "Мероприятие удалено модератором" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // ЧЕРНОВИКИ ПОДРАЗДЕЛОВ

        // Получить черновики автора
        [HttpGet("{eventId}/draft")]
        public async Task<IActionResult> GetDraft(string eventId)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await IsOwner(eventId, userId)) return NotFound();

                var response = await _client.From<EventDraft>().Where(d => d.EventId == eventId).Get();
                var draft = response.Models.FirstOrDefault();

                return Ok(new
                {
                    general = ParseDraft(draft?.General),
                    form = ParseDraft(draft?.Form),
                    results = ParseDraft(draft?.Results)
                });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Сохранить черновик подраздела
        [HttpPut("{eventId}/draft/{section}")]
        public async Task<IActionResult> SaveDraft(string eventId, string section, [FromBody] JsonElement body)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await IsOwner(eventId, userId)) return NotFound();

                var raw = body.GetRawText();
                var error = Validator.ValidateEventDraftSection(section) ?? Validator.ValidateEventDraftPayload(raw);
                if (error != null) return BadRequest(new { message = error });

                var now = DateTime.UtcNow;

                var existing = await _client.From<EventDraft>().Where(d => d.EventId == eventId).Get();
                if (existing.Models.Count == 0)
                {
                    await _client.From<EventDraft>().Insert(
                        new EventDraft { EventId = eventId, UpdatedAt = now },
                        new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
                }

                var query = _client.From<EventDraft>().Where(d => d.EventId == eventId);
                query = section switch
                {
                    "general" => query.Set(d => d.General!, raw),
                    "form" => query.Set(d => d.Form!, raw),
                    _ => query.Set(d => d.Results!, raw)
                };
                await query.Set(d => d.UpdatedAt!, now).Update();

                return Ok(new { message = "Черновик сохранён" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Отменить черновик подраздела
        [HttpDelete("{eventId}/draft/{section}")]
        public async Task<IActionResult> DiscardDraft(string eventId, string section)
        {
            try
            {
                var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await IsOwner(eventId, userId)) return NotFound();

                var error = Validator.ValidateEventDraftSection(section);
                if (error != null) return BadRequest(new { message = error });

                await ClearDraft(eventId, section);
                return Ok(new { message = "Черновик отменён" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // ВСПОМОГАТЕЛЬНОЕ

        // Текущий пользователь и является ли он стафом
        private async Task<(string? UserId, bool IsStaff)> GetViewer()
        {
            var userId = _SupMan.GetUserId(Request.Headers.Authorization.ToString());
            if (string.IsNullOrEmpty(userId)) return (null, false);

            await _SupMan.UpdateLastOnlineAsync(userId);

            var role = await GetRole(userId);
            return (userId, role == RoleAdmin || role == RoleModerator);
        }

        // Системная роль пользователя
        private async Task<string?> GetRole(string userId)
        {
            var response = await _client.From<User>().Where(u => u.UserId == userId).Get();
            return response.Models.FirstOrDefault()?.SystemRole;
        }

        // Мероприятие, если оно доступно пользователю
        private async Task<Event?> GetViewableEvent(string eventId, string? userId)
        {
            var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
            var ev = response.Models.FirstOrDefault();
            if (ev == null) return null;

            var isStaff = !string.IsNullOrEmpty(userId) && ((await GetRole(userId)) is RoleAdmin or RoleModerator);
            var ownerResponse = await _client.From<User>().Where(u => u.UserId == ev.OwnerId).Get();
            var owner = ownerResponse.Models.FirstOrDefault();
            if (owner == null) return null;

            return await CanView(ev, owner, userId, isStaff) ? ev : null;
        }

        // Проверка прав на просмотр
        private async Task<bool> CanView(Event ev, User owner, string? currentUserId, bool isStaff)
        {
            if (isStaff) return true;
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
        private async Task<List<object>> BuildCards(IEnumerable<Event> events, string? currentUserId, bool isStaff)
        {
            var owners = new Dictionary<string, User?>();
            var result = new List<object>();

            foreach (var ev in events.OrderByDescending(e => e.CreatedAt))
            {
                if (!owners.TryGetValue(ev.OwnerId, out var owner))
                {
                    var r = await _client.From<User>().Where(u => u.UserId == ev.OwnerId).Get();
                    owner = r.Models.FirstOrDefault();
                    owners[ev.OwnerId] = owner;
                }

                if (owner == null || !await CanView(ev, owner, currentUserId, isStaff))
                    continue;

                var members = await _client.From<EventMember>().Where(m => m.EventId == ev.EventId).Get();

                result.Add(ToCard(ev, owner, members.Models.Count));
            }

            return result;
        }

        // Количество оценок мероприятия
        private async Task<int> GetRatingCount(string eventId)
        {
            var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
            return response.Models.FirstOrDefault()?.RatingCount ?? 0;
        }

        // Отправить системное уведомление
        private async Task SendNotification(string userId, string referenceId, string eventType, Dictionary<string, object> contextData)
        {
            try
            {
                contextData["eventType"] = eventType;
                var notification = new Notification
                {
                    NotificationId = Guid.NewGuid().ToString(),
                    UserId = userId,
                    ReferenceId = referenceId,
                    ReferenceType = "system",
                    ContextData = System.Text.Json.JsonSerializer.Serialize(contextData),
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };
                await _client.From<Notification>().Insert(
                    notification,
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
            }
            catch (Exception) { }
        }

        // Карточка (поля, общие для списка и страницы)
        private static Dictionary<string, object?> ToCard(Event ev, User owner, int membersCount) => new()
        {
            ["eventId"] = ev.EventId,
            ["ownerId"] = ev.OwnerId,
            ["title"] = ev.Title,
            ["shortDescription"] = ev.ShortDescription,
            ["status"] = ToRuStatus(ev.Status),
            ["statusChangedAt"] = ev.StatusChangedAt?.ToString("o"),
            ["eventStartDate"] = NormalizeDate(ev.EventStartDate),
            ["eventEndDate"] = NormalizeDate(ev.EventEndDate),
            ["isPrivate"] = ev.IsPrivate,
            ["registrationState"] = GetRegistrationState(ev),
            ["ratingCount"] = ev.RatingCount,
            ["membersCount"] = membersCount,
            ["createdAt"] = ev.CreatedAt?.ToString("o"),
            ["ownerSystemRole"] = owner.SystemRole ?? RoleUser,
            ["ownerIsBanned"] = owner.IsBanned
        };

        // Мероприятие с деталями для страницы
        private async Task<Dictionary<string, object?>?> LoadDetails(string eventId, string? currentUserId, bool isStaff)
        {
            var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
            var ev = response.Models.FirstOrDefault();
            if (ev == null) return null;

            var ownerResponse = await _client.From<User>().Where(u => u.UserId == ev.OwnerId).Get();
            var owner = ownerResponse.Models.FirstOrDefault();
            if (owner == null || !await CanView(ev, owner, currentUserId, isStaff)) return null;

            var members = await _client.From<EventMember>().Where(m => m.EventId == eventId).Get();

            var card = ToCard(ev, owner, members.Models.Count);
            card["description"] = ev.Description;
            card["participantLimit"] = ev.ParticipantLimit;
            card["stages"] = ParseStages(ev.Stages);
            card["applicationForm"] = ParseFormFields(ev.ApplicationForm);
            card["results"] = ev.Results;
            return card;
        }

        // Парс поля формы из JSON (для карточки и для валидации)
        private static List<EventFormField> ParseFormFields(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try { return JsonSerializer.Deserialize<List<EventFormField>>(json) ?? []; }
            catch { return []; }
        }

        // Парс этапов из JSON (для карточки и для валидации)
        private static List<EventStageItem> ParseStages(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try { return JsonSerializer.Deserialize<List<EventStageItem>>(json) ?? []; }
            catch { return []; }
        }

        // Проверка, является ли пользователь владельцем мероприятия
        private async Task<bool> IsOwner(string eventId, string userId)
        {
            var r = await _client.From<Event>()
                .Where(e => e.EventId == eventId && e.OwnerId == userId)
                .Get();
            return r.Models.Count > 0;
        }

        // Удалить все файлы мероприятия из хранилища
        private async Task DeleteEventMedia(string eventId)
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

        // Размер файла из метаданных (если есть)
        private static long GetFileSize(Supabase.Storage.FileObject file)
        {
            if (file.MetaData != null && file.MetaData.TryGetValue("size", out var sizeObj))
            {
                if (sizeObj is JsonElement je && je.TryGetInt64(out var size)) return size;
                if (long.TryParse(sizeObj?.ToString(), out var parsed)) return parsed;
            }
            return 0;
        }

        // Определение формата изображения по сигнатуре
        private static string? DetectImageExtension(byte[] h)
        {
            if (h.Length >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47) return ".png";
            if (h.Length >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return ".jpg";
            if (h.Length >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P') return ".webp";
            if (h.Length >= 6 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8') return ".gif";
            return null;
        }

        // Данные пользователя для карточки (формат как в UsersController)
        private static object ToUserCard(User u) => new
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

        // Состояние приёма заявок: upcoming | open | closed (даты по UTC, как в политике БД)
        private static string GetRegistrationState(Event ev)
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

        // Дата в формате yyyy-MM-dd (для сравнения с датами этапов)
        private static DateTime ParseDate(string value) =>
            DateTime.ParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture);

        // Дата из БД в формате yyyy-MM-dd (на случай, если клиент вернёт её в другом формате)
        private static string? NormalizeDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;

            if (DateTime.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var exact))
                return exact.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            return DateTime.TryParse(value, CultureInfo.CurrentCulture, DateTimeStyles.None, out var any)
                ? any.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                : null;
        }

        // Парс ответов из JSON (для карточки и для валидации)
        private static List<EventApplicationAnswer> ParseAnswers(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return [];
            try { return JsonSerializer.Deserialize<List<EventApplicationAnswer>>(json) ?? []; }
            catch { return []; }
        }

        // Снимок ответов по текущей форме (названия и обязательность фиксируются на момент подачи)
        private static List<EventApplicationAnswer> BuildAnswers(Event ev, List<EventApplicationAnswerInput> inputs)
        {
            var values = inputs.ToDictionary(i => i.FieldId, i => i.Value?.Trim() ?? "");

            return GetAllFormFields(ev).Select(f => new EventApplicationAnswer
            {
                FieldId = f.Id,
                Label = f.Label,
                Required = f.Required,
                Value = values.GetValueOrDefault(f.Id, "")
            }).ToList();
        }

        // Все поля формы, включая скрытые (для валидации)
        private async Task<bool> IsLimitReached(Event ev)
        {
            if (ev.ParticipantLimit == null) return false;

            var members = await _client.From<EventMember>().Where(m => m.EventId == ev.EventId).Get();
            return members.Models.Count >= ev.ParticipantLimit;
        }

        // Проверка, является ли пользователь владельцем мероприятия
        private async Task<EventApplication?> FindMyApplication(string eventId, string userId)
        {
            var response = await _client.From<EventApplication>()
                .Where(a => a.EventId == eventId && a.UserId == userId)
                .Get();
            return response.Models.FirstOrDefault();
        }

        // Проверка, является ли пользователь владельцем мероприятия
        private async Task<Event?> GetOwnedEvent(string eventId, string userId)
        {
            var response = await _client.From<Event>()
                .Where(e => e.EventId == eventId && e.OwnerId == userId)
                .Get();
            return response.Models.FirstOrDefault();
        }

        // Проверка, является ли пользователь владельцем мероприятия
        private async Task<User?> GetUser(string userId)
        {
            var response = await _client.From<User>().Where(u => u.UserId == userId).Get();
            return response.Models.FirstOrDefault();
        }

        // Карточка заявки для автора (с полным набором полей)
        private static object ToApplicationMine(EventApplication a) => new
        {
            applicationId = a.ApplicationId,
            status = a.Status,
            answers = ParseAnswers(a.Answers),
            decisionComment = a.DecisionComment,
            createdAt = a.CreatedAt?.ToString("o"),
            updatedAt = a.UpdatedAt?.ToString("o")
        };

        // Короткая карточка заявки для списка автора
        private static object ToApplicationListItem(EventApplication a, User applicant)
        {
            var first = ParseAnswers(a.Answers).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.Value));
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

        // Полная заявка для страницы автора
        private async Task<Dictionary<string, object?>?> LoadApplicationDetail(Event ev, string applicationId)
        {
            var response = await _client.From<EventApplication>()
                .Where(a => a.ApplicationId == applicationId && a.EventId == ev.EventId)
                .Get();
            var app = response.Models.FirstOrDefault();
            if (app == null) return null;

            var applicant = await GetUser(app.UserId);
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
                ["applicant"] = ToUserCard(applicant),
                ["membersCount"] = members.Models.Count,
                ["participantLimit"] = ev.ParticipantLimit
            };
        }

        // Парс черновика из JSON (для карточки и для валидации)
        private static object? ParseDraft(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;
            try { return JsonSerializer.Deserialize<JsonElement>(raw); }
            catch { return null; }
        }

        // Очистить черновик подраздела (после сохранения или отмены)
        private async Task ClearDraft(string eventId, string section)
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

    }
}