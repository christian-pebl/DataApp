# Ocean-ML Integration Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Components Guide](#components-guide)
5. [API Reference](#api-reference)
6. [Development Guide](#development-guide)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

## Overview

Ocean-ML is a collaborative fish detection and annotation platform integrated into the DataApp ecosystem. This integration allows users to:

- Upload and manage underwater video footage
- Collaboratively annotate fish detections in videos
- Train custom YOLO object detection models
- Run inference on new videos
- Track training metrics and model performance

### Key Features

- **Video Library**: Upload, browse, and filter underwater videos
- **Collaborative Annotation**: Lock-based system prevents conflicts
- **Desktop Integration**: Launch native annotation app via protocol handler
- **Model Training**: Train YOLOv8/YOLOv11 models on annotated data
- **Real-time Progress**: WebSocket-based training progress updates
- **Shared Authentication**: Seamless integration with DataApp's Supabase auth

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Browser                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              DataApp Frontend (Next.js)                    │ │
│  │                                                            │ │
│  │  Routes:                                                   │ │
│  │  - /data-processing → Ocean-ML Dashboard                  │ │
│  │  - /api/ocean-ml/* → API Proxy                           │ │
│  │                                                            │ │
│  │  Components:                                               │ │
│  │  - OceanMLDashboard                                       │ │
│  │  - VideoLibrary                                           │ │
│  │  - TrainingDashboard                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              │ HTTP Requests                    │
│                              │ (/api/ocean-ml/*)               │
│                              ▼                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Next.js API Proxy                             │ │
│  │                                                            │ │
│  │  - Intercepts /api/ocean-ml/* requests                    │ │
│  │  - Extracts Supabase auth token from session              │ │
│  │  - Forwards to Ocean-ML backend with auth header          │ │
│  │  - Returns response to frontend                           │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              │ HTTP + Bearer Token
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           Ocean-ML Backend (FastAPI + Python)                   │
│                                                                 │
│  API Endpoints:                                                 │
│  - /api/videos           - Video management                    │
│  - /api/annotations      - Annotation CRUD                     │
│  - /api/training         - Model training                      │
│  - /api/inference        - Model inference                     │
│  - /ws/training/{id}     - WebSocket for training updates      │
│                                                                 │
│  Services:                                                      │
│  - Supabase Storage      - Video/model file storage           │
│  - Modal Labs            - GPU compute for training/inference  │
│  - PostgreSQL            - Metadata storage                    │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────┐                  ┌──────────┐                ┌────────────┐
│ User │                  │ Frontend │                │ Next.js    │
│      │                  │ (React)  │                │ API Proxy  │
└──┬───┘                  └────┬─────┘                └─────┬──────┘
   │                           │                            │
   │ 1. Login with Supabase    │                            │
   │───────────────────────────>                            │
   │                           │                            │
   │ 2. Session established    │                            │
   │<───────────────────────────                            │
   │                           │                            │
   │ 3. Request video list     │                            │
   │───────────────────────────>                            │
   │                           │                            │
   │                           │ 4. GET /api/ocean-ml/videos│
   │                           │────────────────────────────>
   │                           │                            │
   │                           │    5. Extract session token│
   │                           │    6. Forward to backend   │
   │                           │                  with Bearer token
   │                           │                            │
   │                           │ 7. Response with videos    │
   │                           │<────────────────────────────
   │                           │                            │
   │ 8. Display videos         │                            │
   │<───────────────────────────                            │
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Supabase account with configured project
- Modal Labs account (for training/inference)

### Installation

#### 1. DataApp Frontend Setup

```bash
cd C:\Users\Christian Abulhawa\DataApp

# Install dependencies (already includes @tanstack/react-query)
npm install

# Configure environment variables
# Edit .env.local and add:
OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEANML_PROTOCOL=oceanml
```

#### 2. Ocean-ML Backend Setup

```bash
cd "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\03 - Machine Learning\Ocean-ML\backend"

# Create virtual environment (if not exists)
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# Create/edit .env file:
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
MODAL_TOKEN_ID=your_modal_token_id
MODAL_TOKEN_SECRET=your_modal_token_secret
```

#### 3. Supabase Configuration

Create required storage buckets:

```sql
-- Videos bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('Videos', 'Videos', true);

-- Models bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', false);
```

Apply storage policies (see `docs/storage-policies.sql`).

### Running the Application

#### Terminal 1: Start Ocean-ML Backend

```bash
cd "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\03 - Machine Learning\Ocean-ML\backend"
.\venv\Scripts\python.exe main.py
```

Expected output:
```
🚀 Ocean-ML API starting...
📍 Environment: development
🔧 Debug mode: True
🌐 CORS origins: [...]
✅ API ready!
INFO:     Uvicorn running on http://0.0.0.0:8001
```

#### Terminal 2: Start DataApp Frontend

```bash
cd C:\Users\Christian Abulhawa\DataApp
npm run dev
```

Expected output:
```
▲ Next.js 15.2.3
- Local:        http://localhost:9002
- Network:      http://192.168.x.x:9002

✓ Ready in 2.5s
```

#### Access the Application

1. Open browser: `http://localhost:9002`
2. Login with your credentials
3. Click profile picture → **Data Processing**
4. You should see the Ocean-ML dashboard

## Components Guide

### OceanMLDashboard

Main container component with tabbed interface.

**Location**: `src/components/ocean-ml/OceanMLDashboard.tsx`

**Features**:
- Tabbed interface (Videos, Training)
- React Query provider integration
- PEBL branding

**Usage**:
```tsx
import OceanMLDashboard from '@/components/ocean-ml/OceanMLDashboard'

export default function DataProcessingPage() {
  return <OceanMLDashboard />
}
```

### VideoLibrary

Displays grid of video cards with filtering.

**Location**: `src/components/ocean-ml/VideoLibrary.tsx`

**Features**:
- Filter by: All / Annotated / Not Annotated
- Real-time refresh
- Grid layout (responsive)
- Loading/error states

**API Integration**:
```typescript
// Fetches from /api/ocean-ml/videos
const { data, isLoading } = useQuery({
  queryKey: ['ocean-ml-videos', filter],
  queryFn: async () => {
    const response = await fetch('/api/ocean-ml/videos')
    return response.json()
  }
})
```

### VideoCard

Individual video card component.

**Location**: `src/components/ocean-ml/VideoCard.tsx`

**Features**:
- Thumbnail display
- Video metadata (size, duration, upload date)
- Annotation status badge
- Annotate button (launches desktop app)
- View annotations button (for completed videos)

**Props**:
```typescript
interface VideoCardProps {
  video: {
    id: string
    filename: string
    annotated: boolean
    detection_count: number
    locked_by?: string
    // ... more fields
  }
  onUpdate: () => void
}
```

### TrainingDashboard

Displays training runs and completed models.

**Location**: `src/components/ocean-ml/TrainingDashboard.tsx`

**Features**:
- Active training runs with progress bars
- Completed models with metrics
- Auto-refresh every 5 seconds
- Model performance display (mAP, training time, cost)

**API Integration**:
```typescript
const { data: trainingRuns } = useQuery({
  queryKey: ['ocean-ml-training-runs'],
  queryFn: async () => {
    const response = await fetch('/api/ocean-ml/training/runs')
    return response.json()
  },
  refetchInterval: 5000 // Auto-refresh
})
```

## API Reference

### Proxy Endpoints

All Ocean-ML backend endpoints are accessible via `/api/ocean-ml/*`.

#### Videos

**GET /api/ocean-ml/videos**

Get list of videos.

Query Parameters:
- `annotated` (boolean, optional): Filter by annotation status

Response:
```json
{
  "videos": [
    {
      "id": "uuid",
      "filename": "video.mp4",
      "storage_path": "path/to/video",
      "annotated": false,
      "detection_count": 0,
      "uploaded_at": "2025-01-20T12:00:00Z"
    }
  ]
}
```

**GET /api/ocean-ml/videos/{id}**

Get single video details.

**POST /api/ocean-ml/videos/upload**

Upload new video (multipart/form-data).

#### Annotations

**GET /api/ocean-ml/annotations/{video_id}**

Get annotations for a video.

**POST /api/ocean-ml/annotations/annotate/{video_id}**

Acquire lock to annotate video.

Request:
```json
{
  "timeout_minutes": 60
}
```

Response:
```json
{
  "success": true,
  "lock_id": "uuid",
  "expires_at": "2025-01-20T13:00:00Z"
}
```

**POST /api/ocean-ml/annotations/submit**

Submit annotations from desktop app.

#### Training

**GET /api/ocean-ml/training/runs**

Get all training runs.

Response:
```json
[
  {
    "id": "uuid",
    "model_type": "yolov8n",
    "epochs": 100,
    "status": "training",
    "current_epoch": 45,
    "map50": 0.85,
    "started_at": "2025-01-20T10:00:00Z"
  }
]
```

**POST /api/ocean-ml/training/start**

Start new training run.

Request:
```json
{
  "model_type": "yolov8n",
  "epochs": 100,
  "batch_size": 16,
  "image_size": 640
}
```

**GET /ws/training/{run_id}**

WebSocket endpoint for real-time training updates.

Messages:
```json
{
  "type": "training_update",
  "status": "training",
  "progress": 45,
  "message": "Epoch 45/100",
  "metrics": {
    "epoch": 45,
    "loss": 0.123
  }
}
```

#### Inference

**POST /api/ocean-ml/inference/start**

Start inference on a video.

Request:
```json
{
  "video_id": "uuid",
  "model_id": "uuid",
  "confidence_threshold": 0.25,
  "iou_threshold": 0.45
}
```

**GET /api/ocean-ml/inference/{run_id}**

Get inference run status and results.

### Authentication

All API requests automatically include authentication via the Next.js proxy:

```typescript
// Frontend code (authentication handled automatically)
const response = await fetch('/api/ocean-ml/videos')

// Proxy adds this header automatically:
// Authorization: Bearer <supabase_access_token>
```

## Development Guide

### Adding New Components

1. Create component in `src/components/ocean-ml/`
2. Use DataApp's UI components from `@/components/ui`
3. Use React Query for data fetching
4. Follow existing patterns for authentication

Example:
```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'

export default function MyComponent() {
  const { data } = useQuery({
    queryKey: ['my-data'],
    queryFn: async () => {
      const response = await fetch('/api/ocean-ml/my-endpoint')
      return response.json()
    }
  })

  return <Card>{/* Component content */}</Card>
}
```

### Styling Guidelines

Use DataApp's existing design system:

- **Colors**: Use `primary`, `secondary`, `muted`, `destructive` from theme
- **Components**: Import from `@/components/ui/*`
- **Typography**: Use Tailwind classes with PEBL fonts
- **Spacing**: Use Tailwind spacing scale

### Testing

#### Frontend Testing

```bash
# Run Next.js dev server
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

#### Backend Testing

```bash
cd backend

# Run tests
pytest

# Test specific endpoint
curl http://localhost:8001/api/videos
```

#### Integration Testing

1. Start both services
2. Login to DataApp
3. Navigate to Data Processing
4. Verify:
   - Videos load correctly
   - Training runs display
   - Authentication works
   - Error states handle gracefully

### Debugging

#### Enable API Logging

In `src/app/api/ocean-ml/[...path]/route.ts`, logs are automatically written:

```typescript
console.log(`[Ocean-ML Proxy] ${method} ${fullUrl}`)
```

Check browser console and Next.js server logs.

#### Common Issues

**Videos not loading**:
1. Check Ocean-ML backend is running: `http://localhost:8001/health`
2. Check browser Network tab for failed requests
3. Verify CORS settings in Ocean-ML backend
4. Check Supabase authentication

**Authentication errors**:
1. Verify Supabase session: Check Application → Storage → Supabase in DevTools
2. Check token is being sent: Network tab → Headers
3. Verify Ocean-ML backend validates token correctly

**Desktop app not launching**:
1. Check protocol handler is registered
2. Verify `NEXT_PUBLIC_OCEANML_PROTOCOL` environment variable
3. Test protocol manually: `oceanml://annotate?video=test&token=test`

## Deployment

### Production Configuration

#### Environment Variables

**DataApp (.env.production)**:
```env
OCEAN_ML_BACKEND_URL=https://api.oceanml.your-domain.com
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=https://api.oceanml.your-domain.com
NEXT_PUBLIC_OCEANML_PROTOCOL=oceanml
```

**Ocean-ML Backend (.env.production)**:
```env
CORS_ORIGINS=https://dataapp.your-domain.com
SUPABASE_URL=your_production_supabase_url
SUPABASE_KEY=your_production_supabase_key
MODAL_TOKEN_ID=your_production_modal_token
MODAL_TOKEN_SECRET=your_production_modal_secret
```

### Deployment Steps

#### 1. Deploy Ocean-ML Backend

Recommended: Deploy to a service with GPU access (for training/inference)

Options:
- Modal Labs (already integrated)
- AWS EC2 with GPU
- Google Cloud Platform
- Azure

```bash
# Example Docker deployment
cd backend
docker build -t ocean-ml-backend .
docker run -p 8001:8001 --env-file .env.production ocean-ml-backend
```

#### 2. Deploy DataApp Frontend

Deploy to Vercel (recommended for Next.js):

```bash
cd C:\Users\Christian Abulhawa\DataApp

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Configure environment variables in Vercel dashboard.

#### 3. Update CORS

Update Ocean-ML backend to allow production frontend URL:

```python
# backend/main.py
origins = [
    "https://dataapp.your-domain.com",
    "http://localhost:9002"  # Keep for local development
]
```

### Health Checks

Set up monitoring for:

- **DataApp Frontend**: `https://dataapp.your-domain.com`
- **Ocean-ML Backend**: `https://api.oceanml.your-domain.com/health`
- **Supabase**: Check dashboard for database/storage status

## Troubleshooting

### Issue: "Failed to connect to Ocean-ML backend"

**Symptoms**: Videos don't load, error message shown

**Solutions**:
1. Verify backend is running: `curl http://localhost:8001/health`
2. Check `OCEAN_ML_BACKEND_URL` in `.env.local`
3. Check firewall/network settings
4. Review browser console for CORS errors

### Issue: Videos load but thumbnails don't show

**Symptoms**: Video cards display but no thumbnails

**Solutions**:
1. Check Supabase storage bucket permissions
2. Verify `Videos` bucket is public
3. Check video `thumbnail_path` in database
4. Review Supabase storage policies

### Issue: "Not authenticated" error

**Symptoms**: 401 errors when accessing API

**Solutions**:
1. Verify Supabase session exists
2. Check cookie settings (must allow cross-site cookies for local dev)
3. Verify token is valid: Check expiry time
4. Test authentication: Try logging out and back in

### Issue: Desktop app doesn't launch

**Symptoms**: Click "Annotate" but nothing happens

**Solutions**:
1. Install desktop app first
2. Check protocol handler registration:
   - Windows: Check registry `HKEY_CLASSES_ROOT\oceanml`
   - Mac: Check `~/Library/Preferences/`
3. Test protocol: `oceanml://test`
4. Check browser console for errors

### Issue: Training runs don't show progress

**Symptoms**: Training started but progress bar stuck

**Solutions**:
1. Check WebSocket connection in Network tab
2. Verify `WS_URL` configuration
3. Check Ocean-ML backend logs
4. Ensure firewall allows WebSocket connections

### Issue: High latency / slow responses

**Symptoms**: Requests take long time

**Solutions**:
1. Check network connection
2. Verify backend is running locally (not remote)
3. Check database queries performance
4. Review Supabase quotas
5. Monitor backend resource usage

### Getting Help

1. Check this documentation thoroughly
2. Review `OCEAN_ML_INTEGRATION.md` for architecture details
3. Check browser console for errors
4. Review backend logs
5. Check Supabase logs
6. Contact development team with:
   - Error messages (screenshots)
   - Browser console logs
   - Backend logs
   - Steps to reproduce

---

**Last Updated**: January 20, 2025
**Version**: 1.0.0
**Maintained by**: PEBL Development Team
