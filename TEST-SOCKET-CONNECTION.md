# 🧪 Socket.IO Connection Test

## Quick Test (1 minute)

### Step 1: Verify Server is Running

```bash
curl http://localhost:3001/health
```

**Expected output:**
```json
{"status":"ok","documents":0,"connections":0}
```

**If you get error:**
```bash
# Server is NOT running. Start it:
cd embed-pdf-app/server
npm run dev
```

---

### Step 2: Check Active Documents

```bash
curl http://localhost:3001/api/documents
```

**Expected output:**
```json
[]
```

This means no users connected yet (or server restarted)

---

### Step 3: Open Browser & Check WebSocket

1. **Open**: `http://localhost:5173/collab`
2. **Press F12** (DevTools)
3. **Go to**: Network → WS tab
4. **Look for**: Connection to `localhost:3001`
   - Status: **101 Switching Protocols** ✅ = Connected
   - If missing: Server didn't start or CORS issue

---

### Step 4: Check Connected Users

```bash
curl http://localhost:3001/api/documents
```

**After opening `/collab`, you should see:**
```json
[
  {
    "id": "ebook-sample",
    "users": 1,
    "annotations": 0,
    "threads": 0,
    "lastModified": 1722686400000
  }
]
```

---

### Step 5: Add a Comment

1. In first browser tab, **highlight some text**
2. Click **"Add Comment"**
3. Type a comment and submit
4. **Open second browser tab** (or Firefox)
5. **Go to**: `http://localhost:5173/collab`
6. **Your comment should appear!** ✨

If it doesn't appear:
```bash
# Check persisted data
cat server/data/persistence.json | jq
```

You should see your comment data there

---

## 📊 Real-Time Data Flow

```
Browser 1                    Server                     Browser 2
─────────                    ──────                     ─────────
  │
  ├─ Add comment ────→ Socket.IO ────────────────────→ Receive event
  │                    (emit)                           (listen)
  │
  └─ Save to           JSON file                        Update state
     local state       (persistence.json)               Render
```

---

## ✅ Success Indicators

- [ ] Server starts with "🚀 Socket.IO server running"
- [ ] Browser shows WebSocket "101" in Network tab
- [ ] `/api/documents` shows 1 user after opening `/collab`
- [ ] Adding comment in Browser 1 appears in Browser 2 instantly
- [ ] Persisted data shows in `server/data/persistence.json`
- [ ] Page refresh keeps comments (persistence works)

---

## ❌ Failure Indicators

| Error | Cause | Fix |
|-------|-------|-----|
| `curl: (7) Failed to connect` | Server not running | `cd server && npm run dev` |
| No WS in Network tab | Socket not connecting | Check CORS, check port 3001 |
| Comments don't sync | Event not emitted/received | Check browser console |
| "Module not found" | Dependencies missing | `npm install` |
| "Port 3001 already in use" | Process using port | `kill -9 <PID>` |

---

## 📝 Browser Console Commands

Test manually in DevTools Console:

```javascript
// Check Socket.IO loaded
console.log('Socket.IO:', typeof io !== 'undefined' ? '✅' : '❌')

// Manual connection test
const socket = io('http://localhost:3001', { 
  query: { userId: 'test', userName: 'Tester' } 
})

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id)
})

socket.on('connect_error', (err) => {
  console.log('❌ Error:', err)
})

socket.on('documentState', (data) => {
  console.log('✅ Received state:', data)
})
```

---

## 🚀 Ready? Go Test!

1. **Terminal 1**: `cd embed-pdf-app && npm run dev:all`
2. **Wait** for both servers to start
3. **Browser**: Open `http://localhost:5173/collab`
4. **Check**: Network tab shows WS connection
5. **Test**: Add comment and verify in second browser
6. **Celebrate**: It works! 🎉

---

**Most Common Problem**: Forgetting to run the server! Make sure you see:
```
[1] 🚀 Socket.IO server running on http://localhost:3001
```

If you only see the Vite server starting, the Socket.IO server didn't start. Check for errors in the output.
