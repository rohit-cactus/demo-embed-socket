# WebSocket Layer — Complete Flow Design

This document explains the real-time socket layer end-to-end: how rooms work, how N users collaborate on the same document, how tagged (private) comments are delivered only to specific users, and how disconnects are handled cleanly.

---

## 1. Core Concept — Rooms

Every document gets its own Socket.IO **room** on the server. A room is just a named group of sockets. Broadcasting to the room delivers the message to every socket in it — and nobody else.

```mermaid
graph LR
    subgraph Server["Socket.IO Server"]
        R1["Room: doc:AAA\nsocket_U1\nsocket_U2\nsocket_U3"]
        R2["Room: doc:BBB\nsocket_U4\nsocket_U5"]
    end

    U1["User 1"] -->|connected| R1
    U2["User 2"] -->|connected| R1
    U3["User 3"] -->|connected| R1
    U4["User 4"] -->|connected| R2
    U5["User 5"] -->|connected| R2
```

> A broadcast to `doc:AAA` reaches U1, U2, U3. U4 and U5 never see it.

---

## 2. Join Flow — Landing on the Document Page

```mermaid
sequenceDiagram
    participant BR as Browser (User)
    participant SRV as WS Server
    participant DB as PostgreSQL
    participant CACHE as Redis

    BR->>SRV: connect (WebSocket handshake + JWT in auth header)
    SRV->>SRV: verify JWT → extract userId

    BR->>SRV: join:document\n{ documentId: "AAA" }

    SRV->>CACHE: GET perm:AAA:userId
    alt cache hit
        CACHE-->>SRV: { effectiveViewerMode, canComment, ... }
    else cache miss
        SRV->>DB: SELECT resolved_permission(userId, "AAA")
        DB-->>SRV: { effectiveViewerMode, canComment, annotationVisibility, ... }
        SRV->>CACHE: SET perm:AAA:userId  TTL 60s
    end

    SRV->>SRV: socket.join("doc:AAA")
    SRV->>SRV: socketUserMap.set(socketId, [{ documentId:"AAA", userId }])

    SRV->>DB: SELECT annotations, threads WHERE document_id = "AAA"
    DB-->>SRV: rows (filtered by annotationVisibility for this user)

    SRV-->>BR: session:ready\n{ effectiveViewerMode, canComment, annotationVisibility,\n  downloadAnnotations, downloadComments, downloadFullPdf,\n  annotations[], threads[], activeUsers[] }

    SRV--)BR: presence:joined\n{ user: { id, name, color } }\n(broadcast to everyone else in doc:AAA)
```

**Sample `session:ready` payload:**
```json
{
  "effectiveViewerMode": "editable",
  "canComment": true,
  "annotationVisibility": "all",
  "downloadAnnotations": true,
  "downloadComments": true,
  "downloadFullPdf": false,
  "annotations": [
    {
      "id": "ann-001",
      "pageIndex": 2,
      "type": "highlight",
      "rect": { "origin": { "x": 120, "y": 340 }, "size": { "width": 200, "height": 18 } },
      "color": "#FFD700",
      "opacity": 0.7,
      "authorId": "user-002",
      "authorName": "Alice"
    }
  ],
  "threads": [],
  "activeUsers": [
    { "id": "user-002", "name": "Alice", "color": "#3B82F6" }
  ]
}
```

---

## 3. N Users on the Same Document — Annotation Broadcast

```mermaid
sequenceDiagram
    participant U1 as User 1 (Editor)
    participant U2 as User 2 (Reviewer)
    participant U3 as User 3 (Reviewer)
    participant SRV as WS Server
    participant DB as PostgreSQL

    Note over U1,U3: All three already in room doc:AAA

    U1->>SRV: annotation:create\n{ documentId:"AAA", annotation: { id:"ann-007", ... } }

    SRV->>CACHE: GET perm:AAA:user1Id → effectiveViewerMode = "editable" ✓
    SRV->>DB: INSERT INTO annotations ...
    DB-->>SRV: ok

    Note over SRV: Broadcast loop — check each recipient's annotationVisibility
    SRV->>CACHE: GET perm:AAA:user2Id → annotationVisibility = "all"
    SRV--)U2: annotation:created\n{ annotation: {...}, authorId: "user-001" }

    SRV->>CACHE: GET perm:AAA:user3Id → annotationVisibility = "all"
    SRV--)U3: annotation:created\n{ annotation: {...}, authorId: "user-001" }

    SRV-->>U1: annotation:created (ack to sender too)
```

