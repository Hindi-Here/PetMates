using System.Text.RegularExpressions;

namespace api.Support
{
    public partial class Validator
    {

        [GeneratedRegex(@"^[a-zA-Zа-яА-Я0-9_-]+$")]
        private static partial Regex NicknameRegex();

        [GeneratedRegex(@"^[a-zA-Zа-яА-Я0-9ёЁ\s\-""'.,()\/]+$")]
        private static partial Regex NameLocationRegex();

        [GeneratedRegex(@"^[a-zA-Zа-яА-Я0-9ёЁ\/\[\]\-\s]+$")]
        private static partial Regex RoleRegex();

        [GeneratedRegex(@"^#[a-zA-Zа-яА-Я0-9_\/]+$")]
        private static partial Regex TagRegex();

        [GeneratedRegex(@"^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$")]
        private static partial Regex EmailRegex();

        [GeneratedRegex(@"[A-Za-zА-Яа-я]")]
        private static partial Regex PasswordLetterRegex();

        [GeneratedRegex(@"[0-9]")]
        private static partial Regex PasswordNumberRegex();

        [GeneratedRegex(@"[!@#$%^&*()\-_=+\[\]{};':""\\|,.<>\/?]")]
        private static partial Regex PasswordSpecialRegex();

        // Валидация профиля пользователя
        public static string? ValidateProfile(Models.User data)
        {
            var errors = new List<string>();

            if (data.Nickname != null)
            {
                if (data.Nickname.Trim().Length == 0)
                    errors.Add("[Никнейм] введите никнейм");
                else if (data.Nickname.Length > 50)
                    errors.Add("[Никнейм] максимум 50 символов");
                else if (!NicknameRegex().IsMatch(data.Nickname))
                    errors.Add("[Никнейм] недопустимые символы");
            }

            if (data.RealName != null)
            {
                if (data.RealName.Length > 100)
                    errors.Add("[Имя] максимум 100 символов");
                else if (data.RealName.Length > 0 && !NameLocationRegex().IsMatch(data.RealName))
                    errors.Add("[Имя] недопустимые символы");
            }

            if (data.Country != null)
            {
                if (data.Country.Length > 50)
                    errors.Add("[Страна] максимум 50 символов");
                else if (data.Country.Length > 0 && !NameLocationRegex().IsMatch(data.Country))
                    errors.Add("[Страна] недопустимые символы");
            }

            if (data.City != null)
            {
                if (data.City.Length > 50)
                    errors.Add("[Город] максимум 50 символов");
                else if (data.City.Length > 0 && !NameLocationRegex().IsMatch(data.City))
                    errors.Add("[Город] недопустимые символы");
            }

            if (data.Workplace != null)
            {
                if (data.Workplace.Length > 100)
                    errors.Add("[Место работы] максимум 100 символов");
                else if (data.Workplace.Length > 0 && !NameLocationRegex().IsMatch(data.Workplace))
                    errors.Add("[Место работы] недопустимые символы");
            }

            if (data.ProfileRole != null)
            {
                if (data.ProfileRole.Trim().Length == 0)
                    errors.Add("[Роль] введите роль");
                else if (data.ProfileRole.Length > 50)
                    errors.Add("[Роль] максимум 50 символов");
                else if (!RoleRegex().IsMatch(data.ProfileRole))
                    errors.Add("[Роль] недопустимые символы");
            }

            if (data.Description != null && data.Description.Length > 2000)
                errors.Add("[Описание] максимум 2000 символов");

            if (!string.IsNullOrEmpty(data.HardSkills) && !ValidateTags(data.HardSkills))
                errors.Add("[Hard skills] теги должны начинаться с # и содержать только буквы, цифры и _");

            if (!string.IsNullOrEmpty(data.SoftSkills) && !ValidateTags(data.SoftSkills))
                errors.Add("[Soft skills] теги должны начинаться с # и содержать только буквы, цифры и _");

            return errors.Count > 0 ? errors[0] : null;
        }

        // Разрешённые типы аватара
        private static readonly Dictionary<string, (string Extension, byte[][] Signatures)> AllowedAvatarTypes = new()
        {
            ["image/png"] = (".png", [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]]),
            ["image/jpeg"] = (".jpg", [[0xFF, 0xD8, 0xFF]]),
            ["image/webp"] = (".webp", [[0x52, 0x49, 0x46, 0x46]]),
        };

        private const long MaxAvatarSize = 5 * 1024 * 1024; // 5 МБ размер аватара

        // Валидация аватара
        public static (string? Error, string? Extension) ValidateAvatar(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return ("[Аватар] файл не передан", null);

            if (file.Length > MaxAvatarSize)
                return ("[Аватар] максимальный размер файла 5 МБ", null);

            var contentType = file.ContentType?.ToLowerInvariant() ?? "";
            if (!AllowedAvatarTypes.TryGetValue(contentType, out var typeInfo))
                return ("[Аватар] допустимы только PNG, JPEG или WEBP", null);

            using var stream = file.OpenReadStream();
            var header = new byte[12];
            var read = stream.Read(header, 0, header.Length);
            stream.Position = 0;

            if (read < 4)
                return ("[Аватар] повреждённый файл", null);

            var signatureMatches = typeInfo.Signatures.Any(sig =>
                sig.Length <= read && sig.SequenceEqual(header.Take(sig.Length)));

            if (!signatureMatches)
                return ("[Аватар] содержимое файла не соответствует заявленному типу", null);

            if (contentType == "image/webp")
            {
                if (read < 12 || header[8] != 0x57 || header[9] != 0x45 || header[10] != 0x42 || header[11] != 0x50)
                    return ("[Аватар] содержимое файла не соответствует заявленному типу", null);
            }

            return (null, typeInfo.Extension);
        }

