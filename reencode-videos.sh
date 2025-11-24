#!/bin/bash

# Re-encode Motion Analysis Videos for Web Compatibility
# This script fixes the codec incompatibility issue by re-encoding all
# background_subtracted videos with H.264 baseline profile

set -e  # Exit on error

echo "=================================="
echo "Motion Video Re-encoding Script"
echo "=================================="
echo ""

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ERROR: ffmpeg is not installed"
    echo ""
    echo "Please install ffmpeg first:"
    echo "  Windows: choco install ffmpeg"
    echo "  Mac: brew install ffmpeg"
    echo "  Linux: sudo apt-get install ffmpeg"
    echo ""
    exit 1
fi

echo "✅ ffmpeg found: $(ffmpeg -version | head -n1)"
echo ""

# Navigate to videos directory
cd "public/videos" || exit 1

# Create backup directory
if [ ! -d "backup" ]; then
    mkdir -p backup
    echo "📁 Created backup directory"
fi

# List of videos to re-encode
videos=(
    "SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4"
    "SUBCAM_ALG_2020-01-27_12-00-40_background_subtracted.mp4"
    "SUBCAM_ALG_2020-01-29_09-00-40_background_subtracted.mp4"
    "SUBCAM_ALG_2020-02-01_09-00-41_background_subtracted.mp4"
    "SUBCAM_ALG_2020-02-02_12-00-40_background_subtracted.mp4"
    "SUBCAM_ALG_2020-02-03_09-00-41_background_subtracted.mp4"
    "SUBCAM_ALG_2020-02-08_09-00-41_background_subtracted.mp4"
    "algapelago_1_2025-06-20_14-00-48_background_subtracted.mp4"
    "algapelago_1_2025-06-21_10-00-48_background_subtracted.mp4"
    "algapelago_1_2025-06-21_12-00-48_background_subtracted.mp4"
)

total=${#videos[@]}
current=0

echo "📊 Found $total videos to re-encode"
echo ""

for video in "${videos[@]}"; do
    ((current++))

    if [ ! -f "$video" ]; then
        echo "⚠️  [$current/$total] Skipping $video (file not found)"
        continue
    fi

    echo "🎬 [$current/$total] Processing: $video"

    # Backup original
    echo "   📦 Backing up original..."
    cp "$video" "backup/$video"

    # Temporary output file
    temp_file="${video%.mp4}_TEMP.mp4"

    # Get video duration for audio track
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$video" 2>/dev/null || echo "30")

    echo "   🔄 Re-encoding with web-compatible codec..."

    # Re-encode with web-compatible settings
    ffmpeg -i "$video" \
        -c:v libx264 \
        -profile:v baseline \
        -level 3.0 \
        -pix_fmt yuv420p \
        -movflags +faststart \
        -f lavfi -i "anullsrc=r=44100:cl=mono" -t "$duration" \
        -c:a aac -b:a 128k \
        -shortest \
        "$temp_file" \
        -y \
        -loglevel error 2>&1

    # Check if re-encoding was successful
    if [ $? -eq 0 ] && [ -f "$temp_file" ]; then
        # Replace original with re-encoded version
        mv "$temp_file" "$video"

        # Get file sizes
        original_size=$(du -h "backup/$video" | cut -f1)
        new_size=$(du -h "$video" | cut -f1)

        echo "   ✅ Success! ($original_size → $new_size)"
    else
        echo "   ❌ Failed to re-encode $video"
        # Restore from backup if re-encoding failed
        if [ -f "backup/$video" ]; then
            cp "backup/$video" "$video"
            echo "   ↩️  Restored from backup"
        fi
    fi

    echo ""
done

cd ../..

echo "=================================="
echo "✅ Re-encoding Complete!"
echo "=================================="
echo ""
echo "📊 Summary:"
echo "   Total videos: $total"
echo "   Backups saved to: public/videos/backup/"
echo ""
echo "🧪 Next Steps:"
echo "   1. Open dashboard: http://localhost:9002/motion-analysis"
echo "   2. Double-click any video to test"
echo "   3. Both videos should now play side-by-side"
echo ""
echo "🎉 All done! Your videos should now work in the browser."
