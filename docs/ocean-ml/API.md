# Ocean-ML API Documentation

## Base URL

All Ocean-ML endpoints are accessed via the Next.js proxy:

- **Development**: `http://localhost:9002/api/ocean-ml`
- **Production**: `https://your-domain.com/api/ocean-ml`

The proxy automatically forwards requests to the Ocean-ML backend and adds authentication headers.

## Authentication

All requests require a valid Supabase session. Authentication is handled automatically by the Next.js proxy.

### How It Works

1. User logs in via Supabase
2. Frontend makes request to `/api/ocean-ml/*`
3. Proxy extracts Supabase access token from session
4. Proxy forwards request with `Authorization: Bearer <token>` header
5. Ocean-ML backend validates token with Supabase
6. Response flows back through proxy to frontend

### Example Request

```typescript
// Frontend code - authentication handled automatically
const response = await fetch('/api/ocean-ml/videos')
const data = await response.json()
```

## Endpoints

### Videos

#### List Videos

Get all videos, optionally filtered by annotation status.

```http
GET /api/ocean-ml/videos
```

**Query Parameters**:
- `annotated` (boolean, optional): Filter by annotation status
  - `true`: Only annotated videos
  - `false`: Only unannotated videos
  - Omit: All videos

**Response** (200 OK):
```json
{
  "videos": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "filename": "underwater_footage_001.mp4",
      "storage_path": "videos/user123/underwater_footage_001.mp4",
      "thumbnail_path": "thumbnails/user123/underwater_footage_001.jpg",
      "duration_seconds": 120.5,
      "frame_count": 3013,
      "resolution": "1920x1080",
      "fps": 25.0,
      "file_size_bytes": 52428800,
      "annotated": false,
      "annotated_by": null,
      "annotated_at": null,
      "detection_count": 0,
      "locked_by": null,
      "uploaded_at": "2025-01-20T12:34:56.789Z",
      "uploaded_by": "auth0|user123"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 50
}
```

**Example Usage**:
```typescript
// Get all videos
const allVideos = await fetch('/api/ocean-ml/videos')

// Get only annotated videos
const annotated = await fetch('/api/ocean-ml/videos?annotated=true')

// Get only unannotated videos
const unannotated = await fetch('/api/ocean-ml/videos?annotated=false')
```

#### Get Video Details

Get detailed information about a specific video.

```http
GET /api/ocean-ml/videos/{video_id}
```

**Parameters**:
- `video_id` (string, required): UUID of the video

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "underwater_footage_001.mp4",
  "storage_path": "videos/user123/underwater_footage_001.mp4",
  "thumbnail_path": "thumbnails/user123/underwater_footage_001.jpg",
  "duration_seconds": 120.5,
  "frame_count": 3013,
  "resolution": "1920x1080",
  "fps": 25.0,
  "file_size_bytes": 52428800,
  "annotated": true,
  "annotated_by": "auth0|user456",
  "annotated_at": "2025-01-20T14:22:10.123Z",
  "detection_count": 47,
  "locked_by": null,
  "uploaded_at": "2025-01-20T12:34:56.789Z",
  "uploaded_by": "auth0|user123",
  "metadata": {
    "camera": "GoPro Hero 11",
    "location": "Pacific Ocean",
    "depth_meters": 15
  }
}
```

**Errors**:
- `404`: Video not found

#### Upload Video

Upload a new video file.

```http
POST /api/ocean-ml/videos/upload
```

**Content-Type**: `multipart/form-data`

**Request Body**:
- `file` (file, required): Video file (MP4, AVI, MOV)
- `metadata` (JSON string, optional): Additional metadata

**Example**:
```typescript
const formData = new FormData()
formData.append('file', videoFile)
formData.append('metadata', JSON.stringify({
  camera: 'GoPro Hero 11',
  location: 'Pacific Ocean',
  depth_meters: 15
}))

const response = await fetch('/api/ocean-ml/videos/upload', {
  method: 'POST',
  body: formData
})
```

**Response** (201 Created):
```json
{
  "success": true,
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "filename": "underwater_footage_001.mp4",
  "storage_path": "videos/user123/underwater_footage_001.mp4",
  "message": "Video uploaded successfully"
}
```

**Errors**:
- `400`: Invalid file format or missing file
- `413`: File too large
- `507`: Insufficient storage space

#### Delete Video

Delete a video and its associated data.

```http
DELETE /api/ocean-ml/videos/{video_id}
```

**Parameters**:
- `video_id` (string, required): UUID of the video

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Video deleted successfully"
}
```

**Errors**:
- `403`: Not authorized to delete this video
- `404`: Video not found

### Annotations

#### Get Annotations

Get all annotations for a specific video.

```http
GET /api/ocean-ml/annotations/{video_id}
```

