# Computer Vision Scripts

Simple, reusable CV processing scripts for underwater video analysis.

---

## 1. Background Subtraction (Motion Detection)

**File:** `background_subtraction.py`

### What It Does

Removes the static background from underwater videos to highlight moving organisms (fish, crabs).

**Method:**
1. Takes all frames from a video (or first N seconds)
2. Subsamples (every 3rd or 6th frame) to reduce processing
3. Averages all pixels across time → **static background**
4. Subtracts this average from each frame → **only movement remains**

**Perfect For:**
- Benthic videos with static backgrounds
- Detecting slow-moving organisms
- Highlighting fish/crab activity
- Removing seaweed, rocks, sand from view

### Usage

#### Basic Usage (12 seconds, every 3rd frame)
```bash
python background_subtraction.py --input video.mp4 --output results/ --duration 12 --subsample 3
```

#### Full Video (every 6th frame)
```bash
python background_subtraction.py --input video.mp4 --subsample 6
```

#### With Comparison Frames
```bash
python background_subtraction.py --input video.mp4 --save-comparison --comparison-samples 20
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--input`, `-i` | Required | Input video path |
| `--output`, `-o` | `results/` | Output directory |
| `--duration`, `-d` | None (full video) | Process first N seconds |
| `--subsample`, `-s` | 3 | Process every Nth frame (3 = every 3rd frame) |
| `--max-frames`, `-m` | None | Maximum frames to process |
| `--normalize` | True | Normalize output to [0, 255] range |
| `--save-comparison`, `-c` | False | Save side-by-side comparison images |
| `--comparison-samples` | 10 | Number of comparison frames |

### Output Files

```
results/
├── video_name_background_subtracted.mp4    # Main output video
├── video_name_average_background.jpg       # The computed background
├── video_name_metadata.json                # Processing metadata
└── video_name_comparisons/                 # (if --save-comparison)
    ├── comparison_frame_0000.jpg
    ├── comparison_frame_0045.jpg
    └── ...
```

### Example

**Test on Algapelago video:**
```bash
python cv_scripts/background_subtraction.py \
  --input "G:/.shortcut-targets-by-id/.../algapelago_1_2025-06-20_14-00-48.mp4" \
  --output "results/background_subtraction/" \
  --duration 12 \
  --subsample 3 \
  --save-comparison
```

**Expected Result:**
- Video with background removed
- Fish and crabs appear as bright/dark regions
- Static elements (rocks, seaweed) mostly invisible
- Processing time: ~30-60 seconds for 12 seconds of video

### How It Works Technically

1. **Frame Loading:**
   ```python
   # Load frames with subsampling
   frames = load_video(path, subsample_rate=3)
   # Result: Every 3rd frame loaded (reduces processing by 67%)
   ```

2. **Average Background:**
   ```python
   # Compute temporal average
   avg_background = np.mean(all_frames, axis=0)
   # Result: Pixel-wise average across all frames
   ```

3. **Subtraction:**
   ```python
   # For each frame
   diff = frame - avg_background
   # Result: Positive diff = brighter than average (fish moved in)
   #         Negative diff = darker than average (shadow/fish moved out)
   ```

4. **Normalization:**
   ```python
   # Center around 128 (middle gray)
   output = diff + 128
   # Result: 0 difference = gray, movement = brighter/darker
   ```

### Interpretation

**In output video:**
- **Gray background** = No movement, matches average
- **White/bright regions** = Object appeared (fish swam into view)
- **Black/dark regions** = Object left (fish shadow or left frame)
- **Edges** = Organism boundaries (moving fish outline)

### Performance Tips

**For faster processing:**
- Use `--duration 12` instead of full video
- Increase `--subsample 6` or higher
- Use `--max-frames 300` to limit frame count

**For better quality:**
- Use `--subsample 1` (no subsampling, slower)
- Process full video `--duration None`
- Higher resolution videos work but take longer

### Limitations

1. **Requires static camera** - Camera movement will cause artifacts
2. **Slow-moving objects** - Very slow organisms might be averaged into background
3. **Lighting changes** - Gradual lighting shifts can cause issues
4. **Water movement** - Strong currents may create artifacts

