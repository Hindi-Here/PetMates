using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using System.Text.Json;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProfileController(Client client) : ControllerBase
    {
        private readonly Client _client = client;

        // Получить профиль текущего пользователя
        [HttpGet("me")]
        public async Task<IActionResult> GetProfile()
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null) return Unauthorized();

                var response = await _client
                    .From<User>()
                    .Where(x => x.UserId == userAuth.Id)
                    .Get();

                var data = response.Models.FirstOrDefault();

                if (data == null)
                {
                    return NotFound(new { message = "Пользователь не найден" });
                }

                if (data.IsBanned)
                {
                    return StatusCode(403, new
                    {
                        message = "Аккаунт заблокирован",
                        isBanned = true
                    });
                }

                return Ok(ModelFromResponse(data, userAuth.Email));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Отредактировать профиль текущего пользователя
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile([FromBody] Dictionary<string, JsonElement> data)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            var jsonString = JsonSerializer.Serialize(data);
            var userObject = JsonSerializer.Deserialize<User>(jsonString);

            var validationError = Validator.ValidateProfile(userObject!);
            if (validationError != null)
                return BadRequest(new { message = validationError });

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null) return Unauthorized();

                var query = _client.From<User>().Where(x => x.UserId == userAuth.Id);
                var fieldsToUpdate = new List<string>();

                var nullableStringFields = new Dictionary<string, Action<string?>>
                {
                    ["realName"] = v => query = query.Set(x => x.RealName!, v),
                    ["gender"] = v => query = query.Set(x => x.Gender!, v),
                    ["country"] = v => query = query.Set(x => x.Country!, v),
                    ["city"] = v => query = query.Set(x => x.City!, v),
                    ["workplace"] = v => query = query.Set(x => x.Workplace!, v),
                    ["description"] = v => query = query.Set(x => x.Description!, v),
                    ["hardSkills"] = v => query = query.Set(x => x.HardSkills!, v),
                    ["softSkills"] = v => query = query.Set(x => x.SoftSkills!, v),
                    ["contacts"] = v => query = query.Set(x => x.Contacts!, v),
                };

                foreach (var (key, setter) in nullableStringFields)
                {
                    if (data.TryGetValue(key, out var el))
                    {
                        setter(el.ValueKind == JsonValueKind.Null ? null : el.GetString());
                        fieldsToUpdate.Add(key);
                    }
                }

                foreach (var key in new[] { "nickname", "profileRole" })
                {
                    if (data.TryGetValue(key, out var el) && el.ValueKind != JsonValueKind.Null)
                    {
                        var val = el.GetString();
                        if (val != null)
                        {
                            if (key == "nickname") query = query.Set(x => x.Nickname!, val);
                            else query = query.Set(x => x.ProfileRole!, val);
                            fieldsToUpdate.Add(key);
                        }
                    }
                }

                if (data.TryGetValue("age", out var age))
                {
                    int? val = null;
                    if (age.ValueKind == JsonValueKind.Number && age.TryGetInt32(out var i)) val = i;
                    else if (age.ValueKind == JsonValueKind.String && int.TryParse(age.GetString(), out var p)) val = p;
                    query = query.Set(x => x.Age!, val);
                    fieldsToUpdate.Add("age");
                }

                if (fieldsToUpdate.Count == 0)
                    return Ok(new { message = "Нет полей для обновления" });

                var updated = await query.Update();

                if (updated.Models == null || updated.Models.Count == 0)
                {
                    var current = await _client.From<User>().Where(x => x.UserId == userAuth.Id).Get();
                    return Ok(ModelFromResponse(current.Models.First(), userAuth.Email));
                }

                return Ok(ModelFromResponse(updated.Models.First(), userAuth.Email));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // Преобразовать профиль пользователя в объект
        private static object ModelFromResponse(User profile, string? email = null)
        {
            return new
            {
                email,
                userId = profile.UserId,
                nickname = profile.Nickname,
                avatarUrl = profile.AvatarUrl,
                realName = profile.RealName,
                age = profile.Age,
                gender = profile.Gender,
                country = profile.Country,
                city = profile.City,
                workplace = profile.Workplace,
                profileRole = profile.ProfileRole,
                systemRole = profile.SystemRole,
                description = profile.Description,
                hardSkills = profile.HardSkills,
                softSkills = profile.SoftSkills,
                contacts = profile.Contacts,
                lastOnlineAt = profile.LastOnlineAt,
                createdAt = profile.CreatedAt,
            };
        }

        // Обновить аватар
        [HttpPost("me/avatar")]
        [RequestSizeLimit(5_500_000)] 
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            var (error, extension) = Validator.ValidateAvatar(file);
            if (error != null)
                return BadRequest(new { message = error });

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null) return Unauthorized();

                using var memoryStream = new MemoryStream();
                using var stream = file.OpenReadStream();
                await stream.CopyToAsync(memoryStream);
                var bytes = memoryStream.ToArray();

                var fileName = $"{userAuth.Id}/avatar{extension}";

                await _client.Storage
                    .From("Avatar")
                    .Upload(bytes, fileName, new Supabase.Storage.FileOptions { Upsert = true });

                var publicUrl = _client.Storage
                    .From("Avatar")
                    .GetPublicUrl(fileName);

                var urlWithCacheBuster = $"{publicUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

                await _client.From<User>()
                    .Where(x => x.UserId == userAuth.Id)
                    .Set(x => x.AvatarUrl!, urlWithCacheBuster)
                    .Update();

                return Ok(new { avatarUrl = urlWithCacheBuster });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
    }
}