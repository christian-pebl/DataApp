"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, LayoutGrid, Minus, AlignHorizontalJustifyCenter } from "lucide-react";

import { PinPlotInstance } from "./PinPlotInstance";
import { FileSelector } from "./FileSelector";
import { parseISO, isValid } from 'date-fns';
import type { ParseResult } from "./csvParser";

interface PlotConfig {
  id: string;
  title: string;
  fileType: 'GP' | 'FPOD' | 'Subcam';
  files: File[];
  fileName: string; // Display name of the file(s)
}

interface PinFile {
  id: string;
  pinId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Date;
  projectId: string;
}

interface FileOption {
  pinId: string;
  pinName: string;
  pinLocation?: { lat: number; lng: number };
  fileType: 'GP' | 'FPOD' | 'Subcam';
  files: File[];
  fileName: string;
  metadata?: PinFile; // Include metadata for downloading
  needsDownload?: boolean; // Indicates file needs to be downloaded before use
}

interface PinMarineDeviceDataProps {
  fileType: 'GP' | 'FPOD' | 'Subcam';
  files: File[];
  onRequestFileSelection?: () => void; // Callback to open file selector
  // Props for multi-file support
  availableFiles?: FileOption[];
  onDownloadFile?: (pinId: string, fileName: string) => Promise<File | null>; // Callback to download file on-demand
}

