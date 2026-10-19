namespace api.Models
{
    public class BanUserDto
    {
        public string? Reason { get; set; }
    }
    public class SetRoleDto
    {
        public string Role { get; set; } = string.Empty;
    }
    public class DeleteProjectWithReasonDto
    {
        public string? Reason { get; set; }
    }
    public class DeleteVacancyWithReasonDto
    {
        public string? Reason { get; set; }
    }
}
