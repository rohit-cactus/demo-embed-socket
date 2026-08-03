// Socket.IO server for PDF collaboration
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'
import type {
  DocumentRoom,
  User,
  AnnotationTransferItem,
  CommentThread,
  CommentMessage,
} from './types'
import * as persistence from './persistence'

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// In-memory document rooms (persisted to file)
const documentRooms = new Map<string, DocumentRoom>()

// Load persisted data on startup
async function initializeServer() {
  console.log('Loading persisted data...')
  const data = await persistence.loadPersistence()

  for (const [documentId, doc] of Object.entries(data.documents)) {
    const room: DocumentRoom = {
      documentId,
      annotations: doc.annotations,
      threads: doc.threads,
      users: new Map(),
      lastModified: doc.lastModified,
    }
    documentRooms.set(documentId, room)
    console.log(`Loaded document: ${documentId} (${doc.annotations.length} annotations, ${doc.threads.length} threads)`)
  }

  console.log('Server initialized with', documentRooms.size, 'documents')
}

// Get or create a document room
function getOrCreateRoom(documentId: string): DocumentRoom {
  let room = documentRooms.get(documentId)

  if (!room) {
    room = {
      documentId,
      annotations: [],
      threads: [],
      users: new Map(),
      lastModified: Date.now(),
    }
    documentRooms.set(documentId, room)
  }

  return room
}

// Generate a consistent color for a user based on their ID
function getUserColor(userId: string): string {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ]

  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    documents: documentRooms.size,
    connections: Array.from(documentRooms.values()).reduce(
      (sum, room) => sum + room.users.size,
      0
    ),
  })
})

