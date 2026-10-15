using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
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

        // Получить уведомления
        [HttpGet]
        public async Task<IActionResult> GetNotifications([FromQuery] string? referenceType)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
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
                    ContextData = SupportManager.ExtractContextData(n.ContextData),
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

        // Прочитать уведомление
        [HttpPut("{notificationId}/read")]
        public async Task<IActionResult> MarkAsRead(string notificationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
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

        // Пометить все, как прочитанные
        [HttpPut("mark-all-read")]
        public async Task<IActionResult> MarkAllAsRead()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
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

        // Создать уведомление
        [HttpPost]
        public async Task<IActionResult> CreateNotification([FromBody] CreateNotificationDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
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
                    ContextData = SupportManager.ExtractContextData(newNotification.ContextData),
                    newNotification.IsRead,
                    CreatedAt = newNotification.CreatedAt.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = ex.Message });
            }
        }

        // Удалить уведомление
        [HttpDelete("{notificationId}")]
        public async Task<IActionResult> DeleteNotification(string notificationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
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