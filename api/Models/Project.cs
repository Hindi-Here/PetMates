using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("projects")] 
    public class Project : BaseModel
    {
        [PrimaryKey("project_id", false)]
        public string ProjectId { get; set; } = string.Empty;

        [Column("owner_id")]
        public string OwnerId { get; set; } = string.Empty;

        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Column("short_description")]
        public string? ShortDescription { get; set; }

        [Column("full_description")]
        public string? FullDescription { get; set; }

        [Column("status")]
        public string Status { get; set; } = "В процессе";

        [Column("status_changed_at")]
        public DateTime? StatusChangedAt { get; set; }

        [Column("rating_count")]
        public int RatingCount { get; set; } = 0;

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }
    }
}