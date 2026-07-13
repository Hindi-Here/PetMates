using System.Text.Encodings.Web;
using System.Text.Json;

namespace api.Support
{
    public static class JsonOptions
    {
        public static readonly JsonSerializerOptions Default = new()
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            WriteIndented = false,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }
}