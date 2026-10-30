using api.Support;
using DotNetEnv;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.Caching.Hybrid;
using Supabase;
using System.Net;
using System.Threading.RateLimiting;
using Telegram.Bot;

var builder = WebApplication.CreateBuilder(args);

Env.Load();

var url = Environment.GetEnvironmentVariable("SUPABASE_URL");
var key = Environment.GetEnvironmentVariable("SUPABASE_KEY");
var botToken = Environment.GetEnvironmentVariable("TELEGRAM_BOT_TOKEN")!;

static SupabaseOptions supabaseOptions() => new()
{
    AutoRefreshToken = false,
    AutoConnectRealtime = false
};

builder.Services.AddScoped<Supabase.Client>(_ => new Client(url!, key, supabaseOptions()));
builder.Services.AddKeyedSingleton<Supabase.Client>("system", (_, _) => new Client(url!, key, supabaseOptions()));

builder.Services.AddSingleton<ITelegramBotClient>(new TelegramBotClient(botToken));

builder.Services.AddControllers(o => o.Filters.Add<BanGateFilter>());

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

builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownProxies.Add(IPAddress.Loopback);
    o.KnownProxies.Add(IPAddress.IPv6Loopback);
});
static RateLimitPartition<string> PerIp(HttpContext c, int permit, TimeSpan window) =>
    RateLimitPartition.GetFixedWindowLimiter(
        c.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = permit, Window = window, QueueLimit = 0 });

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("report", c => PerIp(c, 3, TimeSpan.FromMinutes(10)));
    o.AddPolicy("auth", c => PerIp(c, 10, TimeSpan.FromMinutes(5)));
    o.AddPolicy("lookup", c => PerIp(c, 20, TimeSpan.FromMinutes(1)));
    o.AddPolicy("write", c => PerIp(c, 60, TimeSpan.FromMinutes(1)));
    o.AddPolicy("upload", c => PerIp(c, 20, TimeSpan.FromMinutes(1)));
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(allowedOrigins)
              .WithHeaders("Authorization", "Content-Type")
              .WithMethods("GET", "POST", "PUT", "DELETE");
    });
});

var app = builder.Build();

app.UseForwardedHeaders();

app.UseExceptionHandler(a => a.Run(async ctx =>
{
    ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await ctx.Response.WriteAsJsonAsync(new { message = "Внутренняя ошибка сервера" });
}));

app.UseResponseCompression();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();
app.Run();