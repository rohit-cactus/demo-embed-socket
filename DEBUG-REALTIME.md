# 🐛 Real-Time Sync Not Working? DEBUG GUIDE

## ✅ Quick Checklist

### 1. **Is the Server Running?**

```bash
# Check if port 3001 is in use
lsof -i :3001

# If nothing shows up, the server isn't running!
```

### 2. **Start Everything Correctly**

**Option A: Both at once (RECOMMENDED)**
```bash
cd embed-pdf-app
npm run dev:all
```

You should see output like:
```
> concurrently "npm run dev" "npm run dev:server"

[0] > vite
[0]
[0]   VITE v5.1.0  ready in 1023 ms
[0]
[0]   ➜  local:   http://localhost:5173/
[1] > cd server && npm run dev
[1]
[1] 🚀 Socket.IO server running on http://localhost:3001
[1] 📡 WebSocket endpoint: ws://localhost:3001
```

**Option B: Separate terminals**
```bash
# Terminal 1
cd embed-pdf-app/server
npm run dev

# Terminal 2
cd embed-pdf-app
npm run dev
```

### 3. **Verify Both Are Running**

```bash
# Check if both ports are listening
lsof -i :5173   # Client
lsof -i :3001   # Server

# Check server health
curl http://localhost:3001/health
# Should return: {"status":"ok","documents":0,"connections":0}

# Check server can see active documents
curl http://localhost:3001/api/documents
# Should return: []
```

---

## 🧪 Step-by-Step Testing

### Step 1: Start the System

```bash
cd embed-pdf-app
npm run dev:all
```

Wait for both to start:
- ✅ Vite: "ready in XXXms"
- ✅ Socket.IO: "🚀 Socket.IO server running on..."

### Step 2: Open CollaborativeViewerFull

Edit `src/App.tsx` and add this route:

```typescript
import CollaborativeViewerFull from './pages/CollaborativeViewerFull'

// In your router:
<Route path="/collab" element={<CollaborativeViewerFull />} />
```

### Step 3: Test in Chrome

1. Open: `http://localhost:5173/collab`
2. Open browser DevTools (F12)
3. Go to Network → WS tab
4. Look for a connection to `localhost:3001`
5. Should show **"101 Switching Protocols"** = ✅ Connected

### Step 4: Test in Firefox

1. Open a new Firefox window
2. Go to: `http://localhost:5173/collab`
3. Enter a DIFFERENT name (e.g., "Reviewer 2")
4. Add a comment in Chrome window
5. **Check Firefox** - should appear instantly!

---

## 🔍 If It's Not Syncing

### Check 1: Socket.IO Connection

**In Browser Console (F12):**

```javascript
// Check if Socket.IO loaded
console.log(typeof io)
// Should print: "function"

// Check if socket is connected
const socket = io('http://localhost:3001')
socket.on('connect', () => console.log('Connected!'))
socket.on('connect_error', err => console.error('Error:', err))
```

### Check 2: Server Logs

Watch the server terminal output:

```bash
# Good signs:
Socket connected: socket-id-xxx
User xxx joining document ebook-sample
Imported document: ebook-sample
Loaded document: ebook-sample

# Bad signs:
Error: ECONNREFUSED (server not running)
Cannot find module (missing dependencies)
Port already in use
```

### Check 3: Network Tab

In browser DevTools:

1. Open Network tab
2. Filter to "WS" (WebSocket)
3. Should show active WebSocket connection to `localhost:3001`
4. Messages should appear when you interact

If no WebSocket connection:
- Server is not running (port 3001)
- CORS is blocking it
- Firewall issue

### Check 4: Browser Console Errors

```javascript
// In browser console, watch for:

// ✅ Good
"Socket connected:"
"Received document state:"
"User XXX joined"

// ❌ Bad
"Connection refused"
"Cannot connect to"
"Cannot find module"
"CORS error"
```

---

## 🆘 Common Issues & Fixes