// Get all active documents
app.get('/api/documents', (req, res) => {
  const documents = Array.from(documentRooms.entries()).map(([id, room]) => ({
    id,
    users: room.users.size,
    annotations: room.annotations.length,
    threads: room.threads.length,
    lastModified: room.lastModified,
  }))
  res.json(documents)
})

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  // Handle joining a document
  socket.on('joinDocument', async (data: { documentId: string; userId: string; userName: string }) => {
    const { documentId, userId, userName } = data

    console.log(`User ${userName} (${userId}) joining document ${documentId}`)

    // Join the socket room
    socket.join(`doc:${documentId}`)

    // Get or create the document room
    const room = getOrCreateRoom(documentId)

    // Add user to room
    const user: User = {
      id: userId,
      name: userName,
      color: getUserColor(userId),
      lastSeen: Date.now(),
    }
    room.users.set(userId, user)

    // Send current document state to the user
    socket.emit('documentState', {
      annotations: room.annotations,
      threads: room.threads,
      users: Array.from(room.users.values()),
    })

    // Notify others that user joined
    socket.to(`doc:${documentId}`).emit('userJoined', { user })
  })

  // Handle leaving a document
  socket.on('leaveDocument', (data: { documentId: string; userId: string }) => {
    const { documentId, userId } = data
    console.log(`User ${userId} leaving document ${documentId}`)

    socket.leave(`doc:${documentId}`)

    const room = documentRooms.get(documentId)
    if (room) {
      room.users.delete(userId)
      socket.to(`doc:${documentId}`).emit('userLeft', { userId })
    }
  })

  // Handle annotation creation
  socket.on('createAnnotation', async (data: { documentId: string; annotation: AnnotationTransferItem }) => {
    const { documentId, annotation } = data
    const room = getOrCreateRoom(documentId)

    // Set initial timestamp if not provided
    if (!annotation.annotation.created) {
      annotation.annotation.created = Date.now()
    }

    room.annotations.push(annotation)
    room.lastModified = Date.now()

    // Save to persistence
    await persistence.addAnnotation(documentId, annotation)

    // Broadcast to all users in the document
    io.to(`doc:${documentId}`).emit('annotationCreated', {
      annotation,
      userId: socket.handshake.query.userId as string,
    })
  })

  // Handle annotation update
  socket.on('updateAnnotation', async (data: {
    documentId: string
    annotationId: string
    updates: Partial<AnnotationTransferItem['annotation']>
  }) => {
    const { documentId, annotationId, updates } = data
    const room = documentRooms.get(documentId)

    if (room) {
      const idx = room.annotations.findIndex(a => a.annotation.id === annotationId)

      if (idx !== -1) {
        room.annotations[idx].annotation = {
          ...room.annotations[idx].annotation,
          ...updates,
          modified: Date.now(),
        }
        room.lastModified = Date.now()

        // Save to persistence
        await persistence.updateAnnotation(documentId, annotationId, updates)

        // Broadcast to all users in the document
        io.to(`doc:${documentId}`).emit('annotationUpdated', {
          annotationId,
          updates,
          userId: socket.handshake.query.userId as string,
        })
      }
    }
  })

  // Handle annotation deletion
  socket.on('deleteAnnotation', async (data: {
    documentId: string
    pageIndex: number
    annotationId: string
  }) => {
    const { documentId, pageIndex, annotationId } = data
    const room = documentRooms.get(documentId)

    if (room) {
      room.annotations = room.annotations.filter(a => a.annotation.id !== annotationId)
      room.lastModified = Date.now()

      // Save to persistence
      await persistence.deleteAnnotation(documentId, annotationId)

      // Broadcast to all users in the document
      io.to(`doc:${documentId}`).emit('annotationDeleted', {
        pageIndex,
        annotationId,
        userId: socket.handshake.query.userId as string,
      })
    }
  })

  // Handle thread creation
  socket.on('createThread', async (data: { documentId: string; thread: CommentThread }) => {
    const { documentId, thread } = data
    const room = getOrCreateRoom(documentId)

    room.threads.push(thread)
    room.lastModified = Date.now()

    // Save to persistence
    await persistence.addThread(documentId, thread)

    // Broadcast to all users in the document
    io.to(`doc:${documentId}`).emit('threadCreated', {
      thread,
      userId: socket.handshake.query.userId as string,
    })
  })

  // Handle reply to thread
  socket.on('addReply', async (data: {
    documentId: string
    threadId: string
    message: CommentMessage
  }) => {
    const { documentId, threadId, message } = data
    const room = documentRooms.get(documentId)

    if (room) {
      const thread = room.threads.find(t => t.id === threadId)

      if (thread) {
        thread.messages.push(message)
        room.lastModified = Date.now()

        // Save to persistence
        await persistence.addReply(documentId, threadId, message)

        // Broadcast to all users in the document
        io.to(`doc:${documentId}`).emit('replyAdded', {
          threadId,
          message,
          userId: socket.handshake.query.userId as string,
        })
      }
    }
  })

  // Handle cursor updates (for presence indicators)
  socket.on('updateCursor', (data: {
    documentId: string
    userId: string
    cursor: User['cursor']
  }) => {
    const { documentId, userId, cursor } = data
    const room = documentRooms.get(documentId)

    if (room) {
      const user = room.users.get(userId)
      if (user) {
        user.cursor = cursor
        user.lastSeen = Date.now()

        // Broadcast cursor update (don't save to persistence)
        socket.to(`doc:${documentId}`).emit('cursorUpdated', { userId, cursor })
      }
    }
  })

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)

    // Remove user from all rooms they were in
    documentRooms.forEach((room, documentId) => {
      let removed = false
      room.users.forEach((user, userId) => {
        // In a real app, you'd track socket.id -> userId mapping
        // For now, we'll just leave users connected until they explicitly leave
      })

      if (removed) {
        socket.to(`doc:${documentId}`).emit('userLeft', { userId: 'disconnected' })
      }
    })
  })
})

// Initialize and start server
const PORT = process.env.PORT || 3001

initializeServer().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Socket.IO server running on http://localhost:${PORT}`)
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`)
    console.log(`\nEndpoints:`)
    console.log(`  GET  /health         - Health check`)
    console.log(`  GET  /api/documents  - List active documents`)
    console.log(`\nJoin URL for testing:`)
    console.log(`  http://localhost:5173 (Vite dev server)`)
    console.log(`\nData will be persisted to: ${process.cwd()}/data/persistence.json`)
  })
})
