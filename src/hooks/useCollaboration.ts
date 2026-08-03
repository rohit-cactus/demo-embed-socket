// React hooks for Socket.IO integration
import { useEffect, useRef, useCallback, useState } from 'react'
import { io, Socket } from 'socket.io-client'

// Types matching server types
export interface CommentMessage {
  id: string
  parentId: string | null
  authorName: string
  authorId: string
  text: string
  createdAt: number
}

export interface CommentThread {
  id: string
  annotationId: string
  documentId: string
  pageIndex: number
  quote: string
  anchorRatio: number
  createdAt: number
  messages: CommentMessage[]
}

export interface User {
  id: string
  name: string
  color: string
  cursor?: {
    pageIndex: number
    x: number
    y: number
  }
  lastSeen: number
}

export interface AnnotationTransferItem {
  annotation: {
    id: string
    documentId?: string
    pageIndex: number
    rect: {
      origin: { x: number; y: number }
      size: { width: number; height: number }
    }
    segmentRects?: any[]
    color?: string
    author?: string
    created: number
    modified?: number
    contents?: string
    subject?: string
    custom?: {
      text?: string
      thread?: {
        id: string
        quote: string
        messages: CommentMessage[]
        createdAt: number
      }
    }
    [key: string]: any
  }
}

// Socket server URL (default to localhost)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

