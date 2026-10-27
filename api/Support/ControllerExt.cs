using Microsoft.AspNetCore.Mvc;

namespace api.Support
{
    public static class ControllerExt
    {
        // Логирует исключение и отдаёт клиенту безопасный ответ
        public static IActionResult Fail(this ControllerBase c, Exception ex, string message = "Внутренняя ошибка сервера")
        {
            var log = c.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(c.GetType());
            log.LogError(ex, "{Method} {Path}", c.Request.Method, c.Request.Path);

            if (ex.Message.Contains("23505"))
                return c.Conflict(new { message = "Действие уже выполнено", error = "Действие уже выполнено" });

            return c.StatusCode(500, new { message, error = message });
        }
    }
}