**Sample `annotation:create` payload (client → server):**
```json
{
  "documentId": "AAA",
  "annotation": {
    "id": "ann-007",
    "pageIndex": 1,
    "type": "highlight",
    "rect": { "origin": { "x": 50, "y": 200 }, "size": { "width": 300, "height": 20 } },
    "color": "#FF6B6B",
    "opacity": 0.6,
    "contents": "Important section"
  }
}
```

**Sample `annotation:created` payload (server → clients):**
```json
{
  "annotation": {
    "id": "ann-007",
    "pageIndex": 1,
    "type": "highlight",
    "rect": { "origin": { "x": 50, "y": 200 }, "size": { "width": 300, "height": 20 } },
    "color": "#FF6B6B",
    "opacity": 0.6,
    "authorId": "user-001",
    "authorName": "Bob"
  },
  "authorId": "user-001"
}
```

---

## 4. Tagged (Private) Comment — Targeted Delivery

This is where room-level broadcast is **not used**. A tagged thread must only reach the tagger and the tagged user — not the whole room.

There are two ways a thread becomes tagged: **inline at creation** (user types `@mention` in the first message) or **after creation** (user tags someone on an existing thread). Both are shown below.

### 4a. Inline Tag — Thread Born Private (recommended path)

```mermaid
sequenceDiagram
    participant U1 as User 1 (author/tagger)
    participant U2 as User 2 (tagged @mention)
    participant U3 as User 3 (same doc, NOT tagged)
    participant SRV as WS Server
    participant DB as PostgreSQL

    Note over U1,U3: All in room doc:AAA

    Note over U1: Types "Hey @Alice, check this"\nClient detects @mention → resolves to user-002

    U1->>SRV: comment:create_thread\n{ documentId:"AAA", annotationId:"ann-001",\n  body:"Hey @Alice, check this",\n  taggedUserIds:["user-002"] }

    Note over SRV: taggedUserIds present → private from birth

    SRV->>DB: BEGIN transaction
    SRV->>DB: INSERT comment_threads (id:"thr-009", author:U1)
    SRV->>DB: INSERT comment_messages (body, authorId:U1)
    SRV->>DB: INSERT comment_thread_tags\n(threadId:"thr-009", taggedUserId:U2, taggedBy:U1)
    SRV->>DB: COMMIT

    Note over SRV: Thread is private — targeted sockets only, no room broadcast

    SRV->>SRV: find socket IDs for U1 (author) and U2 (tagged)\nvia socketUserMap
    SRV-->>U1: comment:thread_created\n{ thread:{ id:"thr-009", isPrivate:true,\n  taggedUserIds:["user-002"] }, authorId:U1 }
    SRV-->>U2: comment:thread_created\n{ thread:{ id:"thr-009", isPrivate:true,\n  taggedUserIds:["user-002"] }, authorId:U1 }

    Note over U3: Receives NOTHING — thread was never public

    U2->>SRV: comment:reply\n{ documentId:"AAA", threadId:"thr-009", body:"On it!" }
    SRV->>DB: verify U2 in comment_thread_tags ✓
    SRV->>DB: INSERT comment_message
    SRV-->>U1: comment:reply_added { threadId:"thr-009", message:{...} }
    SRV-->>U2: comment:reply_added (ack)
    Note over U3: Still receives nothing
```

### 4b. Post-Creation Tag — Thread Transitions from Public to Private

