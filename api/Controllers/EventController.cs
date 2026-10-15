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

        // Мои мероприятия / мероприятия пользователя
        [HttpGet("by-user/{userId}")]
        public async Task<IActionResult> GetUserEvents(string userId)
        {
            try
            {
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var currentUserId = viewer.UserId;
                var isStaff = viewer.IsStaff;

                var response = await _client.From<Event>()
                    .Where(e => e.OwnerId == userId)
                    .Get();

                return Ok(await _SupMan.BuildCards(response.Models, currentUserId, isStaff));
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
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var currentUserId = viewer.UserId;
                var isStaff = viewer.IsStaff;

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

                return Ok(await _SupMan.BuildCards(events, currentUserId, isStaff));
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
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var currentUserId = viewer.UserId;
                var isStaff = viewer.IsStaff;

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

                return Ok(await _SupMan.BuildCards(events, currentUserId, isStaff));
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
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var currentUserId = viewer.UserId;
                var isStaff = viewer.IsStaff;

                var details = await _SupMan.LoadDetails(eventId, currentUserId, isStaff);
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
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var isStaff = viewer.IsStaff;

                var response = await _client.From<Event>().Where(e => e.IsPrivate == false).Get();

                var owners = new Dictionary<string, User?>();
                var items = new List<(Event Event, User Owner, int MembersCount)>();

                foreach (var ev in response.Models)
                {
                    if (!owners.TryGetValue(ev.OwnerId, out var owner))
                    {
                        owner = await _SupMan.GetUserAsync(ev.OwnerId);
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
                        ? [.. items.OrderBy(i => SupportManager.NormalizeDate(i.Event.EventStartDate))]
                        : [.. items.OrderByDescending(i => SupportManager.NormalizeDate(i.Event.EventStartDate))],
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

                return Ok(items.Select(i => Mappers.ToCard(i.Event, i.Owner, i.MembersCount)));
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
                var viewer = await _SupMan.GetViewerAsync(Request.Headers.Authorization.ToString());
                var currentUserId = viewer.UserId;
                var isStaff = viewer.IsStaff;

                var evResponse = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
                var ev = evResponse.Models.FirstOrDefault();
                if (ev == null) return NotFound();

                var owner = await _SupMan.GetUserAsync(ev.OwnerId);
                if (owner == null || !await _SupMan.CanView(ev, owner, currentUserId, isStaff))
                    return NotFound();

                var memberships = await _client.From<EventMember>().Where(m => m.EventId == eventId).Get();

                var members = new List<object>();
                foreach (var m in memberships.Models.OrderBy(m => m.JoinedAt))
                {
                    var u = await _SupMan.GetUserAsync(m.UserId);
                    if (u == null || (u.IsBanned && !isStaff)) continue;

                    members.Add(Mappers.ToUserCard(u));
                }

                return Ok(new { organizer = Mappers.ToUserCard(owner), members });
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
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
                    Status = SupportManager.ToEnumStatus(dto.Status ?? "В процессе"),
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

                var cards = await _SupMan.BuildCards([created], userId, false);
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var response = await _client.From<Event>()
                    .Where(e => e.EventId == eventId && e.OwnerId == userId)
                    .Get();

                if (response.Models.Count == 0)
                    return NotFound();

                await _client.From<Event>().Where(e => e.EventId == eventId).Delete();
                await _SupMan.DeleteEventMedia(eventId);

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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
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

                var newStatus = SupportManager.ToEnumStatus(dto.Status ?? "В процессе");
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

                await _SupMan.ClearDraft(eventId, "general");

                var details = await _SupMan.LoadDetails(eventId, userId, false);
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (!await _SupMan.IsOwner(eventId, userId))
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

                await _SupMan.ClearDraft(eventId, "form");

                var details = await _SupMan.LoadDetails(eventId, userId, false);
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (!await _SupMan.IsOwner(eventId, userId))
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

                await _SupMan.ClearDraft(eventId, "results");

                var details = await _SupMan.LoadDetails(eventId, userId, false);
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await _SupMan.GetViewableEvent(eventId, userId);
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

                return Ok(new { success = true, ratingCount = await _SupMan.GetRatingCount(eventId) });
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var rating = await _client.From<EventRating>()
                    .Where(r => r.EventId == eventId && r.UserId == userId)
                    .Get();
                if (rating.Models.Count == 0)
                    return NotFound(new { message = "Оценка не найдена" });

                await _client.From<EventRating>()
                    .Where(r => r.EventId == eventId && r.UserId == userId)
                    .Delete();

                return Ok(new { success = true, ratingCount = await _SupMan.GetRatingCount(eventId) });
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var app = await _SupMan.FindMyApplication(eventId, userId);
                return app == null ? NoContent() : Ok(Mappers.ToApplicationMine(app));
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await _SupMan.GetViewableEvent(eventId, userId);
                if (ev == null) return NotFound();

                if (ev.OwnerId == userId)
                    return BadRequest(new { message = "Нельзя подать заявку на собственное мероприятие" });

                var state = SupportManager.GetRegistrationState(ev);
                if (state != "open")
                    return BadRequest(new { message = state == "upcoming" ? "Регистрация ещё не началась" : "Регистрация закрыта" });

                if (await _SupMan.FindMyApplication(eventId, userId) != null)
                    return BadRequest(new { message = "Вы уже подали заявку на это мероприятие" });

                var membership = await _client.From<EventMember>()
                    .Where(m => m.EventId == eventId && m.UserId == userId)
                    .Get();
                if (membership.Models.Count > 0)
                    return BadRequest(new { message = "Вы уже участник этого мероприятия" });

                if (await _SupMan.IsLimitReached(ev))
                    return BadRequest(new { message = "Достигнут лимит участников" });

                var inputs = dto.Answers ?? [];
                var error = Validator.ValidateEventApplication(inputs, SupportManager.ParseFormFields(ev.ApplicationForm));
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                var now = DateTime.UtcNow;
                var response = await _client.From<EventApplication>().Insert(new EventApplication
                {
                    EventId = eventId,
                    UserId = userId,
                    Status = "pending",
                    Answers = JsonSerializer.Serialize(SupportManager.BuildAnswers(ev, inputs)),
                    CreatedAt = now,
                    UpdatedAt = now
                });

                var created = response.Models.FirstOrDefault();
                if (created == null)
                    return BadRequest(new { message = "Не удалось отправить заявку" });

                return Ok(Mappers.ToApplicationMine(created));
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var app = await _SupMan.FindMyApplication(eventId, userId);
                if (app == null) return NotFound();

                if (app.Status != "revision" && app.Status != "rejected")
                    return BadRequest(new { message = "Заявку можно изменить после запроса доработки или отказа" });

                var ev = await _SupMan.GetViewableEvent(eventId, userId);
                if (ev == null) return NotFound();

                if (app.Status == "rejected")
                {
                    if (SupportManager.GetRegistrationState(ev) != "open")
                        return BadRequest(new { message = "Приём заявок завершён" });
                    if (await _SupMan.IsLimitReached(ev))
                        return BadRequest(new { message = "Достигнут лимит участников" });
                }

                var inputs = dto.Answers ?? [];
                var error = Validator.ValidateEventApplication(inputs, SupportManager.ParseFormFields(ev.ApplicationForm));
                if (error != null)
                    return BadRequest(new { message = error });

                await _SupMan.UpdateLastOnlineAsync(userId);

                await _client.From<EventApplication>()
                    .Where(a => a.ApplicationId == app.ApplicationId)
                    .Set(a => a.Answers, JsonSerializer.Serialize(SupportManager.BuildAnswers(ev, inputs)))
                    .Set(a => a.Status, "pending")
                    .Set(a => a.DecisionComment!, null)
                    .Set(a => a.UpdatedAt!, DateTime.UtcNow)
                    .Update();

                var updated = await _SupMan.FindMyApplication(eventId, userId);
                return updated == null ? NotFound() : Ok(Mappers.ToApplicationMine(updated));
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var app = await _SupMan.FindMyApplication(eventId, userId);
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await _SupMan.IsOwner(eventId, userId)) return NotFound();

                var response = await _client.From<EventApplication>()
                    .Where(a => a.EventId == eventId && a.Status != "rejected")
                    .Get();

                var users = new Dictionary<string, User?>();
                var result = new List<object>();

                foreach (var app in response.Models.OrderByDescending(a => a.CreatedAt))
                {
                    if (!users.TryGetValue(app.UserId, out var applicant))
                    {
                        applicant = await _SupMan.GetUserAsync(app.UserId);
                        users[app.UserId] = applicant;
                    }
                    if (applicant == null) continue;

                    result.Add(Mappers.ToApplicationListItem(app, applicant));
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await _SupMan.GetOwnedEvent(eventId, userId);
                if (ev == null) return NotFound();

                var detail = await _SupMan.LoadApplicationDetail(ev, applicationId);
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var ev = await _SupMan.GetOwnedEvent(eventId, userId);
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
                    var applicant = await _SupMan.GetUserAsync(app.UserId);
                    if (applicant == null) return NotFound();
                    if (applicant.IsBanned)
                        return BadRequest(new { message = "Нельзя принять заблокированного пользователя" });

                    var existing = await _client.From<EventMember>()
                        .Where(m => m.EventId == eventId && m.UserId == app.UserId)
                        .Get();

                    if (existing.Models.Count == 0)
                    {
                        if (await _SupMan.IsLimitReached(ev))
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

                var detail = await _SupMan.LoadApplicationDetail(ev, applicationId);
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await _SupMan.IsOwner(eventId, userId)) return NotFound();

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
                        size = SupportManager.GetFileSize(f),
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
        [RequestSizeLimit(Limits.Upload.MediaRequestBytes)]
        public async Task<IActionResult> UploadMedia(string eventId, string section, [FromForm] IFormFile file)
        {
            try
            {
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await _SupMan.IsOwner(eventId, userId)) return Forbid();

                var sectionError = Validator.ValidateEventMediaSection(section);
                if (sectionError != null) return BadRequest(new { message = sectionError });

                var (imageError, extension) = Validator.ValidateEventImage(file);
                if (imageError != null) return BadRequest(new { message = imageError });

                var folder = $"{eventId}/{section}";

                var existing = await _client.Storage.From("EventMedia").List(folder);
                var currentTotal = (existing ?? []).Sum(SupportManager.GetFileSize);
                if (currentTotal + file.Length > Limits.Upload.MediaTotalMaxBytes)
                    return BadRequest(new { message = $"Общий размер вложений не должен превышать {Limits.Upload.MediaTotalMaxBytes / Limits.MB} МБ" });

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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await _SupMan.IsOwner(eventId, userId)) return Forbid();

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
                var currentUserId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(currentUserId))
                    return Unauthorized();

                var currentRole = await _SupMan.GetRoleAsync(currentUserId);
                if (currentRole != Roles.Moderator && currentRole != Roles.Admin)
                    return Forbid();

                var response = await _client.From<Event>().Where(e => e.EventId == eventId).Get();
                var ev = response.Models.FirstOrDefault();
                if (ev == null || ev.IsPrivate)
                    return NotFound();

                var ownerRole = await _SupMan.GetRoleAsync(ev.OwnerId);
                if (currentRole == Roles.Moderator && (ownerRole ?? Roles.User) != Roles.User)
                    return Forbid();

                var reason = string.IsNullOrWhiteSpace(dto.Reason) ? "не указана" : dto.Reason.Trim();

                await _client.From<Event>().Where(e => e.EventId == eventId).Delete();
                await _SupMan.DeleteEventMedia(eventId);

                await _SupMan.SendNotificationAsync(ev.OwnerId, "system", eventId, "event_deleted_by_moderator", new Dictionary<string, object>
                {
                    { "eventName", ev.Title },
                    { "reason", reason }
                });

                await _SupMan.SendNotificationAsync(currentUserId, "system", eventId, "moderator_deleted_event", new Dictionary<string, object>
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await _SupMan.IsOwner(eventId, userId)) return NotFound();

                var response = await _client.From<EventDraft>().Where(d => d.EventId == eventId).Get();
                var draft = response.Models.FirstOrDefault();

                return Ok(new
                {
                    general = SupportManager.ParseDraft(draft?.General),
                    form = SupportManager.ParseDraft(draft?.Form),
                    results = SupportManager.ParseDraft(draft?.Results)
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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await _SupMan.IsOwner(eventId, userId)) return NotFound();

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
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId)) return Unauthorized();
                if (!await _SupMan.IsOwner(eventId, userId)) return NotFound();

                var error = Validator.ValidateEventDraftSection(section);
                if (error != null) return BadRequest(new { message = error });

                await _SupMan.ClearDraft(eventId, section);
                return Ok(new { message = "Черновик отменён" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
    }
}