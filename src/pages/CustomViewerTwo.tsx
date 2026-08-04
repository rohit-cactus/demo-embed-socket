import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPluginRegistration } from '@embedpdf/core'
import { EmbedPDF } from '@embedpdf/core/react'
import { usePdfiumEngine } from '@embedpdf/engines/react'
import RichTextEditor from '../components/RichTextEditor'
import { Toast } from '../components/Toast'
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
import type {
  CommentThread,
  CommentMessage,
  AnnotationTransferItem as CollabAnnotationItem,
} from '../hooks/useCollaboration'
import { UserPresence } from '../components/UserPresence'

const INITIAL_PDF = {
  documentId: 'ebook-sample',
  url: 'https://snippet.embedpdf.com/ebook.pdf',
  name: 'ebook.pdf',
}

const PUBLIC_PDFS = [
  {
    documentId: 'public-demo-embed-pdf-viewer',
    url: 'https://testcdn.researcher.life/discovery/pdf/demo-embed-pdf-viewer.pdf',
    name: '100 MB+ Size pdf',
  },
]

const ALL_PDFS = [INITIAL_PDF, ...PUBLIC_PDFS]

const createPlugins = (initialPdf: {
  documentId: string
  url: string
  name: string
}) => [
  createPluginRegistration(DocumentManagerPluginPackage, {
    initialDocuments: [initialPdf],
  }),
  createPluginRegistration(ViewportPluginPackage),
  createPluginRegistration(ZoomPluginPackage),
  createPluginRegistration(ScrollPluginPackage),
  createPluginRegistration(RenderPluginPackage),
  createPluginRegistration(ExportPluginPackage, {
    defaultFileName: initialPdf.name,
  }),
  createPluginRegistration(InteractionManagerPluginPackage),
  createPluginRegistration(SelectionPluginPackage),
  createPluginRegistration(HistoryPluginPackage),
  createPluginRegistration(AnnotationPluginPackage, {
    annotationAuthor: 'EmbedPDF User',
  }),
]

const downloadArrayBuffer = (buffer: ArrayBuffer, fileName: string) => {
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const createAnnotationId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `anno_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

type TextMarkupToolId = 'highlight' | 'underline' | 'strikeout'

const COMMENT_AUTHOR_STORAGE_KEY = 'embedpdf_comment_author_v1'
const COLLAB_USER_ID_STORAGE_KEY = 'collab_user_id'
const ACTIVE_PDF_ID_STORAGE_KEY = 'embedpdf_active_pdf_id_v1'

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

const createThreadId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `thread_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const extractPlainText = (value: string) => value.replace(/\s+/g, ' ').trim()

const decodeHtmlEntities = (value: string) => {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value
  return textarea.value
}

const sanitizeCommentHtml = (value: string) => {
  if (!value) return ''

  const decoded = decodeHtmlEntities(value)
  const hasHtmlTag = /<\/?[a-z][\s\S]*>/i.test(decoded)
  const source = hasHtmlTag ? decoded : value

  const parsed = new DOMParser().parseFromString(source, 'text/html')

  parsed.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((node) => {
    node.remove()
  })

  parsed.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const attrValue = attribute.value.trim().toLowerCase()

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
        return
      }

      if ((name === 'href' || name === 'src') && attrValue.startsWith('javascript:')) {
        element.removeAttribute(attribute.name)
      }
    })
  })

  return parsed.body.innerHTML
}

const formatThreadTimestamp = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

