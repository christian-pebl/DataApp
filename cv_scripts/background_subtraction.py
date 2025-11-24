"""
Background Subtraction using Temporal Averaging

Takes a video, computes the average of all pixels across time (the "static background"),
then subtracts this average from each frame to highlight movement.

Perfect for underwater benthic videos where:
- Background is mostly static (rocks, sand, seaweed)
- Organisms move slowly (fish, crabs)
- You want to detect subtle movement

Usage:
    python background_subtraction.py --input video.mp4 --output results/ --duration 12 --subsample 3
"""

import cv2
import numpy as np
from pathlib import Path
import argparse
import json
from datetime import datetime


def load_frames(video_path, duration_seconds=None, subsample_rate=3, max_frames=None):
    """
    Load video frames with optional subsampling and duration limit.

    Args:
        video_path: Path to input video
        duration_seconds: Maximum video duration to process (None = entire video)
        subsample_rate: Take every Nth frame (3 = every 3rd frame)
        max_frames: Maximum number of frames to load (overrides duration)

    Returns:
        frames: List of numpy arrays (BGR images)
        fps: Original video FPS
        metadata: Dict with video info
    """
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Calculate how many frames to load
    if duration_seconds:
        frames_to_load = min(int(fps * duration_seconds), total_frames)
    else:
        frames_to_load = total_frames

    if max_frames:
        frames_to_load = min(frames_to_load, max_frames)

    print(f"Video Info:")
    print(f"  FPS: {fps:.2f}")
    print(f"  Total frames: {total_frames}")
    print(f"  Resolution: {width}x{height}")
    print(f"  Duration: {total_frames/fps:.1f}s")
    print(f"  Loading: {frames_to_load} frames (every {subsample_rate}th frame)")

    frames = []
    frame_indices = []
    frame_count = 0

    while frame_count < frames_to_load:
        ret, frame = cap.read()
        if not ret:
            break

        # Subsample: only keep every Nth frame
        if frame_count % subsample_rate == 0:
            frames.append(frame)
            frame_indices.append(frame_count)

        frame_count += 1

    cap.release()

    metadata = {
        'fps': fps,
        'total_frames': total_frames,
        'width': width,
        'height': height,
        'loaded_frames': len(frames),
        'subsample_rate': subsample_rate,
        'frame_indices': frame_indices
    }

    print(f"  Loaded: {len(frames)} frames")

    return frames, fps, metadata


def compute_average_background(frames):
    """
    Compute the temporal average of all frames (the "background").

    Args:
        frames: List of numpy arrays (BGR images)

    Returns:
        avg_background: Average image (float32)
    """
    print(f"\nComputing average background from {len(frames)} frames...")

    # Convert to float32 for averaging (prevents overflow)
    frames_float = [frame.astype(np.float32) for frame in frames]

    # Average all frames
    avg_background = np.mean(frames_float, axis=0)

    print(f"  Background computed: {avg_background.shape}, dtype: {avg_background.dtype}")
    print(f"  Value range: [{avg_background.min():.1f}, {avg_background.max():.1f}]")

    return avg_background


def subtract_background(frames, avg_background, normalize=True):
    """
    Subtract the average background from each frame.

    Args:
        frames: List of numpy arrays (BGR images)
        avg_background: Average background image (float32)
        normalize: If True, normalize output to [0, 255] range

    Returns:
        subtracted_frames: List of background-subtracted frames
    """
    print(f"\nSubtracting background from {len(frames)} frames...")

    subtracted_frames = []

    for i, frame in enumerate(frames):
        # Convert to float
        frame_float = frame.astype(np.float32)

        # Subtract background
        diff = frame_float - avg_background

        if normalize:
            # Shift and scale to [0, 255]
            # Add 128 to center around middle gray (0 difference = gray)
            normalized = diff + 128.0
            normalized = np.clip(normalized, 0, 255)
            subtracted = normalized.astype(np.uint8)
        else:
            # Just clip to [0, 255]
            subtracted = np.clip(diff, 0, 255).astype(np.uint8)

        subtracted_frames.append(subtracted)

        if (i + 1) % 100 == 0:
            print(f"  Processed {i+1}/{len(frames)} frames")

    print(f"  All frames processed")

    return subtracted_frames


def save_output_video(frames, output_path, fps, codec='mp4v'):
    """
    Save frames as a video file.

    Args:
        frames: List of numpy arrays
        output_path: Path to output video
        fps: Frames per second
        codec: Video codec (mp4v, XVID, H264, etc.)
    """
    print(f"\nSaving output video: {output_path}")

    if len(frames) == 0:
        print("  No frames to save!")
        return

    height, width = frames[0].shape[:2]

    fourcc = cv2.VideoWriter_fourcc(*codec)
    writer = cv2.VideoWriter(str(output_path), fourcc, fps, (width, height))

    for i, frame in enumerate(frames):
        writer.write(frame)
        if (i + 1) % 100 == 0:
            print(f"  Written {i+1}/{len(frames)} frames")

    writer.release()
    print(f"  Video saved: {len(frames)} frames at {fps:.2f} FPS")


