"""
Motion Analysis for Background-Subtracted Videos

Analyzes movement patterns in background-subtracted underwater videos to characterize:
- Overall activity level
- Number and size of moving organisms
- Speed and direction of movement
- Spatial and temporal activity patterns

Outputs quantitative metrics for comparing videos and detecting activity patterns.

Usage:
    python motion_analysis.py --input video_background_subtracted.mp4 --output results/
"""

import cv2
import numpy as np
from pathlib import Path
import argparse
import json
from datetime import datetime
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle


def load_video_frames(video_path):
    """Load all frames from video."""
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"Loading video: {video_path.name}")
    print(f"  FPS: {fps:.2f}")
    print(f"  Total frames: {total_frames}")
    print(f"  Resolution: {width}x{height}")

    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)

    cap.release()
    print(f"  Loaded {len(frames)} frames")

    return frames, fps, (width, height)


def compute_motion_energy(frames):
    """
    Compute total motion energy across all frames.

    Motion energy = how much deviation from gray (128) exists.
    Higher energy = more movement.
    """
    print("\nComputing motion energy...")

    motion_energies = []

    for i, frame in enumerate(frames):
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Motion energy = sum of abs(pixel - 128)
        # 128 = neutral (no movement), deviations = movement
        energy = np.sum(np.abs(gray.astype(float) - 128.0))
        motion_energies.append(energy)

    total_energy = sum(motion_energies)
    avg_energy = np.mean(motion_energies)
    max_energy = np.max(motion_energies)

    print(f"  Total motion energy: {total_energy:,.0f}")
    print(f"  Average per frame: {avg_energy:,.0f}")
    print(f"  Peak frame energy: {max_energy:,.0f}")

    return {
        'motion_energies': motion_energies,
        'total_energy': float(total_energy),
        'avg_energy': float(avg_energy),
        'max_energy': float(max_energy),
        'std_energy': float(np.std(motion_energies))
    }


def compute_motion_density(frames, threshold=15):
    """
    Compute motion density (% of pixels actively moving).

    Motion density = % of pixels deviating significantly from neutral gray.
    """
    print(f"\nComputing motion density (threshold: {threshold})...")

    motion_densities = []

    for frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Binary mask: pixels deviating > threshold from neutral
        deviation = np.abs(gray.astype(float) - 128.0)
        moving_pixels = np.sum(deviation > threshold)
        total_pixels = gray.size

        density = (moving_pixels / total_pixels) * 100.0
        motion_densities.append(density)

    avg_density = np.mean(motion_densities)
    max_density = np.max(motion_densities)

    print(f"  Average motion density: {avg_density:.2f}%")
    print(f"  Peak density: {max_density:.2f}%")

    return {
        'motion_densities': motion_densities,
        'avg_density': float(avg_density),
        'max_density': float(max_density),
        'threshold': threshold
    }


