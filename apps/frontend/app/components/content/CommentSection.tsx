import { useState } from "react";
import { MessageCircle, Trash2, Reply, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar } from "~/components/ui/Avatar";
import { Button } from "~/components/ui/Button";
import { Badge } from "~/components/ui/Badge";

export interface Comment {
  id: string;
  content: string;
  author: {
    name: string;
    avatarUrl?: string | null;
    username: string;
  };
  createdAt: string;
  isDeleted: boolean;
  isVerified: boolean;
  isOwnComment: boolean;
  replies: Comment[];
}

interface CommentItemProps {
  comment: Comment;
  depth?: number;
  maxDepth?: number;
  onReply?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  isEditor?: boolean;
}

function CommentItem({
  comment,
  depth = 0,
  maxDepth = 3,
  onReply,
  onDelete,
  isEditor = false,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [showReplies, setShowReplies] = useState(true);

  const handleSubmitReply = () => {
    if (replyContent.trim() && onReply) {
      onReply(comment.id, replyContent.trim());
      setReplyContent("");
      setIsReplying(false);
    }
  };

  const canDelete = comment.isOwnComment || isEditor;

  return (
    <article className={depth > 0 ? "comment-indent" : ""}>
      <section className="py-3">
        {comment.isDeleted ? (
          <p className="text-body-sm text-on-surface-muted italic">[Deleted]</p>
        ) : (
          <>
            <header className="flex items-center gap-2 mb-1.5">
              <Avatar src={comment.author.avatarUrl} alt={comment.author.name} size="sm" />
              <span className="text-label-lg text-on-surface">{comment.author.name}</span>
              {!comment.isVerified && (
                <Badge label="Unverified" variant="warning" />
              )}
              <time className="text-label-sm text-on-surface-muted ml-auto">
                {comment.createdAt}
              </time>
            </header>

            <p className="text-body-md text-on-surface mb-2 pl-10">
              {comment.content}
            </p>

            <nav className="flex items-center gap-2 pl-10" aria-label="Comment actions">
              {depth < maxDepth && onReply && (
                <button
                  type="button"
                  onClick={() => setIsReplying(!isReplying)}
                  className="flex items-center gap-1 text-label-md text-on-surface-muted hover:text-primary transition-colors"
                >
                  <Reply size={14} />
                  Reply
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(comment.id)}
                  className="flex items-center gap-1 text-label-md text-on-surface-muted hover:text-error transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </nav>

            {/* Reply form */}
            {isReplying && (
              <section className="mt-3 pl-10 space-y-2">
                <textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Write a reply..."
                  className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface p-3 text-body-sm resize-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                  rows={3}
                />
                <footer className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSubmitReply} disabled={!replyContent.trim()}>
                    Reply
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsReplying(false);
                      setReplyContent("");
                    }}
                  >
                    Cancel
                  </Button>
                </footer>
              </section>
            )}
          </>
        )}
      </section>

      {/* Nested replies */}
      {comment.replies.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowReplies(!showReplies)}
            className="flex items-center gap-1 text-label-md text-primary hover:text-secondary transition-colors mb-1"
          >
            {showReplies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
          </button>

          {showReplies && (
            <ul>
              {comment.replies.map((reply) => (
                <li key={reply.id}>
                  <CommentItem
                    comment={reply}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                    onReply={onReply}
                    onDelete={onDelete}
                    isEditor={isEditor}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}

interface CommentSectionProps {
  comments: Comment[];
  isAuthenticated?: boolean;
  isEditor?: boolean;
  onAddComment?: (content: string) => void;
  onReply?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
}

export function CommentSection({
  comments,
  isAuthenticated = false,
  isEditor = false,
  onAddComment,
  onReply,
  onDelete,
}: CommentSectionProps) {
  const [newComment, setNewComment] = useState("");

  const handleSubmit = () => {
    if (newComment.trim() && onAddComment) {
      onAddComment(newComment.trim());
      setNewComment("");
    }
  };

  return (
    <section className="space-y-6" aria-label="Comments">
      <header className="flex items-center gap-2">
        <MessageCircle size={20} className="text-primary" />
        <h3 className="text-headline-md text-on-surface">
          Comments ({comments.length})
        </h3>
      </header>

      {/* New comment form */}
      {isAuthenticated && (
        <section className="space-y-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full rounded-xl bg-neutral border border-border-custom text-on-surface p-4 text-body-md resize-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
            rows={4}
          />
          <Button size="sm" onClick={handleSubmit} disabled={!newComment.trim()}>
            Post Comment
          </Button>
        </section>
      )}

      {/* Comment list */}
      {comments.length > 0 ? (
        <ul className="divide-y divide-border-custom">
          {comments.map((comment) => (
            <li key={comment.id}>
              <CommentItem
                comment={comment}
                onReply={onReply}
                onDelete={onDelete}
                isEditor={isEditor}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-body-md text-on-surface-muted text-center py-8">
          No comments yet. Be the first to share your thoughts!
        </p>
      )}
    </section>
  );
}
