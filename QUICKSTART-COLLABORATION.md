# 🚀 Quick Start: Real-Time Collaboration

## Get Started in 3 Commands

```bash
# 1. Setup (one-time)
./setup-collaboration.sh

# 2. Start server + client
npm run dev:all

# 3. Open browser
# Navigate to http://localhost:5173
```

---

## 🌐 Share with Team

After starting the server, share your local IP:

```bash
# Find your IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# Share this URL with team:
http://YOUR-IP:5173
```

Example: `http://192.168.1.100:5173`

---

## ✅ Features Working Now

- ✅ Real-time annotation sync
- ✅ Live comment threads
- ✅ Multi-user presence indicators
- ✅ Auto-save to JSON files
- ✅ Instant updates (no refresh needed)

---

## 🎯 Test It Now!

1. **Open 2 browser windows**
   - Chrome normal + Incognito
   - Or Chrome + Firefox

2. **Try these actions:**
   - Add a highlight → See it appear in both windows
   - Create a comment → Other user sees it instantly
   - Reply to comment → Everyone gets the update
   - See user avatars at the top

3. **Check persistence**
   ```bash
   cat server/data/persistence.json | jq
   ```

---

## 🐛 Troubleshooting

### Server won't start?
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill process if needed
kill -9 <PID>
```

### Changes not syncing?
```bash
# Check server status
curl http://localhost:3001/health

# Should return: {"status":"ok",...}
```

### Need to reset data?
```bash
# Clear all collaboration data
rm server/data/persistence.json
echo '{"documents":{}}' > server/data/persistence.json
```

---

## 📦 File Locations

```
server/
├── data/
│   ├── persistence.json    # ← All data saved here
│   └── backups/             # ← Auto-backups
├── src/
│   ├── index.ts            # ← Server code
│   └── persistence.ts      # ← File I/O logic

src/
├── hooks/
│   └── useCollaboration.ts # ← Client socket hook
└── pages/
    └── CollaborativeViewer.tsx # ← Example usage
```

---

## 🔧 Deploy to Production

### Quick Deploy to Render.com (Free)

1. Push code to GitHub
2. Create account at [render.com](https://render.com)
3. New Web Service → Connect repo
4. Build: `npm install`
5. Start: `npm start`
6. Done! Get your URL

### Update Client

```bash
# Create .env.production
echo "VITE_SOCKET_URL=https://your-app.onrender.com" > .env.production

# Build and deploy
npm run build
# Upload dist/ to any static host
```

---

## 📊 Monitor Active Users

```bash
# Check active connections
curl http://localhost:3001/api/documents

# Response shows active documents and users
```

---

## 🎓 Next Steps

1. Read `README-realtime-collaboration.md` for full docs
2. Check `INTEGRATION-GUIDE.md` for migration steps
3. Ask team to test with you!

---

## 💡 Tips

- **Data persists in JSON** - No database needed
- **Auto-backups** - Last 5 versions kept
- **Works offline** - Reconnects automatically
- **No conflicts** - Last edit wins

---

**Questions? Check the full README or ask in Slack!**
