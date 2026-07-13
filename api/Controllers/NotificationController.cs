using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using Supabase.Postgrest;
using System.Text.Json;
using static Supabase.Postgrest.Constants;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        private static Dictionary<string, object?> ExtractContextData(object? contextData)
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

        private static object? ExtractValueFromJsonElement(JsonElement element)
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

        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] string? referenceType)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var query = _client.From<Notification>()
                    .Where(n => n.UserId == userId)
                    .Order(n => n.CreatedAt, Ordering.Descending);

                if (!string.IsNullOrEmpty(referenceType))
                {
                    query = query.Where(n => n.ReferenceType == referenceType);
                }

                var notifications = await query.Get();

                var result = notifications.Models.Select(n => new
                {
                    n.NotificationId,
                    n.UserId,
                    n.ReferenceId,
                    n.ReferenceType,
                    ContextData = ExtractContextData(n.ContextData),
                    n.IsRead,
                    CreatedAt = n.CreatedAt.ToString("o")
                }).ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        [HttpPut("{notificationId}/read")]
        public async Task<IActionResult> MarkAsRead(string notificationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var notification = await _client.From<Notification>()
                    .Where(n => n.NotificationId == notificationId && n.UserId == userId)
                    .Get();

                if (notification.Models.Count == 0)
                    return NotFound("Уведомление не найдено");

                await _client.From<Notification>()
                    .Where(n => n.NotificationId == notificationId)
                    .Set(n => n.IsRead, true)
                    .Update();

                return Ok(new { message = "Уведомление отмечено как прочитанное" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpPut("mark-all-read")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var notifications = await _client.From<Notification>()
                    .Where(n => n.UserId == userId && n.IsRead == false)
                    .Get();

                foreach (var notification in notifications.Models)
                {
                    await _client.From<Notification>()
                        .Where(n => n.NotificationId == notification.NotificationId)
                        .Set(n => n.IsRead, true)
                        .Update();
                }

                return Ok(new { message = "Все уведомления отмечены как прочитанные" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateNotification([FromBody] CreateNotificationDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var contextDataJson = JsonSerializer.Serialize(
                    dto.ContextData,
                    Support.JsonOptions.Default
                );

                var newNotification = new Notification
                {
                    NotificationId = Guid.NewGuid().ToString(),
                    UserId = dto.UserId,
                    ReferenceId = dto.ReferenceId,
                    ReferenceType = dto.ReferenceType,
                    ContextData = contextDataJson,
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<Notification>().Insert(
                    newNotification,
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal }
                );

                return Ok(new
                {
                    newNotification.NotificationId,
                    newNotification.UserId,
                    newNotification.ReferenceId,
                    newNotification.ReferenceType,
                    ContextData = ExtractContextData(newNotification.ContextData),
                    newNotification.IsRead,
                    CreatedAt = newNotification.CreatedAt.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        [HttpDelete("{notificationId}")]
        public async Task<IActionResult> DeleteNotification(string notificationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _SupMan.UpdateLastOnlineAsync(userId);

                var notification = await _client.From<Notification>()
                    .Where(n => n.NotificationId == notificationId && n.UserId == userId)
                    .Get();

                if (notification.Models.Count == 0)
                    return NotFound("Уведомление не найдено");

                await _client.From<Notification>()
                    .Where(n => n.NotificationId == notificationId)
                    .Delete();

                return Ok(new { message = "Уведомление удалено" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }
    }
}