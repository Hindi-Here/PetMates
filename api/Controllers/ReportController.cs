using api.Support;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Net;
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
        [EnableRateLimiting("report")]
        [RequestSizeLimit(Limits.Report.RequestBytes)]
        public async Task<IActionResult> SendReport([FromForm] ReportFormRequest request)
        {
            var messageError = Validator.ValidateRequiredText(request.Message, Limits.Report.MessageMax, "Текст");
            if (messageError != null)
                return BadRequest(new { error = messageError });

            var nicknameError = Validator.ValidateOptionalText(request.Nickname, Limits.Report.NicknameMax, "Никнейм");
            if (nicknameError != null)
                return BadRequest(new { error = nicknameError });

            var validFiles = request.Files?.Where(f => f.Length > 0).ToList() ?? [];

            var filesError = Validator.ValidateReportAttachments(validFiles);
            if (filesError != null)
                return BadRequest(new { error = filesError });

            var sender = request.IsAnonymous || string.IsNullOrWhiteSpace(request.Nickname)
                ? "Аноним"
                : request.Nickname;
            var typeLabel = SupportManager.GetReportTypeLabel(request.Type);

            var textError = Validator.ValidateReportText($"[{typeLabel}] от {sender}\n{request.Message}", validFiles.Count > 0);
            if (textError != null)
                return BadRequest(new { error = textError });

            var text = $"<b>[{typeLabel}]</b> от {WebUtility.HtmlEncode(sender)}\n{WebUtility.HtmlEncode(request.Message)}";

            try
            {
                if (validFiles.Count == 0)
                {
                    await _bot.SendMessage(_chatId, text, parseMode: ParseMode.Html);
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
                        await _bot.SendVideo(_chatId, inputFile, caption: text, parseMode: ParseMode.Html);
                    else
                        await _bot.SendPhoto(_chatId, inputFile, caption: text, parseMode: ParseMode.Html);
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
                        var parseMode = i == 0 ? ParseMode.Html : (ParseMode?)null;

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
            catch (Exception ex) { return this.Fail(ex); }
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