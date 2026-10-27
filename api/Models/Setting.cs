namespace api.Models
{
    public class ChangePasswordRequest
    {
        public string OldPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    public class ChangeEmailRequest
    {
        public string NewEmail { get; set; } = string.Empty;
        public string ConfirmCode { get; set; } = string.Empty;
    }

    public class VerifyNicknameRequest
    {
        public string Nickname { get; set; } = string.Empty;
    }

    public class DeleteAccountRequest
    {
        public string Nickname { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}