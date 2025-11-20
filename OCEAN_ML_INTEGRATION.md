# Ocean-ML Integration Guide

## Overview

Ocean-ML has been successfully integrated into the DataApp platform as the **Data Processing** feature. This integration provides collaborative fish detection and annotation capabilities directly within the DataApp ecosystem.

## Architecture

The integration follows a **microservices architecture** with a clear separation between frontend and backend:

```
┌──────────────────────────────────────────────────────────────┐
│                        DataApp Frontend                       │
│                      (Next.js 15 + React)                     │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Data Processing Page (/data-processing)        │ │
│  │                                                         │ │
│  │  - Video Library (Videos Tab)                          │ │
│  │  - Training Dashboard (Training Tab)                   │ │
│  │  - Supabase Authentication (shared)                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                                │
│                              ▼                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Next.js API Proxy (/api/ocean-ml/*)            │ │
│  │                                                         │ │
│  │  - Forwards requests to Ocean-ML backend               │ │
│  │  - Adds Supabase authentication tokens                 │ │
│  │  - Handles CORS and error responses                    │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    Ocean-ML Backend                          │
│                  (Python/FastAPI on port 8001)               │
│                                                               │
│  - Video Management API                                       │
│  - Annotation Processing                                      │
│  - Model Training                                             │
│  - Inference Engine                                           │
│  - Supabase Storage Integration                              │
└──────────────────────────────────────────────────────────────┘
```

## Components Created

### 1. Frontend Components

Located in `src/components/ocean-ml/`:

- **OceanMLDashboard.tsx** - Main dashboard with tabs for Videos and Training
- **VideoLibrary.tsx** - Video management and filtering interface
- **VideoCard.tsx** - Individual video card with annotation controls
- **TrainingDashboard.tsx** - Training runs and model management

### 2. Data Processing Page

- **Location**: `src/app/data-processing/page.tsx`
- **Route**: `/data-processing`
- **Features**:
  - Embedded Ocean-ML dashboard
  - React Query integration for data fetching
  - Connection status monitoring
  - PEBL-themed footer

### 3. API Proxy

- **Location**: `src/app/api/ocean-ml/[...path]/route.ts`
- **Purpose**: Forwards all `/api/ocean-ml/*` requests to the Ocean-ML backend
- **Features**:
  - Automatic authentication token injection
  - Support for all HTTP methods (GET, POST, PUT, DELETE, PATCH)
  - Error handling and logging
  - CORS handling

## Configuration

### Environment Variables

Added to `.env.local`:

```env
# Ocean-ML Configuration
# Backend URL for Ocean-ML Python/FastAPI service
OCEAN_ML_BACKEND_URL=http://localhost:8001

# Frontend configuration (accessible in browser)
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEANML_PROTOCOL=oceanml
```

### Dependencies

Added to `package.json`:

```json
{
  "@tanstack/react-query": "^5.x.x"
}
```

## Navigation Changes

### UserMenu Update

The user dropdown menu (top-right) has been updated:

- **Before**: "Data Explorer" → `/data-explorer`
- **After**: "Data Processing" → `/data-processing`

The "Data Processing" link now directs users to the integrated Ocean-ML interface.

## Authentication Flow

1. User logs in via DataApp's Supabase authentication
2. Supabase session is shared across the application
3. When accessing Ocean-ML features:
   - Frontend makes request to `/api/ocean-ml/*`
   - Next.js proxy extracts Supabase auth token
   - Token is forwarded to Ocean-ML backend as `Authorization: Bearer <token>`
   - Ocean-ML backend validates token with Supabase
   - Response is returned through the proxy to the frontend

## Usage

### For Users

1. **Access Ocean-ML**:
   - Click on your profile picture (top-right)
   - Select "Data Processing" from the dropdown menu
   - You'll be redirected to `/data-processing`

2. **View Videos**:
   - Default tab shows the Video Library
   - Filter by: All, Annotated, or Not Annotated
   - Click "Refresh" to reload the video list

3. **Annotate Videos**:
   - Click "Annotate" on any video card
   - Desktop app will launch via protocol handler (`oceanml://`)
   - Annotation lock is automatically managed

4. **View Training Runs**:
   - Switch to the "Training" tab
   - See active training runs with progress
   - View completed models with metrics

### For Developers

#### Starting the Services

