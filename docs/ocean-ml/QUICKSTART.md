# Ocean-ML Quick Start Guide

Get up and running with Ocean-ML in DataApp in 5 minutes.

## TL;DR

```bash
# Terminal 1: Start Ocean-ML Backend
cd "Ocean-ML/backend"
.\venv\Scripts\python.exe main.py

# Terminal 2: Start DataApp
cd DataApp
npm run dev

# Browser: Navigate to
http://localhost:9002
→ Login
→ Click profile → "Data Processing"
```

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] Python 3.9+ installed
- [ ] Supabase account configured
- [ ] `.env.local` in DataApp with Ocean-ML variables
- [ ] `.env` in Ocean-ML backend with Supabase credentials

## Quick Setup

### 1. Configure DataApp (2 minutes)

```bash
cd C:\Users\Christian Abulhawa\DataApp

# Install dependencies (if not done)
npm install

# Add to .env.local:
OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEANML_PROTOCOL=oceanml
```

### 2. Configure Ocean-ML Backend (2 minutes)

```bash
cd "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\03 - Machine Learning\Ocean-ML\backend"

# Install dependencies (if not done)
pip install -r requirements.txt

# Create .env with:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key
CORS_ORIGINS=http://localhost:9002
```

### 3. Start Services (1 minute)

**Terminal 1 - Backend:**
```bash
cd "Ocean-ML/backend"
.\venv\Scripts\python.exe main.py
```

Wait for: `✅ API ready!`

**Terminal 2 - Frontend:**
```bash
cd DataApp
npm run dev
```

Wait for: `✓ Ready in X.Xs`

### 4. Test Integration (1 minute)

1. Open browser: `http://localhost:9002`
2. Login with credentials
3. Click profile picture → **"Data Processing"**
4. Verify you see:
   - Ocean-ML header
   - Videos/Training tabs
   - "No videos found" or video grid

✅ **Success!** Integration is working.

## Common First-Time Issues

### ❌ "Failed to connect to Ocean-ML backend"

**Fix**: Check backend is running on port 8001
```bash
curl http://localhost:8001/health
```

### ❌ "Authentication failed"

**Fix**: Verify Supabase credentials in both `.env` files

### ❌ CORS errors in console

**Fix**: Add `http://localhost:9002` to backend `CORS_ORIGINS`

### ❌ Videos tab is empty

**Fix**: This is normal on first run. Upload test video to see content.

## Next Steps

### Upload Your First Video

Using curl:
```bash
curl -X POST http://localhost:8001/api/videos/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@video.mp4"
```

### Explore Features

- **Videos Tab**: Browse and filter videos
- **Training Tab**: View training runs
- **Annotate**: Click "Annotate" on any video (requires desktop app)

### Read Full Documentation

- [Complete Setup Guide](./SETUP.md) - Detailed installation
- [API Documentation](./API.md) - All endpoints
- [Full Guide](./README.md) - Architecture and troubleshooting

## Environment Variables Reference

### DataApp (.env.local)

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Ocean-ML (required)
OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEANML_PROTOCOL=oceanml
```

### Ocean-ML Backend (.env)

```env
# Supabase (required)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=service_role_key

# Modal (optional - for training)
MODAL_TOKEN_ID=your_token_id
MODAL_TOKEN_SECRET=your_token_secret

# App config
CORS_ORIGINS=http://localhost:9002
PORT=8001
ENVIRONMENT=development
DEBUG=True
```

## URLs Quick Reference

| Service | URL | Description |
|---------|-----|-------------|
| DataApp | http://localhost:9002 | Main application |
| Data Processing | http://localhost:9002/data-processing | Ocean-ML page |
| Backend API | http://localhost:8001 | Ocean-ML backend |
| API Docs | http://localhost:8001/docs | Swagger UI |
| Health Check | http://localhost:8001/health | Backend status |

## File Structure Quick Reference

```
DataApp/
├── src/
│   ├── app/
│   │   ├── data-processing/
│   │   │   └── page.tsx                    # Main Ocean-ML page
│   │   └── api/
│   │       └── ocean-ml/
│   │           └── [...path]/
│   │               └── route.ts            # API proxy
│   └── components/
│       ├── auth/
│       │   └── UserMenu.tsx                # Navigation menu
│       └── ocean-ml/                       # Ocean-ML components
│           ├── OceanMLDashboard.tsx       # Main dashboard
│           ├── VideoLibrary.tsx           # Video grid
│           ├── VideoCard.tsx              # Video card
│           └── TrainingDashboard.tsx      # Training runs
├── .env.local                             # Environment config
└── docs/
    └── ocean-ml/                          # Documentation
        ├── README.md                      # Full guide
        ├── SETUP.md                       # Setup guide
        ├── API.md                         # API docs
        └── QUICKSTART.md                  # This file
```

## API Quick Test

Test the API is working:

```bash
# Health check
curl http://localhost:8001/health

# Get videos (requires auth)
curl http://localhost:9002/api/ocean-ml/videos
```

## Feature Checklist

After setup, verify these features work:

- [ ] Can access Data Processing page
- [ ] Videos tab loads without errors
- [ ] Training tab loads without errors
- [ ] Can filter videos (All/Annotated/Not Annotated)
- [ ] Can click Refresh button
- [ ] No console errors in browser
- [ ] No errors in backend logs

## Development Workflow

Typical development session:

1. Start backend: `python main.py`
2. Start frontend: `npm run dev`
3. Make changes to components in `src/components/ocean-ml/`
4. Frontend auto-reloads on save
5. For backend changes, restart Python server

## Production URLs

When deploying to production, update:

**DataApp .env.production:**
```env
OCEAN_ML_BACKEND_URL=https://api.oceanml.your-domain.com
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=https://api.oceanml.your-domain.com
```

**Ocean-ML backend .env.production:**
```env
CORS_ORIGINS=https://dataapp.your-domain.com
```

## Useful Commands

```bash
# Check if port is in use
netstat -ano | findstr :8001

# Kill process on port
taskkill /PID <PID> /F

# View backend logs with filtering
python main.py | grep ERROR

# Check Next.js build
npm run build

# Type check
npm run typecheck
```

## Getting Help

Issue? Try these in order:

1. Check browser console (F12)
2. Check backend terminal for errors
3. Verify both services are running
4. Review this quickstart
5. Read [Full Documentation](./README.md)
6. Check [Troubleshooting](./README.md#troubleshooting)

## Support Resources

- **Setup Issues**: See [SETUP.md](./SETUP.md)
- **API Questions**: See [API.md](./API.md)
- **Architecture**: See [README.md](./README.md)
- **Integration Details**: See `OCEAN_ML_INTEGRATION.md` (root)

---

**Ready in 5 minutes** | **Last Updated**: January 20, 2025