const buildPdfThreadContents = (thread: CommentThread) => {
  const lines = thread.messages
    .map((message) => {
      const raw = message.text || ''
      // Strip HTML tags, decode entities, normalise whitespace for the PDF Contents field
      const plain = extractPlainText(
        decodeHtmlEntities(raw.replace(/<[^>]*>/g, ' '))
      )
      return plain ? `${message.authorName}: ${plain}` : ''
    })
    .filter((line) => line.length > 0)

  return lines.join('\n\n')
}

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

  const applyTextMarkup = useCallback(
    (toolId: TextMarkupToolId) => {
      if (!annotationEditingEnabled) return

      const selectionScope = selectionCapability?.forDocument(documentId)
      if (!selectionScope || !annotationApi) return

      const selections = selectionScope.getFormattedSelection()
      if (selections.length === 0) return

      annotationApi.setActiveTool(toolId)
      const activeTool = annotationApi.getActiveTool()
      if (!activeTool) return

      const createFromSelection = (text?: string) => {
        for (const selection of selections) {
          const id = createAnnotationId()
          annotationApi.createAnnotation(selection.pageIndex, {
            ...(activeTool.defaults as Record<string, unknown>),
            id,
            pageIndex: selection.pageIndex,
            rect: selection.rect,
            segmentRects: selection.segmentRects,
            created: new Date(),
            ...(text ? { custom: { text } } : {}),
          } as any)

          if (activeTool.behavior?.selectAfterCreate) {
            annotationApi.selectAnnotation(selection.pageIndex, id)
          }
        }

        selectionScope.clear()
        annotationApi.setActiveTool(null)
      }

      selectionScope.getSelectedText().wait(
        (lines) => createFromSelection(lines.join('\n')),
        () => createFromSelection(),
      )
    },
    [annotationApi, annotationEditingEnabled, documentId, selectionCapability],
  )

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
      () => createFromSelection(),
    )
  }, [
    annotationApi,
    annotationEditingEnabled,
    documentId,
    onStartCommentDraft,
    selectionCapability,
  ])

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
          onClick={() => applyTextMarkup('highlight')}
          style={{
            background: '#fef08a',
            color: '#111827',
            border: '1px solid #facc15',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Highlight
        </button>
        <button
          onClick={() => applyTextMarkup('underline')}
          style={{
            background: '#dbeafe',
            color: '#0f172a',
            border: '1px solid #93c5fd',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Underline
        </button>
        <button
          onClick={() => applyTextMarkup('strikeout')}
          style={{
            background: '#fee2e2',
            color: '#7f1d1d',
            border: '1px solid #fca5a5',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Strikeout
        </button>
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

const ImportExportToolbar = ({
  documentId,
  threads,
  textSelectionEnabled,
  setTextSelectionEnabled,
  annotationEditingEnabled,
  setAnnotationEditingEnabled,
  originalPdfName,
  setPersistencePaused,
}: {
  documentId: string
  threads: CommentThread[]
  textSelectionEnabled: boolean
  setTextSelectionEnabled: React.Dispatch<React.SetStateAction<boolean>>
  annotationEditingEnabled: boolean
  setAnnotationEditingEnabled: React.Dispatch<React.SetStateAction<boolean>>
  originalPdfName: string
  setPersistencePaused: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { provides: annotationApi, state } = useAnnotation(documentId)
  const { provides: exportApi } = useExport(documentId)
  const { provides: zoomApi, state: zoomState } = useZoom(documentId)
  const [exported, setExported] = useState<AnnotationTransferItem[] | null>(
    null,
  )
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!annotationApi) return

    if (annotationEditingEnabled) {
      annotationApi.setLocked({ type: LockModeType.None })
      return
    }

    annotationApi.setActiveTool(null)
    annotationApi.deselectAnnotation()
    annotationApi.setLocked({ type: LockModeType.All })
  }, [annotationApi, annotationEditingEnabled])

  const annotationCount = Object.values(state.pages).reduce(
    (sum, uids) => sum + uids.length,
    0,
  )

  const handleExport = useCallback(() => {
    if (!annotationApi) return
    annotationApi.exportAnnotations().wait(
      (result) => {
        setExported(result)
        setStatus(
          `Exported ${result.length} annotation${result.length !== 1 ? 's' : ''}`,
        )
      },
      () => setStatus('Export failed'),
    )
  }, [annotationApi])

  const handleClear = useCallback(() => {
    if (!annotationApi) return
    setPersistencePaused(true)
    // Defer past the render that commits `persistencePaused`, so effect2's
    // onAnnotationEvent listener (re-subscribed with the paused closure) is
    // active before the delete events fire — otherwise the stale closure
    // from before this click would still forward every delete to the server.
    setTimeout(() => {
      annotationApi.deleteAllAnnotations()
      setStatus('Cleared all annotations')
      setPersistencePaused(false)
    }, 0)
  }, [annotationApi, setPersistencePaused])

  const handleImport = useCallback(() => {
    if (!annotationApi || !exported) return
    annotationApi.importAnnotations(exported)
    setStatus(
      `Imported ${exported.length} annotation${exported.length !== 1 ? 's' : ''}`,
    )
  }, [annotationApi, exported])

  const handleDownloadWithoutAnnotations = useCallback(() => {
    if (!annotationApi || !exportApi) return

    setPersistencePaused(true)

    annotationApi.exportAnnotations().wait(
      (snapshot) => {
        const restoreAnnotations = () => {
          if (snapshot.length > 0) {
            annotationApi.importAnnotations(snapshot)
          }
          setPersistencePaused(false)
        }

        annotationApi.deleteAllAnnotations()

        exportApi.saveAsCopy().wait(
          (buffer) => {
            downloadArrayBuffer(buffer, originalPdfName)
            setStatus('Downloaded PDF without annotations')
            restoreAnnotations()
          },
          () => {
            setStatus('Failed to download PDF without annotations')
            restoreAnnotations()
          },
        )
      },
      () => {
        setStatus('Failed to prepare annotations for download')
        setPersistencePaused(false)
      },
    )
  }, [annotationApi, exportApi, originalPdfName, setPersistencePaused])

  const handleDownloadWithAnnotations = useCallback(() => {
    if (!annotationApi || !exportApi) return

    setPersistencePaused(true)

    // 1. Snapshot current annotations
    annotationApi.exportAnnotations().wait(
      (snapshot) => {
        const restoreAnnotations = () => {
          if (snapshot.length > 0) {
            annotationApi.importAnnotations(snapshot)
          }
          setPersistencePaused(false)
        }

        // 2. For each thread, build a batch patch so all updates go through a
        // single commit() call — individual updateAnnotation() each trigger an
        // auto-commit that can hold the lock and silently drop subsequent ones.
        const patches = threads
          .map((thread) => {
            const annotationItem = snapshot.find(
              (item) => item.annotation.id === thread.annotationId
            )
            if (!annotationItem) return null
            const rootMessage = thread.messages[0]
            return {
              pageIndex: thread.pageIndex,
              id: thread.annotationId,
              patch: {
                author: rootMessage?.authorName || annotationItem.annotation.author,
                created: rootMessage ? new Date(rootMessage.createdAt) : annotationItem.annotation.created,
                modified: new Date(),
                contents: buildPdfThreadContents(thread),
                subject: 'Comment thread',
                custom: {
                  ...(annotationItem.annotation.custom || {}),
                  thread: {
                    id: thread.id,
                    quote: thread.quote,
                    messages: thread.messages,
                    createdAt: thread.createdAt,
                  },
                },
              },
            }
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)

        if (patches.length > 0) {
          annotationApi.updateAnnotations(patches as any)
        }

        // 3. Ensure in-memory updates are committed before creating the exported copy.
        annotationApi.commit().wait(
          () => {
            exportApi.saveAsCopy().wait(
              (buffer) => {
                const name = originalPdfName.replace(/\.pdf$/i, '')
                downloadArrayBuffer(buffer, `${name}-with-annotations.pdf`)
                setStatus('Downloaded annotated PDF with comments')
                restoreAnnotations()
              },
              () => {
                setStatus('Failed to download annotated PDF')
                restoreAnnotations()
              }
            )
          },
          () => {
            setStatus('Failed to prepare annotations for export')
            restoreAnnotations()
          }
        )
      },
      () => {
        setStatus('Failed to prepare annotations for download')
        setPersistencePaused(false)
      }
    )
  }, [annotationApi, exportApi, originalPdfName, threads, setPersistencePaused])

  const tools = [
    { id: 'stampCheckmark', name: 'Checkmark', icon: Check },
    { id: 'stampCross', name: 'Cross', icon: X },
    { id: 'ink', name: 'Pen', icon: Pencil },
    { id: 'square', name: 'Square', icon: Square },
    { id: 'highlight', name: 'Highlight', icon: Highlighter },
    { id: 'freeText', name: 'Text', icon: Type },
  ]

  const selectedAnnotation =
    state.selectedUids.length === 1
      ? state.byUid[state.selectedUids[0]]
      : null

  const selectedFlags = Array.isArray((selectedAnnotation?.object as any)?.flags)
    ? ((selectedAnnotation?.object as any).flags as string[])
    : []

  const hasFlag = useCallback(
    (flag: string) => selectedFlags.includes(flag),
    [selectedFlags],
  )

  const toggleSelectedFlag = useCallback(
    (flag: string) => {
      if (!annotationApi || !annotationEditingEnabled || !selectedAnnotation) return

      const obj = selectedAnnotation.object as any
      const currentFlags = Array.isArray(obj.flags) ? (obj.flags as string[]) : []
      const nextFlags = currentFlags.includes(flag)
        ? currentFlags.filter((f) => f !== flag)
        : [...currentFlags, flag]

      annotationApi.updateAnnotation(obj.pageIndex, obj.id, {
        flags: nextFlags,
      } as any)
    },
    [annotationApi, annotationEditingEnabled, selectedAnnotation],
  )

  return (
    <div className="flex flex-col gap-2 border-b border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTextSelectionEnabled((prev) => !prev)}
          className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 transition-all ${
            textSelectionEnabled
              ? 'bg-blue-500 text-white ring-blue-600'
              : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-600'
          }`}
        >
          Text Selection: {textSelectionEnabled ? 'On' : 'Off'}
        </button>
        <button
          onClick={() => setAnnotationEditingEnabled((prev) => !prev)}
          className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium ring-1 transition-all ${
            annotationEditingEnabled
              ? 'bg-emerald-500 text-white ring-emerald-600'
              : 'bg-white text-gray-700 ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-gray-600'
          }`}
        >
          Annotation Edit: {annotationEditingEnabled ? 'On' : 'Off'}
        </button>
        <div className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-1.5 py-1 dark:border-gray-600 dark:bg-gray-700">
          <button
            onClick={() => zoomApi?.zoomOut()}
            disabled={!zoomApi}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-600"
            title="Zoom out"
          >
            -
          </button>
          <button
            onClick={() => zoomApi?.requestZoom(1)}
            disabled={!zoomApi}
            className="rounded px-2 py-0.5 text-[11px] font-semibold text-gray-700 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-600"
            title="Reset zoom"
          >
            {Math.round(zoomState.currentZoomLevel * 100)}%
          </button>
          <button
            onClick={() => zoomApi?.zoomIn()}
            disabled={!zoomApi}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-sm font-bold text-gray-700 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-600"
            title="Zoom in"
          >
            +
          </button>
        </div>
        <button
          onClick={handleDownloadWithoutAnnotations}
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white ring-1 ring-slate-800 transition-all hover:bg-slate-800"
        >
          <Download size={14} />
          Download Original
        </button>
        <button
          onClick={handleDownloadWithAnnotations}
          disabled={!exportApi}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white ring-1 ring-indigo-700 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={14} />
          Download Annotated
        </button>
      </div>

      <div className="flex flex-col gap-1 rounded-md border border-slate-300 bg-white px-2 py-2 dark:border-slate-600 dark:bg-slate-800">
        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
          Annotation Flags Demo (select one annotation)
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['hidden', 'noView', 'readOnly', 'locked', 'lockedContents'].map(
            (flag) => (
              <button
                key={flag}
                onClick={() => toggleSelectedFlag(flag)}
                disabled={!annotationEditingEnabled || !selectedAnnotation}
                className={`rounded-md px-2 py-1 text-xs font-medium ring-1 transition-all ${
                  hasFlag(flag)
                    ? 'bg-amber-500 text-white ring-amber-600'
                    : 'bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-600'
                } disabled:cursor-not-allowed disabled:opacity-50`}
                title={
                  flag === 'hidden'
                    ? 'Do not render, do not interact, do not print'
                    : flag === 'noView'
                      ? 'Do not render on screen, still print'
                      : flag === 'readOnly'
                        ? 'Render but block interaction/edit handles'
                        : flag === 'locked'
                          ? 'Selectable but cannot move/resize/rotate/change properties'
                          : 'Allow move/resize but block content edits'
                }
              >
                {flag}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Annotation tools */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="tracking-wide text-xs font-medium uppercase text-gray-600 dark:text-gray-300">
          Tools
        </span>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center gap-1.5">
          {tools.map((tool) => {
            const Icon = tool.icon
            const isActive = state.activeToolId === tool.id
            return (
              <button
                key={tool.id}
                onClick={() =>
                  annotationApi?.setActiveTool(isActive ? null : tool.id)
                }
                disabled={!annotationEditingEnabled}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium shadow-sm transition-all ${
                  isActive
                    ? 'bg-blue-500 text-white ring-1 ring-blue-600'
                    : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-100'
                }`}
                title={tool.name}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{tool.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Import/Export actions */}
      <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => {
    const selection: any = annotationApi?.getSelectedAnnotations()
    if (selection?.[0]) {
      annotationApi?.deleteAnnotation(selection[0].object.pageIndex, selection[0].object.id)
    }
  }}
  disabled={!annotationEditingEnabled || !state.selectedUid}
  >Delete</button>
        <span className="tracking-wide text-xs font-medium uppercase text-gray-600 dark:text-gray-300">
          Import / Export
        </span>
        <div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            disabled={annotationCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />
            Export ({annotationCount})
          </button>
          <button
            onClick={handleClear}
            disabled={!annotationEditingEnabled || annotationCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 size={14} />
            Clear All
          </button>
          <button
            onClick={handleImport}
            disabled={!annotationEditingEnabled || !exported}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-500 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={14} />
            Import{exported ? ` (${exported.length})` : ''}
          </button>
        </div>

        {status && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {status}
          </span>
        )}
      </div>
    </div>
  )
}

const ThreadSidebar = ({
  threads,
  positions,
  activeThreadId,
  currentAuthorName,
  pendingDraft,
  pendingDraftPosition,
  pendingCommentText,
  pendingReplyByThread,
  onFocusThread,
  onPendingCommentTextChange,
  onSubmitPendingComment,
  onCancelPendingComment,
  onReplyDraftChange,
  onSubmitReply,
  onThreadCardRef,
  onPendingDraftRef,
}: {
  threads: CommentThread[]
  positions: Record<string, ThreadPosition>
  activeThreadId: string | null
  currentAuthorName: string
  pendingDraft: PendingCommentDraft | null
  pendingDraftPosition: ThreadPosition | null
  pendingCommentText: string
  pendingReplyByThread: Record<string, string>
  onFocusThread: (threadId: string) => void
  onPendingCommentTextChange: (value: string) => void
  onSubmitPendingComment: () => void
  onCancelPendingComment: () => void
  onReplyDraftChange: (threadId: string, value: string) => void
  onSubmitReply: (threadId: string) => void
  onThreadCardRef: (threadId: string, el: HTMLDivElement | null) => void
  onPendingDraftRef: (el: HTMLDivElement | null) => void
}) => {
  if (threads.length === 0 && !pendingDraft) return null

  const maxThreadBottom = threads.reduce((maxBottom, thread) => {
    const pos = positions[thread.id]
    if (!pos || !pos.visible) return maxBottom
    return Math.max(maxBottom, pos.top + pos.height + 24)
  }, 0)

  const pendingBottom =
    pendingDraft && pendingDraftPosition?.visible
      ? pendingDraftPosition.top + pendingDraftPosition.height + 24
      : 0

  const scrollContentHeight = Math.max(maxThreadBottom, pendingBottom)

  return (
    <aside
      data-thread-sidebar="true"
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
        Comments
      </div>
      <div
        style={{
          position: 'relative',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            minHeight: '100%',
            height: scrollContentHeight > 0 ? scrollContentHeight : undefined,
          }}
        >
        {pendingDraft && pendingDraftPosition?.visible && (
          <div
            ref={onPendingDraftRef}
              data-thread-draft="true"
            style={{
              position: 'absolute',
              top: pendingDraftPosition.top,
              left: 10,
              right: 10,
              borderRadius: 10,
              border: '2px solid #059669',
              background: '#ecfdf5',
              boxShadow: '0 8px 18px rgba(6, 95, 70, 0.18)',
              padding: 10,
              zIndex: 2,
            }}
          >
            <div style={{ fontSize: 11, color: '#047857', marginBottom: 6 }}>
              New thread on page {pendingDraft.pageIndex + 1}
            </div>
            <div
              style={{
                borderRadius: 6,
                border: '1px solid #a7f3d0',
                background: '#ffffff',
                color: '#065f46',
                fontSize: 12,
                fontStyle: 'italic',
                padding: '6px 8px',
                marginBottom: 8,
              }}
            >
              "{pendingDraft.quote}"
            </div>
            <RichTextEditor
              content={{ html: pendingCommentText }}
              onChange={(content) => onPendingCommentTextChange(content.html)}
              placeholder="Write comment"
              minHeight={56}
            />
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 10, color: '#047857' }}>{currentAuthorName}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={onCancelPendingComment}
                  style={{
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    background: '#ffffff',
                    color: '#065f46',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '5px 8px',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSubmitPendingComment}
                  disabled={!pendingCommentText.trim() || !currentAuthorName.trim()}
                  style={{
                    borderRadius: 6,
                    border: '1px solid #059669',
                    background:
                      pendingCommentText.trim() && currentAuthorName.trim()
                        ? '#059669'
                        : '#d1fae5',
                    color:
                      pendingCommentText.trim() && currentAuthorName.trim()
                        ? '#ecfdf5'
                        : '#065f46',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '5px 8px',
                    cursor:
                      pendingCommentText.trim() && currentAuthorName.trim()
                        ? 'pointer'
                        : 'not-allowed',
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        {threads.map((thread) => {
          const pos = positions[thread.id]
          if (!pos || !pos.visible) return null

          const root = thread.messages[0]
          const replies = thread.messages.slice(1)
          const isExpanded = activeThreadId === thread.id
          const moreCount = Math.max(thread.messages.length - 1, 0)

          return (
            <div
              key={thread.id}
              ref={(el) => onThreadCardRef(thread.id, el)}
              data-thread-card="true"
              role="button"
              tabIndex={0}
              onClick={() => onFocusThread(thread.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onFocusThread(thread.id)
                }
              }}
              style={{
                position: 'absolute',
                top: pos.top,
                left: 10,
                right: 10,
                borderRadius: 14,
                border:
                  isExpanded
                    ? '2px solid #0f766e'
                    : '1px solid #d6dee9',
                background: '#ffffff',
                boxShadow: isExpanded
                  ? '0 10px 24px rgba(15, 23, 42, 0.16)'
                  : '0 8px 20px rgba(15, 23, 42, 0.12)',
                padding: 14,
                cursor: 'pointer',
                zIndex: isExpanded ? 1 : 0,
                maxHeight: 400,
                overflowY: 'auto',
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
                  <div style={{ marginTop: 10, fontSize: 36, lineHeight: 0, color: '#111827' }}>
                    <span style={{ fontSize: 22, letterSpacing: 2 }}>...</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 15, color: '#1f2937', lineHeight: 1.35 }}>
                    <div
                      style={
                        isExpanded
                          ? undefined
                          : {
                              display: '-webkit-box',
                              WebkitLineClamp: 5,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }
                      }
                      dangerouslySetInnerHTML={{
                        __html: sanitizeCommentHtml(root?.text || 'No comment text'),
                      }}
                    />
                  </div>
                  {!isExpanded && moreCount > 0 && (
                    <div style={{ marginTop: 10, fontSize: 16, color: '#4f46e5', fontWeight: 500 }}>
                      {moreCount} more comment{moreCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  borderRadius: 8,
                  border: '1px solid #dbeafe',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: 12,
                  fontStyle: 'italic',
                  padding: '6px 8px',
                }}
              >
                "{thread.quote}"
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
                  {replies.map((reply) => (
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
                      <div
                        style={{ fontSize: 12, color: '#0f172a' }}
                        dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(reply.text) }}
                      />
                    </div>
                  ))}

                  <div
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <RichTextEditor
                      content={{ html: pendingReplyByThread[thread.id] || '' }}
                      onChange={(content) => onReplyDraftChange(thread.id, content.html)}
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
                        onClick={() => onSubmitReply(thread.id)}
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
        })}
        </div>
      </div>
    </aside>
  )
}

const PdfSkeletonLoader = () => (
  <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
    {/* PDF pages area */}
    <div style={{ flex: 1, minWidth: 0, background: '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 16px', overflowY: 'auto' }}>
      {[0.92, 0.88, 0.94].map((scale, i) => (
        <div
          key={i}
          className="pdf-skeleton-bone"
          style={{ width: `${scale * 100}%`, maxWidth: 560, aspectRatio: '0.707', borderRadius: 6, flexShrink: 0 }}
        />
      ))}
    </div>
    {/* Thread sidebar skeleton */}
    <div style={{ width: 260, borderLeft: '1px solid #e2e8f0', background: '#ffffff', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
      <div className="pdf-skeleton-bone" style={{ height: 16, width: '60%' }} />
      {[80, 60, 100, 70].map((h, i) => (
        <div key={i} style={{ borderRadius: 8, border: '1px solid #e2e8f0', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="pdf-skeleton-bone" style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div className="pdf-skeleton-bone" style={{ height: 10, width: '50%' }} />
              <div className="pdf-skeleton-bone" style={{ height: 8, width: '35%' }} />
            </div>
          </div>
          <div className="pdf-skeleton-bone" style={{ height: h / 10, width: '100%' }} />
          <div className="pdf-skeleton-bone" style={{ height: 8, width: '80%' }} />
        </div>
      ))}
    </div>
  </div>
)

const AnnotatedDocumentWorkspace = ({
  documentId,
  pdfName,
  userId,
  userName,
  onUserNameChange,
  textSelectionEnabled,
  annotationEditingEnabled,
  persistencePaused,
  setTextSelectionEnabled,
  setAnnotationEditingEnabled,
  setPersistencePaused,
}: {
  documentId: string
  pdfName: string
  userId: string
  userName: string
  onUserNameChange: (name: string) => void
  textSelectionEnabled: boolean
  annotationEditingEnabled: boolean
  persistencePaused: boolean
  setTextSelectionEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setAnnotationEditingEnabled: React.Dispatch<React.SetStateAction<boolean>>
  setPersistencePaused: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const { provides: annotationApi, state } = useAnnotation(documentId)
  const {
    isConnected,
    isJoined,
    error: collabError,
    annotations: collabAnnotations,
    threads,
    users,
    lockedAnnotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    createThread,
    addReply,
    lockAnnotationForEditing,
    unlockAnnotation,
  } = useDocumentCollaboration(documentId, userId, userName)
  const [currentAuthorName, setCurrentAuthorName] = useState(userName)
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [pendingDraft, setPendingDraft] = useState<PendingCommentDraft | null>(null)
  const [pendingCommentText, setPendingCommentText] = useState('')
  const [pendingReplyByThread, setPendingReplyByThread] = useState<Record<string, string>>({})
  const [threadPositions, setThreadPositions] = useState<Record<string, ThreadPosition>>({})
  const [pendingDraftPosition, setPendingDraftPosition] = useState<ThreadPosition | null>(null)
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'error' | 'warning' | 'info' | 'success' } | null>(null)
  const [currentlyLockedAnnotationId, setCurrentlyLockedAnnotationId] = useState<string | null>(null)
  const focusTimeoutRef = useRef<number | null>(null)

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const annotationMetricsRef = useRef<Record<string, AnnotationMetric>>({})
  const threadCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingDraftCardRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  // useAnnotation() returns a brand-new `annotationApi` object every render, so effects
  // keyed on it re-fire constantly. Track which annotation ids we've already imported/
  // forwarded so those re-fires are no-ops instead of re-dispatching create actions
  // (which snowballs into a render loop / stack overflow).
  const importedAnnotationIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (currentAuthorName !== userName) {
      onUserNameChange(currentAuthorName)
    }
  }, [currentAuthorName, onUserNameChange, userName])

  useEffect(() => {
    importedAnnotationIdsRef.current.clear()
    setActiveThreadId(null)
    setPendingDraft(null)
    setPendingCommentText('')
    setPendingReplyByThread({})
    setThreadPositions({})
    setPendingDraftPosition(null)
    setFocusedAnnotationId(null)
    setCurrentlyLockedAnnotationId(null)
    setToastMessage(null)
  }, [documentId])

  // Handle annotation locking on selection - prevent concurrent edits
  useEffect(() => {
    if (!state.selectedUids.length) {
      // No annotation selected - unlock any previously locked annotation
      if (currentlyLockedAnnotationId) {
        unlockAnnotation(currentlyLockedAnnotationId)
        setCurrentlyLockedAnnotationId(null)
      }
      return
    }

    const selectedAnnotation = state.byUid[state.selectedUids[0]]?.object
    if (!selectedAnnotation) return

    // Check if this annotation is locked by someone else
    const lock = lockedAnnotations[selectedAnnotation.id]
    if (lock && lock.userId !== userId) {
      // Annotation is locked by another user - show error and deselect
      setToastMessage({
        message: `This annotation is being edited by ${lock.userName}. Please wait...`,
        type: 'warning',
      })
      annotationApi?.deselectAnnotation()
      return
    }

    // Lock this annotation for current user if we haven't already
    if (currentlyLockedAnnotationId !== selectedAnnotation.id) {
      lockAnnotationForEditing(selectedAnnotation.id)
      setCurrentlyLockedAnnotationId(selectedAnnotation.id)
    }
  }, [
    state.selectedUids,
    state.byUid,
    userId,
    annotationApi,
    lockedAnnotations,
    currentlyLockedAnnotationId,
    lockAnnotationForEditing,
  ])

  // Import annotations from the collaboration server once we've joined the room
  // (and pick up any new ones added later by other users).
  useEffect(() => {
    if (!annotationApi || !isJoined || collabAnnotations.length === 0) return
    const newItems = collabAnnotations.filter(
      (item) => !importedAnnotationIdsRef.current.has(item.annotation.id),
    )
    if (newItems.length === 0) return
    newItems.forEach((item) => importedAnnotationIdsRef.current.add(item.annotation.id))
    annotationApi.importAnnotations(newItems as any)
  }, [annotationApi, isJoined, collabAnnotations])

  // Sync local annotation changes to the collaboration server in real time.
  useEffect(() => {
    if (!annotationApi || !isJoined) return

    const unsubscribe = annotationApi.onAnnotationEvent((event) => {
      if (persistencePaused) return

      if (event.type === 'create') {
        if (importedAnnotationIdsRef.current.has(event.annotation.id)) return
        importedAnnotationIdsRef.current.add(event.annotation.id)
        // Forward the FULL annotation object (not a hand-picked subset) —
        // fields like `type` (highlight/strikeout/underline/...), `flags`,
        // and `custom.text` are required for the annotation to render at
        // all once it round-trips back through the server on reload or to
        // another client. Dropping any of them silently produces an
        // annotation with no matching renderer, which just disappears.
        createAnnotation({
          annotation: {
            ...(event.annotation as any),
            created: Date.now(),
          },
        } as CollabAnnotationItem)
      } else if (event.type === 'update') {
        const annotation = state.byUid[event.annotation.id]
        if (annotation) {
          updateAnnotation(event.annotation.id, annotation.object as any)
        }
      } else if (event.type === 'delete') {
        importedAnnotationIdsRef.current.delete(event.annotation.id)
        deleteAnnotation(event.pageIndex, event.annotation.id)
      }
    })

    return () => unsubscribe()
  }, [
    annotationApi,
    isJoined,
    persistencePaused,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    state.byUid,
  ])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!activeThreadId) return

      const target = event.target as HTMLElement | null
      if (!target) return

      if (target.closest('[data-thread-card="true"]')) return
      if (target.closest('[data-thread-draft="true"]')) return

      setActiveThreadId(null)
    }

    document.addEventListener('mousedown', handleOutsideClick, true)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true)
    }
  }, [activeThreadId])

  useEffect(() => {
    if (state.selectedUids.length !== 1) return

    const selectedUid = state.selectedUids[0]
    const selected = state.byUid[selectedUid]
    if (!selected) return

    const match = threads.find((thread) => thread.annotationId === selected.object.id)
    if (match) {
      setActiveThreadId(match.id)
    }
  }, [state.byUid, state.selectedUids, threads])

  const orderedThreads = useMemo(() => {
    const posMap = new Map<string, ThreadPosition>()
    Object.entries(threadPositions).forEach(([id, pos]) => posMap.set(id, pos))

    return [...threads].sort((a, b) => {
      const aPos = posMap.get(a.id)
      const bPos = posMap.get(b.id)
      if (aPos && bPos) return aPos.top - bPos.top
      if (a.pageIndex !== b.pageIndex) return a.pageIndex - b.pageIndex
      return a.createdAt - b.createdAt
    })
  }, [threadPositions, threads])

  const recalculateThreadPositions = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const viewportRect = viewport.getBoundingClientRect()
    const raw: Array<{ id: string; top: number; visible: boolean; height: number }> = []

    for (const thread of threads) {
      const pageEl = pageRefs.current[thread.pageIndex]
      if (!pageEl) {
        raw.push({ id: thread.id, top: 0, visible: false, height: 0 })
        continue
      }

      const pageRect = pageEl.getBoundingClientRect()
      const visible = pageRect.bottom > viewportRect.top && pageRect.top < viewportRect.bottom
      const metric = annotationMetricsRef.current[thread.annotationId]
      const yOffset =
        metric && metric.pageIndex === thread.pageIndex
          ? metric.yOffsetPx
          : pageRect.height * thread.anchorRatio

      const isExpanded = activeThreadId === thread.id
      const estimatedHeight =
        threadCardRefs.current[thread.id]?.offsetHeight ?? (isExpanded ? 420 : 170)

      raw.push({
        id: thread.id,
        top: pageRect.top - viewportRect.top + yOffset - estimatedHeight / 2,
        visible,
        height: estimatedHeight,
      })
    }

    const visibleItems = raw.filter((item) => item.visible).sort((a, b) => a.top - b.top)
    const minGap = 14
    if (pendingDraft) {
      const pageEl = pageRefs.current[pendingDraft.pageIndex]
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect()
        const draftVisible = pageRect.bottom > viewportRect.top && pageRect.top < viewportRect.bottom
        const draftTop = pageRect.top - viewportRect.top + pageRect.height * pendingDraft.anchorRatio
        if (draftVisible) {
          const pendingHeight = pendingDraftCardRef.current?.offsetHeight ?? 300
          visibleItems.push({
            id: '__pending__',
            top: draftTop - pendingHeight / 2,
            visible: true,
            height: pendingHeight,
          })
          visibleItems.sort((a, b) => a.top - b.top)
        }
      }
    }

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

    const draftPos = (() => {
      const pendingItem = visibleItems.find((item) => item.id === '__pending__')
      if (!pendingItem || !pendingDraft) return null
      return {
        visible: true,
        top: clamp(pendingItem.top, 24, Math.max(viewportRect.height - pendingItem.height - 24, 24)),
        height: pendingItem.height,
      }
    })()

    const hasPositionsChanged =
      Object.keys(threadPositions).length !== Object.keys(next).length ||
      Object.entries(next).some(([id, value]) => {
        const prev = threadPositions[id]
        return !prev || prev.visible !== value.visible || Math.abs(prev.top - value.top) > 0.5
      })

    if (hasPositionsChanged) {
      setThreadPositions(next)
    }

    const draftChanged =
      (pendingDraftPosition === null) !== (draftPos === null) ||
      (pendingDraftPosition && draftPos
        ? pendingDraftPosition.visible !== draftPos.visible ||
          Math.abs(pendingDraftPosition.top - draftPos.top) > 0.5 ||
          pendingDraftPosition.height !== draftPos.height
        : false)

    if (draftChanged) {
      setPendingDraftPosition(draftPos)
    }
  }, [activeThreadId, pendingDraft, pendingDraftPosition, threadPositions, threads])

  useEffect(() => {
    recalculateThreadPositions()
  }, [threads, pendingDraft, recalculateThreadPositions])

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      recalculateThreadPositions()
    })

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [activeThreadId, pendingCommentText, recalculateThreadPositions, threads.length])

  const discardPendingDraft = useCallback(
    ({ onlyWhenEmpty }: { onlyWhenEmpty?: boolean } = {}) => {
      if (!pendingDraft) return
      if (onlyWhenEmpty && pendingCommentText.trim()) return

      annotationApi?.deleteAnnotation(pendingDraft.pageIndex, pendingDraft.annotationId)
      delete annotationMetricsRef.current[pendingDraft.annotationId]
      setPendingCommentText('')
      setPendingDraft(null)
    },
    [annotationApi, pendingCommentText, pendingDraft],
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onScroll = () => {
      recalculateThreadPositions()
      discardPendingDraft({ onlyWhenEmpty: true })
    }
    viewport.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)

    return () => {
      viewport.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [discardPendingDraft, recalculateThreadPositions])

  const submitPendingComment = useCallback(() => {
    if (!pendingDraft) return
    const text = pendingCommentText.trim()
    if (!text || !currentAuthorName.trim()) return

    const now = Date.now()
    const thread: CommentThread = {
      id: createThreadId(),
      annotationId: pendingDraft.annotationId,
      documentId,
      pageIndex: pendingDraft.pageIndex,
      quote: pendingDraft.quote,
      anchorRatio: pendingDraft.anchorRatio,
      createdAt: now,
      messages: [
        {
          id: createThreadId(),
          parentId: null,
          authorName: currentAuthorName.trim(),
          authorId: userId,
          text,
          createdAt: now,
        },
      ],
    }

    createThread(thread)
    setPendingReplyByThread((prev) => ({ ...prev, [thread.id]: '' }))
    setActiveThreadId(thread.id)
    setPendingCommentText('')
    setPendingDraft(null)
  }, [currentAuthorName, pendingCommentText, pendingDraft, documentId, userId, createThread])

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

      addReply(threadId, reply)
      setPendingReplyByThread((prev) => ({ ...prev, [threadId]: '' }))
      setActiveThreadId(threadId)
    },
    [currentAuthorName, pendingReplyByThread, userId, addReply],
  )

  const onFocusThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId)
      const thread = threads.find((item) => item.id === threadId)
      if (!thread) return

      const pageEl = pageRefs.current[thread.pageIndex]
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })

      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current)
      }
      setFocusedAnnotationId(thread.annotationId)
      focusTimeoutRef.current = window.setTimeout(() => {
        setFocusedAnnotationId(null)
      }, 1200)

      const selected = state.selectedUids.length === 1 ? state.byUid[state.selectedUids[0]] : null
      if (selected?.object.id === thread.annotationId) return

      if (!annotationApi) return
      annotationApi.selectAnnotation(thread.pageIndex, thread.annotationId)
    },
    [annotationApi, state.byUid, state.selectedUids, threads],
  )

  useEffect(() => {
    return () => {
      if (focusTimeoutRef.current !== null) {
        window.clearTimeout(focusTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          duration={4000}
          onClose={() => setToastMessage(null)}
        />
      )}
      <ImportExportToolbar
        documentId={documentId}
        threads={threads}
        textSelectionEnabled={textSelectionEnabled}
        setTextSelectionEnabled={setTextSelectionEnabled}
        annotationEditingEnabled={annotationEditingEnabled}
        setAnnotationEditingEnabled={setAnnotationEditingEnabled}
        originalPdfName={pdfName}
        setPersistencePaused={setPersistencePaused}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: '1px solid #d1fae5',
          background: '#f0fdf4',
          padding: '8px 12px',
        }}
      >
        <label style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>Reviewer</label>
        <input
          value={currentAuthorName}
          onChange={(event) => setCurrentAuthorName(event.target.value)}
          style={{
            borderRadius: 6,
            border: '1px solid #86efac',
            padding: '5px 8px',
            fontSize: 12,
            color: '#0f172a',
            background: '#ffffff',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            fontWeight: 600,
            color: isConnected ? '#15803d' : '#b91c1c',
          }}
        >
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
        <UserPresence users={users} currentUserId={userId} />
        {collabError && (
          <span style={{ fontSize: 12, color: '#b91c1c' }}>{collabError}</span>
        )}
      </div>
          <div style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden'
          }}>
        <div
          ref={viewportRef}
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Viewport
            documentId={documentId}
            className="absolute inset-0 bg-gray-200 dark:bg-gray-800"
          >
          <Scroller
            documentId={documentId}
            renderPage={({ pageIndex }) => (
              <div
                ref={(el) => {
                    console.log('pageIndex', pageIndex, el);
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
                    selectionOutline={{ color: '#475569', style: 'dashed', width: 1, offset: 2 }}
                    groupSelectionOutline={{ color: '#64748b', style: 'dashed', width: 2, offset: 3 }}
                    rotationUI={{  color: '#475569', size: 0 }} 
                    customAnnotationRenderer={({ annotation, isSelected, children, onSelect, scale }) => {
                      const thread = threads.find((item) => item.annotationId === annotation.id)
                      const isFocusedFromThread = focusedAnnotationId === annotation.id
                      const lock = lockedAnnotations[annotation.id]
                      const isLockedByOther = lock && lock.userId !== userId
                      const isLockedByMe = lock && lock.userId === userId

                      if (thread) {
                        annotationMetricsRef.current[annotation.id] = {
                          pageIndex: annotation.pageIndex,
                          yOffsetPx: (annotation.rect.origin.y + annotation.rect.size.height / 2) * scale,
                        }
                      }
// isLockedByOther
//                                   ? '2px dashed #f59e0b'
//                                   : isLockedByMe
//                                     ? '2px solid #3b82f6'
//                                     : 'none',
                      return (
                        <div
                          onClick={(event) => {
                            onSelect?.(event as any)
                            if (thread) {
                              setActiveThreadId(thread.id)
                            }
                          }}
                          data-id={'Rohit'}
                          style={{
                            position: 'relative',
                            outline:
                              thread && (isSelected || isFocusedFromThread)
                                ? '3px solid #059669'
                                : 'none',
                            outlineOffset: 1,
                            boxShadow:
                              isFocusedFromThread
                                ? '0 0 0 5px rgba(16, 185, 129, 0.35)'
                                : isLockedByOther
                                  ? '0 0 0 4px rgba(245, 158, 11, 0.2)'
                                  // : isLockedByMe
                                  //   ? '0 0 0 4px rgba(59, 130, 246, 0.2)'
                                    : 'none',
                            opacity: isLockedByOther ? 0.6 : 1,
                            transition: 'box-shadow 180ms ease, opacity 180ms ease, outline 180ms ease',
                          }}
                        >
                          {children}
                          {thread && (
                            <div
                              title={`Commented highlight (${thread.messages.length})`}
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
                          {lock && (
                            <div
                              title={`Locked by ${lock.userName}`}
                              style={{
                                position: 'absolute',
                                top: isLockedByOther ? -10 : -8,
                                left: isLockedByOther ? -10 : -8,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: `2px solid ${isLockedByOther ? '' : '#3b82f6'}`,
                                background: isLockedByOther ? '#fef3c7' : '#dbeafe',
                                fontSize: 10,
                                fontWeight: 700,
                                color: isLockedByOther ? '#92400e' : '#1e40af',
                                lineHeight: 1,
                                pointerEvents: 'none',
                              }}
                            >
                              {lock.userName[0]?.toUpperCase() || '?'}
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
         <ThreadSidebar
          threads={orderedThreads}
          positions={threadPositions}
          activeThreadId={activeThreadId}
          currentAuthorName={currentAuthorName}
          pendingDraft={pendingDraft}
          pendingDraftPosition={pendingDraftPosition}
          pendingCommentText={pendingCommentText}
          pendingReplyByThread={pendingReplyByThread}
          onFocusThread={onFocusThread}
          onPendingCommentTextChange={setPendingCommentText}
          onSubmitPendingComment={submitPendingComment}
          onCancelPendingComment={() => discardPendingDraft()}
          onReplyDraftChange={(threadId, value) =>
            setPendingReplyByThread((prev) => ({ ...prev, [threadId]: value }))
          }
          onSubmitReply={submitReply}
          onThreadCardRef={(threadId, el) => {
            threadCardRefs.current[threadId] = el
          }}
          onPendingDraftRef={(el) => {
            pendingDraftCardRef.current = el
          }}
        />
          </div>
    </div>
  )
}

export const CustomViewerTwo = () => {
  const { engine, isLoading } = usePdfiumEngine()
  const [textSelectionEnabled, setTextSelectionEnabled] = useState(true)
  const [annotationEditingEnabled, setAnnotationEditingEnabled] = useState(true)
  const [persistencePaused, setPersistencePaused] = useState(false)
  const [userId] = useState(() => {
    const stored = localStorage.getItem(COLLAB_USER_ID_STORAGE_KEY)
    if (stored) return stored
    const id = createThreadId()
    localStorage.setItem(COLLAB_USER_ID_STORAGE_KEY, id)
    return id
  })
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem(COMMENT_AUTHOR_STORAGE_KEY) || 'Collaborator'
  })
  const [selectedPdfId, setSelectedPdfId] = useState(INITIAL_PDF.documentId)
  const loadedDocsRef = useRef<Record<string, boolean>>({})

  const selectedPdf = useMemo(() => {
    return ALL_PDFS.find((pdf) => pdf.documentId === selectedPdfId) || INITIAL_PDF
  }, [selectedPdfId])

  const plugins = useMemo(() => createPlugins({ ...selectedPdf }), [selectedPdf])

  useEffect(() => {
    localStorage.setItem(COMMENT_AUTHOR_STORAGE_KEY, userName)
  }, [userName])

  useEffect(() => {
    localStorage.setItem(ACTIVE_PDF_ID_STORAGE_KEY, selectedPdfId)
  }, [selectedPdfId])

  const switchToPublicPdf = useCallback((documentId: string) => {
    const next = ALL_PDFS.find((item) => item.documentId === documentId)
    if (!next) return
    setSelectedPdfId(next.documentId)
  }, [])

  const closeSelectedPdf = useCallback(() => {
    setSelectedPdfId(INITIAL_PDF.documentId)
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
    <EmbedPDF
      engine={engine}
      plugins={plugins}
      key={selectedPdfId}
    >
      <DocumentContent documentId={selectedPdfId}>
        {({ isLoaded }) =>
          (() => {
            if (isLoaded) {
              loadedDocsRef.current[selectedPdfId] = true
            }

            const canRenderWorkspace =
              isLoaded || !!loadedDocsRef.current[selectedPdfId]

            return canRenderWorkspace ? (
            <div
              className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
              style={{ userSelect: 'none' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '10px 12px',
                  borderBottom: '1px solid #d1d5db',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>PDF</span>
                  <span style={{ fontSize: 12, color: '#475569' }}>{selectedPdf.name}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={selectedPdfId}
                    onChange={(event) => {
                      const nextId = event.target.value
                      if (nextId === INITIAL_PDF.documentId) {
                        closeSelectedPdf()
                        return
                      }
                      switchToPublicPdf(nextId)
                    }}
                    style={{
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      padding: '6px 8px',
                      fontSize: 12,
                    }}
                    title="Change PDF"
                  >
                    <option value={INITIAL_PDF.documentId}>Default PDF (ebook.pdf)</option>
                    {PUBLIC_PDFS.map((pdf) => (
                      <option key={pdf.documentId} value={pdf.documentId}>
                        {pdf.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={closeSelectedPdf}
                    disabled={selectedPdfId === INITIAL_PDF.documentId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      color: '#475569',
                      padding: '6px 10px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: selectedPdfId === INITIAL_PDF.documentId ? 'not-allowed' : 'pointer',
                      opacity: selectedPdfId === INITIAL_PDF.documentId ? 0.5 : 1,
                    }}
                    title="Delete current PDF view and reconnect to default PDF"
                  >
                    Delete PDF
                  </button>
                </div>
              </div>

              <AnnotatedDocumentWorkspace
                documentId={selectedPdfId}
                pdfName={selectedPdf.name}
                userId={userId}
                userName={userName}
                onUserNameChange={setUserName}
                textSelectionEnabled={textSelectionEnabled}
                annotationEditingEnabled={annotationEditingEnabled}
                persistencePaused={persistencePaused}
                setTextSelectionEnabled={setTextSelectionEnabled}
                setAnnotationEditingEnabled={setAnnotationEditingEnabled}
                setPersistencePaused={setPersistencePaused}
              />
            </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                {/* Header skeleton */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <div className="pdf-skeleton-bone" style={{ height: 14, width: 120 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div className="pdf-skeleton-bone" style={{ height: 28, width: 160 }} />
                    <div className="pdf-skeleton-bone" style={{ height: 28, width: 80 }} />
                  </div>
                </div>
                {/* Toolbar skeleton */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f3f4f6', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[90, 110, 70, 120, 130].map((w, i) => (
                      <div key={i} className="pdf-skeleton-bone" style={{ height: 26, width: w }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[60, 60, 60, 60, 60, 60].map((w, i) => (
                      <div key={i} className="pdf-skeleton-bone" style={{ height: 26, width: w }} />
                    ))}
                  </div>
                </div>
                <PdfSkeletonLoader />
              </div>
            )
          })()
        }
      </DocumentContent>
    </EmbedPDF>
  )
}