1. **Start Ocean-ML Backend**:
   ```bash
   cd "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\03 - Machine Learning\Ocean-ML\backend"
   ./venv/Scripts/python.exe main.py
   ```
   Backend runs on `http://localhost:8001`

2. **Start DataApp Frontend**:
   ```bash
   cd "C:\Users\Christian Abulhawa\DataApp"
   npm run dev
   ```
   Frontend runs on `http://localhost:9002`

3. **Access the App**:
   - Navigate to `http://localhost:9002`
   - Login with your credentials
   - Go to Data Processing from the user menu

#### API Request Flow Example

```typescript
// Frontend makes a request
const response = await fetch('/api/ocean-ml/videos')

// Next.js proxy receives it and forwards to:
// http://localhost:8001/api/videos
// with Authorization header automatically added

// Ocean-ML backend processes and responds
// Response flows back through proxy to frontend
```

## File Structure

```
DataApp/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── ocean-ml/
│   │   │       └── [...path]/
│   │   │           └── route.ts          # API Proxy
│   │   └── data-processing/
│   │       └── page.tsx                  # Main page
│   └── components/
│       ├── auth/
│       │   └── UserMenu.tsx              # Updated navigation
│       └── ocean-ml/                     # Ocean-ML components
│           ├── OceanMLDashboard.tsx
│           ├── VideoLibrary.tsx
│           ├── VideoCard.tsx
│           └── TrainingDashboard.tsx
├── .env.local                            # Environment config
└── OCEAN_ML_INTEGRATION.md               # This file
```

## Troubleshooting

### Issue: "Failed to connect to Ocean-ML backend"

**Solution**:
1. Verify Ocean-ML backend is running on port 8001
2. Check `OCEAN_ML_BACKEND_URL` in `.env.local`
3. Check browser console for CORS errors
4. Verify Supabase authentication is working

### Issue: Videos not loading

**Solution**:
1. Check Ocean-ML backend logs for errors
2. Verify Supabase buckets are configured correctly
3. Check browser Network tab for failed API requests
4. Ensure user has proper permissions in Supabase

### Issue: Desktop app not launching

**Solution**:
1. Verify desktop app is installed
2. Check `NEXT_PUBLIC_OCEANML_PROTOCOL` environment variable
3. Ensure protocol handler is registered in the OS
4. Try manually navigating to: `oceanml://annotate?video=<id>&token=<token>`

## Future Enhancements

### Planned Features

1. **WebSocket Integration**: Real-time training progress updates
2. **File Upload**: Direct video upload from DataApp interface
3. **Inference Tab**: Run inference on videos with trained models
4. **Model Download**: Download trained models for local use
5. **Analytics Dashboard**: Training and annotation statistics

### Additional Components Needed

- `ModelCard.tsx` - Display individual trained models
- `InferenceModal.tsx` - Configure and run inference
- `TrainingButton.tsx` - Start new training runs
- `AnnotationViewer.tsx` - View and edit annotations

## Maintenance

### Updating Ocean-ML Components

When the Ocean-ML frontend is updated:

1. Copy new components from Ocean-ML's `frontend/src/components/`
2. Adapt them to use DataApp's UI components (shadcn/ui)
3. Update API calls to use `/api/ocean-ml/*` instead of direct backend URLs
4. Test authentication flow
5. Update this documentation

### Backend API Changes

If Ocean-ML backend API changes:

1. No changes needed to the proxy (it forwards all requests)
2. Update frontend components if response format changes
3. Update TypeScript interfaces to match new API structure

## Security Considerations

1. **Authentication**: All API requests require valid Supabase session
2. **Authorization**: Ocean-ML backend validates tokens with Supabase
3. **CORS**: Handled by the Next.js proxy
4. **API Keys**: Never exposed to the frontend
5. **File Access**: Managed through Supabase RLS policies

## Support

For issues or questions:

1. Check this documentation first
2. Review Ocean-ML backend logs
3. Check DataApp frontend console for errors
4. Review Supabase logs for authentication issues
5. Contact the development team

## Credits

- **Ocean-ML**: Original fish detection platform
- **DataApp**: PEBL's ocean data visualization platform
- **Integration**: Seamless combination of both platforms
- **Architecture**: Microservices with API proxy pattern

---

Last Updated: 2025-01-20
Integration Version: 1.0.0
