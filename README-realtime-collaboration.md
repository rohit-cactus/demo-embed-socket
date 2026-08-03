# Real-Time PDF Collaboration System

This document explains how to set up and use the real-time collaboration features in the embed-pdf-viewer application.

## 🎯 Overview

This system adds **real-time collaboration** to the PDF viewer, allowing multiple users (Manager, Reviewers) to:
- ✅ View PDF documents simultaneously
- ✅ Add annotations and highlights
- ✅ Create and reply to comment threads
- ✅ See each other's cursors and presence
- ✅ All data persists to JSON files (no database required!)

## 📦 Architecture

```
┌─────────────┐     ┌─────────────┐
│  Browser 1  │     │  Browser 2  │
│  (Manager)   │     │ (Reviewer)  │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └───────┬───────────┘
               │
        ┌──────▼───────┐
        │  Socket.IO   │
        │   Server     │
        │  (Port 3001) │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │  JSON Files  │
        │ (data/*.json)│
        └──────────────┘
```

---

## 🚀 Quick Start (Get Running TODAY)

### Step 1: Install Server Dependencies

```bash
cd embed-pdf-app/server
npm install
```

### Step 2: Install Client Dependencies

```bash
cd embed-pdf-app
npm install
```

### Step 3: Start Both Server and Client

**Option A: Run both with one command (Recommended)**
```bash
cd embed-pdf-app
npm run install:server  # First time only
npm run dev:all
```

This starts:
- **Vite dev server**: `http://localhost:5173`
- **Socket.IO server**: `http://localhost:3001`

**Option B: Run separately**
```bash
# Terminal 1 - Start the collaboration server
cd embed-pdf-app/server
npm run dev

# Terminal 2 - Start the client
cd embed-pdf-app
npm run dev
```

### Step 4: Share with Team

1. Open `http://localhost:5173` in your browser
2. Share your local IP (e.g., `http://192.168.1.100:5173`) with team members
3. Everyone can now collaborate in real-time!

---

## 📂 File Structure

```
embed-pdf-app/
├── server/                    # Socket.IO server
│   ├── src/
│   │   ├── index.ts         # Main server entry
│   │   ├── persistence.ts   # File-based data persistence
│   │   └── types.ts         # TypeScript types
│   ├── data/                # JSON data storage
│   │   ├── persistence.json
│   │   └── backups/         # Auto-backups
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── hooks/
│   │   └── useCollaboration.ts  # Socket.IO React hook
│   ├── components/
│   │   └── UserPresence.tsx     # User avatars & presence
│   └── pages/
│       ├── CollaborativeViewer.tsx  # New collaborative viewer
│       └── CustomViewerTwo.tsx      # Original viewer (localStorage)
└── package.json
```

---

## 🔧 Configuration

### Environment Variables (Optional)

Create a `.env` file in `embed-pdf-app/`:

```env
VITE_SOCKET_URL=http://localhost:3001
```

For production, set this to your deployed server URL:
```env
VITE_SOCKET_URL=https://your-domain.com
```

---

## 📊 Data Persistence

All collaboration data is saved to JSON files:

### `server/data/persistence.json`
```json
{
  "documents": {
    "ebook-sample": {
      "annotations": [
        {
          "annotation": {
            "id": "uuid",
            "pageIndex": 0,
            "rect": { "origin": { "x": 100, "y": 100 }, "size": { "width": 50, "height": 20 } },
            "created": 1234567890
          }
        }
      ],
      "threads": [
        {
          "id": "uuid",
          "annotationId": "uuid",
          "quote": "Selected text",
          "messages": [
            {
              "id": "uuid",
              "authorName": "Reviewer",
              "text": "Comment text",
              "createdAt": 1234567890
            }
          ]
        }
      ],
      "lastModified": 1234567890
    }
  }
}
```

### Automatic Backups
- Every save creates a timestamped backup in `server/data/backups/`
- Keeps the last 5 backups automatically
- Manual backup: copy `persistence.json` file

---

## 🌐 Deployment Guide

### Option 1: Heroku (Recommended for Quick Deploy)

#### 1. Deploy Server to Heroku

```bash
# Create Heroku app
heroku create embed-pdf-server

# Add Node.js buildpack
heroku buildpacks:set heroku/nodejs

# Deploy
cd server
git init
git add .
git commit -m "Initial deploy"
heroku git:remote -a embed-pdf-server
git push heroku master

# Note the URL: https://embed-pdf-server.herokuapp.com
```

#### 2. Update Client Environment

Create `.env.production`:
```env
VITE_SOCKET_URL=https://embed-pdf-server.herokuapp.com
```

#### 3. Deploy Client to Vercel/Netlify

```bash
npm run build

# Deploy to Vercel
vercel

# Or Netlify
netlify deploy
```

---

### Option 2: Railway.app (Easier, $5/month)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy server
cd server
railway init
railway up

# Note the URL
railway status

# Update VITE_SOCKET_URL and deploy client
cd ..
npm run build
# Upload dist/ folder to any static host
```

---

### Option 3: Render.com (Free Tier)

1. Create account at [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Get URL and update `VITE_SOCKET_URL`

---

### Option 4: Self-Hosted (VPS/Dedicated Server)

#### 1. Set up server

```bash
# SSH into server
ssh user@your-server.com

# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repo
git clone your-repo-url
cd embed-pdf-viewer/embed-pdf-app/server
npm install
npm run build

# Start with PM2 (keeps server running)
sudo npm install -g pm2
pm2 start dist/index.js --name embed-pdf-server
pm2 startup
pm2 save
```

#### 2. Configure nginx (Port 80/443)

```nginx
# /etc/nginx/sites-available/embed-pdf
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/embed-pdf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 3. Deploy client

```bash
# Update .env.production
echo "VITE_SOCKET_URL=https://your-domain.com" > .env.production

# Build
npm run build

# Upload dist/ to server via scp/rsync
scp -r dist/ user@your-server.com:/var/www/html/
```

---

## 🧪 Testing Locally

### 1. Open Multiple Browser Windows

Open `http://localhost:5173` in 2-3 different browser windows:
- Chrome incognito tabs
- Firefox + Chrome
- Different browsers

### 2. Test Real-Time Features

1. **Annotations**: Add highlights/underlines - see them sync instantly
2. **Comments**: Create comment threads - others see them immediately
3. **Replies**: Reply to comments - everyone gets notified
4. **Presence**: See user avatars at the top showing who's viewing

### 3. Check Data Persistence

```bash
# View persisted data
cat server/data/persistence.json | jq

# List backups
ls -la server/data/backups/
```

---

## 🔒 Security Considerations

### For Production:

1. **Add Authentication**
   ```typescript
   // server/src/index.ts
   io.use((socket, next) => {
     const token = socket.handshake.auth.token;
     // Verify token with your auth system
     if (isValidToken(token)) {
       next();
     } else {
       next(new Error('Authentication failed'));
     }
   });
   ```

2. **Enable CORS Restrictions**
   ```typescript
   io = new Server(httpServer, {
     cors: {
       origin: ['https://your-domain.com'],
       methods: ['GET', 'POST'],
       credentials: true,
     },
   });
   ```

3. **Add Rate Limiting**
   ```bash
   npm install socket.io-rate-limiter
   ```

4. **Data Encryption**
   - Encrypt sensitive data in JSON files
   - Use HTTPS for all connections
   - Secure the `data/` directory (chmod 700)

---

## 📝 API Reference

### Socket.IO Events

#### Client → Server
```typescript
socket.emit('joinDocument', { documentId, userId, userName })
socket.emit('leaveDocument', { documentId, userId })
socket.emit('createAnnotation', { documentId, annotation })
socket.emit('updateAnnotation', { documentId, annotationId, updates })
socket.emit('deleteAnnotation', { documentId, pageIndex, annotationId })
socket.emit('createThread', { documentId, thread })
socket.emit('addReply', { documentId, threadId, message })
socket.emit('updateCursor', { documentId, userId, cursor })
```

#### Server → Client
```typescript
socket.on('documentState', ({ annotations, threads, users }) => {})
socket.on('annotationCreated', ({ annotation, userId }) => {})
socket.on('annotationUpdated', ({ annotationId, updates, userId }) => {})
socket.on('annotationDeleted', ({ pageIndex, annotationId, userId }) => {})
socket.on('threadCreated', ({ thread, userId }) => {})
socket.on('replyAdded', ({ threadId, message, userId }) => {})
socket.on('userJoined', ({ user }) => {})
socket.on('userLeft', ({ userId }) => {})
socket.on('cursorUpdated', ({ userId, cursor }) => {})
socket.on('error', (message) => {})
```

---

## 🐛 Troubleshooting

### "Connection Error" in Browser

1. **Check if server is running**
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"ok","documents":0,"connections":0}
   ```

2. **Check VITE_SOCKET_URL**
   ```bash
   echo $VITE_SOCKET_URL  # Should be http://localhost:3001
   ```

3. **Check browser console**
   - Open DevTools → Console
   - Look for Socket.IO connection errors

### Changes Not Persisting

1. **Check data directory permissions**
   ```bash
   ls -la server/data/
   # Should be writable
   ```

2. **Check persistence.json format**
   ```bash
   cat server/data/persistence.json
   # Should be valid JSON
   ```

### Multi-User Sync Issues

1. **Refresh page** - Socket will reconnect
2. **Check browser network tab** - WebSocket should show green status
3. **Verify same documentId** - All users must join the same documentId

---

## 🎓 Next Steps

1. **Migrate CustomViewerTwo**
   - Replace localStorage with Socket.IO calls
   - Use the new `useCollaboration` hook

2. **Add Features**
   - User authentication
   - Document permissions
   - Version history
   - Export/import with comments

3. **Optimize for Production**
   - Add Redis for scaling
   - Implement message queuing
   - Add CDN for static assets

---

## 📞 Support

If you encounter any issues:

1. Check `server/data/persistence.json` for data integrity
2. Restart both server and client
3. Check browser console for errors
4. Verify Socket.IO connection in Network tab

---

## 📄 License

MIT License - Feel free to use and modify!

---

**🎉 You're all set! Your PDF collaboration system is ready to use.**
