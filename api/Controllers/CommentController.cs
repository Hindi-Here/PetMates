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
                var viewer = await _SupMan.GetViewerAsync(authHeader);

                if (!string.IsNullOrEmpty(viewer.UserId))
                    await _SupMan.UpdateLastOnlineAsync(viewer.UserId);

                if (!await _SupMan.CanAccessReference(referenceType, referenceId, viewer.UserId))
                    return NotFound();

                var list = await _SupMan.GetCommentsAsync(referenceType, referenceId);

                var result = viewer.IsStaff ? list : [.. list.Select(c => c.AuthorIsBanned
                    ? new CommentDto
                    {
                        CommentId = c.CommentId,
                        IsDeleted = true,
                        IsEdited = c.IsEdited,
                        DeletedByModerator = c.DeletedByModerator,
                        CreatedAt = c.CreatedAt,
                        UpdatedAt = c.UpdatedAt
                    }
                    : c)];

                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось загрузить комментарии" });
            }
        }

        // Отправить комментарий
        [HttpPost]
        public async Task<IActionResult> CreateComment([FromBody] CreateCommentDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var error = Validator.ValidateComment(dto.Content);
                if (error != null) return BadRequest(new { message = error });

                if (!await _SupMan.CanAccessReference(dto.ReferenceType, dto.ReferenceId, userId))
                    return NotFound();

                if (!string.IsNullOrEmpty(dto.ParentCommentId))
                {
                    var parent = (await _client.From<Comment>().Where(c => c.CommentId == dto.ParentCommentId).Get()).Models.FirstOrDefault();
                    if (parent == null || parent.ReferenceType != dto.ReferenceType || parent.ReferenceId != dto.ReferenceId)
                        return BadRequest(new { message = "Недопустимый родительский комментарий" });
                }

                await _SupMan.UpdateLastOnlineAsync(userId);

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

                await _client.From<Comment>().Insert(newComment, new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
                await _SupMan.Cache.CommentsChangedAsync(dto.ReferenceType, dto.ReferenceId);
                await _SupMan.ProcessMentions(newComment, userId);

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
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось создать комментарий" });
            }
        }

        // Отредактировать комментарий
        [HttpPut("{commentId}")]
        public async Task<IActionResult> UpdateComment(string commentId, [FromBody] UpdateCommentDto dto)
        {
            try
            {
                var authHeader = Request.Headers.Authorization.ToString();
                var userId = await _SupMan.GetUserIdAsync(authHeader);
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();

                var error = Validator.ValidateComment(dto.Content);
                if (error != null)
                    return BadRequest(new { message = error });

                var response = await _client.From<Comment>().Where(c => c.CommentId == commentId && c.UserId == userId).Get();
                var comment = response.Models.FirstOrDefault();

                if (comment == null)
                    return NotFound(new { message = "Комментарий не найден или у вас нет прав на редактирование" });
                if (comment.IsDeleted)
                    return BadRequest(new { message = "Нельзя редактировать удалённый комментарий" });

                if (!await _SupMan.CanAccessReference(comment.ReferenceType, comment.ReferenceId, userId))
                    return Forbid();

                await _client.From<Comment>()
                    .Where(c => c.CommentId == commentId)
                    .Set(c => c.Content!, dto.Content)
                    .Set(c => c.IsEdited, true)
                    .Set(c => c.UpdatedAt!, DateTime.UtcNow)
                    .Update();

                await _SupMan.Cache.CommentsChangedAsync(comment.ReferenceType, comment.ReferenceId);

                return Ok(new { message = "Комментарий обновлён" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { error = "Не удалось обновить комментарий" });
            }
        }

        // Удалить комментарий
        [HttpDelete("{commentId}")]
        public async Task<IActionResult> DeleteComment(string commentId)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null) return Unauthorized();

                var comment = (await _client.From<Comment>().Where(c => c.CommentId == commentId).Get()).Models.FirstOrDefault();
                if (comment == null) return NotFound();

                var isAuthor = comment.UserId == actor.UserId;
                var isRefOwner = !isAuthor && await _SupMan.IsReferenceOwner(comment.ReferenceType, comment.ReferenceId, actor.UserId);
                var isStaffDelete = !isAuthor && !isRefOwner && actor.IsStaff &&
                    RoleRules.CanModerate(actor.Role, await _SupMan.GetRoleAsync(comment.UserId));

                if (!isAuthor && !isRefOwner && !isStaffDelete)
                    return Forbid();

                await _SupMan.DeleteOrSoftDelete(comment, isStaffDelete);

                await _SupMan.Cache.CommentsChangedAsync(comment.ReferenceType, comment.ReferenceId);

                return Ok(new { message = "Комментарий удалён" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}