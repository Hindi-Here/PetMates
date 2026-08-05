using api.Support;
using DotNetEnv;
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

builder.Services.AddScoped<SupportManager>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowLocalhost", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://78.17.198.221")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

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