export function useSocketConnection(userId: string, userName: string) {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Create socket connection
    const socket = io(SOCKET_URL, {
      query: { userId, userName },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [userId, userName])

  return { socket: socketRef.current, isConnected }
}

export function useDocumentCollaboration(
  documentId: string | null,
  userId: string,
  userName: string
) {
  const socketRef = useRef<Socket | null>(null)
  const joinedDocumentRef = useRef<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [annotations, setAnnotations] = useState<AnnotationTransferItem[]>([])
  const [threads, setThreads] = useState<CommentThread[]>([])
  const [users, setUsers] = useState<User[]>([])

  // Initialize socket connection
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      query: { userId, userName },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setIsConnected(true)
      setError(null)
    })

    socket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
      setIsJoined(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err)
      setError('Failed to connect to collaboration server')
      setIsConnected(false)
    })

    return () => {
      if (documentId) {
        socket.emit('leaveDocument', { documentId, userId })
      }
      socket.disconnect()
    }
  }, [userId, userName])

  // Join/leave document room
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !documentId || !isConnected) return

    // Reset room-scoped state only when switching to a different document.
    if (joinedDocumentRef.current !== documentId) {
      setIsJoined(false)
      setAnnotations([])
      setThreads([])
      setUsers([])
    }

    console.log('Joining document:', documentId)
    socket.emit('joinDocument', { documentId, userId, userName })

    socket.on('documentState', (data: {
      annotations: AnnotationTransferItem[]
      threads: CommentThread[]
      users: User[]
    }) => {
      console.log('Received document state:', data)
      joinedDocumentRef.current = documentId
      setAnnotations(data.annotations)
      setThreads(data.threads)
      setUsers(data.users)
      setIsJoined(true)
    })

    socket.on('error', (message: string) => {
      setError(message)
    })

    return () => {
      socket.emit('leaveDocument', { documentId, userId })
      socket.off('documentState')
      socket.off('error')
    }
  }, [documentId, userId, userName, isConnected])

  // Listen for annotation events
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !documentId) return

    socket.on('annotationCreated', (data: { annotation: AnnotationTransferItem; userId: string }) => {
      if (data.userId !== userId) {
        setAnnotations(prev => {
          // Avoid duplicates
          const exists = prev.some(a => a.annotation.id === data.annotation.annotation.id)
          if (exists) return prev
          return [...prev, data.annotation]
        })
      }
    })

    socket.on('annotationUpdated', (data: { annotationId: string; updates: any; userId: string }) => {
      setAnnotations(prev => prev.map(item => {
        if (item.annotation.id === data.annotationId) {
          return {
            annotation: { ...item.annotation, ...data.updates }
          }
        }
        return item
      }))
    })

    socket.on('annotationDeleted', (data: { pageIndex: number; annotationId: string; userId: string }) => {
      setAnnotations(prev => prev.filter(item => item.annotation.id !== data.annotationId))
    })

    return () => {
      socket.off('annotationCreated')
      socket.off('annotationUpdated')
      socket.off('annotationDeleted')
    }
  }, [documentId, userId])

  // Listen for thread events
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !documentId) return

    socket.on('threadCreated', (data: { thread: CommentThread; userId: string }) => {
      if (data.userId !== userId) {
        setThreads(prev => {
          const exists = prev.some(t => t.id === data.thread.id)
          if (exists) return prev
          return [...prev, data.thread]
        })
      }
    })

    socket.on('replyAdded', (data: { threadId: string; message: CommentMessage; userId: string }) => {
      setThreads(prev => prev.map(thread => {
        if (thread.id === data.threadId) {
          const exists = thread.messages.some(m => m.id === data.message.id)
          if (exists) return thread
          return { ...thread, messages: [...thread.messages, data.message] }
        }
        return thread
      }))
    })

    return () => {
      socket.off('threadCreated')
      socket.off('replyAdded')
    }
  }, [documentId, userId])

  // Listen for user presence events
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !documentId) return

    socket.on('userJoined', (data: { user: User }) => {
      setUsers(prev => {
        const exists = prev.some(u => u.id === data.user.id)
        if (exists) return prev.map(u => u.id === data.user.id ? data.user : u)
        return [...prev, data.user]
      })
    })

    socket.on('userLeft', (data: { userId: string }) => {
      setUsers(prev => prev.filter(u => u.id !== data.userId))
    })

    socket.on('cursorUpdated', (data: { userId: string; cursor: User['cursor'] }) => {
      setUsers(prev => prev.map(u => {
        if (u.id === data.userId) {
          return { ...u, cursor: data.cursor, lastSeen: Date.now() }
        }
        return u
      }))
    })

    return () => {
      socket.off('userJoined')
      socket.off('userLeft')
      socket.off('cursorUpdated')
    }
  }, [documentId])

  // Actions
  const createAnnotation = useCallback((annotation: AnnotationTransferItem) => {
    if (!socketRef.current || !documentId) return
    socketRef.current.emit('createAnnotation', { documentId, annotation })
    setAnnotations(prev => {
      const exists = prev.some(a => a.annotation.id === annotation.annotation.id)
      if (exists) return prev
      return [...prev, annotation]
    })
  }, [documentId])

  const updateAnnotation = useCallback((annotationId: string, updates: any) => {
    if (!socketRef.current || !documentId) return
    socketRef.current.emit('updateAnnotation', { documentId, annotationId, updates })
    setAnnotations(prev => prev.map(item => {
      if (item.annotation.id === annotationId) {
        return { annotation: { ...item.annotation, ...updates } }
      }
      return item
    }))
  }, [documentId])

  const deleteAnnotation = useCallback((pageIndex: number, annotationId: string) => {
    if (!socketRef.current || !documentId) return
    socketRef.current.emit('deleteAnnotation', { documentId, pageIndex, annotationId })
    setAnnotations(prev => prev.filter(item => item.annotation.id !== annotationId))
  }, [documentId])

  const createThread = useCallback((thread: CommentThread) => {
    if (!socketRef.current || !documentId) return
    socketRef.current.emit('createThread', { documentId, thread })
    setThreads(prev => [...prev, thread])
  }, [documentId])

  const addReply = useCallback((threadId: string, message: CommentMessage) => {
    if (!socketRef.current || !documentId) return
    socketRef.current.emit('addReply', { documentId, threadId, message })
    setThreads(prev => prev.map(thread => {
      if (thread.id === threadId) {
        return { ...thread, messages: [...thread.messages, message] }
      }
      return thread
    }))
  }, [documentId])

  const updateCursor = useCallback((cursor: User['cursor']) => {
    if (!socketRef.current || !documentId) return
    socketRef.current.emit('updateCursor', { documentId, userId, cursor })
  }, [documentId, userId])

  return {
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
    updateCursor,
    setAnnotations,
    setThreads,
  }
}
