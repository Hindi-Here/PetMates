using System.Text.RegularExpressions;

namespace api.Support
{
    public class Validator
    {
        public static string? ValidateProfile(Models.User data)
        {
            var errors = new List<string>();

            if (data.Nickname != null)
            {
                if (data.Nickname.Trim().Length == 0)
                    errors.Add("[Никнейм] введите никнейм");
                else if (data.Nickname.Length > 50)
                    errors.Add("[Никнейм] максимум 50 символов");
                else if (!Regex.IsMatch(data.Nickname, @"^[a-zA-Zа-яА-Я0-9_-]+$"))
                    errors.Add("[Никнейм] недопустимые символы");
            }

            if (data.RealName != null)
            {
                if (data.RealName.Length > 100)
                    errors.Add("[Имя] максимум 100 символов");
                else if (data.RealName.Length > 0 && !Regex.IsMatch(data.RealName, @"^[a-zA-Zа-яА-Я0-9ёЁ\s\-""'.,()\/]+$"))
                    errors.Add("[Имя] недопустимые символы");
            }

            if (data.Country != null)
            {
                if (data.Country.Length > 50)
                    errors.Add("[Страна] максимум 50 символов");
                else if (data.Country.Length > 0 && !Regex.IsMatch(data.Country, @"^[a-zA-Zа-яА-Я0-9ёЁ\s\-""'.,()\/]+$"))
                    errors.Add("[Страна] недопустимые символы");
            }

            if (data.City != null)
            {
                if (data.City.Length > 50)
                    errors.Add("[Город] максимум 50 символов");
                else if (data.City.Length > 0 && !Regex.IsMatch(data.City, @"^[a-zA-Zа-яА-Я0-9ёЁ\s\-""'.,()\/]+$"))
                    errors.Add("[Город] недопустимые символы");
            }

            if (data.Workplace != null)
            {
                if (data.Workplace.Length > 100)
                    errors.Add("[Место работы] максимум 100 символов");
                else if (data.Workplace.Length > 0 && !Regex.IsMatch(data.Workplace, @"^[a-zA-Zа-яА-Я0-9ёЁ\s\-""'.,()\/]+$"))
                    errors.Add("[Место работы] недопустимые символы");
            }

            if (data.ProfileRole != null)
            {
                if (data.ProfileRole.Trim().Length == 0)
                    errors.Add("[Роль] введите роль");
                else if (data.ProfileRole.Length > 50)
                    errors.Add("[Роль] максимум 50 символов");
                else if (!Regex.IsMatch(data.ProfileRole, @"^[a-zA-Zа-яА-Я0-9ёЁ\/\[\]\-\s]+$"))
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

        private static bool ValidateTags(string value)
        {
            var tags = value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return tags.All(tag => Regex.IsMatch(tag, @"^#[a-zA-Zа-яА-Я0-9_\/]+$"));
        }

        public static string? ValidateRegister(string nickname, string email, string password, string confirmPassword)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(nickname))
                errors.Add("[Никнейм] введите никнейм");
            else if (nickname.Length < 3)
                errors.Add("[Никнейм] минимум 3 символа");
            else if (nickname.Length > 50)
                errors.Add("[Никнейм] максимум 50 символов");
            else if (!Regex.IsMatch(nickname, @"^[a-zA-Zа-яА-Я0-9_-]+$"))
                errors.Add("[Никнейм] недопустимые символы");

            if (string.IsNullOrWhiteSpace(email))
                errors.Add("[Email] введите email");
            else if (email.Length > 255)
                errors.Add("[Email] максимум 255 символов");
            else if (!Regex.IsMatch(email, @"^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$"))
                errors.Add("[Email] некорректный формат");

            if (string.IsNullOrWhiteSpace(password))
                errors.Add("[Пароль] введите пароль");
            else if (password.Length < 8)
                errors.Add("[Пароль] минимум 8 символов");
            else
            {
                var hasLetter = Regex.IsMatch(password, @"[A-Za-zА-Яа-я]");
                var hasNumber = Regex.IsMatch(password, @"[0-9]");
                var hasSpecial = Regex.IsMatch(password, @"[!@#$%^&*()\-_=+\[\]{};':""\\|,.<>\/?]");
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

        public static string? ValidateChangePassword(string newPassword, string confirmPassword)
        {
            if (string.IsNullOrWhiteSpace(newPassword))
                return "[Пароль] введите новый пароль";
            if (newPassword.Length < 8)
                return "[Пароль] минимум 8 символов";

            var hasLetter = Regex.IsMatch(newPassword, @"[A-Za-zА-Яа-я]");
            var hasNumber = Regex.IsMatch(newPassword, @"[0-9]");
            var hasSpecial = Regex.IsMatch(newPassword, @"[!@#$%^&*()\-_=+\[\]{};':""\\|,.<>\/?]");
            if (!hasLetter || !hasNumber || !hasSpecial)
                return "[Пароль] должен содержать букву, цифру и спецсимвол";

            if (string.IsNullOrWhiteSpace(confirmPassword))
                return "[Подтверждение] подтвердите пароль";
            if (newPassword != confirmPassword)
                return "[Подтверждение] пароли не совпадают";

            return null;
        }

        public static string? ValidateChangeEmail(string newEmail)
        {
            if (string.IsNullOrWhiteSpace(newEmail))
                return "[Email] введите новую почту";
            if (newEmail.Length > 255)
                return "[Email] максимум 255 символов";
            if (!Regex.IsMatch(newEmail, @"^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$"))
                return "[Email] некорректный формат";

            return null;
        }
    }
}
