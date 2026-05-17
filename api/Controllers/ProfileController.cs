using api.Models;
using api.Support;
using Microsoft.AspNetCore.Mvc;
using Supabase;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProfileController(Client client) : ControllerBase
    {
        private readonly Client _client = client;

        // get info about yourself
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

                return Ok(ModelFromResponse(data!, userAuth.Email));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // update info about yourself
        [HttpPut("me")]
        public async Task<IActionResult> UpdateProfile([FromBody] User data)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            var error = Validator.ValidateProfile(data);
            if (error != null)
                return BadRequest(new { message = error });

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null) return Unauthorized();

                var query = _client.From<User>().Where(x => x.UserId == userAuth.Id);

                if (data.Nickname != null) query = query.Set(x => x.Nickname!, data.Nickname);
                if (data.RealName != null) query = query.Set(x => x.RealName!, data.RealName);
                if (data.Age.HasValue) query = query.Set(x => x.Age!, data.Age);
                if (data.Gender != null) query = query.Set(x => x.Gender!, data.Gender);
                if (data.Country != null) query = query.Set(x => x.Country!, data.Country);
                if (data.City != null) query = query.Set(x => x.City!, data.City);
                if (data.Workplace != null) query = query.Set(x => x.Workplace!, data.Workplace);
                if (data.ProfileRole != null) query = query.Set(x => x.ProfileRole!, data.ProfileRole);
                if (data.Description != null) query = query.Set(x => x.Description!, data.Description);
                if (data.HardSkills != null) query = query.Set(x => x.HardSkills!, data.HardSkills);
                if (data.SoftSkills != null) query = query.Set(x => x.SoftSkills!, data.SoftSkills);
                if (data.Contacts != null) query = query.Set(x => x.Contacts!, data.Contacts);
                if (data.AvatarUrl != null) query = query.Set(x => x.AvatarUrl!, data.AvatarUrl);

                var updated = await query.Update();
                return Ok(ModelFromResponse(updated.Models.First(), userAuth.Email));
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // model from response
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

        // update avatar
        [HttpPost("me/avatar")]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            var authHeader = Request.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
                return Unauthorized();

            var token = authHeader["Bearer ".Length..];

            try
            {
                var userAuth = await _client.Auth.GetUser(token);
                if (userAuth == null) return Unauthorized();

                using var stream = file.OpenReadStream();
                var bytes = new byte[file.Length];
                await stream.ReadAsync(bytes);

                var ext = Path.GetExtension(file.FileName);
                var fileName = $"{userAuth.Id}/avatar{ext}";

                await _client.Storage
                    .From("Avatar")
                    .Upload(bytes, fileName, new Supabase.Storage.FileOptions { Upsert = true });

                // get public url
                var publicUrl = _client.Storage
                    .From("Avatar")
                    .GetPublicUrl(fileName);

                var urlWithCacheBuster = $"{publicUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";

                // save on table users
                await _client.From<User>()
                    .Where(x => x.UserId == userAuth.Id)
                    .Set(x => x.AvatarUrl!, urlWithCacheBuster)
                    .Update();

                return Ok(new { avatarUrl = urlWithCacheBuster });
            }
            catch (Exception ex)
            {
                return StatusCode(500);
            }
        }

    }
}