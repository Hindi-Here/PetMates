using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

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
}