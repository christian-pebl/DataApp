'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Clock, DollarSign, Cpu, Zap, Settings, ChevronDown, ChevronUp, Cloud, Sliders } from 'lucide-react';
import {
  parseGPUName,
  type HardwareSpecs,
} from '@/lib/yolo-inference-estimator';
import BenthicActivitySettingsDialog, { type BenthicActivityParams } from './BenthicActivitySettingsDialog';

interface PendingVideo {
  id: string;
  filename: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  duration_seconds: number | null;
  total_frames: number | null;
}

type GpuType = 'modal-t4' | 'modal-a10g' | 'modal-a100';

interface ProcessingSettings {
  gpuType: GpuType;
  targetFps: 'all' | '15' | '10' | '5';
  enableMotionAnalysis: boolean;
  enableYolo: boolean;
  yoloModel: 'yolov8n' | 'yolov8m' | 'yolov8l';
  enableBenthicActivity: boolean;
  benthicActivityParams: BenthicActivityParams | null;
}

type RunType = 'local' | GpuType;

interface ProcessingEstimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingVideos: PendingVideo[];
  onStartProcessing: (runType: RunType) => void;
  onProcessingStarted?: (runId: string, estimatedTime?: string, estimatedCost?: string) => void;
}

const PROCESSING_SPEEDS: Record<string, { motionAnalysis: number; yolov8n: number; yolov8m: number; yolov8l: number }> = {
  'modal-t4': { motionAnalysis: 25, yolov8n: 45, yolov8m: 30, yolov8l: 18 },
  'modal-a10g': { motionAnalysis: 40, yolov8n: 80, yolov8m: 55, yolov8l: 35 },
  'modal-a100': { motionAnalysis: 60, yolov8n: 140, yolov8m: 110, yolov8l: 70 },
  local: { motionAnalysis: 15, yolov8n: 20, yolov8m: 12, yolov8l: 6 },
};

const MODAL_COSTS: Record<GpuType, number> = {
  'modal-t4': 0.000164,    // $0.59/hr
  'modal-a10g': 0.000306,  // $1.10/hr
  'modal-a100': 0.000917,  // $3.30/hr
};

const GPU_LABELS: Record<GpuType, string> = {
  'modal-t4': 'T4',
  'modal-a10g': 'A10G',
  'modal-a100': 'A100',
};

const DEFAULT_CRAB_PARAMS: CrabDetectionParams = {
  threshold: 25,
  min_area: 50,
  max_area: 8000,
  min_circularity: 0.2,
  max_aspect_ratio: 4.0,
  morph_kernel_size: 5,
  max_distance: 50.0,
  max_skip_frames: 5,
  min_track_length: 3,
  min_displacement: 5.0,
  min_speed: 0.05,
  max_speed: 100.0,
};

const DEFAULT_SETTINGS: ProcessingSettings = {
  gpuType: 'modal-a10g',  // A10G is best value (faster than T4, same or lower cost per job)
  targetFps: '10',
  enableMotionAnalysis: true,
  enableYolo: true,
  yoloModel: 'yolov8m',
  enableCrabDetection: false,
  crabDetectionParams: DEFAULT_CRAB_PARAMS,
};