```mermaid
sequenceDiagram
    participant U1 as User 1 (tagger)
    participant U2 as User 2 (tagged)
    participant U3 as User 3 (same doc, NOT tagged)
    participant SRV as WS Server
    participant DB as PostgreSQL

    Note over U1,U3: All in room doc:AAA

    U1->>SRV: comment:create_thread\n{ documentId:"AAA", annotationId:"ann-001",\n  body:"I have a note" }

    SRV->>DB: INSERT comment_threads + comment_messages
    Note over SRV: No taggedUserIds → public thread, room broadcast
    SRV--)U1: comment:thread_created (ack)
    SRV--)U3: comment:thread_created { thread:{ id:"thr-005", isPrivate:false } }
    Note over U2: U2 did NOT author it → not delivered\n(reviewer visibility rule)

    Note over U1: Decides to tag U2 on the existing thread

    U1->>SRV: comment:tag\n{ documentId:"AAA", threadId:"thr-005",\n  taggedUserId:"user-002" }

    SRV->>DB: INSERT comment_thread_tags\n(threadId:"thr-005", taggedUserId:U2, taggedBy:U1)
    DB-->>SRV: ok

    Note over SRV: Thread flips to private — switch to targeted delivery

    SRV->>SRV: find socket IDs for U1 and U2 via socketUserMap
    SRV-->>U1: comment:tag_applied\n{ threadId:"thr-005", taggedUserId:"user-002" }
    SRV-->>U2: comment:tag_applied\n{ threadId:"thr-005", taggedUserId:"user-002",\n  thread:{ ... full thread history ... } }

    Note over U3: U3 already received the thread while it was public\nClient must hide it on receiving comment:thread_made_private

    SRV--)U3: comment:thread_made_private\n{ threadId:"thr-005" }
    Note over U3: Client removes thr-005 from local state

    U2->>SRV: comment:reply\n{ documentId:"AAA", threadId:"thr-005", body:"Got it!" }
    SRV->>DB: verify U2 in comment_thread_tags ✓, INSERT message
    SRV-->>U1: comment:reply_added { threadId:"thr-005", message:{...} }
    SRV-->>U2: comment:reply_added (ack)
    Note over U3: Receives nothing — targeted delivery only
```

**How the server finds the right socket for a specific user:**

The server maintains `socketUserMap`:
```
socket_id_X  →  [{ documentId: "AAA", userId: "user-001" }]
socket_id_Y  →  [{ documentId: "AAA", userId: "user-002" }]
socket_id_Z  →  [{ documentId: "AAA", userId: "user-003" }]
```

To send only to `user-002`:
```
// server-side pseudo-code
const targetSocketIds = [...socketUserMap.entries()]
  .filter(([_, docs]) => docs.some(d => d.userId === "user-002" && d.documentId === "AAA"))
  .map(([socketId]) => socketId);

targetSocketIds.forEach(id => io.to(id).emit("comment:reply_added", payload));
```

**Sample payloads:**

`comment:create_thread` with inline tag (client → server):
```json
{
  "documentId": "AAA",
  "annotationId": "ann-001",
  "pageIndex": 2,
  "body": "Hey @Alice, can you check this?",
  "taggedUserIds": ["user-002"]
}
```

`comment:tag` post-creation (client → server):
```json
{
  "documentId": "AAA",
  "threadId": "thr-005",
  "taggedUserId": "user-002"
}
```

`comment:thread_made_private` (server → users who saw it while public):
```json
{
  "threadId": "thr-005"
}
```

---

## 5. Permission Change Mid-Session

