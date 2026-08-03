# Integration Guide: Migrating CustomViewerTwo to Socket.IO

This guide shows exactly how to modify your existing `CustomViewerTwo.tsx` to use Socket.IO instead of localStorage.

## Overview of Changes

### What Changes:
1. **Remove localStorage** → Replace with Socket.IO events
2. **Add collaboration hook** → Use `useDocumentCollaboration`
3. **Show connection status** → Display real-time connection indicator
4. **Show user presence** → Display avatars of other viewers

### What Stays the Same:
- All UI components (toolbar, sidebar, editor)
- PDF viewing and rendering
- Annotation logic
- Comment thread UI

---

## Step-by-Step Migration

### Step 1: Import the Collaboration Hook

Add to your imports in `CustomViewerTwo.tsx`:

```typescript
import { useDocumentCollaboration } from '../hooks/useCollaboration'
import type { CommentThread, CommentMessage } from '../hooks/useCollaboration'
import { UserPresence } from '../components/UserPresence'
import { Wifi, WifiOff } from 'lucide-react'
```

---

### Step 2: Add User ID State

Add near the top of your `CustomViewerTwo` component:

```typescript
export const CustomViewerTwo = () => {
  const { engine, isLoading } = usePdfiumEngine()
  const [textSelectionEnabled, setTextSelectionEnabled] = useState(true)
  const [annotationEditingEnabled, setAnnotationEditingEnabled] = useState(true)
  const [persistencePaused, setPersistencePaused] = useState(false)

  // NEW: Add user identification
  const [userId] = useState(() => {
    const stored = localStorage.getItem('collab_user_id')
    if (stored) return stored
    const newId = `user_${Math.random().toString(36).slice(2)}_${Date.now()}`
    localStorage.setItem('collab_user_id', newId)
    return newId
  })

  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('collab_user_name') || 'Reviewer'
  })

  // Save username when it changes
  useEffect(() => {
    localStorage.setItem('collab_user_name', userName)
  }, [userName])

  // ... rest of component
}
```

---

### Step 3: Replace Local Storage with Socket.IO

**BEFORE (Current Code):**

```typescript
// In AnnotatedDocumentWorkspace component
const [threads, setThreads] = useState<CommentThread[]>([])

// Load from localStorage
useEffect(() => {
  const stored = localStorage.getItem(commentStorageKey)
  if (stored) {
    setThreads(JSON.parse(stored))
  }
}, [commentStorageKey])

// Save to localStorage
useEffect(() => {
  if (hasLoadedThreadsRef.current) {
    localStorage.setItem(commentStorageKey, JSON.stringify(threads))
  }
}, [commentStorageKey, threads])
```

**AFTER (With Socket.IO):**

```typescript
// In AnnotatedDocumentWorkspace - add collaboration hook
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
  setThreads,
} = useDocumentCollaboration(documentId, userId, userName)

// NO MORE localStorage! Data syncs automatically via Socket.IO
// threads state is now managed by the collaboration hook
```

---

### Step 4: Update Annotation Persistence

**BEFORE:**

```typescript
// AnnotationPersistence component saves to localStorage
const saveSnapshot = useCallback(() => {
  annotationApi.exportAnnotations().wait((items) => {
    localStorage.setItem(storageKey, JSON.stringify(items))
  })
}, [annotationApi])
```

**AFTER:**

```typescript
// Replace entire AnnotationPersistence component with:
const AnnotationSync = ({ documentId }: { documentId: string }) => {
  const { provides: annotationApi } = useAnnotation(documentId)
  const {
    annotations,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
    setAnnotations,
  } = useDocumentCollaboration(documentId, userId, userName)

  // Import annotations from server when connected
  useEffect(() => {
    if (!annotationApi || annotations.length === 0) return
    annotationApi.importAnnotations(annotations)
  }, [annotationApi, annotations])

  // Listen for local annotation changes and sync to server
  useEffect(() => {
    if (!annotationApi) return

    const unsubscribe = annotationApi.onAnnotationEvent((event) => {
      if (event.type === 'create') {
        const item = {
          annotation: {
            id: event.annotation.id,
            pageIndex: event.annotation.pageIndex,
            rect: event.annotation.rect,
            segmentRects: (event.annotation as any).segmentRects,
            color: (event.annotation as any).color,
            created: Date.now(),
          },
        }
        createAnnotation(item)
      } else if (event.type === 'update') {
        // Sync update to server
        const annotation = state.byUid[event.annotationId]
        if (annotation) {
          updateAnnotation(event.annotationId, (annotation.object as any))
        }
      } else if (event.type === 'delete') {
        deleteAnnotation(event.pageIndex, event.annotationId)
      }
    })

    return () => unsubscribe()
  }, [annotationApi, createAnnotation, updateAnnotation, deleteAnnotation])

  return null
}
```

---

### Step 5: Update Comment Thread Submission

**BEFORE:**

```typescript
const submitPendingComment = useCallback(() => {
  const thread: CommentThread = {
    id: createThreadId(),
    annotationId: pendingDraft.annotationId,
    pageIndex: pendingDraft.pageIndex,
    quote: pendingDraft.quote,
    anchorRatio: pendingDraft.anchorRatio,
    createdAt: Date.now(),
    messages: [message],
  }

  setThreads((prev) => [...prev, thread])
}, [pendingDraft, pendingCommentText])
```

**AFTER:**

