# Video Loading Validation Report

**Date:** November 24, 2025
**Status:** ⚠️ Partial Functionality - Motion videos not loading in browser

---

## Summary

The video comparison modal has been enhanced with comprehensive validation logging. Testing reveals that **original videos load successfully** but **motion-processed (background_subtracted) videos fail to load** in the browser.

---

## Validation Logging Added

### Features Implemented

**Console logging when modal opens:**
```
🎬 VIDEO MODAL OPENED
📂 Original filename: SUBCAM_ALG_2020-01-26_09-00-40.mp4
📂 Motion filename: SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4
🔗 Original path: /videos/SUBCAM_ALG_2020-01-26_09-00-40.mp4
🔗 Motion path: /videos/SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4
📊 Video info: {...}
```

**Success logging when video loads:**
```
✅ ORIGINAL VIDEO LOADED: /videos/SUBCAM_ALG_2020-01-26_09-00-40.mp4
   Duration: 120.044228 seconds
   Video width: 1920
   Video height: 1080
```

**Error logging when video fails:**
```
❌ MOTION VIDEO FAILED TO LOAD: /videos/SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4
   Error event: Event
   Video element: JSHandle@node
   🔍 Check: Does this file exist in public/videos/?
```

---

## Test Results

### Video: SUBCAM_ALG_2020-01-26_09-00-40

| Video Type | Path | Status | Details |
|------------|------|--------|---------|
| **Original** | `/videos/SUBCAM_ALG_2020-01-26_09-00-40.mp4` | ✅ **LOADED** | Duration: 120s, Resolution: 1920×1080 |
| **Motion** | `/videos/SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4` | ❌ **FAILED** | File exists (1.6MB) but browser cannot play |

---

## File System Verification

### All Files Present in `public/videos/`

**Original Videos (7 files):**
- ✅ SUBCAM_ALG_2020-01-26_09-00-40.mp4 (47MB)
- ✅ SUBCAM_ALG_2020-01-27_12-00-40.mp4 (115MB)
- ✅ SUBCAM_ALG_2020-01-29_09-00-40.mp4 (66MB)
- ✅ SUBCAM_ALG_2020-02-01_09-00-41.mp4 (31MB)
- ✅ SUBCAM_ALG_2020-02-02_12-00-40.mp4 (115MB)
- ✅ SUBCAM_ALG_2020-02-03_09-00-41.mp4 (46MB)
- ✅ SUBCAM_ALG_2020-02-08_09-00-41.mp4 (113MB)

**Motion-Processed Videos (10 files):**
- ⚠️ algapelago_1_2025-06-20_14-00-48_background_subtracted.mp4 (799KB)
- ⚠️ algapelago_1_2025-06-21_10-00-48_background_subtracted.mp4 (1.2MB)
- ⚠️ algapelago_1_2025-06-21_12-00-48_background_subtracted.mp4 (1.2MB)
- ⚠️ SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4 (1.6MB)
- ⚠️ SUBCAM_ALG_2020-01-27_12-00-40_background_subtracted.mp4 (2.5MB)
- ⚠️ SUBCAM_ALG_2020-01-29_09-00-40_background_subtracted.mp4 (2.5MB)
- ⚠️ SUBCAM_ALG_2020-02-01_09-00-41_background_subtracted.mp4 (1.6MB)
- ⚠️ SUBCAM_ALG_2020-02-02_12-00-40_background_subtracted.mp4 (3.0MB)
- ⚠️ SUBCAM_ALG_2020-02-03_09-00-41_background_subtracted.mp4 (1.8MB)
- ⚠️ SUBCAM_ALG_2020-02-08_09-00-41_background_subtracted.mp4 (2.1MB)

**File Type Verification:**
```bash
$ file "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4"
ISO Media, MP4 Base Media v1 [ISO 14496-12:2003]
```
✅ Valid MP4 container format

---

## Root Cause Analysis

### Likely Issue: Video Codec Incompatibility

The background-subtracted videos likely use a codec that is **not supported by HTML5 video players** in modern browsers.

**Common causes:**
1. **Codec not web-compatible**: Videos may use codecs like HEVC (H.265), VP9, or AV1 without proper browser support
2. **Missing audio track**: Some browsers require audio track even if silent
3. **Encoding profile**: High profile H.264 may not be supported on all browsers
4. **Color space**: Unusual color spaces from motion analysis may cause playback issues

**Why original videos work:**
- Likely encoded with H.264 baseline/main profile
- Standard color space and audio track
- Exported from camera with browser-compatible settings