def save_comparison_frames(original_frames, subtracted_frames, output_dir, num_samples=10):
    """
    Save side-by-side comparison images (original vs background-subtracted).

    Args:
        original_frames: List of original frames
        subtracted_frames: List of background-subtracted frames
        output_dir: Directory to save comparison images
        num_samples: Number of sample frames to save
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nSaving {num_samples} comparison frames to: {output_dir}")

    # Sample evenly across the video
    indices = np.linspace(0, len(original_frames) - 1, num_samples, dtype=int)

    for idx in indices:
        orig = original_frames[idx]
        sub = subtracted_frames[idx]

        # Stack horizontally
        comparison = np.hstack([orig, sub])

        output_path = output_dir / f"comparison_frame_{idx:04d}.jpg"
        cv2.imwrite(str(output_path), comparison)

    print(f"  Saved {num_samples} comparison frames")


def main():
    parser = argparse.ArgumentParser(
        description="Background subtraction using temporal averaging for motion detection"
    )
    parser.add_argument('--input', '-i', required=True, help='Input video path')
    parser.add_argument('--output', '-o', default='results/', help='Output directory')
    parser.add_argument('--duration', '-d', type=float, default=None,
                       help='Video duration to process in seconds (default: entire video)')
    parser.add_argument('--subsample', '-s', type=int, default=3,
                       help='Subsample rate: process every Nth frame (default: 3)')
    parser.add_argument('--max-frames', '-m', type=int, default=None,
                       help='Maximum number of frames to process (overrides duration)')
    parser.add_argument('--normalize', action='store_true', default=True,
                       help='Normalize output to [0, 255] range (default: True)')
    parser.add_argument('--save-comparison', '-c', action='store_true',
                       help='Save comparison frames (original vs subtracted)')
    parser.add_argument('--comparison-samples', type=int, default=10,
                       help='Number of comparison frames to save (default: 10)')

    args = parser.parse_args()

    # Setup paths
    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("="*80)
    print("Background Subtraction - Temporal Averaging")
    print("="*80)
    print(f"Input: {input_path}")
    print(f"Output: {output_dir}")
    print()

    # Step 1: Load frames
    start_time = datetime.now()
    frames, fps, metadata = load_frames(
        input_path,
        duration_seconds=args.duration,
        subsample_rate=args.subsample,
        max_frames=args.max_frames
    )

    if len(frames) == 0:
        print("ERROR: No frames loaded!")
        return

    # Step 2: Compute average background
    avg_background = compute_average_background(frames)

    # Save average background as image
    bg_path = output_dir / f"{input_path.stem}_average_background.jpg"
    cv2.imwrite(str(bg_path), avg_background.astype(np.uint8))
    print(f"  Saved average background: {bg_path}")

    # Step 3: Subtract background from all frames
    subtracted_frames = subtract_background(frames, avg_background, normalize=args.normalize)

    # Step 4: Save output video
    output_video_path = output_dir / f"{input_path.stem}_background_subtracted.mp4"

    # Adjust FPS based on subsampling
    output_fps = fps / args.subsample

    save_output_video(subtracted_frames, output_video_path, output_fps)

    # Step 5: Save comparison frames (optional)
    if args.save_comparison:
        comparison_dir = output_dir / f"{input_path.stem}_comparisons"
        save_comparison_frames(
            frames,
            subtracted_frames,
            comparison_dir,
            num_samples=args.comparison_samples
        )

    # Step 6: Save metadata
    end_time = datetime.now()
    processing_time = (end_time - start_time).total_seconds()

    result_metadata = {
        'input_video': str(input_path),
        'output_video': str(output_video_path),
        'average_background': str(bg_path),
        'processing_time_seconds': processing_time,
        'timestamp': datetime.now().isoformat(),
        'parameters': {
            'duration_seconds': args.duration,
            'subsample_rate': args.subsample,
            'max_frames': args.max_frames,
            'normalize': args.normalize
        },
        'video_metadata': metadata
    }

    metadata_path = output_dir / f"{input_path.stem}_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(result_metadata, f, indent=2)

    print(f"\n{'='*80}")
    print("PROCESSING COMPLETE")
    print(f"{'='*80}")
    print(f"Processing time: {processing_time:.1f}s")
    print(f"Output video: {output_video_path}")
    print(f"Average background: {bg_path}")
    print(f"Metadata: {metadata_path}")
    if args.save_comparison:
        print(f"Comparison frames: {comparison_dir}")
    print(f"{'='*80}")


if __name__ == '__main__':
    main()
