/**
 * ThreadBlock Component
 * Individual comment thread displayed in the right panel
 */

import { useState, useCallback } from 'react'
import { MessageSquare, X, Check } from 'lucide-react'
import type { Comment, CommentThread } from '../types'
import { formatTimeAgo, formatTimestamp } from '../utils/styleUtils'

interface ThreadBlockProps {
  thread: CommentThread
  isActive: boolean
  currentAuthorName: string
  onReply: (text: string) => void
  onDeleteComment: (commentId: string) => void
  onDeleteThread: () => void
  onFocus: () => void
  threadRef?: (el: HTMLDivElement | null) => void
}

const Avatar = ({ name }: { name: string }) => {
  const initial = (name?.[0] || '?').toUpperCase()
  return (
    <div className="thread-avatar">
      {initial}
    </div>
  )
}

interface CommentItemProps {
  comment: Comment
  isOwner: boolean
  onDelete: () => void
}

const CommentItem = ({ comment, isOwner, onDelete }: CommentItemProps) => {
  const [isHovered, setIsHovered] = useState(false)

  if (comment.isDeleted) {
    return (
      <div className="comment-item deleted">
        <span className="deleted-placeholder">[comment deleted]</span>
      </div>
    )
  }

  return (
    <div
      className="comment-item"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar name={comment.authorName} />
      <div className="comment-content">
        <div className="comment-header">
          <span className="comment-author">{comment.authorName}</span>
          <span className="comment-time">{formatTimeAgo(comment.createdAt)}</span>
        </div>
        <div
          className="comment-text"
          dangerouslySetInnerHTML={{ __html: comment.text }}
        />
      </div>
      {isOwner && isHovered && (
        <button
          type="button"
          onClick={onDelete}
          className="comment-delete-btn"
          title="Delete comment"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}

export const ThreadBlock = ({
  thread,
  isActive,
  currentAuthorName,
  onReply,
  onDeleteComment,
  onDeleteThread,
  onFocus,
  threadRef,
}: ThreadBlockProps) => {
  const [replyText, setReplyText] = useState('')
  const [inputRef] = useState<React.RefObject<HTMLTextAreaElement>>({
    current: null,
  })

  const rootComment = thread.messages[0]
  const replies = thread.messages.slice(1)
  const replyCount = replies.length

  const handleSubmitReply = useCallback(() => {
    if (!replyText.trim() || !currentAuthorName.trim()) return
    onReply(replyText.trim())
    setReplyText('')
  }, [replyText, currentAuthorName, onReply])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmitReply()
      }
    },
    [handleSubmitReply]
  )

  return (
    <div
      ref={threadRef}
      className={`thread-block ${isActive ? 'active' : ''}`}
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onFocus()
      }}
    >
      {/* Header */}
      <div className="thread-header">
        <Avatar name={rootComment?.authorName || 'Anonymous'} />
        <div className="thread-meta">
          <span className="thread-author">{rootComment?.authorName || 'Anonymous'}</span>
          <span className="thread-time">
            {rootComment ? formatTimestamp(rootComment.createdAt) : 'New thread'}
          </span>
        </div>
        <div className="thread-actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteThread()
            }}
            className="thread-delete-btn"
            title="Delete thread"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Quote */}
      <div className="thread-quote">
        "{thread.quote}"
      </div>

      {/* Root Comment */}
      {rootComment && (
        <div className="thread-messages">
          <CommentItem
            comment={rootComment}
            isOwner={rootComment.authorName === currentAuthorName}
            onDelete={() => onDeleteComment(rootComment.id)}
          />
        </div>
      )}

      {/* Replies */}
      {replyCount > 0 && (
        <div className="thread-replies">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isOwner={reply.authorName === currentAuthorName}
              onDelete={() => onDeleteComment(reply.id)}
            />
          ))}
        </div>
      )}

      {/* Reply Input */}
      <div className="thread-reply-input" onClick={(e) => e.stopPropagation()}>
        <textarea
          ref={inputRef}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a reply..."
          rows={2}
          className="reply-textarea"
        />
        <div className="reply-actions">
          <span className="reply-author">{currentAuthorName}</span>
          <button
            type="button"
            onClick={handleSubmitReply}
            disabled={!replyText.trim() || !currentAuthorName.trim()}
            className="reply-submit-btn"
          >
            <Check size={14} />
            Reply
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// CommentPanel Component
// ============================================================================

export interface CommentPanelProps {
  threads: CommentThread[]
  activeThreadId: string | null
  currentAuthorName: string
  onAddReply: (threadId: string, text: string) => void
  onDeleteComment: (threadId: string, commentId: string) => void
  onDeleteThread: (threadId: string) => void
  onFocusThread: (threadId: string) => void
  onThreadRef?: (threadId: string, el: HTMLDivElement | null) => void
}

export const CommentPanel = ({
  threads,
  activeThreadId,
  currentAuthorName,
  onAddReply,
  onDeleteComment,
  onDeleteThread,
  onFocusThread,
  onThreadRef,
}: CommentPanelProps) => {
  if (threads.length === 0) {
    return (
      <aside className="comment-panel">
        <div className="comment-panel-header">
          <MessageSquare size={16} />
          <span>Comments</span>
        </div>
        <div className="comment-panel-empty">
          <p>No comments yet</p>
          <p className="comment-panel-empty-hint">
            Select text and click "Add Comment" to start a thread
          </p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="comment-panel">
      <div className="comment-panel-header">
        <MessageSquare size={16} />
        <span>Comments</span>
        <span className="comment-panel-count">{threads.length}</span>
      </div>
      <div className="comment-panel-content">
        {threads.map((thread) => (
          <ThreadBlock
            key={thread.id}
            thread={thread}
            isActive={activeThreadId === thread.id}
            currentAuthorName={currentAuthorName}
            onReply={(text) => onAddReply(thread.id, text)}
            onDeleteComment={(commentId) => onDeleteComment(thread.id, commentId)}
            onDeleteThread={() => onDeleteThread(thread.id)}
            onFocus={() => onFocusThread(thread.id)}
            threadRef={(el) => onThreadRef?.(thread.id, el)}
          />
        ))}
      </div>
    </aside>
  )
}
