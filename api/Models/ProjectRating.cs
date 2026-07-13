using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("project_ratings")]
    public class ProjectRating : BaseModel
    {
        [PrimaryKey("rating_id", false)]
        public string RatingId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("project_id")]
        public string ProjectId { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }
    }
}