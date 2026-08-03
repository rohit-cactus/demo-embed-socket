# 🔴 FIX: Real-Time Sync Not Working? DO THIS NOW

## The Problem

You opened Chrome and Firefox but comments didn't sync. **Why?** The Socket.IO server isn't running!

---

## The Solution (2 minutes)

### Step 1: Kill Old Processes

```bash
# Kill the old npm run dev:all if it's still running
# Look for it and press Ctrl+C

# Or forcefully:
pkill -f "concurrently"
pkill -f "vite"
pkill -f "node.*server"
pkill -f "ts-node"
```

### Step 2: Start Fresh

Open a NEW terminal and run:

```bash
cd /Users/rohit.singh1/development/embed-pdf-viewer/embed-pdf-app
npm run dev:all
```

**Wait for BOTH to start:**

You should see:
```
> concurrently "npm run dev" "npm run dev:server"
[0] 
[0]   VITE v5.1.0  ready in 1023 ms
[0]   
[0]   ➜  local:   http://localhost:5173/
[0]   ➜  press h to show help
[1] 
[1] 🚀 Socket.IO server running on http://localhost:3001
[1] 📡 WebSocket endpoint: ws://localhost:3001
```

**If you DON'T see line [1] with "Socket.IO server":**
- Something went wrong with server startup
- Check for error messages
- Run: `cd server && npm install`

### Step 3: Update App.tsx to Use New Viewer

Edit `src/App.tsx` and find the route for the PDF viewer. Change it to use the new collaborative viewer:

**Option A: Change existing route**
```typescript
// OLD:
// import { CustomViewerTwo } from './pages/CustomViewerTwo'
// <Route path="/viewer" element={<CustomViewerTwo />} />

// NEW:
import { CollaborativeViewerFull } from './pages/CollaborativeViewerFull'
<Route path="/viewer" element={<CollaborativeViewerFull />} />
```

**Option B: Add new route**
```typescript
import { CollaborativeViewerFull } from './pages/CollaborativeViewerFull'

<Route path="/collab" element={<CollaborativeViewerFull />} />
```

### Step 4: Test It Works

1. **Chrome**: Open `http://localhost:5173/collab` (or your route)
2. **Firefox**: Open same URL in new Firefox window
3. **Chrome**: Type your name, add a comment
4. **Firefox**: You should see it appear INSTANTLY! ✨

If comments still don't appear:

```bash
# Check server status
curl http://localhost:3001/health
# Should return: {"status":"ok",...}

# Check if connection issues
# F12 → Network → WS tab
# Should show connection to localhost:3001
```

---

## 🐛 If Still Not Working

### Check 1: Did Both Servers Start?

Look at your terminal output. You need BOTH:

```
[0] VITE v5.1.0 ready      ← Client running ✅
[1] 🚀 Socket.IO server    ← Server running ✅
```

If you only see [0], server didn't start. Look for error messages below.

### Check 2: Check Server Startup Error

If server didn't start, look for messages like:

```
[1] Error: EADDRINUSE
[1] Error: Cannot find module
[1] Error: ENOENT
```

**Solutions:**

```bash
# Port already in use
lsof -i :3001
kill -9 <PID>

# Missing dependencies
cd embed-pdf-app/server
npm install

# TypeScript issues
npm run build
```

### Check 3: Browser Connection Error

Open Browser DevTools (F12) and paste this in Console:

```javascript
const socket = io('http://localhost:3001', { 
  query: { userId: Math.random().toString(), userName: 'Test' } 
})
socket.on('connect', () => console.log('✅ CONNECTED'))
socket.on('error', err => console.log('❌ ERROR:', err))
```

What you see tells you what's wrong:
- ✅ CONNECTED = Everything works!
- ❌ ERROR = Check error message
- Nothing = Timeout (server not responding)

### Check 4: Verify Data Persistence

After adding a comment, check if it was saved:

```bash
cat server/data/persistence.json
```

You should see your comment data inside. If empty, comments aren't syncing to server.

---

## ✅ Verification Checklist

Before saying "it's broken":

- [ ] Both servers started? (`npm run dev:all` shows both)
- [ ] Client running? (Can access `http://localhost:5173`)
- [ ] Server running? (`curl http://localhost:3001/health` returns JSON)
- [ ] Using new viewer? (`CollaborativeViewerFull` not old `CollaborativeViewer`)
- [ ] WebSocket connected? (F12 → Network → WS tab shows connection)
- [ ] Waited 2+ seconds? (Socket connection takes time)
- [ ] Different browser windows? (Not same tab)
- [ ] Different usernames? (Makes testing easier to see)
- [ ] Checking right place? (Comments sidebar on right)

---

## 🚨 Most Common Issues

### Issue 1: "Comments not appearing"
**Cause**: Server not running
**Check**: `curl http://localhost:3001/health`
**Fix**: `npm run dev:all`

### Issue 2: "WebSocket connection fails"
**Cause**: Port 3001 not listening
**Check**: `lsof -i :3001`
**Fix**: Kill old process, restart

### Issue 3: "Only see one browser syncing"
**Cause**: Using same tab, or same username
**Fix**: Open two different browsers/tabs with different names

### Issue 4: "Server starts but comments don't sync"
**Cause**: Client not sending events properly
**Check**: Open F12, see if WebSocket is green
**Fix**: Hard refresh (Cmd+Shift+R)

---

## 🔧 Nuclear Option (Start Completely Fresh)

If nothing works:

```bash
# Kill everything
pkill -f "npm"
pkill -f "node"
pkill -f "vite"

# Clear data
rm server/data/persistence.json
echo '{"documents":{}}' > server/data/persistence.json

# Reinstall
cd embed-pdf-app
npm install
cd server
npm install
cd ..

# Start fresh
npm run dev:all

# Wait 5 seconds for both to start
# Then test again
```

---

## ✨ If It Works Now

Great! You should see:
1. Comments in Chrome appear in Firefox instantly
2. Refresh page → Comments still there
3. Close server → Comments persist in file
4. Restart server → Comments back again

---

## 📞 Last Resort

If STILL not working, give me:

1. Full output from `npm run dev:all` (all error messages)
2. Output from `curl http://localhost:3001/health`
3. Browser console errors (F12 → Console)
4. What you see in the comments sidebar
5. Whether WebSocket shows in Network tab

But 99% of the time, it's just that **the server isn't running**!

---

## 🎯 Next Steps After It Works

1. Test with your Manager and team
2. Check comments persist (refresh page, restart server)
3. Try on different network (share local IP)
4. When ready, deploy to production (see README-realtime-collaboration.md)

---

**You're this close! The fix is literally just: `npm run dev:all` and wait for BOTH servers to start! 🚀**
