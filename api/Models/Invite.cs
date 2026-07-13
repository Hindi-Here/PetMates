using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("invites")]
    public class Invite : BaseModel
    {
        [PrimaryKey("invite_id", false)]
        public string InviteId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("project_id")]
        public string ProjectId { get; set; } = string.Empty;

        [Column("role")]
        public string Role { get; set; } = string.Empty;

        [Column("status")]
        public string Status { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }
    }

    public class CreateInviteDto
    {
        public string UserId { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Status { get; set; } = "pending";
    }
}