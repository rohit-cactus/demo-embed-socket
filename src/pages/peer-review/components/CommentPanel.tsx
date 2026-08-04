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
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xs font-semibold text-white">
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
      <div className="py-1 pl-9 text-xs italic text-paper-400">[comment deleted]</div>
    )
  }

  return (
    <div
      className="group/comment flex items-start gap-2 py-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Avatar name={comment.authorName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12.5px] font-semibold text-paper-800">{comment.authorName}</span>
          <span className="text-[11px] text-paper-400">{formatTimeAgo(comment.createdAt)}</span>
        </div>
        <div
          className="mt-0.5 wrap-break-word text-[13px] leading-relaxed text-paper-700"
          dangerouslySetInnerHTML={{ __html: comment.text }}
        />
      </div>
      {isOwner && isHovered && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete comment"
          className="shrink-0 rounded-md p-1 text-paper-400 transition-colors hover:bg-red-50 hover:text-red-600"
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
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onFocus()
      }}
      className={`group cursor-pointer rounded-xl border p-3 transition-colors ${
        isActive
          ? 'border-ink-300 bg-ink-50/50 ring-1 ring-ink-200'
          : 'border-paper-200 bg-white hover:border-paper-300'
      }`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <Avatar name={rootComment?.authorName || 'Anonymous'} />
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13px] font-semibold text-paper-900">
            {rootComment?.authorName || 'Anonymous'}
          </span>
          <span className="text-[11px] text-paper-400">
            {rootComment ? formatTimestamp(rootComment.createdAt) : 'New thread'}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteThread()
          }}
          title="Delete thread"
          className="shrink-0 rounded-md p-1 text-paper-400 opacity-0 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
        >
          <X size={14} />
        </button>
      </div>

      {/* Quote */}
      <div className="mb-2 border-l-2 border-ink-300 pl-2.5 font-display text-[13px] italic leading-snug text-paper-600 line-clamp-3">
        &ldquo;{thread.quote}&rdquo;
      </div>

      {/* Root Comment */}
      {rootComment && (
        <div>
          <CommentItem
            comment={rootComment}
            isOwner={rootComment.authorName === currentAuthorName}
            onDelete={() => onDeleteComment(rootComment.id)}
          />
        </div>
      )}

      {/* Replies */}
      {replyCount > 0 && (
        <div className="mt-1 ml-3.5 space-y-1 border-l border-paper-200 pl-3">
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
      <div
        className="mt-3 flex flex-col gap-2 border-t border-paper-200 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <textarea
          ref={inputRef}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a reply..."
          rows={2}
          className="w-full resize-none rounded-lg border border-paper-200 bg-paper-50 px-2.5 py-2 text-[13px] text-paper-800 placeholder:text-paper-400 focus:border-ink-400 focus:outline-none focus:ring-2 focus:ring-ink-100"
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-paper-400">{currentAuthorName}</span>
          <button
            type="button"
            onClick={handleSubmitReply}
            disabled={!replyText.trim() || !currentAuthorName.trim()}
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
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
  return (
    <aside className="flex w-90 shrink-0 flex-col overflow-hidden border-l border-paper-200 bg-paper-50 font-ui">
      <div className="flex shrink-0 items-center gap-2 border-b border-paper-200 bg-white/60 px-4 py-3">
        <MessageSquare size={16} className="text-ink-700" />
        <span className="font-display text-[15px] font-semibold text-paper-900">Comments</span>
        {threads.length > 0 && (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-100 px-1.5 text-xs font-semibold text-ink-800">
            {threads.length}
          </span>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <MessageSquare size={28} className="text-paper-300" />
          <p className="text-sm font-medium text-paper-600">No comments yet</p>
          <p className="max-w-55 text-xs leading-relaxed text-paper-400">
            Select text and click &ldquo;Add Comment&rdquo; to start a thread
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
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
      )}
    </aside>
  )
}
