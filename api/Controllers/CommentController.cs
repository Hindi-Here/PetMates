using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase.Postgrest;
using System.Text.RegularExpressions;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public partial class CommentController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Получить комментарии
        [HttpGet("{referenceType}/{referenceId}")]
        public async Task<IActionResult> GetComments(string referenceType, string referenceId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (!string.IsNullOrEmpty(userId))
                {
                    await _SupMan.UpdateLastOnlineAsync(userId);
                }

                var comments = await _client.From<Comment>()
                    .Where(c => c.ReferenceType == referenceType && c.ReferenceId == referenceId)
                    .Order(c => c.CreatedAt!, Constants.Ordering.Ascending)
                    .Get();

                var result = new List<object>();
                foreach (var c in comments.Models)
                {
                    string? nickname = null;
                    string? avatarUrl = null;
                    string? authorSystemRole = null;
                    if (!string.IsNullOrEmpty(c.UserId))
                    {
                        var user = await _client.From<User>()
                            .Where(u => u.UserId == c.UserId)
                            .Get();
                        var userData = user.Models.FirstOrDefault();
                        nickname = userData?.Nickname;
                        avatarUrl = userData?.AvatarUrl;
                        authorSystemRole = userData?.SystemRole;
                    }

                    result.Add(new
                    {
                        c.CommentId,
                        c.UserId,
                        Nickname = nickname,
                        AvatarUrl = avatarUrl,
                        c.ParentCommentId,
                        Content = c.IsDeleted ? null : c.Content,
                        AuthorSystemRole = authorSystemRole,
                        c.IsEdited,
                        c.IsDeleted,
                        c.DeletedByModerator,
                        CreatedAt = c.CreatedAt?.ToString("o"),
                        UpdatedAt = c.UpdatedAt?.ToString("o")
                    });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Отправить комментарий
        [HttpPost]
        public async Task<IActionResult> CreateComment([FromBody] CreateCommentDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (string.IsNullOrWhiteSpace(dto.Content))
                    return BadRequest(new { message = "Комментарий не может быть пустым" });

                await _SupMan.UpdateLastOnlineAsync(userId);

                if (!await CanAccessReference(dto.ReferenceType, dto.ReferenceId, userId))
                    return NotFound();

                var newComment = new Comment
                {
                    CommentId = Guid.NewGuid().ToString(),
                    ReferenceId = dto.ReferenceId,
                    ReferenceType = dto.ReferenceType,
                    UserId = userId,
                    ParentCommentId = dto.ParentCommentId,
                    Content = dto.Content,
                    IsEdited = false,
                    IsDeleted = false,
                    DeletedByModerator = false,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<Comment>().Insert(
                    newComment,
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal }
                );

                await ProcessMentions(newComment, userId);

                return Ok(new
                {
                    newComment.CommentId,
                    newComment.UserId,
                    newComment.ParentCommentId,
                    newComment.Content,
                    newComment.IsEdited,
                    newComment.IsDeleted,
                    newComment.DeletedByModerator,
                    CreatedAt = newComment.CreatedAt?.ToString("o")
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Отредактировать комментарий
        [HttpPut("{commentId}")]
        public async Task<IActionResult> UpdateComment(string commentId, [FromBody] UpdateCommentDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                if (string.IsNullOrWhiteSpace(dto.Content))
                    return BadRequest(new { message = "Комментарий не может быть пустым" });

                var response = await _client.From<Comment>()
                    .Where(c => c.CommentId == commentId && c.UserId == userId)
                    .Get();

                var comment = response.Models.FirstOrDefault();
                if (comment == null)
                    return NotFound(new { message = "Комментарий не найден или у вас нет прав на редактирование" });

                if (comment.IsDeleted)
                    return BadRequest(new { message = "Нельзя редактировать удалённый комментарий" });

                await _client.From<Comment>()
                    .Where(c => c.CommentId == commentId)
                    .Set(c => c.Content!, dto.Content)
                    .Set(c => c.IsEdited, true)
                    .Set(c => c.UpdatedAt!, DateTime.UtcNow)
                    .Update();

                return Ok(new { message = "Комментарий обновлён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удалить комментарий
        [HttpDelete("{commentId}")]
        public async Task<IActionResult> DeleteComment(string commentId)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = _SupMan.GetUserId(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var response = await _client.From<Comment>()
                    .Where(c => c.CommentId == commentId)
                    .Get();

                var comment = response.Models.FirstOrDefault();
                if (comment == null)
                    return NotFound();

                var isAuthor = comment.UserId == userId;
                var isModeratorDeleting = !isAuthor && await IsReferenceOwner(comment.ReferenceType, comment.ReferenceId, userId);

                if (!isAuthor && !isModeratorDeleting)
                    return Forbid();

                await DeleteOrSoftDelete(comment, isModeratorDeleting);

                return Ok(new { message = "Комментарий удалён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // Удаление комментария с проверкой наличия дочерних комментариев
        private async Task DeleteOrSoftDelete(Comment comment, bool isModeratorDeleting)
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

        // Очистить родительский комментарий при условии, если нет дочерних комментариев
        private async Task CleanupAncestorIfOrphaned(string parentId)
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

        // Проверка доступа
        private async Task<bool> CanAccessReference(string referenceType, string referenceId, string userId)
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

            return true;
        }

        // Проверка на владельца
        private async Task<bool> IsReferenceOwner(string referenceType, string referenceId, string userId)
        {
            if (referenceType == "project")
            {
                var project = await _client.From<Project>()
                    .Where(p => p.ProjectId == referenceId && p.OwnerId == userId)
                    .Get();
                return project.Models.Count > 0;
            }

            return false;
        }

        // Упоминание (ответить пользователю)
        private async Task ProcessMentions(Comment comment, string authorId)
        {
            var matches = MyRegex().Matches(comment.Content ?? "");
            if (matches.Count == 0) return;

            var nicknames = matches.Select(m => m.Groups[1].Value).Distinct().ToList();

            foreach (var nickname in nicknames)
            {
                var userResponse = await _client.From<User>()
                    .Where(u => u.Nickname == nickname)
                    .Get();

                var mentionedUser = userResponse.Models.FirstOrDefault();
                if (mentionedUser == null || mentionedUser.UserId == authorId)
                    continue;

                var mention = new CommentMention
                {
                    MentionId = Guid.NewGuid().ToString(),
                    CommentId = comment.CommentId,
                    MentionedUserId = mentionedUser.UserId!,
                    CreatedAt = DateTime.UtcNow
                };

                try
                {
                    await _client.From<CommentMention>().Insert(
                        mention,
                        new QueryOptions { Returning = QueryOptions.ReturnType.Minimal }
                    );
                }
                catch
                {
                    continue;
                }

                var author = await _client.From<User>().Where(u => u.UserId == authorId).Get();
                var authorNickname = author.Models.FirstOrDefault()?.Nickname ?? "Пользователь";

                var notification = new Notification
                {
                    NotificationId = Guid.NewGuid().ToString(),
                    UserId = mentionedUser.UserId!,
                    ReferenceId = comment.ReferenceId,
                    ReferenceType = "comment",
                    ContextData = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        eventType = "comment_mention",
                        nickname = authorNickname,
                        commentId = comment.CommentId
                    }),
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };

                await _client.From<Notification>().Insert(
                    notification,
                    new QueryOptions { Returning = QueryOptions.ReturnType.Minimal }
                );
            }
        }

        [GeneratedRegex(@"@([a-zA-Z0-9_]+)")]
        private static partial Regex MyRegex();
    }
}