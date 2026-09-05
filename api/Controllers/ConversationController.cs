using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
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

        // Получить список переписок пользователя
        [HttpGet]
        public async Task<IActionResult> GetConversations()
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var participations = await _client.From<ConversationParticipant>()
                    .Where(p => p.UserId == userId)
                    .Get();

                var result = new List<object>();

                var hiddenForUser = await _client.From<MessageHiddenForUser>()
                    .Where(h => h.UserId == userId)
                    .Get();
                var hiddenIds = hiddenForUser.Models.Select(h => h.MessageId).ToHashSet();

                foreach (var participation in participations.Models)
                {
                    var convResponse = await _client.From<Conversation>()
                        .Where(c => c.ConversationId == participation.ConversationId)
                        .Get();
                    var conv = convResponse.Models.FirstOrDefault();
                    if (conv == null) continue;

                    var allMessages = await _client.From<Message>()
                        .Where(m => m.ConversationId == conv.ConversationId)
                        .Order(m => m.CreatedAt!, Ordering.Descending)
                        .Get();

                    var last = allMessages.Models.FirstOrDefault(m => !hiddenIds.Contains(m.MessageId));

                    if (last == null) continue;

                    var otherUserId = conv.UserOneId == userId ? conv.UserTwoId : conv.UserOneId;
                    var otherUser = await _client.From<User>().Where(u => u.UserId == otherUserId).Get();
                    var otherUserData = otherUser.Models.FirstOrDefault();

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
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Начать новую переписку с пользователем
        [HttpPost("start")]
        public async Task<IActionResult> StartConversation([FromBody] StartConversationDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (dto.TargetUserId == userId)
                    return BadRequest(new { message = "Нельзя начать переписку с самим собой" });

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

                await EnsureParticipant(conv.ConversationId, userId);
                await EnsureParticipant(conv.ConversationId, dto.TargetUserId);

                return Ok(new { conversationId = conv.ConversationId });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Убедиться, что пользователь является участником переписки
        private async Task EnsureParticipant(string conversationId, string participantUserId)
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
            catch
            {

            }
        }

        // Получить сообщения
        [HttpGet("{conversationId}/messages")]
        public async Task<IActionResult> GetMessages(string conversationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var conv = await _client.From<Conversation>()
                    .Where(c => c.ConversationId == conversationId)
                    .Get();
                var conversation = conv.Models.FirstOrDefault();
                if (conversation == null) return NotFound();

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

                var result = new List<object>();
                foreach (var m in messages.Models)
                {
                    if (hiddenIds.Contains(m.MessageId)) continue;

                    string? nickname = null, avatarUrl = null;
                    if (!string.IsNullOrEmpty(m.SenderId))
                    {
                        var sender = await _client.From<User>().Where(u => u.UserId == m.SenderId).Get();
                        var senderData = sender.Models.FirstOrDefault();
                        nickname = senderData?.Nickname;
                        avatarUrl = senderData?.AvatarUrl;
                    }

                    string? parentContent = null, parentNickname = null;
                    if (!string.IsNullOrEmpty(m.ParentMessageId))
                    {
                        var parent = await _client.From<Message>().Where(p => p.MessageId == m.ParentMessageId).Get();
                        var parentMsg = parent.Models.FirstOrDefault();
                        if (parentMsg != null && !parentMsg.IsDeleted)
                        {
                            parentContent = parentMsg.Content;
                            var parentSender = await _client.From<User>().Where(u => u.UserId == parentMsg.SenderId).Get();
                            parentNickname = parentSender.Models.FirstOrDefault()?.Nickname;
                        }
                    }

                    result.Add(new
                    {
                        m.MessageId,
                        m.SenderId,
                        Nickname = nickname,
                        AvatarUrl = avatarUrl,
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

                await _client.From<ConversationParticipant>()
                    .Where(p => p.ConversationId == conversationId && p.UserId == userId)
                    .Set(p => p.LastReadAt!, DateTime.UtcNow)
                    .Update();

                return Ok(new
                {
                    messages = result,
                    previousLastReadAt = previousLastReadAt?.ToString("o"),
                    otherLastReadAt = otherLastReadAt?.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Отправить сообщение
        [HttpPost("message")]
        public async Task<IActionResult> SendMessage([FromBody] SendMessageDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (string.IsNullOrWhiteSpace(dto.Content))
                    return BadRequest(new { message = "Сообщение не может быть пустым" });

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
                    CreatedAt = newMessage.CreatedAt?.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Отредактировать сообщение
        [HttpPut("message/{messageId}")]
        public async Task<IActionResult> UpdateMessage(string messageId, [FromBody] UpdateMessageDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (string.IsNullOrWhiteSpace(dto.Content))
                    return BadRequest(new { message = "Сообщение не может быть пустым" });

                var response = await _client.From<Message>()
                    .Where(m => m.MessageId == messageId && m.SenderId == userId)
                    .Get();

                if (response.Models.Count == 0)
                    return NotFound();

                await _client.From<Message>()
                    .Where(m => m.MessageId == messageId)
                    .Set(m => m.Content!, dto.Content)
                    .Set(m => m.IsEdited, true)
                    .Set(m => m.UpdatedAt!, DateTime.UtcNow)
                    .Update();

                return Ok(new { message = "Сообщение обновлено" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Закрепить/открепить переписку
        [HttpPut("{conversationId}/pin")]
        public async Task<IActionResult> TogglePin(string conversationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
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
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить сообщение (только для отправителя)
        [HttpDelete("message/{messageId}")]
        public async Task<IActionResult> DeleteMessage(string messageId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
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
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить переписку
        [HttpDelete("{conversationId}")]
        public async Task<IActionResult> HideConversation(string conversationId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

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

                return Ok(new { message = "Переписка удалена" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить сообщение только для себя
        [HttpDelete("message/{messageId}/for-me")]
        public async Task<IActionResult> DeleteMessageForMe(string messageId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                await _client.From<MessageHiddenForUser>().Insert(
                    new MessageHiddenForUser { MessageId = messageId, UserId = userId },
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });

                return Ok(new { message = "Сообщение скрыто" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Переслать сообщение
        [HttpPost("message/forward")]
        public async Task<IActionResult> ForwardMessage([FromBody] ForwardMessageDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var source = await _client.From<Message>().Where(m => m.MessageId == dto.SourceMessageId).Get();
                var sourceMsg = source.Models.FirstOrDefault();
                if (sourceMsg == null || sourceMsg.IsDeleted)
                    return NotFound();

                var originalNickname = sourceMsg.ForwardedFromNickname;
                if (string.IsNullOrEmpty(originalNickname) && !string.IsNullOrEmpty(sourceMsg.SenderId))
                {
                    var sender = await _client.From<User>().Where(u => u.UserId == sourceMsg.SenderId).Get();
                    originalNickname = sender.Models.FirstOrDefault()?.Nickname;
                }

                var newMessage = new Message
                {
                    MessageId = Guid.NewGuid().ToString(),
                    ConversationId = dto.TargetConversationId,
                    SenderId = userId,
                    Content = sourceMsg.Content,
                    IsForwarded = true,
                    ForwardedFromNickname = originalNickname,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<Message>().Insert(newMessage, new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });

                await _client.From<Conversation>()
                    .Where(c => c.ConversationId == dto.TargetConversationId)
                    .Set(c => c.LastMessageAt!, DateTime.UtcNow)
                    .Update();

                return Ok(new { message = "Сообщение переслано" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}