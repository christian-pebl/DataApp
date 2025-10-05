"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, LayoutGrid, Minus, AlignHorizontalJustifyCenter } from "lucide-react";

import { PinPlotInstance } from "./PinPlotInstance";
import { PinMarineMeteoPlot } from "./PinMarineMeteoPlot";
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
  mergedData?: ParseResult; // Pre-parsed merged data
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

  // CSV preview for merge
  const [showMergePreview, setShowMergePreview] = useState(false);
  const [mergePreviewData, setMergePreviewData] = useState<ParseResult | null>(null);
  const [mergeRawData, setMergeRawData] = useState<ParseResult | null>(null); // Unrounded data
  const [timeRoundingInterval, setTimeRoundingInterval] = useState<string>('1hr'); // Default 1 hour

  // Get file display name
  const getFileName = (fileList: File[]) => {
    if (fileList.length === 0) return 'No files';
    if (fileList.length === 1) return fileList[0].name;
    return `${fileList.length} files`;
  };

  // Time rounding function
  const roundTimeToInterval = useCallback((isoTimeStr: string, interval: string): string => {
    const date = parseISO(isoTimeStr);
    if (!isValid(date)) return isoTimeStr;

    const minutes = date.getMinutes();
    const hours = date.getHours();
    const days = date.getDate();

    let roundedDate = new Date(date);

    switch (interval) {
      case '1min':
        // Round to nearest minute (already at minute precision)
        roundedDate.setSeconds(0, 0);
        break;
      case '10min':
        // Round to nearest 10 minutes
        roundedDate.setMinutes(Math.round(minutes / 10) * 10, 0, 0);
        break;
      case '30min':
        // Round to nearest 30 minutes
        roundedDate.setMinutes(Math.round(minutes / 30) * 30, 0, 0);
        break;
      case '1hr':
        // Round to nearest hour
        roundedDate.setMinutes(Math.round(minutes / 60) * 60, 0, 0);
        break;
      case '6hr':
        // Round to nearest 6 hours
        const totalHours = hours + (minutes / 60);
        const rounded6hr = Math.round(totalHours / 6) * 6;
        roundedDate.setHours(rounded6hr, 0, 0, 0);
        break;
      case '1day':
        // Round to nearest day (midnight)
        roundedDate.setHours(hours >= 12 ? 24 : 0, 0, 0, 0);
        break;
      default:
        roundedDate.setSeconds(0, 0);
    }

    return roundedDate.toISOString();
  }, []);

  // Apply time rounding to merged data
  const applyTimeRounding = useCallback((data: ParseResult, interval: string): ParseResult => {
    console.log('🔄 applyTimeRounding called with interval:', interval);

    // Group by rounded time and aggregate values
    const roundedGroups = new Map<string, any[]>();

    data.data.forEach(row => {
      const roundedTime = roundTimeToInterval(row.time, interval);
      if (!roundedGroups.has(roundedTime)) {
        roundedGroups.set(roundedTime, []);
      }
      roundedGroups.get(roundedTime)!.push(row);
    });

    // For each rounded time, aggregate the values (take first non-null for each parameter)
    const aggregatedData = Array.from(roundedGroups.entries()).map(([time, rows]) => {
      const aggregated: any = { time };

      // Get all parameter names (excluding time)
      const params = data.headers.filter(h => h !== 'time');

      params.forEach(param => {
        // Find first non-null value for this parameter
        const nonNullRow = rows.find(r => r[param] !== null && r[param] !== undefined);
        aggregated[param] = nonNullRow?.[param] ?? null;
      });

      return aggregated;
    });

    // Sort by time
    aggregatedData.sort((a, b) => a.time.localeCompare(b.time));

    // Get parameter names (excluding time)
    const params = data.headers.filter(h => h !== 'time');

    // Find the time range where BOTH parameters have non-zero/non-null values
    let startIdx = -1;
    let endIdx = -1;

    // Find first row where both parameters have values
    for (let i = 0; i < aggregatedData.length; i++) {
      const row = aggregatedData[i];
      const hasAllParams = params.every(param => {
        const val = row[param];
        return val !== null && val !== undefined && val !== 0 && !isNaN(Number(val));
      });
      if (hasAllParams) {
        startIdx = i;
        break;
      }
    }

    // Find last row where both parameters have values
    for (let i = aggregatedData.length - 1; i >= 0; i--) {
      const row = aggregatedData[i];
      const hasAllParams = params.every(param => {
        const val = row[param];
        return val !== null && val !== undefined && val !== 0 && !isNaN(Number(val));
      });
      if (hasAllParams) {
        endIdx = i;
        break;
      }
    }

    // Trim the data to only include the range where both parameters exist
    const trimmedData = (startIdx >= 0 && endIdx >= startIdx)
      ? aggregatedData.slice(startIdx, endIdx + 1)
      : aggregatedData; // Keep all data if we couldn't find overlap

    console.log('⏱️ Time rounding applied:', {
      interval,
      originalRows: data.data.length,
      roundedRows: aggregatedData.length,
      trimmedRows: trimmedData.length,
      trimRange: { startIdx, endIdx },
      sampleBeforeTrim: aggregatedData.slice(0, 3),
      sampleAfterTrim: trimmedData.slice(0, 3),
      parametersInHeaders: data.headers,
      nonNullCountsBeforeTrim: params.map(param => ({
        param,
        nonNullCount: aggregatedData.filter(row => row[param] !== null && row[param] !== undefined && row[param] !== 0).length
      })),
      nonNullCountsAfterTrim: params.map(param => ({
        param,
        nonNullCount: trimmedData.filter(row => row[param] !== null && row[param] !== undefined && row[param] !== 0).length
      }))
    });

    return {
      ...data,
      data: trimmedData,
      summary: {
        ...data.summary,
        totalRows: trimmedData.length,
        validRows: trimmedData.length
      }
    };
  }, [roundTimeToInterval]);

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
      // Only update if the range has actually changed
      setGlobalTimeRange(prev => {
        if (prev.min?.getTime() === range.min?.getTime() &&
            prev.max?.getTime() === range.max?.getTime()) {
          return prev; // Don't trigger re-render if values are the same
        }
        return range;
      });
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

    console.log('🔍 Parameter names from visibility state:', {
      param1,
      param1Type: typeof param1,
      param2,
      param2Type: typeof param2,
      firstStateParams: firstState.params,
      secondStateParams: secondState.params
    });

    // Get the actual data from both plots
    const firstPlotData = plotsData[firstPlot.id];
    const secondPlotData = plotsData[secondPlot.id];

    if (!firstPlotData || !secondPlotData) {
      console.error('Cannot merge: plot data not loaded');
      return;
    }

    // Helper function to find the actual data key for a parameter (handles display names vs data keys)
    const findDataKey = (dataPoint: any, paramName: string): string | null => {
      // Try direct match first
      if (paramName in dataPoint) return paramName;

      // Try case-insensitive match with spaces removed (e.g., "Wave Height" -> "waveHeight")
      const normalizedParam = paramName.replace(/\s+/g, '').toLowerCase();
      for (const key of Object.keys(dataPoint)) {
        if (key.toLowerCase() === normalizedParam) {
          return key;
        }
      }

      // Try removing special characters and parentheses (e.g., "Sea Level (MSL)" -> "sealevel")
      const cleanedParam = paramName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      for (const key of Object.keys(dataPoint)) {
        const cleanedKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (cleanedKey.includes(cleanedParam) || cleanedParam.includes(cleanedKey)) {
          console.log('🔍 Found fuzzy match:', { paramName, cleanedParam, key, cleanedKey });
          return key;
        }
      }

      // Special mappings for known display names
      const specialMappings: Record<string, string[]> = {
        'seaLevelHeightMsl': ['Sea Level (MSL)', 'Sea Level', 'sea level'],
        'waveHeight': ['Wave Height', 'Significant Wave Height'],
        'wavePeriod': ['Wave Period'],
        'waveDirection': ['Wave Direction'],
        'seaSurfaceTemperature': ['Sea Surface Temp (0m)', 'Sea Surface Temperature'],
        'windSpeed10m': ['Wind Speed (10m)', 'Wind Speed'],
        'windDirection10m': ['Wind Direction (10m)', 'Wind Direction'],
        'temperature2m': ['Air Temperature (2m)', 'Air Temperature'],
        'ghi': ['Global Horizontal Irradiance (GHI)', 'GHI']
      };

      for (const [dataKey, displayNames] of Object.entries(specialMappings)) {
        if (displayNames.some(name => name.toLowerCase() === paramName.toLowerCase())) {
          if (dataKey in dataPoint) {
            console.log('🔍 Found via special mapping:', { paramName, dataKey });
            return dataKey;
          }
        }
      }

      console.warn('⚠️ Could not find data key for parameter:', paramName, 'Available keys:', Object.keys(dataPoint));
      return null;
    };

    // Find actual data keys for both parameters
    const firstSamplePoint = firstPlotData.data[0];
    const secondSamplePoint = secondPlotData.data[0];
    const actualParam1Key = findDataKey(firstSamplePoint, param1) || param1;
    const actualParam2Key = findDataKey(secondSamplePoint, param2) || param2;

    console.log('🔑 Data key mapping:', {
      requestedParam1: param1,
      actualParam1Key,
      requestedParam2: param2,
      actualParam2Key
    });

    // Helper function to normalize time to ISO format
    const normalizeTimeToISO = (timeStr: string): string => {
      try {
        const date = parseISO(timeStr);
        if (isValid(date)) {
          // Return full ISO format with milliseconds: 2024-10-03T06:05:50.000Z
          return date.toISOString();
        }
        return timeStr; // Return original if can't parse
      } catch (e) {
        return timeStr;
      }
    };

    // Get source labels for each parameter
    const getSourceLabel = (plot: PlotConfig): string => {
      if (plot.type === 'marine-meteo') return 'OM';
      return plot.fileType || 'GP';
    };

    const source1Label = getSourceLabel(firstPlot);
    const source2Label = getSourceLabel(secondPlot);

    // Create parameter names with source labels
    const param1WithSource = `${param1} [${source1Label}]`;
    const param2WithSource = `${param2} [${source2Label}]`;

    console.log('🏷️ Parameter labels with source:', {
      param1,
      param1WithSource,
      source1Label,
      param2,
      param2WithSource,
      source2Label
    });

    // SIMPLE APPROACH: Just concatenate the actual data points (no nulls, no gaps)
    // Take all points from first plot with param1, and all points from second plot with param2
    const mergedData: any[] = [];

    // Add all data points from first plot (with param1 only)
    firstPlotData.data.forEach(point => {
      const value = point[actualParam1Key];
      if (value !== null && value !== undefined && !isNaN(Number(value))) {
        mergedData.push({
          time: normalizeTimeToISO(point.time), // Normalize to ISO
          [param1WithSource]: value,
          [param2WithSource]: null // Other parameter is null for these rows
        });
      }
    });

    // Add all data points from second plot (with param2 only)
    secondPlotData.data.forEach(point => {
      const value = point[actualParam2Key];
      if (value !== null && value !== undefined && !isNaN(Number(value))) {
        mergedData.push({
          time: normalizeTimeToISO(point.time), // Normalize to ISO
          [param1WithSource]: null, // Other parameter is null for these rows
          [param2WithSource]: value
        });
      }
    });

    // Sort by time (ISO format sorts correctly alphabetically)
    mergedData.sort((a, b) => a.time.localeCompare(b.time));

    console.log('⏰ Time format samples:', {
      firstPlotSampleTime: firstPlotData.data[0]?.time,
      secondPlotSampleTime: secondPlotData.data[0]?.time,
      mergedFirstTime: mergedData[0]?.time,
      mergedLastTime: mergedData[mergedData.length - 1]?.time,
      mergedMiddleTime: mergedData[Math.floor(mergedData.length / 2)]?.time
    });

    console.log('🔄 MERGE DEBUG:', {
      param1WithSource,
      param2WithSource,
      firstPlotDataLength: firstPlotData.data.length,
      secondPlotDataLength: secondPlotData.data.length,
      mergedDataLength: mergedData.length,
      sampleFirstPoint: firstPlotData.data[0],
      sampleSecondPoint: secondPlotData.data[0],
      sampleMergedPoint: mergedData[0],
      sampleMergedPointMiddle: mergedData[Math.floor(mergedData.length / 2)],
      sampleMergedPointEnd: mergedData[mergedData.length - 1],
      firstDataKeys: Object.keys(firstPlotData.data[0] || {}),
      secondDataKeys: Object.keys(secondPlotData.data[0] || {}),
      mergedDataKeys: Object.keys(mergedData[0] || {}),
      // Check how many points have both parameters
      pointsWithBothParams: mergedData.filter(d => d[param1WithSource] !== null && d[param2WithSource] !== null).length,
      pointsWithOnlyParam1: mergedData.filter(d => d[param1WithSource] !== null && d[param2WithSource] === null).length,
      pointsWithOnlyParam2: mergedData.filter(d => d[param1WithSource] === null && d[param2WithSource] !== null).length
    });

    // Create ParseResult structure for the RAW merged data (before rounding)
    const rawMergedData: ParseResult = {
      data: mergedData as any,
      headers: ['time', param1WithSource, param2WithSource],
      errors: [],
      summary: {
        totalRows: mergedData.length,
        validRows: mergedData.length,
        columns: 3,
        timeColumn: 'time'
      }
    };

    // Save raw data
    setMergeRawData(rawMergedData);

    // Apply default time rounding (30 min)
    const roundedData = applyTimeRounding(rawMergedData, timeRoundingInterval);

    // Show preview dialog with rounded data
    setMergePreviewData(roundedData);
    setShowMergePreview(true);
  };

  // Handler to confirm merge after preview
  const confirmMerge = () => {
    if (!mergePreviewData || plots.length < 2) return;

    const firstPlot = plots[0];
    const secondPlot = plots[1];
    const firstState = plotVisibilityState[firstPlot.id];
    const secondState = plotVisibilityState[secondPlot.id];

    if (!firstState || !secondState) return;

    const param1 = firstState.params[0];
    const param2 = secondState.params[0];

    // Create a virtual device plot with merged data
    const mergedPlot: PlotConfig = {
      id: `merged-${Date.now()}`,
      title: `${param1} + ${param2}`,
      type: 'device',
      fileType: firstPlot.fileType || 'GP',
      files: [],
      fileName: `Merged: ${param1} + ${param2}`,
      isMerged: true,
      mergedData: mergePreviewData,
      mergedParams: [
        {
          parameter: param1,
          sourceType: (firstPlot.type === 'marine-meteo' ? 'marine' : firstPlot.fileType) as 'GP' | 'FPOD' | 'Subcam' | 'marine',
          sourceLabel: (firstPlot.type === 'marine-meteo' ? firstPlot.locationName : firstPlot.fileName) as string,
          color: firstState.colors[param1],
          axis: 'left' as const,
        },
        {
          parameter: param2,
          sourceType: (secondPlot.type === 'marine-meteo' ? 'marine' : secondPlot.fileType) as 'GP' | 'FPOD' | 'Subcam' | 'marine',
          sourceLabel: (secondPlot.type === 'marine-meteo' ? secondPlot.locationName : secondPlot.fileName) as string,
          color: secondState.colors[param2],
          axis: 'right' as const,
        }
      ]
    };

    // Keep first 2 plots and add merged plot below them
    setPlots([plots[0], plots[1], mergedPlot, ...plots.slice(2)]);

    // Force common mode for merged plots
    setTimeAxisMode('common');

    // Close preview
    setShowMergePreview(false);
    setMergePreviewData(null);
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
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3">
              {plots.map((plot, index) => {
                // Render device plot (including merged plots which are now device plots with pre-parsed data)
                if (plot.type === 'device') {
                  return (
                    <PinPlotInstance
                      key={plot.id}
                      instanceId={plot.id}
                      initialPlotTitle={plot.fileName!}
                      onRemovePlot={plots.length > 1 ? removePlot : undefined}
                      fileType={plot.fileType!}
                      files={plot.files!}
                      preParsedData={plot.mergedData} // Pass merged data for merged plots
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
          onSelectMerge={() => {
            handleMergePlots();
            setShowPlotTypeSelector(false);
          }}
          canMergePlots={canMergePlots}
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

      {/* Merge CSV Preview Dialog */}
      {showMergePreview && mergePreviewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999]" onClick={() => {
          setShowMergePreview(false);
          setMergePreviewData(null);
        }}>
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-1">Preview Merged CSV Data</h3>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {mergePreviewData.summary.totalRows} rows × {mergePreviewData.headers.length} columns
                </p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="time-rounding" className="text-sm">Time Rounding:</Label>
                  <Select
                    value={timeRoundingInterval}
                    onValueChange={(value) => {
                      console.log('📊 Dropdown changed to:', value);
                      setTimeRoundingInterval(value);
                      if (mergeRawData) {
                        console.log('📊 Applying time rounding with new interval...');
                        const rounded = applyTimeRounding(mergeRawData, value);
                        setMergePreviewData(rounded);
                      } else {
                        console.warn('📊 mergeRawData is null, cannot apply rounding');
                      }
                    }}
                  >
                    <SelectTrigger id="time-rounding" className="w-32 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1min">1 Minute</SelectItem>
                      <SelectItem value="10min">10 Minutes</SelectItem>
                      <SelectItem value="30min">30 Minutes</SelectItem>
                      <SelectItem value="1hr">1 Hour</SelectItem>
                      <SelectItem value="6hr">6 Hours</SelectItem>
                      <SelectItem value="1day">1 Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Table Preview */}
            <div className="flex-1 overflow-auto border rounded-md mb-4">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    {mergePreviewData.headers.map(header => (
                      <th key={header} className="p-2 text-left border-b font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mergePreviewData.data.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      {mergePreviewData.headers.map(header => (
                        <td key={header} className="p-2">
                          {row[header] !== null && row[header] !== undefined
                            ? String(row[header])
                            : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {mergePreviewData.data.length > 100 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-muted/50">
                  Showing first 100 of {mergePreviewData.data.length} rows
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMergePreview(false);
                  setMergePreviewData(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // Download CSV
                  const csvContent = [
                    mergePreviewData.headers.join(','),
                    ...mergePreviewData.data.map(row =>
                      mergePreviewData.headers.map(header => {
                        const value = row[header];
                        return value !== null && value !== undefined ? value : '';
                      }).join(',')
                    )
                  ].join('\n');

                  const blob = new Blob([csvContent], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `merged-${mergePreviewData.headers[1]}-${mergePreviewData.headers[2]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);

                  toast({
                    title: "CSV Downloaded",
                    description: "Merged CSV file has been saved"
                  });
                }}
              >
                Save as CSV
              </Button>
              <Button onClick={confirmMerge}>
                Create Merged Plot
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}