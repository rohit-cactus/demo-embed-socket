// Type definitions for the PDF collaboration server

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

export interface Annotation {
  id: string
  documentId: string
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
}

export interface AnnotationTransferItem {
  annotation: Annotation
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

export interface DocumentRoom {
  documentId: string
  annotations: AnnotationTransferItem[]
  threads: CommentThread[]
  users: Map<string, User>
  lastModified: number
}

export interface SocketEvents {
  // Client -> Server
  joinDocument: (data: { documentId: string; userId: string; userName: string }) => void
  leaveDocument: (data: { documentId: string; userId: string }) => void

  createAnnotation: (data: { documentId: string; annotation: AnnotationTransferItem }) => void
  updateAnnotation: (data: { documentId: string; annotationId: string; updates: Partial<Annotation> }) => void
  deleteAnnotation: (data: { documentId: string; pageIndex: number; annotationId: string }) => void

  createThread: (data: { documentId: string; thread: CommentThread }) => void
  addReply: (data: { documentId: string; threadId: string; message: CommentMessage }) => void

  updateCursor: (data: { documentId: string; userId: string; cursor: User['cursor'] }) => void

  // Server -> Client
  documentState: (data: { annotations: AnnotationTransferItem[]; threads: CommentThread[]; users: User[] }) => void
  annotationCreated: (data: { annotation: AnnotationTransferItem; userId: string }) => void
  annotationUpdated: (data: { annotationId: string; updates: Partial<Annotation>; userId: string }) => void
  annotationDeleted: (data: { pageIndex: number; annotationId: string; userId: string }) => void

  threadCreated: (data: { thread: CommentThread; userId: string }) => void
  replyAdded: (data: { threadId: string; message: CommentMessage; userId: string }) => void

  userJoined: (data: { user: User }) => void
  userLeft: (data: { userId: string }) => void
  cursorUpdated: (data: { userId: string; cursor: User['cursor'] }) => void

  error: (message: string) => void
}

export interface PersistenceData {
  documents: Record<string, {
    annotations: AnnotationTransferItem[]
    threads: CommentThread[]
    lastModified: number
  }>
}
