using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("users")]
    public class User : BaseModel
    {
        [PrimaryKey("user_id")]
        [Column("user_id")]
        public string? UserId { get; set; }

        [Column("nickname")]
        public string? Nickname { get; set; }

        [Column("avatar_url")]
        public string? AvatarUrl { get; set; }

        [Column("real_name")]
        public string? RealName { get; set; }

        [Column("age")]
        public int? Age { get; set; }

        [Column("gender")]
        public string? Gender { get; set; }

        [Column("country")]
        public string? Country { get; set; }

        [Column("city")]
        public string? City { get; set; }

        [Column("workplace")]
        public string? Workplace { get; set; }

        [Column("profile_role")]
        public string? ProfileRole { get; set; }

        [Column("system_role")]
        public string? SystemRole { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("hard_skills")]
        public string? HardSkills { get; set; }

        [Column("soft_skills")]
        public string? SoftSkills { get; set; }

        [Column("contacts")]
        public string? Contacts { get; set; }

        [Column("last_online_at")]
        public DateTime? LastOnlineAt { get; set; }

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }
    }
}