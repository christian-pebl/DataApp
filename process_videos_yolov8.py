"""
YOLOv8 Video Processing for Motion Analysis Dashboard

Processes all videos in public/videos with the trained underwater YOLOv8 model.
Generates:
1. Bounding box videos (*_yolov8.mp4) - Videos with detection boxes drawn
2. Detection JSON files (*_yolov8.json) - Frame-by-frame detection data for timeline

Usage:
    python process_videos_yolov8.py
"""

import os
import json
import cv2
from pathlib import Path
from ultralytics import YOLO
import numpy as np
from typing import List, Dict, Any

# Configuration
TRAINED_MODEL_PATH = "Labeled_Datasets/05_Models/Y12_11kL_12k(brackish)_E100_Augmented_best.pt"
INPUT_DIR = "public/videos"
OUTPUT_DIR = "public/videos"  # Save in same directory
DETECTION_DATA_DIR = "public/motion-analysis-results"  # Save detection JSON with motion analysis data

# Only process original videos (not background_subtracted or yolov8)
def is_original_video(filename: str) -> bool:
    """Check if this is an original video file (not processed)."""
    return (filename.endswith(".mp4") and
            "_background_subtracted" not in filename and
            "_yolov8" not in filename)

def load_model():
    """Load the trained YOLOv8 model."""
    print(f"Loading trained YOLOv8 model: {TRAINED_MODEL_PATH}")
    model = YOLO(TRAINED_MODEL_PATH)
    print(f"Model loaded! Classes: {model.names}")
    return model

def process_video(model: YOLO, video_path: str, output_video_path: str, output_json_path: str):
    """
    Process a video with YOLOv8 and generate bounding box video + detection data.

    Args:
        model: Trained YOLO model
        video_path: Path to input video
        output_video_path: Path for output video with bounding boxes
        output_json_path: Path for JSON detection data
    """
    print(f"\nProcessing: {os.path.basename(video_path)}")

    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"  ❌ Error: Could not open video {video_path}")
        return

    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"  📹 Video: {width}x{height} @ {fps:.2f} fps, {total_frames} frames, {duration:.1f}s")

    # Create video writer for bounding box video
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))

    if not out.isOpened():
        print(f"  ❌ Error: Could not create output video writer")
        cap.release()
        return

    # Detection data structure
    detection_data = {
        "video_filename": os.path.basename(video_path),
        "model": os.path.basename(TRAINED_MODEL_PATH),
        "fps": fps,
        "resolution": {"width": width, "height": height},
        "total_frames": total_frames,
        "duration_seconds": duration,
        "detections": []  # List of frame-level detections
    }

    frame_idx = 0
    detections_count = 0

    print(f"  🔄 Processing frames...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Run YOLOv8 detection
        results = model(frame, verbose=False)[0]

        # Extract detection data for this frame
        frame_detections = []

        if len(results.boxes) > 0:
            for box in results.boxes:
                # Get bounding box coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = model.names[class_id]

                # Store detection data
                frame_detections.append({
                    "class_id": class_id,
                    "class_name": class_name,
                    "confidence": confidence,
                    "bbox": {
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2
                    }
                })

                detections_count += 1

                # Draw bounding box on frame
                color = (0, 255, 0)  # Green
                thickness = 2
                cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), color, thickness)

                # Draw label
                label = f"{class_name} {confidence:.2f}"
                label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                label_y = int(y1) - 10 if y1 - 10 > label_size[1] else int(y1) + label_size[1] + 10

                cv2.rectangle(frame, (int(x1), label_y - label_size[1] - 5),
                            (int(x1) + label_size[0], label_y + 5), color, -1)
                cv2.putText(frame, label, (int(x1), label_y),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

        # Add frame detection data (even if empty)
        detection_data["detections"].append({
            "frame": frame_idx,
            "timestamp": frame_idx / fps if fps > 0 else 0,
            "count": len(frame_detections),
            "objects": frame_detections
        })

        # Write frame to output video
        out.write(frame)

        frame_idx += 1

        # Progress indicator
        if frame_idx % 100 == 0:
            progress = (frame_idx / total_frames) * 100
            print(f"    Progress: {progress:.1f}% ({frame_idx}/{total_frames} frames)", end="\r")

    print(f"    Progress: 100.0% ({total_frames}/{total_frames} frames)")

    # Release resources
    cap.release()
    out.release()

    # Save detection JSON
    with open(output_json_path, 'w') as f:
        json.dump(detection_data, f, indent=2)

    print(f"  ✅ Complete! {detections_count} detections across {total_frames} frames")
    print(f"  📹 Bounding box video: {output_video_path}")
    print(f"  📊 Detection data: {output_json_path}")

def main():
    """Process all original videos with YOLOv8."""
    print("="*80)
    print("YOLOv8 Video Processing for Motion Analysis Dashboard")
    print("="*80)
    print()

    # Load model
    try:
        model = load_model()
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        print(f"   Make sure {TRAINED_MODEL_PATH} exists")
        return

    # Find all original videos
    video_files = []
    for filename in os.listdir(INPUT_DIR):
        if is_original_video(filename):
            video_files.append(filename)

    if not video_files:
        print(f"❌ No original videos found in {INPUT_DIR}")
        return

    print(f"📂 Found {len(video_files)} videos to process:")
    for video in video_files:
        print(f"   - {video}")
    print()

    # Create output directories
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(DETECTION_DATA_DIR, exist_ok=True)

    # Process each video
    for i, filename in enumerate(video_files, 1):
        print(f"\n[{i}/{len(video_files)}] Processing: {filename}")

        # Input path
        input_path = os.path.join(INPUT_DIR, filename)

        # Output paths
        base_name = os.path.splitext(filename)[0]
        output_video_path = os.path.join(OUTPUT_DIR, f"{base_name}_yolov8.mp4")
        output_json_path = os.path.join(DETECTION_DATA_DIR, f"{base_name}_yolov8.json")

        # Process video
        try:
            process_video(model, input_path, output_video_path, output_json_path)
        except Exception as e:
            print(f"  ❌ Error processing {filename}: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "="*80)
    print("✅ All videos processed!")
    print("="*80)
    print()
    print("Next steps:")
    print("  1. Check public/videos/ for *_yolov8.mp4 videos")
    print("  2. Check public/motion-analysis-results/ for *_yolov8.json detection data")
    print("  3. Open dashboard: http://localhost:9002/motion-analysis")
    print("  4. Double-click any video to see 3-way comparison (original, motion, YOLOv8)")

if __name__ == "__main__":
    main()
