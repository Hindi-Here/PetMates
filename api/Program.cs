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

var supabaseClient = new Client(url!, key, options);
builder.Services.AddSingleton(supabaseClient);

builder.Services.AddSingleton<ITelegramBotClient>(new TelegramBotClient(botToken));

builder.Services.AddControllers();
builder.Services.AddScoped<SupportManager>(_ => new SupportManager(supabaseClient));

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
