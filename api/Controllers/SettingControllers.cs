using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SettingController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;
        private readonly SupportManager _SupMan = SupMan;

        // Обновить пароль
        [HttpPut("password")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            var error = Validator.ValidateChangePassword(request.NewPassword, request.ConfirmPassword);
            if (error != null)
                return BadRequest(new { message = error });

            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null || string.IsNullOrEmpty(userAuth.Email))
                    return Unauthorized();

                if (string.IsNullOrEmpty(request.OldPassword) ||
                    !await SupportManager.VerifyPasswordAsync(userAuth.Email, request.OldPassword))
                {
                    return BadRequest(new { message = "[Пароль] старый пароль указан неверно" });
                }

                if (request.OldPassword == request.NewPassword)
                {
                    return BadRequest(new { message = "[Пароль] новый пароль совпадает со старым" });
                }

                var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");
                var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_KEY");

                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {serviceKey}");
                http.DefaultRequestHeaders.Add("apikey", serviceKey);

                var body = System.Text.Json.JsonSerializer.Serialize(new { password = request.NewPassword });
                var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

                var response = await http.PutAsync(
                    $"{supabaseUrl}/auth/v1/admin/users/{userAuth.Id}",
                    content
                );

                if (!response.IsSuccessStatusCode)
                    return StatusCode(500, new { message = "Ошибка смены пароля" });

                await SupportManager.SignOutOthersAsync(token);

                return Ok(new { message = "Пароль успешно изменён" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Обновить почту
        [HttpPut("email")]
        public async Task<IActionResult> ChangeEmail([FromBody] ChangeEmailRequest request)
        {
            var error = Validator.ValidateChangeEmail(request.NewEmail);
            if (error != null) return BadRequest(new { message = error });

            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null) return Unauthorized();

                var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");
                var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_KEY");

                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {serviceKey}");
                http.DefaultRequestHeaders.Add("apikey", serviceKey);

                var body = System.Text.Json.JsonSerializer.Serialize(new { email = request.NewEmail });
                var content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

                var response = await http.PutAsync(
                    $"{supabaseUrl}/auth/v1/admin/users/{userAuth.Id}",
                    content
                );

                if (!response.IsSuccessStatusCode)
                    return StatusCode(500, new { message = "Ошибка смены почты" });

                return Ok(new { message = "Почта успешно изменена" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Удалить аккаунт
        [HttpDelete("account")]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountRequest request)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null)
                    return Unauthorized();

                if (!SupportManager.IsNicknameValid(userAuth, request.Nickname))
                    return BadRequest(new { message = "[Никнейм] введённый никнейм не совпадает с текущим" });

                var provider = userAuth.AppMetadata?.GetValueOrDefault("provider")?.ToString() ?? "email";
                if (provider == "email" &&
                    (string.IsNullOrEmpty(request.Password) ||
                     !await SupportManager.VerifyPasswordAsync(userAuth.Email!, request.Password)))
                {
                    return BadRequest(new { message = "[Пароль] неверный пароль" });
                }

                var uid = userAuth.Id!;

                var projectIds = (await _client.From<Project>().Where(p => p.OwnerId == uid).Get())
                    .Models.Select(p => p.ProjectId).ToList();

                var eventIds = (await _client.From<Event>().Where(e => e.OwnerId == uid).Get())
                    .Models.Select(e => e.EventId).ToList();

                var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");
                var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_KEY");

                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {serviceKey}");
                http.DefaultRequestHeaders.Add("apikey", serviceKey);

                var response = await http.DeleteAsync($"{supabaseUrl}/auth/v1/admin/users/{uid}");

                if (!response.IsSuccessStatusCode)
                    return StatusCode(500, new { message = "Ошибка удаления аккаунта в Supabase" });

                foreach (var id in projectIds)
                {
                    await _SupMan.DeleteFolderAsync("ProjectMedia", id);
                    await _SupMan.DeleteFolderAsync("ProjectMediaDraft", id);
                }

                foreach (var id in eventIds)
                {
                    await _SupMan.DeleteEventMedia(id);
                }

                await _SupMan.DeleteFolderAsync("Avatar", uid);
                await _SupMan.Cache.EverythingChangedAsync();

                return Ok(new { message = "Аккаунт успешно удалён" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Верификация
        [HttpPost("account/verify")]
        public async Task<IActionResult> VerifyNickname([FromBody] VerifyNicknameRequest request)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null)
                    return Unauthorized();

                if (!await _SupMan.NicknameMatchesAsync(userAuth.Id!, request.Nickname))
                    return BadRequest(new { message = "[Никнейм] введённый никнейм не совпадает с текущим" });

                return Ok(new { message = "Никнейм подтверждён" });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}