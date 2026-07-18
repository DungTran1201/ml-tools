# Codespaces & Local Development Configuration Guide

## 📋 Overview

This guide provides a complete setup for running your full-stack application in both **GitHub Codespaces** and **local environments** without conflicts.

## 🎯 Key Concepts

### Environment Detection

Your application automatically detects the environment:

- **Local**: `localhost:port`
- **Codespaces**: `https://<codespace-name>-port.app.github.dev`

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│        GitHub Codespaces Secure Proxy                   │
│  https://<codespace-name>-5173.app.github.dev           │
└─────────────────────────────────────────────────────────┘
           ↓ (HMR via WSS)
┌─────────────────────────────────────────────────────────┐
│        Vite Dev Server (5173)                           │
│        - Auto-detects Codespaces                        │
│        - Proxies API to backend                         │
│        - Handles CORS                                   │
└─────────────────────────────────────────────────────────┘
           ↓ (API calls via HTTPS)
┌─────────────────────────────────────────────────────────┐
│        Backend API (5000)                               │
│        - Express/Flask with CORS middleware             │
│        - Validates allowed origins dynamically          │
│        - Works in both environments                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Local Development

```bash
# Terminal 1: Frontend
cd frontend
npm install
npm run dev
# Access at: http://localhost:5173

# Terminal 2: Backend (Node.js)
cd backend
npm install
npm start
# Listens on: http://localhost:5000

# Terminal 3: Backend (Python)
cd backend
pip install -r requirements.txt
python server.py
# Listens on: http://localhost:5000
```

### GitHub Codespaces

1. Click **"Code"** → **"Codespaces"** → **"Create codespace on main"**
2. Wait for the environment to initialize (post-create script runs automatically)
3. Open the ports panel to access your apps:
   - **Frontend**: `https://<codespace-name>-5173.app.github.dev`
   - **Backend**: `https://<codespace-name>-5000.app.github.dev`

---

## 📁 File Structure

```
ml-tools/
├── .devcontainer/
│   ├── devcontainer.json       # Codespaces config
│   └── post-create.sh          # Setup script
├── frontend/
│   ├── .env.local              # Local frontend config
│   ├── .env.codespaces         # Codespaces template
│   ├── .env.example            # Template
│   ├── vite.config.ts          # ✅ Updated with Codespaces support
│   ├── package.json
│   └── src/
│       ├── config/
│       │   └── api.ts          # ✅ Dynamic API configuration
│       └── services/
│           ├── api-client.ts   # ✅ Axios-based client
│           └── fetch-api-client.ts # ✅ Fetch-based alternative
└── backend/
    ├── .env.local              # Local backend config
    ├── .env.example            # Template
    ├── server-cors-example.ts  # ✅ Express CORS setup
    └── server-cors-example.py  # ✅ Flask CORS setup
```

---

## 🔧 Configuration Files

### Frontend `.env.local` (Local Development)

```env
VITE_API_URL=http://localhost:5000
VITE_API_PORT=5000
VITE_FRONTEND_PORT=5173
```

### Frontend `.env.codespaces` (Codespaces Template)

```env
VITE_API_URL=https://${CODESPACE_NAME}-5000.app.github.dev
VITE_API_PORT=5000
VITE_FRONTEND_PORT=5173
VITE_ENV=codespaces
```

### Backend `.env.local` (Local Development)

```env
PORT=5000
VITE_FRONTEND_PORT=5173
NODE_ENV=development
DEBUG=true
```

---

## 💻 Frontend Implementation

### 1. Use Dynamic API Configuration

In your React components:

```typescript
import { apiClient } from '@/services/api-client';

function MyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Works in both local and Codespaces!
    apiClient.get('/api/data').then(setData);
  }, []);

  return <div>{JSON.stringify(data)}</div>;
}
```

### 2. Vite Configuration Highlights

- **HMR (Hot Module Replacement)**: Configured for WSS (secure WebSocket) in Codespaces
- **API Proxy**: `/api/*` requests are proxied to the backend
- **Allowed Hosts**: Automatically allows `.app.github.dev` domains

```typescript
server: {
  hmr: isCodespaces() ? {
    protocol: 'wss',
    host: `${process.env.CODESPACE_NAME}-5173.app.github.dev`,
    port: 443,
  } : undefined,
  proxy: {
    '/api': {
      target: getBackendUrl(),
      changeOrigin: true,
      secure: isCodespaces(),
    },
  },
  allowedHosts: isCodespaces() ? [`.app.github.dev`] : ['localhost'],
}
```

---

## 🗄️ Backend Implementation

### Express.js (Node.js)

```typescript
import cors from 'cors';

const getAllowedOrigins = () => {
  if (process.env.CODESPACE_NAME) {
    const port = process.env.VITE_FRONTEND_PORT || '5173';
    return [`https://${process.env.CODESPACE_NAME}-${port}.app.github.dev`];
  }
  return ['http://localhost:5173'];
};

app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
}));
```

### Flask (Python)

```python
from flask_cors import CORS

def get_allowed_origins():
    if os.getenv('CODESPACE_NAME'):
        port = os.getenv('VITE_FRONTEND_PORT', '5173')
        return [f"https://{os.getenv('CODESPACE_NAME')}-{port}.app.github.dev"]
    return ['http://localhost:5173']

CORS(app, origins=get_allowed_origins(), supports_credentials=True)
```

---

## ✅ Verification Checklist

- [ ] Frontend `.env.local` exists with correct local settings
- [ ] Backend `.env.local` exists with correct local settings
- [ ] Vite config uses `getBackendUrl()` function
- [ ] Backend has CORS middleware configured
- [ ] Frontend uses `apiClient` or `fetchApiClient` for API calls
- [ ] `.devcontainer/devcontainer.json` exists
- [ ] `.devcontainer/post-create.sh` is executable
- [ ] Both frontend and backend run locally on `localhost`
- [ ] Ports 5173 (frontend) and 5000 (backend) are available

---

## 🐛 Troubleshooting

### Issue: CORS errors in Codespaces

**Solution**: Ensure the backend is listening on `0.0.0.0` (all interfaces):

```typescript
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Issue: Frontend can't connect to backend

**Solution**: Check that:
1. Backend is running: `curl https://<codespace-name>-5000.app.github.dev/api/health`
2. CORS origins include the frontend URL
3. API URL is correctly set in the frontend environment

### Issue: HMR (hot reload) not working in Codespaces

**Solution**: Ensure `vite.config.ts` has:

```typescript
hmr: {
  protocol: 'wss',
  host: `${process.env.CODESPACE_NAME}-5173.app.github.dev`,
  port: 443,
}
```

### Issue: Environment variables not loading

**Solution**: Make sure to:
1. Create `.env.local` (not `.env`)
2. Restart the Vite dev server after changing `.env` files
3. Use `import.meta.env.VITE_*` in the frontend (only variables prefixed with `VITE_` are exposed)

---

## 📚 Additional Resources

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Vite Server Options](https://vitejs.dev/config/server-options.html)
- [GitHub Codespaces Documentation](https://docs.github.com/en/codespaces)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://github.com/expressjs/cors)
- [Flask CORS Extension](https://github.com/corydolphin/flask-cors)

---

## 🎓 Key Takeaways

1. **Environment variables** (`CODESPACE_NAME`) automatically detect the environment
2. **Vite's dev server proxy** handles API routing locally
3. **Backend CORS configuration** validates origins dynamically
4. **No code changes needed** – same code works in both environments
5. **100% backward compatible** – local development unaffected