### Integration with Data Processing Page

This script can be called from the Data Processing page:

```typescript
// Example integration
const result = await runCVScript({
  script: 'background_subtraction',
  videoPath: selectedVideo.path,
  params: {
    duration: 12,
    subsampleRate: 3,
    saveComparison: true
  }
});
```

### Future Enhancements

- [ ] Add Gaussian blur to reduce noise
- [ ] Support for region-of-interest (ROI) selection
- [ ] Adaptive background modeling (for lighting changes)
- [ ] Morphological operations (opening/closing)
- [ ] Motion heatmap generation
- [ ] Track detected movements over time
- [ ] Integration with YOLO detection (background subtraction → YOLO)

---

## 2. Motion Analysis (Activity Characterization)

**File:** `motion_analysis.py`

### What It Does

Analyzes background-subtracted videos to quantify movement patterns and organism activity.

**Metrics Computed:**
1. **Motion Energy** - Total amount of pixel deviation from neutral
2. **Motion Density** - Percentage of frame actively moving
3. **Organism Count** - Number of distinct moving blobs detected
4. **Size Distribution** - Small (<500px), medium (500-5000px), large (>5000px)
5. **Activity Heatmap** - Spatial distribution of movement
6. **Overall Activity Score** - Combined 0-100 metric for easy comparison

**Perfect For:**
- Comparing videos across time/location
- Prioritizing videos for YOLO processing
- Identifying optimal sampling times
- Quality control and validation
- Temporal pattern analysis

### Usage

#### Basic Usage (no visualization)
```bash
python motion_analysis.py --input video_background_subtracted.mp4 --no-viz
```

#### With Visualization
```bash
python motion_analysis.py --input video_background_subtracted.mp4 --output results/
```

#### Custom Parameters
```bash
python motion_analysis.py --input video.mp4 --motion-threshold 10 --organism-min-size 100 --organism-threshold 30
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--input`, `-i` | Required | Background-subtracted video path |
| `--output`, `-o` | `results/` | Output directory |
| `--motion-threshold` | 15 | Threshold for detecting moving pixels |
| `--organism-min-size` | 50 | Minimum blob size (pixels) |
| `--organism-max-size` | 50000 | Maximum blob size (pixels) |
| `--organism-threshold` | 30 | Threshold for organism detection |
| `--heatmap-resolution` | 50 | Heatmap grid resolution |
| `--no-viz` | False | Skip visualization generation |

### Output Files

```
results/
├── video_name_motion_analysis.json           # Complete metrics JSON
└── video_name_motion_analysis/               # (if viz enabled)
    ├── motion_energy_plot.png
    ├── motion_density_plot.png
    ├── organism_count_plot.png
    └── activity_heatmap.png
```

### Key Metrics Explained

#### Overall Activity Score (0-100)
Combined metric weighted as:
- Motion Energy: 30%
- Motion Density: 20%
- Organism Count: 30%
- Size Presence: 20%

**Interpretation:**
- **0-30** = Low activity (subtle benthic movement)
- **30-60** = Moderate activity (regular organism movement)
- **60-80** = High activity (frequent organisms)
- **80-100** = Very high activity (many large organisms)

#### Motion Energy
Sum of absolute pixel deviations from neutral gray (128).
- Higher values = more intense or widespread movement
- Normalized to 0-100 for activity score

#### Motion Density (%)
Percentage of pixels actively moving above threshold.
- Shows what portion of frame contains movement
- Average and peak values reported
- Example: 0.4% average, 39% peak

#### Organism Count
Number of distinct moving blobs detected using connected components.
- Uses morphological operations (opening, closing)
- Filters by size (min/max pixel area)
- Tracks small, medium, large distribution

#### Activity Heatmap
Spatial distribution of movement across the frame.
- Downsampled to 50x50 grid (configurable)
- Accumulates movement across all frames
- Shows "hotspots" and zone activity (top/middle/bottom)

### Example

