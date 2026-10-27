using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("user_blocks")]
    public class UserBlock : BaseModel
    {
        [Column("blocker_id")]
        public string BlockerId { get; set; } = string.Empty;

        [Column("blocked_id")]
        public string BlockedId { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }
    }
}