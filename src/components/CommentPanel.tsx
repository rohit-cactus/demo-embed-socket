import { useState, useRef, useCallback } from 'react'
import { Annotation, Author, RichContent } from '../types/annotations'
import RichTextEditor from './RichTextEditor'
import '../styles/CommentPanel.css'

interface CommentPanelProps {
  annotation: Annotation | undefined
  addComment: (annotationId: string, content: RichContent) => void
  updateComment: (annotationId: string, commentId: string, content: RichContent) => void
  deleteComment: (annotationId: string, commentId: string) => void
  onClose: () => void
  currentAuthor: Author
  isReadOnly: boolean
}

const CommentPanel = ({
  annotation,
  addComment,
  updateComment,
  deleteComment,
  onClose,
  currentAuthor,
  isReadOnly,
}: CommentPanelProps) => {
  const [isAddingComment, setIsAddingComment] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [newContent, setNewContent] = useState<RichContent>({ blocks: [] })
  const [editContent, setEditContent] = useState<RichContent>({ blocks: [] })

  if (!annotation) return null

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const handleAddComment = () => {
    if (newContent.blocks.length === 0 || newContent.blocks.every(b => !b.content.trim())) {
      return
    }
    addComment(annotation.id, newContent)
    setNewContent({ blocks: [] })
    setIsAddingComment(false)
  }

  const handleUpdateComment = (commentId: string) => {
    if (editContent.blocks.length === 0 || editContent.blocks.every(b => !b.content.trim())) {
      return
    }
    updateComment(annotation.id, commentId, editContent)
    setEditingCommentId(null)
    setEditContent({ blocks: [] })
  }

  const startEditing = (comment: typeof annotation.comments[0]) => {
    setEditingCommentId(comment.id)
    setEditContent(comment.content)
  }

  const cancelEditing = () => {
    setEditingCommentId(null)
    setEditContent({ blocks: [] })
  }

  return (
    <div className="comment-panel">
      <div className="comment-panel-header">
        <h3>
          {annotation.type === 'note' ? '📝 Note' :
           annotation.type === 'highlight' ? '🖍️ Highlight' :
           annotation.type === 'text' ? '✏️ Text' :
           annotation.type === 'ink' ? '🖊️ Drawing' :
           '💬 Comment'}
        </h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      <div className="annotation-info">
        <span className="author">
          Created by <strong>{annotation.author.name}</strong>
        </span>
        <span className="timestamp">{formatDate(annotation.createdAt)}</span>
      </div>

      {/* Existing comments thread */}
      <div className="comments-thread">
        {annotation.comments.length === 0 ? (
          <div className="no-comments">
            No comments yet. {isReadOnly ? '' : 'Be the first to add a comment!'}
          </div>
        ) : (
          annotation.comments.map((comment, index) => (
            <div key={comment.id} className="comment">
              <div className="comment-header">
                <div className="comment-author">
                  <div className="author-avatar">
                    {comment.author.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="author-name">{comment.author.name}</span>
                </div>
                <span className="comment-time">{formatDate(comment.createdAt)}</span>
              </div>

              {editingCommentId === comment.id ? (
                <div className="comment-edit">
                  <RichTextEditor
                    content={editContent}
                    onChange={setEditContent}
                  />
                  <div className="comment-actions">
                    <button className="btn-save" onClick={() => handleUpdateComment(comment.id)}>
                      Save
                    </button>
                    <button className="btn-cancel" onClick={cancelEditing}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="comment-content">
                    {comment.content.blocks.map((block, blockIndex) => (
                      <div key={blockIndex} className={`content-block ${block.type}`}>
                        {renderRichContent(block)}
                      </div>
                    ))}
                  </div>
                  {!isReadOnly && comment.author.id === currentAuthor.id && (
                    <div className="comment-footer">
                      <button className="btn-edit" onClick={() => startEditing(comment)}>
                        Edit
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => deleteComment(annotation.id, comment.id)}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add new comment */}
      {!isReadOnly && (
        <div className="add-comment-section">
          {isAddingComment ? (
            <div className="new-comment">
              <div className="comment-author">
                <div className="author-avatar">
                  {currentAuthor.name.charAt(0).toUpperCase()}
                </div>
                <span className="author-name">{currentAuthor.name}</span>
              </div>
              <RichTextEditor
                content={newContent}
                onChange={setNewContent}
                placeholder="Write your comment..."
              />
              <div className="comment-actions">
                <button
                  className="btn-submit"
                  onClick={handleAddComment}
                  disabled={newContent.blocks.length === 0 || newContent.blocks.every(b => !b.content.trim())}
                >
                  Add Comment
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => {
                    setIsAddingComment(false)
                    setNewContent({ blocks: [] })
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn-add-comment"
              onClick={() => setIsAddingComment(true)}
            >
              + Add Comment
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Helper to render rich content with formatting
function renderRichContent(block: { content: string; formatting?: Array<{type: string; start: number; end: number}> }) {
  if (!block.formatting || block.formatting.length === 0) {
    return <span>{block.content}</span>
  }

  // Sort formatting by start position
  const sortedFormatting = [...block.formatting].sort((a, b) => a.start - b.start)

  const elements: React.ReactNode[] = []
  let lastIndex = 0

  sortedFormatting.forEach((format, idx) => {
    // Add unformatted text before this formatting
    if (format.start > lastIndex) {
      elements.push(
        <span key={`text-${idx}`}>
          {block.content.slice(lastIndex, format.start)}
        </span>
      )
    }

    // Add formatted text
    const formattedText = block.content.slice(format.start, format.end)
    const key = `formatted-${idx}`

    switch (format.type) {
      case 'bold':
        elements.push(<strong key={key}>{formattedText}</strong>)
        break
      case 'italic':
        elements.push(<em key={key}>{formattedText}</em>)
        break
      case 'underline':
        elements.push(<u key={key}>{formattedText}</u>)
        break
      case 'subscript':
        elements.push(<sub key={key}>{formattedText}</sub>)
        break
      case 'superscript':
        elements.push(<sup key={key}>{formattedText}</sup>)
        break
      default:
        elements.push(<span key={key}>{formattedText}</span>)
    }

    lastIndex = format.end
  })

  // Add remaining unformatted text
  if (lastIndex < block.content.length) {
    elements.push(
      <span key="text-end">{block.content.slice(lastIndex)}</span>
    )
  }

  return <>{elements}</>
}

export default CommentPanel