```mermaid
sequenceDiagram
    participant ADMIN as Admin Browser
    participant U2 as User 2 (target)
    participant SRV as WS Server
    participant DB as PostgreSQL
    participant CACHE as Redis

    Note over U2: Currently editing with effectiveViewerMode = "editable"

    ADMIN->>SRV: permission:update\n{ documentId:"AAA", targetUserId:"user-002",\n  overrides: { canAnnotate: false } }

    SRV->>DB: UPDATE document_permissions\nSET override_can_annotate = false\nWHERE document_id="AAA" AND user_id="user-002"
    DB-->>SRV: ok

    SRV->>CACHE: DEL perm:AAA:user-002
    Note over CACHE: Cache invalidated — next lookup re-runs resolver

    SRV->>SRV: resolver clamps:\ncanAnnotate=false + rawMode=editable\n→ effectiveViewerMode = "read-only"

    SRV-->>U2: permission:changed\n{ effectiveViewerMode:"read-only", canComment:true }
    Note over U2: embed-pdf-viewer.setViewMode("read-only")\nAnnotation toolbar disappears instantly

    Note over SRV: If U2 sends annotation:create AFTER this point...
    U2--xSRV: annotation:create { ... }
    SRV->>CACHE: GET perm:AAA:user-002 → miss
    SRV->>DB: resolved_permission → effectiveViewerMode = "read-only"
    SRV-->>U2: error:permission_denied\n{ reason: "annotation rights revoked" }
```

---

## 6. Leave Flow — Two Scenarios

### 6a. Graceful Leave (user navigates away, component unmounts)

```mermaid
sequenceDiagram
    participant BR as Browser (User 2)
    participant SRV as WS Server

    BR->>SRV: leave:document\n{ documentId: "AAA" }

    SRV->>SRV: socket.leave("doc:AAA")
    SRV->>SRV: room.users.delete("user-002")
    SRV->>SRV: socketUserMap cleanup\n(remove { documentId:"AAA", userId:"user-002" })

    SRV--)BR: (no response needed)
    SRV--) Others in doc:AAA: presence:left\n{ userId: "user-002" }
```

### 6b. Abrupt Disconnect (browser tab closed, network lost, crash)

The client never gets a chance to send `leave:document`. Socket.IO fires a `disconnect` event on the server side automatically — this is the key safety net.

```mermaid
sequenceDiagram
    participant BR as Browser (User 2)
    participant SRV as WS Server

    Note over BR: Tab closed / network dropped / crash
    Note over BR,SRV: No leave:document event sent

    SRV->>SRV: Socket.IO detects TCP connection lost\n→ fires: socket.on("disconnect")

    SRV->>SRV: look up socketUserMap.get(socket.id)\n→ [{ documentId:"AAA", userId:"user-002" }]

    loop for each { documentId, userId } the socket was tracking
        SRV->>SRV: room = documentRooms.get(documentId)
        SRV->>SRV: room.users.delete(userId)
        SRV--) Others in that room: presence:left\n{ userId: "user-002" }
    end

    SRV->>SRV: socketUserMap.delete(socket.id)
    Note over SRV: Cleanup complete — no stale presence data
```

> A user with **multiple tabs open** on the same document has multiple socket entries in `socketUserMap`. The disconnect handler only removes the entry for the closed tab's socket. Presence is only cleared when the last socket for that user leaves the room.

---

## 7. Full N-User Concurrent Flow (All Together)

