using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Supabase.Postgrest;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserBlockController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Заблокирован ли?
        [HttpGet("{targetId}")]
        public async Task<IActionResult> IsBlocked(string targetId)
        {
            try
            {
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();
                var r = await _client.From<UserBlock>().Where(b => b.BlockerId == userId).Where(b => b.BlockedId == targetId).Get();
                return Ok(new { blocked = r.Models.Count > 0 });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Заблокировать
        [HttpPost("{targetId}")] 
        [EnableRateLimiting("write")]
        public async Task<IActionResult> Block(string targetId)
        {
            try
            {
                var actor = await _SupMan.GetActorAsync(Request.Headers.Authorization.ToString());
                if (actor == null)
                    return Unauthorized();

                if (targetId == actor.UserId)
                    return BadRequest(new { message = "Нельзя заблокировать себя" });

                if (!(await _SupMan.GetAccessAsync(targetId)).Exists)
                    return NotFound(new { message = "Пользователь не найден" });

                try
                {
                    await _client.From<UserBlock>().Insert(
                        new UserBlock
                        {
                            BlockerId = actor.UserId,
                            BlockedId = targetId,
                            CreatedAt = DateTime.UtcNow
                        },
                        new QueryOptions { Returning = QueryOptions.ReturnType.Minimal });
                }
                catch (Exception ex) when (ex.Message.Contains("23505"))
                {
                }

                return Ok(new { blocked = true });
            }
            catch (Exception ex)
            {
                return this.Fail(ex);
            }
        }

        // Разблокировать
        [HttpDelete("{targetId}")]
        public async Task<IActionResult> Unblock(string targetId)
        {
            try
            {
                var userId = await _SupMan.GetUserIdAsync(Request.Headers.Authorization.ToString());
                if (string.IsNullOrEmpty(userId))
                    return Unauthorized();
                await _client.From<UserBlock>().Where(b => b.BlockerId == userId).Where(b => b.BlockedId == targetId).Delete();
                return Ok(new { blocked = false });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}