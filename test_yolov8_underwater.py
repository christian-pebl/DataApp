"""
Test YOLOv8 on Algapelago benthic videos
Quick baseline detection test
"""

from ultralytics import YOLO
import cv2
from pathlib import Path
import json
from datetime import datetime

# Configuration
VIDEO_DIR = Path(r"G:\.shortcut-targets-by-id\1QkmI63Nho2bLYjVC4vWXRdDRruEV5-Zl\Ocean\08 - Data\01 - SubCam data\Alga\2025 Q3\Subcam_Alga_Farm_L_2506-2508-benthic")
OUTPUT_DIR = Path(r"C:\Users\Christian Abulhawa\DataApp\yolov8_test_results")
OUTPUT_DIR.mkdir(exist_ok=True)

# Test videos (one from each time of day)
TEST_VIDEOS = [
    "algapelago_1_2025-06-20_14-00-48.mp4",  # First video (afternoon)
    "algapelago_1_2025-06-25_10-00-48.mp4",  # Morning
    "algapelago_1_2025-06-25_12-00-48.mp4",  # Midday
]

def test_video(video_path, model, output_dir):
    """Test YOLOv8 on a single video"""
    print(f"\n{'='*80}")
    print(f"Processing: {video_path.name}")
    print(f"{'='*80}\n")

    # Run detection
    results = model.predict(
        source=str(video_path),
        save=True,
        save_txt=True,
        save_conf=True,
        conf=0.25,  # Lower confidence threshold for underwater
        iou=0.45,
        project=str(output_dir),
        name=video_path.stem,
        verbose=True,
        stream=True  # Process frame by frame
    )

    # Collect statistics
    stats = {
        'video_name': video_path.name,
        'total_frames': 0,
        'frames_with_detections': 0,
        'total_detections': 0,
        'detections_per_frame': [],
        'classes_detected': {},
        'avg_confidence': [],
        'processing_time': None
    }

    start_time = datetime.now()

    for result in results:
        stats['total_frames'] += 1

        if len(result.boxes) > 0:
            stats['frames_with_detections'] += 1
            stats['total_detections'] += len(result.boxes)
            stats['detections_per_frame'].append(len(result.boxes))

            # Track detected classes
            for box in result.boxes:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                confidence = float(box.conf[0])

                if class_name not in stats['classes_detected']:
                    stats['classes_detected'][class_name] = {'count': 0, 'avg_conf': []}

                stats['classes_detected'][class_name]['count'] += 1
                stats['classes_detected'][class_name]['avg_conf'].append(confidence)
                stats['avg_confidence'].append(confidence)

    end_time = datetime.now()
    stats['processing_time'] = (end_time - start_time).total_seconds()

    # Calculate averages
    if stats['total_detections'] > 0:
        stats['avg_detections_per_frame'] = sum(stats['detections_per_frame']) / len(stats['detections_per_frame'])
        stats['avg_confidence_overall'] = sum(stats['avg_confidence']) / len(stats['avg_confidence'])

        # Calculate per-class averages
        for class_name in stats['classes_detected']:
            conf_list = stats['classes_detected'][class_name]['avg_conf']
            stats['classes_detected'][class_name]['avg_confidence'] = sum(conf_list) / len(conf_list)
            del stats['classes_detected'][class_name]['avg_conf']  # Remove raw data
    else:
        stats['avg_detections_per_frame'] = 0
        stats['avg_confidence_overall'] = 0

    # Remove raw lists from final stats
    del stats['detections_per_frame']
    del stats['avg_confidence']

    return stats

def main():
    print("="*80)
    print("YOLOv8 Underwater Fish Detection Test")
    print("="*80)
    print(f"\nTest Videos: {len(TEST_VIDEOS)}")
    print(f"Output Directory: {OUTPUT_DIR}")
    print(f"\nLoading YOLOv8n model...")

    # Load YOLOv8 model (will download weights automatically)
    model = YOLO('yolov8n.pt')  # Start with nano for speed

    print(f"Model loaded successfully!")
    print(f"Model classes: {len(model.names)} classes")
    print(f"Relevant classes: {[name for i, name in model.names.items() if 'bird' in name.lower() or 'fish' in name.lower() or 'animal' in name.lower()]}")

    # Test each video
    all_stats = []

    for video_name in TEST_VIDEOS:
        video_path = VIDEO_DIR / video_name

        if not video_path.exists():
            print(f"\n⚠️  Video not found: {video_name}")
            continue

        try:
            stats = test_video(video_path, model, OUTPUT_DIR)
            all_stats.append(stats)

            # Print summary
            print(f"\n📊 Results for {video_name}:")
            print(f"   Total Frames: {stats['total_frames']}")
            print(f"   Frames with Detections: {stats['frames_with_detections']} ({stats['frames_with_detections']/stats['total_frames']*100:.1f}%)")
            print(f"   Total Detections: {stats['total_detections']}")
            print(f"   Avg Detections/Frame: {stats['avg_detections_per_frame']:.2f}")
            print(f"   Avg Confidence: {stats['avg_confidence_overall']:.2f}")
            print(f"   Processing Time: {stats['processing_time']:.1f}s")
            print(f"\n   Classes Detected:")
            for class_name, data in stats['classes_detected'].items():
                print(f"      {class_name}: {data['count']} detections (avg conf: {data['avg_confidence']:.2f})")

        except Exception as e:
            print(f"\n❌ Error processing {video_name}: {e}")
            import traceback
            traceback.print_exc()

    # Save summary
    summary_path = OUTPUT_DIR / 'test_summary.json'
    with open(summary_path, 'w') as f:
        json.dump({
            'test_date': datetime.now().isoformat(),
            'model': 'yolov8n',
            'total_videos_tested': len(all_stats),
            'results': all_stats
        }, f, indent=2)

    print(f"\n{'='*80}")
    print(f"✅ Testing Complete!")
    print(f"📁 Results saved to: {OUTPUT_DIR}")
    print(f"📄 Summary: {summary_path}")
    print(f"{'='*80}")

if __name__ == '__main__':
    main()
