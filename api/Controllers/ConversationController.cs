using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Supabase.Postgrest;
using static Supabase.Postgrest.Constants;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ConversationController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        private async Task<Conversation?> GetMyConversation(string conversationId, string userId)
        {
            var c = (await _client.From<Conversation>().Where(x => x.ConversationId == conversationId).Get())
                .Models.FirstOrDefault();
            return c != null && (c.UserOneId == userId || c.UserTwoId == userId) ? c : null;
        }

        // Получить список переписок пользователя
        [HttpGet]
        public async Task<IActionResult> GetConversations()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var participations = await _client.From<ConversationParticipant>()
                    .Where(p => p.UserId == userId)
                    .Get();

                var convIds = participations.Models.Select(p => p.ConversationId).ToList();
                if (convIds.Count == 0) return Ok(new List<object>());

                var convs = (await _client.From<Conversation>()
                    .Filter("conversation_id", Constants.Operator.In, convIds).Get())
                    .Models.ToDictionary(c => c.ConversationId);

                var users = (await _SupMan.GetAllUsersAsync())
                    .Where(u => u.UserId != null).ToDictionary(u => u.UserId!);

                var hiddenForUser = await _client.From<MessageHiddenForUser>().Where(h => h.UserId == userId).Get();
                var hiddenIds = hiddenForUser.Models.Select(h => h.MessageId).ToHashSet();

                var result = new List<object>();
                foreach (var participation in participations.Models)
                {
                    if (!convs.TryGetValue(participation.ConversationId, out var conv)) continue;

                    var recent = await _client.From<Message>()
                        .Where(m => m.ConversationId == conv.ConversationId)
                        .Order(m => m.CreatedAt!, Ordering.Descending)
                        .Limit(30)
                        .Get();
                    var last = recent.Models.FirstOrDefault(m => !hiddenIds.Contains(m.MessageId));
                    if (last == null) continue;

                    var otherUserId = conv.UserOneId == userId ? conv.UserTwoId : conv.UserOneId;
                    users.TryGetValue(otherUserId, out var otherUserData);

                    result.Add(new
                    {
                        conv.ConversationId,
                        OtherUserId = otherUserId,
                        OtherUserNickname = otherUserData?.Nickname,
                        OtherUserAvatarUrl = otherUserData?.AvatarUrl,
                        participation.IsPinned,
                        LastMessage = last.IsDeleted ? "Сообщение удалено" : last.Content,
                        LastMessageAt = last.CreatedAt?.ToString("o"),
                        HasUnread = participation.LastReadAt == null ||
                                    (last.CreatedAt != null && last.CreatedAt > participation.LastReadAt)
                    });
                }

                return Ok(result.OrderByDescending(r => ((dynamic)r).IsPinned)
                                 .ThenByDescending(r => ((dynamic)r).LastMessageAt));
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Начать новую переписку с пользователем
        [HttpPost("start")]
        [EnableRateLimiting("write")]
        public async Task<IActionResult> StartConversation([FromBody] StartConversationDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (dto.TargetUserId == userId)
                    return BadRequest(new { message = "Нельзя начать переписку с самим собой" });

                var target = await _SupMan.GetAccessAsync(dto.TargetUserId);
                if (!target.Exists || (target.IsBanned && !await _SupMan.IsStaffAsync(userId)))
                    return NotFound();
                if (await _SupMan.IsBlockedBetweenAsync(userId, dto.TargetUserId))
                    return BadRequest(new { message = "Невозможно написать этому пользователю" });

                var (userOneId, userTwoId) = string.CompareOrdinal(userId, dto.TargetUserId) < 0
                    ? (userId, dto.TargetUserId)
                    : (dto.TargetUserId, userId);

                var existing = await _client.From<Conversation>()
                    .Where(c => c.UserOneId == userOneId && c.UserTwoId == userTwoId)
                    .Get();

                var conv = existing.Models.FirstOrDefault();

                if (conv == null)
                {
                    var newConv = new Conversation
                    {
                        UserOneId = userOneId,
                        UserTwoId = userTwoId,
                        CreatedAt = DateTime.UtcNow
                    };

                    var insertResponse = await _client.From<Conversation>().Insert(newConv);
                    conv = insertResponse.Models.FirstOrDefault();

                    if (conv == null)
                    {
                        return StatusCode(500, "Не удалось создать переписку");
                    }
                }

                await _SupMan.EnsureParticipant(conv.ConversationId, userId);
                await _SupMan.EnsureParticipant(conv.ConversationId, dto.TargetUserId);

                return Ok(new { conversationId = conv.ConversationId });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Получить сообщения
        [HttpGet("{conversationId}/messages")]
        public async Task<IActionResult> GetMessages(string conversationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var conv = await _client.From<Conversation>()
                    .Where(c => c.ConversationId == conversationId)
                    .Get();
                var conversation = conv.Models.FirstOrDefault();
                if (conversation == null)
                    return NotFound();

                if (conversation.UserOneId != userId && conversation.UserTwoId != userId)
                    return Forbid();

                var otherUserId = conversation.UserOneId == userId ? conversation.UserTwoId : conversation.UserOneId;

                var myParticipation = await _client.From<ConversationParticipant>()
                    .Where(p => p.ConversationId == conversationId && p.UserId == userId)
                    .Get();
                var previousLastReadAt = myParticipation.Models.FirstOrDefault()?.LastReadAt;

                var otherParticipation = await _client.From<ConversationParticipant>()
                    .Where(p => p.ConversationId == conversationId && p.UserId == otherUserId)
                    .Get();
                var otherLastReadAt = otherParticipation.Models.FirstOrDefault()?.LastReadAt;

                var hidden = await _client.From<MessageHiddenForUser>()
                    .Where(h => h.UserId == userId)
                    .Get();
                var hiddenIds = hidden.Models.Select(h => h.MessageId).ToHashSet();

                var messages = await _client.From<Message>()
                    .Where(m => m.ConversationId == conversationId)
                    .Order(m => m.CreatedAt!, Ordering.Ascending)
                    .Get();

                if (conversation.UserOneId != userId && conversation.UserTwoId != userId)
                    return Forbid();

                var users = (await _SupMan.GetAllUsersAsync())
                    .Where(u => u.UserId != null).ToDictionary(u => u.UserId!);

                var byId = messages.Models.ToDictionary(m => m.MessageId);
                var missingParents = messages.Models
                    .Where(m => m.ParentMessageId != null && !byId.ContainsKey(m.ParentMessageId))
                    .Select(m => m.ParentMessageId!).Distinct().ToList();
                if (missingParents.Count > 0)
                {
                    var extra = await _client.From<Message>()
                        .Filter("message_id", Constants.Operator.In, missingParents).Get();
                    foreach (var p in extra.Models) byId[p.MessageId] = p;
                }

                var result = new List<object>();
                foreach (var m in messages.Models)
                {
                    if (hiddenIds.Contains(m.MessageId)) continue;

                    users.TryGetValue(m.SenderId ?? "", out var senderData);

                    string? parentContent = null, parentNickname = null;
                    if (!string.IsNullOrEmpty(m.ParentMessageId) && byId.TryGetValue(m.ParentMessageId, out var parentMsg) && !parentMsg.IsDeleted)
                    {
                        parentContent = parentMsg.Content;
                        parentNickname = users.GetValueOrDefault(parentMsg.SenderId ?? "")?.Nickname;
                    }

                    result.Add(new
                    {
                        m.MessageId,
                        m.SenderId,
                        senderData?.Nickname,
                        senderData?.AvatarUrl,
                        Content = m.IsDeleted ? null : m.Content,
                        m.IsEdited,
                        m.IsDeleted,
                        m.ParentMessageId,
                        ParentContent = parentContent,
                        ParentNickname = parentNickname,
                        m.IsForwarded,
                        m.ForwardedFromNickname,
                        CreatedAt = m.CreatedAt?.ToString("o"),
                        UpdatedAt = m.UpdatedAt?.ToString("o")
                    });
                }

                var newestIncoming = messages.Models.LastOrDefault(m => m.SenderId != userId)?.CreatedAt;
                if (newestIncoming != null && (previousLastReadAt == null || newestIncoming > previousLastReadAt))
                {
                    await _client.From<ConversationParticipant>()
                        .Where(p => p.ConversationId == conversationId && p.UserId == userId)
                        .Set(p => p.LastReadAt!, DateTime.UtcNow)
                        .Update();
                }

                return Ok(new
                {
                    messages = result,
                    previousLastReadAt = previousLastReadAt?.ToString("o"),
                    otherLastReadAt = otherLastReadAt?.ToString("o")
                });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Отправить сообщение
        [HttpPost("message")]
        [EnableRateLimiting("write")]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var conv = await GetMyConversation(dto.ConversationId, userId);
                if (conv == null)
                    return NotFound(new { message = "Переписка не найдена" });

                var otherId = conv.UserOneId == userId ? conv.UserTwoId : conv.UserOneId;
                var other = await _SupMan.GetAccessAsync(otherId);
                if (!other.Exists || (other.IsBanned && !await _SupMan.IsStaffAsync(userId)))
                    return BadRequest(new { message = "Пользователь недоступен" });
                if (await _SupMan.IsBlockedBetweenAsync(userId, otherId))
                    return BadRequest(new { message = "Невозможно отправить сообщение этому пользователю" });

                if (!string.IsNullOrEmpty(dto.ParentMessageId))
                {
                    var parent = await _client.From<Message>()
                        .Where(m => m.MessageId == dto.ParentMessageId && m.ConversationId == dto.ConversationId)
                        .Get();

                    if (parent.Models.Count == 0)
                        return BadRequest(new { message = "Исходное сообщение не найдено в этой переписке" });
                }

                var error = Validator.ValidateChatMessage(dto.Content);
                if (error != null)
                    return BadRequest(new { message = error });

                var newMessage = new Message
                {
                    MessageId = Guid.NewGuid().ToString(),
                    ConversationId = dto.ConversationId,
                    SenderId = userId,
                    Content = dto.Content,
                    ParentMessageId = dto.ParentMessageId,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<Message>().Insert(newMessage);

                var now = DateTime.UtcNow;

                await _client.From<Conversation>()
                    .Where(c => c.ConversationId == dto.ConversationId)
                    .Set(c => c.LastMessageAt!, now)
                    .Update();

                await _client.From<ConversationParticipant>()
                    .Where(p => p.ConversationId == dto.ConversationId && p.UserId == userId)
                    .Set(p => p.LastReadAt!, now)
                    .Set(p => p.HiddenAt!, null)
                    .Update();

                return Ok(new
                {
                    newMessage.MessageId,
                    newMessage.SenderId,
                    newMessage.Content,
                    newMessage.ParentMessageId,
                    CreatedAt = newMessage.CreatedAt?.ToString("o")
                });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Отредактировать сообщение
        [HttpPut("message/{messageId}")]
        public async Task<IActionResult> UpdateMessage(string messageId, [FromBody] UpdateMessageDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var error = Validator.ValidateChatMessage(dto.Content);
                if (error != null)
                    return BadRequest(new { message = error });

                if (string.IsNullOrWhiteSpace(dto.Content))
                    return BadRequest(new { message = "Сообщение не может быть пустым" });

                var response = await _client.From<Message>()
                    .Where(m => m.MessageId == messageId && m.SenderId == userId)
                    .Get();

                var existing = response.Models.FirstOrDefault();
                if (existing == null || existing.IsDeleted)
                    return NotFound();
                if (await GetMyConversation(existing.ConversationId, userId) == null)
                    return NotFound();

                await _client.From<Message>()
                    .Where(m => m.MessageId == messageId)
                    .Set(m => m.Content!, dto.Content)
                    .Set(m => m.IsEdited, true)
                    .Set(m => m.UpdatedAt!, DateTime.UtcNow)
                    .Update();

                return Ok(new { message = "Сообщение обновлено" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Закрепить/открепить переписку
        [HttpPut("{conversationId}/pin")]
        public async Task<IActionResult> TogglePin(string conversationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var participation = await _client.From<ConversationParticipant>()
                    .Where(p => p.ConversationId == conversationId && p.UserId == userId)
                    .Get();

                var p = participation.Models.FirstOrDefault();
                if (p == null) return NotFound();

                await _client.From<ConversationParticipant>()
                    .Where(cp => cp.ConversationId == conversationId && cp.UserId == userId)
                    .Set(cp => cp.IsPinned, !p.IsPinned)
                    .Update();

                return Ok(new { isPinned = !p.IsPinned });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить сообщение (только для отправителя)
        [HttpDelete("message/{messageId}")]
        public async Task<IActionResult> DeleteMessage(string messageId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var response = await _client.From<Message>()
                    .Where(m => m.MessageId == messageId && m.SenderId == userId)
                    .Get();

                if (response.Models.Count == 0)
                    return NotFound();

                await _client.From<Message>()
                    .Where(m => m.MessageId == messageId)
                    .Delete();

                return Ok(new { message = "Сообщение удалено" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить (скрыть) переписку
        [HttpDelete("{conversationId}")]
        public async Task<IActionResult> HideConversation(string conversationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (await GetMyConversation(conversationId, userId) == null)
                    return NotFound(new { message = "Переписка не найдена или у вас нет прав" });

                var now = DateTime.UtcNow;

                await _client.From<ConversationParticipant>()
                    .Where(p => p.ConversationId == conversationId && p.UserId == userId)
                    .Set(p => p.HiddenAt!, now)
                    .Update();

                var existingMessages = await _client.From<Message>()
                    .Where(m => m.ConversationId == conversationId)
                    .Get();

                foreach (var msg in existingMessages.Models)
                {
                    try
                    {
                        await _client.From<MessageHiddenForUser>().Insert(
                            new MessageHiddenForUser { MessageId = msg.MessageId, UserId = userId },
                            new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
                    }
                    catch
                    {

                    }
                }

                return Ok(new { message = "Переписка скрыта" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить сообщение только для себя
        [HttpDelete("message/{messageId}/for-me")]
        public async Task<IActionResult> DeleteMessageForMe(string messageId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var msgResponse = await _client.From<Message>()
                    .Where(m => m.MessageId == messageId)
                    .Get();

                var message = msgResponse.Models.FirstOrDefault();
                if (message == null)
                    return NotFound(new { message = "Сообщение не найдено" });

                var conv = await GetMyConversation(message.ConversationId, userId);
                if (conv == null)
                    return Forbid();

                await _client.From<MessageHiddenForUser>().Upsert(
                    new MessageHiddenForUser { MessageId = messageId, UserId = userId },
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });

                return Ok(new { message = "Сообщение скрыто" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Переслать сообщение
        [HttpPost("message/{messageId}/forward")]
        [EnableRateLimiting("write")]
        public async Task<IActionResult> ForwardMessage(string messageId, [FromBody] ForwardMessageDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var sourceMsgResponse = await _client.From<Message>()
                    .Where(m => m.MessageId == messageId)
                    .Get();

                var sourceMsg = sourceMsgResponse.Models.FirstOrDefault();
                if (sourceMsg == null || sourceMsg.IsDeleted)
                    return NotFound(new { message = "Сообщение не найдено или удалено" });

                if (await GetMyConversation(sourceMsg.ConversationId, userId) == null)
                    return Forbid();

                if (await GetMyConversation(dto.TargetConversationId, userId) == null)
                    return Forbid();

                var error = Validator.ValidateChatMessage(sourceMsg.Content);
                if (error != null)
                    return BadRequest(new { message = error });

                var newMessage = new Message
                {
                    MessageId = Guid.NewGuid().ToString(),
                    ConversationId = dto.TargetConversationId,
                    SenderId = userId,
                    Content = sourceMsg.Content,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<Message>().Insert(newMessage);

                var now = DateTime.UtcNow;

                await _client.From<Conversation>()
                    .Where(c => c.ConversationId == dto.TargetConversationId)
                    .Set(c => c.LastMessageAt!, now)
                    .Update();

                await _client.From<ConversationParticipant>()
                    .Where(p => p.ConversationId == dto.TargetConversationId && p.UserId == userId)
                    .Set(p => p.LastReadAt!, now)
                    .Set(p => p.HiddenAt!, null)
                    .Update();

                return Ok(new
                {
                    newMessage.MessageId,
                    newMessage.ConversationId,
                    newMessage.SenderId,
                    newMessage.Content,
                    CreatedAt = newMessage.CreatedAt?.ToString("o")
                });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}