# Ocean-ML Setup Guide

Complete guide for setting up the Ocean-ML integration in DataApp.

## Prerequisites

### Required Software

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Python** 3.9 or higher
- **Git**
- **PostgreSQL** (via Supabase)

### Required Accounts

- **Supabase Account** - For authentication and storage
- **Modal Labs Account** - For GPU-accelerated training/inference
- **GitHub Account** (optional) - For deployment

## Part 1: DataApp Frontend Setup

### 1.1 Clone/Navigate to Repository

```bash
cd C:\Users\Christian Abulhawa\DataApp
```

### 1.2 Install Dependencies

The integration requires `@tanstack/react-query` which should already be installed:

```bash
npm install
```

If you need to install it manually:

```bash
npm install @tanstack/react-query
```

### 1.3 Configure Environment Variables

Create or update `.env.local`:

```bash
# Supabase Configuration (should already exist)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Ocean-ML Configuration (NEW)
OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEAN_ML_BACKEND_URL=http://localhost:8001
NEXT_PUBLIC_OCEANML_PROTOCOL=oceanml
```

**Environment Variable Details**:

- `OCEAN_ML_BACKEND_URL`: Backend URL for server-side requests (not exposed to browser)
- `NEXT_PUBLIC_OCEAN_ML_BACKEND_URL`: Backend URL accessible in browser (for info display)
- `NEXT_PUBLIC_OCEANML_PROTOCOL`: Protocol handler for desktop app integration

### 1.4 Verify Installation

Check that the integration files exist:

```bash
# Check page
ls src/app/data-processing/page.tsx

# Check components
ls src/components/ocean-ml/

# Check API proxy
ls src/app/api/ocean-ml/[...path]/route.ts
```

Expected output:
```
src/app/data-processing/page.tsx
src/components/ocean-ml/:
  OceanMLDashboard.tsx
  VideoLibrary.tsx
  VideoCard.tsx
  TrainingDashboard.tsx
src/app/api/ocean-ml/[...path]/route.ts
```

### 1.5 Test Frontend

Start the development server:

```bash
npm run dev
```

Expected output:
```
▲ Next.js 15.2.3
- Local:        http://localhost:9002
- Network:      http://192.168.x.x:9002

✓ Ready in 2.5s
```

Visit `http://localhost:9002` - you should see the DataApp login page.

## Part 2: Ocean-ML Backend Setup

### 2.1 Navigate to Backend Directory

```bash
cd "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\03 - Machine Learning\Ocean-ML\backend"
```

### 2.2 Create Virtual Environment

If not already created:

```bash
python -m venv venv
```

### 2.3 Activate Virtual Environment

**Windows**:
```bash
.\venv\Scripts\activate
```

**Mac/Linux**:
```bash
source venv/bin/activate
```

You should see `(venv)` prefix in your terminal.

### 2.4 Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- FastAPI
- Uvicorn
- Supabase Python client
- Modal client
- Other dependencies

### 2.5 Configure Environment Variables

Create `.env` file in the backend directory:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key

# Modal Labs Configuration
MODAL_TOKEN_ID=your_modal_token_id
MODAL_TOKEN_SECRET=your_modal_token_secret

# Application Configuration
ENVIRONMENT=development
DEBUG=True
PORT=8001

# CORS Configuration
CORS_ORIGINS=http://localhost:9002,http://localhost:3000,http://localhost:5173
```

**Getting Credentials**:

#### Supabase:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to Settings → API
4. Copy:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_KEY`

#### Modal Labs:
1. Sign up at [Modal.com](https://modal.com)
2. Go to Settings → API Tokens
3. Create new token
4. Copy:
   - Token ID → `MODAL_TOKEN_ID`
   - Token Secret → `MODAL_TOKEN_SECRET`

### 2.6 Test Backend

Start the backend server:

```bash
python main.py
```

Expected output:
```
🚀 Ocean-ML API starting...
📍 Environment: development
🔧 Debug mode: True
🌐 CORS origins: ['http://localhost:9002', ...]
✅ API ready!
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

### 2.7 Verify Backend

Open a new terminal and test the health endpoint:

```bash
curl http://localhost:8001/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "service": "ocean-ml-api"
}
```

Test Supabase connection:

```bash
curl http://localhost:8001/supabase-test
```

Expected response:
```json
{
  "status": "connected",
  "buckets": ["Videos", "models", "thumbnails"]
}
```

## Part 3: Supabase Configuration

### 3.1 Create Storage Buckets

Navigate to Supabase Dashboard → Storage → Create bucket:

#### Videos Bucket
- **Name**: `Videos`
- **Public**: ✅ Yes
- **File size limit**: 500 MB
- **Allowed MIME types**: `video/mp4`, `video/avi`, `video/quicktime`

#### Models Bucket
- **Name**: `models`
- **Public**: ❌ No
- **File size limit**: 500 MB
- **Allowed MIME types**: `application/octet-stream`

#### Thumbnails Bucket
- **Name**: `thumbnails`
- **Public**: ✅ Yes
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg`, `image/png`

### 3.2 Apply Storage Policies

Go to Supabase Dashboard → Storage → Policies

Copy and execute the SQL from `docs/storage-policies.sql`:

