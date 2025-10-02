"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, LayoutGrid, Minus, AlignHorizontalJustifyCenter, Merge } from "lucide-react";

import { PinPlotInstance } from "./PinPlotInstance";
import { PinMarineMeteoPlot } from "./PinMarineMeteoPlot";
import { PinMergedPlot } from "./PinMergedPlot";
import { FileSelector } from "./FileSelector";
import { PlotTypeSelector } from "./PlotTypeSelector";
import { parseISO, isValid, formatISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import type { ParseResult } from "./csvParser";
import type { CombinedDataPoint } from "@/app/om-marine-explorer/shared";

interface MergedParameterConfig {
  parameter: string;
  sourceType: 'GP' | 'FPOD' | 'Subcam' | 'marine';
  sourceLabel: string;
  color: string;
  axis: 'left' | 'right';
  fileType?: 'GP' | 'FPOD' | 'Subcam';
  files?: File[];
  location?: { lat: number; lon: number };
  timeRange?: { startDate: string; endDate: string };
}

interface PlotConfig {
  id: string;
  title: string;
  type: 'device' | 'marine-meteo';
  // For device plots
  fileType?: 'GP' | 'FPOD' | 'Subcam';
  files?: File[];
  fileName?: string; // Display name of the file(s)
  // For marine/meteo plots
  location?: { lat: number; lon: number };
  locationName?: string;
  timeRange?: { startDate: string; endDate: string };
  // For merged plots
  isMerged?: boolean;
  mergedParams?: MergedParameterConfig[];
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
  // Props for marine/meteo integration
  objectLocation?: { lat: number; lng: number };
  objectName?: string;
}

export function PinMarineDeviceData({ fileType, files, onRequestFileSelection, availableFiles, onDownloadFile, objectLocation, objectName }: PinMarineDeviceDataProps) {
  const { toast } = useToast();

  // State for managing plots with file data
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const plotsInitialized = useRef(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showPlotTypeSelector, setShowPlotTypeSelector] = useState(false);

  // Time axis synchronization state
  const [timeAxisMode, setTimeAxisMode] = useState<'separate' | 'common'>('separate');
  const [globalTimeRange, setGlobalTimeRange] = useState<{ min: Date | null; max: Date | null }>({ min: null, max: null });
  const [globalBrushRange, setGlobalBrushRange] = useState<{ startIndex: number; endIndex: number | undefined }>({ startIndex: 0, endIndex: undefined });
  const [plotsData, setPlotsData] = useState<Record<string, ParseResult>>({});

  // Visibility tracking for merge feature
  const [plotVisibilityState, setPlotVisibilityState] = useState<
    Record<string, { params: string[], colors: Record<string, string> }>
  >({});

  // Get file display name
  const getFileName = (fileList: File[]) => {
    if (fileList.length === 0) return 'No files';
    if (fileList.length === 1) return fileList[0].name;
    return `${fileList.length} files`;
  };

  // Calculate global time range from brush-selected range of first plot
  const calculateGlobalTimeRange = useCallback(() => {
    // Get first plot's data as reference
    if (plots.length === 0) return { min: null, max: null };

    const firstPlot = plots[0];
    const firstPlotData = plotsData[firstPlot.id];

    if (!firstPlotData || firstPlotData.data.length === 0) {
      return { min: null, max: null };
    }

    // Use brush range to determine visible time range
    const startIdx = Math.max(0, globalBrushRange.startIndex);
    const endIdx = Math.min(
      firstPlotData.data.length - 1,
      globalBrushRange.endIndex ?? firstPlotData.data.length - 1
    );

    // Safety check: ensure indices are within bounds
    if (startIdx >= firstPlotData.data.length || endIdx >= firstPlotData.data.length) {
      return { min: null, max: null };
    }

    const startPoint = firstPlotData.data[startIdx];
    const endPoint = firstPlotData.data[endIdx];

    // Safety check: ensure data points have time property
    if (!startPoint?.time || !endPoint?.time) {
      return { min: null, max: null };
    }

    const startDate = parseISO(startPoint.time);
    const endDate = parseISO(endPoint.time);

    if (!isValid(startDate) || !isValid(endDate)) {
      return { min: null, max: null };
    }

    return {
      min: startDate,
      max: endDate,
    };
  }, [plots, plotsData, globalBrushRange]);

  // Update global time range when plots data changes, mode changes, or brush changes
  useEffect(() => {
    if (timeAxisMode === 'common') {
      const range = calculateGlobalTimeRange();
      setGlobalTimeRange(range);
    }
  }, [timeAxisMode, plotsData, globalBrushRange, calculateGlobalTimeRange]);

  // Callback for plots to register their data
  const handlePlotDataParsed = useCallback((plotId: string, data: ParseResult | CombinedDataPoint[]) => {
    // Convert CombinedDataPoint[] to ParseResult format for marine/meteo
    if (Array.isArray(data) && data.length > 0 && 'waveHeight' in data[0]) {
      // Marine/meteo data - convert to ParseResult format
      const marineParseResult: ParseResult = {
        data: data.map(d => ({ time: d.time, ...d })) as any,
        headers: Object.keys(data[0]),
        errors: [],
        summary: {
          totalRows: data.length,
          validRows: data.length,
          columns: Object.keys(data[0]).length,
          timeColumn: 'time'
        }
      };
      setPlotsData((prev) => ({ ...prev, [plotId]: marineParseResult }));
    } else {
      // Device data (existing logic)
      setPlotsData((prev) => ({ ...prev, [plotId]: data as ParseResult }));
    }
  }, []);

  // Callback for brush changes in common mode
  const handleGlobalBrushChange = useCallback((brushData: { startIndex?: number; endIndex?: number }) => {
    setGlobalBrushRange({
      startIndex: brushData.startIndex ?? 0,
      endIndex: brushData.endIndex,
    });
  }, []);

  // Helper to extract time range from first plot
  const extractTimeRangeFromPlotData = useCallback((parseResult: ParseResult): { startDate: string; endDate: string } | null => {
    try {
      const dates = parseResult.data
        .map(d => parseISO(d.time))
        .filter(isValid);

      if (dates.length === 0) return null;

      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

      return {
        startDate: formatISO(minDate, { representation: 'date' }),
        endDate: formatISO(maxDate, { representation: 'date' })
      };
    } catch (e) {
      console.error('Error extracting time range:', e);
      return null;
    }
  }, []);

  // Plot management functions
  const addPlot = useCallback((
    type: 'device' | 'marine-meteo',
    files: File[] = [],
    options?: {
      fileType?: 'GP' | 'FPOD' | 'Subcam';
      customTitle?: string;
      location?: { lat: number; lon: number };
      locationName?: string;
      timeRange?: { startDate: string; endDate: string };
    }
  ) => {
    setPlots((prevPlots) => [
      ...prevPlots,
      {
        id: `pin-plot-${Date.now()}-${prevPlots.length}`,
        title: options?.customTitle || `Plot ${prevPlots.length + 1}`,
        type,
        // Device plot properties
        fileType: options?.fileType,
        files: type === 'device' ? files : undefined,
        fileName: type === 'device' ? getFileName(files) : undefined,
        // Marine/meteo plot properties
        location: options?.location,
        locationName: options?.locationName,
        timeRange: options?.timeRange,
      },
    ]);
  }, []);

  const removePlot = useCallback((idToRemove: string) => {
    setPlots((prevPlots) => prevPlots.filter((plot) => plot.id !== idToRemove));
  }, []);

  // Handler for visibility changes from child plots
  const handleVisibilityChange = useCallback((plotId: string) =>
    (params: string[], colors: Record<string, string>) => {
      setPlotVisibilityState(prev => ({
        ...prev,
        [plotId]: { params, colors }
      }));
    }, []);

  // Check if plots are eligible for merging
  const canMergePlots = useMemo(() => {
    if (plots.length < 2) return false;
    const firstState = plotVisibilityState[plots[0].id];
    const secondState = plotVisibilityState[plots[1].id];

    // Check if both have exactly 1 visible parameter
    if (firstState?.params.length !== 1 || secondState?.params.length !== 1) {
      return false;
    }

    // Allow merging if:
    // 1. Parameters are different, OR
    // 2. Parameters are the same BUT from different data sources (different files/locations)
    const firstParam = firstState.params[0];
    const secondParam = secondState.params[0];
    const firstPlot = plots[0];
    const secondPlot = plots[1];

    // If parameters are different, allow merge
    if (firstParam !== secondParam) {
      return true;
    }

    // If same parameter, only allow if from different sources
    // Check if they have different identifiers (fileName, locationName, or id)
    if (firstPlot.type === 'device' && secondPlot.type === 'device') {
      return firstPlot.fileName !== secondPlot.fileName;
    } else if (firstPlot.type === 'marine-meteo' && secondPlot.type === 'marine-meteo') {
      return firstPlot.locationName !== secondPlot.locationName;
    } else {
      // Different types (device vs marine), allow merge
      return true;
    }
  }, [plots, plotVisibilityState]);

  // Handler for merging first 2 plots
  const handleMergePlots = () => {
    if (plots.length < 2) return;

    const firstPlot = plots[0];
    const secondPlot = plots[1];

    const firstState = plotVisibilityState[firstPlot.id];
    const secondState = plotVisibilityState[secondPlot.id];

    if (!firstState || !secondState || firstState.params.length !== 1 || secondState.params.length !== 1) {
      return;
    }

    const param1 = firstState.params[0];
    const param2 = secondState.params[0];

    // Create merged plot config
    const mergedPlot: PlotConfig = {
      id: `merged-${Date.now()}`,
      title: `Merged: ${param1} + ${param2}`,
      type: firstPlot.type, // Use first plot's type as placeholder
      isMerged: true,
      mergedParams: [
        {
          parameter: param1,
          sourceType: (firstPlot.type === 'marine-meteo' ? 'marine' : firstPlot.fileType) as 'GP' | 'FPOD' | 'Subcam' | 'marine',
          sourceLabel: (firstPlot.type === 'marine-meteo' ? firstPlot.locationName : firstPlot.fileName) as string,
          color: firstState.colors[param1],
          axis: 'left' as const,
          ...(firstPlot.type === 'device' && {
            fileType: firstPlot.fileType,
            files: firstPlot.files
          }),
          ...(firstPlot.type === 'marine-meteo' && {
            location: firstPlot.location,
            timeRange: firstPlot.timeRange
          })
        },
        {
          parameter: param2,
          sourceType: (secondPlot.type === 'marine-meteo' ? 'marine' : secondPlot.fileType) as 'GP' | 'FPOD' | 'Subcam' | 'marine',
          sourceLabel: (secondPlot.type === 'marine-meteo' ? secondPlot.locationName : secondPlot.fileName) as string,
          color: secondState.colors[param2],
          axis: 'right' as const,
          ...(secondPlot.type === 'device' && {
            fileType: secondPlot.fileType,
            files: secondPlot.files
          }),
          ...(secondPlot.type === 'marine-meteo' && {
            location: secondPlot.location,
            timeRange: secondPlot.timeRange
          })
        }
      ]
    };

    // Replace first 2 plots with merged plot
    setPlots([mergedPlot, ...plots.slice(2)]);

    // Force common mode for merged plots
    setTimeAxisMode('common');
  };

  // Handler for unmerging plots
  const handleUnmergePlot = (mergedPlotId: string) => {
    const mergedPlot = plots.find(p => p.id === mergedPlotId);
    if (!mergedPlot?.isMerged || !mergedPlot.mergedParams || mergedPlot.mergedParams.length !== 2) {
      return;
    }

    const [leftConfig, rightConfig] = mergedPlot.mergedParams;

    // Recreate original plot 1
    const plot1: PlotConfig = {
      id: `unmerged-1-${Date.now()}`,
      title: leftConfig.parameter,
      type: leftConfig.sourceType === 'marine' ? 'marine-meteo' : 'device',
      ...(leftConfig.sourceType === 'marine' ? {
        location: leftConfig.location,
        locationName: leftConfig.sourceLabel,
        timeRange: leftConfig.timeRange
      } : {
        fileType: leftConfig.fileType,
        files: leftConfig.files,
        fileName: leftConfig.sourceLabel
      })
    };

    // Recreate original plot 2
    const plot2: PlotConfig = {
      id: `unmerged-2-${Date.now()}`,
      title: rightConfig.parameter,
      type: rightConfig.sourceType === 'marine' ? 'marine-meteo' : 'device',
      ...(rightConfig.sourceType === 'marine' ? {
        location: rightConfig.location,
        locationName: rightConfig.sourceLabel,
        timeRange: rightConfig.timeRange
      } : {
        fileType: rightConfig.fileType,
        files: rightConfig.files,
        fileName: rightConfig.sourceLabel
      })
    };

    // Replace merged plot with originals
    const mergedIndex = plots.findIndex(p => p.id === mergedPlotId);
    setPlots([
      ...plots.slice(0, mergedIndex),
      plot1,
      plot2,
      ...plots.slice(mergedIndex + 1)
    ]);
  };

  // Handler for adding marine/meteo plot
  const handleAddMarineMeteoPlot = useCallback(() => {
    // Check prerequisites
    if (plots.length === 0) {
      toast({
        variant: "destructive",
        title: "Cannot Add Marine/Meteo Data",
        description: "Please add at least one device data plot first."
      });
      return;
    }

    if (!objectLocation) {
      toast({
        variant: "destructive",
        title: "Cannot Add Marine/Meteo Data",
        description: "Object location is not available."
      });
      return;
    }

    // Extract time range from first plot
    const firstPlot = plots[0];
    const firstPlotData = plotsData[firstPlot.id];

    if (!firstPlotData) {
      toast({
        variant: "destructive",
        title: "Cannot Add Marine/Meteo Data",
        description: "First plot data not loaded yet. Please wait."
      });
      return;
    }

    const timeRange = extractTimeRangeFromPlotData(firstPlotData);

    if (!timeRange) {
      toast({
        variant: "destructive",
        title: "Cannot Add Marine/Meteo Data",
        description: "Could not extract time range from first plot."
      });
      return;
    }

    // Add marine/meteo plot
    addPlot('marine-meteo', [], {
      location: { lat: objectLocation.lat, lon: objectLocation.lng },
      locationName: objectName || 'Object Location',
      timeRange
    });

    setShowPlotTypeSelector(false);

    toast({
      title: "Marine/Meteo Plot Added",
      description: `Time range: ${timeRange.startDate} to ${timeRange.endDate}`
    });
  }, [plots, plotsData, objectLocation, objectName, extractTimeRangeFromPlotData, addPlot, toast]);

  // Initialize with one plot for the initially selected files
  React.useEffect(() => {
    if (!plotsInitialized.current && plots.length === 0 && files.length > 0) {
      addPlot('device', files, { fileType, customTitle: getFileName(files) });
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
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Time Axis Mode:</span>
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

                  {/* Merge Plots Button */}
                  {canMergePlots && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleMergePlots}
                      className="shrink-0"
                    >
                      <Merge className="h-4 w-4 mr-2" />
                      Merge First 2 Plots
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3">
              {plots.map((plot, index) => {
                // Render merged plot
                if (plot.isMerged && plot.mergedParams && plot.mergedParams.length === 2) {
                  return (
                    <PinMergedPlot
                      key={plot.id}
                      instanceId={plot.id}
                      leftParam={plot.mergedParams[0]}
                      rightParam={plot.mergedParams[1]}
                      timeAxisMode={timeAxisMode}
                      globalTimeRange={timeAxisMode === 'common' ? globalTimeRange : undefined}
                      globalBrushRange={timeAxisMode === 'common' ? globalBrushRange : undefined}
                      onBrushChange={timeAxisMode === 'common' && index === plots.length - 1 ? handleGlobalBrushChange : undefined}
                      isLastPlot={index === plots.length - 1}
                      onRemovePlot={plots.length > 1 ? removePlot : undefined}
                      onUnmerge={handleUnmergePlot}
                    />
                  );
                }

                // Render device plot
                if (plot.type === 'device') {
                  return (
                    <PinPlotInstance
                      key={plot.id}
                      instanceId={plot.id}
                      initialPlotTitle={plot.fileName!}
                      onRemovePlot={plots.length > 1 ? removePlot : undefined}
                      fileType={plot.fileType!}
                      files={plot.files!}
                      timeAxisMode={timeAxisMode}
                      globalTimeRange={timeAxisMode === 'common' ? globalTimeRange : undefined}
                      globalBrushRange={timeAxisMode === 'common' ? globalBrushRange : undefined}
                      onDataParsed={handlePlotDataParsed}
                      onBrushChange={timeAxisMode === 'common' && index === plots.length - 1 ? handleGlobalBrushChange : undefined}
                      isLastPlot={index === plots.length - 1}
                      onVisibilityChange={handleVisibilityChange(plot.id)}
                    />
                  );
                }

                // Render marine/meteo plot
                return (
                  <PinMarineMeteoPlot
                    key={plot.id}
                    instanceId={plot.id}
                    location={plot.location!}
                    locationName={plot.locationName!}
                    timeRange={plot.timeRange!}
                    onRemovePlot={plots.length > 1 ? removePlot : undefined}
                    timeAxisMode={timeAxisMode}
                    globalTimeRange={timeAxisMode === 'common' ? globalTimeRange : undefined}
                    globalBrushRange={timeAxisMode === 'common' ? globalBrushRange : undefined}
                    onDataParsed={handlePlotDataParsed}
                    onBrushChange={timeAxisMode === 'common' && index === plots.length - 1 ? handleGlobalBrushChange : undefined}
                    isLastPlot={index === plots.length - 1}
                    onVisibilityChange={handleVisibilityChange(plot.id)}
                  />
                );
              })}

              {/* Add Plot Button - inside scrollable area */}
              <div className="flex justify-center py-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Add Plot clicked, availableFiles:', availableFiles);
                    setShowPlotTypeSelector(true);
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

      {/* Plot Type Selector Modal */}
      {showPlotTypeSelector && (
        <PlotTypeSelector
          onSelectDeviceData={() => {
            setShowPlotTypeSelector(false);
            setShowFileSelector(true);
          }}
          onSelectMarineMeteo={handleAddMarineMeteoPlot}
          onCancel={() => setShowPlotTypeSelector(false)}
        />
      )}

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
                  addPlot('device', [downloadedFile], {
                    fileType: fileOption.fileType,
                    customTitle: fileOption.fileName
                  });
                  setShowFileSelector(false);
                } else {
                  console.error('Failed to download file:', fileOption.fileName);
                  // Don't close the modal, let user try again or cancel
                }
              } else {
                // Files already loaded, add plot directly
                addPlot('device', fileOption.files, {
                  fileType: fileOption.fileType,
                  customTitle: fileOption.fileName
                });
                setShowFileSelector(false);
              }
            }}
            onCancel={() => setShowFileSelector(false)}
            excludeFileNames={plots.filter(p => p.type === 'device').map(p => p.fileName!)}
          />
        );
      })()}
    </div>
  );
}