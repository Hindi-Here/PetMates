using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;
using System.Text.Json;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProfileController(Client client, SupportManager SupMan) : ControllerBase
    {
        private readonly Client _client = client;

        private readonly SupportManager _SupMan = SupMan;

        // Получить профиль текущего пользователя
        [HttpGet("me")]
        [AllowBanned]
        public async Task<IActionResult> GetProfile()
        {
            var authHeader = Request.Headers.Authorization.ToString();
            var userAuth = await _SupMan.GetAuthUserAsync(authHeader);
            if (userAuth == null) return Unauthorized();

            try
            {
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

                return Ok(Mappers.ProfileResponse(data, userAuth.Email));
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Отредактировать профиль текущего пользователя
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile([FromBody] Dictionary<string, JsonElement> data)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            var userAuth = await _SupMan.GetAuthUserAsync(authHeader);
            if (userAuth == null)
                return Unauthorized();

            if (data.TryGetValue("nickname", out var nickEl) && nickEl.ValueKind == JsonValueKind.String &&
                await _SupMan.IsNicknameTakenAsync(nickEl.GetString()!, userAuth.Id))
                    return Conflict(new { message = "[Никнейм] этот никнейм уже занят" });

            User? userObject;
            try
            {
                var jsonString = JsonSerializer.Serialize(data);
                userObject = JsonSerializer.Deserialize<User>(jsonString, Support.JsonOptions.CaseInsensitive);
            }
            catch (JsonException)
            {
                return BadRequest(new { message = "[Профиль] некорректные данные" });
            }
            if (userObject == null)
                return BadRequest(new { message = "[Профиль] некорректные данные" });

            var validationError = Validator.ValidateProfile(userObject);
            if (validationError != null)
                return BadRequest(new { message = validationError });

            try
            {
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

                await _SupMan.Cache.UserChangedAsync(userAuth.Id!);

                if (updated.Models == null || updated.Models.Count == 0)
                {
                    var current = await _client.From<User>().Where(x => x.UserId == userAuth.Id).Get();
                    return Ok(Mappers.ProfileResponse(current.Models.First(), userAuth.Email));
                }

                return Ok(Mappers.ProfileResponse(updated.Models.First(), userAuth.Email));
            }
            catch (Exception ex) { return this.Fail(ex); }
        }

        // Обновить аватар
        [HttpPost("me/avatar")]
        [RequestSizeLimit(Limits.Upload.AvatarRequestBytes)]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            var userAuth = await _SupMan.GetAuthUserAsync(authHeader);
            if (userAuth == null)
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            var (error, _) = Validator.ValidateAvatar(file);
            if (error != null)
                return BadRequest(new { message = error });

            try
            {
                using var input = file.OpenReadStream();
                if (!ImageOptimizer.TryOptimize(input, ImageKind.Avatar, out var optimized, out var optError))
                    return BadRequest(new { message = optError });

                var fileName = $"{userAuth.Id}/avatar.webp";

                await _client.Storage
                    .From("Avatar")
                    .Upload(optimized!.Bytes, fileName, new Supabase.Storage.FileOptions
                    {
                        Upsert = true,
                        ContentType = optimized.ContentType,
                        CacheControl = "31536000"
                    });

                try
                {
                    await _client.Storage.From("Avatar").Remove(
                        [$"{userAuth.Id}/avatar.png", $"{userAuth.Id}/avatar.jpg"]);
                }
                catch { }

                var publicUrl = _client.Storage.From("Avatar").GetPublicUrl(fileName);
                var urlWithCacheBuster = $"{publicUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

                await _client.From<User>()
                    .Where(x => x.UserId == userAuth.Id)
                    .Set(x => x.AvatarUrl!, urlWithCacheBuster)
                    .Update();

                await _SupMan.Cache.UserChangedAsync(userAuth.Id!);
                return Ok(new { avatarUrl = urlWithCacheBuster });
            }
            catch (Exception ex) { return this.Fail(ex); }
        }
    }
}