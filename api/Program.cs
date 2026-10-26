using api.Support;
using DotNetEnv;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.Caching.Hybrid;
using Supabase;
using Telegram.Bot;

var builder = WebApplication.CreateBuilder(args);

Env.Load();

var url = Environment.GetEnvironmentVariable("SUPABASE_URL");
var key = Environment.GetEnvironmentVariable("SUPABASE_KEY");
var botToken = Environment.GetEnvironmentVariable("TELEGRAM_BOT_TOKEN")!;

var options = new SupabaseOptions
{
    AutoRefreshToken = true,
    AutoConnectRealtime = true
};

builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<Supabase.Client>(sp =>
{
    var client = new Client(url!, key, options);

    var httpContextAccessor = sp.GetRequiredService<IHttpContextAccessor>();
    var authHeader = httpContextAccessor.HttpContext?.Request.Headers.Authorization.ToString();

    if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
    {
        var token = authHeader["Bearer ".Length..].Trim();

        if (!string.IsNullOrEmpty(token) &&
            token != "undefined" && token != "null" &&
            token.Count(c => c == '.') == 2)
        {
            client.Postgrest.Options.Headers["Authorization"] = $"Bearer {token}";
        }
    }

    return client;
});

builder.Services.AddSingleton<ITelegramBotClient>(new TelegramBotClient(botToken));

builder.Services.AddControllers();
builder.Services.AddControllers(o => o.Filters.Add<BanGateFilter>());

builder.Services.AddKeyedSingleton<Supabase.Client>("system", (_, _) =>
    new Client(url!, key, new SupabaseOptions
    {
        AutoRefreshToken = false,
        AutoConnectRealtime = false
    }));

builder.Services.AddMemoryCache();
builder.Services.AddHybridCache(o =>
{
    o.MaximumKeyLength = 256;
    o.DefaultEntryOptions = new HybridCacheEntryOptions
    {
        Expiration = CacheStale.Short,
        LocalCacheExpiration = CacheStale.Short,
        Flags = HybridCacheEntryFlags.DisableDistributedCache
    };
});
builder.Services.AddResponseCompression(o =>
{
    o.EnableForHttps = true;
    o.Providers.Add<BrotliCompressionProvider>();
    o.Providers.Add<GzipCompressionProvider>();
});

builder.Services.AddSingleton<AppCache>();
builder.Services.AddSingleton<SupabaseJwt>();
builder.Services.AddScoped<SupportManager>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                             ?? [];

        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseResponseCompression();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowLocalhost");
app.UseHttpsRedirection();
app.UseAuthorization();

app.MapControllers();
app.Run();