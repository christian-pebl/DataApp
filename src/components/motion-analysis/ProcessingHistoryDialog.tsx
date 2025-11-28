'use client';

import React, { useState } from 'react';
import { X, Clock, CheckCircle, XCircle, Terminal, ChevronDown, ChevronUp, Cpu, Cloud } from 'lucide-react';

interface ProcessingRun {
  run_id: string;
  run_type: 'local' | 'modal-t4' | 'modal-a10g';
  status: 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  logs?: Array<{ timestamp: string; message: string }>;
  videos_processed: number;
  videos_failed: number;
  total_videos: number;
}

interface ProcessingHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  history: ProcessingRun[];
}

export default function ProcessingHistoryDialog({
  isOpen,
  onClose,
  filename,
  history,
}: ProcessingHistoryDialogProps) {
  const [expandedRun, setExpandedRun] = useState<string | null>(
    history.length > 0 ? history[0].run_id : null
  );

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);

    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getRunTypeIcon = (runType: string) => {
    if (runType === 'local') return <Cpu size={14} className="text-gray-600" />;
    return <Cloud size={14} className="text-blue-600" />;
  };

  const getRunTypeLabel = (runType: string) => {
    switch (runType) {
      case 'local':
        return 'Local GPU';
      case 'modal-t4':
        return 'Modal T4';
      case 'modal-a10g':
        return 'Modal A10G';
      default:
        return runType;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            <CheckCircle size={12} />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
            <XCircle size={12} />
            Failed
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            <Clock size={12} className="animate-spin" />
            Running
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Processing History</h2>
            <p className="text-sm text-gray-600 truncate max-w-md" title={filename}>
              {filename}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="text-center py-8">
              <Terminal size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No processing history available</p>
              <p className="text-sm text-gray-500 mt-1">
                This video hasn't been processed yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((run) => (
                <div
                  key={run.run_id}
                  className="border rounded-lg overflow-hidden"
                >
                  {/* Run Header */}
                  <button
                    onClick={() =>
                      setExpandedRun(expandedRun === run.run_id ? null : run.run_id)
                    }
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getRunTypeIcon(run.run_type)}
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">
                            {getRunTypeLabel(run.run_type)}
                          </span>
                          {getStatusBadge(run.status)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <Clock size={12} />
                          <span>{formatDate(run.started_at)}</span>
                          <span className="text-gray-400">|</span>
                          <span>Duration: {formatDuration(run.started_at, run.completed_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">
                        {run.videos_processed}/{run.total_videos} processed
                      </span>
                      {expandedRun === run.run_id ? (
                        <ChevronUp size={16} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Run Logs */}
                  {expandedRun === run.run_id && (
                    <div className="border-t bg-gray-900 p-3">
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <Terminal size={12} />
                        <span>Processing Log</span>
                      </div>
                      <div className="font-mono text-xs max-h-48 overflow-y-auto">
                        {run.logs && run.logs.length > 0 ? (
                          run.logs.map((log, idx) => {
                            let lineClass = 'text-gray-300';
                            if (log.message.includes('[ERROR]')) {
                              lineClass = 'text-red-400';
                            } else if (log.message.includes('[WARNING]')) {
                              lineClass = 'text-yellow-400';
                            } else if (log.message.includes('[SUCCESS]')) {
                              lineClass = 'text-green-400';
                            } else if (log.message.includes('Progress:')) {
                              lineClass = 'text-cyan-400';
                            }

                            return (
                              <div
                                key={idx}
                                className={`${lineClass} leading-relaxed whitespace-pre-wrap`}
                              >
                                {log.message}
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-gray-500 italic">
                            No logs available for this run.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