```mermaid
sequenceDiagram
    participant U1 as User 1\n(Editor)
    participant U2 as User 2\n(Reviewer)
    participant U3 as User 3\n(Reviewer, tagged)
    participant SRV as WS Server
    participant DB as PostgreSQL

    Note over U1,U3: === JOIN PHASE ===

    U1->>SRV: join:document { documentId:"AAA" }
    SRV-->>U1: session:ready { viewerMode:"editable",
              downloadAnnotations:true, downloadComments:true, downloadFullPdf:true,
              annotations:[], users:[] }

    U2->>SRV: join:document { documentId:"AAA" }
    SRV-->>U2: session:ready { viewerMode:"editable",
              downloadAnnotations:true, downloadComments:true, downloadFullPdf:false,
              annotations:[], users:[U1] }
    SRV--)U1: presence:joined { user: U2 }

    U3->>SRV: join:document { documentId:"AAA" }
    SRV-->>U3: session:ready { viewerMode:"editable",
              downloadAnnotations:true, downloadComments:true, downloadFullPdf:false,
              annotations:[], users:[U1,U2] }
    SRV--)U1: presence:joined { user: U3 }
    SRV--)U2: presence:joined { user: U3 }

    Note over U1,U3: === ACTIVITY PHASE ===

    U1->>SRV: annotation:create { ann-001 }
    SRV->>DB: INSERT annotation
    SRV--)U1: annotation:created (ack)
    SRV--)U2: annotation:created { ann-001, authorId:U1 }
    SRV--)U3: annotation:created { ann-001, authorId:U1 }

    U2->>SRV: comment:create_thread\n{ annotationId:"ann-001", body:"I have a note" }
    SRV->>DB: INSERT thread + message
    SRV--)U1: comment:thread_created (visible: editor sees all)
    SRV--)U2: comment:thread_created (ack)
    Note over U3: NOT sent — U3 didn't author it, not tagged yet

    U2->>SRV: comment:tag\n{ threadId:"thr-X", taggedUserId: U3 }
    SRV->>DB: INSERT comment_thread_tags
    SRV-->>U2: comment:tag_applied (targeted)
    SRV-->>U3: comment:tag_applied (targeted — U3 can now see the thread)
    Note over U1: U1 (editor) already sees it per A1

    U3->>SRV: comment:reply\n{ threadId:"thr-X", body:"Agreed" }
    SRV->>DB: verify U3 in thread_tags ✓, INSERT message
    SRV-->>U2: comment:reply_added (targeted)
    SRV-->>U3: comment:reply_added (ack, targeted)
    SRV-->>U1: comment:reply_added (editor override visibility)
    Note over SRV: No room broadcast — targeted delivery only for private threads

    Note over U1,U3: === LEAVE PHASE ===

    U2->>SRV: leave:document { documentId:"AAA" }
    SRV--)U1: presence:left { userId: U2 }
    SRV--)U3: presence:left { userId: U2 }

    Note over U3: Browser tab crash — no leave event sent
    SRV->>SRV: disconnect event fires for U3's socket
    SRV--)U1: presence:left { userId: U3 }
```

---

## 8. Single Diagram — Full Annotation Lifecycle (N Users)

> Three users, three roles, one document. Every annotation event from join to disconnect in one place.

