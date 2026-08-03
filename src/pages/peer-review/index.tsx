/**
 * PeerReviewViewer Page
 *
 * A React PDF annotation viewer for peer-review using EmbedPDF Headless.
 * Features:
 * - Toolbar with annotation tools (pen, shapes, text markup)
 * - Color palette and line style options
 * - Comment threading panel
 * - Floating contextual toolbar for selected annotations
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF } from '@embedpdf/core/react'
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
import { Loader2, MessageSquare, Trash2 } from 'lucide-react'

import { ToolRail } from './components/ToolRail'
import { ContextualToolbar } from './components/ContextualToolbar'
import { CommentPanel } from './components/CommentPanel'
import { useAnnotationMeta } from './hooks/useAnnotationMeta'
import type { AnnotationToolId, ColorOption, LineStyle, TextMarkupToolId } from './types'
import { PdfAnnotationSubtype, type PdfAnnotationObject, type Rect } from '@embedpdf/models'
import {
  COLOR_PALETTE,
  DEFAULT_COLOR,
  DEFAULT_LINE_STYLE,
  isTextMarkupTool,
  mapAnnotationSubtypeToToolId,
  TOOL_CONFIGS,
} from './types'
import { getColorByHex } from './utils/styleUtils'
import '../../styles/PeerReview.css'

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
  const [selectedLineStyle, setSelectedLineStyle] = useState<LineStyle>(DEFAULT_LINE_STYLE.id)
  const [lineWidth, setLineWidth] = useState(2)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [selectedAnnotationUid, setSelectedAnnotationUid] = useState<string | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number } | null>(null)

  // These have no UI toggle yet, so they stay fixed rather than carrying
  // unused setters around.
  const textSelectionEnabled = true
  const annotationEditingEnabled = true
  const persistencePaused = false

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const threadCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const viewportRef = useRef<HTMLDivElement | null>(null)

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

  // Push selected color into tool defaults so new annotations draw with it
  useEffect(() => {
    if (!annotationCapability) return

    const hex = selectedColor.hex
    const opacity = selectedOpacity / 100

    // Shapes: colored stroke, transparent fill
    for (const toolId of ['circle', 'square', 'polygon', 'ink', 'lineArrow']) {
      annotationCapability.setToolDefaults(toolId, { strokeColor: hex, color: 'transparent', opacity })
    }
    // Text markup: both strokeColor and fill color
    for (const toolId of ['highlight', 'underline', 'strikeout']) {
      annotationCapability.setToolDefaults(toolId, { strokeColor: hex, color: hex, opacity })
    }
    // Free text: font color
    annotationCapability.setToolDefaults('freeText', { fontColor: hex, opacity } as any)
    // Sticky note: icon color
    annotationCapability.setToolDefaults('textComment', { strokeColor: hex, opacity })
  }, [annotationCapability, selectedColor, selectedOpacity])

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

  // Update toolbar position when selection changes
  useEffect(() => {
    if (selectedAnnotationId) {
      // Find the annotation element and position toolbar above it
      const el = document.querySelector(`[data-annotation-id="${selectedAnnotationId}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        setToolbarPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        })
      }
    } else {
      setToolbarPosition(null)
    }
  }, [selectedAnnotationId])

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

  const handleLineStyleChange = useCallback((lineStyle: LineStyle) => {
    setSelectedLineStyle(lineStyle)
    if (selectedAnnotationId) {
      annotationMeta.updateAnnotationLineStyle(selectedAnnotationId, lineStyle)
    }
  }, [selectedAnnotationId, annotationMeta])

  const handleLineWidthChange = useCallback((width: number) => {
    setLineWidth(width)
    if (selectedAnnotationId) {
      annotationMeta.updateAnnotationLineWidth(selectedAnnotationId, width)
    }
  }, [selectedAnnotationId, annotationMeta])

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
    const thread = annotationMeta.addThread(draft.annotationId, draft.quote, draft.pageIndex, 0.5)
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
    return [...annotationMeta.threads].sort((a, b) => a.createdAt - b.createdAt)
  }, [annotationMeta.threads])

  const selectedAnnotationToolId = useMemo(() => {
    const subtype = selectedTrackedAnnotation?.object?.type
    return mapAnnotationSubtypeToToolId(subtype)
  }, [selectedTrackedAnnotation])

  const canAdjustOpacity = useMemo(() => {
    if (!selectedAnnotationId) return false

    // If selected annotation subtype is not yet resolved from plugin state,
    // keep opacity visible so users can still adjust immediately.
    if (!selectedTrackedAnnotation) return true

    if (isTextMarkupTool(selectedAnnotationToolId)) return true

    return selectedAnnotationToolId === 'ink' ||
      selectedAnnotationToolId === 'lineArrow' ||
      selectedAnnotationToolId === 'square' ||
      selectedAnnotationToolId === 'circle' ||
      selectedAnnotationToolId === 'polygon'
  }, [selectedAnnotationId, selectedAnnotationToolId, selectedTrackedAnnotation])

  const selectedAnnotationLabel = useMemo(
    () => TOOL_CONFIGS.find((t) => t.id === selectedAnnotationToolId)?.name ?? 'Annotation',
    [selectedAnnotationToolId]
  )

  return (
    <div className="peer-review-workspace">
      <AnnotationPersistence documentId={documentId} isPaused={persistencePaused} />

      {/* Top Bar */}
      <header className="peer-review-header">
        <div className="peer-review-header-top">
          <div className="peer-review-header-left">
            <label className="author-input-label">
              Reviewer
              <input
                type="text"
                value={authorName}
                onChange={(e) => onAuthorNameChange(e.target.value)}
                className="author-input"
                placeholder="Your name"
              />
            </label>
          </div>
          <div className="peer-review-header-right">
            <span className="document-title">{INITIAL_PDF.name}</span>
          </div>
        </div>
        {selectedAnnotationId && (
          <div className="peer-review-selection-bar">
            <span className="selection-type-label">
              {selectedAnnotationLabel} selected
            </span>
            <div className="selection-colors">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`selection-color-swatch${selectedColor.hex === color.hex ? ' active' : ''}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => handleColorChange(color.hex)}
                  title={color.label}
                />
              ))}
            </div>
            {canAdjustOpacity && (
              <label className="selection-opacity-control">
                <span>Opacity {selectedOpacity}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={selectedOpacity}
                  onChange={(e) => handleOpacityChange(Number(e.target.value))}
                  className="selection-opacity-slider"
                />
              </label>
            )}
            <button
              type="button"
              className="selection-delete-btn"
              onClick={handleDeleteAnnotation}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="peer-review-content">
        {/* Tool Rail (Left Sidebar) */}
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

        {/* PDF Viewport */}
        <div ref={viewportRef} className="peer-review-viewport">
          <Viewport documentId={documentId} className="peer-review-viewport-inner">
            <Scroller
              documentId={documentId}
              renderPage={({ pageIndex }) => (
                <div
                  ref={(el) => {
                    pageRefs.current[pageIndex] = el
                  }}
                  className="pdf-page-container"
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
                      selectionOutline={{ color: '#475569', style: 'solid', width: 1, offset: 2 }}
                      groupSelectionOutline={{ color: '#64748b', style: 'dashed', width: 2, offset: 3 }}
                      customAnnotationRenderer={customAnnotationRenderer}
                    />
                  </PagePointerProvider>
                </div>
              )}
            />
          </Viewport>
        </div>

        {/* Comment Panel (Right Sidebar) */}
        <CommentPanel
          threads={orderedThreads}
          activeThreadId={activeThreadId}
          currentAuthorName={authorName}
          onAddReply={handleAddReply}
          onDeleteComment={handleDeleteComment}
          onDeleteThread={handleDeleteThread}
          onFocusThread={handleFocusThread}
          onThreadRef={handleThreadRef}
        />
      </div>

      {/* Contextual Toolbar (Floating) */}
      {selectedAnnotationId && toolbarPosition && (
        <ContextualToolbar
          annotationType={selectedAnnotationToolId}
          currentColor={selectedColor.hex}
          currentOpacity={selectedOpacity}
          currentLineStyle={selectedLineStyle}
          currentLineWidth={lineWidth}
          position={toolbarPosition}
          onColorChange={handleColorChange}
          onOpacityChange={handleOpacityChange}
          onLineStyleChange={handleLineStyleChange}
          onLineWidthChange={handleLineWidthChange}
          onDelete={handleDeleteAnnotation}
          isTextMarkup={isTextMarkupTool(selectedAnnotationToolId)}
        />
      )}
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

        onStartComment({
          annotationId: id,
          pageIndex: selection.pageIndex,
          quote: quote || 'Selected text',
        })
      }

      scope.clear()
      annotationApi.setActiveTool(null)
    }

    scope.getSelectedText().wait(
      (lines) => createDrafts(lines.join(' ').replace(/\s+/g, ' ').trim()),
      () => createDrafts('')
    )
  }, [annotationApi, annotationEditingEnabled, documentId, onStartComment, selectionCapability])

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
          type="button"
          onClick={() => handleCreate('highlight')}
          disabled={!annotationEditingEnabled}
          className="selection-menu-btn highlight"
        >
          Highlight
        </button>
        <button
          type="button"
          onClick={() => handleCreate('underline')}
          disabled={!annotationEditingEnabled}
          className="selection-menu-btn underline"
        >
          Underline
        </button>
        <button
          type="button"
          onClick={() => handleCreate('strikeout')}
          disabled={!annotationEditingEnabled}
          className="selection-menu-btn strikeout"
        >
          Strikeout
        </button>
        <button
          type="button"
          onClick={handleStartComment}
          disabled={!annotationEditingEnabled}
          className="selection-menu-btn comment"
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