export default function ProcessingEstimationModal({
  isOpen,
  onClose,
  pendingVideos,
  onStartProcessing,
  onProcessingStarted,
}: ProcessingEstimationModalProps) {
  const [isLoadingEstimates, setIsLoadingEstimates] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [hardware, setHardware] = useState<HardwareSpecs | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showLocalOption, setShowLocalOption] = useState(false);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);
  const [historicalBenchmarks, setHistoricalBenchmarks] = useState<{
    local?: { avgFps: number; sampleCount: number };
    'modal-t4'?: { avgFps: number; sampleCount: number };
    'modal-a10g'?: { avgFps: number; sampleCount: number };
  } | null>(null);
  const [showCrabSettingsDialog, setShowCrabSettingsDialog] = useState(false);

  // Video selection state - all unprocessed videos selected by default
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());

  // Initialize selected videos when modal opens or pendingVideos changes
  React.useEffect(() => {
    if (isOpen && pendingVideos.length > 0) {
      setSelectedVideoIds(new Set(pendingVideos.map(v => v.id)));
    }
  }, [isOpen, pendingVideos]);

  // Get selected videos for processing
  const selectedVideos = pendingVideos.filter(v => selectedVideoIds.has(v.id));

  // Toggle video selection
  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  // Toggle all videos
  const toggleAllVideos = () => {
    if (selectedVideoIds.size === pendingVideos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(pendingVideos.map(v => v.id)));
    }
  };

  const calculateEstimates = useCallback(() => {
    let totalFramesToProcess = 0;
    let totalDuration = 0;

    // Use only selected videos for estimates
    selectedVideos.forEach((video) => {
      if (!video.fps || !video.total_frames || !video.duration_seconds) return;
      totalDuration += video.duration_seconds;
      if (settings.targetFps === 'all') {
        totalFramesToProcess += video.total_frames;
      } else {
        const targetFps = parseInt(settings.targetFps);
        const sampledFrames = Math.ceil(video.duration_seconds * targetFps);
        totalFramesToProcess += Math.min(sampledFrames, video.total_frames);
      }
    });

    const gpuSpeeds = PROCESSING_SPEEDS[settings.gpuType];
    let modalProcessingTime = 0;
    if (settings.enableMotionAnalysis) {
      const historicalFps = historicalBenchmarks?.[settings.gpuType]?.avgFps;
      modalProcessingTime += totalFramesToProcess / (historicalFps || gpuSpeeds.motionAnalysis);
    }
    if (settings.enableYolo) {
      modalProcessingTime += totalFramesToProcess / gpuSpeeds[settings.yoloModel];
    }
    const modalCost = modalProcessingTime * MODAL_COSTS[settings.gpuType];

    const localSpeeds = PROCESSING_SPEEDS.local;
    let localProcessingTime = 0;
    if (settings.enableMotionAnalysis) {
      const historicalFps = historicalBenchmarks?.local?.avgFps;
      localProcessingTime += totalFramesToProcess / (historicalFps || localSpeeds.motionAnalysis);
    }
    if (settings.enableYolo) {
      localProcessingTime += totalFramesToProcess / localSpeeds[settings.yoloModel];
    }

    return {
      modal: {
        timeSeconds: modalProcessingTime,
        costUsd: modalCost,
        framesPerSecond: totalFramesToProcess / modalProcessingTime || 0,
      },
      local: {
        timeSeconds: localProcessingTime,
        framesPerSecond: totalFramesToProcess / localProcessingTime || 0,
      },
      totalFrames: totalFramesToProcess,
      totalDuration,
    };
  }, [selectedVideos, settings, historicalBenchmarks]);

  const estimates = calculateEstimates();

  useEffect(() => {
    if (isOpen && pendingVideos.length > 0) {
      detectHardwareAndFetchBenchmarks();
    }
  }, [isOpen, pendingVideos]);

  const detectHardwareAndFetchBenchmarks = async () => {
    setIsLoadingEstimates(true);
    try {
      const [benchmarksRes, hardwareRes] = await Promise.all([
        fetch('/api/motion-analysis/benchmarks').then((r) => r.json()).catch(() => null),
        fetch('/api/hardware/detect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientInfo: { cpuCores: navigator.hardwareConcurrency || 4, userAgent: navigator.userAgent } }),
        }).then((r) => r.json()).catch(() => null),
      ]);
      if (benchmarksRes?.success && benchmarksRes?.hasHistoricalData) {
        setHistoricalBenchmarks(benchmarksRes.benchmarks);
      }
      if (hardwareRes?.success) {
        const gpuParsed = parseGPUName(hardwareRes.hardware.gpu);
        setHardware({
          gpuName: gpuParsed.name,
          gpuVramGb: gpuParsed.vram,
          cpuCores: hardwareRes.hardware.cpuCores,
          ramGb: hardwareRes.hardware.memory,
          platform: hardwareRes.hardware.platform,
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoadingEstimates(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '—';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const handleStartProcessing = async (runType: RunType) => {
    console.log('='.repeat(80));
    console.log('[ProcessingModal] Starting processing...');
    console.log(`  Run type: ${runType}`);
    console.log(`  Selected videos: ${selectedVideos.length} of ${pendingVideos.length}`);
    console.log(`  Settings:`, settings);
    console.log('='.repeat(80));

    if (selectedVideos.length === 0) {
      alert('Please select at least one video to process');
      return;
    }

    setIsStarting(true);
    try {
      const videoIds = selectedVideos.map((v) => v.id);
      console.log('[ProcessingModal] Video IDs to process:', videoIds);

      const requestBody = {
        videoIds,
        runType,
        settings: {
          targetFps: settings.targetFps,
          enableMotionAnalysis: settings.enableMotionAnalysis,
          enableYolo: settings.enableYolo,
          yoloModel: settings.yoloModel,
          enableCrabDetection: settings.enableCrabDetection,
          crabDetectionParams: settings.crabDetectionParams,
        },
      };
      console.log('[ProcessingModal] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('/api/motion-analysis/process/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('[ProcessingModal] Response status:', response.status);
      const result = await response.json();
      console.log('[ProcessingModal] Response body:', result);

      if (result.success) {
        console.log('[ProcessingModal] SUCCESS - Processing started');
        console.log(`  Run ID: ${result.runId}`);
        console.log(`  Log file: ${result.logFile}`);
        console.log(`  Videos to process: ${result.videosToProcess}`);

        const estTime = runType === 'local' ? formatTime(estimates.local.timeSeconds) : formatTime(estimates.modal.timeSeconds);
        const estCost = runType !== 'local' ? `$${estimates.modal.costUsd.toFixed(2)}` : undefined;
        console.log(`  Estimated time: ${estTime}`);
        console.log(`  Estimated cost: ${estCost || 'N/A'}`);

        if (onProcessingStarted) onProcessingStarted(result.runId, estTime, estCost);
        onClose();
        onStartProcessing(runType);
      } else {
        console.error('[ProcessingModal] FAILED - Processing not started');
        console.error(`  Error: ${result.error}`);
        alert(`Failed to start processing: ${result.error}`);
      }
    } catch (error) {
      console.error('[ProcessingModal] EXCEPTION during processing start:', error);
      alert('Failed to start processing. Please try again.');
    } finally {
      setIsStarting(false);
      console.log('[ProcessingModal] Processing start attempt complete');
    }
  };

  if (!isOpen) return null;

  const isProcessingDisabled = (!settings.enableMotionAnalysis && !settings.enableYolo && !settings.enableCrabDetection) || selectedVideos.length === 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-lg w-full max-w-md shadow-xl border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Cloud size={16} className="text-blue-400" />
            <span className="text-sm font-medium text-gray-200">Process Videos</span>
            <span className="text-xs text-gray-500">
              {selectedVideos.length} of {pendingVideos.length} selected
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-800 rounded transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {isLoadingEstimates ? (
          <div className="px-4 py-8 flex flex-col items-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <p className="text-xs text-gray-500">Calculating estimates...</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Cloud Processing */}
            <div className="border border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-blue-400" />
                  <span className="text-sm font-medium text-gray-200">Cloud GPU</span>
                  <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded">
                    {GPU_LABELS[settings.gpuType]}
                  </span>
                </div>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1 hover:bg-gray-800 rounded transition-colors"
                >
                  <Settings size={14} className="text-gray-500" />
                </button>
              </div>

              {/* Estimates */}
              <div className="flex items-center gap-4 mb-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-gray-500" />
                  <span className="text-gray-400">Time</span>
                  <span className="text-gray-200 font-medium">{formatTime(estimates.modal.timeSeconds)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <DollarSign size={12} className="text-gray-500" />
                  <span className="text-gray-400">Cost</span>
                  <span className="text-green-400 font-medium">${estimates.modal.costUsd.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className="text-gray-500" />
                  <span className="text-gray-200 font-medium">{estimates.modal.framesPerSecond.toFixed(0)} fps</span>
                </div>
              </div>

              {/* Settings Panel */}
              {showSettings && (
                <div className="bg-[#151515] rounded p-3 mb-3 space-y-3 text-xs">
                  {/* GPU */}
                  <div>
                    <label className="text-gray-500 mb-1.5 block">GPU</label>
                    <div className="flex gap-1.5">
                      {(['modal-t4', 'modal-a10g', 'modal-a100'] as const).map((gpu) => (
                        <button
                          key={gpu}
                          onClick={() => setSettings({ ...settings, gpuType: gpu })}
                          className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
                            settings.gpuType === gpu
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {GPU_LABELS[gpu]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                      {settings.gpuType === 'modal-t4' && 'Budget option • $0.59/hr'}
                      {settings.gpuType === 'modal-a10g' && 'Best value • $1.10/hr'}
                      {settings.gpuType === 'modal-a100' && 'Fastest • $3.30/hr'}
                    </p>
                  </div>

                  {/* Frame Rate */}
                  <div>
                    <label className="text-gray-500 mb-1.5 block">Frame Rate</label>
                    <div className="flex gap-1.5">
                      {(['all', '15', '10', '5'] as const).map((fps) => (
                        <button
                          key={fps}
                          onClick={() => setSettings({ ...settings, targetFps: fps })}
                          className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
                            settings.targetFps === fps
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {fps === 'all' ? 'All' : `${fps}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Analysis Types */}
                  <div>
                    <label className="text-gray-500 mb-1.5 block">Analysis Types</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.enableMotionAnalysis}
                          onChange={(e) => setSettings({ ...settings, enableMotionAnalysis: e.target.checked })}
                          className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-600"
                        />
                        <span className="text-gray-400">Motion Analysis</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.enableYolo}
                          onChange={(e) => setSettings({ ...settings, enableYolo: e.target.checked })}
                          className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-600"
                        />
                        <span className="text-gray-400">YOLO Detection</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={settings.enableCrabDetection}
                            onChange={(e) => setSettings({ ...settings, enableCrabDetection: e.target.checked })}
                            className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-orange-600"
                          />
                          <span className="text-gray-400">Crab Detection</span>
                        </label>
                        {settings.enableCrabDetection && (
                          <button
                            onClick={() => setShowCrabSettingsDialog(true)}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                            title="Configure crab detection settings"
                          >
                            <Sliders size={12} className="text-orange-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* YOLO Model */}
                  {settings.enableYolo && (
                    <div>
                      <label className="text-gray-500 mb-1.5 block">YOLO Model</label>
                      <div className="flex gap-1.5">
                        {(['yolov8n', 'yolov8m', 'yolov8l'] as const).map((model) => (
                          <button
                            key={model}
                            onClick={() => setSettings({ ...settings, yoloModel: model })}
                            className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
                              settings.yoloModel === model
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                          >
                            {model === 'yolov8n' ? 'Nano' : model === 'yolov8m' ? 'Medium' : 'Large'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={() => handleStartProcessing(settings.gpuType)}
                disabled={isStarting || isProcessingDisabled}
                className="w-full px-3 py-2 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isStarting ? 'Starting...' : 'Start Processing'}
              </button>

              {isProcessingDisabled && (
                <p className="text-[10px] text-red-400 text-center mt-1.5">
                  {selectedVideos.length === 0 ? 'Select at least one video' : 'Select at least one analysis type'}
                </p>
              )}
            </div>

            {/* Local Processing */}
            <button
              onClick={() => setShowLocalOption(!showLocalOption)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-500 hover:text-gray-400 hover:bg-gray-800/50 rounded transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Cpu size={12} />
                <span>Local (Free)</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{formatTime(estimates.local.timeSeconds)}</span>
                {showLocalOption ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
            </button>

            {showLocalOption && (
              <div className="border border-gray-800 rounded p-3">
                {hardware && (
                  <p className="text-[10px] text-gray-500 mb-2">
                    {hardware.gpuName} • {hardware.cpuCores} cores
                  </p>
                )}
                <button
                  onClick={() => handleStartProcessing('local')}
                  disabled={isStarting || isProcessingDisabled}
                  className="w-full px-3 py-1.5 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 disabled:opacity-50 transition-colors"
                >
                  {isStarting ? 'Starting...' : 'Start Local'}
                </button>
              </div>
            )}

            {/* Videos */}
            <details className="text-xs" open>
              <summary className="text-gray-500 cursor-pointer hover:text-gray-400 py-1">
                {selectedVideos.length} of {pendingVideos.length} video{pendingVideos.length > 1 ? 's' : ''} selected • {estimates.totalFrames.toLocaleString()} frames
              </summary>
              <div className="mt-2 space-y-1">
                {/* Select All */}
                <label className="flex items-center gap-2 py-1 px-1 hover:bg-gray-800/50 rounded cursor-pointer border-b border-gray-800 pb-2 mb-1">
                  <input
                    type="checkbox"
                    checked={selectedVideoIds.size === pendingVideos.length}
                    onChange={toggleAllVideos}
                    className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-600"
                  />
                  <span className="text-gray-400 font-medium">Select All</span>
                </label>
                {/* Video List */}
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {pendingVideos.map((video) => (
                    <label key={video.id} className="flex items-center gap-2 py-1 px-1 hover:bg-gray-800/50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.has(video.id)}
                        onChange={() => toggleVideoSelection(video.id)}
                        className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-blue-600 flex-shrink-0"
                      />
                      <span className={`truncate flex-1 ${selectedVideoIds.has(video.id) ? 'text-gray-300' : 'text-gray-600'}`}>
                        {video.filename}
                      </span>
                      <span className="ml-2 text-gray-600 text-[10px] flex-shrink-0">
                        {video.total_frames?.toLocaleString()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Crab Detection Settings Dialog */}
      <CrabDetectionSettingsDialog
        isOpen={showCrabSettingsDialog}
        onClose={() => setShowCrabSettingsDialog(false)}
        currentParams={settings.crabDetectionParams || DEFAULT_CRAB_PARAMS}
        onParamsChange={(params) => {
          setSettings({ ...settings, crabDetectionParams: params });
        }}
      />
    </div>
  );
}
