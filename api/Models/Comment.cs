using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace api.Models
{
    [Table("comments")]
    public class Comment : BaseModel
    {
        [PrimaryKey("comment_id", false)]
        public string CommentId { get; set; } = string.Empty;

        [Column("reference_id")]
        public string ReferenceId { get; set; } = string.Empty;

        [Column("reference_type")]
        public string ReferenceType { get; set; } = string.Empty;

        [Column("user_id")]
        public string? UserId { get; set; }

        [Column("parent_comment_id")]
        public string? ParentCommentId { get; set; }

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
    }

    [Table("comment_mentions")]
    public class CommentMention : BaseModel
    {
        [PrimaryKey("mention_id", false)]
        public string MentionId { get; set; } = string.Empty;

        [Column("comment_id")]
        public string CommentId { get; set; } = string.Empty;

        [Column("mentioned_user_id")]
        public string MentionedUserId { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }
    }
}