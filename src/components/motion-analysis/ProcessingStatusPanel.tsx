'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw, Terminal, ChevronDown, ChevronUp, StopCircle } from 'lucide-react';

interface ProcessingRun {
  id: string;
  run_type: 'local' | 'modal-t4' | 'modal-a10g';
  total_videos: number;
  videos_processed: number;
  videos_failed: number;
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  created_at: string;
  current_video_filename?: string;
}

interface ProcessingStatusPanelProps {
  runId: string | null;
  onComplete?: () => void;
  onProgressUpdate?: (processed: number, failed: number, total: number) => void;
  estimatedTime?: string;
  estimatedCost?: string;
}

export default function ProcessingStatusPanel({ runId, onComplete, onProgressUpdate, estimatedTime, estimatedCost }: ProcessingStatusPanelProps) {
  const [run, setRun] = useState<ProcessingRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const hasCalledOnComplete = useRef(false);
  const lastLoggedStatus = useRef<string | null>(null);
  const lastLoggedProgress = useRef<number>(-1);

  // Fetch processing run status
  const fetchStatus = async () => {
    if (!runId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/motion-analysis/process/${runId}`);
      const result = await response.json();

      if (result.success && result.run) {
        // Only log when status or progress changes (not every poll)
        const statusChanged = result.run.status !== lastLoggedStatus.current;
        const progressChanged = result.run.videos_processed !== lastLoggedProgress.current;

        if (statusChanged || progressChanged) {
          console.log(`[Status] ${result.run.status} | ${result.run.videos_processed}/${result.run.total_videos} processed | ${result.run.videos_failed} failed`);
          lastLoggedStatus.current = result.run.status;
          lastLoggedProgress.current = result.run.videos_processed;

          // Notify parent of progress change so it can refresh video list
          if (progressChanged && onProgressUpdate) {
            onProgressUpdate(result.run.videos_processed, result.run.videos_failed, result.run.total_videos);
          }
        }

        setRun(result.run);

        // If completed or failed, notify parent (only once)
        if ((result.run.status === 'completed' || result.run.status === 'failed') && onComplete && !hasCalledOnComplete.current) {
          console.log(`✓ Processing ${result.run.status}: ${result.run.videos_processed} processed, ${result.run.videos_failed} failed`);
          hasCalledOnComplete.current = true;
          setTimeout(() => {
            onComplete();
          }, 1000);
        }
      } else {
        setError(result.error || 'Failed to fetch status');
      }
    } catch (err: any) {
      console.error('[StatusPanel] Error fetching status:', err);
      setError(err.message || 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch logs
  const fetchLogs = async () => {
    if (!runId) return;

    try {
      const response = await fetch(`/api/motion-analysis/process/log?runId=${runId}`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.logs || '');
      }
    } catch (err: any) {
      console.error('Error fetching logs:', err);
    }
  };

  // Cancel processing
  const handleCancel = async () => {
    if (!runId || isCancelling) return;

    const confirmCancel = window.confirm(
      'Are you sure you want to cancel processing?\n\n' +
      'Videos that have finished will be kept.\n' +
      'Videos in progress will be stopped and marked as pending.'
    );

    if (!confirmCancel) return;

    setIsCancelling(true);
    try {
      console.log(`[Cancel] Cancelling processing run: ${runId}`);
      const response = await fetch('/api/motion-analysis/process/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`[Cancel] ✓ Processing cancelled successfully`);
        console.log(`  - Completed: ${result.videosCompleted}`);
        console.log(`  - Pending: ${result.videosPending}`);
        console.log(`  - Failed: ${result.videosFailed || 0}`);

        // Refresh status to show cancelled state
        await fetchStatus();

        // Notify parent to refresh the video list
        if (onComplete) {
          onComplete();
        }
      } else {
        console.error('[Cancel] Error:', result.error);
        alert(`Failed to cancel: ${result.error}`);
      }
    } catch (err: any) {
      console.error('[Cancel] Error cancelling processing:', err);
      alert(`Failed to cancel: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  // Auto-scroll to bottom when logs change or panel is expanded
  useEffect(() => {
    if (showLogs && logsContainerRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (logsContainerRef.current) {
          logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
      });
    }
  }, [logs, showLogs]);

  // Auto-refresh while running
  useEffect(() => {
    if (!runId) return;

    hasCalledOnComplete.current = false;
    fetchStatus();
    fetchLogs();

    const interval = setInterval(() => {
      if (run?.status === 'completed' || run?.status === 'failed') {
        return;
      }
      fetchStatus();
      fetchLogs();
    }, 2000);

    return () => clearInterval(interval);
  }, [runId, run?.status]);

  if (!runId) return null;

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={14} />
          <span>Error: {error}</span>
        </div>
        <button
          onClick={fetchStatus}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  if (!run && isLoading) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-blue-800 text-sm">Loading...</span>
      </div>
    );
  }

  if (!run) return null;

  // Calculate values
  const totalProcessed = run.videos_processed + run.videos_failed;
  const progressPercent = run.total_videos > 0 ? (totalProcessed / run.total_videos) * 100 : 0;
  const isComplete = run.status === 'completed';
  const isFailed = run.status === 'failed';
  const isCancelled = run.status === 'cancelled';
  const isRunning = run.status === 'running';
  const remaining = run.total_videos - totalProcessed;

  // Format elapsed time
  const startTime = new Date(run.started_at).getTime();
  const endTime = run.completed_at ? new Date(run.completed_at).getTime() : Date.now();
  const elapsedSeconds = Math.floor((endTime - startTime) / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedDisplay = elapsedMinutes > 0 ? `${elapsedMinutes}m ${elapsedSeconds % 60}s` : `${elapsedSeconds}s`;

  // Run type display (short)
  const runTypeShort = {
    local: 'Local',
    'modal-t4': 'T4 GPU',
    'modal-a10g': 'A10G GPU',
  }[run.run_type];

  // Status color
  const statusBg = isComplete
    ? 'bg-green-50 border-green-200'
    : isFailed
    ? 'bg-red-50 border-red-200'
    : isCancelled
    ? 'bg-orange-50 border-orange-200'
    : 'bg-blue-50 border-blue-200';
  const progressColor = isComplete
    ? 'bg-green-500'
    : isFailed
    ? 'bg-red-500'
    : isCancelled
    ? 'bg-orange-500'
    : 'bg-blue-500';

  return (
    <div className={`border rounded-lg ${statusBg}`}>
      {/* Single line status bar */}
      <div className="px-3 py-2 flex items-center gap-3 text-xs">
        {/* Status icon */}
        {isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />}
        {isComplete && <CheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
        {isFailed && <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />}
        {isCancelled && <StopCircle className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />}

        {/* GPU Type */}
        <span className="text-gray-700 font-medium">{runTypeShort}</span>

        <span className="text-gray-300">|</span>

        {/* Success count */}
        <span className="text-green-700">
          <span className="font-semibold">{run.videos_processed}</span> done
        </span>

        {/* Remaining (only if running) */}
        {isRunning && remaining > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-blue-700">
              <span className="font-semibold">{remaining}</span> left
            </span>
          </>
        )}

        {/* Failed (only if any) */}
        {run.videos_failed > 0 && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-red-700">
              <span className="font-semibold">{run.videos_failed}</span> failed
            </span>
          </>
        )}

        <span className="text-gray-300">|</span>

        {/* Elapsed time */}
        <span className="text-gray-600">{elapsedDisplay}</span>

        {/* Estimated time (if provided and still running) */}
        {isRunning && estimatedTime && (
          <>
            <span className="text-gray-400">/</span>
            <span className="text-gray-500">~{estimatedTime}</span>
          </>
        )}

        {/* Estimated cost (if provided) */}
        {estimatedCost && (
          <>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">~{estimatedCost}</span>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logs toggle on far right */}
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Terminal size={12} />
          <span>Logs</span>
          {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Progress bar with cancel button */}
      <div className="px-3 pb-2 flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${progressColor}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Cancel button - only show when running */}
        {isRunning && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Cancel processing"
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Cancelling...</span>
              </>
            ) : (
              <>
                <StopCircle size={12} />
                <span>Cancel</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Expandable logs section */}
      {showLogs && (
        <div className="border-t border-gray-200">
          <div
            ref={logsContainerRef}
            className="m-2 bg-gray-900 rounded p-2 font-mono text-xs overflow-y-auto"
            style={{ maxHeight: '180px' }}
          >
            {logs ? (
              logs.split('\n').map((line, idx) => {
                let lineClass = 'text-gray-300';
                if (line.includes('[ERROR]') || line.includes('[STDERR]')) {
                  lineClass = 'text-red-400';
                } else if (line.includes('[WARNING]')) {
                  lineClass = 'text-yellow-400';
                } else if (line.includes('[SUCCESS]')) {
                  lineClass = 'text-green-400';
                } else if (line.includes('Progress:') || line.includes('Processed')) {
                  lineClass = 'text-cyan-400';
                }
                return (
                  <div key={idx} className={`${lineClass} leading-tight whitespace-pre-wrap`}>
                    {line || '\u00A0'}
                  </div>
                );
              })
            ) : (
              <div className="text-gray-500 italic">Waiting for logs...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