```sql
-- Videos Bucket Policies
CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'Videos' AND
    auth.uid() IS NOT NULL
);

CREATE POLICY "Authenticated users can read all videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'Videos');

CREATE POLICY "Users can update their own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'Videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'Videos' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Models Bucket Policies
CREATE POLICY "Users can upload models"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'models');

CREATE POLICY "Users can read their own models"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'models' AND
    auth.uid()::text = (storage.foldername(name))[1]
);
```

### 3.3 Create Database Tables

The Ocean-ML backend should automatically create tables on first run, but you can manually create them:

```sql
-- Videos table
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    duration_seconds FLOAT,
    frame_count INTEGER,
    resolution TEXT,
    fps FLOAT,
    file_size_bytes BIGINT,
    annotated BOOLEAN DEFAULT FALSE,
    annotated_by UUID REFERENCES auth.users(id),
    annotated_at TIMESTAMP WITH TIME ZONE,
    detection_count INTEGER DEFAULT 0,
    locked_by UUID REFERENCES auth.users(id),
    locked_until TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all videos"
ON videos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own videos"
ON videos FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own videos"
ON videos FOR UPDATE
TO authenticated
USING (uploaded_by = auth.uid());
```

### 3.4 Verify Database Setup

Query the videos table:

```sql
SELECT COUNT(*) FROM videos;
```

Should return `0` (no videos yet).

## Part 4: Desktop App Setup (Optional)

The desktop annotation app is optional but required for the "Annotate" feature.

### 4.1 Install Desktop App

Follow the instructions in the Ocean-ML desktop app repository.

### 4.2 Register Protocol Handler

**Windows**:

The installer should automatically register the `oceanml://` protocol handler.

To verify:
1. Open Registry Editor
2. Navigate to `HKEY_CLASSES_ROOT\oceanml`
3. Should see command pointing to app executable

**Mac**:

The app bundle should include protocol handler registration in `Info.plist`.

### 4.3 Test Protocol Handler

Open your browser and navigate to:

```
oceanml://test?message=hello
```

The desktop app should launch with a test message.

## Part 5: Integration Testing

### 5.1 Start Both Services

**Terminal 1 - Backend**:
```bash
cd "G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\03 - Machine Learning\Ocean-ML\backend"
.\venv\Scripts\python.exe main.py
```

**Terminal 2 - Frontend**:
```bash
cd C:\Users\Christian Abulhawa\DataApp
npm run dev
```

### 5.2 Test Authentication

1. Open `http://localhost:9002`
2. Click "Sign In"
3. Login with your credentials
4. Verify you're redirected to the dashboard

### 5.3 Test Navigation

1. Click your profile picture (top-right)
2. Select "Data Processing"
3. You should see the Ocean-ML dashboard
4. Check for any console errors (F12 → Console)

### 5.4 Test API Connection

1. In the Ocean-ML dashboard, you should see "Loading videos..." or "No videos found"
2. Open browser DevTools (F12) → Network tab
3. Look for request to `/api/ocean-ml/videos`
4. Check response status should be `200 OK`
5. Verify response contains `{"videos": []}`

### 5.5 Test Video Upload (Optional)

If you have a video file:

1. Use Postman or curl to upload:

```bash
curl -X POST http://localhost:8001/api/videos/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@path/to/video.mp4"
```

2. Refresh the DataApp page
3. Video should appear in the library

## Part 6: Troubleshooting

### Issue: Frontend won't start

**Check**:
```bash
# Verify Node version
node --version  # Should be 18+

# Clear cache
rm -rf .next
npm run dev
```

### Issue: Backend won't start

**Check**:
```bash
# Verify Python version
python --version  # Should be 3.9+

# Verify virtual environment
which python  # Should point to venv

# Check dependencies
pip list | grep fastapi
```

### Issue: "Failed to connect to Ocean-ML backend"

**Check**:
1. Backend is running on port 8001
2. No firewall blocking localhost:8001
3. `OCEAN_ML_BACKEND_URL` is correct in `.env.local`
4. Check browser console for errors

### Issue: "Authentication failed"

**Check**:
1. Supabase URL and keys are correct
2. User is logged in to DataApp
3. Session cookie exists (DevTools → Application → Cookies)
4. Token is valid (check expiry)

### Issue: CORS errors

**Check**:
1. `CORS_ORIGINS` in backend `.env` includes `http://localhost:9002`
2. Restart backend after changing CORS settings
3. Clear browser cache

### Issue: Videos don't load

**Check**:
1. Supabase storage buckets exist
2. Storage policies are applied
3. Videos table exists in database
4. RLS policies allow reading

## Part 7: Next Steps

After successful setup:

1. **Upload test videos**: Test the complete workflow
2. **Configure Modal Labs**: Set up GPU instances for training
3. **Install desktop app**: Enable annotation features
4. **Review documentation**: Read API docs and component guides
5. **Deploy to production**: Follow deployment guide

## Getting Help

If you encounter issues:

1. Check this setup guide thoroughly
2. Review error messages carefully
3. Check browser console for errors
4. Check backend logs
5. Review Supabase logs
6. Refer to [Troubleshooting Guide](./README.md#troubleshooting)
7. Contact development team

---

**Last Updated**: January 20, 2025
**Setup Guide Version**: 1.0.0
