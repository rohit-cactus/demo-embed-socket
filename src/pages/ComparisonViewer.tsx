import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF } from '@embedpdf/core/react'
import { usePdfiumEngine } from '@embedpdf/engines/react'
import {
  AnnotationLayer,
  AnnotationPluginPackage,
  LockModeType,
  useAnnotationCapability,
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
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react'
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/react'
import { SelectionPluginPackage } from '@embedpdf/plugin-selection/react'
import {
  Viewport,
  ViewportPluginPackage,
} from '@embedpdf/plugin-viewport/react'
import { ZoomPluginPackage, useZoomCapability } from '@embedpdf/plugin-zoom/react'
import { HistoryPluginPackage } from '@embedpdf/plugin-history/react'
import { Loader2, Upload, X, FileText, MessageSquare, Link2, Link2Off, Wifi, WifiOff } from 'lucide-react'
import { useDocumentCollaboration } from '../hooks/useCollaboration'
import type { AnnotationTransferItem as CollabAnnotationItem } from '../hooks/useCollaboration'

const INITIAL_PDF = {
  documentId: 'ebook-sample',
  url: 'https://snippet.embedpdf.com/ebook.pdf',
  name: 'ebook.pdf',
}

const PUBLIC_PDF = {
  documentId: 'public-demo-embed-pdf-viewer',
  url: 'http://testcdn.researcher.life/discovery/pdf/demo-embed-pdf-viewer.pdf',
    name: '100 MB+ Size pdf',
}

const ACTIVE_PDF_ID_STORAGE_KEY = 'embedpdf_active_pdf_id_v1'

const resolveBasePdf = () => {
  const savedId = localStorage.getItem(ACTIVE_PDF_ID_STORAGE_KEY)
  if (savedId === PUBLIC_PDF.documentId) {
    return PUBLIC_PDF
  }
  return INITIAL_PDF
}

const COLLAB_USER_ID_STORAGE_KEY = 'collab_user_id'
const COMMENT_AUTHOR_STORAGE_KEY = 'embedpdf_comment_author_v1'

type CommentMessage = {
  id: string
  parentId: string | null
  authorName: string
  text: string
  createdAt: number
}

type CommentThread = {
  id: string
  annotationId: string
  pageIndex: number
  quote: string
  createdAt: number
  messages: CommentMessage[]
}

const normalizeCommentText = (value: string | undefined) => {
  if (!value) return ''

  const text = String(value)
  if (!text.includes('<')) return text

  const parsed = new DOMParser().parseFromString(text, 'text/html')
  return parsed.body.textContent || text
}

const sanitizeMessage = (message: Partial<CommentMessage>, index: number): CommentMessage => ({
  id: message.id || `message-${index}`,
  parentId: typeof message.parentId === 'string' ? message.parentId : null,
  authorName: message.authorName || 'Anonymous',
  text: normalizeCommentText(message.text),
  createdAt: typeof message.createdAt === 'number' ? message.createdAt : Date.now(),
})

const mergeThreadsWithAnnotationFallback = (
  socketThreads: CommentThread[],
  annotations: CollabAnnotationItem[],
): CommentThread[] => {
  const mergedByAnnotationId = new Map<string, CommentThread>()

  socketThreads.forEach((thread, threadIndex) => {
    const normalizedMessages = (thread.messages || []).map((message, messageIndex) =>
      sanitizeMessage(message, messageIndex),
    )

    mergedByAnnotationId.set(thread.annotationId, {
      ...thread,
      id: thread.id || `thread-${threadIndex}`,
      quote: thread.quote || '',
      messages: normalizedMessages,
      createdAt: typeof thread.createdAt === 'number' ? thread.createdAt : Date.now(),
    })
  })

  annotations.forEach((item, annotationIndex) => {
    const annotation = item.annotation
    const fallbackThread = annotation.custom?.thread
    if (!fallbackThread) return

    const existing = mergedByAnnotationId.get(annotation.id)
    if (existing && existing.messages.length > 0) return

    const normalizedMessages = (fallbackThread.messages || []).map((message, messageIndex) =>
      sanitizeMessage(message, messageIndex),
    )

    mergedByAnnotationId.set(annotation.id, {
      id: fallbackThread.id || `legacy-thread-${annotationIndex}`,
      annotationId: annotation.id,
      pageIndex: annotation.pageIndex,
      quote: fallbackThread.quote || annotation.contents || '',
      createdAt:
        typeof fallbackThread.createdAt === 'number'
          ? fallbackThread.createdAt
          : typeof annotation.created === 'number'
            ? annotation.created
            : Date.now(),
      messages: normalizedMessages,
    })
  })

  return Array.from(mergedByAnnotationId.values())
}


const formatThreadTimestamp = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

interface CommentPopupProps {
  thread: CommentThread | null
  position: { x: number; y: number }
  onClose: () => void
}

const POPUP_VIEWPORT_MARGIN = 12

const CommentPopup = ({ thread, position, onClose }: CommentPopupProps) => {
  const popupRef = useRef<HTMLDivElement>(null)
  const [placement, setPlacement] = useState(position)

  useLayoutEffect(() => {
    if (!thread) return
    const el = popupRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    let { x, y } = position

    if (x + rect.width > window.innerWidth - POPUP_VIEWPORT_MARGIN) {
      x = Math.max(POPUP_VIEWPORT_MARGIN, window.innerWidth - rect.width - POPUP_VIEWPORT_MARGIN)
    }
    if (y + rect.height > window.innerHeight - POPUP_VIEWPORT_MARGIN) {
      y = Math.max(POPUP_VIEWPORT_MARGIN, window.innerHeight - rect.height - POPUP_VIEWPORT_MARGIN)
    }

    if (x !== placement.x || y !== placement.y) {
      setPlacement({ x, y })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, position])

  if (!thread) return null

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        left: placement.x,
        top: placement.y,
        width: 360,
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: `calc(100vh - ${POPUP_VIEWPORT_MARGIN * 2}px)`,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        border: '2px solid #0f766e',
        background: '#ffffff',
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.25)',
        padding: 16,
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={18} style={{ color: '#0f766e' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>Comments</span>
          <span style={{ fontSize: 11, color: '#6b7280', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>
            Read-only
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} style={{ color: '#6b7280' }} />
        </button>
      </div>

      <div
        style={{
          borderRadius: 6,
          border: '1px solid #dbeafe',
          background: '#f8fafc',
          color: '#334155',
          fontSize: 12,
          fontStyle: 'italic',
          padding: '8px 10px',
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        "{thread.quote}"
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {thread.messages.map((message, index) => (
          <div
            key={message.id}
            style={{
              marginBottom: index < thread.messages.length - 1 ? 12 : 0,
              paddingBottom: index < thread.messages.length - 1 ? 12 : 0,
              borderBottom: index < thread.messages.length - 1 ? '1px solid #e2e8f0' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: '#6b7280',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {(message.authorName?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>
                  {message.authorName || 'Anonymous'}
                </div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>
                  {formatThreadTimestamp(message.createdAt)}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#374151',
                lineHeight: 1.5,
                marginLeft: 36,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid #e2e8f0',
          fontSize: 11,
          color: '#6b7280',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {thread.messages.length} comment{thread.messages.length !== 1 ? 's' : ''} on this selection
      </div>
    </div>
  )
}

const useScrollSync = (documentIdA: string, documentIdB: string, enabled: boolean) => {
  const isSyncingRef = useRef(false)

  useEffect(() => {
    if (!enabled || !documentIdA || !documentIdB) return

    // The viewport plugin's cached metrics (scrollWidth/scrollHeight) are only
    // recomputed when its ResizeObserver fires - i.e. when the *container* box
    // resizes, not when the PDF content inside grows as pages finish rendering.
    // That left the sync using stale (often zero-overflow) numbers until an
    // unrelated window resize forced a re-measure. Reading straight off the
    // live DOM node on every scroll event sidesteps that entirely.
    let elA: HTMLElement | null = null
    let elB: HTMLElement | null = null
    let retryId: ReturnType<typeof setTimeout> | null = null

    const mirror = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncingRef.current) return

      isSyncingRef.current = true

      const ratioX =
        source.scrollWidth <= source.clientWidth
          ? 0
          : source.scrollLeft / (source.scrollWidth - source.clientWidth)
      const ratioY =
        source.scrollHeight <= source.clientHeight
          ? 0
          : source.scrollTop / (source.scrollHeight - source.clientHeight)

      target.scrollTo({
        left: ratioX * (target.scrollWidth - target.clientWidth),
        top: ratioY * (target.scrollHeight - target.clientHeight),
        behavior: 'instant',
      })

      requestAnimationFrame(() => {
        isSyncingRef.current = false
      })
    }

    const handleScrollA = () => elA && elB && mirror(elA, elB)
    const handleScrollB = () => elA && elB && mirror(elB, elA)

    const attach = () => {
      elA = document.querySelector<HTMLElement>(`[data-viewport-doc="${documentIdA}"]`)
      elB = document.querySelector<HTMLElement>(`[data-viewport-doc="${documentIdB}"]`)

      if (!elA || !elB) {
        retryId = setTimeout(attach, 100)
        return
      }

      elA.addEventListener('scroll', handleScrollA)
      elB.addEventListener('scroll', handleScrollB)
    }

    attach()

    return () => {
      if (retryId) clearTimeout(retryId)
      elA?.removeEventListener('scroll', handleScrollA)
      elB?.removeEventListener('scroll', handleScrollB)
    }
  }, [enabled, documentIdA, documentIdB])
}

const ScrollSyncBridge = ({
  documentIdA,
  documentIdB,
  enabled,
}: {
  documentIdA: string
  documentIdB: string
  enabled: boolean
}) => {
  useScrollSync(documentIdA, documentIdB, enabled)
  return null
}

const useAnnotationSafe = (documentId: string) => {
  const { provides: annotationCapability } = useAnnotationCapability()
  const [state, setState] = useState<any>(null)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    if (!annotationCapability) return

    try {
      const scope = annotationCapability.forDocument(documentId)
      if (scope) {
        const initialState = scope.getState()
        setState(initialState)

        const unsubscribe = scope.onStateChange((newState: any) => {
          setState(newState)
        })
        return unsubscribe
      }
    } catch (e) {
      console.log(`Annotation not ready for ${documentId}, will retry...`)
      setError(true)
      // Retry after a short delay
      const timeout = setTimeout(() => {
        setError(false)
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [annotationCapability, documentId])

  return {
    state,
    provides: annotationCapability?.forDocument(documentId) ?? null,
    isReady: !!state && !error,
  }
}

const useZoomSafe = (documentId: string) => {
  const { provides: zoomCapability } = useZoomCapability()
  const [state, setState] = useState<any>(null)
  const [error, setError] = useState<boolean>(false)

  useEffect(() => {
    if (!zoomCapability) return

    try {
      const scope = zoomCapability.forDocument(documentId)
      if (scope) {
        const initialState = scope.getState()
        setState(initialState)

        const unsubscribe = scope.onStateChange((newState: any) => {
          setState(newState)
        })
        return unsubscribe
      }
    } catch (e) {
      console.log(`Zoom not ready for ${documentId}, will retry...`)
      setError(true)
      // Retry after a short delay
      const timeout = setTimeout(() => {
        setError(false)
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [zoomCapability, documentId])

  return {
    state: state || { currentZoomLevel: 1 },
    provides: zoomCapability?.forDocument(documentId) ?? null,
    isReady: !!state && !error,
  }
}

const ComparisonPDFPanel = ({
  documentId,
  threads,
  annotations,
  onShowComments,
  onCloseComments,
  isCommentPopupOpen,
  label,
}: {
  documentId: string
  threads: CommentThread[]
  annotations: CollabAnnotationItem[]
  onShowComments: (thread: CommentThread, position: { x: number; y: number }) => void
  onCloseComments: () => void
  isCommentPopupOpen: boolean
  label: string
}) => {
  const { provides: annotationApi, isReady: annotationReady } = useAnnotationSafe(documentId)
  const { provides: zoomApi, state: zoomState, isReady: zoomReady } = useZoomSafe(documentId)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const importedAnnotationIdsRef = useRef<Set<string>>(new Set())
  const [hoverComment, setHoverComment] = useState<{
    thread: CommentThread
    position: { x: number; y: number }
  } | null>(null)

  // Close any open comment popup (local hover preview or the shared click
  // popup) as soon as this panel's own viewport scrolls, so a stale popup
  // doesn't drift away from the highlight it was anchored to.
  useEffect(() => {
    let el: HTMLElement | null = null
    let retryId: ReturnType<typeof setTimeout> | null = null

    const handleScroll = () => {
      setHoverComment(null)
      onCloseComments()
    }

    const attach = () => {
      el = document.querySelector<HTMLElement>(`[data-viewport-doc="${documentId}"]`)
      if (!el) {
        retryId = setTimeout(attach, 100)
        return
      }
      el.addEventListener('scroll', handleScroll, { passive: true })
    }

    attach()

    return () => {
      if (retryId) clearTimeout(retryId)
      el?.removeEventListener('scroll', handleScroll)
    }
  }, [documentId, onCloseComments])

  useEffect(() => {
    if (annotationReady && annotationApi) {
      try {
        annotationApi.setLocked({ type: LockModeType.All })
      } catch (e) {
        console.log(`setLocked failed for ${documentId}, will retry on next ready state`)
      }
    }
  }, [annotationApi, annotationReady, documentId])

  // Pull annotations from the live collaboration socket (the same server
  // CustomViewerTwo persists to) instead of a localStorage snapshot, so
  // highlights/strikeouts/comment badges here always reflect the current
  // server state - including updates made by others while this view is open.
  useEffect(() => {
    if (!annotationReady || !annotationApi || annotations.length === 0) return

    const newItems = annotations.filter(
      (item) => !importedAnnotationIdsRef.current.has(item.annotation.id),
    )
    if (newItems.length === 0) return

    newItems.forEach((item) => importedAnnotationIdsRef.current.add(item.annotation.id))
    annotationApi.importAnnotations(newItems as unknown as AnnotationTransferItem[])
  }, [annotationApi, annotationReady, annotations])

  // Skip rendering if annotation or zoom state not ready
  if (!annotationReady || !zoomReady) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f0f0',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ color: '#666', fontSize: 14 }}>Loading {label}...</div>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} style={{ color: '#6b7280' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => zoomApi?.zoomOut()}
            disabled={!zoomApi}
            style={{
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              width: 28,
              height: 28,
              cursor: zoomApi ? 'pointer' : 'not-allowed',
              opacity: zoomApi ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            -
          </button>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 48, textAlign: 'center' }}>
            {Math.round(zoomState.currentZoomLevel * 100)}%
          </span>
          <button
            onClick={() => zoomApi?.zoomIn()}
            disabled={!zoomApi}
            style={{
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              width: 28,
              height: 28,
              cursor: zoomApi ? 'pointer' : 'not-allowed',
              opacity: zoomApi ? 1 : 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            +
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <Viewport
          documentId={documentId}
          className="absolute inset-0 bg-gray-100"
          data-viewport-doc={documentId}
        >
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
                  <AnnotationLayer
                    documentId={documentId}
                    pageIndex={pageIndex}
                    selectionOutline={{ color: '#475569', style: 'solid', width: 1, offset: 2 }}
                    customAnnotationRenderer={({ annotation, children }) => {
                      const thread = threads.find((t) => t.annotationId === annotation.id)

                      return (
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            // The annotation plugin puts pointerEvents: 'none' on every
                            // ancestor wrapper once the doc is locked (setLocked All), so
                            // the highlight's own hit area is disabled along with editing.
                            // Explicitly opt this wrapper back into hit-testing so hover/
                            // click still work for read-only comment viewing.
                            pointerEvents: 'auto',
                            cursor: thread ? 'pointer' : 'default',
                          }}
                          onMouseEnter={(e) => {
                            if (!thread || isCommentPopupOpen) return
                            setHoverComment({
                              thread,
                              position: { x: e.clientX + 16, y: e.clientY + 16 },
                            })
                          }}
                          onMouseLeave={() => setHoverComment(null)}
                          onClick={(e) => {
                            if (!thread) return
                            e.stopPropagation()
                            setHoverComment(null)
                            onShowComments(thread, { x: e.clientX + 16, y: e.clientY + 16 })
                          }}
                        >
                          {children}
                          {thread && (
                            <div
                              style={{
                                position: 'absolute',
                                top: -8,
                                right: -8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                borderRadius: 999,
                                border: '1px solid #065f46',
                                background: '#10b981',
                                color: '#ecfdf5',
                                padding: '2px 5px',
                                fontSize: 9,
                                fontWeight: 800,
                                lineHeight: 1,
                                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.35)',
                                pointerEvents: 'none',
                              }}
                            >
                              <MessageSquare size={8} />
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
      {hoverComment && (
        <CommentPopup
          thread={hoverComment.thread}
          position={hoverComment.position}
          onClose={() => setHoverComment(null)}
        />
      )}
    </div>
  )
}

export const ComparisonViewer = () => {
  const { engine, isLoading } = usePdfiumEngine()
  const [basePdf] = useState(resolveBasePdf)
  const [comparisonFile, setComparisonFile] = useState<File | null>(null)
  const [comparisonDocumentId, setComparisonDocumentId] = useState<string | null>(null)
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true)
  const [userId] = useState(() => {
    const stored = localStorage.getItem(COLLAB_USER_ID_STORAGE_KEY)
    if (stored) return stored
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `user_${Math.random().toString(36).slice(2)}`
    localStorage.setItem(COLLAB_USER_ID_STORAGE_KEY, id)
    return id
  })
  const userName = useMemo(
    () => localStorage.getItem(COMMENT_AUTHOR_STORAGE_KEY) || 'Comparison Viewer',
    [],
  )
  const [commentPopup, setCommentPopup] = useState<{
    thread: CommentThread
    position: { x: number; y: number }
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const documentIdA = basePdf.documentId
  const documentIdB = comparisonDocumentId

  const {
    isConnected: isCollabConnected,
    annotations: collabAnnotations,
    threads,
  } = useDocumentCollaboration(documentIdA, userId, userName)

  const normalizedThreads = useMemo(
    () => mergeThreadsWithAnnotationFallback(threads, collabAnnotations),
    [threads, collabAnnotations],
  )

  const plugins = useMemo(() => {
    const registrations = [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: comparisonFile
          ? [basePdf, { documentId: 'comparison-pdf', url: URL.createObjectURL(comparisonFile), name: comparisonFile.name }]
          : [basePdf],
      }),
      createPluginRegistration(ViewportPluginPackage),
      createPluginRegistration(ZoomPluginPackage),
      createPluginRegistration(ScrollPluginPackage),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(InteractionManagerPluginPackage),
      createPluginRegistration(SelectionPluginPackage),
      createPluginRegistration(HistoryPluginPackage),
      createPluginRegistration(AnnotationPluginPackage, {
        annotationAuthor: 'Comparison Reviewer',
      }),
    ]

    return registrations
  }, [comparisonFile, basePdf])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setComparisonFile(file)
      setComparisonDocumentId('comparison-pdf')
    }
  }, [])

  const handleShowComments = useCallback((thread: CommentThread, position: { x: number; y: number }) => {
    setCommentPopup({ thread, position })
  }, [])

  const handleCloseCommentPopup = useCallback(() => {
    setCommentPopup(null)
  }, [])

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
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
      style={{ userSelect: 'none' }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>PDF Comparison</h2>
          <span
            style={{
              fontSize: 11,
              background: comparisonDocumentId ? '#dcfce7' : '#fef3c7',
              color: comparisonDocumentId ? '#166534' : '#92400e',
              padding: '4px 10px',
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            {comparisonDocumentId ? 'Comparison Active' : 'Select PDF to Compare'}
          </span>
          <span
            style={{
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: isCollabConnected ? '#dbeafe' : '#f1f5f9',
              color: isCollabConnected ? '#1d4ed8' : '#64748b',
              padding: '4px 10px',
              borderRadius: 999,
              fontWeight: 600,
            }}
            title="Original PDF annotations sync live from the collaboration server"
          >
            {isCollabConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isCollabConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setScrollSyncEnabled((prev) => !prev)}
            disabled={!comparisonDocumentId}
            title={
              !comparisonDocumentId
                ? 'Load a comparison PDF to enable scroll sync'
                : scrollSyncEnabled
                  ? 'Scroll sync is on — click to scroll each PDF independently'
                  : 'Scroll sync is off — click to sync scrolling again'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: scrollSyncEnabled && comparisonDocumentId ? '#ecfdf5' : '#ffffff',
              color: scrollSyncEnabled && comparisonDocumentId ? '#059669' : '#6b7280',
              border: `1px solid ${scrollSyncEnabled && comparisonDocumentId ? '#10b981' : '#d1d5db'}`,
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: comparisonDocumentId ? 'pointer' : 'not-allowed',
              opacity: comparisonDocumentId ? 1 : 0.5,
            }}
          >
            {scrollSyncEnabled ? <Link2 size={14} /> : <Link2Off size={14} />}
            Scroll Sync {scrollSyncEnabled ? 'On' : 'Off'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#4f46e5',
              color: '#ffffff',
              border: '1px solid #4338ca',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Upload size={16} />
            Select PDF to Compare
          </button>
          {comparisonFile && (
            <button
              onClick={() => {
                setComparisonFile(null)
                setComparisonDocumentId(null)
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: '#ffffff',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16, overflow: 'hidden' }}>
        <EmbedPDF engine={engine} plugins={plugins}>
          <DocumentContent documentId={documentIdA}>
            {({ isLoaded }) =>
              isLoaded ? (
                comparisonDocumentId && documentIdB ? (
                  <>
                    <ScrollSyncBridge
                      documentIdA={documentIdA}
                      documentIdB={documentIdB}
                      enabled={scrollSyncEnabled}
                    />
                    <ComparisonPDFPanel
                      documentId={documentIdA}
                      threads={normalizedThreads}
                      annotations={collabAnnotations}
                      onShowComments={handleShowComments}
                      onCloseComments={handleCloseCommentPopup}
                      isCommentPopupOpen={commentPopup !== null}
                      label="Original PDF"
                    />
                    <ComparisonPDFPanel
                      documentId={documentIdB}
                      threads={normalizedThreads}
                      annotations={[]}
                      onShowComments={handleShowComments}
                      onCloseComments={handleCloseCommentPopup}
                      isCommentPopupOpen={commentPopup !== null}
                      label={comparisonFile?.name || 'Comparison PDF'}
                    />
                  </>
                ) : (
                  <>
                    <ComparisonPDFPanel
                      documentId={documentIdA}
                      threads={normalizedThreads}
                      annotations={collabAnnotations}
                      onShowComments={handleShowComments}
                      onCloseComments={handleCloseCommentPopup}
                      isCommentPopupOpen={commentPopup !== null}
                      label="Original PDF"
                    />
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 16,
                        border: '2px dashed #d1d5db',
                        borderRadius: 12,
                        background: '#f9fafb',
                        cursor: 'pointer',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={48} style={{ color: '#9ca3af' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                          Select a PDF to compare
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>
                          Click here or use the button above
                        </div>
                      </div>
                    </div>
                  </>
                )
              ) : null
            }
          </DocumentContent>
        </EmbedPDF>
      </div>

      {commentPopup && (
        <CommentPopup
          thread={commentPopup.thread}
          position={commentPopup.position}
          onClose={handleCloseCommentPopup}
        />
      )}
    </div>
  )
}
