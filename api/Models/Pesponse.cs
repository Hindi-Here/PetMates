using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("responses")]
    public class Response : BaseModel
    {
        [PrimaryKey("response_id", false)]
        public string ResponseId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("vacancy_id")]
        public string VacancyId { get; set; } = string.Empty;

        [Column("status")]
        public string Status { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; }
    }

    public class CreateResponseDto
    {
        public string UserId { get; set; } = string.Empty;
        public string VacancyId { get; set; } = string.Empty;
        public string Status { get; set; } = "pending";
    }
}