/**
 * Hook for managing annotation metadata (comments, styling) layered on top of
 * EmbedPDF's useAnnotation. This keeps app-specific fields separate from the
 * plugin's core annotation state.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  AnnotationMeta,
  AnnotationMetaMap,
  Comment,
  CommentThread,
  LineStyle,
  PersistedCommentThread,
  PersistedAnnotationMeta,
} from '../types'
import { DEFAULT_COLOR, DEFAULT_LINE_STYLE } from '../types'

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

export interface UseAnnotationMetaOptions {
  documentId: string
  storageKeyPrefix?: string
}

export interface UseAnnotationMetaReturn {
  /** Map of annotation IDs to their app-level metadata */
  annotationMeta: AnnotationMetaMap
  /** All comment threads */
  threads: CommentThread[]
  /** Update color for an annotation */
  updateAnnotationColor: (annotationId: string, color: string) => void
  /** Update opacity for an annotation */
  updateAnnotationOpacity: (annotationId: string, opacity: number) => void
  /** Update line style for an annotation */
  updateAnnotationLineStyle: (annotationId: string, lineStyle: LineStyle) => void
  /** Update line width for an annotation */
  updateAnnotationLineWidth: (annotationId: string, width: number) => void
  /** Update sticky-note text for an annotation */
  updateAnnotationNoteText: (annotationId: string, noteText: string) => void
  /** Get metadata for a specific annotation */
  getAnnotationMeta: (annotationId: string) => AnnotationMeta | undefined
  /** Initialize metadata for a new annotation */
  initAnnotationMeta: (annotationId: string, options?: Partial<AnnotationMeta>) => void
  /** Remove metadata for an annotation */
  removeAnnotationMeta: (annotationId: string) => void
  /** Add a comment thread for an annotation */
  addThread: (annotationId: string, quote: string, pageIndex: number, anchorRatio: number) => CommentThread
  /** Add a reply to a thread */
  addReply: (threadId: string, text: string, authorName: string) => Comment | null
  /** Delete a comment (soft delete if has replies) */
  deleteComment: (threadId: string, commentId: string, currentAuthor: string) => void
  /** Delete a thread entirely */
  deleteThread: (threadId: string) => void
  /** Get thread for an annotation */
  getThreadForAnnotation: (annotationId: string) => CommentThread | undefined
}

const STORAGE_KEY_PREFIX = 'embedpdf_peer_review_'

