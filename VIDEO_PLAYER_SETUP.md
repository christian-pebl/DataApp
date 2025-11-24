# Video Player Setup Guide

## Overview
The Motion Analysis Dashboard now includes a **side-by-side video comparison modal** that allows you to verify organisms and observations by watching the original video and motion-processed video simultaneously.

---

## How to Use

### Opening the Video Modal

**Method 1: Double-click table row**
- Go to the "Video Rankings" table
- Double-click any video row
- Modal opens with side-by-side players

**Method 2: Double-click small multiple chart**
- Scroll to "Activity Patterns - Small Multiples" section
- Double-click any video chart
- Modal opens instantly

**Method 3: Click "Play Video" button**
- Single-click a video row to select it (shows detailed panel below)
- Click the "Play Video" button in the detailed panel
- Modal opens with video players

### Video Controls

- **Play/Pause** - Large blue button in center
- **Skip Backward** - Jump back 5 seconds
- **Skip Forward** - Jump ahead 5 seconds
- **Mute/Unmute** - Control audio (muted by default)
- **Timeline Slider** - Drag to seek to specific time
- **Close Modal** - Click X button in top-right corner

Both videos play in perfect sync!

---

## Video File Setup

### Required Directory Structure

Create a `videos` folder in the `public` directory:

```
DataApp/
├── public/
│   ├── videos/                          👈 CREATE THIS
│   │   ├── SUBCAM_ALG_2020-01-26_09-00-40.mp4                    (original)
│   │   ├── SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4   (motion)
│   │   ├── SUBCAM_ALG_2020-01-27_12-00-40.mp4
│   │   ├── SUBCAM_ALG_2020-01-27_12-00-40_background_subtracted.mp4
│   │   └── ... (all other videos)
│   └── motion-analysis-results/
│       └── ... (JSON files)
└── src/
```

### File Naming Convention

For each video analyzed, you need **TWO files**:

1. **Original video**: `[video_name].mp4`
2. **Motion video**: `[video_name]_background_subtracted.mp4`

**Example:**
- Original: `SUBCAM_ALG_2020-01-26_09-00-40.mp4`
- Motion: `SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4`

### Steps to Set Up

```bash
# 1. Create the videos directory
mkdir public/videos

# 2. Copy your video files
# Copy all original videos (.mp4)
# Copy all motion-processed videos (*_background_subtracted.mp4)

# Example on Windows PowerShell:
Copy-Item "path\to\your\videos\*.mp4" "public\videos\"

# Example on Linux/Mac:
cp /path/to/your/videos/*.mp4 public/videos/
```

### Current Videos to Copy

Based on your dashboard data, you need these 10 video pairs (20 files total):

**SUBCAM Videos (7 pairs):**
1. `SUBCAM_ALG_2020-01-26_09-00-40.mp4` + `*_background_subtracted.mp4`
2. `SUBCAM_ALG_2020-01-27_12-00-40.mp4` + `*_background_subtracted.mp4`
3. `SUBCAM_ALG_2020-01-29_09-00-40.mp4` + `*_background_subtracted.mp4`
4. `SUBCAM_ALG_2020-02-01_09-00-41.mp4` + `*_background_subtracted.mp4`
5. `SUBCAM_ALG_2020-02-02_12-00-40.mp4` + `*_background_subtracted.mp4`
6. `SUBCAM_ALG_2020-02-03_09-00-41.mp4` + `*_background_subtracted.mp4`
7. `SUBCAM_ALG_2020-02-08_09-00-41.mp4` + `*_background_subtracted.mp4`

**Algapelago Videos (3 pairs):**
8. `algapelago_1_2025-06-20_14-00-48.mp4` + `*_background_subtracted.mp4`
9. `algapelago_1_2025-06-21_10-00-48.mp4` + `*_background_subtracted.mp4`
10. `algapelago_1_2025-06-21_12-00-48.mp4` + `*_background_subtracted.mp4`

---

## Alternative: Custom Video Directory

If you want to store videos in a different location, edit the video paths in:

**File:** `src/components/motion-analysis/VideoComparisonModal.tsx`

**Lines 31-32:**
```typescript
const originalVideoPath = `/videos/${originalFilename}`;
const motionVideoPath = `/videos/${motionFilename}`;
```

