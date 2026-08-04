/**
 * PeerReviewViewer Page
 *
 * A React PDF annotation viewer for peer-review using EmbedPDF Headless.
 * Features:
 * - Sticky tool rail with annotation tools (pen, shapes, text markup)
 * - Static tool-context header (color, line style, opacity, delete) pinned
 *   above the PDF column — no floating popover, so it never drifts on scroll
 * - Sticky comment threading panel
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF, useDocumentState } from '@embedpdf/core/react'
import { usePdfiumEngine } from '@embedpdf/engines/react'
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from '@embedpdf/plugin-document-manager/react'
import {
  Viewport,
  ViewportPluginPackage,
} from '@embedpdf/plugin-viewport/react'
import { ZoomPluginPackage, useZoom } from '@embedpdf/plugin-zoom/react'
import { Scroller, ScrollPluginPackage } from '@embedpdf/plugin-scroll/react'
import { RenderLayer, RenderPluginPackage } from '@embedpdf/plugin-render/react'
import {
  AnnotationLayer,
  AnnotationPluginPackage,
  LockModeType,
  useAnnotation,
  useAnnotationCapability,
  type AnnotationTransferItem,
  type CustomAnnotationRendererProps,
} from '@embedpdf/plugin-annotation/react'
import {
  SelectionLayer,
  SelectionPluginPackage,
  useSelectionCapability,
} from '@embedpdf/plugin-selection/react'
import {
  InteractionManagerPluginPackage,
  PagePointerProvider,
} from '@embedpdf/plugin-interaction-manager/react'
import { HistoryPluginPackage } from '@embedpdf/plugin-history/react'
import { ExportPluginPackage } from '@embedpdf/plugin-export/react'
import { Loader2, MessageSquare } from 'lucide-react'

import { ToolRail } from './components/ToolRail'
import { AnnotationToolHeader } from './components/AnnotationToolHeader'
import { CommentPanel, type ThreadPosition } from './components/CommentPanel'
import { useAnnotationMeta } from './hooks/useAnnotationMeta'
import type { AnnotationToolId, ColorOption, LineStyle, TextMarkupToolId } from './types'
import { PdfAnnotationSubtype, type PdfAnnotationObject, type Rect } from '@embedpdf/models'
import {
  DEFAULT_COLOR,
  DEFAULT_LINE_STYLE,
  isTextMarkupTool,
  mapAnnotationSubtypeToToolId,
  TOOL_CONFIGS,
} from './types'
import { getColorByHex, getStrokeDashArray } from './utils/styleUtils'

// ============================================================================
// Constants
// ============================================================================

const INITIAL_PDF = {
  documentId: 'peer-review-doc',
  url: 'https://snippet.embedpdf.com/ebook.pdf',
  name: 'ebook.pdf',
}

const ANNOTATION_STORAGE_KEY = 'embedpdf_peer_review_annotations_v1_'

// ============================================================================
// Plugin Registration
// ============================================================================

const createPlugins = (annotationAuthor: string) => [
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
    annotationAuthor,
  }),
]

const plugins = createPlugins('Peer Reviewer')

// ============================================================================
// Helper Functions
// ============================================================================

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// ============================================================================
// Annotation Persistence Component
// ============================================================================

interface AnnotationPersistenceProps {
  documentId: string
  isPaused: boolean
}

const AnnotationPersistence = ({ documentId, isPaused }: AnnotationPersistenceProps) => {
  const { provides: annotationApi, state } = useAnnotation(documentId)
  const storageKey = useMemo(() => `${ANNOTATION_STORAGE_KEY}${documentId}`, [documentId])
  const isRestoredRef = useRef(false)
  const saveTimeoutRef = useRef<number | null>(null)
  const pageStateSignature = useMemo(() => JSON.stringify(state.pages), [state.pages])

  const saveSnapshot = useCallback(() => {
    if (!annotationApi || isPaused) return

    annotationApi.exportAnnotations().wait(
      (items) => {
        localStorage.setItem(storageKey, JSON.stringify(items))
      },
      (error) => {
        console.error('Failed to export annotations for persistence:', error)
      }
    )
  }, [annotationApi, isPaused, storageKey])

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = window.setTimeout(saveSnapshot, 250)
  }, [saveSnapshot])

  // Restore from storage on mount
  useEffect(() => {
    if (!annotationApi || isRestoredRef.current) return

    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        const imported = JSON.parse(stored) as AnnotationTransferItem[]
        if (imported.length > 0) {
          annotationApi.importAnnotations(imported)
        }
      } catch (error) {
        console.error('Failed to restore annotations:', error)
      }
    }
    isRestoredRef.current = true
  }, [annotationApi, storageKey])

  // Save on changes
  useEffect(() => {
    if (!annotationApi || !isRestoredRef.current || isPaused) return
    scheduleSave()
  }, [annotationApi, isPaused, pageStateSignature, scheduleSave])

  // Subscribe to annotation events
  useEffect(() => {
    if (!annotationApi || isPaused) return

    const unsubscribe = annotationApi.onAnnotationEvent((event) => {
      if (event.type === 'loaded') return
      if (event.type === 'create' || event.type === 'update' || event.type === 'delete') {
        scheduleSave()
      }
    })

    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current)
      }
      unsubscribe()
    }
  }, [annotationApi, isPaused, scheduleSave])

  return null
}

// ============================================================================
// Sticky Note Annotation
// ============================================================================

interface StickyNoteAnnotationProps {
  annotationId: string
  contents: string
  color: string
  isSelected: boolean
  children: JSX.Element
  onSelect: (event: React.MouseEvent) => void
  onAnnotationSelect: (id: string) => void
  onCommitText: (text: string) => void
}

/**
 * Renders EmbedPDF's built-in sticky-note icon, plus an app-level popup that
 * previews the note text on hover and switches to an editable textarea while
 * the note is selected (mirrors classic PDF-viewer note UX).
 *
 * `contents` is a fully-controlled prop backed by `annotationMeta` (the same
 * synchronous, localStorage-backed store used for comments/colors) rather
 * than the PDF annotation object itself — writes land immediately with no
 * debounce/blur race to lose text to when the tool or selection changes.
 */