export function useAnnotationMeta({
  documentId,
  storageKeyPrefix = STORAGE_KEY_PREFIX,
}: UseAnnotationMetaOptions): UseAnnotationMetaReturn {
  const metaStorageKey = useMemo(
    () => `${storageKeyPrefix}meta_${documentId}`,
    [documentId, storageKeyPrefix]
  )
  const threadsStorageKey = useMemo(
    () => `${storageKeyPrefix}threads_${documentId}`,
    [documentId, storageKeyPrefix]
  )

  const [annotationMeta, setAnnotationMeta] = useState<AnnotationMetaMap>(() => {
    try {
      const stored = localStorage.getItem(metaStorageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, PersistedAnnotationMeta>
        const result: AnnotationMetaMap = {}
        for (const [id, meta] of Object.entries(parsed)) {
          result[id] = {
            id,
            color: meta.color ?? DEFAULT_COLOR.hex,
            opacity: typeof meta.opacity === 'number' ? clamp(meta.opacity, 0, 1) : 1,
            lineStyle: meta.lineStyle ?? DEFAULT_LINE_STYLE.id,
            lineWidth: meta.lineWidth ?? 2,
            noteText: meta.noteText ?? '',
          }
        }
        return result
      }
    } catch (error) {
      console.error('Failed to parse annotation meta from storage:', error)
    }
    return {}
  })

  const [threads, setThreads] = useState<CommentThread[]>(() => {
    try {
      const stored = localStorage.getItem(threadsStorageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as PersistedCommentThread[]
        return parsed.map((t) => ({
          ...t,
          messages: t.messages.map((m) => ({
            ...m,
            parentId: m.parentId ?? null,
          })),
        }))
      }
    } catch (error) {
      console.error('Failed to parse threads from storage:', error)
    }
    return []
  })

  // Persist annotation meta changes
  useEffect(() => {
    const toStore: Record<string, PersistedAnnotationMeta> = {}
    for (const [id, meta] of Object.entries(annotationMeta)) {
      toStore[id] = {
        color: meta.color,
        opacity: meta.opacity,
        lineStyle: meta.lineStyle,
        lineWidth: meta.lineWidth,
        noteText: meta.noteText,
      }
    }
    localStorage.setItem(metaStorageKey, JSON.stringify(toStore))
  }, [annotationMeta, metaStorageKey])

  // Persist threads changes
  useEffect(() => {
    localStorage.setItem(threadsStorageKey, JSON.stringify(threads))
  }, [threads, threadsStorageKey])

  const updateAnnotationColor = useCallback((annotationId: string, color: string): void => {
    setAnnotationMeta((prev) => ({
      ...prev,
      [annotationId]: {
        ...prev[annotationId],
        id: annotationId,
        color,
        opacity: prev[annotationId]?.opacity ?? 1,
        lineStyle: prev[annotationId]?.lineStyle ?? DEFAULT_LINE_STYLE.id,
        lineWidth: prev[annotationId]?.lineWidth ?? 2,
      },
    }))
  }, [])

  const updateAnnotationOpacity = useCallback((annotationId: string, opacity: number): void => {
    const clampedOpacity = clamp(opacity, 0, 1)
    setAnnotationMeta((prev) => ({
      ...prev,
      [annotationId]: {
        ...prev[annotationId],
        id: annotationId,
        color: prev[annotationId]?.color ?? DEFAULT_COLOR.hex,
        opacity: clampedOpacity,
        lineStyle: prev[annotationId]?.lineStyle ?? DEFAULT_LINE_STYLE.id,
        lineWidth: prev[annotationId]?.lineWidth ?? 2,
      },
    }))
  }, [])

  const updateAnnotationLineStyle = useCallback((annotationId: string, lineStyle: LineStyle): void => {
    setAnnotationMeta((prev) => ({
      ...prev,
      [annotationId]: {
        ...prev[annotationId],
        id: annotationId,
        color: prev[annotationId]?.color ?? DEFAULT_COLOR.hex,
        opacity: prev[annotationId]?.opacity ?? 1,
        lineStyle,
        lineWidth: prev[annotationId]?.lineWidth ?? 2,
      },
    }))
  }, [])

  const updateAnnotationLineWidth = useCallback((annotationId: string, width: number): void => {
    const clampedWidth = clamp(width, 1, 20)
    setAnnotationMeta((prev) => ({
      ...prev,
      [annotationId]: {
        ...prev[annotationId],
        id: annotationId,
        color: prev[annotationId]?.color ?? DEFAULT_COLOR.hex,
        opacity: prev[annotationId]?.opacity ?? 1,
        lineStyle: prev[annotationId]?.lineStyle ?? DEFAULT_LINE_STYLE.id,
        lineWidth: clampedWidth,
      },
    }))
  }, [])

  const getAnnotationMeta = useCallback((annotationId: string): AnnotationMeta | undefined => {
    return annotationMeta[annotationId]
  }, [annotationMeta])

  const initAnnotationMeta = useCallback((annotationId: string, options?: Partial<AnnotationMeta>): void => {
    setAnnotationMeta((prev) => {
      if (prev[annotationId]) return prev
      return {
        ...prev,
        [annotationId]: {
          id: annotationId,
          color: options?.color ?? DEFAULT_COLOR.hex,
          opacity: options?.opacity ?? 1,
          lineStyle: options?.lineStyle ?? DEFAULT_LINE_STYLE.id,
          lineWidth: options?.lineWidth ?? 2,
          noteText: options?.noteText ?? '',
        },
      }
    })
  }, [])

  const updateAnnotationNoteText = useCallback((annotationId: string, noteText: string): void => {
    setAnnotationMeta((prev) => ({
      ...prev,
      [annotationId]: {
        ...prev[annotationId],
        id: annotationId,
        color: prev[annotationId]?.color ?? DEFAULT_COLOR.hex,
        opacity: prev[annotationId]?.opacity ?? 1,
        lineStyle: prev[annotationId]?.lineStyle ?? DEFAULT_LINE_STYLE.id,
        lineWidth: prev[annotationId]?.lineWidth ?? 2,
        noteText,
      },
    }))
  }, [])

  const removeAnnotationMeta = useCallback((annotationId: string): void => {
    setAnnotationMeta((prev) => {
      const next = { ...prev }
      delete next[annotationId]
      return next
    })
    // Also remove associated thread
    setThreads((prev) => prev.filter((t) => t.annotationId !== annotationId))
  }, [])

  const addThread = useCallback(
    (annotationId: string, quote: string, pageIndex: number, anchorRatio: number): CommentThread => {
      const now = Date.now()
      const thread: CommentThread = {
        id: generateId(),
        annotationId,
        pageIndex,
        quote,
        anchorRatio: clamp(anchorRatio, 0.04, 0.96),
        createdAt: now,
        messages: [],
      }
      setThreads((prev) => [...prev, thread])
      setAnnotationMeta((prev) => ({
        ...prev,
        [annotationId]: {
          ...prev[annotationId],
          id: annotationId,
          color: prev[annotationId]?.color ?? DEFAULT_COLOR.hex,
          opacity: prev[annotationId]?.opacity ?? 1,
          lineStyle: prev[annotationId]?.lineStyle ?? DEFAULT_LINE_STYLE.id,
          lineWidth: prev[annotationId]?.lineWidth ?? 2,
          thread,
        },
      }))
      return thread
    },
    []
  )

  const addReply = useCallback((threadId: string, text: string, authorName: string): Comment | null => {
    if (!text.trim() || !authorName.trim()) return null

    const comment: Comment = {
      id: generateId(),
      parentId: null,
      authorName: authorName.trim(),
      text: text.trim(),
      createdAt: Date.now(),
    }

    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, messages: [...thread.messages, comment] }
          : thread
      )
    )

    return comment
  }, [])

  const deleteComment = useCallback((threadId: string, commentId: string, currentAuthor: string): void => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread

        const commentIndex = thread.messages.findIndex(
          (m) => m.id === commentId && m.authorName === currentAuthor
        )
        if (commentIndex === -1) return thread

        const hasReplies = thread.messages.some((m) => m.parentId === commentId)

        if (hasReplies) {
          // Soft delete - replace with placeholder
          return {
            ...thread,
            messages: thread.messages.map((m) =>
              m.id === commentId
                ? { ...m, isDeleted: true, text: '[comment deleted]' }
                : m
            ),
          }
        } else {
          // Hard delete
          return {
            ...thread,
            messages: thread.messages.filter((m) => m.id !== commentId),
          }
        }
      })
    )
  }, [])

  const deleteThread = useCallback((threadId: string): void => {
    setThreads((prev) => {
      const thread = prev.find((t) => t.id === threadId)
      if (thread) {
        // Also clean up annotation meta reference
        setAnnotationMeta((metaPrev) => {
          const next = { ...metaPrev }
          if (next[thread.annotationId]) {
            const { thread: _, ...rest } = next[thread.annotationId]
            next[thread.annotationId] = rest as AnnotationMeta
          }
          return next
        })
      }
      return prev.filter((t) => t.id !== threadId)
    })
  }, [])

  const getThreadForAnnotation = useCallback(
    (annotationId: string): CommentThread | undefined => {
      return threads.find((t) => t.annotationId === annotationId)
    },
    [threads]
  )

  return {
    annotationMeta,
    threads,
    updateAnnotationColor,
    updateAnnotationOpacity,
    updateAnnotationLineStyle,
    updateAnnotationLineWidth,
    updateAnnotationNoteText,
    getAnnotationMeta,
    initAnnotationMeta,
    removeAnnotationMeta,
    addThread,
    addReply,
    deleteComment,
    deleteThread,
    getThreadForAnnotation,
  }
}
