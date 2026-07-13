using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("notifications")]
    public class Notification : BaseModel
    {
        [PrimaryKey("notification_id", false)]
        public string NotificationId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("reference_id")]
        public string ReferenceId { get; set; } = string.Empty;

        [Column("reference_type")]
        public string ReferenceType { get; set; } = string.Empty;

        [Column("context_data")]
        public object? ContextData { get; set; }

        [Column("is_read")]
        public bool IsRead { get; set; } = false;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }
    }

    public class CreateNotificationDto
    {
        public string UserId { get; set; } = string.Empty;
        public string ReferenceId { get; set; } = string.Empty;
        public string ReferenceType { get; set; } = string.Empty;
        public Dictionary<string, object> ContextData { get; set; } = [];
    }
}