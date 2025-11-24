# Video Codec Fix - Quick Start Guide

## Problem Summary

Your motion-processed videos (the `*_background_subtracted.mp4` files) won't play in the browser because they use codecs incompatible with HTML5 video players.

**What's Working:**
- ✅ Dashboard loads perfectly
- ✅ All interactive features work
- ✅ Original videos play correctly
- ✅ Error handling shows helpful messages

**What's Not Working:**
- ❌ Motion-processed videos show "Video Not Available" error
- ❌ Side-by-side comparison can't happen

## Quick Fix (10 minutes)

### Option 1: Windows Users (Double-click)

1. **Install FFmpeg** (one-time setup):
   ```powershell
   # Open PowerShell as Administrator
   choco install ffmpeg
   ```

2. **Run the batch script**:
   - Double-click `reencode-videos.bat`
   - Wait 5-10 minutes while it processes all 10 videos
   - Done!

### Option 2: Bash/Git Bash/WSL Users

1. **Install FFmpeg** (if not already installed):
   ```bash
   choco install ffmpeg  # Windows
   brew install ffmpeg   # Mac
   sudo apt install ffmpeg  # Linux
   ```

2. **Run the shell script**:
   ```bash
   bash reencode-videos.sh
   ```

---

## What The Script Does

1. **Backs up** all original videos to `public/videos/backup/`
2. **Re-encodes** each video with web-compatible H.264 baseline codec
3. **Adds silent audio track** (browsers sometimes require audio)
4. **Replaces** the originals with fixed versions
5. **Shows progress** for each of the 10 videos

**Processing time:** ~30-60 seconds per video = 5-10 minutes total

---

## After Re-encoding

### Test It Works

1. Open dashboard: http://localhost:9002/motion-analysis
2. Double-click any video in the table
3. **You should see:**
   - ✅ Original video playing (left side)
   - ✅ Motion video playing (right side)
   - ✅ Both videos synchronized
   - ✅ Timeline and controls working

4. Check browser console - should show:
   ```
   ✅ ORIGINAL VIDEO LOADED
   ✅ MOTION VIDEO LOADED
   ```

---

## Files Created

| File | Purpose |
|------|---------|
| `FIX_VIDEO_CODECS.md` | Complete technical documentation |
| `reencode-videos.bat` | Windows batch script (double-click to run) |
| `reencode-videos.sh` | Bash script for Linux/Mac/WSL |
| `VIDEO_FIX_QUICK_START.md` | This file (quick reference) |

---

## Troubleshooting

### "ffmpeg: command not found"
- FFmpeg not installed
- Install with: `choco install ffmpeg` (Windows)
- Restart terminal after installation

### Script runs but videos still don't work
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+F5)
- Try different browser
- Check console for specific error

### Videos become larger after re-encoding
- **This is normal and expected**
- Original: 1-3MB (optimized for size, incompatible codec)
- Re-encoded: 3-10MB (optimized for compatibility, H.264 baseline)
- 10 videos × ~5MB = ~50MB total (still very small)

---

## Why This Happened

Your Python script (using OpenCV's `cv2.VideoWriter`) saved videos with codecs optimized for file size, not browser compatibility. Common culprits:

- **MJPEG**: Good compression, poor browser support
- **XVID**: Desktop video codec, not web-compatible
- **H.264 High Profile**: Advanced features, limited browser support

**Solution:** Re-encode with H.264 baseline profile - the most universally supported video codec.

---

## Prevent Future Issues

Update your `motion_analysis.py` to save web-compatible videos by default:

```python
# After processing with OpenCV, re-encode for web:
import subprocess

def make_web_compatible(input_file):
    output_file = input_file.replace('.mp4', '_web.mp4')
    cmd = [
        'ffmpeg', '-i', input_file,
        '-c:v', 'libx264', '-profile:v', 'baseline',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '-c:a', 'aac', '-shortest', output_file, '-y'
    ]
    subprocess.run(cmd, check=True)
    os.replace(output_file, input_file)

# Use after saving video:
make_web_compatible('output_background_subtracted.mp4')
```

---

## Summary

**Before Fix:**
- Original: ✅ Works
- Motion: ❌ "Video Not Available" error

**After Fix:**
- Original: ✅ Works
- Motion: ✅ Works
- Result: 🎉 Full side-by-side video comparison!

**Time to fix:** 10-15 minutes (one-time)

---

## Next Steps

1. ✅ Install FFmpeg
2. ✅ Run `reencode-videos.bat` (Windows) or `bash reencode-videos.sh`
3. ✅ Wait 5-10 minutes
4. ✅ Test dashboard
5. 🎉 Enjoy working video comparison!

---

**Need help?** Check `FIX_VIDEO_CODECS.md` for detailed troubleshooting and manual re-encoding instructions.