export function PinMarineDeviceData({ fileType, files, onRequestFileSelection, availableFiles, onDownloadFile }: PinMarineDeviceDataProps) {
  // State for managing plots with file data
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const plotsInitialized = useRef(false);
  const [showFileSelector, setShowFileSelector] = useState(false);

  // Time axis synchronization state
  const [timeAxisMode, setTimeAxisMode] = useState<'separate' | 'common'>('separate');
  const [globalTimeRange, setGlobalTimeRange] = useState<{ min: Date | null; max: Date | null }>({ min: null, max: null });
  const [globalBrushRange, setGlobalBrushRange] = useState<{ startIndex: number; endIndex: number | undefined }>({ startIndex: 0, endIndex: undefined });
  const [plotsData, setPlotsData] = useState<Record<string, ParseResult>>({});

  // Get file display name
  const getFileName = (fileList: File[]) => {
    if (fileList.length === 0) return 'No files';
    if (fileList.length === 1) return fileList[0].name;
    return `${fileList.length} files`;
  };

  // Calculate global time range from all plots' data
  const calculateGlobalTimeRange = useCallback(() => {
    const allTimestamps: Date[] = [];

    Object.values(plotsData).forEach((result) => {
      result.data.forEach((point) => {
        const date = parseISO(point.time);
        if (isValid(date)) {
          allTimestamps.push(date);
        }
      });
    });

    if (allTimestamps.length === 0) {
      return { min: null, max: null };
    }

    return {
      min: new Date(Math.min(...allTimestamps.map((d) => d.getTime()))),
      max: new Date(Math.max(...allTimestamps.map((d) => d.getTime()))),
    };
  }, [plotsData]);

  // Update global time range when plots data changes or mode changes
  useEffect(() => {
    if (timeAxisMode === 'common') {
      const range = calculateGlobalTimeRange();
      setGlobalTimeRange(range);
    }
  }, [timeAxisMode, plotsData, calculateGlobalTimeRange]);

  // Callback for plots to register their data
  const handlePlotDataParsed = useCallback((plotId: string, parseResult: ParseResult) => {
    setPlotsData((prev) => ({
      ...prev,
      [plotId]: parseResult,
    }));
  }, []);

  // Callback for brush changes in common mode
  const handleGlobalBrushChange = useCallback((brushData: { startIndex?: number; endIndex?: number }) => {
    setGlobalBrushRange({
      startIndex: brushData.startIndex ?? 0,
      endIndex: brushData.endIndex,
    });
  }, []);

  // Plot management functions
  const addPlot = useCallback((fileType: 'GP' | 'FPOD' | 'Subcam', files: File[], customTitle?: string) => {
    setPlots((prevPlots) => [
      ...prevPlots,
      {
        id: `pin-plot-${Date.now()}-${prevPlots.length}`,
        title: customTitle || `${fileType} Data Plot ${prevPlots.length + 1}`,
        fileType,
        files,
        fileName: getFileName(files)
      },
    ]);
  }, []);

  const removePlot = useCallback((idToRemove: string) => {
    setPlots((prevPlots) => prevPlots.filter((plot) => plot.id !== idToRemove));
  }, []);

  // Initialize with one plot for the initially selected files
  React.useEffect(() => {
    if (!plotsInitialized.current && plots.length === 0 && files.length > 0) {
      addPlot(fileType, files, getFileName(files));
      plotsInitialized.current = true;
    }
  }, [addPlot, plots.length, fileType, files]);

  return (
    <div className="h-full flex flex-col">
      {/* Content area - clean white background without header */}
      <CardContent className="p-3 flex-1 overflow-hidden">
        {plots.length === 0 ? (
          // Empty state - exactly like the original
          <div className="flex flex-col items-center justify-center text-muted-foreground h-full min-h-40 p-2 border rounded-md bg-muted/20">
            <LayoutGrid className="w-8 h-8 mb-2 text-muted" />
            <p className="text-xs">No device data plots to display.</p>
            <p className="text-[0.7rem]">Click "Add New Plot" to get started.</p>
          </div>
        ) : (
          // Plots container - scrollable with Add Plot button
          <div className="h-full flex flex-col gap-3">
            {/* Time Axis Mode Toggle - Sticky at top */}
            {plots.length > 1 && (
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Time Axis Mode:</span>
                  <div className="flex items-center gap-2">
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Separate</span>
                    <Switch
                      checked={timeAxisMode === 'common'}
                      onCheckedChange={(checked) => setTimeAxisMode(checked ? 'common' : 'separate')}
                      className="h-5 w-9"
                    />
                    <span className="text-xs text-muted-foreground">Common</span>
                    <AlignHorizontalJustifyCenter className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3">
              {plots.map((plot, index) => (
                <PinPlotInstance
                  key={plot.id}
                  instanceId={plot.id}
                  initialPlotTitle={plot.fileName}
                  onRemovePlot={plots.length > 1 ? removePlot : undefined}
                  fileType={plot.fileType}
                  files={plot.files}
                  timeAxisMode={timeAxisMode}
                  globalTimeRange={timeAxisMode === 'common' ? globalTimeRange : undefined}
                  globalBrushRange={timeAxisMode === 'common' ? globalBrushRange : undefined}
                  onDataParsed={handlePlotDataParsed}
                  onBrushChange={timeAxisMode === 'common' && index === plots.length - 1 ? handleGlobalBrushChange : undefined}
                  isLastPlot={index === plots.length - 1}
                />
              ))}

              {/* Add Plot Button - inside scrollable area */}
              <div className="flex justify-center py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Add Plot clicked, availableFiles:', availableFiles);
                    setShowFileSelector(true);
                  }}
                  className="gap-2"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Plot
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* File Selector Modal */}
      {(() => {
        console.log('FileSelector render check:', { showFileSelector, availableFiles, hasFiles: availableFiles?.length });
        return showFileSelector && availableFiles && (
          <FileSelector
            availableFiles={availableFiles}
            onSelectFile={async (fileOption) => {
              // Check if files need to be downloaded
              if (fileOption.files.length === 0 && onDownloadFile && fileOption.metadata) {
                console.log('📥 File not loaded, downloading...', fileOption.fileName);
                const downloadedFile = await onDownloadFile(fileOption.pinId, fileOption.fileName);

                if (downloadedFile) {
                  // Add plot with downloaded file
                  addPlot(fileOption.fileType, [downloadedFile], fileOption.fileName);
                  setShowFileSelector(false);
                } else {
                  console.error('Failed to download file:', fileOption.fileName);
                  // Don't close the modal, let user try again or cancel
                }
              } else {
                // Files already loaded, add plot directly
                addPlot(fileOption.fileType, fileOption.files, fileOption.fileName);
                setShowFileSelector(false);
              }
            }}
            onCancel={() => setShowFileSelector(false)}
            excludeFileNames={plots.map(p => p.fileName)}
          />
        );
      })()}
    </div>
  );
}