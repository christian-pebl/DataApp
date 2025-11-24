import cv2
import os

VIDEO_DIR = "public/videos"

def reencode_video_h264(input_path, output_path, description):
    print(f"\nRe-encoding: {description}")
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return False

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"   {width}x{height} @ {fps:.2f} fps, {total_frames} frames")
    
    fourcc = cv2.VideoWriter_fourcc(*'avc1')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    if not out.isOpened():
        cap.release()
        return False
    
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        out.write(frame)
        frame_count += 1
        if frame_count % 50 == 0:
            print(f"   Progress: {frame_count}/{total_frames}", end="\r")
    
    print(f"   Complete!")
    cap.release()
    out.release()
    return True

videos = []
for f in os.listdir(VIDEO_DIR):
    if "_background_subtracted.mp4" in f or "_yolov8.mp4" in f:
        videos.append(f)

print(f"Found {len(videos)} videos to re-encode\n")

for filename in videos:
    input_path = os.path.join(VIDEO_DIR, filename)
    output_path = input_path.replace(".mp4", "_h264.mp4")
    if reencode_video_h264(input_path, output_path, filename):
        os.replace(output_path, input_path)

print("\n✅ Re-encoding complete!")