**Test on background-subtracted video:**
```bash
python cv_scripts/motion_analysis.py \
  --input "results/SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4" \
  --output "results/" \
  --no-viz
```

**Expected Output:**
```
Activity Score: 45.0/100
Organisms Detected: 221
Average Motion Density: 0.41%
Peak Density: 0.60%
Processing time: 7.4s
```

### Comparison Use Case

Compare multiple videos to find most active:
```bash
# Process multiple videos
python motion_analysis.py --input video1_bg.mp4 --no-viz
python motion_analysis.py --input video2_bg.mp4 --no-viz
python motion_analysis.py --input video3_bg.mp4 --no-viz

# Compare results
cat results/*_motion_analysis.json | grep "overall_score"
```

**Result:**
- Video 1: 45.0/100 (221 organisms) ← Process with YOLO first!
- Video 2: 30.4/100 (7 organisms)
- Video 3: 30.0/100 (0 organisms) ← Skip or low priority

### Tuning Parameters

**If too many false detections:**
- Increase `--organism-threshold` (default: 30 → try 40)
- Increase `--organism-min-size` (default: 50 → try 100)

**If missing small organisms:**
- Decrease `--organism-threshold` (default: 30 → try 20)
- Decrease `--organism-min-size` (default: 50 → try 30)

**If detecting noise as organisms:**
- Increase `--motion-threshold` (default: 15 → try 20)
- Apply morphological filtering (in code)

### Integration with Data Processing Page

```typescript
// Example integration
const motionResults = await runCVScript({
  script: 'motion_analysis',
  videoPath: backgroundSubtractedVideo.path,
  params: {
    motionThreshold: 15,
    organismMinSize: 50,
    noViz: true
  }
});

// Use results for prioritization
if (motionResults.activity_score > 40) {
  console.log('High activity - prioritize for YOLO processing');
}
```

---

## 3. Batch Processing (Pipeline Automation)

**File:** `batch_process_videos.py`

### What It Does

Automates the complete pipeline for multiple videos:
1. Background subtraction on all raw videos
2. Motion analysis on all background-subtracted videos
3. Comparison report generation

**Perfect For:**
- Processing entire video datasets
- Time-of-day comparisons
- Site comparisons
- Seasonal analysis
- Quality control across multiple videos

### Usage

#### Process All Videos in Directory
```bash
python batch_process_videos.py \
  --input "path/to/videos/" \
  --output "results/" \
  --duration 30 \
  --subsample 6
```

#### Skip Background Subtraction (already done)
```bash
python batch_process_videos.py \
  --input "path/to/videos/" \
  --output "results/" \
  --skip-bg
```

#### Only Generate Comparison Report
```bash
python batch_process_videos.py \
  --input "." \
  --output "results/" \
  --report-only
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--input` | Required | Directory containing input videos |
| `--output` | `results/` | Output directory |
| `--duration` | 30 | Seconds to process from each video |
| `--subsample` | 6 | Process every Nth frame |
| `--skip-bg` | False | Skip background subtraction phase |
| `--skip-motion` | False | Skip motion analysis phase |
| `--report-only` | False | Only generate comparison report |

### Output Files

```
results/
├── BATCH_MOTION_ANALYSIS_COMPARISON.md       # Comprehensive comparison report
├── video1_background_subtracted.mp4
├── video1_background_subtracted_motion_analysis.json
├── video1_average_background.jpg
├── video1_metadata.json
├── video2_background_subtracted.mp4
├── video2_background_subtracted_motion_analysis.json
├── ...
```

### Comparison Report Contents

The generated markdown report includes:

1. **Quick Summary Table**
   - All videos sorted by activity score
   - Key metrics: organisms, density, peak events
   - Highlighted outliers

2. **Key Findings**
   - Average activity score across dataset
   - Total organisms detected
   - Videos with/without detections
   - Most active video identification

3. **Detailed Results**
   - Per-video breakdown
   - Component scores
   - Size distributions
   - Processing times

4. **Metrics Explanation**
   - How to interpret each metric
   - Use cases and applications
   - Parameter tuning guidance