        // Валидация тегов
        private static bool ValidateTags(string value)
        {
            var tags = value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return tags.All(tag => TagRegex().IsMatch(tag));
        }

        // Валидация окна регистрации/входа
        public static string? ValidateRegister(string nickname, string email, string password, string confirmPassword)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(nickname))
                errors.Add("[Никнейм] введите никнейм");
            else if (nickname.Length < 3)
                errors.Add("[Никнейм] минимум 3 символа");
            else if (nickname.Length > 50)
                errors.Add("[Никнейм] максимум 50 символов");
            else if (!NicknameRegex().IsMatch(nickname))
                errors.Add("[Никнейм] недопустимые символы");

            if (string.IsNullOrWhiteSpace(email))
                errors.Add("[Email] введите email");
            else if (email.Length > 255)
                errors.Add("[Email] максимум 255 символов");
            else if (!EmailRegex().IsMatch(email))
                errors.Add("[Email] некорректный формат");

            if (string.IsNullOrWhiteSpace(password))
                errors.Add("[Пароль] введите пароль");
            else if (password.Length < 8)
                errors.Add("[Пароль] минимум 8 символов");
            else
            {
                var hasLetter = PasswordLetterRegex().IsMatch(password);
                var hasNumber = PasswordNumberRegex().IsMatch(password);
                var hasSpecial = PasswordSpecialRegex().IsMatch(password);
                if (!hasLetter || !hasNumber || !hasSpecial)
                    errors.Add("[Пароль] должен содержать букву, цифру и спецсимвол");
            }

            if (!errors.Any(e => e.StartsWith("[Пароль]")))
            {
                if (string.IsNullOrWhiteSpace(confirmPassword))
                    errors.Add("[Подтверждение пароля] подтвердите пароль");
                else if (password != confirmPassword)
                    errors.Add("[Подтверждение пароля] пароли не совпадают");
            }

            return errors.Count > 0 ? errors[0] : null;
        }

        // Валидация смены пароля
        public static string? ValidateChangePassword(string newPassword, string confirmPassword)
        {
            if (string.IsNullOrWhiteSpace(newPassword))
                return "[Пароль] введите новый пароль";
            if (newPassword.Length < 8)
                return "[Пароль] минимум 8 символов";

            var hasLetter = PasswordLetterRegex().IsMatch(newPassword);
            var hasNumber = PasswordNumberRegex().IsMatch(newPassword);
            var hasSpecial = PasswordSpecialRegex().IsMatch(newPassword);
            if (!hasLetter || !hasNumber || !hasSpecial)
                return "[Пароль] должен содержать букву, цифру и спецсимвол";

            if (string.IsNullOrWhiteSpace(confirmPassword))
                return "[Подтверждение] подтвердите пароль";
            if (newPassword != confirmPassword)
                return "[Подтверждение] пароли не совпадают";

            return null;
        }

        // Валидация смены почты
        public static string? ValidateChangeEmail(string newEmail)
        {
            if (string.IsNullOrWhiteSpace(newEmail))
                return "[Email] введите новую почту";
            if (newEmail.Length > 255)
                return "[Email] максимум 255 символов";
            if (!EmailRegex().IsMatch(newEmail))
                return "[Email] некорректный формат";

            return null;
        }

        // Валидация проекта
        public static string? ValidateProject(string? title, string? shortDescription)
        {
            var errors = new List<string>();

            if (title != null)
            {
                if (title.Trim().Length == 0)
                    errors.Add("[Название проекта] введите название проекта");
                else if (title.Length > 50)
                    errors.Add("[Название проекта] максимум 50 символов");
            }

            if (shortDescription != null && shortDescription.Length > 150)
                errors.Add("[Краткое описание] максимум 150 символов");

            return errors.Count > 0 ? errors[0] : null;
        }

        // Валидация роли пользователя
        public static string? ValidateRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
                return "[Роль] введите роль";
            if (role.Length > 50)
                return "[Роль] максимум 50 символов";
            if (role.Length < 2)
                return "[Роль] минимум 2 символа";

            return null;
        }

        // Валидация заявок
        public static string? ValidateVacancy(string? title, string? description, string? tags)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(title))
                errors.Add("[Название роли] введите название роли");
            else if (title.Length > 50)
                errors.Add("[Название роли] максимум 50 символов");

            if (string.IsNullOrWhiteSpace(description))
                errors.Add("[Описание] введите описание");
            else if (description.Length > 500)
                errors.Add("[Описание] максимум 500 символов");

            if (string.IsNullOrWhiteSpace(tags))
                errors.Add("[Теги] введите теги");
            else if (!ValidateTags(tags))
                errors.Add("[Теги] теги должны начинаться с # и содержать только буквы, цифры и _");

            return errors.Count > 0 ? errors[0] : null;
        }
    }
}