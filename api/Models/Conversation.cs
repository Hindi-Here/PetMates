using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

[Table("conversations")]
public class Conversation : BaseModel
{
    [PrimaryKey("conversation_id", false)]
    public string ConversationId { get; set; } = string.Empty;

    [Column("user_one_id")]
    public string UserOneId { get; set; } = string.Empty;

    [Column("user_two_id")]
    public string UserTwoId { get; set; } = string.Empty;

    [Column("last_message_at")]
    public DateTime? LastMessageAt { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}

[Table("conversation_participants")]
public class ConversationParticipant : BaseModel
{
    [PrimaryKey("participant_id", false)]
    public string ParticipantId { get; set; } = string.Empty;

    [Column("conversation_id")]
    public string ConversationId { get; set; } = string.Empty;

    [Column("user_id")]
    public string UserId { get; set; } = string.Empty;

    [Column("is_pinned")]
    public bool IsPinned { get; set; }

    [Column("hidden_at")]
    public DateTime? HiddenAt { get; set; }

    [Column("last_read_at")]
    public DateTime? LastReadAt { get; set; }
}

[Table("messages")]
public class Message : BaseModel
{
    [PrimaryKey("message_id", false)]
    public string MessageId { get; set; } = string.Empty;

    [Column("conversation_id")]
    public string ConversationId { get; set; } = string.Empty;

    [Column("sender_id")]
    public string? SenderId { get; set; }

    [Column("content")]
    public string? Content { get; set; }

    [Column("is_edited")]
    public bool IsEdited { get; set; }

    [Column("is_deleted")]
    public bool IsDeleted { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
    [Column("parent_message_id")]
    public string? ParentMessageId { get; set; }

    [Column("is_forwarded")]
    public bool IsForwarded { get; set; }

    [Column("forwarded_from_nickname")]
    public string? ForwardedFromNickname { get; set; }
}

[Table("message_hidden_for_user")]
public class MessageHiddenForUser : BaseModel
{
    [Column("message_id")]
    public string MessageId { get; set; } = string.Empty;

    [Column("user_id")]
    public string UserId { get; set; } = string.Empty;
}