### Issue 1: "Cannot connect to server"

**Cause**: Server not running

**Fix**:
```bash
# In new terminal:
cd embed-pdf-app/server
npm run dev

# Should show:
# 🚀 Socket.IO server running on http://localhost:3001
```

### Issue 2: "Port 3001 already in use"

**Cause**: Another process is using that port

**Fix**:
```bash
# Find and kill process
lsof -i :3001
kill -9 <PID>

# Then restart
npm run dev:server
```

### Issue 3: "Module not found: socket.io-client"

**Cause**: Dependencies not installed

**Fix**:
```bash
cd embed-pdf-app
npm install socket.io-client

# And for server:
cd server
npm install
```

### Issue 4: Comments appear locally but not in other window

**Cause**: Local state updated but not synced

**Check**:
- Is WebSocket connected? (Look for green indicator)
- Check browser console for errors
- Check server console for received events

**Fix**:
```javascript
// In console, manually test:
const socket = io('http://localhost:3001')
socket.emit('createThread', { documentId: 'ebook-sample', thread: { ...} })
```

### Issue 5: "Annotations not appearing"

**Cause**: Annotations synced but not imported into EmbedPDF

**Fix**:
```javascript
// In console:
// Check if annotations are coming from server
localStorage.setItem('debug', 'true')

// Reload page and watch console for:
// "Importing X annotations"
// "Received document state:"
```

---

## 🔧 Advanced Debugging

### Enable Detailed Logs

Add this to `src/hooks/useCollaboration.ts`:

```typescript
const DEBUG = true

if (DEBUG) {
  console.log('useCollaboration - isConnected:', isConnected)
  console.log('useCollaboration - isJoined:', isJoined)
  console.log('useCollaboration - annotations:', annotations.length)
  console.log('useCollaboration - threads:', threads.length)
  console.log('useCollaboration - users:', users)
}
```

### Watch All Socket Events

```javascript
// In browser console:
const socket = io('http://localhost:3001')

// Log all events
socket.on('*', (event, ...args) => {
  console.log('📨 Event:', event, args)
})

// Or specific events:
socket.on('documentState', (data) => console.log('📥 Doc:', data))
socket.on('annotationCreated', (data) => console.log('📌 Anno:', data))
socket.on('threadCreated', (data) => console.log('💬 Thread:', data))
socket.on('replyAdded', (data) => console.log('↩️ Reply:', data))
```

### Check Server State

```bash
# View all persisted data
cat server/data/persistence.json | jq

# Clear all data (start fresh)
echo '{"documents":{}}' > server/data/persistence.json

# View backups
ls -la server/data/backups/
```

---

## ✅ Verification Checklist

Before giving up, verify ALL of these:

- [ ] `npm run dev:all` is running
- [ ] Both servers show startup messages (no errors)
- [ ] `curl http://localhost:3001/health` returns JSON
- [ ] Browser Network tab shows WebSocket connection
- [ ] Browser console has no errors
- [ ] You're using `CollaborativeViewerFull` (not old `CollaborativeViewer`)
- [ ] You waited 2+ seconds after page load (socket connection takes time)
- [ ] You're using `http://localhost:5173/collab` route
- [ ] You opened 2 different browser tabs/windows
- [ ] You entered different names in each window
- [ ] You added a comment in one and looked in the other

---

## 🚀 If Everything Checks Out

The system should be working! Try:

1. **Add a comment in Chrome** → Should appear in Firefox instantly
2. **Create a highlight** → Should sync to other browser
3. **Refresh Firefox** → Comments should still be there (persisted!)
4. **Restart server** → Comments still there (saved in JSON)

---

## 📞 Still Not Working?

Share:
1. Output from `npm run dev:all`
2. Browser console errors (F12)
3. Server terminal errors
4. Output from: `curl http://localhost:3001/health`
5. Output from: `curl http://localhost:3001/api/documents`

---

**The most common issue is forgetting to start the server! ⚡**
