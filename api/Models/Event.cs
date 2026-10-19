using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("events")]
    public class Event : BaseModel
    {
        [PrimaryKey("event_id", false)]
        public string EventId { get; set; } = string.Empty;

        [Column("owner_id")]
        public string OwnerId { get; set; } = string.Empty;

        [Column("title")]
        public string Title { get; set; } = string.Empty;

        [Column("short_description")]
        public string? ShortDescription { get; set; }

        [Column("status")]
        public string Status { get; set; } = "in_progress";

        [Column("status_changed_at")]
        public DateTime? StatusChangedAt { get; set; }

        [Column("event_start_date")]
        public string? EventStartDate { get; set; }

        [Column("event_end_date")]
        public string? EventEndDate { get; set; }

        [Column("is_private")]
        public bool IsPrivate { get; set; }

        [Column("rating_count")]
        public int RatingCount { get; set; } = 0;

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("participant_limit")]
        public int? ParticipantLimit { get; set; }

        [Column("stages")]
        public string Stages { get; set; } = "[]";

        [Column("application_form")]
        public string ApplicationForm { get; set; } = "[]";

        [Column("results")]
        public string? Results { get; set; }
    }

    [Table("event_members")]
    public class EventMember : BaseModel
    {
        [PrimaryKey("member_id", false)]
        public string MemberId { get; set; } = string.Empty;

        [Column("event_id")]
        public string EventId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("joined_at")]
        public DateTime? JoinedAt { get; set; }
    }

    [Table("event_ratings")]
    public class EventRating : BaseModel
    {
        [PrimaryKey("rating_id", false)]
        public string RatingId { get; set; } = string.Empty;

        [Column("event_id")]
        public string EventId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }
    }

    [Table("event_applications")]
    public class EventApplication : BaseModel
    {
        [PrimaryKey("application_id", false)]
        public string ApplicationId { get; set; } = string.Empty;

        [Column("event_id")]
        public string EventId { get; set; } = string.Empty;

        [Column("user_id")]
        public string UserId { get; set; } = string.Empty;

        [Column("status")]
        public string Status { get; set; } = "pending";

        [Column("answers")]
        public string Answers { get; set; } = "[]";

        [Column("decision_comment")]
        public string? DecisionComment { get; set; }

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }
    }

    [Table("event_drafts")]
    public class EventDraft : BaseModel
    {
        [PrimaryKey("event_id", false)]
        [Column("event_id")]
        public string EventId { get; set; } = string.Empty;

        [Column("general")]
        public string? General { get; set; }

        [Column("form")]
        public string? Form { get; set; }

        [Column("results")]
        public string? Results { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }
    }

    public class EventApplicationAnswer
    {
        public string FieldId { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public bool Required { get; set; }
        public string Value { get; set; } = string.Empty;
    }

    public class EventApplicationAnswerInput
    {
        public string FieldId { get; set; } = string.Empty;
        public string? Value { get; set; }
    }

    public class SubmitEventApplicationDto
    {
        public List<EventApplicationAnswerInput>? Answers { get; set; }
    }

    public class EventApplicationDecisionDto
    {
        public string Decision { get; set; } = string.Empty;
        public string? Comment { get; set; }
    }

    public class CreateEventDto
    {
        public string Title { get; set; } = string.Empty;
        public string? ShortDescription { get; set; }
        public string? Status { get; set; }
        public bool IsPrivate { get; set; } = false;

        public DateTime? EventStartDate { get; set; }
        public DateTime? EventEndDate { get; set; }
    }

    public class DeleteEventWithReasonDto
    {
        public string? Reason { get; set; }
    }

    public class EventStageItem
    {
        public string Title { get; set; } = string.Empty;
        public string StartDate { get; set; } = string.Empty;
        public string EndDate { get; set; } = string.Empty;
        public bool AcceptsApplications { get; set; }
    }

    public class UpdateEventDto
    {
        public string Title { get; set; } = string.Empty;
        public string? ShortDescription { get; set; }
        public string? Status { get; set; }
        public bool IsPrivate { get; set; }

        public DateTime? EventStartDate { get; set; }
        public DateTime? EventEndDate { get; set; }
        public int? ParticipantLimit { get; set; }
        public string? Description { get; set; }
        public List<EventStageItem>? Stages { get; set; }
    }

    public class EventFormField
    {
        public string Id { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public bool Required { get; set; }
    }

    public class UpdateEventFormDto
    {
        public List<EventFormField>? Fields { get; set; }
    }

    public class UpdateEventResultsDto
    {
        public string? Results { get; set; }
    }
}