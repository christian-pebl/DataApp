'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Inline debounce function to avoid lodash dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

interface VideoComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoFilename: string;
  videoInfo: {
    filename: string;
    fps: number;
    resolution: { width: number; height: number };
    total_frames: number;
    duration_seconds: number;
  };
  activityScore: number;
  organisms: number;
  motionDensities?: number[];
  avgDensity?: number;
  maxDensity?: number;
}

interface YOLOv8Detection {
  frame: number;
  timestamp: number;
  count: number;
  objects: Array<{
    class_id: number;
    class_name: string;
    confidence: number;
    bbox: { x1: number; y1: number; x2: number; y2: number };
  }>;
}

export default function VideoComparisonModal({
  isOpen,
  onClose,
  videoFilename,
  videoInfo,
  activityScore,
  organisms,
  motionDensities,
  avgDensity = 0,
  maxDensity = 0,
}: VideoComparisonModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [motionVideoLoaded, setMotionVideoLoaded] = useState(false);
  const [yolov8VideoLoaded, setYolov8VideoLoaded] = useState(false);
  const [motionVideoError, setMotionVideoError] = useState(false);
  const [yolov8VideoError, setYolov8VideoError] = useState(false);
  const [yolov8Detections, setYolov8Detections] = useState<YOLOv8Detection[]>([]);
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [originalVideoDuration, setOriginalVideoDuration] = useState<number>(0);
  const [motionVideoDuration, setMotionVideoDuration] = useState<number>(0);
  const [yolov8VideoDuration, setYolov8VideoDuration] = useState<number>(0);
  const [isMotionIncomplete, setIsMotionIncomplete] = useState(false);
  const [isYolov8Incomplete, setIsYolov8Incomplete] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessLogs, setReprocessLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);

  // Estimation state
  const [showEstimation, setShowEstimation] = useState(false);
  const [estimationResults, setEstimationResults] = useState<any>(null);
  const [loadingEstimation, setLoadingEstimation] = useState(false);
  const [userHardware, setUserHardware] = useState<any>(null);

  const motionVideoRef = useRef<HTMLVideoElement>(null);
  const yolov8VideoRef = useRef<HTMLVideoElement>(null);
  const originalVideoRef = useRef<HTMLVideoElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Performance optimization refs
  const rafRef = useRef<number | null>(null);
  const pendingTimeRef = useRef<number>(0);
  const lastVideoSeekRef = useRef<number>(0);
  const lastSeekTimeRef = useRef<number>(0); // Timestamp of last video seek for throttling

  // Throttle rate for video seeking during scrubbing (~15fps = sustainable for most systems)
  const SEEK_THROTTLE_MS = 66;

  // Handle both cases: videoFilename with or without _background_subtracted suffix
  // Unified pipeline passes original filename, legacy passes background_subtracted filename
  const hasBackgroundSuffix = videoFilename.includes('_background_subtracted');
  const originalFilename = hasBackgroundSuffix
    ? videoFilename.replace('_background_subtracted.mp4', '.mp4')
    : videoFilename;
  const baseName = originalFilename.replace('.mp4', '');
  const motionFilename = hasBackgroundSuffix
    ? videoFilename
    : originalFilename.replace('.mp4', '_background_subtracted.mp4');
  const yolov8Filename = originalFilename.replace('.mp4', '_yolov8.mp4');

  // Video paths - motion video can be in either location
  const originalVideoPath = `/videos/${originalFilename}`;
  const yolov8VideoPath = `/videos/${yolov8Filename}`;

  // Motion video path state - check both old and new structure
  const [motionVideoPath, setMotionVideoPath] = useState(`/videos/${motionFilename}`);

  // Check which motion video path exists
  useEffect(() => {
    if (!isOpen) return;

    // Try new structure first (motion-analysis-results subdirectory)
    const newPath = `/motion-analysis-results/${baseName}/${motionFilename}`;
    const oldPath = `/videos/${motionFilename}`;

    fetch(newPath, { method: 'HEAD' })
      .then(res => {
        if (res.ok) {
          setMotionVideoPath(newPath);
          console.log('✅ Motion video found at new path:', newPath);
        } else {
          setMotionVideoPath(oldPath);
          console.log('📍 Using old motion video path:', oldPath);
        }
      })
      .catch(() => {
        setMotionVideoPath(oldPath);
        console.log('📍 Falling back to old motion video path:', oldPath);
      });
  }, [isOpen, baseName, motionFilename]);

  // Load YOLOv8 detection JSON data
  useEffect(() => {
    if (isOpen) {
      const detectionDataPath = `/motion-analysis-results/${originalFilename.replace('.mp4', '_yolov8.json')}`;

      fetch(detectionDataPath)
        .then(res => {
          if (!res.ok) throw new Error('YOLOv8 detection data not found');
          return res.json();
        })
        .then(data => {
          // Validate data structure
          if (!data || typeof data !== 'object') {
            throw new Error('Invalid detection data format');
          }

          // Ensure detections is an array
          const detections = Array.isArray(data.detections) ? data.detections : [];

          // Validate each detection has required fields
          const validDetections = detections.filter((d: YOLOv8Detection) =>
            d &&
            typeof d.frame === 'number' &&
            typeof d.timestamp === 'number' &&
            typeof d.count === 'number'
          );

          setYolov8Detections(validDetections);
          console.log('✅ YOLOV8 DETECTION DATA LOADED:', validDetections.length, 'frames');
        })
        .catch(err => {
          console.warn('⚠️ No YOLOv8 detection data found:', err.message);
          setYolov8Detections([]);
        });
    } else {
      // Reset when modal closes
      setYolov8Detections([]);
    }
  }, [isOpen, originalFilename]);

  // Validation logging when modal opens
  useEffect(() => {
    if (isOpen) {
      console.group('🎬 VIDEO MODAL OPENED');
      console.log('📂 Motion filename:', motionFilename);
      console.log('📂 YOLOv8 filename:', yolov8Filename);
      console.log('🔗 Motion path:', motionVideoPath);
      console.log('🔗 YOLOv8 path:', yolov8VideoPath);
      console.log('📊 Video info:', videoInfo);
      console.groupEnd();
    }
  }, [isOpen, motionFilename, yolov8Filename, motionVideoPath, yolov8VideoPath, videoInfo]);

  // Video load/error event handlers
  useEffect(() => {
    if (!isOpen) return;

    const motionVideo = motionVideoRef.current;
    const yolov8Video = yolov8VideoRef.current;
    const originalVideo = originalVideoRef.current;

    const handleMotionLoad = () => {
      console.log('✅ MOTION VIDEO LOADED:', motionVideoPath);
      console.log('   Duration:', motionVideo?.duration, 'seconds');
      console.log('   Video width:', motionVideo?.videoWidth);
      console.log('   Video height:', motionVideo?.videoHeight);
      setMotionVideoLoaded(true);
      setMotionVideoError(false);
      if (motionVideo?.duration) {
        setMotionVideoDuration(motionVideo.duration);
      }
    };

    const handleMotionError = (e: Event) => {
      console.error('❌ MOTION VIDEO FAILED TO LOAD:', motionVideoPath);
      console.error('   Error event:', e);
      console.error('   Video element:', motionVideo);
      console.error('   🔍 Check: Does this file exist in public/videos/?');
      setMotionVideoLoaded(false);
      setMotionVideoError(true);
    };

    const handleYolov8Load = () => {
      console.log('✅ YOLOV8 VIDEO LOADED:', yolov8VideoPath);
      console.log('   Duration:', yolov8Video?.duration, 'seconds');
      console.log('   Video width:', yolov8Video?.videoWidth);
      console.log('   Video height:', yolov8Video?.videoHeight);
      setYolov8VideoLoaded(true);
      setYolov8VideoError(false);
      if (yolov8Video?.duration) {
        setYolov8VideoDuration(yolov8Video.duration);
      }
    };

    const handleYolov8Error = (e: Event) => {
      console.warn('⚠️ YOLOV8 VIDEO FAILED TO LOAD:', yolov8VideoPath);
      console.warn('   Run process_videos_yolov8.py to generate YOLOv8 videos');
      setYolov8VideoLoaded(false);
      setYolov8VideoError(true);
    };

    const handleOriginalLoad = () => {
      console.log('✅ ORIGINAL VIDEO LOADED (for duration check):', originalVideoPath);
      console.log('   Duration:', originalVideo?.duration, 'seconds');
      if (originalVideo?.duration) {
        setOriginalVideoDuration(originalVideo.duration);
      }
    };

    const handleOriginalError = (e: Event) => {
      console.warn('⚠️ ORIGINAL VIDEO FAILED TO LOAD (for duration check):', originalVideoPath);
      // Not critical - we can still show the processed videos
    };

    if (motionVideo) {
      motionVideo.addEventListener('loadeddata', handleMotionLoad);
      motionVideo.addEventListener('error', handleMotionError);
    }

    if (yolov8Video) {
      yolov8Video.addEventListener('loadeddata', handleYolov8Load);
      yolov8Video.addEventListener('error', handleYolov8Error);
    }

    if (originalVideo) {
      originalVideo.addEventListener('loadeddata', handleOriginalLoad);
      originalVideo.addEventListener('error', handleOriginalError);
    }

    return () => {
      if (motionVideo) {
        motionVideo.removeEventListener('loadeddata', handleMotionLoad);
        motionVideo.removeEventListener('error', handleMotionError);
      }
      if (yolov8Video) {
        yolov8Video.removeEventListener('loadeddata', handleYolov8Load);
        yolov8Video.removeEventListener('error', handleYolov8Error);
      }
      if (originalVideo) {
        originalVideo.removeEventListener('loadeddata', handleOriginalLoad);
        originalVideo.removeEventListener('error', handleOriginalError);
      }
    };
  }, [isOpen, motionVideoPath, yolov8VideoPath, originalVideoPath]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setIsPlaying(false);
      setCurrentTime(0);
      setMotionVideoLoaded(false);
      setYolov8VideoLoaded(false);
      setMotionVideoError(false);
      setYolov8VideoError(false);
      setYolov8Detections([]);
      setReprocessLogs([]);
      setShowLogs(false);
      if (motionVideoRef.current) motionVideoRef.current.currentTime = 0;
      if (yolov8VideoRef.current) yolov8VideoRef.current.currentTime = 0;
    }
  }, [isOpen]);

  // Auto-scroll log viewer to bottom when new logs are added
  useEffect(() => {
    if (logContainerRef.current && showLogs) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [reprocessLogs, showLogs]);

  // Check for incomplete video processing
  useEffect(() => {
    // Only check once all three durations have been captured (or videos failed to load)
    if (originalVideoDuration === 0 && motionVideoDuration === 0 && yolov8VideoDuration === 0) {
      return; // Wait for videos to load
    }

    console.log('🔍 COMPLETENESS CHECK:');
    console.log('   Original duration:', originalVideoDuration, 'seconds');
    console.log('   Motion duration:', motionVideoDuration, 'seconds');
    console.log('   YOLOv8 duration:', yolov8VideoDuration, 'seconds');

    const TOLERANCE = 5; // Allow 5 second difference (to handle encoding variations)

    // Check motion video completeness
    if (originalVideoDuration > 0 && motionVideoDuration > 0) {
      const motionDiff = originalVideoDuration - motionVideoDuration;
      const isMotionShort = motionDiff > TOLERANCE;

      if (isMotionShort) {
        console.warn('⚠️ MOTION VIDEO INCOMPLETE:');
        console.warn(`   Original: ${originalVideoDuration}s, Motion: ${motionVideoDuration}s`);
        console.warn(`   Missing: ${motionDiff.toFixed(1)}s`);
        setIsMotionIncomplete(true);
      } else {
        setIsMotionIncomplete(false);
      }
    } else if (motionVideoError) {
      setIsMotionIncomplete(true); // If video failed to load, it needs reprocessing
    }

    // Check YOLOv8 video completeness
    if (originalVideoDuration > 0 && yolov8VideoDuration > 0) {
      const yolov8Diff = originalVideoDuration - yolov8VideoDuration;
      const isYolov8Short = yolov8Diff > TOLERANCE;

      if (isYolov8Short) {
        console.warn('⚠️ YOLOV8 VIDEO INCOMPLETE:');
        console.warn(`   Original: ${originalVideoDuration}s, YOLOv8: ${yolov8VideoDuration}s`);
        console.warn(`   Missing: ${yolov8Diff.toFixed(1)}s`);
        setIsYolov8Incomplete(true);
      } else {
        setIsYolov8Incomplete(false);
      }
    } else if (yolov8VideoError) {
      setIsYolov8Incomplete(true); // If video failed to load, it needs processing
    }
  }, [originalVideoDuration, motionVideoDuration, yolov8VideoDuration, motionVideoError, yolov8VideoError]);

  useEffect(() => {
    // Sync video time updates with high-frequency updates for smooth animation
    const updateTime = () => {
      if (motionVideoRef.current && !isNaN(motionVideoRef.current.currentTime)) {
        const newTime = motionVideoRef.current.currentTime;
        const newDuration = motionVideoRef.current.duration;

        // Only update if values are valid
        if (!isNaN(newTime)) {
          setCurrentTime(newTime);
        }
        if (!isNaN(newDuration) && newDuration > 0) {
          setDuration(newDuration);
        }
      }
    };

    // Also update duration from yolov8 video if motion video duration is invalid
    const updateDurationFromYolov8 = () => {
      if (yolov8VideoRef.current && !isNaN(yolov8VideoRef.current.duration)) {
        const yolov8Duration = yolov8VideoRef.current.duration;
        if (yolov8Duration > 0 && (isNaN(duration) || duration === 0)) {
          setDuration(yolov8Duration);
        }
      }
    };

    const motionVideo = motionVideoRef.current;
    const yolov8Video = yolov8VideoRef.current;

    if (motionVideo) {
      // Use multiple events to ensure we catch duration as soon as possible
      motionVideo.addEventListener('timeupdate', updateTime);
      motionVideo.addEventListener('loadedmetadata', updateTime);
      motionVideo.addEventListener('loadeddata', updateTime);
      motionVideo.addEventListener('durationchange', updateTime);
    }

    if (yolov8Video) {
      yolov8Video.addEventListener('loadedmetadata', updateDurationFromYolov8);
      yolov8Video.addEventListener('loadeddata', updateDurationFromYolov8);
      yolov8Video.addEventListener('durationchange', updateDurationFromYolov8);
    }

    return () => {
      if (motionVideo) {
        motionVideo.removeEventListener('timeupdate', updateTime);
        motionVideo.removeEventListener('loadedmetadata', updateTime);
        motionVideo.removeEventListener('loadeddata', updateTime);
        motionVideo.removeEventListener('durationchange', updateTime);
      }
      if (yolov8Video) {
        yolov8Video.removeEventListener('loadedmetadata', updateDurationFromYolov8);
        yolov8Video.removeEventListener('loadeddata', updateDurationFromYolov8);
        yolov8Video.removeEventListener('durationchange', updateDurationFromYolov8);
      }
    };
  }, [isOpen, duration]);

  const togglePlayPause = () => {
    if (isPlaying) {
      motionVideoRef.current?.pause();
      yolov8VideoRef.current?.pause();
    } else {
      // Sync time before playing
      if (motionVideoRef.current) {
        const targetTime = motionVideoRef.current.currentTime;
        if (yolov8VideoRef.current) {
          yolov8VideoRef.current.currentTime = targetTime;
        }
      }
      motionVideoRef.current?.play();
      yolov8VideoRef.current?.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (motionVideoRef.current) {
      motionVideoRef.current.muted = !isMuted;
    }
    if (yolov8VideoRef.current) {
      yolov8VideoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  // Debounced video seeking - only seek videos at ~30fps max to avoid overwhelming the decoder
  const debouncedVideoSeek = useMemo(
    () => debounce((time: number) => {
      if (motionVideoRef.current) motionVideoRef.current.currentTime = time;
      if (yolov8VideoRef.current) yolov8VideoRef.current.currentTime = time;
      lastVideoSeekRef.current = time;
    }, 32), // ~30fps
    []
  );

  // Immediate video seek (for final position on drag end or button clicks)
  const immediateVideoSeek = useCallback((time: number) => {
    debouncedVideoSeek.cancel(); // Cancel any pending debounced seek
    if (motionVideoRef.current) motionVideoRef.current.currentTime = time;
    if (yolov8VideoRef.current) yolov8VideoRef.current.currentTime = time;
    lastVideoSeekRef.current = time;
  }, [debouncedVideoSeek]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedVideoSeek.cancel();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [debouncedVideoSeek]);

  const skipBackward = () => {
    const newTime = Math.max(0, currentTime - 5);
    immediateVideoSeek(newTime); // Use immediate for button clicks
    setCurrentTime(newTime);
  };

  const skipForward = () => {
    const newTime = Math.min(duration, currentTime + 5);
    immediateVideoSeek(newTime); // Use immediate for button clicks
    setCurrentTime(newTime);
  };

  // Track if slider is being dragged
  const [isSliderDragging, setIsSliderDragging] = useState(false);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);

    // Validate the new time
    if (isNaN(newTime) || newTime < 0) return;

    const clampedTime = Math.min(newTime, duration || 120);
    const now = performance.now();

    // Store for final seek
    pendingTimeRef.current = clampedTime;

    // INSTANT: Update UI immediately
    setCurrentTime(clampedTime);

    // THROTTLED: Seek videos at sustainable rate (~15fps) during drag
    if (now - lastSeekTimeRef.current >= SEEK_THROTTLE_MS) {
      lastSeekTimeRef.current = now;
      if (motionVideoRef.current) motionVideoRef.current.currentTime = clampedTime;
      if (yolov8VideoRef.current) yolov8VideoRef.current.currentTime = clampedTime;
    }
  }, [duration]);

  // Handle slider drag start/end for optimized seeking
  const handleSliderMouseDown = useCallback(() => {
    setIsSliderDragging(true);
  }, []);

  const handleSliderMouseUp = useCallback(() => {
    if (isSliderDragging) {
      setIsSliderDragging(false);
      // Seek to final position immediately on release
      immediateVideoSeek(pendingTimeRef.current);
    }
  }, [isSliderDragging, immediateVideoSeek]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setReprocessLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleReprocess = async (type: 'motion' | 'yolov8' | 'both') => {
    setIsReprocessing(true);
    setReprocessLogs([]);
    setShowLogs(true);
    setProcessingStatus('Initializing...');

    try {
      addLog(`🔄 Starting ${type} reprocessing for ${originalFilename}`);
      addLog(`📹 Original video: ${originalFilename}`);
      addLog(`📊 Type: ${type.toUpperCase()}`);
      addLog('');
      addLog('📡 Sending request to server...');

      setProcessingStatus('Sending request to server...');

      const response = await fetch('/api/motion-analysis/reprocess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: originalFilename,
          type,
        }),
      });

      setProcessingStatus('Processing video...');

      const result = await response.json();

      if (result.success) {
        addLog('');
        addLog('✅ Server responded successfully!');
        addLog('');

        // Parse and display results from each step
        if (result.results && result.results.steps) {
          for (const step of result.results.steps) {
            // Update processing status based on step name
            if (step.name === 'background_subtraction') {
              setProcessingStatus('Computing background subtraction...');
            } else if (step.name === 'motion_analysis') {
              setProcessingStatus('Analyzing motion patterns...');
            } else if (step.name === 'yolov8_detection') {
              setProcessingStatus('Running YOLOv8 detection...');
            }

            addLog(`📝 Step: ${step.name}`);
            addLog(`   Status: ${step.success ? '✅ Success' : '❌ Failed'}`);

            if (step.stdout) {
              const stdoutLines = step.stdout.trim().split('\n');

              // Extract progress information from stdout
              let frameProgress = '';
              let processingTimeInfo = '';

              for (const line of stdoutLines) {
                // Look for frame processing progress
                if (line.includes('Processed') && line.includes('frames')) {
                  const match = line.match(/Processed (\d+)\/(\d+) frames/);
                  if (match) {
                    frameProgress = `Processing frames: ${match[1]}/${match[2]}`;
                    setProcessingStatus(frameProgress);
                  }
                } else if (line.includes('Background computed from')) {
                  const match = line.match(/(\d+) frames/);
                  if (match) {
                    setProcessingStatus(`Background computed from ${match[1]} frames`);
                  }
                } else if (line.includes('Processing time:')) {
                  const match = line.match(/Processing time: ([\d.]+)s/);
                  if (match) {
                    processingTimeInfo = `Completed in ${match[1]}s`;
                  }
                }
              }

              addLog('   📤 Output:');
              stdoutLines.forEach((line: string) => {
                if (line.trim()) addLog(`      ${line}`);
              });
            }

            if (step.stderr && step.stderr.trim()) {
              const stderrLines = step.stderr.trim().split('\n');
              addLog('   ⚠️  Warnings:');
              stderrLines.forEach((line: string) => {
                if (line.trim()) addLog(`      ${line}`);
              });
            }

            addLog('');
          }
        }

        setProcessingStatus('Completed successfully!');
        addLog('🎉 Reprocessing completed successfully!');
        addLog(`📁 Message: ${result.message}`);
        addLog('');
        addLog('ℹ️  Please refresh the page or reopen this video to see the updated results.');

        // Show success alert after a short delay
        setTimeout(() => {
          alert(`✅ Reprocessing complete!\n\n${result.message}\n\nPlease refresh the page or reopen this video to see the updated results.`);
          onClose();
        }, 1000);
      } else {
        setProcessingStatus('Failed');
        addLog('');
        addLog('❌ Reprocessing failed!');
        addLog(`   Error: ${result.error}`);

        if (result.stderr) {
          addLog('');
          addLog('🔍 Error details:');
          const errorLines = result.stderr.trim().split('\n');
          errorLines.forEach((line: string) => {
            if (line.trim()) addLog(`   ${line}`);
          });
        }

        if (result.stdout) {
          addLog('');
          addLog('📤 Output before error:');
          const outputLines = result.stdout.trim().split('\n');
          outputLines.forEach((line: string) => {
            if (line.trim()) addLog(`   ${line}`);
          });
        }

        alert(`❌ Reprocessing failed:\n\n${result.error}\n\nCheck the log panel for details.`);
      }
    } catch (error) {
      setProcessingStatus('Error occurred');
      addLog('');
      addLog('❌ Fatal error occurred!');
      addLog(`   ${error}`);
      addLog('');
      addLog('💡 This usually means the server is not responding.');
      addLog('   Check that the development server is running.');

      alert(`❌ Error during reprocessing:\n\n${error}\n\nCheck the log panel for details.`);
    } finally {
      setIsReprocessing(false);
      // Keep status visible for user to see what happened
    }
  };

  // Hardware detection
  const detectHardware = async () => {
    try {
      // Get client-side info
      const clientInfo = {
        cpuCores: navigator.hardwareConcurrency || 4,
        memory: (navigator as any).deviceMemory || 8,
        platform: navigator.platform,
        userAgent: navigator.userAgent,
      };

      // Send to server for GPU detection
      const response = await fetch('/api/hardware/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientInfo }),
      });

      const data = await response.json();
      if (data.success) {
        setUserHardware(data.hardware);
        return data.hardware;
      }
    } catch (error) {
      console.error('Hardware detection failed:', error);
    }
    return null;
  };

  // Estimate local inference
  const handleEstimateLocal = async () => {
    setLoadingEstimation(true);
    setShowEstimation(true);

    try {
      // Detect hardware if not already done
      let hardware = userHardware;
      if (!hardware) {
        hardware = await detectHardware();
      }

      // Get estimation
      const response = await fetch('/api/yolo/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: {
            width: videoInfo.resolution.width,
            height: videoInfo.resolution.height,
            fps: videoInfo.fps,
            durationSeconds: videoInfo.duration_seconds,
            totalFrames: videoInfo.total_frames,
          },
          hardware,
          mode: 'local',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setEstimationResults({ ...data, mode: 'local' });
      }
    } catch (error) {
      console.error('Estimation failed:', error);
    } finally {
      setLoadingEstimation(false);
    }
  };

  // Estimate Modal.ai cloud inference
  const handleEstimateModal = async (gpuType: 'T4' | 'A10G' = 'T4') => {
    setLoadingEstimation(true);
    setShowEstimation(true);

    try {
      const response = await fetch('/api/yolo/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: {
            width: videoInfo.resolution.width,
            height: videoInfo.resolution.height,
            fps: videoInfo.fps,
            durationSeconds: videoInfo.duration_seconds,
            totalFrames: videoInfo.total_frames,
          },
          mode: gpuType === 'A10G' ? 'modal-a10g' : 'modal-t4',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setEstimationResults({ ...data, mode: 'modal', gpuType });
      }
    } catch (error) {
      console.error('Estimation failed:', error);
    } finally {
      setLoadingEstimation(false);
    }
  };

  // Compare all processing options
  const handleCompareAll = async () => {
    setLoadingEstimation(true);
    setShowEstimation(true);

    try {
      let hardware = userHardware;
      if (!hardware) {
        hardware = await detectHardware();
      }

      const response = await fetch('/api/yolo/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video: {
            width: videoInfo.resolution.width,
            height: videoInfo.resolution.height,
            fps: videoInfo.fps,
            durationSeconds: videoInfo.duration_seconds,
            totalFrames: videoInfo.total_frames,
          },
          hardware,
          mode: 'compare', // Gets all options
        }),
      });

      const data = await response.json();
      if (data.success) {
        setEstimationResults({ ...data, mode: 'compare' });
      }
    } catch (error) {
      console.error('Estimation failed:', error);
    } finally {
      setLoadingEstimation(false);
    }
  };

  // Parse activity data for motion chart
  // Scale motion density timeline to match original video duration
  const activityData = useMemo(() => {
    if (!motionDensities || !Array.isArray(motionDensities)) {
      return [];
    }

    // Use videoInfo.duration_seconds as authoritative source, then actual duration, then fallback
    const numSamples = motionDensities.length;
    const videoDuration = videoInfo.duration_seconds || duration || 120;

    // Calculate time interval between samples
    // Motion densities are sampled evenly across the video duration
    const timeInterval = videoDuration / Math.max(1, numSamples);

    return motionDensities.map((density, index) => ({
      frame: index,
      time: index * timeInterval, // Time at start of each sample interval
      density: density * 100, // Convert to percentage
    }));
  }, [motionDensities, duration, videoInfo.duration_seconds]);

  // Parse YOLOv8 detection data for chart
  const yolov8Data = useMemo(() => {
    if (!yolov8Detections || yolov8Detections.length === 0) {
      return [];
    }

    return yolov8Detections.map(detection => ({
      frame: detection.frame,
      time: detection.timestamp,
      count: detection.count,
    }));
  }, [yolov8Detections]);

  // Combine both datasets for dual-axis chart
  const combinedTimelineData = useMemo(() => {
    const videoDuration = duration || 120;
    const timePoints = new Set<number>();

    // Safety check - if both arrays are empty, create minimal data points
    if (activityData.length === 0 && yolov8Data.length === 0) {
      return [
        { time: 0, density: 0, count: 0 },
        { time: videoDuration, density: 0, count: 0 }
      ];
    }

    // Collect all unique time points
    activityData.forEach(d => timePoints.add(Math.round(d.time * 10) / 10));
    yolov8Data.forEach(d => timePoints.add(Math.round(d.time * 10) / 10));

    // If no time points collected, create default ones
    if (timePoints.size === 0) {
      return [
        { time: 0, density: 0, count: 0 },
        { time: videoDuration, density: 0, count: 0 }
      ];
    }

    // Create data points for all times
    const sortedTimes = Array.from(timePoints).sort((a, b) => a - b);

    return sortedTimes.map(time => {
      // Find closest motion density point
      let density = 0;
      if (activityData.length > 0) {
        const motionPoint = activityData.reduce((prev, curr) =>
          Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev
        );
        density = motionPoint?.density || 0;
      }

      // Find yolov8 detections at this time
      let count = 0;
      if (yolov8Data.length > 0) {
        const yolov8Point = yolov8Data.find(d => Math.abs(d.time - time) < 0.5);
        count = yolov8Point?.count || 0;
      }

      return {
        time,
        density,
        count,
      };
    });
  }, [activityData, yolov8Data, duration]);

  // Handle click on activity chart to seek (immediate seek for single clicks)
  const handleChartClick = useCallback((data: any) => {
    if (isDraggingTimeline) return; // Ignore clicks during drag
    if (!data || !data.activePayload || !data.activePayload[0]) return;

    const payload = data.activePayload[0].payload;
    if (!payload || typeof payload.time !== 'number') return;

    const time = payload.time;
    const clampedTime = Math.max(0, Math.min(time, duration || 120));

    setCurrentTime(clampedTime);
    immediateVideoSeek(clampedTime); // Use immediate for single clicks
  }, [duration, isDraggingTimeline, immediateVideoSeek]);

  // Calculate time from mouse position on chart
  // Actual data range offset: 119px from each edge (includes chart margins + internal Bar padding)
  const calculateTimeFromMouseEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!chartContainerRef.current) return null;

    const rect = chartContainerRef.current.getBoundingClientRect();
    // Measured offset to "0s" tick position (includes container padding, chart margin, and Bar internal padding)
    const totalOffset = 119;

    const dataRangeWidth = rect.width - (totalOffset * 2);
    const clickX = e.clientX - rect.left - totalOffset;

    const percentage = Math.max(0, Math.min(1, clickX / dataRangeWidth));
    const newTime = percentage * (duration || 120);

    return Math.max(0, Math.min(newTime, duration || 120));
  }, [duration]);

  // Handle drag start on chart
  const handleChartMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDraggingTimeline(true);
    const time = calculateTimeFromMouseEvent(e);
    if (time !== null) {
      pendingTimeRef.current = time;
      setCurrentTime(time);
      debouncedVideoSeek(time); // Use debounced for drag start
    }
  }, [calculateTimeFromMouseEvent, debouncedVideoSeek]);

  // Handle drag on chart with RAF throttling + throttled video seeking
  // Videos update at ~15fps during drag for smooth visual feedback
  const handleChartMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingTimeline) return;

    const time = calculateTimeFromMouseEvent(e);
    if (time === null) return;

    // Store pending time
    pendingTimeRef.current = time;

    // Throttle updates with requestAnimationFrame
    if (rafRef.current) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const pendingTime = pendingTimeRef.current;
      const now = performance.now();

      // INSTANT: Update UI state immediately
      setCurrentTime(pendingTime);

      // THROTTLED: Seek videos at sustainable rate (~15fps)
      if (now - lastSeekTimeRef.current >= SEEK_THROTTLE_MS) {
        lastSeekTimeRef.current = now;
        if (motionVideoRef.current) motionVideoRef.current.currentTime = pendingTime;
        if (yolov8VideoRef.current) yolov8VideoRef.current.currentTime = pendingTime;
      }
    });
  }, [isDraggingTimeline, calculateTimeFromMouseEvent]);

  // Handle drag end - seek to final position immediately
  const handleChartMouseUp = useCallback(() => {
    if (isDraggingTimeline) {
      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      // Immediately seek to final position
      const finalTime = pendingTimeRef.current;
      immediateVideoSeek(finalTime);
      setCurrentTime(finalTime);
    }
    setIsDraggingTimeline(false);
  }, [isDraggingTimeline, immediateVideoSeek]);

  // Global mouse up handler to catch releases outside the chart
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingTimeline) {
        // Cancel any pending RAF
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }

        // Immediately seek to final position
        const finalTime = pendingTimeRef.current;
        immediateVideoSeek(finalTime);
        setCurrentTime(finalTime);
        setIsDraggingTimeline(false);
      }
    };

    if (isDraggingTimeline) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDraggingTimeline, immediateVideoSeek]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      {/* Invisible original video for duration check */}
      <video
        ref={originalVideoRef}
        src={originalVideoPath}
        preload="metadata"
        style={{ display: 'none' }}
      />

      <div className="bg-white rounded-lg shadow-2xl w-[98vw] max-w-[2000px] max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Video Comparison</h2>
            <p className="text-sm text-gray-600">
              {originalFilename} • Score: {activityScore.toFixed(1)} • Organisms: {organisms}
              {yolov8Detections.length > 0 && ` • YOLOv8 Detections: ${yolov8Detections.reduce((sum, d) => sum + d.count, 0)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Warning Banner for Incomplete Processing - Compact Version */}
        {(isMotionIncomplete || isYolov8Incomplete) && (
          <div className="bg-yellow-50 border-b border-yellow-400 px-3 py-1.5">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">
                <Info size={16} className="text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-semibold text-yellow-900 mb-0.5">
                  ⚠️ Incomplete Processing
                </h3>
                <div className="text-xs text-yellow-800 mb-1 space-y-0.5">
                  {isMotionIncomplete && (
                    <p>
                      • <strong>Motion Analysis:</strong> Only {motionVideoDuration.toFixed(0)}s processed
                      (expected {originalVideoDuration.toFixed(0)}s) - Missing {(originalVideoDuration - motionVideoDuration).toFixed(0)}s
                    </p>
                  )}
                  {isYolov8Incomplete && !yolov8VideoError && (
                    <p>
                      • <strong>YOLOv8 Detection:</strong> Only {yolov8VideoDuration.toFixed(0)}s processed
                      (expected {originalVideoDuration.toFixed(0)}s) - Missing {(originalVideoDuration - yolov8VideoDuration).toFixed(0)}s
                    </p>
                  )}
                  {isYolov8Incomplete && yolov8VideoError && (
                    <p>
                      • <strong>YOLOv8 Detection:</strong> Video not found or failed to load
                    </p>
                  )}
                </div>

                {/* Processing Status Display */}
                {isReprocessing && processingStatus && (
                  <div className="mb-1 flex items-center gap-2 text-xs text-yellow-900">
                    <div className="animate-spin h-3 w-3 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
                    <span className="font-medium">{processingStatus}</span>
                  </div>
                )}

                <div className="flex gap-1.5">
                  {isMotionIncomplete && isYolov8Incomplete && (
                    <button
                      onClick={() => handleReprocess('both')}
                      disabled={isReprocessing}
                      className="px-2 py-1 text-xs font-medium bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isReprocessing ? '⏳ Processing...' : '🔄 Reprocess Both'}
                    </button>
                  )}
                  {isMotionIncomplete && (
                    <button
                      onClick={() => handleReprocess('motion')}
                      disabled={isReprocessing}
                      className="px-2 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isReprocessing ? '⏳ Processing...' : '🔄 Reprocess Motion'}
                    </button>
                  )}
                  {isYolov8Incomplete && !showEstimation && (
                    <button
                      onClick={handleCompareAll}
                      disabled={isReprocessing || loadingEstimation}
                      className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      <Info size={12} />
                      {loadingEstimation ? 'Calculating...' : '⚡ Show Processing Options'}
                    </button>
                  )}
                </div>

                {/* Estimation Results Display */}
                {showEstimation && estimationResults && (
                  <div className="mt-2 p-2 bg-white rounded border border-blue-300">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-900">
                        🎯 YOLOv8 Processing Options - Local vs Cloud
                      </h4>
                      <button
                        onClick={() => setShowEstimation(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    {estimationResults.mode === 'compare' ? (
                      // Show comparison view
                      <div className="space-y-2">
                        {/* Local Option */}
                        {estimationResults.local && (
                          <div className="p-2 bg-blue-50 rounded border border-blue-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-blue-900">💻 Local Processing</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                estimationResults.local.confidence === 'high' ? 'bg-green-200 text-green-800' :
                                estimationResults.local.confidence === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                'bg-red-200 text-red-800'
                              }`}>
                                {estimationResults.local.confidence} confidence
                              </span>
                            </div>
                            <div className="text-xs text-gray-700 space-y-0.5">
                              <div className="flex justify-between">
                                <span>Estimated Time:</span>
                                <span className="font-semibold">{estimationResults.local.estimatedTimeFormatted}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Processing Speed:</span>
                                <span>{estimationResults.local.framesPerSecond} fps</span>
                              </div>
                              {estimationResults.local.notes.map((note: string, idx: number) => (
                                <div key={idx} className="text-[10px] text-gray-600">• {note}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Modal T4 Option */}
                        {estimationResults.cloud?.T4 && (
                          <div className="p-2 bg-purple-50 rounded border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-purple-900">☁️ Modal.ai T4 GPU</span>
                              <span className="text-xs font-semibold text-purple-900">
                                ${estimationResults.cloud.T4.estimatedCostUSD.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-700 space-y-0.5">
                              <div className="flex justify-between">
                                <span>Estimated Time:</span>
                                <span className="font-semibold">{estimationResults.cloud.T4.estimatedTimeFormatted}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Processing Speed:</span>
                                <span>{estimationResults.cloud.T4.framesPerSecond} fps</span>
                              </div>
                              {estimationResults.cloud.T4.notes.map((note: string, idx: number) => (
                                <div key={idx} className="text-[10px] text-gray-600">• {note}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Modal A10G Option */}
                        {estimationResults.cloud?.A10G && (
                          <div className="p-2 bg-purple-50 rounded border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-purple-900">☁️ Modal.ai A10G GPU</span>
                              <span className="text-xs font-semibold text-purple-900">
                                ${estimationResults.cloud.A10G.estimatedCostUSD.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-xs text-gray-700 space-y-0.5">
                              <div className="flex justify-between">
                                <span>Estimated Time:</span>
                                <span className="font-semibold">{estimationResults.cloud.A10G.estimatedTimeFormatted}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Processing Speed:</span>
                                <span>{estimationResults.cloud.A10G.framesPerSecond} fps</span>
                              </div>
                              {estimationResults.cloud.A10G.notes.map((note: string, idx: number) => (
                                <div key={idx} className="text-[10px] text-gray-600">• {note}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recommendation */}
                        {estimationResults.recommendation && (
                          <div className="p-2 bg-green-50 rounded border border-green-200">
                            <div className="text-xs text-green-900">
                              <span className="font-semibold">💡 Recommendation: </span>
                              {estimationResults.recommendation === 'local' && 'Use local processing'}
                              {estimationResults.recommendation === 'modal-t4' && 'Use Modal.ai T4 GPU (best balance)'}
                              {estimationResults.recommendation === 'modal-a10g' && 'Use Modal.ai A10G GPU (fastest)'}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-gray-200">
                          <div className="text-[10px] font-semibold text-gray-700 mb-0.5">Choose how to proceed:</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReprocess('yolov8')}
                              disabled={isReprocessing}
                              className="flex-1 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                            >
                              {isReprocessing ? '⏳ Processing...' : '💻 Use Local GPU'}
                            </button>
                            <button
                              onClick={() => alert('Modal.ai integration coming soon! See MODAL_AI_SETUP.md')}
                              className="flex-1 px-3 py-2 text-xs font-semibold bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors shadow-sm"
                            >
                              ☁️ Use Modal.ai Cloud
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Show single estimation result
                      <div className="text-xs text-gray-700 space-y-1">
                        <div className="flex justify-between">
                          <span>Estimated Time:</span>
                          <span className="font-semibold">
                            {estimationResults.local?.estimatedTimeFormatted || estimationResults.modal?.estimatedTimeFormatted}
                          </span>
                        </div>
                        {estimationResults.modal?.estimatedCostUSD && (
                          <div className="flex justify-between">
                            <span>Estimated Cost:</span>
                            <span className="font-semibold">${estimationResults.modal.estimatedCostUSD.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Processing Speed:</span>
                          <span>
                            {estimationResults.local?.framesPerSecond || estimationResults.modal?.framesPerSecond} fps
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Log Viewer - Compact Version */}
                {reprocessLogs.length > 0 && (
                  <div className="mt-1.5">
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="flex items-center gap-1.5 text-xs font-medium text-yellow-900 hover:text-yellow-700 transition-colors"
                    >
                      {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {showLogs ? 'Hide' : 'Show'} Log ({reprocessLogs.length} lines)
                    </button>

                    {showLogs && (
                      <div
                        ref={logContainerRef}
                        className="mt-1.5 bg-gray-900 rounded border border-yellow-600 p-2 max-h-48 overflow-y-auto"
                      >
                        <div className="font-mono text-xs text-green-400 space-y-0.5">
                          {reprocessLogs.map((log, index) => (
                            <div key={index} className="whitespace-pre-wrap break-all">
                              {log}
                            </div>
                          ))}
                        </div>
                        {isReprocessing && (
                          <div className="mt-1.5 flex items-center gap-2 text-yellow-400">
                            <div className="animate-spin h-3 w-3 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
                            <span className="text-xs">{processingStatus || 'Processing...'}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Players - Vertical Stack */}
        <div className="flex-1 flex flex-col gap-3 p-3 bg-gray-900 overflow-auto">
          {/* Motion Video */}
          <div className="flex flex-col">
            <div className="bg-gray-800 rounded-t-lg p-2">
              <h3 className="text-white font-semibold text-center text-sm">Motion Analysis</h3>
            </div>
            <div className="bg-black rounded-b-lg overflow-hidden flex items-center justify-center min-h-[300px] relative">
              <video
                ref={motionVideoRef}
                src={motionVideoPath}
                className="w-full h-auto max-h-[45vh]"
                muted={isMuted}
                preload="auto"
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {motionVideoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white p-4 text-center">
                  <X size={40} className="text-red-500 mb-3" />
                  <p className="font-bold mb-2 text-sm">Video Not Available</p>
                  <p className="text-xs text-gray-300">{motionFilename}</p>
                  <p className="text-xs text-gray-400 mt-1">Motion video incompatible with browser</p>
                  <p className="text-xs text-blue-400 mt-2">See FIX_VIDEO_CODECS.md</p>
                </div>
              )}
            </div>
          </div>

          {/* YOLOv8 Detection Video */}
          <div className="flex flex-col">
            <div className="bg-gray-800 rounded-t-lg p-2">
              <h3 className="text-white font-semibold text-center text-sm">YOLOv8 Detections</h3>
            </div>
            <div className="bg-black rounded-b-lg overflow-hidden flex items-center justify-center min-h-[300px] relative">
              <video
                ref={yolov8VideoRef}
                src={yolov8VideoPath}
                className="w-full h-auto max-h-[45vh]"
                muted={isMuted}
                preload="auto"
                playsInline
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {yolov8VideoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-90 text-white p-4 text-center">
                  <X size={40} className="text-yellow-500 mb-3" />
                  <p className="font-bold mb-2 text-sm">YOLOv8 Video Not Available</p>
                  <p className="text-xs text-gray-300">{yolov8Filename}</p>
                  <p className="text-xs text-gray-400 mt-1">Run process_videos_yolov8.py to generate</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Combined Timeline - Dual Axis with Integrated Scrubber */}
        <div className="bg-gray-50 border-t">
          {(activityData.length > 0 || yolov8Data.length > 0) && (
            <div className="px-4 py-3">
              <h3 className="text-xs font-semibold text-gray-700 mb-1">
                Motion Density & YOLOv8 Detections (click or drag to scrub)
              </h3>
              <div
                ref={chartContainerRef}
                className="bg-white p-2 rounded border relative select-none"
                style={{ cursor: isDraggingTimeline ? 'grabbing' : 'pointer' }}
                onMouseDown={handleChartMouseDown}
                onMouseMove={handleChartMouseMove}
                onMouseUp={handleChartMouseUp}
                onMouseLeave={handleChartMouseUp}
              >
                <ResponsiveContainer width="100%" height={160}>
                  <ComposedChart
                    data={combinedTimelineData}
                    onClick={handleChartClick}
                    margin={{ top: 10, right: 60, left: 60, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="time"
                      type="number"
                      domain={[0, Math.max(duration, 1)]}
                      tickFormatter={(value) => `${Math.floor(value)}s`}
                      stroke="#9ca3af"
                      style={{ fontSize: '10px' }}
                      allowDataOverflow={false}
                      padding={{ left: 0, right: 0 }}
                    />
                    {/* Left Y-axis for Motion Density */}
                    <YAxis
                      yAxisId="left"
                      stroke="#10b981"
                      style={{ fontSize: '10px' }}
                      width={50}
                      tickFormatter={(value) => `${value.toFixed(0)}%`}
                      label={{ value: 'Motion %', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: '10px', fill: '#10b981', fontWeight: 600 } }}
                    />
                    {/* Right Y-axis for YOLOv8 Count */}
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#3b82f6"
                      width={50}
                      style={{ fontSize: '10px' }}
                      label={{ value: 'Detections', angle: 90, position: 'insideRight', offset: -5, style: { fontSize: '10px', fill: '#3b82f6', fontWeight: 600 } }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const density = typeof payload[0]?.value === 'number' ? payload[0].value : 0;
                          const detections = typeof payload[1]?.value === 'number' ? payload[1].value : 0;
                          return (
                            <div className="bg-white p-2 border rounded shadow-lg text-xs">
                              <p className="font-semibold">Time: {formatTime(payload[0]?.payload?.time || 0)}</p>
                              <p className="text-green-600">Motion Density: {density.toFixed(2)}%</p>
                              <p className="text-blue-600">Detections: {detections}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    {/* Motion Density Area */}
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="density"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#activityGradient)"
                    />
                    {/* YOLOv8 Detection Bars */}
                    <Bar
                      yAxisId="right"
                      dataKey="count"
                      fill="#3b82f6"
                      fillOpacity={0.6}
                      barSize={4}
                    />
                  </ComposedChart>
                </ResponsiveContainer>

                {/* CSS-based position indicator - positioned within chart area */}
                {/* Actual data range offset: 119px from each edge (includes chart margins + internal Bar padding) */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    // Position calculation: offset from left edge + percentage of data range width
                    // Measured offset to "0s" tick: 119px, data range width: 100% - 238px
                    left: `calc(119px + (${currentTime / Math.max(duration, 1)} * (100% - 238px)))`,
                    top: '18px', // Top margin (10px) + container padding (8px)
                    bottom: '28px', // Bottom margin (20px) + container padding (8px)
                    width: '3px',
                    backgroundColor: '#ef4444',
                    transform: 'translateX(-50%)',
                    willChange: isDraggingTimeline ? 'left' : 'auto',
                    transition: isDraggingTimeline ? 'none' : 'left 0.05s ease-out',
                    zIndex: 10,
                  }}
                >
                  {/* Time label at top */}
                  <span
                    className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-bold text-red-600 whitespace-nowrap bg-white/90 px-1.5 py-0.5 rounded shadow-sm"
                  >
                    {formatTime(currentTime)}
                  </span>
                  {/* Playhead handle */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rounded-full shadow-md" />
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Video Controls - Compact */}
        <div className="px-3 py-2 border-t bg-gray-50">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={skipBackward}
              className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
              aria-label="Skip backward 5 seconds"
            >
              <SkipBack size={16} />
            </button>

            <button
              onClick={togglePlayPause}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              onClick={skipForward}
              className="p-1.5 bg-gray-200 hover:bg-gray-300 rounded-full transition-colors"
              aria-label="Skip forward 5 seconds"
            >
              <SkipForward size={16} />
            </button>

            {/* Video Info Button - Inline */}
            <div className="relative ml-3">
            <button
              onClick={() => setShowInfoPopup(!showInfoPopup)}
              className="flex items-center gap-2 p-2 bg-white hover:bg-gray-100 rounded border transition-colors text-xs"
              aria-label="Video information"
            >
              <Info size={16} className="text-blue-600" />
              <span className="font-semibold text-gray-700">Video Info</span>
            </button>

            {/* Info Popup */}
            {showInfoPopup && (
              <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-white border rounded-lg shadow-xl p-3 z-10 min-w-[300px]">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-sm text-gray-800">Video Specifications</h4>
                  <button
                    onClick={() => setShowInfoPopup(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-gray-600">Resolution</p>
                    <p className="font-semibold text-gray-900">{videoInfo.resolution.width}×{videoInfo.resolution.height}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">FPS</p>
                    <p className="font-semibold text-gray-900">{videoInfo.fps.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Frames</p>
                    <p className="font-semibold text-gray-900">{videoInfo.total_frames.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Duration</p>
                    <p className="font-semibold text-gray-900">{videoInfo.duration_seconds.toFixed(1)}s</p>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
