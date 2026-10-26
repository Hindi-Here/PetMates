using NetVips;

namespace api.Support
{
    public enum ImageKind { Avatar, Media }

    public sealed record OptimizedImage(byte[] Bytes, string Extension, string ContentType);

    public static class ImageOptimizer
    {
        private const int AvatarSize = 512;
        private const int MediaMaxSide = 1600;
        private const long MaxPixels = 80_000_000;

        static ImageOptimizer()
        {
            Cache.Max = 0; 
        }

        public static bool TryOptimize(
            Stream input,
            ImageKind kind,
            out OptimizedImage? result,
            out string? error)
        {
            result = null;
            error = null;

            try
            {
                if (input.CanSeek) input.Position = 0;

                using (var probe = Image.NewFromStream(input, access: Enums.Access.Sequential))
                {
                    if ((long)probe.Width * probe.Height > MaxPixels)
                    {
                        error = "[Изображение] слишком большое разрешение";
                        return false;
                    }
                }
                input.Position = 0;

                using var image = kind == ImageKind.Avatar
                    ? Image.ThumbnailStream(input, AvatarSize, height: AvatarSize,
                        size: Enums.Size.Down, crop: Enums.Interesting.Centre)
                    : Image.ThumbnailStream(input, MediaMaxSide, height: MediaMaxSide,
                        size: Enums.Size.Down);

                var bytes = image.WriteToBuffer(".webp[Q=80,strip]");
                result = new OptimizedImage(bytes, ".webp", "image/webp");
                return true;
            }
            catch (VipsException)
            {
                error = "[Изображение] не удалось обработать файл (повреждён или неподдерживаемый формат)";
                return false;
            }
        }
    }
}