def detect_organisms(frames, min_size=50, max_size=50000, threshold=30):
    """
    Detect and count moving organisms (blobs) in each frame.

    Uses connected components to find distinct moving objects.
    """
    print(f"\nDetecting organisms (size: {min_size}-{max_size} pixels, threshold: {threshold})...")

    blob_counts = []
    blob_sizes_all = []
    blob_centroids_all = []

    for i, frame in enumerate(frames):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Binary threshold: significant movement
        deviation = np.abs(gray.astype(float) - 128.0)
        _, binary = cv2.threshold(deviation.astype(np.uint8), threshold, 255, cv2.THRESH_BINARY)

        # Morphological operations to clean up noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

        # Find connected components (blobs)
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary, connectivity=8)

        # Filter by size
        frame_blobs = []
        frame_blob_sizes = []
        frame_centroids = []

        for label in range(1, num_labels):  # Skip background (0)
            size = stats[label, cv2.CC_STAT_AREA]
            if min_size <= size <= max_size:
                frame_blobs.append(label)
                frame_blob_sizes.append(size)
                frame_centroids.append(centroids[label].tolist())

        blob_counts.append(len(frame_blobs))
        blob_sizes_all.extend(frame_blob_sizes)
        blob_centroids_all.append(frame_centroids)

        if (i + 1) % 50 == 0:
            print(f"  Processed {i+1}/{len(frames)} frames")

    avg_count = np.mean(blob_counts)
    max_count = np.max(blob_counts)
    total_detections = sum(blob_counts)

    print(f"  Total organism detections: {total_detections}")
    print(f"  Average per frame: {avg_count:.2f}")
    print(f"  Peak simultaneous: {max_count}")

    # Size distribution
    if len(blob_sizes_all) > 0:
        size_stats = {
            'small': sum(1 for s in blob_sizes_all if s < 500),
            'medium': sum(1 for s in blob_sizes_all if 500 <= s < 5000),
            'large': sum(1 for s in blob_sizes_all if s >= 5000),
            'mean_size': float(np.mean(blob_sizes_all)),
            'median_size': float(np.median(blob_sizes_all)),
            'std_size': float(np.std(blob_sizes_all))
        }
    else:
        size_stats = {
            'small': 0,
            'medium': 0,
            'large': 0,
            'mean_size': 0.0,
            'median_size': 0.0,
            'std_size': 0.0
        }

    print(f"  Size distribution:")
    print(f"    Small (< 500px): {size_stats['small']}")
    print(f"    Medium (500-5000px): {size_stats['medium']}")
    print(f"    Large (> 5000px): {size_stats['large']}")

    return {
        'blob_counts': blob_counts,
        'blob_sizes': blob_sizes_all,
        'blob_centroids': blob_centroids_all,
        'total_detections': total_detections,
        'avg_count': float(avg_count),
        'max_count': int(max_count),
        'size_distribution': size_stats,
        'parameters': {
            'min_size': min_size,
            'max_size': max_size,
            'threshold': threshold
        }
    }


def compute_activity_heatmap(frames, resolution=(50, 50)):
    """
    Generate spatial heatmap showing where activity concentrates.
    """
    print(f"\nComputing activity heatmap (resolution: {resolution})...")

    height, width = frames[0].shape[:2]
    heatmap = np.zeros(resolution, dtype=np.float32)

    for frame in frames:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Motion mask
        deviation = np.abs(gray.astype(float) - 128.0)
        motion = (deviation > 15).astype(np.uint8)

        # Downsample to heatmap resolution
        motion_small = cv2.resize(motion, (resolution[1], resolution[0]), interpolation=cv2.INTER_AREA)

        heatmap += motion_small

    # Normalize
    heatmap = (heatmap / len(frames)) * 100.0  # Convert to percentage

    # Find hotspots
    max_activity = np.max(heatmap)
    hotspot_coords = np.unravel_index(np.argmax(heatmap), heatmap.shape)

    print(f"  Peak activity: {max_activity:.2f}% at position {hotspot_coords}")

    # Zone analysis (divide into bottom, middle, top thirds)
    third = resolution[0] // 3
    bottom_activity = np.mean(heatmap[2*third:, :])
    middle_activity = np.mean(heatmap[third:2*third, :])
    top_activity = np.mean(heatmap[:third, :])

    print(f"  Zone activity:")
    print(f"    Top: {top_activity:.2f}%")
    print(f"    Middle: {middle_activity:.2f}%")
    print(f"    Bottom: {bottom_activity:.2f}%")

    return {
        'heatmap': heatmap.tolist(),
        'resolution': resolution,
        'max_activity': float(max_activity),
        'hotspot_coords': (int(hotspot_coords[0]), int(hotspot_coords[1])),
        'zone_activity': {
            'top': float(top_activity),
            'middle': float(middle_activity),
            'bottom': float(bottom_activity)
        }
    }


def compute_overall_activity_score(motion_data, organism_data, density_data):
    """
    Compute a single 0-100 activity score combining multiple metrics.

    Higher score = more activity.
    """
    print("\nComputing overall activity score...")

    # Normalize metrics to 0-100 range

    # 1. Motion energy (normalize by frame count and size)
    energy_score = min(100, (motion_data['avg_energy'] / 50000) * 100)

    # 2. Motion density
    density_score = min(100, density_data['avg_density'] * 5)  # Scale up since typical density is low

    # 3. Organism count
    count_score = min(100, organism_data['avg_count'] * 20)  # Scale by expected max organisms

    # 4. Size presence (large organisms = more activity)
    size_score = min(100, (organism_data['size_distribution']['medium'] +
                            organism_data['size_distribution']['large'] * 2) / 10)

    # Combined score (weighted average)
    weights = {
        'energy': 0.3,
        'density': 0.2,
        'count': 0.3,
        'size': 0.2
    }

    overall_score = (
        energy_score * weights['energy'] +
        density_score * weights['density'] +
        count_score * weights['count'] +
        size_score * weights['size']
    )

    print(f"  Component scores:")
    print(f"    Motion energy: {energy_score:.1f}/100")
    print(f"    Motion density: {density_score:.1f}/100")
    print(f"    Organism count: {count_score:.1f}/100")
    print(f"    Size presence: {size_score:.1f}/100")
    print(f"  Overall Activity Score: {overall_score:.1f}/100")

    return {
        'overall_score': float(overall_score),
        'component_scores': {
            'energy': float(energy_score),
            'density': float(density_score),
            'count': float(count_score),
            'size': float(size_score)
        },
        'weights': weights
    }