```mermaid
sequenceDiagram
    participant U1 as User 1\n[Admin]
    participant U2 as User 2\n[Editor]
    participant UN as User N\n[Reviewer]
    participant WS as WebSocket Server

    rect rgb(230, 240, 255)
        Note over U1,WS: ── JOIN PHASE ──

        U1->>WS: join:document { documentId, jwt }
        WS-->>U1: session:ready\n{ effectiveViewerMode:"editable",\n  downloadAnnotations:true, downloadComments:true, downloadFullPdf:true,\n  annotations:[], activeUsers:[] }

        U2->>WS: join:document { documentId, jwt }
        WS-->>U2: session:ready\n{ effectiveViewerMode:"editable",\n  downloadAnnotations:true, downloadComments:true, downloadFullPdf:false,\n  annotations:[], activeUsers:[U1] }
        WS--)U1: presence:joined { userId:U2, name, color }

        UN->>WS: join:document { documentId, jwt }
        WS-->>UN: session:ready\n{ effectiveViewerMode:"editable",\n  downloadAnnotations:true, downloadComments:true, downloadFullPdf:false,\n  annotations:[], activeUsers:[U1,U2] }
        WS--)U1: presence:joined { userId:UN, name, color }
        WS--)U2: presence:joined { userId:UN, name, color }
    end

    rect rgb(230, 255, 235)
        Note over U1,WS: ── ANNOTATION CREATE ──

        U1->>WS: annotation:create\n{ documentId, annotation:{ id:"ann-1", type:"highlight", ... } }
        WS-->>U1: annotation:created { annotation, authorId:U1 }
        WS--)U2: annotation:created { annotation, authorId:U1 }
        WS--)UN: annotation:created { annotation, authorId:U1 }

        U2->>WS: annotation:create\n{ documentId, annotation:{ id:"ann-2", type:"rect", ... } }
        WS-->>U2: annotation:created { annotation, authorId:U2 }
        WS--)U1: annotation:created { annotation, authorId:U2 }
        WS--)UN: annotation:created { annotation, authorId:U2 }

        UN->>WS: annotation:create\n{ documentId, annotation:{ id:"ann-3", type:"ink", ... } }
        WS-->>UN: annotation:created { annotation, authorId:UN }
        WS--)U1: annotation:created { annotation, authorId:UN }
        WS--)U2: annotation:created { annotation, authorId:UN }
    end

    rect rgb(255, 250, 220)
        Note over U1,WS: ── ANNOTATION UPDATE ──

        U1->>WS: annotation:update\n{ documentId, annotationId:"ann-1",\n  delta:{ color:"#FF0000", opacity:0.8 } }
        WS-->>U1: annotation:updated { annotationId:"ann-1", delta, authorId:U1 }
        WS--)U2: annotation:updated { annotationId:"ann-1", delta, authorId:U1 }
        WS--)UN: annotation:updated { annotationId:"ann-1", delta, authorId:U1 }
    end

    rect rgb(255, 235, 235)
        Note over U1,WS: ── ANNOTATION DELETE ──

        U2->>WS: annotation:delete\n{ documentId, annotationId:"ann-2" }
        WS-->>U2: annotation:deleted { annotationId:"ann-2", authorId:U2 }
        WS--)U1: annotation:deleted { annotationId:"ann-2", authorId:U2 }
        WS--)UN: annotation:deleted { annotationId:"ann-2", authorId:U2 }
    end

    rect rgb(240, 230, 255)
        Note over U1,WS: ── VISIBILITY FILTER (annotationVisibility = own_only for UN) ──

        Note over WS: Admin sets UN's annotationVisibility to own_only
        WS-->>UN: permission:changed\n{ annotationVisibility:"own_only" }

        U1->>WS: annotation:create\n{ documentId, annotation:{ id:"ann-4", ... } }
        WS-->>U1: annotation:created { annotation, authorId:U1 }
        WS--)U2: annotation:created { annotation, authorId:U1 }
        Note over UN: ✗ dropped — UN's visibility is own_only,\nann-4 author is U1, not UN

        UN->>WS: annotation:create\n{ documentId, annotation:{ id:"ann-5", ... } }
        WS-->>UN: annotation:created { annotation, authorId:UN }
        WS--)U1: annotation:created { annotation, authorId:UN }
        WS--)U2: annotation:created { annotation, authorId:UN }
        Note over UN: ✓ UN receives own annotation (authorId matches)
    end

    rect rgb(235, 245, 255)
        Note over U1,WS: ── LEAVE PHASE ──

        U2->>WS: leave:document { documentId }
        WS--)U1: presence:left { userId:U2 }
        WS--)UN: presence:left { userId:U2 }

        Note over UN: Browser closed — no event sent
        WS--)U1: presence:left { userId:UN }\n(socket disconnect detected automatically)
    end
```

---

## 9. Summary — Delivery Method per Event Type

| Event | Delivery method | Who receives |
|---|---|---|
| `annotation:created/updated/deleted` | `io.to("doc:AAA")` then per-recipient visibility filter | All users whose `annotationVisibility = 'all'`; own-only users receive only their own |
| `comment:thread_created` (public thread) | `io.to("doc:AAA")` | Author + Admin/Editor; other reviewers excluded |
| `comment:thread_created` (tagged thread) | `io.to(socketId)` per user | Tagger + each tagged user + Admin/Editor only |
| `comment:reply_added` (public) | Same as thread_created | Same rules as the thread |
| `comment:reply_added` (private/tagged) | `io.to(socketId)` per user | Same as tagged thread |
| `comment:tag_applied` | `io.to(socketId)` × 2 | Tagger + tagged user only |
| `permission:changed` | `io.to(socketId)` | The affected user only |
| `presence:joined/left` | `io.to("doc:AAA")` | Everyone in the room |
| `presence:cursor_moved` | `socket.to("doc:AAA")` (excludes sender) | Everyone except the mover |
