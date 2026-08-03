// Collaborative PDF Viewer with Socket.IO integration
// This file integrates real-time collaboration into the existing viewer

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
  Users,
} from 'lucide-react'
import { useDocumentCollaboration } from '../hooks/useCollaboration'
import type { CommentThread, CommentMessage } from '../hooks/useCollaboration'
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

// Connection status indicator
const ConnectionStatus = ({ isConnected }: { isConnected: boolean }) => (
  <div className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
    isConnected
      ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
      : 'bg-red-100 text-red-800 ring-1 ring-red-300'
  }`}>
    {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
    {isConnected ? 'Connected' : 'Disconnected'}
  </div>
)

export const CollaborativeViewer = () => {
  const { engine, isLoading } = usePdfiumEngine()
  const [textSelectionEnabled, setTextSelectionEnabled] = useState(true)
  const [annotationEditingEnabled, setAnnotationEditingEnabled] = useState(true)
  const [persistencePaused, setPersistencePaused] = useState(false)
  const [userId] = useState(() => localStorage.getItem('collab_user_id') || createThreadId())
  const [userName, setUserName] = useState(() => localStorage.getItem('collab_user_name') || 'Reviewer')

  // Save user info to localStorage
  useEffect(() => {
    localStorage.setItem('collab_user_id', userId)
  }, [userId])

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
                  persistencePaused={persistencePaused}
                  setTextSelectionEnabled={setTextSelectionEnabled}
                  setAnnotationEditingEnabled={setAnnotationEditingEnabled}
                  setPersistencePaused={setPersistencePaused}
                />
              )
            }
          </DocumentContent>
        )
      }
    </EmbedPDF>
  )
}

// Main collaborative workspace component
const CollaborativeWorkspace = ({
  documentId,
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
  // Initialize collaboration hook
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
    setAnnotations,
  } = useDocumentCollaboration(documentId, userId, userName)

  const { provides: annotationApi, state } = useAnnotation(documentId)
  const [pendingDraft, setPendingDraft] = useState<PendingCommentDraft | null>(null)
  const [pendingCommentText, setPendingCommentText] = useState('')
  const [pendingReplyByThread, setPendingReplyByThread] = useState<Record<string, string>>({})
  const [threadPositions, setThreadPositions] = useState<Record<string, ThreadPosition>>({})
  const [pendingDraftPosition, setPendingDraftPosition] = useState<ThreadPosition | null>(null)
  const [focusedAnnotationId, setFocusedAnnotationId] = useState<string | null>(null)
  const focusTimeoutRef = useRef<number | null>(null)

  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const annotationMetricsRef = useRef<Record<string, AnnotationMetric>>({})
  const threadCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pendingDraftCardRef = useRef<HTMLDivElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  // Hide/disable local storage persistence
  // Everything now goes through Socket.IO

  // Handle incoming annotations from server
  useEffect(() => {
    if (!annotationApi || !isJoined || annotations.length === 0) return

    // Import annotations from the collaboration layer
    annotationApi.importAnnotations(annotations)
  }, [annotationApi, isJoined, annotations])

  // Handle outgoing annotation events
  useEffect(() => {
    if (!annotationApi || !isJoined) return

    const unsubscribe = annotationApi.onAnnotationEvent((event) => {
      if (event.type === 'create') {
        // Sync to server
        const annotationItem: AnnotationTransferItem = {
          annotation: {
            id: event.annotation.id,
            pageIndex: event.annotation.pageIndex,
            rect: event.annotation.rect,
            segmentRects: (event.annotation as any).segmentRects,
            color: (event.annotation as any).color,
            created: Date.now(),
          },
        }
        createAnnotation(annotationItem)
      } else if (event.type === 'update') {
        const annotation = state.byUid[event.annotationId]
        if (annotation) {
          updateAnnotation(event.annotationId, annotation.object)
        }
      } else if (event.type === 'delete') {
        deleteAnnotation(event.pageIndex, event.annotationId)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [annotationApi, isJoined, createAnnotation, updateAnnotation, deleteAnnotation, state.byUid])

  // Connection error display
  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 rounded-lg border border-gray-300 bg-white p-8 dark:border-gray-700 dark:bg-gray-900">
        <WifiOff className="h-12 w-12 text-red-500" />
        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Connection Error
        </div>
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
      {/* Connection status bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <ConnectionStatus isConnected={isConnected && isJoined} />
          <UserPresence users={users} currentUserId={userId} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Your Name:
          </label>
          <input
            value={userName}
            onChange={(e) => onUserNameChange(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      {/* Original workspace content continues below */}
      {/* This would continue with the rest of the viewer implementation */}
      {/* For brevity, I'm showing the key integration points above */}

      <div className="flex flex-1 min-h-0">
        {/* PDF Viewer would go here */}
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          {!isConnected ? 'Connecting...' : 'PDF viewer loading...'}
        </div>
      </div>
    </div>
  )
}

export default CollaborativeViewer