```typescript
const submitPendingComment = useCallback(() => {
  const now = Date.now()
  const message: CommentMessage = {
    id: createThreadId(),
    parentId: null,
    authorName: userName.trim(),
    authorId: userId,
    text: pendingCommentText.trim(),
    createdAt: now,
  }

  const thread: CommentThread = {
    id: createThreadId(),
    annotationId: pendingDraft.annotationId,
    documentId: documentId, // NEW: required for server
    pageIndex: pendingDraft.pageIndex,
    quote: pendingDraft.quote,
    anchorRatio: pendingDraft.anchorRatio,
    createdAt: now,
    messages: [message],
  }

  // NEW: Send to server instead of local state update
  createThread(thread)

  // Local state update happens automatically via Socket.IO event
  setPendingCommentText('')
  setPendingDraft(null)
}, [pendingDraft, pendingCommentText, userName, userId, documentId, createThread])
```

---

### Step 6: Update Reply Submission

**BEFORE:**

```typescript
const submitReply = useCallback((threadId: string) => {
  const reply: CommentMessage = {
    id: createThreadId(),
    authorName: userName.trim(),
    text: pendingReplyText,
    createdAt: Date.now(),
  }

  setThreads((prev) =>
    prev.map((thread) =>
      thread.id === threadId
        ? { ...thread, messages: [...thread.messages, reply] }
        : thread,
    ),
  )
}, [userName, pendingReplyText])
```

**AFTER:**

```typescript
const submitReply = useCallback((threadId: string) => {
  const reply: CommentMessage = {
    id: createThreadId(),
    parentId: null,
    authorName: userName.trim(),
    authorId: userId,
    text: (pendingReplyByThread[threadId] || '').trim(),
    createdAt: Date.now(),
  }

  // NEW: Send to server
  addReply(threadId, reply)

  // Clear local draft
  setPendingReplyByThread((prev) => ({ ...prev, [threadId]: '' }))
}, [userName, userId, pendingReplyByThread, addReply])
```

---

### Step 7: Add Connection Status UI

Add this to your toolbar or header:

```typescript
// Connection indicator component
const ConnectionIndicator = ({ isConnected }: { isConnected: boolean }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
    isConnected
      ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
      : 'bg-red-100 text-red-800 ring-1 ring-red-300'
  }`}>
    {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
    <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
  </div>
)

// Usage in toolbar
<div className="flex items-center gap-2">
  <ConnectionIndicator isConnected={isConnected && isJoined} />
  <UserPresence users={users} currentUserId={userId} />
</div>
```

---

### Step 8: Add User Name Input

Add to your toolbar:

```typescript
<div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200">
  <label className="text-xs font-semibold text-gray-700">Your Name:</label>
  <input
    type="text"
    value={userName}
    onChange={(e) => setUserName(e.target.value)}
    className="px-2 py-1 text-xs border border-gray-300 rounded"
  />
</div>
```

---

## Complete Example

Here's how the updated `AnnotatedDocumentWorkspace` should look:

```typescript
const AnnotatedDocumentWorkspace = ({
  documentId,
  userId,
  userName,
  onUserNameChange,
  textSelectionEnabled,
  annotationEditingEnabled,
}: {
  documentId: string
  userId: string
  userName: string
  onUserNameChange: (name: string) => void
  textSelectionEnabled: boolean
  annotationEditingEnabled: boolean
}) => {
  const { provides: annotationApi, state } = useAnnotation(documentId)

  // NEW: Use collaboration hook instead of localStorage
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

  const [pendingDraft, setPendingDraft] = useState<PendingCommentDraft | null>(null)
  const [pendingCommentText, setPendingCommentText] = useState('')
  const [pendingReplyByThread, setPendingReplyByThread] = useState<Record<string, string>>({})

  // Rest of your component logic...
  // (thread positioning, draft handling, etc.)

  // If connection error, show message
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <WifiOff className="w-12 h-12 text-red-500" />
        <div className="text-xl font-bold">Connection Error</div>
        <div className="text-gray-600">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Connection status */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <ConnectionIndicator isConnected={isConnected && isJoined} />
          <UserPresence users={users} currentUserId={userId} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold">Your Name:</label>
          <input
            value={userName}
            onChange={(e) => onUserNameChange(e.target.value)}
            className="px-2 py-1 text-xs border rounded"
          />
        </div>
      </div>

      {/* Rest of your existing UI */}
      <ImportExportToolbar documentId={documentId} threads={threads} />

      <div className="flex flex-1 min-h-0">
        <Viewport documentId={documentId}>
          <Scroller documentId={documentId} renderPage={...}>
            <AnnotationLayer documentId={documentId} />
          </Scroller>
        </Viewport>

        <ThreadSidebar threads={threads} />
      </div>
    </div>
  )
}
```

---

## Testing Your Integration

### 1. Start the Server
```bash
cd server
npm install  # First time only
npm run dev
```

### 2. Start the Client
```bash
cd ..
npm run dev
```

### 3. Test Multi-User
1. Open `http://localhost:5173` in Chrome
2. Open `http://localhost:5173` in Firefox (or incognito)
3. Add comments/annotations in one window
4. See them appear instantly in the other window!

---

## Troubleshooting

### "Threads not syncing"
- Check browser console for Socket.IO errors
- Verify `documentId` is the same in all windows
- Ensure server is running on port 3001

### "Annotations not appearing"
- Check `isConnected` status in UI
- Verify `annotationApi.importAnnotations()` is being called
- Check server console for incoming events

### "User presence not showing"
- Ensure `userId` and `userName` are set
- Check that `users` array from hook is being used
- Verify `UserPresence` component is rendered

---

## Summary of Changes

| Component | Before | After |
|-----------|--------|-------|
| **Storage** | localStorage | Socket.IO + JSON Files |
| **State** | Local React state | Collaboration hook |
| **Sync** | Manual save/load | Automatic real-time |
| **Users** | Single user | Multi-user presence |
| **Persistence** | Browser only | Server-side JSON |

---

That's it! Your PDF viewer now supports real-time collaboration! 🎉
