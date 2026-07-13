using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using System;
using System.Collections.Generic;

namespace api.Models
{
    [Table("vacancies")]
    public class Vacancy : BaseModel
    {
        [PrimaryKey("vacancy_id", false)]
        public string VacancyId { get; set; } = string.Empty;

        [Column("project_id")]
        public string ProjectId { get; set; } = string.Empty;

        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Column("role")]
        public string Role { get; set; } = string.Empty;

        [Column("description")]
        public string Description { get; set; } = string.Empty;

        [Column("required_tags")]
        public List<string> RequiredTags { get; set; } = [];

        [Column("is_open")]
        public bool IsOpen { get; set; } = true;

        [Column("published_at")]
        public DateTime? PublishedAt { get; set; }
    }

    public class CreateVacancyDto
    {
        public string ProjectId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<string> RequiredTags { get; set; } = [];
    }

    public class UpdateVacancyDto
    {
        public string? Title { get; set; }
        public string? Role { get; set; }
        public string? Description { get; set; }
        public List<string>? RequiredTags { get; set; }
        public bool? IsOpen { get; set; }
    }
}