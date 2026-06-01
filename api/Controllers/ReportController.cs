using Microsoft.AspNetCore.Mvc;
using Telegram.Bot;

namespace api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ReportController(ITelegramBotClient botClient) : ControllerBase
    {
        private readonly ITelegramBotClient _bot = botClient;
        private readonly long _chatId = long.Parse(
            Environment.GetEnvironmentVariable("TELEGRAM_CHAT_ID")!
        );

        [HttpPost("send")]
        public async Task<IActionResult> SendReport([FromBody] ReportRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { error = "Сообщение не может быть пустым" });

            if (request.Message.Length > 2000)
                return BadRequest(new { error = "Сообщение слишком длинное" });

            var sender = request.IsAnonymous || string.IsNullOrWhiteSpace(request.Nickname)
                ? "Аноним"
                : request.Nickname;

            var text = $"💬 *Новое сообщение от {sender}*\n{request.Message}";

            await _bot.SendMessage(_chatId, text, parseMode: Telegram.Bot.Types.Enums.ParseMode.Markdown);

            return Ok(new { success = true });
        }
    }

    public record ReportRequest(string Message, bool IsAnonymous, string? Nickname);
}