### Example: Full Pipeline

**Process 7 Algapelago videos:**
```bash
python cv_scripts/batch_process_videos.py \
  --input "Labeled_Datasets/04_Algapelago_Test_Nov2024/ML test sample From Alga Nov24/input raw" \
  --duration 30 \
  --subsample 6 \
  --output results
```

**Expected Output:**
```
================================================================================
BATCH PROCESSING PIPELINE
================================================================================
Found 7 videos to process

PHASE 1: BACKGROUND SUBTRACTION (7 videos)
[1/7] SUBCAM_ALG_2020-01-26_09-00-40.mp4 ... ✓ 8.0s
[2/7] SUBCAM_ALG_2020-01-27_12-00-40.mp4 ... ✓ 8.5s
...

PHASE 2: MOTION ANALYSIS (7 videos)
[1/7] SUBCAM_ALG_2020-01-26_09-00-40_background_subtracted.mp4 ... ✓ 7.4s (45.0/100, 221 organisms)
[2/7] SUBCAM_ALG_2020-01-27_12-00-40_background_subtracted.mp4 ... ✓ 7.4s (30.0/100, 0 organisms)
...

PHASE 3: GENERATING COMPARISON REPORT
Loaded 10 motion analysis results
Comparison report: results/BATCH_MOTION_ANALYSIS_COMPARISON.md

BATCH PROCESSING COMPLETE!
================================================================================
```

### Real-World Example Results

**Dataset:** 10 Algapelago videos (7 SUBCAM + 3 test videos)

**Key Findings:**
- Average activity: 31.7/100
- Total organisms: 259 across all videos
- Detection success: 5/10 videos
- Most active: SUBCAM_ALG_2020-01-26_09-00-40 (45.0/100, 221 organisms)
- Extreme event: algapelago_1_2025-06-21_12-00-48 (39.47% peak density)

**Actionable Insights:**
1. Morning videos (09:00) show highest organism detection
2. Midday videos (12:00) show extreme motion events (large fish/shadows)
3. 5 videos suitable for YOLO processing
4. 5 videos low priority (no detections)

### Performance

**Processing Speed:**
- Background subtraction: ~8 seconds per 30-second video
- Motion analysis: ~7.5 seconds per video
- Total: ~15 seconds per video

**Example:**
- 10 videos × 15 seconds = 2.5 minutes total processing time

### Use Cases

1. **Time-of-Day Analysis**
   - Compare morning vs afternoon vs midday
   - Identify optimal sampling times

2. **Site Comparison**
   - Compare different farm locations
   - Assess relative organism activity

3. **Seasonal Trends**
   - Track activity changes over months
   - Identify environmental impacts

4. **Video Prioritization**
   - Process high-activity videos with YOLO first
   - Skip or deprioritize low-activity videos

5. **Quality Control**
   - Flag videos with unusual patterns
   - Identify equipment issues (low lighting, camera shake)

### Integration with Data Processing Page

```typescript
// Example: Batch process user's uploaded videos
const batchResults = await runBatchCVPipeline({
  videoDir: userProjectDir,
  duration: 30,
  subsampleRate: 6
});

// Display comparison report in UI
renderComparisonTable(batchResults.videos);

// Highlight top candidates for YOLO
const topVideos = batchResults.videos
  .filter(v => v.activityScore > 35)
  .sort((a, b) => b.activityScore - a.activityScore);

console.log(`Found ${topVideos.length} high-activity videos for YOLO processing`);
```

---

## Adding New CV Scripts

To add a new CV processing script:

1. Create Python file in `cv_scripts/`
2. Follow same structure (argparse, clear output, JSON metadata)
3. Add documentation to this README
4. Test on sample video
5. Integrate into Data Processing page UI

**Template structure:**
```python
def main():
    parser = argparse.ArgumentParser(description="...")
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', default='results/')
    # ... more args

    # 1. Load data
    # 2. Process
    # 3. Save results
    # 4. Save metadata (JSON)
    # 5. Print summary
```

---

**Last Updated:** January 24, 2025
**Maintainer:** CV/ML Team
