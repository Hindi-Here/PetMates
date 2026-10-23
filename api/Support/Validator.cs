using System.Globalization;
using System.Text.RegularExpressions;
using static System.Runtime.InteropServices.JavaScript.JSType;

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
                else if (data.Nickname.Length < Limits.Auth.NicknameMin)
                    errors.Add($"[Никнейм] минимум {Limits.Auth.NicknameMin} символа");
                else if (data.Nickname.Length > Limits.Auth.NicknameMax)
                    errors.Add($"[Никнейм] максимум {Limits.Auth.NicknameMax} символов");
                else if (!NicknameRegex().IsMatch(data.Nickname))
                    errors.Add("[Никнейм] недопустимые символы");
            }

            if (data.RealName != null)
            {
                if (data.RealName.Length > Limits.Profile.RealNameMax)
                    errors.Add($"[Имя] максимум {Limits.Profile.RealNameMax} символов");
                else if (data.RealName.Length > 0 && !NameLocationRegex().IsMatch(data.RealName))
                    errors.Add("[Имя] недопустимые символы");
            }

            if (data.Country != null)
            {
                if (data.Country.Length > Limits.Profile.CountryMax)
                    errors.Add($"[Страна] максимум {Limits.Profile.CountryMax} символов");
                else if (data.Country.Length > 0 && !NameLocationRegex().IsMatch(data.Country))
                    errors.Add("[Страна] недопустимые символы");
            }

            if (data.City != null)
            {
                if (data.City.Length > Limits.Profile.CityMax)
                    errors.Add($"[Город] максимум {Limits.Profile.CityMax} символов");
                else if (data.City.Length > 0 && !NameLocationRegex().IsMatch(data.City))
                    errors.Add("[Город] недопустимые символы");
            }

            if (data.Workplace != null)
            {
                if (data.Workplace.Length > Limits.Profile.WorkplaceMax)
                    errors.Add($"[Место работы] максимум {Limits.Profile.WorkplaceMax} символов");
                else if (data.Workplace.Length > 0 && !NameLocationRegex().IsMatch(data.Workplace))
                    errors.Add("[Место работы] недопустимые символы");
            }

            if (data.ProfileRole != null)
            {
                if (data.ProfileRole.Trim().Length == 0)
                    errors.Add("[Роль] введите роль");
                else if (data.ProfileRole.Length > Limits.Profile.RoleMax)
                    errors.Add($"[Роль] максимум {Limits.Profile.RoleMax} символов");
                else if (!RoleRegex().IsMatch(data.ProfileRole))
                    errors.Add("[Роль] недопустимые символы");
            }

            if (data.Description != null && data.Description.Length > Limits.Profile.DescriptionMax)
                errors.Add($"[Описание] максимум {Limits.Profile.DescriptionMax} символов");

            if (!string.IsNullOrEmpty(data.HardSkills))
            {
                if (data.HardSkills.Length > Limits.Profile.SkillsMax)
                    errors.Add($"[Hard skills] максимум {Limits.Profile.SkillsMax} символов");
                else if (!ValidateTags(data.HardSkills))
                    errors.Add("[Hard skills] теги должны начинаться с # и содержать только буквы, цифры и _");
            }

            if (!string.IsNullOrEmpty(data.SoftSkills))
            {
                if (data.SoftSkills.Length > Limits.Profile.SkillsMax)
                    errors.Add($"[Soft skills] максимум {Limits.Profile.SkillsMax} символов");
                else if (!ValidateTags(data.SoftSkills))
                    errors.Add("[Soft skills] теги должны начинаться с # и содержать только буквы, цифры и _");
            }

            return errors.Count > 0 ? errors[0] : null;
        }

        // Валидация автара
        public static (string? Error, string? Extension) ValidateAvatar(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return ("[Аватар] файл не передан", null);

            if (file.Length > Limits.Upload.AvatarMaxBytes)
                return ($"[Аватар] максимальный размер файла {Limits.Upload.AvatarMaxBytes / Limits.MB} МБ", null);

            using var stream = file.OpenReadStream();
            var h = new byte[12];
            var read = stream.Read(h, 0, h.Length);

            string? extension = null;
            if (read >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47)
                extension = ".png";
            else if (read >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)
                extension = ".jpg";
            else if (read >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                     && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P')
                extension = ".webp";

            return extension == null
                ? ("[Аватар] допустимы только PNG, JPEG или WEBP", null)
                : (null, extension);
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
            else if (nickname.Length < Limits.Auth.NicknameMin)
                errors.Add($"[Никнейм] минимум {Limits.Auth.NicknameMin} символа");
            else if (nickname.Length > Limits.Auth.NicknameMax)
                errors.Add($"[Никнейм] максимум {Limits.Auth.NicknameMax} символов");
            else if (!NicknameRegex().IsMatch(nickname))
                errors.Add("[Никнейм] недопустимые символы");

            if (string.IsNullOrWhiteSpace(email))
                errors.Add("[Email] введите email");
            else if (email.Length > Limits.Auth.EmailMax)
                errors.Add($"[Email] максимум {Limits.Auth.EmailMax} символов");
            else if (!EmailRegex().IsMatch(email))
                errors.Add("[Email] некорректный формат");

            if (string.IsNullOrWhiteSpace(password))
                errors.Add("[Пароль] введите пароль");
            else if (password.Length < Limits.Auth.PasswordMin)
                errors.Add($"[Пароль] минимум {Limits.Auth.PasswordMin} символов");
            else if (password.Length > Limits.Auth.PasswordMax)
                errors.Add($"[Пароль] максимум {Limits.Auth.PasswordMax} символов");
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

            if (newPassword.Length < Limits.Auth.PasswordMin)
                return $"[Пароль] минимум {Limits.Auth.PasswordMin} символов";
            else if (newPassword.Length > Limits.Auth.PasswordMax)
                return $"[Пароль] максимум {Limits.Auth.PasswordMax} символов";

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

            if (newEmail.Length > Limits.Auth.EmailMax)
                return $"[Email] максимум {Limits.Auth.EmailMax} символов";

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
                else if (title.Length > Limits.Project.TitleMax)
                    errors.Add($"[Название проекта] максимум {Limits.Project.TitleMax} символов");
            }

            if (shortDescription != null && shortDescription.Length > Limits.Project.ShortDescriptionMax)
                errors.Add($"[Краткое описание] максимум {Limits.Project.ShortDescriptionMax} символов");

            return errors.Count > 0 ? errors[0] : null;
        }

        // Валидация роли пользователя
        public static string? ValidateRole(string? role)
        {
            if (string.IsNullOrWhiteSpace(role))
                return "[Роль] введите роль";

            if (role.Length > Limits.Member.RoleMax)
                return $"[Роль] максимум {Limits.Member.RoleMax} символов";

            if (role.Length < Limits.Member.RoleMin)
                return $"[Роль] минимум {Limits.Member.RoleMin} символа";

            return null;
        }

        // Валидация заявок
        public static string? ValidateVacancy(string? title, string? description, string? tags)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(title))
                errors.Add("[Название роли] введите название роли");
            else if (title.Length > Limits.Vacancy.TitleMax)
                errors.Add($"[Название роли] максимум {Limits.Vacancy.TitleMax} символов");

            if (string.IsNullOrWhiteSpace(description))
                errors.Add("[Описание] введите описание");
            else if (description.Length > Limits.Vacancy.DescriptionMax)
                errors.Add($"[Описание] максимум {Limits.Vacancy.DescriptionMax} символов");

            if (string.IsNullOrWhiteSpace(tags))
                errors.Add("[Теги] введите теги");
            else if (!ValidateTags(tags))
                errors.Add("[Теги] теги должны начинаться с # и содержать только буквы, цифры и _");

            return errors.Count > 0 ? errors[0] : null;
        }

        public static readonly string[] EventMediaSections = ["description", "results"];

        [GeneratedRegex(@"^[A-Za-z0-9_\-]{1,40}$")]
        private static partial Regex FormFieldIdRegex();

        [GeneratedRegex(@"^[A-Za-z0-9\-]+\.(png|jpg|webp|gif)$")]
        private static partial Regex EventMediaFileNameRegex();

        // Валидация создания мероприятия
        public static string? ValidateEventCreate(Models.CreateEventDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
                return "[Название мероприятия] введите название мероприятия";

            if (dto.Title.Trim().Length > Limits.Event.TitleMax)
                return $"[Название мероприятия] максимум {Limits.Event.TitleMax} символов";

            if (dto.ShortDescription != null && dto.ShortDescription.Length > Limits.Event.ShortDescriptionMax)
                return $"[Краткое описание] максимум {Limits.Event.ShortDescriptionMax} символов";

            if (dto.EventStartDate > dto.EventEndDate)
                return "[Даты мероприятия] дата окончания раньше даты начала";

            return null;
        }

        // Валидация сохранения подраздела «Общее»
        public static string? ValidateEventUpdate(Models.UpdateEventDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
                return "[Название мероприятия] введите название мероприятия";

            if (dto.Title.Trim().Length > Limits.Event.TitleMax)
                return $"[Название мероприятия] максимум {Limits.Event.TitleMax} символов";

            if (string.IsNullOrWhiteSpace(dto.ShortDescription))
                return "[Краткое описание] введите краткое описание";

            if (dto.ShortDescription.Trim().Length > Limits.Event.ShortDescriptionMax)
                return $"[Краткое описание] максимум {Limits.Event.ShortDescriptionMax} символов";

            if (dto.Description != null && dto.Description.Length > Limits.LongTextMax)
                return $"[Описание] максимум {Limits.LongTextMax} символов";

            if (dto.EventStartDate == null || dto.EventEndDate == null)
                return "[Период проведения] укажите даты проведения";

            if (dto.EventStartDate > dto.EventEndDate)
                return "[Период проведения] дата окончания раньше даты начала";

            if (dto.ParticipantLimit is < Limits.Event.ParticipantLimitMin or > Limits.Event.ParticipantLimitMax)
                return $"[Лимит участников] допустимо от {Limits.Event.ParticipantLimitMin} до {Limits.Event.ParticipantLimitMax}";

            var stages = dto.Stages ?? [];
            if (stages.Count > Limits.Event.StagesMax)
                return $"[Этапы] максимум {Limits.Event.StagesMax} этапов";

            foreach (var s in stages)
            {
                if (string.IsNullOrWhiteSpace(s.Title) || s.Title.Trim().Length > Limits.Event.StageTitleMax)
                    return $"[Этапы] название этапа от 1 до {Limits.Event.StageTitleMax} символов";

                if (!DateTime.TryParseExact(s.StartDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start)
                    || !DateTime.TryParseExact(s.EndDate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var end))
                    return "[Этапы] укажите даты этапа";

                if (start > end)
                    return "[Этапы] дата окончания этапа раньше даты начала";

                if (start < dto.EventStartDate.Value.Date || end > dto.EventEndDate.Value.Date)
                    return "[Этапы] этап должен входить в период проведения";
            }

            return null;
        }

        // Валидация формы заявки (стандартных полей больше нет)
        public static string? ValidateEventForm(List<Models.EventFormField> fields)
        {
            if (fields.Count > Limits.Event.FormFieldsMax)
                return $"[Форма] максимум {Limits.Event.FormFieldsMax} полей";

            var ids = new HashSet<string>();
            var labels = new HashSet<string>();

            foreach (var f in fields)
            {
                var id = f.Id?.Trim() ?? "";
                var label = f.Label?.Trim() ?? "";

                if (!FormFieldIdRegex().IsMatch(id))
                    return "[Форма] некорректный идентификатор поля";

                if (!ids.Add(id))
                    return "[Форма] идентификаторы полей должны быть уникальны";

                if (label.Length == 0 || label.Length > Limits.Event.FormLabelMax)
                    return $"[Форма] название критерия от 1 до {Limits.Event.FormLabelMax} символов";

                if (!labels.Add(label.ToLowerInvariant()))
                    return "[Форма] названия критериев не должны повторяться";
            }

            return null;
        }

        // Разделы черновика мероприятия
        public static readonly string[] EventDraftSections = ["general", "form", "results"];

        // Валидация раздела черновика
        public static string? ValidateEventDraftSection(string section)
        {
            return EventDraftSections.Contains(section) ? null : "[Черновик] недопустимый раздел";
        }

        // Валидация объёма данных черновика
        public static string? ValidateEventDraftPayload(string raw)
        {
            return raw.Length > Limits.Event.DraftPayloadMax
                ? $"[Черновик] слишком большой объём данных (максимум {Limits.Event.DraftPayloadMax})"
                : null;
        }

        // Валидация результатов мероприятия
        public static string? ValidateEventResults(string? results)
        {
            if (results != null && results.Length > Limits.LongTextMax)
                return $"[Результаты] максимум {Limits.LongTextMax} символов";
            return null;
        }

        // Валидация подраздела медиа
        public static string? ValidateEventMediaSection(string section)
        {
            return EventMediaSections.Contains(section) ? null : "[Медиа] недопустимый раздел";
        }

        // Валидация имени файла медиа
        public static string? ValidateEventMediaFileName(string fileName)
        {
            return EventMediaFileNameRegex().IsMatch(fileName) ? null : "[Медиа] недопустимое имя файла";
        }

        // Валидация изображения мероприятия (тип определяется по сигнатуре файла)
        public static (string? Error, string? Extension) ValidateEventImage(IFormFile? file)
        {
            if (file == null || file.Length == 0)
                return ("[Изображение] файл не передан", null);

            if (file.Length > Limits.Upload.ImageMaxBytes)
                return ($"[Изображение] максимальный размер файла {Limits.Upload.ImageMaxBytes / Limits.MB} МБ", null);

            using var stream = file.OpenReadStream();
            var h = new byte[12];
            var read = stream.Read(h, 0, h.Length);
            string? extension = null;

            if (read >= 8 && h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47)
                extension = ".png";
            else if (read >= 3 && h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF)
                extension = ".jpg";
            else if (read >= 12 && h[0] == 'R' && h[1] == 'I' && h[2] == 'F' && h[3] == 'F'
                     && h[8] == 'W' && h[9] == 'E' && h[10] == 'B' && h[11] == 'P')
                extension = ".webp";
            else if (read >= 6 && h[0] == 'G' && h[1] == 'I' && h[2] == 'F' && h[3] == '8')
                extension = ".gif";

            return extension == null
                ? ("[Изображение] допустимы только PNG, JPEG, WEBP или GIF", null)
                : (null, extension);
        }

        // Валидация длинного описания проекта
        public static string? ValidateProjectDescription(string? description)
        {
            if (description != null && description.Length > Limits.LongTextMax)
                return $"[Описание] максимум {Limits.LongTextMax} символов";
            return null;
        }

        // Валидация ответов в заявке на участие
        public static string? ValidateEventApplication(
            List<Models.EventApplicationAnswerInput> inputs,
            IEnumerable<Models.EventFormField> fields)
        {
            var formFields = fields.ToDictionary(f => f.Id);
            var seen = new HashSet<string>();

            foreach (var input in inputs)
            {
                var fieldId = input.FieldId ?? "";
                if (!formFields.ContainsKey(fieldId))
                    return "[Заявка] неизвестное поле формы";

                if (!seen.Add(fieldId))
                    return "[Заявка] поля формы не должны повторяться";

                if ((input.Value ?? "").Length > Limits.Event.ApplicationAnswerMax)
                    return $"[Заявка] ответ: максимум {Limits.Event.ApplicationAnswerMax} символов";
            }

            foreach (var field in formFields.Values.Where(f => f.Required))
            {
                var value = inputs.FirstOrDefault(i => i.FieldId == field.Id)?.Value;
                if (string.IsNullOrWhiteSpace(value))
                    return $"[Заявка] заполните обязательное поле «{field.Label}»";
            }

            return null;
        }

        // Валидация решения автора по заявке
        public static string? ValidateEventApplicationDecision(Models.EventApplicationDecisionDto dto)
        {
            if (dto.Decision is not ("accept" or "reject" or "revision"))
                return "[Решение] недопустимое решение";

            var comment = dto.Comment?.Trim() ?? "";
            if (comment.Length > Limits.Event.DecisionCommentMax)
                return $"[Комментарий] максимум {Limits.Event.DecisionCommentMax} символов";

            if (dto.Decision == "revision" && comment.Length == 0)
                return "[Комментарий] опишите, что нужно доработать";

            return null;
        }

        // Валидация обязательного текста с ограничением длины
        public static string? ValidateRequiredText(string? value, int max, string field)
        {
            if (string.IsNullOrWhiteSpace(value))
                return $"[{field}] поле не может быть пустым";

            return value.Length > max ? $"[{field}] максимум {max} символов" : null;
        }

        // Валидация необязательного текста с ограничением длины
        public static string? ValidateOptionalText(string? value, int max, string field) =>
            value != null && value.Length > max ? $"[{field}] максимум {max} символов" : null;

        // Валидация комментария
        public static string? ValidateComment(string? content) =>
            ValidateRequiredText(content, Limits.Comment.MaxLength, "Комментарий");

        // Валидация сообщения чата
        public static string? ValidateChatMessage(string? content) =>
            ValidateRequiredText(content, Limits.Chat.MaxLength, "Сообщение");

        // Валидация причины модерации
        public static string? ValidateModerationReason(string? reason) =>
            ValidateOptionalText(reason, Limits.Moderation.ReasonMax, "Причина");
    }
}