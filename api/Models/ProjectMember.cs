using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using System.Text.Json.Serialization;

namespace api.Models
{
    [Table("project_members")] 
    public class ProjectMember : BaseModel
    {
        [PrimaryKey("member_id", false)]  
        public string MemberId { get; set; } = string.Empty;

        [Column("project_id")]
        public string ProjectId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("role")]
        public string Role { get; set; } = "Участник";

        [Column("joined_at")]
        public DateTime? JoinedAt { get; set; }
    }

    public class TeamMemberCardRow
    {
        [JsonPropertyName("user_id")]
        public string UserId { get; set; } = string.Empty;

        [JsonPropertyName("nickname")]
        public string? Nickname { get; set; }

        [JsonPropertyName("avatar_url")]
        public string? AvatarUrl { get; set; }

        [JsonPropertyName("real_name")]
        public string? RealName { get; set; }

        [JsonPropertyName("age")]
        public int? Age { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("workplace")]
        public string? Workplace { get; set; }

        [JsonPropertyName("profile_role")]
        public string? ProfileRole { get; set; }

        [JsonPropertyName("system_role")]
        public string? SystemRole { get; set; }

        [JsonPropertyName("is_banned")]
        public bool IsBanned { get; set; }

        [JsonPropertyName("hard_skills")]
        public object? HardSkills { get; set; }

        [JsonPropertyName("soft_skills")]
        public object? SoftSkills { get; set; }

        [JsonPropertyName("last_online_at")]
        public DateTime? LastOnlineAt { get; set; }
    }

    public class UpdateRoleDto
    {
        public string Role { get; set; } = string.Empty;
    }

    public class FindByEmailDto
    {
        public string Email { get; set; } = string.Empty;
    }

    public class AuthUsersResponse
    {
        public List<AuthUserResponse> Users { get; set; } = [];
    }

    public class AuthUserResponse
    {
        public string Id { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string Aud { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public class AddProjectMemberDto
    {
        public string ProjectId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public string Role { get; set; } = "Участник";
    }
}