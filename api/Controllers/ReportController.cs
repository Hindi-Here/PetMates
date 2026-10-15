using api.Support;
using Microsoft.AspNetCore.Mvc;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

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

        // Отправить сообщение в Telegram
        [HttpPost("send")]
        [RequestSizeLimit(Limits.Report.RequestBytes)]
        public async Task<IActionResult> SendReport([FromForm] ReportFormRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
                return BadRequest(new { error = "[Текст] Сообщение не может быть пустым" });
            if (request.Message.Length > Limits.Report.MessageMax)
                return BadRequest(new { error = "[Текст] Сообщение слишком длинное" });
            var validFiles = request.Files?.Where(f => f.Length > 0).ToList() ?? [];
            var totalSize = validFiles.Sum(f => f.Length);
            if (totalSize > Limits.Report.AttachmentsMaxBytes)
                return BadRequest(new { error = $"[Вложения] Общий размер вложений не должен превышать {Limits.Report.AttachmentsMaxBytes / Limits.MB} МБ" });

            var allowedTypes = new[] { "image/", "video/" };
            if (validFiles.Any(f => string.IsNullOrEmpty(f.ContentType) || !allowedTypes.Any(t => f.ContentType.StartsWith(t))))
                return BadRequest(new { error = "[Вложения] Допустимы только изображения и видео" });

            var sender = request.IsAnonymous || string.IsNullOrWhiteSpace(request.Nickname)
                ? "Аноним"
                : request.Nickname;

            var typeLabel = SupportManager.GetReportTypeLabel(request.Type);
            var text = $"*[{typeLabel}]* от {sender}\n{request.Message}";

            try
            {
                if (validFiles.Count == 0)
                {
                    await _bot.SendMessage(_chatId, text, parseMode: ParseMode.Markdown);
                }
                else if (validFiles.Count == 1)
                {
                    var file = validFiles[0];
                    using var stream = new MemoryStream();
                    await file.CopyToAsync(stream);
                    stream.Position = 0;
                    var inputFile = InputFile.FromStream(stream, file.FileName);

                    var contentType = file.ContentType?.ToLowerInvariant() ?? "";
                    if (contentType.StartsWith("video/"))
                        await _bot.SendVideo(_chatId, inputFile, caption: text, parseMode: ParseMode.Markdown);
                    else
                        await _bot.SendPhoto(_chatId, inputFile, caption: text, parseMode: ParseMode.Markdown);
                }
                else
                {
                    var streams = new List<MemoryStream>();
                    var media = new List<IAlbumInputMedia>();

                    for (var i = 0; i < validFiles.Count; i++)
                    {
                        var file = validFiles[i];
                        var stream = new MemoryStream();
                        await file.CopyToAsync(stream);
                        stream.Position = 0;
                        streams.Add(stream);

                        var inputFile = InputFile.FromStream(stream, file.FileName);
                        var caption = i == 0 ? text : null;
                        var parseMode = i == 0 ? ParseMode.Markdown : (ParseMode?)null;

                        var contentType = file.ContentType?.ToLowerInvariant() ?? "";

                        if (contentType.StartsWith("video/"))
                        {
                            var mediaItem = new InputMediaVideo(inputFile) { Caption = caption };
                            if (parseMode.HasValue)
                                mediaItem.ParseMode = parseMode.Value;
                            media.Add(mediaItem);
                        }
                        else
                        {
                            var mediaItem = new InputMediaPhoto(inputFile) { Caption = caption };
                            if (parseMode.HasValue)
                                mediaItem.ParseMode = parseMode.Value;
                            media.Add(mediaItem);
                        }
                    }

                    try
                    {
                        await _bot.SendMediaGroup(_chatId, media);
                    }
                    finally
                    {
                        foreach (var s in streams) await s.DisposeAsync();
                    }
                }

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    public class ReportFormRequest
    {
        public string Message { get; set; } = string.Empty;
        public bool IsAnonymous { get; set; }
        public string? Nickname { get; set; }
        public string? Type { get; set; }
        public List<IFormFile>? Files { get; set; }
    }
}