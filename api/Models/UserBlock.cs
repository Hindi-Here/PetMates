using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using System;

namespace api.Models
{
    [Table("user_blocks")]
    public class UserBlock : BaseModel
    {
        [PrimaryKey("blocker_id", false)]
        [Column("blocker_id")]
        public string BlockerId { get; set; } = string.Empty;

        [PrimaryKey("blocked_id", false)]
        [Column("blocked_id")]
        public string BlockedId { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}