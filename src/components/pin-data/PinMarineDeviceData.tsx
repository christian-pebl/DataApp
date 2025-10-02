"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, LayoutGrid, Minus, AlignHorizontalJustifyCenter } from "lucide-react";

import { PinPlotInstance } from "./PinPlotInstance";
import { PinMarineMeteoPlot } from "./PinMarineMeteoPlot";
import { FileSelector } from "./FileSelector";
import { PlotTypeSelector } from "./PlotTypeSelector";
import { parseISO, isValid, formatISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import type { ParseResult } from "./csvParser";
import type { CombinedDataPoint } from "@/app/om-marine-explorer/shared";

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

    const startDate = parseISO(firstPlotData.data[startIdx].time);
    const endDate = parseISO(firstPlotData.data[endIdx].time);

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
                plot.type === 'device' ? (
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
                  />
                ) : (
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
                  />
                )
              ))}

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