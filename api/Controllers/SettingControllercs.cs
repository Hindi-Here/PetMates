using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SettingController(Client client) : ControllerBase
    {
        private readonly Client _client = client;

        // Обновить пароль
        [HttpPut("password")]
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
                if (userAuth == null)
                    return Unauthorized();

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

                return Ok(new { message = "Пароль успешно изменён" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { message = "Ошибка смены пароля" });
            }
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
            catch (Exception)
            {
                return StatusCode(500, new { message = "Ошибка смены почты" });
            }
        }

        // Удалить аккаунт
        [HttpDelete("account")]
        public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountRequest request)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null) return Unauthorized();

                if (!IsNicknameValid(userAuth, request.Nickname))
                    return BadRequest(new { message = "[Никнейм] введённый никнейм не совпадает с текущим" });

                var supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL");
                var serviceKey = Environment.GetEnvironmentVariable("SUPABASE_KEY");

                using var http = new HttpClient();
                http.DefaultRequestHeaders.Add("Authorization", $"Bearer {serviceKey}");
                http.DefaultRequestHeaders.Add("apikey", serviceKey);

                var response = await http.DeleteAsync($"{supabaseUrl}/auth/v1/admin/users/{userAuth.Id}");

                if (!response.IsSuccessStatusCode)
                    return StatusCode(500, new { message = "Ошибка удаления аккаунта" });

                return Ok(new { message = "Аккаунт успешно удалён" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { message = "Ошибка удаления аккаунта" });
            }
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
                if (userAuth == null) return Unauthorized();

                if (!IsNicknameValid(userAuth, request.Nickname))
                    return BadRequest(new { message = "[Никнейм] введённый никнейм не совпадает с текущим" });

                return Ok(new { message = "Никнейм подтверждён" });
            }
            catch (Exception)
            {
                return StatusCode(500, new { message = "Ошибка проверки никнейма" });
            }
        }

        // Никнейм валидация
        private static bool IsNicknameValid(Supabase.Gotrue.User userAuth, string? nickname)
        {
            var currentNickname = userAuth.UserMetadata?
                .GetValueOrDefault("nickname")?.ToString() ?? "";

            return !string.IsNullOrWhiteSpace(nickname) &&
                   string.Equals(nickname.Trim(), currentNickname.Trim(), StringComparison.OrdinalIgnoreCase);
        }
    }

    public record ChangePasswordRequest(string OldPassword, string NewPassword, string ConfirmPassword);
    public record ChangeEmailRequest(string NewEmail, string ConfirmCode);
    public record VerifyNicknameRequest(string Nickname);
    public record DeleteAccountRequest(string Nickname);
}