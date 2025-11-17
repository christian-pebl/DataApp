'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, Download, Edit, Sparkles, Save, Check, FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { fetchRawCsvAction, transformSingleCellAction, updateCsvFileAction } from '@/app/data-explorer/actions';
import { cn } from '@/lib/utils';
import { AiPromptDialog } from './AiPromptDialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RawCsvViewerProps {
  fileId: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface TransformationLogEntry {
  rowIdx: number;
  cellIdx: number;
  columnName: string;
  oldValue: string;
  newValue: string;
  timestamp: Date;
  // Debug information
  prompt: string;
  model: string;
  duration: number; // in milliseconds
  success: boolean;
  error?: string;
  reasoning?: string; // AI's explanation for transformation
  // Timeline events
  timeline: {
    startTime: number;
    requestSentTime?: number;
    responseReceivedTime?: number;
    completedTime: number;
    events: Array<{
      time: number;
      type: 'start' | 'request' | 'response' | 'complete' | 'error';
      message: string;
      data?: any;
    }>;
  };
}

export function RawCsvViewer({ fileId, fileName, isOpen, onClose }: RawCsvViewerProps) {
  const { toast } = useToast();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set()); // "rowIdx-cellIdx" or "header-colIdx"
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{row: number; col: number} | null>(null);

  // Manual editing state
  const [editingCell, setEditingCell] = useState<{row: number; col: number} | null>(null);
  const [editingHeader, setEditingHeader] = useState<number | null>(null); // Column index of header being edited
  const [editValue, setEditValue] = useState<string>('');
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set()); // Cells manually edited
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // AI generation state
  const [showAiPromptDialog, setShowAiPromptDialog] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState<{current: number; total: number} | null>(null);
  const [aiTransformedCells, setAiTransformedCells] = useState<Set<string>>(new Set()); // Cells transformed by AI
  const [transformationLog, setTransformationLog] = useState<TransformationLogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [expandedLogEntries, setExpandedLogEntries] = useState<Set<number>>(new Set()); // Track expanded log entries

  // Fetch raw CSV data when dialog opens
  useEffect(() => {
    if (isOpen && fileId) {
      fetchRawData();
    }
  }, [isOpen, fileId]);

  const fetchRawData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchRawCsvAction(fileId);

      if (result.success && result.data) {
        setHeaders(result.data.headers);
        setRows(result.data.rows);
      } else {
        setError(result.error || 'Failed to load CSV data');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to load CSV data'
        });
      }
    } catch (err) {
      logger.error('Error fetching raw CSV', err, { context: 'RawCsvViewer' });
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cell selection handlers
  const handleCellMouseDown = (rowIdx: number, cellIdx: number, event: React.MouseEvent) => {
    if (!isEditMode) return;

    event.preventDefault();
    const cellKey = `${rowIdx}-${cellIdx}`;

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+MouseDown: Start Ctrl-drag selection mode (add cells as mouse moves)
      setIsSelecting(true);
      setSelectionStart({ row: rowIdx, col: cellIdx });

      // Add this cell to selection (don't replace existing selection)
      setSelectedCells(prev => {
        const next = new Set(prev);
        next.add(cellKey);
        return next;
      });
    } else {
      // Normal click: Start new rectangular selection
      setSelectedCells(new Set([cellKey]));
      setIsSelecting(true);
      setSelectionStart({ row: rowIdx, col: cellIdx });
    }
  };

  const handleCellMouseEnter = (rowIdx: number, cellIdx: number, event?: React.MouseEvent) => {
    if (!isEditMode || !isSelecting || !selectionStart) return;

    const cellKey = `${rowIdx}-${cellIdx}`;

    // Check if Ctrl is still being held (for Ctrl+drag)
    const isCtrlHeld = event?.ctrlKey || event?.metaKey;

    if (isCtrlHeld) {
      // Ctrl+Drag: Add cells as mouse moves over them (additive selection)
      setSelectedCells(prev => {
        const next = new Set(prev);
        next.add(cellKey);
        return next;
      });
    } else {
      // Regular drag: Calculate rectangular selection range
      const minRow = Math.min(selectionStart.row, rowIdx);
      const maxRow = Math.max(selectionStart.row, rowIdx);
      const minCol = Math.min(selectionStart.col, cellIdx);
      const maxCol = Math.max(selectionStart.col, cellIdx);

      const cellsInRange = new Set<string>();
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          cellsInRange.add(`${r}-${c}`);
        }
      }

      setSelectedCells(cellsInRange);
    }
  };

  const handleCellMouseUp = () => {
    if (!isEditMode) return;
    setIsSelecting(false);
    setSelectionStart(null);
  };

  // Column header click: Select and allow editing the header cell
  const handleColumnHeaderClick = (colIdx: number, event: React.MouseEvent) => {
    if (!isEditMode) return;
    event.preventDefault();

    const headerCellKey = `header-${colIdx}`;

    if (event.ctrlKey || event.metaKey) {
      // Ctrl+Click: Toggle this header in selection (don't start editing)
      setSelectedCells(prev => {
        const next = new Set(prev);
        if (next.has(headerCellKey)) {
          next.delete(headerCellKey);
        } else {
          next.add(headerCellKey);
        }
        return next;
      });
    } else {
      // Normal click: Select just this header cell (don't start editing)
      setSelectedCells(new Set([headerCellKey]));
    }
  };

  // Header double-click: Start editing
  const handleHeaderDoubleClick = (colIdx: number) => {
    if (!isEditMode) return;

    setEditingHeader(colIdx);
    setEditValue(headers[colIdx]);

    // Focus input after state update
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  // Handle column checkbox: Select/deselect all cells in a column (excluding header)
  const handleColumnCheckbox = (colIdx: number, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const isChecked = event.target.checked;

    setSelectedCells(prev => {
      const next = new Set(prev);

      if (isChecked) {
        // Select all cells in this column (excluding header)
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          next.add(`${rowIdx}-${colIdx}`);
        }
      } else {
        // Deselect all cells in this column
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          next.delete(`${rowIdx}-${colIdx}`);
        }
      }

      return next;
    });
  };

  // Check if all cells in a column are selected (excluding header)
  const isColumnFullySelected = (colIdx: number): boolean => {
    if (rows.length === 0) return false;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      if (!selectedCells.has(`${rowIdx}-${colIdx}`)) {
        return false;
      }
    }
    return true;
  };

  // Check if some (but not all) cells in a column are selected
  const isColumnPartiallySelected = (colIdx: number): boolean => {
    if (rows.length === 0) return false;

    let selectedCount = 0;
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      if (selectedCells.has(`${rowIdx}-${colIdx}`)) {
        selectedCount++;
      }
    }

    return selectedCount > 0 && selectedCount < rows.length;
  };

  // Manual cell editing handlers
  const handleCellDoubleClick = (rowIdx: number, cellIdx: number) => {
    if (!isEditMode) return;

    setEditingCell({ row: rowIdx, col: cellIdx });
    setEditValue(rows[rowIdx][cellIdx]);

    // Focus input after state update
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const handleConfirmEdit = () => {
    // Handle header edit
    if (editingHeader !== null) {
      const oldValue = headers[editingHeader];

      if (editValue !== oldValue) {
        // Update the header value
        setHeaders(prevHeaders => {
          const newHeaders = [...prevHeaders];
          newHeaders[editingHeader] = editValue;
          return newHeaders;
        });

        // Mark as edited
        const headerCellKey = `header-${editingHeader}`;
        setEditedCells(prev => new Set([...prev, headerCellKey]));
        setHasUnsavedChanges(true);

        toast({
          title: 'Header Updated',
          description: 'Changes will be saved when you click "Save Edits"'
        });
      }

      setEditingHeader(null);
      setEditValue('');
      setSelectedCells(new Set()); // Clear selection
      return;
    }

    // Handle cell edit
    if (!editingCell) return;

    const cellKey = `${editingCell.row}-${editingCell.col}`;
    const oldValue = rows[editingCell.row][editingCell.col];

    if (editValue !== oldValue) {
      // Update the cell value
      setRows(prevRows => {
        const newRows = prevRows.map(row => [...row]);
        newRows[editingCell.row][editingCell.col] = editValue;
        return newRows;
      });

      // Mark as edited
      setEditedCells(prev => new Set([...prev, cellKey]));
      setHasUnsavedChanges(true);

      toast({
        title: 'Cell Updated',
        description: 'Changes will be saved when you click "Save Edits"'
      });
    }

    setEditingCell(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditingHeader(null);
    setEditValue('');
  };

  // Global mouse up listener to handle selection outside table
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
        setSelectionStart(null);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isSelecting]);

  // Keyboard shortcuts for edit mode
  useEffect(() => {
    if (!isEditMode || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A or Cmd+A: Select all cells
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const allCells = new Set<string>();
        rows.forEach((row, rowIdx) => {
          row.forEach((_, cellIdx) => {
            allCells.add(`${rowIdx}-${cellIdx}`);
          });
        });
        setSelectedCells(allCells);
        toast({
          title: 'All Cells Selected',
          description: `Selected ${allCells.size} cells`
        });
      }

      // Escape: Deselect all cells
      if (e.key === 'Escape') {
        if (selectedCells.size > 0) {
          setSelectedCells(new Set());
          toast({
            title: 'Selection Cleared',
            description: 'All cells deselected'
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, isOpen, rows, selectedCells.size, toast]);

  const handleDownload = () => {
    try {
      // Reconstruct CSV from headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => {
          // Escape cells containing commas, quotes, or newlines
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(','))
        .join('\n');

      // Create blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download Complete',
        description: `${fileName} has been downloaded`
      });
    } catch (err) {
      logger.error('Error downloading CSV', err, { context: 'RawCsvViewer' });
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'Failed to download CSV file'
      });
    }
  };

  const handleSaveEdits = async () => {
    try {
      setIsLoading(true);

      // Reconstruct CSV from headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => {
          // Escape cells containing commas, quotes, or newlines
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(','))
        .join('\n');

      logger.info('Saving CSV edits to database', {
        context: 'RawCsvViewer',
        data: {
          fileId,
          fileName,
          editedCellsCount: editedCells.size,
          aiTransformedCellsCount: aiTransformedCells.size,
          totalCellsChanged: editedCells.size + aiTransformedCells.size,
          csvLength: csvContent.length
        }
      });

      // Update the file in the database
      const result = await updateCsvFileAction(fileId, csvContent);

      if (!result.success) {
        throw new Error(result.error || 'Failed to update file');
      }

      toast({
        title: 'Changes Saved',
        description: `Updated ${editedCells.size + aiTransformedCells.size} cells in ${fileName}`
      });

      // Clear edit tracking
      setEditedCells(new Set());
      setAiTransformedCells(new Set());
      setHasUnsavedChanges(false);
      setTransformationLog([]);

      logger.info('CSV edits saved successfully', {
        context: 'RawCsvViewer',
        data: { fileId, fileName }
      });
    } catch (err) {
      logger.error('Error saving CSV edits', err, { context: 'RawCsvViewer' });
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Failed to save changes to database'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setHeaders([]);
    setRows([]);
    setError(null);
    setIsEditMode(false);
    setSelectedCells(new Set());
    setIsSelecting(false);
    setSelectionStart(null);
    setEditingCell(null);
    setEditingHeader(null);
    setEditValue('');
    setShowAiPromptDialog(false);
    setIsAiProcessing(false);
    setAiProgress(null);
    onClose();
  };

  // AI Generation handler with real-time progress updates
  const handleAiGenerate = async (prompt: string) => {
    // Prepare cells data (including header cells)
    const cellsToTransform = Array.from(selectedCells).map(cellKey => {
      if (cellKey.startsWith('header-')) {
        // Header cell
        const colIdx = parseInt(cellKey.split('-')[1]);
        return {
          rowIdx: -1, // Special marker for header row
          cellIdx: colIdx,
          value: headers[colIdx],
          isHeader: true
        };
      } else {
        // Regular data cell
        const [rowIdx, cellIdx] = cellKey.split('-').map(Number);
        return {
          rowIdx,
          cellIdx,
          value: rows[rowIdx][cellIdx],
          isHeader: false
        };
      }
    });

    // Show progress
    setIsAiProcessing(true);
    setAiProgress({ current: 0, total: cellsToTransform.length });
    setShowAiPromptDialog(false); // Close the prompt dialog

    let successCount = 0;
    let failureCount = 0;
    let modelUsed = '';
    const newLogEntries: TransformationLogEntry[] = [];

    try {
      // OPTIMIZATION: Process cells in parallel batches for 10x speed improvement
      const CONCURRENCY_LIMIT = 10; // OpenAI limit: 500 req/min = ~8.3 req/sec, so 10 concurrent is safe
      let processedCount = 0;

      // Process in batches
      for (let batchStart = 0; batchStart < cellsToTransform.length; batchStart += CONCURRENCY_LIMIT) {
        const batch = cellsToTransform.slice(batchStart, batchStart + CONCURRENCY_LIMIT);

        // Process batch in parallel
        const batchPromises = batch.map(async (cell, batchIdx) => {
          const globalIdx = batchStart + batchIdx;
          const startTime = Date.now();
          const timeline: TransformationLogEntry['timeline'] = {
            startTime,
            completedTime: startTime,
            events: []
          };

          // Add start event
          timeline.events.push({
            time: Date.now(),
            type: 'start',
            message: `Starting transformation for ${cell.isHeader ? 'header' : 'cell'} at column ${cell.cellIdx + 1}`,
            data: { cellValue: cell.value, prompt }
          });

          const oldValue = cell.value;

          // Add request event
          const requestTime = Date.now();
          timeline.requestSentTime = requestTime;
          timeline.events.push({
            time: requestTime,
            type: 'request',
            message: 'Sending request (parallel batch processing)',
            data: {
              cellValue: oldValue,
              cellValueLength: oldValue.length,
              prompt,
              promptLength: prompt.length,
              cellCount: cellsToTransform.length,
              batchIndex: globalIdx + 1,
              batchSize: batch.length,
              cellType: cell.isHeader ? 'header' : 'data cell',
              columnIndex: cell.cellIdx,
              rowIndex: cell.isHeader ? 'header' : cell.rowIdx,
              fileId,
              timestamp: new Date(requestTime).toISOString()
            }
          });

          // Transform single cell (uses cache → WoRMS → LLM fallback)
          const result = await transformSingleCellAction({
            fileId,
            cell,
            prompt,
            cellCount: cellsToTransform.length
          });

          return { cell, result, oldValue, timeline, startTime };
        });

        // Wait for all cells in batch to complete
        const batchResults = await Promise.allSettled(batchPromises);

        // Process results from this batch
        for (let i = 0; i < batchResults.length; i++) {
          processedCount++;
          setAiProgress({ current: processedCount, total: cellsToTransform.length });

          const batchResult = batchResults[i];

          if (batchResult.status === 'rejected') {
            // Handle promise rejection
            const cell = batch[i];
            failureCount++;
            const errorMessage = batchResult.reason instanceof Error ? batchResult.reason.message : 'Unknown error';

            const errorEntry = {
              rowIdx: cell.isHeader ? -1 : cell.rowIdx,
              cellIdx: cell.cellIdx,
              columnName: cell.isHeader ? `Header ${cell.cellIdx + 1}` : headers[cell.cellIdx],
              oldValue: cell.value,
              newValue: cell.value,
              timestamp: new Date(),
              prompt,
              model: 'error',
              duration: 0,
              success: false,
              error: errorMessage,
              timeline: {
                startTime: Date.now(),
                completedTime: Date.now(),
                events: []
              }
            };

            newLogEntries.push(errorEntry);
            setTransformationLog(prev => [errorEntry, ...prev]);

            logger.error('Batch cell transformation error', batchResult.reason, {
              context: 'RawCsvViewer',
              data: { rowIdx: cell.rowIdx, cellIdx: cell.cellIdx }
            });

            continue;
          }

          // Extract fulfilled result
          const { cell, result, oldValue, timeline, startTime } = batchResult.value;

          // Add response event with detailed information
          const responseTime = Date.now();
          const apiLatency = responseTime - (timeline.requestSentTime || startTime);
          timeline.responseReceivedTime = responseTime;
          timeline.events.push({
            time: responseTime,
            type: 'response',
            message: `Received response from API (${result.model || 'unknown'})`,
            data: {
              success: result.success,
              model: result.model,
              modelSelectionReason: result.modelSelectionReason || 'Not provided',
              complexityAnalysis: result.complexityFactors ? {
                veryComplexPrompt: result.complexityFactors.isVeryComplexPrompt,
                complexPrompt: result.complexityFactors.isComplexPrompt,
                complexData: result.complexityFactors.isComplexData,
                simpleTask: result.complexityFactors.isSimpleTask,
                batchSize: result.complexityFactors.cellCount,
                promptLength: result.complexityFactors.promptLength,
                dataLength: result.complexityFactors.cellValueLength
              } : null,
              newValue: result.newValue,
              newValueLength: result.newValue?.length || 0,
              valueChanged: result.newValue !== oldValue,
              changeType: result.newValue === oldValue ? 'no change' :
                         result.newValue && result.newValue.length > oldValue.length ? 'expanded' :
                         result.newValue && result.newValue.length < oldValue.length ? 'shortened' : 'modified',
              error: result.error,
              reasoning: result.reasoning,
              tokensUsed: result.tokensUsed,
              estimatedCost: result.tokensUsed ? `$${(result.tokensUsed / 1000000 * 0.5).toFixed(6)}` : 'N/A',
              responseTime: apiLatency,
              responseTimeReadable: `${(apiLatency / 1000).toFixed(2)}s`,
              timestamp: new Date(responseTime).toISOString()
            }
          });

          const duration = Date.now() - startTime;
          timeline.completedTime = Date.now();

          // Track which model was used
          if (result.model && !modelUsed) {
            modelUsed = result.model;
          }

          if (result.success && result.newValue) {
            // Add complete event
            timeline.events.push({
              time: Date.now(),
              type: 'complete',
              message: 'Transformation completed successfully',
              data: {
                oldValue,
                newValue: result.newValue,
                totalDuration: duration
              }
            });

            if (cell.isHeader) {
              // Update header cell
              const cellKey = `header-${cell.cellIdx}`;

              setHeaders(prevHeaders => {
                const newHeaders = [...prevHeaders];
                newHeaders[cell.cellIdx] = result.newValue!;
                return newHeaders;
              });

              // Mark as AI-transformed
              setAiTransformedCells(prev => new Set([...prev, cellKey]));
              setHasUnsavedChanges(true);

              // Log the transformation with debug info
              const headerEntry = {
                rowIdx: -1, // Header row
                cellIdx: cell.cellIdx,
                columnName: `Header ${cell.cellIdx + 1}`,
                oldValue,
                newValue: result.newValue!,
                timestamp: new Date(),
                prompt,
                model: result.model || 'unknown',
                duration,
                success: true,
                reasoning: result.reasoning,
                timeline
              };
              newLogEntries.push(headerEntry);

              // Add to transformation log immediately for real-time console display
              setTransformationLog(prev => [headerEntry, ...prev]);

              successCount++;
            } else {
              // Update data cell
              const cellKey = `${cell.rowIdx}-${cell.cellIdx}`;

              setRows(prevRows => {
                const newRows = prevRows.map(row => [...row]); // Deep copy
                newRows[cell.rowIdx][cell.cellIdx] = result.newValue!;
                return newRows;
              });

              // Mark as AI-transformed
              setAiTransformedCells(prev => new Set([...prev, cellKey]));
              setHasUnsavedChanges(true);

              // Log the transformation with debug info
              const cellEntry = {
                rowIdx: cell.rowIdx,
                cellIdx: cell.cellIdx,
                columnName: headers[cell.cellIdx],
                oldValue,
                newValue: result.newValue!,
                timestamp: new Date(),
                prompt,
                model: result.model || 'unknown',
                duration,
                success: true,
                reasoning: result.reasoning,
                timeline
              };
              newLogEntries.push(cellEntry);

              // Add to transformation log immediately for real-time console display
              setTransformationLog(prev => [cellEntry, ...prev]);

              successCount++;
            }
          } else {
            failureCount++;
            const duration = Date.now() - startTime;

            // Add error event
            timeline.events.push({
              time: Date.now(),
              type: 'error',
              message: `Transformation failed: ${result.error || 'Unknown error'}`,
              data: {
                error: result.error,
                totalDuration: duration
              }
            });
            timeline.completedTime = Date.now();

            // Log the failed transformation
            const failureEntry = {
              rowIdx: cell.isHeader ? -1 : cell.rowIdx,
              cellIdx: cell.cellIdx,
              columnName: cell.isHeader ? `Header ${cell.cellIdx + 1}` : headers[cell.cellIdx],
              oldValue,
              newValue: oldValue, // Keep old value on failure
              timestamp: new Date(),
              prompt,
              model: result.model || 'unknown',
              duration,
              success: false,
              error: result.error || 'Unknown error',
              reasoning: result.reasoning,
              timeline
            };
            newLogEntries.push(failureEntry);

            // Add to transformation log immediately for real-time console display
            setTransformationLog(prev => [failureEntry, ...prev]);

            logger.error('Cell transformation failed', new Error(result.error), {
              context: 'RawCsvViewer',
              data: { rowIdx: cell.rowIdx, cellIdx: cell.cellIdx, isHeader: cell.isHeader }
            });
          }
        }

        // No rate limiting delay needed - parallel processing handles this naturally
      }

      // Entries are already added to transformation log in real-time during processing
      // (No batch addition needed)

      // Show completion toast
      toast({
        title: 'Transform Complete',
        description: `Successfully transformed ${successCount} cell${successCount !== 1 ? 's' : ''} using ${modelUsed || 'language model'}${failureCount > 0 ? `. ${failureCount} failed.` : ''}`
      });

      // Clear selection
      setSelectedCells(new Set());

      // Don't auto-show log - let user open it manually when needed
    } catch (error) {
      logger.error('AI generation failed', error as Error, { context: 'RawCsvViewer' });
      toast({
        variant: 'destructive',
        title: 'Transform Failed',
        description: error instanceof Error ? error.message : 'Failed to transform cells'
      });
    } finally {
      setIsAiProcessing(false);
      setAiProgress(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="font-mono text-sm truncate">{fileName}</span>
            <div className="flex items-center gap-2">
              {!isLoading && !error && (
                <>
                  <Button
                    variant={isEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsEditMode(!isEditMode);
                      setSelectedCells(new Set());
                      setEditingCell(null);
                      setEditingHeader(null);
                      setEditValue('');
                    }}
                    className="gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    {isEditMode ? "Exit Edit" : "Edit"}
                  </Button>
                  {isEditMode && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allCells = new Set<string>();
                          rows.forEach((row, rowIdx) => {
                            row.forEach((_, cellIdx) => {
                              allCells.add(`${rowIdx}-${cellIdx}`);
                            });
                          });
                          setSelectedCells(allCells);
                          toast({
                            title: 'All Cells Selected',
                            description: `Selected ${allCells.size} cells`
                          });
                        }}
                        className="text-xs"
                      >
                        Select All
                      </Button>
                      {selectedCells.size > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCells(new Set());
                            toast({
                              title: 'Selection Cleared',
                              description: 'All cells deselected'
                            });
                          }}
                          className="text-xs"
                        >
                          Deselect All
                        </Button>
                      )}
                    </>
                  )}
                  {isEditMode && selectedCells.size > 0 && !isAiProcessing && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => {
                        // Show confirmation for large batches
                        if (selectedCells.size > 100) {
                          const confirmed = window.confirm(
                            `You are about to transform ${selectedCells.size} cells. ` +
                            `This will take approximately ${Math.ceil(selectedCells.size * 1.2 / 60)} minutes. ` +
                            `Do you want to continue?`
                          );
                          if (!confirmed) return;
                        }
                        setShowAiPromptDialog(true);
                      }}
                      className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Sparkles className="w-4 h-4" />
                      Transform ({selectedCells.size})
                    </Button>
                  )}
                  {hasUnsavedChanges && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSaveEdits}
                      disabled={isLoading}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Edits
                    </Button>
                  )}
                  {transformationLog.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowLog(!showLog)}
                      className="gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      {showLog ? 'Hide' : 'View'} Log ({transformationLog.length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            {isLoading ? (
              'Loading raw CSV data...'
            ) : error ? (
              'Failed to load CSV data'
            ) : (
              <>
                {`${rows.length.toLocaleString()} rows × ${headers.length} columns`}
                {isEditMode && selectedCells.size > 0 && (
                  <span className="ml-4 text-primary font-medium">
                    • {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
                  </span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 px-6 pb-6">
          <div className="h-full border rounded-md overflow-hidden bg-background">
            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Loading CSV data...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-4">
                  <p className="text-destructive font-medium mb-2">Error loading CSV</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRawData}
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && !error && headers.length > 0 && (
              <div className="h-full overflow-auto scroll-smooth scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30">
                <table className="w-full border-collapse text-sm relative">
                  <thead className="sticky top-0 z-20 shadow-sm">
                    {/* Column selection checkboxes row - only visible in edit mode */}
                    {isEditMode && (
                      <tr className="bg-muted/50">
                        <th className="border border-border bg-muted p-1 text-center font-semibold w-16 min-w-[4rem] sticky left-0 z-30 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                          {/* Empty cell above row numbers */}
                        </th>
                        {headers.map((_, idx) => {
                          const isFullySelected = isColumnFullySelected(idx);
                          const isPartiallySelected = isColumnPartiallySelected(idx);

                          return (
                            <th
                              key={`checkbox-${idx}`}
                              className="border border-border bg-muted p-1 text-center"
                            >
                              <div className="flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={isFullySelected}
                                  ref={(el) => {
                                    if (el && isPartiallySelected) {
                                      el.indeterminate = true;
                                    }
                                  }}
                                  onChange={(e) => handleColumnCheckbox(idx, e)}
                                  className="w-4 h-4 cursor-pointer accent-blue-600"
                                  title={`Select all cells in column "${headers[idx]}"`}
                                />
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    )}
                    {/* Header row */}
                    <tr>
                      <th className="border border-border bg-muted p-2 text-left font-semibold w-16 min-w-[4rem] sticky left-0 z-30 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                        #
                      </th>
                      {headers.map((header, idx) => {
                        const isEditingThisHeader = editingHeader === idx;
                        const headerCellKey = `header-${idx}`;
                        const isSelected = selectedCells.has(headerCellKey);
                        const isHeaderAiTransformed = aiTransformedCells.has(headerCellKey);
                        const isHeaderEdited = editedCells.has(headerCellKey);

                        return (
                          <th
                            key={idx}
                            className={cn(
                              "border border-border bg-muted p-2 text-left font-semibold min-w-[120px] max-w-[300px] whitespace-nowrap",
                              isEditMode && !isEditingThisHeader && "cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors",
                              isSelected && "bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500 ring-inset",
                              isHeaderAiTransformed && "bg-purple-100 dark:bg-purple-900/50",
                              isHeaderEdited && "bg-green-100 dark:bg-green-900/50"
                            )}
                            onClick={isEditMode && !isEditingThisHeader ? (e) => handleColumnHeaderClick(idx, e) : undefined}
                            onDoubleClick={isEditMode && !isEditingThisHeader ? () => handleHeaderDoubleClick(idx) : undefined}
                            title={isEditMode ? `Double-click to edit column header` : header}
                          >
                            {isEditingThisHeader ? (
                              <div className="flex items-center gap-1">
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleConfirmEdit();
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit();
                                    }
                                  }}
                                  className="flex-1 px-1 py-0.5 border rounded text-xs font-mono min-w-0"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0"
                                  onClick={handleConfirmEdit}
                                  title="Confirm (Enter)"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-5 w-5 p-0"
                                  onClick={handleCancelEdit}
                                  title="Cancel (Esc)"
                                >
                                  <X className="h-3 w-3 text-red-600" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <div className="truncate" title={header}>
                                  {header}
                                </div>
                                {isHeaderAiTransformed && (
                                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded text-[10px] font-medium text-green-700 dark:text-green-300 whitespace-nowrap shrink-0">
                                    <Check className="h-2.5 w-2.5" />
                                    <span>Verified</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="border border-border p-2 text-center font-mono text-xs text-muted-foreground bg-muted/30 sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                          {rowIdx + 1}
                        </td>
                        {row.map((cell, cellIdx) => {
                          const cellKey = `${rowIdx}-${cellIdx}`;
                          const isSelected = selectedCells.has(cellKey);
                          const isEditing = editingCell?.row === rowIdx && editingCell?.col === cellIdx;
                          const isAiTransformed = aiTransformedCells.has(cellKey);
                          const isManuallyEdited = editedCells.has(cellKey);

                          return (
                            <td
                              key={cellIdx}
                              data-row={rowIdx}
                              data-col={cellIdx}
                              className={cn(
                                "border border-border p-2 font-mono text-xs whitespace-nowrap transition-colors relative",
                                isEditMode && !isEditing && "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950",
                                isSelected && "bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500 ring-inset",
                                isAiTransformed && "bg-purple-100 dark:bg-purple-900/50",
                                isManuallyEdited && "bg-green-100 dark:bg-green-900/50"
                              )}
                              onMouseDown={isEditMode && !isEditing ? (e) => handleCellMouseDown(rowIdx, cellIdx, e) : undefined}
                              onMouseEnter={isEditMode && isSelecting ? (e) => handleCellMouseEnter(rowIdx, cellIdx, e) : undefined}
                              onMouseUp={isEditMode ? handleCellMouseUp : undefined}
                              onDoubleClick={() => handleCellDoubleClick(rowIdx, cellIdx)}
                            >
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleConfirmEdit();
                                      } else if (e.key === 'Escape') {
                                        handleCancelEdit();
                                      }
                                    }}
                                    className="flex-1 px-1 py-0.5 border rounded text-xs font-mono min-w-0"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    onClick={handleConfirmEdit}
                                    title="Confirm (Enter)"
                                  >
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    onClick={handleCancelEdit}
                                    title="Cancel (Esc)"
                                  >
                                    <X className="h-3 w-3 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <div className="max-w-[300px] truncate" title={cell}>
                                    {cell}
                                  </div>
                                  {isAiTransformed && (
                                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-700 rounded text-[10px] font-medium text-green-700 dark:text-green-300 whitespace-nowrap shrink-0">
                                      <Check className="h-2.5 w-2.5" />
                                      <span>Verified</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rows.length === 0 && (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">No data rows found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Transform Processing Console Log */}
        {isAiProcessing && aiProgress && transformationLog.length > 0 && (
          <div className="absolute bottom-4 right-4 w-[600px] max-h-[400px] bg-black/95 backdrop-blur-sm rounded-lg border border-green-500/30 shadow-2xl z-50 flex flex-col font-mono text-xs">
            {/* Console Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-green-500/30 bg-green-950/20">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 animate-pulse"></div>
                </div>
                <span className="text-green-400 font-semibold">Transform Console</span>
              </div>
              <div className="text-green-400/70 text-[10px]">
                Processing {aiProgress.current} / {aiProgress.total}
              </div>
            </div>

            {/* Console Log Entries */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-1.5">
                {transformationLog.slice().reverse().map((entry, idx) => {
                  const timestamp = entry.timestamp.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    fractionalSecondDigits: 3
                  });

                  return (
                    <div key={idx} className="text-[11px] leading-relaxed">
                      <div className={cn(
                        "flex items-start gap-2",
                        entry.success ? "text-green-400" : "text-red-400"
                      )}>
                        <span className="text-gray-500 shrink-0">[{timestamp}]</span>
                        <span className={cn(
                          "shrink-0 font-bold",
                          entry.success ? "text-green-500" : "text-red-500"
                        )}>
                          {entry.success ? "✓" : "✗"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="text-cyan-400">{entry.columnName}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="text-white truncate">
                            {entry.success ? entry.newValue : entry.error}
                          </span>
                          <span className="text-purple-400 ml-2">({entry.duration}ms)</span>
                          {entry.reasoning && (
                            <div className="text-yellow-400/70 italic mt-0.5 text-[10px]">
                              {entry.reasoning}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>

      {/* AI Prompt Dialog */}
      <AiPromptDialog
        isOpen={showAiPromptDialog}
        onClose={() => setShowAiPromptDialog(false)}
        selectedCellCount={selectedCells.size}
        onSubmit={handleAiGenerate}
        isProcessing={isAiProcessing}
      />

      {/* Transformation Log Panel */}
      {showLog && transformationLog.length > 0 && (
        <Dialog open={showLog} onOpenChange={setShowLog}>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Transformation Log</DialogTitle>
              <DialogDescription>
                History of all cell transformations in this session
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-2">
                {transformationLog.map((entry, idx) => {
                  const isExpanded = expandedLogEntries.has(idx);
                  const toggleExpanded = () => {
                    setExpandedLogEntries(prev => {
                      const next = new Set(prev);
                      if (next.has(idx)) {
                        next.delete(idx);
                      } else {
                        next.add(idx);
                      }
                      return next;
                    });
                  };

                  return (
                    <div
                      key={idx}
                      className="border rounded-lg p-3 space-y-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                            {entry.rowIdx === -1 ? 'Header' : `Row ${entry.rowIdx + 1}`}
                          </div>
                          <div className="text-xs text-muted-foreground">•</div>
                          <div className="text-xs font-medium">
                            {entry.columnName}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            {entry.success ? (
                              <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">
                            {entry.timestamp.toLocaleTimeString()}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={toggleExpanded}
                            title={isExpanded ? "Hide details" : "Show details"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground mb-1">Before:</div>
                          <div className="font-mono bg-background p-2 rounded border">
                            {entry.oldValue || '(empty)'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">After:</div>
                          <div className={cn(
                            "font-mono p-2 rounded border",
                            entry.success
                              ? "bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800"
                              : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
                          )}>
                            {entry.newValue}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-1">Reasoning:</div>
                          <div className={cn(
                            "p-2 rounded border text-xs italic",
                            entry.reasoning
                              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
                              : "bg-muted/30 border-border text-muted-foreground"
                          )}>
                            {entry.reasoning || '(no reasoning provided)'}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Debug Section */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t space-y-2">
                          <div className="text-xs font-semibold text-muted-foreground mb-2">
                            Debug Information
                          </div>

                          <div className="space-y-1.5">
                            {/* Status */}
                            <div className="flex items-start gap-2">
                              <div className="text-xs text-muted-foreground min-w-[80px]">Status:</div>
                              <div className={cn(
                                "text-xs font-medium",
                                entry.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                              )}>
                                {entry.success ? '✓ Success' : '✗ Failed'}
                              </div>
                            </div>

                            {/* Model */}
                            <div className="flex items-start gap-2">
                              <div className="text-xs text-muted-foreground min-w-[80px]">Model:</div>
                              <div className="text-xs font-mono bg-background px-2 py-0.5 rounded border">
                                {entry.model}
                              </div>
                            </div>

                            {/* Duration */}
                            <div className="flex items-start gap-2">
                              <div className="text-xs text-muted-foreground min-w-[80px]">Duration:</div>
                              <div className="text-xs font-mono">
                                {entry.duration}ms ({(entry.duration / 1000).toFixed(2)}s)
                              </div>
                            </div>

                            {/* Prompt */}
                            <div className="flex items-start gap-2">
                              <div className="text-xs text-muted-foreground min-w-[80px]">Prompt:</div>
                              <div className="flex-1 text-xs font-mono bg-background p-2 rounded border max-h-32 overflow-y-auto">
                                {entry.prompt}
                              </div>
                            </div>

                            {/* Error (if failed) */}
                            {!entry.success && entry.error && (
                              <div className="flex items-start gap-2">
                                <div className="text-xs text-muted-foreground min-w-[80px]">Error:</div>
                                <div className="flex-1 text-xs font-mono bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-2 rounded border border-red-200 dark:border-red-800">
                                  {entry.error}
                                </div>
                              </div>
                            )}

                            {/* Compact Summary */}
                            {entry.timeline && (() => {
                              const responseEvent = entry.timeline.events.find(e => e.type === 'response');
                              const requestEvent = entry.timeline.events.find(e => e.type === 'request');
                              const completeEvent = entry.timeline.events.find(e => e.type === 'complete');
                              const totalDuration = completeEvent?.data?.totalDuration ||
                                (entry.timeline.completedTime - entry.timeline.startTime);
                              const model = responseEvent?.data?.model || 'Unknown';
                              const modelReason = responseEvent?.data?.modelSelectionReason;
                              const complexityAnalysis = responseEvent?.data?.complexityAnalysis;
                              const reasoning = responseEvent?.data?.reasoning;
                              const tokensUsed = responseEvent?.data?.tokensUsed;
                              const estimatedCost = responseEvent?.data?.estimatedCost;
                              const oldValue = completeEvent?.data?.oldValue || '';
                              const newValue = completeEvent?.data?.newValue || responseEvent?.data?.newValue || '';
                              const changeType = responseEvent?.data?.changeType;

                              return (
                                <div className="space-y-3 mt-3 pt-3 border-t">
                                  {/* Compact header line */}
                                  <div className="flex items-center gap-4 text-xs flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground">Model:</span>
                                      <span className="font-semibold text-purple-600 dark:text-purple-400">{model}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground">Duration:</span>
                                      <span className="font-mono text-foreground">{totalDuration}ms</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground">Tokens:</span>
                                      <span className="font-mono text-foreground">{tokensUsed || 'N/A'}</span>
                                    </div>
                                    {estimatedCost && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground">Cost:</span>
                                        <span className="font-mono text-foreground">{estimatedCost}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground">Status:</span>
                                      <span className={entry.status === 'success' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                                        {entry.status === 'success' ? '✓' : '✗'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Transformation result */}
                                  <div className="text-xs space-y-1 bg-muted/30 p-2 rounded">
                                    <div className="flex gap-2">
                                      <span className="text-muted-foreground shrink-0">Before:</span>
                                      <span className="text-foreground font-mono">{oldValue}</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <span className="text-muted-foreground shrink-0">After:</span>
                                      <span className="text-green-600 dark:text-green-400 font-mono font-semibold">{newValue}</span>
                                    </div>
                                  </div>

                                  {/* Reasoning (if available) */}
                                  {reasoning && (
                                    <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-2 rounded">
                                      <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">
                                        💭 Reasoning:
                                      </div>
                                      <div className="text-xs text-purple-900 dark:text-purple-300 italic">
                                        {reasoning}
                                      </div>
                                    </div>
                                  )}

                                  {/* Model Selection Details */}
                                  {modelReason && (
                                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-2 rounded">
                                      <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                                        🤖 Model Selection:
                                      </div>
                                      <div className="text-xs text-blue-900 dark:text-blue-300">
                                        {modelReason}
                                      </div>
                                      {complexityAnalysis && (
                                        <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800 space-y-1">
                                          <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Complexity Analysis:</div>
                                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Very Complex Prompt:</span>
                                              <span className={complexityAnalysis.veryComplexPrompt ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-green-600 dark:text-green-400"}>
                                                {complexityAnalysis.veryComplexPrompt ? 'Yes' : 'No'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Complex Prompt:</span>
                                              <span className={complexityAnalysis.complexPrompt ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-green-600 dark:text-green-400"}>
                                                {complexityAnalysis.complexPrompt ? 'Yes' : 'No'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Complex Data:</span>
                                              <span className={complexityAnalysis.complexData ? "text-orange-600 dark:text-orange-400 font-semibold" : "text-green-600 dark:text-green-400"}>
                                                {complexityAnalysis.complexData ? 'Yes' : 'No'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Simple Task:</span>
                                              <span className={complexityAnalysis.simpleTask ? "text-green-600 dark:text-green-400 font-semibold" : "text-orange-600 dark:text-orange-400"}>
                                                {complexityAnalysis.simpleTask ? 'Yes' : 'No'}
                                              </span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Prompt Length:</span>
                                              <span className="font-mono">{complexityAnalysis.promptLength} chars</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Data Length:</span>
                                              <span className="font-mono">{complexityAnalysis.dataLength} chars</span>
                                            </div>
                                            <div className="flex justify-between">
                                              <span className="text-muted-foreground">Batch Size:</span>
                                              <span className="font-mono">{complexityAnalysis.batchSize} cells</span>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Collapsible detailed timeline */}
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                                      View detailed timeline →
                                    </summary>
                                    <div className="mt-3 space-y-2 relative pl-4">
                                      {/* Timeline vertical line */}
                                      <div className="absolute left-1 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-green-500" />

                                      {entry.timeline.events.map((event, eventIdx) => {
                                        const relativeTime = event.time - entry.timeline.startTime;
                                        const eventColors = {
                                          start: 'bg-blue-500',
                                          request: 'bg-purple-500',
                                          response: 'bg-indigo-500',
                                          complete: 'bg-green-500',
                                          error: 'bg-red-500'
                                        };
                                        const eventColor = eventColors[event.type];

                                        return (
                                          <div key={eventIdx} className="relative flex gap-2 items-start">
                                            <div className={cn("relative z-10 w-1.5 h-1.5 rounded-full shrink-0 mt-1", eventColor)} />
                                            <div className="flex-1 min-w-0 text-[11px]">
                                              <div className="flex items-center gap-2">
                                                <span className="text-foreground">{event.message}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">+{relativeTime}ms</span>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </details>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex justify-between items-center pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="text-sm text-muted-foreground">
                  Total: {transformationLog.length} transformation{transformationLog.length !== 1 ? 's' : ''}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (expandedLogEntries.size === transformationLog.length) {
                      // Collapse all
                      setExpandedLogEntries(new Set());
                    } else {
                      // Expand all
                      setExpandedLogEntries(new Set(transformationLog.map((_, idx) => idx)));
                    }
                  }}
                  className="text-xs"
                >
                  {expandedLogEntries.size === transformationLog.length ? 'Collapse All' : 'Expand All'}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setSelectedCells(new Set());
                    setShowLog(false);
                    toast({
                      title: 'Changes Confirmed',
                      description: 'Transformations have been accepted. All cells deselected.'
                    });
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLog(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