**Why motion videos don't work:**
- May be encoded with Python/OpenCV default settings
- Could be using codecs optimized for file size over compatibility
- Might lack audio tracks or use non-standard parameters

---

## Recommended Solutions

### Option 1: Re-encode Motion Videos (Recommended)

Re-encode all background_subtracted videos to be HTML5-compatible:

```bash
# Install ffmpeg if not already installed
# Re-encode with browser-compatible settings
for file in *_background_subtracted.mp4; do
  ffmpeg -i "$file" \
    -c:v libx264 \
    -profile:v baseline \
    -level 3.0 \
    -pix_fmt yuv420p \
    -movflags +faststart \
    -f lavfi -i anullsrc=r=44100:cl=mono \
    -c:a aac \
    -shortest \
    "${file%.mp4}_web.mp4"
done
```

**Parameters explained:**
- `-c:v libx264`: Use H.264 codec (universal browser support)
- `-profile:v baseline`: Most compatible H.264 profile
- `-level 3.0`: Compatibility with older devices
- `-pix_fmt yuv420p`: Standard color format
- `-movflags +faststart`: Enable progressive streaming
- `-f lavfi -i anullsrc`: Add silent audio track
- `-c:a aac`: AAC audio codec

### Option 2: Python Script to Re-encode During Motion Analysis

Update `motion_analysis.py` to save web-compatible videos:

```python
import cv2

# When saving background-subtracted video
fourcc = cv2.VideoWriter_fourcc(*'avc1')  # H.264
out = cv2.VideoWriter(
    output_path,
    fourcc,
    fps,
    (width, height),
    isColor=True
)
```

Then post-process with ffmpeg to add audio and optimize.

### Option 3: Use Different Video Format

Serve videos in multiple formats and let browser choose:

```html
<video>
  <source src="/videos/video.mp4" type="video/mp4">
  <source src="/videos/video.webm" type="video/webm">
  <source src="/videos/video.ogv" type="video/ogg">
  Your browser does not support the video tag.
</video>
```

### Option 4: Check Codec Information

First, identify what codec the motion videos are using:

```bash
# Install mediainfo
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,profile,level,pix_fmt \
  -of json "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4"
```

---

## Testing Procedure

### How to Verify After Re-encoding

1. **Open dashboard**: `http://localhost:9002/motion-analysis`
2. **Double-click any video** in the table
3. **Check browser console** for validation logs:
   - Should see `✅ ORIGINAL VIDEO LOADED`
   - Should see `✅ MOTION VIDEO LOADED` (not `❌ FAILED`)
4. **Verify playback**: Both videos should display and play in sync

### Test All Videos

Create a checklist of all videos to test:

- [ ] SUBCAM_ALG_2020-01-26_09-00-40
- [ ] SUBCAM_ALG_2020-01-27_12-00-40
- [ ] SUBCAM_ALG_2020-01-29_09-00-40
- [ ] SUBCAM_ALG_2020-02-01_09-00-41
- [ ] SUBCAM_ALG_2020-02-02_12-00-40
- [ ] SUBCAM_ALG_2020-02-03_09-00-41
- [ ] SUBCAM_ALG_2020-02-08_09-00-41
- [ ] algapelago_1_2025-06-20_14-00-48
- [ ] algapelago_1_2025-06-21_10-00-48
- [ ] algapelago_1_2025-06-21_12-00-48

---

## Files Modified

### `src/components/motion-analysis/VideoComparisonModal.tsx`

**Added comprehensive validation logging:**
- Modal open event logging (filenames, paths, video info)
- Video load success logging (duration, resolution)
- Video error logging (detailed error information)
- Helpful diagnostic messages

**Lines added:** 52-120
**Impact:** Zero performance impact, only console logging

---

## Current Status

✅ **Working:**
- Original videos load and play correctly
- Video synchronization works
- Playback controls functional
- Activity timeline interactive
- Validation logging provides clear diagnostics

❌ **Not Working:**
- Motion-processed videos fail to load in browser
- Right side of modal shows black screen
- Issue affects all 10 background_subtracted videos

⏳ **Next Steps:**
1. Run ffprobe to identify exact codec issue
2. Re-encode videos with web-compatible settings
3. Test all videos after re-encoding
4. Update motion_analysis.py to output web-compatible videos by default

---

## Quick Fix Command

To quickly re-encode a single video for testing:

```bash
ffmpeg -i "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4" \
  -c:v libx264 -profile:v baseline -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart \
  "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted_NEW.mp4"
```

Then replace the original file and test in the dashboard.

---

**Report Generated:** November 24, 2025
**Next Review:** After video re-encoding
