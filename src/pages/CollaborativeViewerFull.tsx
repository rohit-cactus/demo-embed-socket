// Complete Collaborative PDF Viewer - Fully Integrated with Socket.IO
// This is the working version that syncs in real-time

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF } from '@embedpdf/core/react'
import { usePdfiumEngine } from '@embedpdf/engines/react'
import RichTextEditor from '../components/RichTextEditor'
import {
  AnnotationLayer,
  AnnotationPluginPackage,
  LockModeType,
  useAnnotation,
  type AnnotationTransferItem,
} from '@embedpdf/plugin-annotation/react'
import {
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from '@embedpdf/plugin-interaction-manager/react'
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from '@embedpdf/plugin-document-manager/react'
import {
  ExportPluginPackage,
  useExport,
} from '@embedpdf/plugin-export/react'
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react'
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/react'
import {
  SelectionLayer,
  SelectionPluginPackage,
  useSelectionCapability,
  type SelectionSelectionMenuProps,
} from '@embedpdf/plugin-selection/react'
import {
  Viewport,
  ViewportPluginPackage,
} from '@embedpdf/plugin-viewport/react'
import { ZoomPluginPackage, useZoom } from '@embedpdf/plugin-zoom/react'
import { HistoryPluginPackage } from '@embedpdf/plugin-history/react'
import {
  Loader2,
  Check,
  X,
  Pencil,
  Square,
  Highlighter,
  Type,
  Download,
  Upload,
  Trash2,
  MessageSquare,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useDocumentCollaboration } from '../hooks/useCollaboration'
import type { CommentThread, CommentMessage, AnnotationTransferItem as CollabAnnotationItem } from '../hooks/useCollaboration'
import { UserPresence } from '../components/UserPresence'

const INITIAL_PDF = {
  documentId: 'ebook-sample',
  url: 'https://snippet.embedpdf.com/ebook.pdf',
  name: 'ebook.pdf',
}

const plugins = [
  createPluginRegistration(DocumentManagerPluginPackage, {
    initialDocuments: [INITIAL_PDF],
  }),
  createPluginRegistration(ViewportPluginPackage),
  createPluginRegistration(ZoomPluginPackage),
  createPluginRegistration(ScrollPluginPackage),
  createPluginRegistration(RenderPluginPackage),
  createPluginRegistration(ExportPluginPackage, {
    defaultFileName: INITIAL_PDF.name,
  }),
  createPluginRegistration(InteractionManagerPluginPackage),
  createPluginRegistration(SelectionPluginPackage),
  createPluginRegistration(HistoryPluginPackage),
  createPluginRegistration(AnnotationPluginPackage, {
    annotationAuthor: 'EmbedPDF User',
  }),
]

// Helper functions
const createAnnotationId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `anno_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

const createThreadId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `thread_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const extractPlainText = (value: string) => value.replace(/\s+/g, ' ').trim()

const formatThreadTimestamp = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

type TextMarkupToolId = 'highlight' | 'underline' | 'strikeout'

type PendingCommentDraft = {
  annotationId: string
  pageIndex: number
  quote: string
  anchorRatio: number
}

type ThreadPosition = {
  top: number
  visible: boolean
  height: number
}

type AnnotationMetric = {
  pageIndex: number
  yOffsetPx: number
}

// Connection status component
const ConnectionStatus = ({ isConnected, error }: { isConnected: boolean; error?: string | null }) => (
  <div
    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
      isConnected
        ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
        : 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300'
    }`}
    title={error || (isConnected ? 'Connected to collaboration server' : 'Connecting...')}
  >
    {isConnected ? <Wifi size={14} /> : <Loader2 size={14} className="animate-spin" />}
    <span>{isConnected ? 'Connected' : 'Connecting...'}</span>
  </div>
)

// Main component
export const CollaborativeViewerFull = () => {
  const { engine, isLoading } = usePdfiumEngine()
  const [textSelectionEnabled, setTextSelectionEnabled] = useState(true)
  const [annotationEditingEnabled, setAnnotationEditingEnabled] = useState(true)
  const [userId] = useState(() => {
    const stored = localStorage.getItem('collab_user_id')
    if (stored) return stored
    const newId = createThreadId()
    localStorage.setItem('collab_user_id', newId)
    return newId
  })
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('collab_user_name') || 'Reviewer'
  })

  useEffect(() => {
    localStorage.setItem('collab_user_name', userName)
  }, [userName])

  if (isLoading || !engine) {
    return (
      <div className="overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex h-[400px] items-center justify-center">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading PDF Engine...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {({ activeDocumentId }) =>
        activeDocumentId && (
          <DocumentContent documentId={activeDocumentId}>
            {({ isLoaded }) =>
              isLoaded && (
                <CollaborativeWorkspace
                  documentId={activeDocumentId}
                  userId={userId}
                  userName={userName}
                  onUserNameChange={setUserName}
                  textSelectionEnabled={textSelectionEnabled}
                  annotationEditingEnabled={annotationEditingEnabled}
                  setTextSelectionEnabled={setTextSelectionEnabled}
                  setAnnotationEditingEnabled={setAnnotationEditingEnabled}
                />
              )
            }
          </DocumentContent>
        )
      }
    </EmbedPDF>
  )
}

// Main workspace component
const CollaborativeWorkspace = ({
  documentId,
  userId,
  userName,
  onUserNameChange,
  textSelectionEnabled,
  annotationEditingEnabled,
  setTextSelectionEnabled,
  setAnnotationEditingEnabled,
}: {
  documentId: string
  userId: string
  userName: string
  onUserNameChange: (name: string) => void
  textSelectionEnabled: boolean
  annotationEditingEnabled: boolean
  setTextSelectionEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setAnnotationEditingEnabled: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { provides: annotationApi, state } = useAnnotation(documentId)

  // Collaboration hook - this syncs everything in real-time
  const {
    isConnected,
    isJoined,
    error,
    annotations,
    threads,
    users,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    createThread,
    addReply,
  } = useDocumentCollaboration(documentId, userId, userName)

  const [currentAuthorName, setCurrentAuthorName] = useState(userName)
  const [pendingDraft, setPendingDraft] = useState<PendingCommentDraft | null>(null)
  const [pendingCommentText, setPendingCommentText] = useState('')
  const [pendingReplyByThread, setPendingReplyByThread] = useState<Record<string, string>>({})
  const [threadPositions, setThreadPositions] = useState<Record<string, ThreadPosition>>({})
  const [pendingDraftPosition, setPendingDraftPosition] = useState<ThreadPosition | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null)
  const [activeToolId, setActiveToolId] = useState<string | null>(null)

  const focusTimeoutRef = useRef<number | null>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const annotationMetricsRef = useRef<Record<string, AnnotationMetric>>({})
  const threadCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingDraftCardRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  // Sync annotations from server to EmbedPDF
  useEffect(() => {
    if (!annotationApi || !isJoined || annotations.length === 0) return

    console.log('Importing', annotations.length, 'annotations')
    annotationApi.importAnnotations(annotations)
  }, [annotationApi, isJoined])

  // Listen for local annotation changes and sync to server
  useEffect(() => {
    if (!annotationApi || !isJoined) return

    const unsubscribe = annotationApi.onAnnotationEvent((event) => {
      console.log('Annotation event:', event.type, event.annotationId)

      if (event.type === 'create') {
        const item: CollabAnnotationItem = {
          annotation: {
            id: event.annotation.id,
            pageIndex: event.annotation.pageIndex,
            rect: event.annotation.rect,
            segmentRects: (event.annotation as any).segmentRects,
            color: (event.annotation as any).color,
            created: Date.now(),
          },
        }
        console.log('Creating annotation on server:', item)
        createAnnotation(item)
      } else if (event.type === 'update') {
        const annotation = state.byUid[event.annotationId]
        if (annotation) {
          console.log('Updating annotation on server:', event.annotationId)
          updateAnnotation(event.annotationId, annotation.object as any)
        }
      } else if (event.type === 'delete') {
        console.log('Deleting annotation on server:', event.annotationId)
        deleteAnnotation(event.pageIndex, event.annotationId)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [annotationApi, isJoined, createAnnotation, updateAnnotation, deleteAnnotation, state.byUid])

  // Handle comment submission
  const submitPendingComment = useCallback(() => {
    if (!pendingDraft) return
    const text = pendingCommentText.trim()
    if (!text || !currentAuthorName.trim()) return

    const now = Date.now()
    const message: CommentMessage = {
      id: createThreadId(),
      parentId: null,
      authorName: currentAuthorName.trim(),
      authorId: userId,
      text,
      createdAt: now,
    }

    const thread: CommentThread = {
      id: createThreadId(),
      annotationId: pendingDraft.annotationId,
      documentId: documentId,
      pageIndex: pendingDraft.pageIndex,
      quote: pendingDraft.quote,
      anchorRatio: pendingDraft.anchorRatio,
      createdAt: now,
      messages: [message],
    }

    console.log('Creating thread:', thread)
    createThread(thread)

    setPendingCommentText('')
    setPendingDraft(null)
  }, [pendingDraft, pendingCommentText, currentAuthorName, userId, documentId, createThread])

  // Handle reply submission
  const submitReply = useCallback(
    (threadId: string) => {
      const text = (pendingReplyByThread[threadId] || '').trim()
      if (!text || !currentAuthorName.trim()) return

      const reply: CommentMessage = {
        id: createThreadId(),
        parentId: null,
        authorName: currentAuthorName.trim(),
        authorId: userId,
        text,
        createdAt: Date.now(),
      }

      console.log('Adding reply to thread:', threadId, reply)
      addReply(threadId, reply)

      setPendingReplyByThread((prev) => ({ ...prev, [threadId]: '' }))
    },
    [pendingReplyByThread, currentAuthorName, userId, addReply]
  )

  // Error display
  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 rounded-lg border border-gray-300 bg-white p-8 dark:border-gray-700 dark:bg-gray-900">
        <WifiOff className="h-12 w-12 text-red-500" />
        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">Connection Error</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header with connection status and user presence */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <ConnectionStatus isConnected={isConnected && isJoined} error={error} />
          <UserPresence users={users} currentUserId={userId} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Your Name:</label>
          <input
            value={currentAuthorName}
            onChange={(e) => {
              setCurrentAuthorName(e.target.value)
              onUserNameChange(e.target.value)
            }}
            className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* PDF Viewer */}
        <div
          ref={viewportRef}
          className="flex-1 min-h-0 overflow-hidden bg-gray-200 dark:bg-gray-800 relative"
        >
          <Viewport documentId={documentId} className="absolute inset-0">
            <Scroller
              documentId={documentId}
              renderPage={({ pageIndex }) => (
                <div
                  ref={(el) => {
                    pageRefs.current[pageIndex] = el
                  }}
                >
                  <PagePointerProvider documentId={documentId} pageIndex={pageIndex}>
                    <RenderLayer
                      documentId={documentId}
                      pageIndex={pageIndex}
                      style={{ pointerEvents: 'none' }}
                    />
                    {textSelectionEnabled && (
                      <SelectionLayer
                        documentId={documentId}
                        pageIndex={pageIndex}
                        selectionMenu={(props) => (
                          <TextSelectionMenu
                            {...props}
                            documentId={documentId}
                            annotationEditingEnabled={annotationEditingEnabled}
                            onStartCommentDraft={setPendingDraft}
                          />
                        )}
                      />
                    )}
                    <AnnotationLayer
                      documentId={documentId}
                      pageIndex={pageIndex}
                      customAnnotationRenderer={({ annotation, isSelected, children, onSelect }) => {
                        const thread = threads.find((item) => item.annotationId === annotation.id)
                        const isFocusedFromThread = focusedAnnotationId === annotation.id

                        if (thread) {
                          annotationMetricsRef.current[annotation.id] = {
                            pageIndex: annotation.pageIndex,
                            yOffsetPx: (annotation.rect.origin.y + annotation.rect.size.height / 2),
                          }
                        }

                        return (
                          <div
                            onClick={(event) => {
                              onSelect?.(event as any)
                              if (thread) {
                                setActiveThreadId(thread.id)
                              }
                            }}
                            style={{
                              position: 'relative',
                              outline:
                                thread && (isSelected || isFocusedFromThread)
                                  ? '3px solid #059669'
                                  : 'none',
                              outlineOffset: 1,
                              boxShadow: isFocusedFromThread
                                ? '0 0 0 5px rgba(16, 185, 129, 0.35)'
                                : 'none',
                              transition: 'box-shadow 180ms ease',
                            }}
                          >
                            {children}
                            {thread && (
                              <div
                                title={`Commented (${thread.messages.length})`}
                                style={{
                                  position: 'absolute',
                                  top: -10,
                                  right: -10,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  borderRadius: 999,
                                  border: '1px solid #065f46',
                                  background: '#10b981',
                                  color: '#ecfdf5',
                                  padding: '2px 6px',
                                  fontSize: 10,
                                  fontWeight: 800,
                                  lineHeight: 1,
                                  boxShadow: '0 4px 10px rgba(5, 150, 105, 0.35)',
                                  pointerEvents: 'none',
                                }}
                              >
                                <MessageSquare size={10} />
                                <span>{thread.messages.length}</span>
                              </div>
                            )}
                          </div>
                        )
                      }}
                    />
                  </PagePointerProvider>
                </div>
              )}
            />
          </Viewport>
        </div>

        {/* Comments Sidebar */}
        <aside
          style={{
            width: 360,
            height: '100%',
            borderLeft: '1px solid #e2e8f0',
            background: '#ffffff',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              borderBottom: '1px solid #e2e8f0',
              padding: '10px 12px',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            Comments ({threads.length})
          </div>
          <div
            style={{
              position: 'relative',
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
          >
            {threads.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No comments yet
              </div>
            ) : (
              threads.map((thread) => {
                const root = thread.messages[0]
                const isExpanded = activeThreadId === thread.id

                return (
                  <div
                    key={thread.id}
                    ref={(el) => {
                      threadCardRefs.current[thread.id] = el
                    }}
                    onClick={() => setActiveThreadId(isExpanded ? null : thread.id)}
                    style={{
                      borderRadius: 14,
                      border: isExpanded ? '2px solid #0f766e' : '1px solid #d6dee9',
                      background: '#ffffff',
                      boxShadow: isExpanded
                        ? '0 10px 24px rgba(15, 23, 42, 0.16)'
                        : '0 8px 20px rgba(15, 23, 42, 0.12)',
                      padding: 14,
                      margin: '10px 10px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: '#6b7280',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 14,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {(root?.authorName?.[0] || '?').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#1f2937' }}>
                          {root?.authorName || 'Anonymous'}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          {root ? formatThreadTimestamp(root.createdAt) : `Page ${thread.pageIndex + 1}`}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, color: '#1f2937', lineHeight: 1.35 }}>
                          {root?.text || 'No comment text'}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        <div
                          style={{
                            marginTop: 10,
                            borderTop: '1px solid #e2e8f0',
                            paddingTop: 10,
                          }}
                        />
                        {thread.messages.slice(1).map((reply) => (
                          <div
                            key={reply.id}
                            style={{
                              marginBottom: 6,
                              marginLeft: 8,
                              borderLeft: '2px solid #a7f3d0',
                              paddingLeft: 6,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>
                              {reply.authorName}
                            </div>
                            <div style={{ fontSize: 12, color: '#0f172a' }}>{reply.text}</div>
                          </div>
                        ))}

                        <div style={{ marginTop: 10 }}>
                          <RichTextEditor
                            content={{ html: pendingReplyByThread[thread.id] || '' }}
                            onChange={(content) =>
                              setPendingReplyByThread((prev) => ({
                                ...prev,
                                [thread.id]: content.html,
                              }))
                            }
                            placeholder="Reply..."
                            minHeight={54}
                          />
                          <div
                            style={{
                              marginTop: 6,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span style={{ fontSize: 10, color: '#047857' }}>{currentAuthorName}</span>
                            <button
                              type="button"
                              onClick={() => submitReply(thread.id)}
                              disabled={!(pendingReplyByThread[thread.id] || '').trim()}
                              style={{
                                borderRadius: 6,
                                border: '1px solid #059669',
                                background: (pendingReplyByThread[thread.id] || '').trim()
                                  ? '#059669'
                                  : '#d1fae5',
                                color: (pendingReplyByThread[thread.id] || '').trim()
                                  ? '#ecfdf5'
                                  : '#065f46',
                                fontSize: 11,
                                fontWeight: 700,
                                padding: '5px 8px',
                                cursor: (pendingReplyByThread[thread.id] || '').trim()
                                  ? 'pointer'
                                  : 'not-allowed',
                              }}
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// Text selection menu component
const TextSelectionMenu = ({
  documentId,
  rect,
  placement,
  menuWrapperProps,
  annotationEditingEnabled,
  onStartCommentDraft,
}: SelectionSelectionMenuProps & {
  documentId: string
  annotationEditingEnabled: boolean
  onStartCommentDraft: (draft: PendingCommentDraft) => void
}) => {
  const { provides: selectionCapability } = useSelectionCapability()
  const { provides: annotationApi } = useAnnotation(documentId)

  const startCommentThread = useCallback(() => {
    if (!annotationEditingEnabled) return

    const selectionScope = selectionCapability?.forDocument(documentId)
    if (!selectionScope || !annotationApi) return

    const selections = selectionScope.getFormattedSelection()
    if (selections.length === 0) return

    annotationApi.setActiveTool('highlight')
    const activeTool = annotationApi.getActiveTool()
    if (!activeTool) return

    const createFromSelection = (text?: string) => {
      const quote = extractPlainText(text || '')

      for (const selection of selections) {
        const id = createAnnotationId()
        annotationApi.createAnnotation(selection.pageIndex, {
          ...(activeTool.defaults as Record<string, unknown>),
          id,
          pageIndex: selection.pageIndex,
          rect: selection.rect,
          segmentRects: selection.segmentRects,
          created: new Date(),
          color: '#FDE68A',
          ...(quote ? { custom: { text: quote } } : {}),
        } as any)

        if (activeTool.behavior?.selectAfterCreate) {
          annotationApi.selectAnnotation(selection.pageIndex, id)
        }

        onStartCommentDraft({
          annotationId: id,
          pageIndex: selection.pageIndex,
          quote: quote || 'Selected text',
          anchorRatio: clamp(selection.rect.origin.y / 900, 0.04, 0.96),
        })
      }

      selectionScope.clear()
      annotationApi.setActiveTool(null)
    }

    selectionScope.getSelectedText().wait(
      (lines) => createFromSelection(lines.join('\n')),
      () => createFromSelection()
    )
  }, [annotationEditingEnabled, documentId, selectionCapability, annotationApi, onStartCommentDraft])

  const top = placement.suggestTop ? -44 : rect.size.height + 8

  return (
    <div {...menuWrapperProps}>
      <div
        style={{
          position: 'absolute',
          top,
          pointerEvents: 'auto',
          display: 'flex',
          gap: 6,
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: 6,
          boxShadow: '0 8px 24px rgba(2, 6, 23, 0.45)',
          zIndex: 20,
        }}
      >
        <button
          onClick={startCommentThread}
          style={{
            background: '#bbf7d0',
            color: '#14532d',
            border: '1px solid #86efac',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 700,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Add Comment
        </button>
      </div>
    </div>
  )
}

export default CollaborativeViewerFull