**Parameters**:
- `video_id` (string, required): UUID of the video

**Response** (200 OK):
```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "annotations": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "frame_number": 150,
      "timestamp_seconds": 6.0,
      "bounding_box": {
        "x": 100,
        "y": 200,
        "width": 50,
        "height": 75
      },
      "class": "fish",
      "confidence": 0.95,
      "annotated_by": "auth0|user456",
      "annotated_at": "2025-01-20T14:22:10.123Z"
    }
  ],
  "total_annotations": 47
}
```

#### Acquire Annotation Lock

Acquire a lock to annotate a video (prevents concurrent editing).

```http
POST /api/ocean-ml/annotations/annotate/{video_id}
```

**Parameters**:
- `video_id` (string, required): UUID of the video

**Request Body**:
```json
{
  "timeout_minutes": 60
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "lock_id": "770e8400-e29b-41d4-a716-446655440000",
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "locked_by": "auth0|user456",
  "locked_at": "2025-01-20T15:00:00.000Z",
  "expires_at": "2025-01-20T16:00:00.000Z",
  "message": "Video locked successfully"
}
```

**Response** (409 Conflict - Video already locked):
```json
{
  "success": false,
  "message": "Video is currently being annotated by another user",
  "locked_by": "user@example.com",
  "locked_until": "2025-01-20T16:00:00.000Z"
}
```

#### Submit Annotations

Submit annotations from the desktop app.

```http
POST /api/ocean-ml/annotations/submit
```

**Request Body**:
```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "lock_id": "770e8400-e29b-41d4-a716-446655440000",
  "annotations": [
    {
      "frame_number": 150,
      "bounding_box": {
        "x": 100,
        "y": 200,
        "width": 50,
        "height": 75
      },
      "class": "fish",
      "confidence": 0.95
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "annotations_created": 47,
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Annotations submitted successfully"
}
```

#### Release Lock

Release an annotation lock (usually done automatically on submission).

```http
DELETE /api/ocean-ml/annotations/lock/{lock_id}
```

**Parameters**:
- `lock_id` (string, required): UUID of the lock

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lock released successfully"
}
```

### Training

#### List Training Runs

Get all training runs for the authenticated user.

```http
GET /api/ocean-ml/training/runs
```

**Query Parameters**:
- `status` (string, optional): Filter by status
  - `queued`, `preparing`, `training`, `completed`, `failed`, `cancelled`

**Response** (200 OK):
```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440000",
    "model_type": "yolov8n",
    "epochs": 100,
    "batch_size": 16,
    "image_size": 640,
    "status": "training",
    "started_at": "2025-01-20T10:00:00.000Z",
    "completed_at": null,
    "current_epoch": 45,
    "map50": 0.847,
    "map50_95": 0.623,
    "final_loss": 0.0234,
    "training_time_seconds": 2700,
    "cost_usd": 1.25,
    "dataset_size": 1500,
    "created_by": "auth0|user123"
  },
  {
    "id": "990e8400-e29b-41d4-a716-446655440000",
    "model_type": "yolov11s",
    "epochs": 150,
    "status": "completed",
    "started_at": "2025-01-19T08:00:00.000Z",
    "completed_at": "2025-01-19T10:45:30.000Z",
    "current_epoch": 150,
    "map50": 0.912,
    "map50_95": 0.735,
    "final_loss": 0.0156,
    "training_time_seconds": 9930,
    "cost_usd": 4.50,
    "created_by": "auth0|user123"
  }
]
```

#### Get Training Run Details

Get detailed information about a specific training run.

```http
GET /api/ocean-ml/training/runs/{run_id}
```

**Response** (200 OK):
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "model_type": "yolov8n",
  "epochs": 100,
  "batch_size": 16,
  "image_size": 640,
  "status": "training",
  "started_at": "2025-01-20T10:00:00.000Z",
  "current_epoch": 45,
  "metrics_history": [
    {
      "epoch": 1,
      "loss": 0.523,
      "map50": 0.234,
      "map50_95": 0.145
    },
    {
      "epoch": 45,
      "loss": 0.0234,
      "map50": 0.847,
      "map50_95": 0.623
    }
  ],
  "hyperparameters": {
    "learning_rate": 0.001,
    "momentum": 0.937,
    "weight_decay": 0.0005
  }
}
```

#### Start Training Run

Start a new model training run.

```http
POST /api/ocean-ml/training/start
```

**Request Body**:
```json
{
  "model_type": "yolov8n",
  "epochs": 100,
  "batch_size": 16,
  "image_size": 640,
  "hyperparameters": {
    "learning_rate": 0.001,
    "momentum": 0.937,
    "weight_decay": 0.0005
  }
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "run_id": "880e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimated_time_minutes": 45,
  "estimated_cost_usd": 1.25,
  "message": "Training run started successfully"
}
```