def generate_visualizations(results, output_dir, video_name):
    """Generate visualization plots."""
    print("\nGenerating visualizations...")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Activity timeline
    fig, axes = plt.subplots(3, 1, figsize=(12, 10))

    frames_axis = range(len(results['motion']['motion_energies']))

    # Motion energy over time
    axes[0].plot(frames_axis, results['motion']['motion_energies'], color='blue', linewidth=1.5)
    axes[0].set_title('Motion Energy Over Time', fontsize=14, fontweight='bold')
    axes[0].set_xlabel('Frame')
    axes[0].set_ylabel('Energy')
    axes[0].grid(True, alpha=0.3)
    axes[0].axhline(results['motion']['avg_energy'], color='red', linestyle='--', label='Average')
    axes[0].legend()

    # Motion density over time
    axes[1].plot(frames_axis, results['density']['motion_densities'], color='green', linewidth=1.5)
    axes[1].set_title('Motion Density Over Time', fontsize=14, fontweight='bold')
    axes[1].set_xlabel('Frame')
    axes[1].set_ylabel('Density (%)')
    axes[1].grid(True, alpha=0.3)
    axes[1].axhline(results['density']['avg_density'], color='red', linestyle='--', label='Average')
    axes[1].legend()

    # Organism count over time
    axes[2].plot(frames_axis, results['organisms']['blob_counts'], color='orange', linewidth=1.5)
    axes[2].set_title('Organism Count Over Time', fontsize=14, fontweight='bold')
    axes[2].set_xlabel('Frame')
    axes[2].set_ylabel('Count')
    axes[2].grid(True, alpha=0.3)
    axes[2].axhline(results['organisms']['avg_count'], color='red', linestyle='--', label='Average')
    axes[2].legend()

    plt.tight_layout()
    timeline_path = output_dir / f"{video_name}_activity_timeline.png"
    plt.savefig(timeline_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Saved timeline: {timeline_path}")

    # 2. Activity heatmap
    fig, ax = plt.subplots(figsize=(12, 8))
    heatmap_data = np.array(results['heatmap']['heatmap'])
    im = ax.imshow(heatmap_data, cmap='hot', aspect='auto', origin='upper')
    ax.set_title('Spatial Activity Heatmap', fontsize=14, fontweight='bold')
    ax.set_xlabel('Horizontal Position')
    ax.set_ylabel('Vertical Position (Top → Bottom)')

    # Add zone labels
    third = heatmap_data.shape[0] // 3
    ax.axhline(third, color='cyan', linestyle='--', linewidth=2, alpha=0.7)
    ax.axhline(2*third, color='cyan', linestyle='--', linewidth=2, alpha=0.7)
    ax.text(heatmap_data.shape[1] * 0.95, third // 2, 'TOP',
            color='white', fontsize=12, fontweight='bold', ha='right', va='center')
    ax.text(heatmap_data.shape[1] * 0.95, third + third // 2, 'MIDDLE',
            color='white', fontsize=12, fontweight='bold', ha='right', va='center')
    ax.text(heatmap_data.shape[1] * 0.95, 2*third + third // 2, 'BOTTOM',
            color='white', fontsize=12, fontweight='bold', ha='right', va='center')

    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('Activity (%)', rotation=270, labelpad=20)

    heatmap_path = output_dir / f"{video_name}_heatmap.png"
    plt.savefig(heatmap_path, dpi=150, bbox_inches='tight')
    plt.close()
    print(f"  Saved heatmap: {heatmap_path}")

    # 3. Size distribution histogram
    if len(results['organisms']['blob_sizes']) > 0:
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.hist(results['organisms']['blob_sizes'], bins=50, color='purple', alpha=0.7, edgecolor='black')
        ax.set_title('Organism Size Distribution', fontsize=14, fontweight='bold')
        ax.set_xlabel('Size (pixels)')
        ax.set_ylabel('Count')
        ax.axvline(500, color='red', linestyle='--', label='Small/Medium threshold')
        ax.axvline(5000, color='orange', linestyle='--', label='Medium/Large threshold')
        ax.legend()
        ax.grid(True, alpha=0.3)

        size_dist_path = output_dir / f"{video_name}_size_distribution.png"
        plt.savefig(size_dist_path, dpi=150, bbox_inches='tight')
        plt.close()
        print(f"  Saved size distribution: {size_dist_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Analyze movement patterns in background-subtracted videos"
    )
    parser.add_argument('--input', '-i', required=True, help='Input background-subtracted video')
    parser.add_argument('--output', '-o', default='results/', help='Output directory')
    parser.add_argument('--min-size', type=int, default=50, help='Minimum organism size (pixels)')
    parser.add_argument('--max-size', type=int, default=50000, help='Maximum organism size (pixels)')
    parser.add_argument('--motion-threshold', type=int, default=15,
                       help='Motion detection threshold (deviation from gray)')
    parser.add_argument('--no-viz', action='store_true', help='Skip visualization generation')

    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("="*80)
    print("Motion Analysis - Background-Subtracted Video")
    print("="*80)
    print(f"Input: {input_path}")
    print(f"Output: {output_dir}")
    print()

    start_time = datetime.now()

    # Load video
    frames, fps, (width, height) = load_video_frames(input_path)

    if len(frames) == 0:
        print("ERROR: No frames loaded!")
        return

    # Analyze motion
    motion_data = compute_motion_energy(frames)
    density_data = compute_motion_density(frames, threshold=args.motion_threshold)
    organism_data = detect_organisms(frames,
                                     min_size=args.min_size,
                                     max_size=args.max_size,
                                     threshold=args.motion_threshold + 15)
    heatmap_data = compute_activity_heatmap(frames)
    activity_score = compute_overall_activity_score(motion_data, organism_data, density_data)

    # Combine results
    results = {
        'video_info': {
            'filename': input_path.name,
            'fps': fps,
            'resolution': {'width': width, 'height': height},
            'total_frames': len(frames),
            'duration_seconds': len(frames) / fps
        },
        'motion': motion_data,
        'density': density_data,
        'organisms': organism_data,
        'heatmap': heatmap_data,
        'activity_score': activity_score,
        'processing_time_seconds': (datetime.now() - start_time).total_seconds(),
        'timestamp': datetime.now().isoformat()
    }

    # Save JSON results
    results_path = output_dir / f"{input_path.stem}_motion_analysis.json"

    # Remove large arrays from JSON (save separately if needed)
    json_results = results.copy()
    json_results['motion']['motion_energies'] = f"<{len(motion_data['motion_energies'])} values>"
    json_results['density']['motion_densities'] = f"<{len(density_data['motion_densities'])} values>"
    json_results['organisms']['blob_counts'] = f"<{len(organism_data['blob_counts'])} values>"
    json_results['organisms']['blob_sizes'] = f"<{len(organism_data['blob_sizes'])} values>"
    json_results['organisms']['blob_centroids'] = f"<{len(organism_data['blob_centroids'])} frames>"
    json_results['heatmap']['heatmap'] = f"<{len(heatmap_data['heatmap'])}x{len(heatmap_data['heatmap'][0])} array>"

    with open(results_path, 'w') as f:
        json.dump(json_results, f, indent=2)

    print(f"\n{'='*80}")
    print("MOTION ANALYSIS COMPLETE")
    print(f"{'='*80}")
    print(f"Processing time: {results['processing_time_seconds']:.1f}s")
    print(f"Activity Score: {activity_score['overall_score']:.1f}/100")
    print(f"Results saved: {results_path}")

    # Generate visualizations
    if not args.no_viz:
        generate_visualizations(results, output_dir, input_path.stem)

    print(f"{'='*80}")


if __name__ == '__main__':
    main()
