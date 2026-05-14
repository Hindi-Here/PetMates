using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase.Gotrue;
using System.Text.Json;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController(Supabase.Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Supabase.Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // user register
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                var options = new SignUpOptions
                {
                    Data = new Dictionary<string, object>
                    {
                        { "nickname", request.Nickname },
                        { "display_name", request.Nickname }
                    }
                };

                var session = await _client.Auth.SignUp(request.Email, request.Password, options);
                return Ok(new
                {
                    userId = session!.User?.Id,
                    accessToken = session.AccessToken,
                    refreshToken = session.RefreshToken
                });
            }
            catch (Exception ex)
            {
                try
                {
                    using var doc = JsonDocument.Parse(ex.Message);
                    var code = doc.RootElement.GetProperty("code").ToString();

                    if (code == "422")
                        return Conflict(new { message = "Пользователь с таким Email уже существует" });

                    if (code == "23505")
                        return Conflict(new { message = "Этот никнейм уже занят" });
                }
                catch { }

                return BadRequest(new { message = "Ошибка регистрации" });
            }
        }

        // user login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                var session = await _client.Auth.SignInWithPassword(request.Email, request.Password);

                if (session?.User?.Id != null)
                    await _SupMan.UpdateLastOnlineAsync(session.User.Id);

                return Ok(new
                {
                    userId = session!.User!.Id,
                    email = session.User.Email,
                    accessToken = session.AccessToken,
                    refreshToken = session.RefreshToken
                });
            }
            catch (Exception)
            {
                return Unauthorized(new { message = "Неверный email или пароль" });
            }
        }
    }

    public record RegisterRequest(string Nickname, string Email, string Password);
    public record LoginRequest(string Email, string Password);
}