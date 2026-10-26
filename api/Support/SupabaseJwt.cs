using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace api.Support
{
    public sealed record AuthUser(string Id, string? Email);

    public sealed class SupabaseJwt
    {
        private static readonly HttpClient Http = new();
        private readonly JsonWebTokenHandler _handler = new();
        private readonly TokenValidationParameters _params;
        private readonly string _jwksUrl;
        private readonly SemaphoreSlim _lock = new(1, 1);
        private JsonWebKeySet? _jwks;
        private DateTime _jwksLoadedAt;

        public SupabaseJwt()
        {
            var url = Environment.GetEnvironmentVariable("SUPABASE_URL")!.TrimEnd('/');
            var secret = Environment.GetEnvironmentVariable("SUPABASE_JWT_SECRET");
            _jwksUrl = $"{url}/auth/v1/.well-known/jwks.json";

            _params = new TokenValidationParameters
            {
                ValidIssuer = $"{url}/auth/v1",
                ValidAudience = "authenticated",
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                RequireSignedTokens = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            };

            if (!string.IsNullOrEmpty(secret))
                _params.IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        }

        public async Task<AuthUser?> ValidateAsync(string token)
        {
            try
            {
                var p = _params;
                if (p.IssuerSigningKey is null)
                {
                    p = _params.Clone();
                    p.IssuerSigningKeys = (await GetJwksAsync()).GetSigningKeys();
                }

                var result = await _handler.ValidateTokenAsync(token, p);
                if (!result.IsValid) return null;

                var jwt = (JsonWebToken)result.SecurityToken;
                if (string.IsNullOrEmpty(jwt.Subject)) return null;

                jwt.TryGetClaim("email", out var email);
                return new AuthUser(jwt.Subject, email?.Value);
            }
            catch { return null; }
        }

        private async Task<JsonWebKeySet> GetJwksAsync()
        {
            if (_jwks != null && DateTime.UtcNow - _jwksLoadedAt < TimeSpan.FromHours(1)) return _jwks;

            await _lock.WaitAsync();
            try
            {
                if (_jwks != null && DateTime.UtcNow - _jwksLoadedAt < TimeSpan.FromHours(1)) return _jwks;
                _jwks = new JsonWebKeySet(await Http.GetStringAsync(_jwksUrl));
                _jwksLoadedAt = DateTime.UtcNow;
                return _jwks;
            }
            finally { _lock.Release(); }
        }
    }
}