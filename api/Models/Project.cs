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

        [Column("is_private")]
        public bool IsPrivate { get; set; }
    }

    [Table("project_drafts")]
    public class ProjectDraft : BaseModel
    {
        [PrimaryKey("project_id", false)]
        [Column("project_id")]
        public string ProjectId { get; set; } = string.Empty;

        [Column("title")]
        public string? Title { get; set; }

        [Column("short_description")]
        public string? ShortDescription { get; set; }

        [Column("full_description")]
        public string? FullDescription { get; set; }

        [Column("status")]
        public string? Status { get; set; }

        [Column("is_private")]
        public bool? IsPrivate { get; set; }

        [Column("vacancies_draft")]
        public string? VacanciesDraft { get; set; }

        [Column("deleted_vacancy_ids")]
        public string? DeletedVacancyIds { get; set; }

        [Column("deleted_member_ids")]
        public string? DeletedMemberIds { get; set; }

        [Column("edited_roles")]
        public string? EditedRoles { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }
    }
}