**Errors**:
- `400`: Invalid parameters
- `402`: Insufficient credits
- `503`: Training service unavailable

#### Cancel Training Run

Cancel an active training run.

```http
POST /api/ocean-ml/training/runs/{run_id}/cancel
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Training run cancelled successfully"
}
```

#### Training Progress WebSocket

Get real-time training progress updates.

```
WS /api/ocean-ml/ws/training/{run_id}
```

**Connection**:
```typescript
const ws = new WebSocket(`ws://localhost:9002/api/ocean-ml/ws/training/${runId}`)

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log('Training update:', data)
}
```

**Message Format**:
```json
{
  "type": "training_update",
  "run_id": "880e8400-e29b-41d4-a716-446655440000",
  "status": "training",
  "progress": 45,
  "message": "Epoch 45/100 - Loss: 0.0234",
  "metrics": {
    "epoch": 45,
    "loss": 0.0234,
    "map50": 0.847,
    "map50_95": 0.623
  },
  "timestamp": "2025-01-20T12:30:45.123Z"
}
```

### Inference

#### Start Inference

Run inference on a video using a trained model.

```http
POST /api/ocean-ml/inference/start
```

**Request Body**:
```json
{
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "model_id": "990e8400-e29b-41d4-a716-446655440000",
  "confidence_threshold": 0.25,
  "iou_threshold": 0.45,
  "save_results": true
}
```

**Response** (202 Accepted):
```json
{
  "success": true,
  "inference_run_id": "aa0e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimated_time_minutes": 15,
  "estimated_cost_usd": 0.50,
  "message": "Inference started successfully"
}
```

#### Get Inference Results

Get results from a completed inference run.

```http
GET /api/ocean-ml/inference/{inference_run_id}
```

**Response** (200 OK):
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000",
  "video_id": "550e8400-e29b-41d4-a716-446655440000",
  "model_id": "990e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "started_at": "2025-01-20T13:00:00.000Z",
  "completed_at": "2025-01-20T13:12:34.000Z",
  "detections_count": 234,
  "results_path": "inference/aa0e8400/results.json",
  "video_path": "inference/aa0e8400/annotated_video.mp4",
  "cost_usd": 0.48
}
```

#### Download Inference Video

Download the annotated video with detection boxes.

```http
GET /api/ocean-ml/inference/{inference_run_id}/download
```

**Response**: Video file (MP4) with bounding boxes drawn

### Models

#### List Available Models

Get all trained models available for inference.

```http
GET /api/ocean-ml/models
```

**Response** (200 OK):
```json
[
  {
    "id": "990e8400-e29b-41d4-a716-446655440000",
    "name": "Fish Detector v1",
    "model_type": "yolov11s",
    "training_run_id": "880e8400-e29b-41d4-a716-446655440000",
    "map50": 0.912,
    "map50_95": 0.735,
    "created_at": "2025-01-19T10:45:30.000Z",
    "file_size_bytes": 47185920,
    "is_public": false
  }
]
```

#### Download Model

Get download URL for a trained model.

```http
GET /api/ocean-ml/models/{model_id}/download
```

**Response** (200 OK):
```json
{
  "download_url": "https://supabase-storage-url/models/...",
  "expires_at": "2025-01-20T16:00:00.000Z",
  "file_size_bytes": 47185920
}
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error details (optional)",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

- `400` - Bad Request: Invalid parameters
- `401` - Unauthorized: Authentication required
- `403` - Forbidden: Insufficient permissions
- `404` - Not Found: Resource doesn't exist
- `409` - Conflict: Resource conflict (e.g., video locked)
- `413` - Payload Too Large: File size exceeds limit
- `429` - Too Many Requests: Rate limit exceeded
- `500` - Internal Server Error: Server-side error
- `502` - Bad Gateway: Backend service unavailable
- `503` - Service Unavailable: Temporary service outage

### Example Error Response

```json
{
  "error": "Validation Error",
  "message": "Invalid video format. Supported formats: MP4, AVI, MOV",
  "details": {
    "field": "file",
    "received_format": "wmv",
    "supported_formats": ["mp4", "avi", "mov"]
  },
  "code": "INVALID_VIDEO_FORMAT"
}
```

## Rate Limiting

API requests are rate-limited to prevent abuse:

- **Videos**: 100 requests per minute
- **Training**: 10 starts per hour
- **Inference**: 50 starts per hour
- **All other endpoints**: 200 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705759200
```

## Pagination

List endpoints support pagination:

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `page_size` (integer, default: 50, max: 100): Items per page

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total": 237,
    "total_pages": 5
  }
}
```

---

**Last Updated**: January 20, 2025
**API Version**: 1.0.0
