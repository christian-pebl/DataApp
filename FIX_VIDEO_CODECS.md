# Fix Video Codec Issues - Complete Guide

**Problem:** Motion-processed videos use codecs incompatible with HTML5 video players in browsers.

**Solution:** Re-encode all 10 background_subtracted videos with web-compatible H.264 baseline profile.

---

## Quick Fix (Estimated time: 10-15 minutes)

### Step 1: Install FFmpeg

**Windows (Recommended - Chocolatey):**
```powershell
# Run PowerShell as Administrator
choco install ffmpeg
```

**Windows (Alternative - Manual):**
1. Download ffmpeg from: https://www.gyan.dev/ffmpeg/builds/
2. Download "ffmpeg-release-essentials.zip"
3. Extract to `C:\ffmpeg`
4. Add to PATH: `C:\ffmpeg\bin`
5. Restart terminal

**Verify installation:**
```bash
ffmpeg -version
```

---

### Step 2: Run the Re-encoding Script

I've created `reencode-videos.sh` in your project root. Run it:

```bash
bash reencode-videos.sh
```

This will:
1. Backup original motion videos to `public/videos/backup/`
2. Re-encode all 10 videos with web-compatible settings
3. Replace the originals with fixed versions
4. Show progress for each video

**Expected time:** 5-10 minutes (depends on your CPU)

---

## Manual Re-encoding (If Script Fails)

Re-encode videos one at a time:

```bash
cd public/videos

# Example for one video:
ffmpeg -i "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4" \
  -c:v libx264 \
  -profile:v baseline \
  -level 3.0 \
  -pix_fmt yuv420p \
  -movflags +faststart \
  -f lavfi -i anullsrc=r=44100:cl=mono -t 30 \
  -c:a aac -b:a 128k \
  -shortest \
  "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted_FIXED.mp4"

# Then replace the original:
mv "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted_FIXED.mp4" \
   "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4"
```

**Repeat for all 10 videos.**

---

## What These FFmpeg Parameters Do

| Parameter | Purpose |
|-----------|---------|
| `-c:v libx264` | Use H.264 video codec (universal browser support) |
| `-profile:v baseline` | Most compatible H.264 profile (works on all devices) |
| `-level 3.0` | Compatibility with older devices/browsers |
| `-pix_fmt yuv420p` | Standard color format for video |
| `-movflags +faststart` | Enable progressive streaming (video starts playing before fully downloaded) |
| `-f lavfi -i anullsrc` | Add silent audio track (some browsers require audio) |
| `-c:a aac -b:a 128k` | AAC audio codec at 128kbps |
| `-shortest` | Match audio length to video length |

---

## After Re-encoding

### Test the Videos

1. Open dashboard: http://localhost:9002/motion-analysis
2. Double-click the first video (SUBCAM_ALG_2020-01-26)
3. Check console - should see:
   ```
   ✅ ORIGINAL VIDEO LOADED
   ✅ MOTION VIDEO LOADED
   ```
4. Both videos should now play side-by-side

### Expected Results

**Before:**
- Original video: ✅ Plays
- Motion video: ❌ Error overlay

**After:**
- Original video: ✅ Plays
- Motion video: ✅ Plays
- Videos synchronized and controllable

---

## Troubleshooting

### "ffmpeg: command not found"
- FFmpeg not installed or not in PATH
- Follow Step 1 installation instructions
- Restart terminal after installation

### "Permission denied"
- Videos might be in use by another program
- Close browser and any video players
- Run script again

### Video file becomes larger after re-encoding
- This is normal - we're using higher quality settings for compatibility
- Original: 1-3MB (optimized for size)
- Re-encoded: 3-10MB (optimized for compatibility)
- Storage is not an issue for 10 small videos

### Videos still won't play after re-encoding
- Check browser console for specific error
- Try different browser (Chrome, Firefox, Edge)
- Verify video plays directly: `http://localhost:9002/videos/[filename].mp4`

---

## Files to Re-encode (10 total)

✅ = Original video exists
⚠️ = Original video missing

1. ✅ SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4 (1.6MB)
2. ✅ SUBCAM_ALG_2020-01-27_12-00-40_background_subtracted.mp4 (2.5MB)
3. ✅ SUBCAM_ALG_2020-01-29_09-00-40_background_subtracted.mp4 (2.5MB)
4. ✅ SUBCAM_ALG_2020-02-01_09-00-41_background_subtracted.mp4 (1.6MB)
5. ✅ SUBCAM_ALG_2020-02-02_12-00-40_background_subtracted.mp4 (3.0MB)
6. ✅ SUBCAM_ALG_2020-02-03_09-00-41_background_subtracted.mp4 (1.8MB)
7. ✅ SUBCAM_ALG_2020-02-08_09-00-41_background_subtracted.mp4 (2.1MB)
8. ⚠️ algapelago_1_2025-06-20_14-00-48_background_subtracted.mp4 (799KB)
9. ⚠️ algapelago_1_2025-06-21_10-00-48_background_subtracted.mp4 (1.2MB)
10. ⚠️ algapelago_1_2025-06-21_12-00-48_background_subtracted.mp4 (1.2MB)

**Total size:** ~17MB → Will become ~30-50MB after re-encoding

---

## Alternative: Update Python Script (Future Videos)

To prevent this issue for future videos, update your `motion_analysis.py` script:

```python
import cv2
import subprocess

# After creating background_subtracted video with OpenCV:
def make_web_compatible(input_file, output_file):
    """Re-encode video to be web-compatible"""
    cmd = [
        'ffmpeg', '-i', input_file,
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
        '-c:a', 'aac', '-b:a', '128k',
        '-shortest',
        output_file,
        '-y'
    ]
    subprocess.run(cmd, check=True)

# Use it:
temp_file = "video_temp.mp4"
final_file = "video_background_subtracted.mp4"

# Save with OpenCV (temporary file)
out = cv2.VideoWriter(temp_file, fourcc, fps, (width, height))
# ... write frames ...
out.release()

# Re-encode for web compatibility
make_web_compatible(temp_file, final_file)
os.remove(temp_file)
```

This ensures all future motion videos are web-compatible by default.

---

## Summary

**Problem:** OpenCV saves videos with codecs browsers don't support
**Solution:** Re-encode with FFmpeg using H.264 baseline profile
**Time Required:** 10-15 minutes (one-time fix)
**Result:** All videos play perfectly in dashboard

**Next Steps:**
1. Install FFmpeg
2. Run `bash reencode-videos.sh`
3. Test dashboard
4. Enjoy working video comparison feature! 🎉