const StickyNoteAnnotation = ({
  annotationId,
  contents,
  color,
  isSelected,
  children,
  onSelect,
  onAnnotationSelect,
  onCommitText,
}: StickyNoteAnnotationProps) => {
  const [isHovered, setIsHovered] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!isSelected) return
    const timeoutId = window.setTimeout(() => textareaRef.current?.focus(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [isSelected])

  const showPopup = isSelected || isHovered

  return (
    <div
      onClick={(e) => {
        onSelect(e)
        onAnnotationSelect(annotationId)
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        outline: isSelected ? '2px solid #0f766e' : 'none',
        outlineOffset: 2,
        cursor: 'pointer',
      }}
    >
      {children}
      {showPopup && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 6,
            width: 240,
            background: '#fefce8',
            border: `1px solid ${color}`,
            borderRadius: 8,
            boxShadow: '0 10px 28px rgba(15, 23, 42, 0.22)',
            padding: 10,
            zIndex: 30,
          }}
        >
          {isSelected ? (
            <textarea
              ref={textareaRef}
              value={contents}
              onChange={(e) => onCommitText(e.target.value)}
              placeholder="Type your note..."
              rows={4}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13,
                lineHeight: 1.4,
                resize: 'vertical',
                fontFamily: 'inherit',
                color: '#44403c',
              }}
            />
          ) : (
            <div style={{ fontSize: 13, lineHeight: 1.4, whiteSpace: 'pre-wrap', color: '#57534e' }}>
              {contents || 'Empty note — click to write'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Workspace Component
// ============================================================================

interface WorkspaceProps {
  documentId: string
  authorName: string
  onAuthorNameChange: (name: string) => void
}

const Workspace = ({ documentId, authorName, onAuthorNameChange }: WorkspaceProps) => {
  const { provides: annotationApi, state: annotationState } = useAnnotation(documentId)
  const { provides: annotationCapability } = useAnnotationCapability()
  const { provides: zoomApi, state: zoomState } = useZoom(documentId)

  const annotationMeta = useAnnotationMeta({ documentId })

  // UI State
  const [activeTool, setActiveTool] = useState<AnnotationToolId | null>(null)
  const [selectedColor, setSelectedColor] = useState<ColorOption>(DEFAULT_COLOR)
  const [selectedOpacity, setSelectedOpacity] = useState(100)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [selectedAnnotationUid, setSelectedAnnotationUid] = useState<string | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  // These have no UI toggle yet, so they stay fixed rather than carrying
  // unused setters around.
  const textSelectionEnabled = true
  const annotationEditingEnabled = true
  const persistencePaused = false
  const selectedLineStyle: LineStyle = DEFAULT_LINE_STYLE.id
  const lineWidth = 2

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const threadCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [threadPositions, setThreadPositions] = useState<Record<string, ThreadPosition>>({})

  // Sync tool with annotation API
  useEffect(() => {
    if (!annotationApi) return

    if (activeTool) {
      annotationApi.setActiveTool(activeTool)
    } else {
      annotationApi.setActiveTool(null)
    }
  }, [annotationApi, activeTool])

  // Handle lock mode
  useEffect(() => {
    if (!annotationApi) return

    if (annotationEditingEnabled) {
      annotationApi.setLocked({ type: LockModeType.None })
    } else {
      annotationApi.setActiveTool(null)
      annotationApi.deselectAnnotation()
      annotationApi.setLocked({ type: LockModeType.All })
    }
  }, [annotationApi, annotationEditingEnabled])

  // Push selected color/opacity/line style into tool defaults so new
  // annotations draw with them — lets the header configure a tool before
  // the first shape is drawn, not just after.
  useEffect(() => {
    if (!annotationCapability) return

    const hex = selectedColor.hex
    const opacity = selectedOpacity / 100
    const dashArrayStr = getStrokeDashArray(selectedLineStyle, lineWidth)
    const strokeDashArray = dashArrayStr ? dashArrayStr.split(',').map(Number) : undefined

    // Shapes/ink: colored stroke, transparent fill, line style + width
    for (const toolId of ['circle', 'square', 'polygon', 'ink', 'lineArrow']) {
      annotationCapability.setToolDefaults(toolId, {
        strokeColor: hex,
        color: 'transparent',
        opacity,
        strokeWidth: lineWidth,
        strokeDashArray,
      })
    }
    // Text markup: both strokeColor and fill color
    for (const toolId of ['highlight', 'underline', 'strikeout']) {
      annotationCapability.setToolDefaults(toolId, { strokeColor: hex, color: hex, opacity })
    }
    // Free text: font color
    annotationCapability.setToolDefaults('freeText', { fontColor: hex, opacity } as any)
    // Sticky note: icon color
    annotationCapability.setToolDefaults('textComment', { strokeColor: hex, opacity })
  }, [annotationCapability, selectedColor, selectedOpacity, selectedLineStyle, lineWidth])

  // Handle annotation selection from state
  useEffect(() => {
    if (annotationState.selectedUids.length === 1) {
      const uid = annotationState.selectedUids[0]
      const selected = annotationState.byUid[uid]
      if (selected) {
        setSelectedAnnotationId(selected.object.id)
        setSelectedAnnotationUid(uid)

        // Sync color from annotation meta if available
        const meta = annotationMeta.getAnnotationMeta(selected.object.id)
        if (meta?.color) {
          setSelectedColor(getColorByHex(meta.color))
        }
        const annotationOpacity = (selected.object as { opacity?: number }).opacity
        setSelectedOpacity(Math.round((meta?.opacity ?? annotationOpacity ?? 1) * 100))

        // Find corresponding thread
        const thread = annotationMeta.getThreadForAnnotation(selected.object.id)
        if (thread) {
          setActiveThreadId(thread.id)
        }
      }
    } else {
      setSelectedAnnotationId(null)
      setSelectedAnnotationUid(null)
      setSelectedOpacity(100)
    }
  }, [annotationState, annotationMeta])

  const selectedTrackedAnnotation = useMemo(() => {
    if (selectedAnnotationUid) {
      const byUid = annotationState.byUid[selectedAnnotationUid]
      if (byUid) return byUid
    }

    if (selectedAnnotationId && annotationApi) {
      return annotationApi.getAnnotationById(selectedAnnotationId)
    }

    return null
  }, [annotationApi, annotationState.byUid, selectedAnnotationId, selectedAnnotationUid])

  // Handlers
  const handleToolSelect = useCallback((tool: AnnotationToolId | null) => {
    setActiveTool(tool)
  }, [])

  const handleColorSelect = useCallback((color: ColorOption) => {
    setSelectedColor(color)
    if (selectedAnnotationId && selectedAnnotationUid && annotationApi) {
      annotationMeta.updateAnnotationColor(selectedAnnotationId, color.hex)
      const selected = annotationState.byUid[selectedAnnotationUid]
      if (selected) {
        const isFreeText = selected.object.type === PdfAnnotationSubtype.FREETEXT
        annotationApi.updateAnnotation(
          selected.object.pageIndex,
          selectedAnnotationId,
          isFreeText ? { fontColor: color.hex } as any : { strokeColor: color.hex } as any
        )
      }
    }
  }, [selectedAnnotationId, selectedAnnotationUid, annotationApi, annotationState, annotationMeta])

  const handleZoomIn = useCallback(() => {
    zoomApi?.zoomIn()
  }, [zoomApi])

  const handleZoomOut = useCallback(() => {
    zoomApi?.zoomOut()
  }, [zoomApi])

  const handleAnnotationSelect = useCallback((annotationId: string | null) => {
    setSelectedAnnotationId(annotationId)
    if (annotationId) {
      const thread = annotationMeta.getThreadForAnnotation(annotationId)
      if (thread) {
        setActiveThreadId(thread.id)
      }
    } else {
      setActiveThreadId(null)
    }
  }, [annotationMeta])

  const handleAnnotationCreate = useCallback((annotation: PdfAnnotationObject) => {
    annotationMeta.initAnnotationMeta(annotation.id, {
      color: selectedColor.hex,
      opacity: selectedOpacity / 100,
      lineStyle: selectedLineStyle,
      lineWidth,
    })
    setSelectedAnnotationId(annotation.id)
  }, [annotationMeta, selectedColor, selectedOpacity, selectedLineStyle, lineWidth])

  // Newly drawn annotations get their styling metadata initialized and are
  // auto-selected so the contextual toolbar appears immediately.
  useEffect(() => {
    if (!annotationApi) return

    const unsubscribe = annotationApi.onAnnotationEvent((event) => {
      if (event.type === 'create') {
        handleAnnotationCreate(event.annotation)
      }
    })

    return unsubscribe
  }, [annotationApi, handleAnnotationCreate])

  // The note text lives primarily in annotationMeta (synchronous, localStorage-backed,
  // same mechanism as comments/colors) so it can never be lost to a tool/selection
  // change. It's also best-effort mirrored onto the PDF annotation's own `contents`
  // field so an exported PDF carries the real note text too.
  const handleStickyNoteCommit = useCallback((pageIndex: number, annotationId: string, text: string) => {
    annotationMeta.updateAnnotationNoteText(annotationId, text)
    annotationApi?.updateAnnotation(pageIndex, annotationId, { contents: text })
  }, [annotationMeta, annotationApi])

  const handleColorChange = useCallback((color: string) => {
    const colorOpt = getColorByHex(color)
    setSelectedColor(colorOpt)
    if (selectedAnnotationId && selectedTrackedAnnotation && annotationApi) {
      annotationMeta.updateAnnotationColor(selectedAnnotationId, color)
      const selected = selectedTrackedAnnotation
      if (selected) {
        const isFreeText = selected.object.type === PdfAnnotationSubtype.FREETEXT
        annotationApi.updateAnnotation(
          selected.object.pageIndex,
          selectedAnnotationId,
          isFreeText ? { fontColor: color } as any : { strokeColor: color } as any
        )
      }
    }
  }, [selectedAnnotationId, selectedTrackedAnnotation, annotationApi, annotationMeta])

  const handleOpacityChange = useCallback((opacityPercent: number) => {
    const clamped = Math.max(0, Math.min(100, opacityPercent))
    setSelectedOpacity(clamped)

    if (!selectedAnnotationId || !selectedTrackedAnnotation || !annotationApi) return

    const selected = selectedTrackedAnnotation
    if (!selected) return

    const opacity = clamped / 100
    annotationMeta.updateAnnotationOpacity(selectedAnnotationId, opacity)
    annotationApi.updateAnnotation(selected.object.pageIndex, selectedAnnotationId, { opacity } as any)
  }, [selectedAnnotationId, selectedTrackedAnnotation, annotationApi, annotationMeta])

  const handleDeleteAnnotation = useCallback(() => {
    if (!selectedAnnotationId || !selectedTrackedAnnotation || !annotationApi) return

    const selected = selectedTrackedAnnotation
    if (selected) {
      annotationApi.deleteAnnotation(selected.object.pageIndex, selectedAnnotationId)
      annotationMeta.removeAnnotationMeta(selectedAnnotationId)
      setSelectedAnnotationId(null)
      setSelectedAnnotationUid(null)
    }
  }, [selectedAnnotationId, selectedTrackedAnnotation, annotationApi, annotationMeta])

  // Keyboard shortcut parity with the Delete button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      if (!selectedAnnotationId) return

      const target = event.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        const isEditableField =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable ||
          !!target.closest('[contenteditable="true"]')

        if (isEditableField) return
      }

      event.preventDefault()
      handleDeleteAnnotation()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [selectedAnnotationId, handleDeleteAnnotation])

  const handleFocusThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    const thread = annotationMeta.threads.find((t) => t.id === threadId)
    if (thread && annotationApi) {
      annotationApi.selectAnnotation(thread.pageIndex, thread.annotationId)
      setSelectedAnnotationId(thread.annotationId)
    }
  }, [annotationMeta, annotationApi])

  const handleStartCommentDraft = useCallback((draft: CommentDraft) => {
    const thread = annotationMeta.addThread(draft.annotationId, draft.quote, draft.pageIndex, draft.anchorRatio)
    setSelectedAnnotationId(draft.annotationId)
    setActiveThreadId(thread.id)
  }, [annotationMeta])

  const handleAddReply = useCallback((threadId: string, text: string) => {
    annotationMeta.addReply(threadId, text, authorName)
  }, [annotationMeta, authorName])

  const handleDeleteComment = useCallback((threadId: string, commentId: string) => {
    annotationMeta.deleteComment(threadId, commentId, authorName)
  }, [annotationMeta, authorName])

  const handleDeleteThread = useCallback((threadId: string) => {
    const thread = annotationMeta.threads.find((t) => t.id === threadId)
    if (thread) {
      annotationMeta.deleteThread(threadId)
      if (selectedAnnotationId === thread.annotationId) {
        setSelectedAnnotationId(null)
      }
    }
  }, [annotationMeta, selectedAnnotationId])

  const handleThreadRef = useCallback((threadId: string, el: HTMLDivElement | null) => {
    threadCardRefs.current[threadId] = el
  }, [])

  // Recomputes each comment card's sidebar `top` so it lines up with where its
  // highlighted text sits on the PDF page — a page's cards move together as the
  // viewport scrolls, and cards are hidden once their page scrolls out of view.
  const recalculateThreadPositions = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const viewportRect = viewport.getBoundingClientRect()
    const raw: Array<{ id: string; top: number; visible: boolean; height: number }> = []

    for (const thread of annotationMeta.threads) {
      const pageEl = pageRefs.current[thread.pageIndex]
      if (!pageEl) {
        raw.push({ id: thread.id, top: 0, visible: false, height: 0 })
        continue
      }

      const pageRect = pageEl.getBoundingClientRect()
      const visible = pageRect.bottom > viewportRect.top && pageRect.top < viewportRect.bottom
      const estimatedHeight = threadCardRefs.current[thread.id]?.offsetHeight ?? 180

      raw.push({
        id: thread.id,
        top: pageRect.top - viewportRect.top + pageRect.height * thread.anchorRatio - estimatedHeight / 2,
        visible,
        height: estimatedHeight,
      })
    }

    const visibleItems = raw.filter((item) => item.visible).sort((a, b) => a.top - b.top)
    const minGap = 14
    for (let i = 1; i < visibleItems.length; i += 1) {
      const prevBottom = visibleItems[i - 1].top + visibleItems[i - 1].height + minGap
      if (visibleItems[i].top < prevBottom) {
        visibleItems[i].top = prevBottom
      }
    }

    const next: Record<string, ThreadPosition> = {}
    for (const item of raw) {
      const adjusted = visibleItems.find((candidate) => candidate.id === item.id)
      const top = adjusted ? adjusted.top : item.top
      next[item.id] = {
        visible: item.visible,
        top: clamp(top, 24, Math.max(viewportRect.height - item.height - 24, 24)),
        height: item.height,
      }
    }

    setThreadPositions((prev) => {
      const hasChanged =
        Object.keys(prev).length !== Object.keys(next).length ||
        Object.entries(next).some(([id, value]) => {
          const prevValue = prev[id]
          return !prevValue || prevValue.visible !== value.visible || Math.abs(prevValue.top - value.top) > 0.5
        })
      return hasChanged ? next : prev
    })
  }, [annotationMeta.threads])

  useEffect(() => {
    recalculateThreadPositions()
  }, [recalculateThreadPositions, activeThreadId])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onScroll = () => recalculateThreadPositions()
    viewport.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)

    return () => {
      viewport.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [recalculateThreadPositions])

  // Custom annotation renderer
  const customAnnotationRenderer = useCallback(
    ({ annotation, isSelected, children, onSelect, pageIndex }: CustomAnnotationRendererProps<PdfAnnotationObject>) => {
      if (annotation.type === PdfAnnotationSubtype.TEXT) {
        return (
          <StickyNoteAnnotation
            annotationId={annotation.id}
            contents={annotationMeta.getAnnotationMeta(annotation.id)?.noteText ?? ''}
            color={annotation.strokeColor ?? annotation.color ?? DEFAULT_COLOR.hex}
            isSelected={isSelected}
            onSelect={onSelect}
            onAnnotationSelect={handleAnnotationSelect}
            onCommitText={(text) => handleStickyNoteCommit(pageIndex, annotation.id, text)}
          >
            {children}
          </StickyNoteAnnotation>
        )
      }

      const thread = annotationMeta.getThreadForAnnotation(annotation.id)

      return (
        <div
          onClick={(e) => {
            onSelect(e)
            handleAnnotationSelect(annotation.id)
          }}
          style={{
            position: 'relative',
            outline: isSelected ? '2px solid #0f766e' : 'none',
            outlineOffset: 2,
            cursor: 'pointer',
          }}
        >
          {children}
          {thread && (
            <div
              title={`${thread.messages.length} comment${thread.messages.length !== 1 ? 's' : ''}`}
              style={{
                position: 'absolute',
                top: -10,
                right: -10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                borderRadius: 999,
                border: '1px solid #059669',
                background: '#10b981',
                color: '#ecfdf5',
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 700,
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
    },
    [annotationMeta, handleAnnotationSelect, handleStickyNoteCommit]
  )

  const orderedThreads = useMemo(() => {
    return [...annotationMeta.threads].sort((a, b) => {
      const aPos = threadPositions[a.id]
      const bPos = threadPositions[b.id]
      if (aPos && bPos) return aPos.top - bPos.top
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
      return a.createdAt - b.createdAt
    })
  }, [annotationMeta.threads, threadPositions])

  const selectedAnnotationToolId = useMemo(() => {
    const subtype = selectedTrackedAnnotation?.object?.type
    return mapAnnotationSubtypeToToolId(subtype)
  }, [selectedTrackedAnnotation])

  const selectedAnnotationLabel = useMemo(
    () => TOOL_CONFIGS.find((t) => t.id === selectedAnnotationToolId)?.name ?? 'Annotation',
    [selectedAnnotationToolId]
  )

  const activeToolLabel = useMemo(
    () => TOOL_CONFIGS.find((t) => t.id === activeTool)?.name,
    [activeTool]
  )

  // Header shows whenever a drawing/markup tool is armed or an annotation is
  // selected — "select" alone has no color/style controls worth surfacing.
  const isToolHeaderVisible = (!!activeTool && activeTool !== 'select') || !!selectedAnnotationId
  const toolHeaderAnnotationType: AnnotationToolId = selectedAnnotationId
    ? selectedAnnotationToolId
    : activeTool ?? 'select'
  const toolHeaderLabel = selectedAnnotationId
    ? `${selectedAnnotationLabel} selected`
    : activeToolLabel

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-paper-200 bg-white font-ui">
      <AnnotationPersistence documentId={documentId} isPaused={persistencePaused} />

      {/* Top identity strip — full width, never scrolls */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-paper-200 bg-paper-50 px-5 py-3">
        <label className="flex items-center gap-2.5 text-xs font-semibold text-paper-500">
          Reviewer
          <input
            type="text"
            value={authorName}
            onChange={(e) => onAuthorNameChange(e.target.value)}
            placeholder="Your name"
            className="w-40 rounded-md border border-paper-300 bg-white px-2.5 py-1.5 text-[13px] font-medium text-paper-900 transition-shadow placeholder:text-paper-400 focus:border-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-100"
          />
        </label>
        <span className="font-display text-[15px] font-medium text-paper-800">
          {INITIAL_PDF.name}
        </span>
      </header>

      {/* Content row — the PDF viewport is the only region that scrolls */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Tool Rail (Left) */}
        <ToolRail
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          zoomLevel={zoomState?.currentZoomLevel ?? 1}
          canZoomIn={true}
          canZoomOut={true}
          selectedColor={selectedColor}
          onColorSelect={handleColorSelect}
          isAnnotationEditingEnabled={annotationEditingEnabled}
        />

        {/* PDF Column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {isToolHeaderVisible && (
            <AnnotationToolHeader
              annotationType={toolHeaderAnnotationType}
              label={toolHeaderLabel}
              currentColor={selectedColor.hex}
              currentOpacity={selectedOpacity}
              onColorChange={handleColorChange}
              onOpacityChange={handleOpacityChange}
              onDelete={selectedAnnotationId ? handleDeleteAnnotation : undefined}
              isTextMarkup={isTextMarkupTool(toolHeaderAnnotationType)}
            />
          )}

          <div ref={viewportRef} className="min-h-0 flex-1 overflow-hidden bg-white">
            <Viewport documentId={documentId} className="h-full w-full overflow-hidden">
              <Scroller
                documentId={documentId}
                renderPage={({ pageIndex }) => (
                  <div
                    ref={(el) => {
                      pageRefs.current[pageIndex] = el
                    }}
                    className="relative mb-4 bg-white shadow-sm"
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
                            <SelectionMenu
                              {...props}
                              documentId={documentId}
                              annotationEditingEnabled={annotationEditingEnabled}
                              onStartComment={handleStartCommentDraft}
                            />
                          )}
                        />
                      )}
                      <AnnotationLayer
                        documentId={documentId}
                        pageIndex={pageIndex}
                        selectionOutline={{ color: '#185d50', style: 'solid', width: 1, offset: 2 }}
                        groupSelectionOutline={{ color: '#5aab95', style: 'dashed', width: 2, offset: 3 }}
                        customAnnotationRenderer={customAnnotationRenderer}
                      />
                    </PagePointerProvider>
                  </div>
                )}
              />
            </Viewport>
          </div>
        </div>

        {/* Comment Panel (Right) */}
        <CommentPanel
          threads={orderedThreads}
          positions={threadPositions}
          activeThreadId={activeThreadId}
          currentAuthorName={authorName}
          onAddReply={handleAddReply}
          onDeleteComment={handleDeleteComment}
          onDeleteThread={handleDeleteThread}
          onFocusThread={handleFocusThread}
          onThreadRef={handleThreadRef}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Selection Menu Component
// ============================================================================

interface CommentDraft {
  annotationId: string
  pageIndex: number
  quote: string
  anchorRatio: number
}

interface SelectionMenuProps {
  documentId: string
  rect: Rect
  placement: { suggestTop: boolean }
  menuWrapperProps: React.HTMLAttributes<HTMLDivElement>
  annotationEditingEnabled: boolean
  onStartComment: (draft: CommentDraft) => void
}

const SelectionMenu = ({
  documentId,
  rect,
  placement,
  menuWrapperProps,
  annotationEditingEnabled,
  onStartComment,
}: SelectionMenuProps) => {
  const { provides: annotationApi } = useAnnotation(documentId)
  const { provides: selectionCapability } = useSelectionCapability()
  const documentState = useDocumentState(documentId)

  const handleCreate = useCallback(
    (toolId: TextMarkupToolId) => {
      if (!annotationApi || !annotationEditingEnabled) return

      const scope = selectionCapability?.forDocument(documentId)
      if (!scope) return

      const selections = scope.getFormattedSelection()
      if (selections.length === 0) return

      annotationApi.setActiveTool(toolId)
      const activeTool = annotationApi.getActiveTool()
      if (!activeTool) return

      for (const selection of selections) {
        const id = generateId()
        annotationApi.createAnnotation(selection.pageIndex, {
          ...(activeTool.defaults as Record<string, unknown>),
          id,
          pageIndex: selection.pageIndex,
          rect: selection.rect,
          segmentRects: selection.segmentRects,
          created: new Date(),
        } as any)
      }

      scope.clear()
      annotationApi.setActiveTool(null)
    },
    [annotationApi, annotationEditingEnabled, documentId, selectionCapability]
  )

  const handleStartComment = useCallback(() => {
    if (!annotationApi || !annotationEditingEnabled) return

    const scope = selectionCapability?.forDocument(documentId)
    if (!scope) return

    const selections = scope.getFormattedSelection()
    if (selections.length === 0) return

    annotationApi.setActiveTool('highlight')
    const activeTool = annotationApi.getActiveTool()
    if (!activeTool) return

    const createDrafts = (quote: string) => {
      for (const selection of selections) {
        const id = generateId()
        annotationApi.createAnnotation(selection.pageIndex, {
          ...(activeTool.defaults as Record<string, unknown>),
          id,
          pageIndex: selection.pageIndex,
          rect: selection.rect,
          segmentRects: selection.segmentRects,
          created: new Date(),
        } as any)

        const pageHeight = documentState?.document?.pages[selection.pageIndex]?.size.height
        const anchorRatio = pageHeight
          ? Math.min(0.96, Math.max(0.04, selection.rect.origin.y / pageHeight))
          : 0.5

        onStartComment({
          annotationId: id,
          pageIndex: selection.pageIndex,
          quote: quote || 'Selected text',
          anchorRatio,
        })
      }

      scope.clear()
      annotationApi.setActiveTool(null)
    }

    scope.getSelectedText().wait(
      (lines) => createDrafts(lines.join(' ').replace(/\s+/g, ' ').trim()),
      () => createDrafts('')
    )
  }, [annotationApi, annotationEditingEnabled, documentId, documentState, onStartComment, selectionCapability])

  const top = placement.suggestTop ? -44 : rect.size.height + 8

  return (
    <div {...menuWrapperProps}>
      <div
        style={{ position: 'absolute', top, pointerEvents: 'auto', zIndex: 20 }}
        className="flex gap-1.5 rounded-lg border border-paper-700 bg-paper-900 p-1.5 font-ui shadow-lg shadow-paper-950/40"
      >
        <button
          type="button"
          onClick={() => handleCreate('highlight')}
          disabled={!annotationEditingEnabled}
          className="rounded-md border border-yellow-400 bg-yellow-300 px-2.5 py-1.5 text-xs font-semibold text-paper-900 transition-colors hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Highlight
        </button>
        <button
          type="button"
          onClick={() => handleCreate('underline')}
          disabled={!annotationEditingEnabled}
          className="rounded-md border border-ink-300 bg-ink-100 px-2.5 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-ink-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Underline
        </button>
        <button
          type="button"
          onClick={() => handleCreate('strikeout')}
          disabled={!annotationEditingEnabled}
          className="rounded-md border border-red-300 bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-900 transition-colors hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Strikeout
        </button>
        <button
          type="button"
          onClick={handleStartComment}
          disabled={!annotationEditingEnabled}
          className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MessageSquare size={14} />
          Comment
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

const AUTHOR_STORAGE_KEY = 'embedpdf_peer_review_author_v1'

export const PeerReviewViewer = () => {
  const { engine, isLoading } = usePdfiumEngine()
  const [authorName, setAuthorName] = useState(() => {
    return localStorage.getItem(AUTHOR_STORAGE_KEY) || 'Reviewer'
  })

  useEffect(() => {
    localStorage.setItem(AUTHOR_STORAGE_KEY, authorName)
  }, [authorName])

  if (isLoading || !engine) {
    return (
      <div className="peer-review-loading">
        <Loader2 size={24} className="animate-spin" />
        <span>Loading PDF Engine...</span>
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
                <Workspace
                  documentId={activeDocumentId}
                  authorName={authorName}
                  onAuthorNameChange={setAuthorName}
                />
              )
            }
          </DocumentContent>
        )
      }
    </EmbedPDF>
  )
}

export default PeerReviewViewer
