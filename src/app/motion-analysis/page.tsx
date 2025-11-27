'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import MotionAnalysisDashboard from '@/components/motion-analysis/MotionAnalysisDashboard';
import ProcessingStatusPanel from '@/components/motion-analysis/ProcessingStatusPanel';
import { Loader2, AlertTriangle, RefreshCw, CheckCircle, X, Trash2 } from 'lucide-react';

// Helper function to add timeout to fetch requests
async function fetchWithTimeout(url: string, timeoutMs: number = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms. The server might be slow or unreachable.`);
    }
    throw error;
  }
}

// Load motion analysis data from database API
async function loadMotionAnalysisData() {
  console.log('[PAGE] Loading motion analysis data...');
  const startTime = Date.now();

  try {
    const response = await fetchWithTimeout('/api/motion-analysis/videos', 20000);

    console.log(`[PAGE] API response received after ${Date.now() - startTime}ms (status: ${response.status})`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[PAGE] Loaded ${data.videos?.length || 0} videos`);
    return data.videos || [];

  } catch (error: any) {
    console.error(`[PAGE] Failed to load videos after ${Date.now() - startTime}ms:`, error);
    throw error;
  }
}

// Check for active processing runs (for page refresh recovery)
async function checkActiveRuns() {
  try {
    const response = await fetch('/api/motion-analysis/process/active');
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// Reset stuck videos to pending
async function resetStuckVideos(videoIds?: string[]) {
  const response = await fetch('/api/motion-analysis/process/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(videoIds ? { videoIds } : { resetAll: true }),
  });
  return response.json();
}

// Check for and clean duplicate video entries
async function cleanupDuplicates() {
  try {
    // First check for duplicates
    const checkResponse = await fetch('/api/motion-analysis/cleanup-duplicates');
    if (!checkResponse.ok) return null;

    const checkResult = await checkResponse.json();

    if (!checkResult.hasDuplicates) {
      return null;
    }

    // Delete the duplicates
    const deleteResponse = await fetch('/api/motion-analysis/cleanup-duplicates', {
      method: 'DELETE',
    });

    if (!deleteResponse.ok) return null;

    return await deleteResponse.json();
  } catch (error) {
    console.error('Error cleaning duplicates:', error);
    return null;
  }
}

interface CleanupNotification {
  deletedCount: number;
  deletedFiles: { filename: string; deletedCount: number }[];
}

export default function MotionAnalysisPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string | undefined>(undefined);
  const [estimatedCost, setEstimatedCost] = useState<string | undefined>(undefined);
  const [stuckVideos, setStuckVideos] = useState<Array<{ id: string; filename: string }>>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [cleanupNotification, setCleanupNotification] = useState<CleanupNotification | null>(null);
  const hasCheckedDuplicates = useRef(false);

  // Check for active runs on mount (handles page refresh)
  useEffect(() => {
    checkActiveRuns().then((result) => {
      if (result?.hasActiveRun && result.activeRun) {
        console.log('🔄 Restored active processing run:', result.activeRun.id);
        setCurrentRunId(result.activeRun.id);
      }
      if (result?.stuckVideosCount > 0) {
        console.log(`⚠️ Found ${result.stuckVideosCount} stuck videos`);
        setStuckVideos(result.stuckVideos || []);
      }
    });
  }, []);

  // Check for and clean duplicates on mount (only once)
  useEffect(() => {
    if (hasCheckedDuplicates.current) return;
    hasCheckedDuplicates.current = true;

    cleanupDuplicates().then((result) => {
      if (result?.success && result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} duplicate video entries`);
        setCleanupNotification({
          deletedCount: result.deletedCount,
          deletedFiles: result.deletedFiles,
        });

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
          setCleanupNotification(null);
        }, 10000);
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    const loadStartTime = Date.now();
    console.log('[PAGE] Starting data load...');

    try {
      setLoading(true);
      setError(null);
      const results = await loadMotionAnalysisData();
      const loadTime = Date.now() - loadStartTime;
      console.log(`[PAGE] Data load completed in ${loadTime}ms`);

      const processedCount = results.filter((v: any) => v.processing_status === 'completed' && v.motion_analysis).length;
      const pendingCount = results.filter((v: any) => v.processing_status !== 'completed' || !v.motion_analysis).length;

      console.log(`📊 Loaded ${results.length} videos (${processedCount} processed, ${pendingCount} pending)`);

      setData(results);

      // Check for stuck videos after loading
      const activeResult = await checkActiveRuns();
      if (activeResult?.stuckVideosCount > 0 && !activeResult?.hasActiveRun) {
        setStuckVideos(activeResult.stuckVideos || []);
      } else {
        setStuckVideos([]);
      }
    } catch (err: any) {
      const loadTime = Date.now() - loadStartTime;
      console.error(`[PAGE] ❌ Failed to load videos after ${loadTime}ms:`, err);

      // Provide more helpful error messages
      let errorMessage = err.message || 'Failed to load motion analysis data';

      if (err.message?.includes('timed out')) {
        errorMessage = 'Request timed out. The server is taking too long to respond. Please check your internet connection and try again.';
      } else if (err.message?.includes('fetch')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetStuckVideos = async () => {
    setIsResetting(true);
    try {
      const result = await resetStuckVideos();
      if (result.success) {
        console.log(`✓ Reset ${result.resetCount} stuck videos`);
        setStuckVideos([]);
        await loadData();
      }
    } catch (err) {
      console.error('Failed to reset stuck videos:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleUploadComplete = () => {
    console.log('📤 Upload complete');
    loadData();
  };

  const handleDeleteVideos = async (deletedFilenames: string[]) => {
    console.log(`🗑️  Deleted ${deletedFilenames.length} video(s)`);
    await loadData();
  };

  const handleProcessingStarted = (runId: string, estTime?: string, estCost?: string) => {
    console.log(`▶️  Processing started | ${estTime || 'N/A'} | ${estCost || 'N/A'}`);
    setCurrentRunId(runId);
    setEstimatedTime(estTime);
    setEstimatedCost(estCost);
  };

  const handleProcessingComplete = () => {
    console.log('✓ Processing complete, refreshing data');
    setCurrentRunId(null);
    setEstimatedTime(undefined);
    setEstimatedCost(undefined);
    loadData();
  };

  // Handle progress updates from ProcessingStatusPanel - refresh video list immediately
  const handleProgressUpdate = useCallback(async (processed: number, failed: number, total: number) => {
    console.log(`📊 Progress update: ${processed}/${total} completed, ${failed} failed - refreshing video list`);
    try {
      const results = await loadMotionAnalysisData();
      setData(results);
    } catch (err) {
      console.warn('Failed to refresh video list on progress update:', err);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading motion analysis data...</p>
        </div>
      </div>
    );
  }

  // Separate videos by processing_status:
  // - 'completed' with motion_analysis data -> processed
  // - 'pending' or 'processing' or 'failed' without data -> pending/needs attention
  const processedVideos = data.filter((v) => v.processing_status === 'completed' && v.motion_analysis);
  const pendingVideos = data.filter((v) => v.processing_status !== 'completed' || !v.motion_analysis);

  // Map pending videos to dashboard format (include processing_status for display)
  const pendingVideosList = pendingVideos.map((v) => ({
    id: v.id,
    filename: v.filename,
    width: v.width,
    height: v.height,
    fps: v.fps,
    duration_seconds: v.duration_seconds,
    total_frames: v.total_frames,
    processing_status: v.processing_status as 'pending' | 'processing' | 'failed' | undefined,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Motion Analysis</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Show duplicate cleanup notification */}
        {cleanupNotification && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-emerald-800 font-medium">
                  Cleaned up {cleanupNotification.deletedCount} duplicate database {cleanupNotification.deletedCount === 1 ? 'entry' : 'entries'}
                </p>
                <p className="text-sm text-emerald-700 mt-1">
                  Duplicate video entries were automatically removed. Original files were kept.
                </p>
                <div className="mt-2 text-xs text-emerald-600">
                  {cleanupNotification.deletedFiles.map(f =>
                    `${f.filename} (${f.deletedCount} duplicate${f.deletedCount > 1 ? 's' : ''} removed)`
                  ).join(', ')}
                </div>
              </div>
              <button
                onClick={() => setCleanupNotification(null)}
                className="text-emerald-600 hover:text-emerald-800 transition-colors"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Show stuck videos warning with reset option */}
        {stuckVideos.length > 0 && !currentRunId && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-800 font-medium">
                  {stuckVideos.length} video{stuckVideos.length > 1 ? 's' : ''} stuck in processing
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Processing was interrupted (page refresh, error, or timeout). Reset to try again.
                </p>
                <div className="mt-2 text-xs text-amber-600">
                  {stuckVideos.map(v => v.filename).join(', ')}
                </div>
              </div>
              <button
                onClick={handleResetStuckVideos}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-md hover:bg-amber-200 disabled:opacity-50 transition-colors"
              >
                {isResetting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Show pending videos message */}
        {pendingVideos.length > 0 && !currentRunId && stuckVideos.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 font-medium">
              {pendingVideos.length} video{pendingVideos.length > 1 ? 's' : ''} awaiting processing
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Upload complete! Click "Run Processing" to process videos.
            </p>
          </div>
        )}

        {/* Show processing status panel */}
        {currentRunId && (
          <div className="mb-6">
            <ProcessingStatusPanel
              runId={currentRunId}
              onComplete={handleProcessingComplete}
              onProgressUpdate={handleProgressUpdate}
              estimatedTime={estimatedTime}
              estimatedCost={estimatedCost}
            />
          </div>
        )}

        {data.length === 0 && !error && (
          <MotionAnalysisDashboard
            data={[]}
            pendingVideos={[]}
            onDeleteVideos={handleDeleteVideos}
            onProcessingStarted={handleProcessingStarted}
            onUploadComplete={handleUploadComplete}
          />
        )}

        {(processedVideos.length > 0 || pendingVideos.length > 0) && data.length > 0 && (
          <MotionAnalysisDashboard
            data={processedVideos.map(v => {
              // Unified pipeline JSON structure:
              // Root: { video_info, motion_analysis: { activity_score, motion, density, organisms }, ... }
              // Dashboard expects: { video_info, activity_score, motion, density, organisms, ... }
              const motionData = v.motion_analysis || {};
              return {
                // Spread root-level fields (video_info, etc.)
                video_info: motionData.video_info,
                // Spread nested motion_analysis fields (activity_score, motion, etc.)
                activity_score: motionData.motion_analysis?.activity_score || motionData.activity_score,
                motion: motionData.motion_analysis?.motion || motionData.motion,
                density: motionData.motion_analysis?.density || motionData.density,
                organisms: motionData.motion_analysis?.organisms || motionData.organisms,
                processing_time_seconds: motionData.processing_time_seconds || motionData.motion_analysis?.processing_time_seconds,
                timestamp: motionData.timestamp || new Date().toISOString(),
                processing_history: v.processing_history || [],
              };
            })}
            pendingVideos={pendingVideosList.map(v => ({
              ...v,
              processing_history: data.find(d => d.id === v.id)?.processing_history || [],
            }))}
            onDeleteVideos={handleDeleteVideos}
            onProcessingStarted={handleProcessingStarted}
            onUploadComplete={handleUploadComplete}
          />
        )}
      </div>
    </div>
  );
}