**Change to:**
```typescript
// Example: Videos in a custom subdirectory
const originalVideoPath = `/motion-videos/original/${originalFilename}`;
const motionVideoPath = `/motion-videos/processed/${motionFilename}`;

// Example: Videos from external URL
const originalVideoPath = `https://yourdomain.com/videos/${originalFilename}`;
const motionVideoPath = `https://yourdomain.com/videos/${motionFilename}`;
```

---

## Troubleshooting

### Videos not loading (404 error)

**Symptom:** Modal opens but videos are black/blank

**Solution:**
1. Check that `public/videos/` directory exists
2. Verify video filenames match exactly (case-sensitive)
3. Check browser console for specific missing files
4. Ensure videos are in MP4 format

### Videos out of sync

**Symptom:** Original and motion videos play at different speeds

**Solution:**
- Videos should have identical frame rates and durations
- Check that motion processing preserved original timing
- Verify both videos have same `fps` and `duration_seconds`

### Videos won't play in browser

**Symptom:** 404 errors or "format not supported"

**Solution:**
- Ensure videos are H.264 encoded MP4 (most compatible)
- Test video playback directly: `http://localhost:9002/videos/[filename].mp4`
- Re-encode videos if needed:
  ```bash
  ffmpeg -i input.mp4 -vcodec libx264 -acodec aac output.mp4
  ```

### Modal opens but stays loading forever

**Symptom:** Spinning loader, videos never appear

**Solution:**
1. Check video file sizes (very large files may timeout)
2. Verify videos are readable (not corrupted)
3. Check network tab in browser DevTools for HTTP status codes

---

## Features

### ✅ Implemented
- Side-by-side video comparison
- Synchronized playback
- Video controls (play, pause, skip, mute)
- Timeline scrubbing
- Video metadata display
- Double-click to open (table rows and small multiples)
- Keyboard support (Escape to close)

### 🔮 Future Enhancements (Not Yet Implemented)
- Frame-by-frame stepping (keyboard arrows)
- Playback speed control (0.5x, 1x, 2x)
- Zoom and pan on video
- Organism detection overlay on original video
- Export video clip at specific timestamp
- Comparison mode toggle (side-by-side, overlay, split-screen)
- Annotate observations directly on video

---

## Usage Examples

### Example 1: Verify High Activity Video

**Scenario:** SUBCAM_2020-01-26 has 221 organism detections. Verify they're real organisms, not marine snow.

**Steps:**
1. Go to Motion Analysis Dashboard
2. Double-click row #1 (SUBCAM_2020-01-26)
3. Click Play button
4. Watch side-by-side:
   - **Left (Original):** See actual organisms in context
   - **Right (Motion):** See what motion detector highlighted
5. Use timeline to jump to high-activity moments
6. Verify if detections are organisms or false positives

### Example 2: Investigate Extreme Density Peak

**Scenario:** algapelago_2025-06-21_12:00 shows 39.47% peak density (possible large fish or shadow)

**Steps:**
1. Double-click row #3 (algapelago with 39.47% peak)
2. Drag timeline slider to middle section (where peak likely occurs)
3. Watch original video to see what caused the spike:
   - Large fish passing through?
   - Shadow from boat/structure?
   - Debris cloud?
4. Verify if this should be filtered as noise

### Example 3: Compare Morning vs Midday Activity

**Scenario:** Compare two videos from same location at different times

**Steps:**
1. Double-click SUBCAM_2020-01-26_09:00 (morning, 221 organisms)
2. Watch for a few seconds, note organism types
3. Close modal
4. Double-click SUBCAM_2020-01-27_12:00 (midday, 20 organisms)
5. Compare activity levels and organism behavior

---

## Technical Details

**Video Format:** MP4 (H.264 video codec recommended)
**Supported Resolutions:** Any (auto-scales to fit modal)
**Max Video Size:** Limited by browser memory (~500MB recommended)
**Playback:** Native HTML5 `<video>` elements (no external dependencies)
**Sync Method:** Both videos controlled via single play/pause state

---

## File References

- **Modal Component:** `src/components/motion-analysis/VideoComparisonModal.tsx`
- **Dashboard Integration:** `src/components/motion-analysis/MotionAnalysisDashboard.tsx`
- **Video Directory:** `public/videos/` (you need to create this)

---

**Last Updated:** November 24, 2025
**Feature Status:** ✅ Ready to use (pending video file setup)
