namespace api.Support
{
    public static class Limits
    {
        public const long KB = 1024;
        public const long MB = 1024 * KB;

        public const int LongTextMax = 20_000;

        public static class Auth
        {
            public const int NicknameMin = 3;
            public const int NicknameMax = 50;
            public const int EmailMax = 255;
            public const int PasswordMin = 8;
            public const int PasswordMax = 255; 
        }

        public static class Profile
        {
            public const int RealNameMax = 100;
            public const int CountryMax = 50;
            public const int CityMax = 50;
            public const int WorkplaceMax = 100;
            public const int RoleMax = 50;
            public const int DescriptionMax = 2000;
            public const int SkillsMax = 250; 
        }

        public static class Member
        {
            public const int RoleMin = 2;
            public const int RoleMax = 50;
        }

        public static class Project
        {
            public const int TitleMax = 50;
            public const int ShortDescriptionMax = 150;
        }

        public static class Vacancy
        {
            public const int TitleMax = 50;
            public const int DescriptionMax = 500;
        }

        public static class Event
        {
            public const int TitleMax = 50;
            public const int ShortDescriptionMax = 150;
            public const int ParticipantLimitMin = 1;
            public const int ParticipantLimitMax = 100_000;
            public const int StagesMax = 20;
            public const int StageTitleMax = 50;
            public const int FormFieldsMax = 50;
            public const int FormLabelMax = 100;
            public const int FormFieldIdMax = 40;
            public const int ApplicationAnswerMax = 2000;
            public const int DecisionCommentMax = 1000;
            public const int DraftPayloadMax = 100_000;

            public const int ApplicationSnippetMax = 160;
        }

        public static class Upload
        {
            public const long AvatarMaxBytes = 5 * MB;
            public const long AvatarRequestBytes = AvatarMaxBytes + 512 * KB;

            public const long MediaTotalMaxBytes = 50 * MB; 
            public const long ImageMaxBytes = MediaTotalMaxBytes;
            public const long MediaRequestBytes = MediaTotalMaxBytes + 2 * MB;
        }

        public static class Report
        {
            public const int MessageMax = 1024;
            public const long AttachmentsMaxBytes = 50 * MB;
            public const long RequestBytes = AttachmentsMaxBytes + 5 * MB;
            public const int NicknameMax = 50;
        }

        public static class Search
        {
            public const int UserQueryMin = 2;
            public const int UserResultsMax = 20;
        }

        public static class Comment
        {
            public const int MaxLength = 2000;
        }

        public static class Chat
        {
            public const int MaxLength = 2000;
        }

        public static class Moderation
        {
            public const int ReasonMax = 1024;
        }

        public const int OnlineThresholdMinutes = 2;
    }
}