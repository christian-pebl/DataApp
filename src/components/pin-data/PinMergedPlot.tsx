"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HexColorPicker } from 'react-colorful';
import { Split, ArrowLeft, ArrowRight, X, Loader2, AlertCircle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush
} from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { parseMultipleCSVFiles, type ParseResult, type ParsedDataPoint } from './csvParser';
import { fetchCombinedDataAction } from '@/app/om-marine-explorer/actions';
import type { CombinedDataPoint } from '@/app/om-marine-explorer/shared';
import { getParameterLabelWithUnit } from '@/lib/units';

// Mapping from display names to camelCase parameter keys (for marine data)
const DISPLAY_NAME_TO_KEY: Record<string, string> = {
  'Wave Height': 'waveHeight',
  'Wind Speed (10m)': 'windSpeed10m',
  'Wind Direction (10m)': 'windDirection10m',
  'Sea Level (MSL)': 'seaLevelHeightMsl',
  'Wave Period': 'wavePeriod',
  'Wave Direction': 'waveDirection',
  'Air Temperature (2m)': 'temperature2m',
  'Sea Surface Temp (0m)': 'seaSurfaceTemperature',
  'Global Horizontal Irradiance (GHI)': 'ghi',
};

// Reverse mapping: camelCase to display name (for chart rendering)
const KEY_TO_DISPLAY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(DISPLAY_NAME_TO_KEY).map(([display, key]) => [key, display])
);

interface MergedParameterConfig {
  parameter: string;
  sourceType: 'GP' | 'FPOD' | 'Subcam' | 'marine';
  sourceLabel: string;
  color: string;
  axis: 'left' | 'right';

  // Device data context
  fileType?: 'GP' | 'FPOD' | 'Subcam';
  files?: File[];

  // Marine data context
  location?: { lat: number; lon: number };
  timeRange?: { startDate: string; endDate: string };
}

interface PinMergedPlotProps {
  instanceId: string;
  leftParam: MergedParameterConfig;
  rightParam: MergedParameterConfig;
  timeAxisMode?: 'separate' | 'common';
  globalTimeRange?: { min: Date | null; max: Date | null };
  globalBrushRange?: { startIndex: number; endIndex: number | undefined };
  onBrushChange?: (brushData: { startIndex?: number; endIndex?: number }) => void;
  isLastPlot?: boolean;
  onRemovePlot?: (id: string) => void;
  onUnmerge?: (id: string) => void;
}

// Format date for X-axis ticks
const formatDateTick = (timeValue: string | number): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    return format(dateObj, 'dd/MM');
  } catch (e) {
    return String(timeValue);
  }
};

// Y-axis formatter
const formatYAxisTick = (value: number, dataRange: number, dataMax: number): string => {
  if (!isFinite(value) || isNaN(value)) return '0';

  const absMax = Math.abs(dataMax);
  let decimals = 0;

  if (absMax >= 1000) {
    decimals = 0;
  } else if (absMax >= 100) {
    decimals = dataRange < 10 ? 1 : 0;
  } else if (absMax >= 10) {
    decimals = dataRange < 1 ? 2 : 1;
  } else if (absMax >= 1) {
    decimals = dataRange < 0.5 ? 2 : 1;
  } else if (absMax >= 0.1) {
    decimals = 2;
  } else {
    decimals = 3;
  }

  return value.toFixed(decimals);
};

// Helper to get color value (supports both CSS vars and hex)
const getColorValue = (colorString: string): string => {
  if (colorString.startsWith('#')) {
    return colorString;
  }
  return `hsl(var(${colorString}))`;
};

// CSS var to hex converter
const cssVarToHex = (cssVar: string): string => {
  if (cssVar.startsWith('#')) return cssVar;
  // Default colors for common chart variables
  const colorMap: Record<string, string> = {
    '--chart-1': '#3b82f6',
    '--chart-2': '#10b981',
    '--chart-3': '#f59e0b',
    '--chart-4': '#ef4444',
    '--chart-5': '#8b5cf6',
  };
  return colorMap[cssVar] || '#3b82f6';
};

// Helper to extract time range from parsed data
const getTimeRangeFromData = (data: ParsedDataPoint[]): { startDate: string; endDate: string } | null => {
  if (data.length === 0) return null;

  const times = data.map(d => new Date(d.time)).filter(d => !isNaN(d.getTime()));
  if (times.length === 0) return null;

  const minTime = new Date(Math.min(...times.map(t => t.getTime())));
  const maxTime = new Date(Math.max(...times.map(t => t.getTime())));

  return {
    startDate: format(minTime, 'yyyy-MM-dd'),
    endDate: format(maxTime, 'yyyy-MM-dd')
  };
};

export function PinMergedPlot({
  instanceId,
  leftParam,
  rightParam,
  timeAxisMode = 'separate',
  globalTimeRange,
  globalBrushRange,
  onBrushChange,
  isLastPlot = true,
  onRemovePlot,
  onUnmerge
}: PinMergedPlotProps) {
  // Generate auto title
  const autoTitle = `${leftParam.parameter} + ${rightParam.parameter}`;
  const [plotTitle, setPlotTitle] = useState(autoTitle);

  // Parameter panel expansion state
  const [isParameterPanelExpanded, setIsParameterPanelExpanded] = useState(true);

  // Color states (allow user to change colors)
  const [leftColor, setLeftColor] = useState(leftParam.color);
  const [rightColor, setRightColor] = useState(rightParam.color);

  // Visibility states (allow user to show/hide parameters)
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);

  // Local brush state (for separate mode)
  const [localBrushStart, setLocalBrushStart] = useState(0);
  const [localBrushEnd, setLocalBrushEnd] = useState<number | undefined>(undefined);

  // Track if we've already aligned time ranges (to prevent infinite loops)
  const [timeRangeAligned, setTimeRangeAligned] = useState(false);

  // Data loading states
  const [leftData, setLeftData] = useState<ParsedDataPoint[]>([]);
  const [rightData, setRightData] = useState<ParsedDataPoint[]>([]);
  const [isLoadingLeft, setIsLoadingLeft] = useState(true);
  const [isLoadingRight, setIsLoadingRight] = useState(true);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);

  // Determine loading order: load device data first, then marine data
  const loadDeviceFirst = leftParam.sourceType !== 'marine' && rightParam.sourceType === 'marine';
  const loadMarineFirst = leftParam.sourceType === 'marine' && rightParam.sourceType !== 'marine';

  // Load left parameter data
  useEffect(() => {
    const loadLeftData = async () => {
      setIsLoadingLeft(true);
      setLeftError(null);
      try {
        if (leftParam.sourceType === 'marine') {
          // Convert display name to camelCase key if needed
          const paramKey = DISPLAY_NAME_TO_KEY[leftParam.parameter] || leftParam.parameter;

          // Use original time range (should already match device data)
          let startDate = leftParam.timeRange!.startDate;
          let endDate = leftParam.timeRange!.endDate;

          // Fetch marine data
          const result = await fetchCombinedDataAction({
            latitude: leftParam.location!.lat,
            longitude: leftParam.location!.lon,
            startDate,
            endDate,
            parameters: [paramKey]
          });

          if (result.success && result.data) {
            // Convert to ParsedDataPoint format
            // Store using the DISPLAY NAME as key (so merge can find it)
            const parsed: ParsedDataPoint[] = result.data.map(point => {
              const value = point[paramKey as keyof CombinedDataPoint];
              return {
                time: point.time,
                [leftParam.parameter]: value  // Use display name as key
              };
            });

            setLeftData(parsed);
          } else {
            setLeftError(result.error || 'Failed to fetch marine data');
            setLeftData([]);
          }
        } else {
          // Parse CSV files
          if (leftParam.files && leftParam.files.length > 0) {
            const parseResult = await parseMultipleCSVFiles(
              leftParam.files,
              leftParam.fileType!
            );
            setLeftData(parseResult.data);
          }
        }
      } catch (error) {
        console.error('Error loading left parameter data:', error);
        setLeftError(error instanceof Error ? error.message : 'Unknown error');
        setLeftData([]);
      } finally {
        setIsLoadingLeft(false);
      }
    };

    loadLeftData();
  }, [leftParam]); // Only depend on leftParam

  // Load right parameter data
  useEffect(() => {
    const loadRightData = async () => {
      setIsLoadingRight(true);
      setRightError(null);
      try {
        if (rightParam.sourceType === 'marine') {
          // Convert display name to camelCase key if needed
          const paramKey = DISPLAY_NAME_TO_KEY[rightParam.parameter] || rightParam.parameter;

          // If left is device data and loaded, use its exact time range (only once)
          let startDate = rightParam.timeRange!.startDate;
          let endDate = rightParam.timeRange!.endDate;

          if (leftParam.sourceType !== 'marine' && leftData.length > 0 && !timeRangeAligned) {
            const deviceTimeRange = getTimeRangeFromData(leftData);
            if (deviceTimeRange) {
              startDate = deviceTimeRange.startDate;
              endDate = deviceTimeRange.endDate;
              setTimeRangeAligned(true); // Mark as aligned to prevent re-fetching
            }
          }

          // Fetch marine data
          const result = await fetchCombinedDataAction({
            latitude: rightParam.location!.lat,
            longitude: rightParam.location!.lon,
            startDate,
            endDate,
            parameters: [paramKey]
          });

          if (result.success && result.data) {
            // Convert to ParsedDataPoint format
            // Store using the DISPLAY NAME as key (so merge can find it)
            const parsed: ParsedDataPoint[] = result.data.map(point => {
              const value = point[paramKey as keyof CombinedDataPoint];
              return {
                time: point.time,
                [rightParam.parameter]: value  // Use display name as key
              };
            });

            setRightData(parsed);
          } else {
            setRightError(result.error || 'Failed to fetch marine data');
            setRightData([]);
          }
        } else {
          // Parse CSV files
          if (rightParam.files && rightParam.files.length > 0) {
            const parseResult = await parseMultipleCSVFiles(
              rightParam.files,
              rightParam.fileType!
            );
            setRightData(parseResult.data);
          }
        }
      } catch (error) {
        console.error('Error loading right parameter data:', error);
        setRightError(error instanceof Error ? error.message : 'Unknown error');
        setRightData([]);
      } finally {
        setIsLoadingRight(false);
      }
    };

    loadRightData();
  }, [rightParam, leftData, leftParam.sourceType]); // Reload when leftData changes (if merging with device data)

  // Merge data by time (UNION - include all timestamps)
  const mergedData = useMemo(() => {
    if (leftData.length === 0 && rightData.length === 0) {
      return [];
    }

    // Create time-to-data maps
    const leftMap = new Map(leftData.map(d => [d.time, d]));
    const rightMap = new Map(rightData.map(d => [d.time, d]));

    // Get UNION of all timestamps (sorted)
    const allTimestamps = Array.from(
      new Set([...leftData.map(d => d.time), ...rightData.map(d => d.time)])
    ).sort();

    // Merge data at each timestamp
    const merged = allTimestamps.map(time => {
      const leftPoint = leftMap.get(time);
      const rightPoint = rightMap.get(time);

      const mergedPoint = {
        time,
        [leftParam.parameter]: leftPoint?.[leftParam.parameter] ?? null,
        [rightParam.parameter]: rightPoint?.[rightParam.parameter] ?? null
      };

      return mergedPoint;
    });

    return merged;
  }, [leftData, rightData, leftParam.parameter, rightParam.parameter]);

  // Initialize local brush end index
  useEffect(() => {
    if (mergedData.length > 0 && localBrushEnd === undefined) {
      setLocalBrushEnd(mergedData.length - 1);
    }
  }, [mergedData.length, localBrushEnd]);

  // Determine active brush indices based on mode
  const activeBrushStart = timeAxisMode === 'common' && globalBrushRange
    ? globalBrushRange.startIndex
    : localBrushStart;
  const activeBrushEnd = timeAxisMode === 'common' && globalBrushRange
    ? globalBrushRange.endIndex
    : localBrushEnd;


  // Apply brush/time filtering
  const displayData = useMemo(() => {
    if (mergedData.length === 0) return [];

    // In common mode with global time range, filter by time
    if (timeAxisMode === 'common' && globalTimeRange?.min && globalTimeRange?.max) {
      return mergedData.filter(d => {
        const pointTime = new Date(d.time);
        return pointTime >= globalTimeRange.min! && pointTime <= globalTimeRange.max!;
      });
    }

    // Use brush indices (works for both common and separate modes)
    const start = Math.max(0, activeBrushStart);
    const end = Math.min(mergedData.length - 1, activeBrushEnd ?? mergedData.length - 1);
    return mergedData.slice(start, end + 1);
  }, [mergedData, timeAxisMode, globalTimeRange, activeBrushStart, activeBrushEnd]);

  // Calculate domain for left parameter
  const leftDomain = useMemo((): [number, number] => {
    const values = displayData
      .map(d => d[leftParam.parameter])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return [0, 100];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;

    return [min - padding, max + padding];
  }, [displayData, leftParam.parameter]);

  // Calculate domain for right parameter
  const rightDomain = useMemo((): [number, number] => {
    const values = displayData
      .map(d => d[rightParam.parameter])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return [0, 100];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.1 || 1;

    return [min - padding, max + padding];
  }, [displayData, rightParam.parameter]);

  // Calculate ranges for Y-axis formatters
  const leftRange = Math.abs(leftDomain[1] - leftDomain[0]);
  const leftMax = Math.max(Math.abs(leftDomain[0]), Math.abs(leftDomain[1]));
  const rightRange = Math.abs(rightDomain[1] - rightDomain[0]);
  const rightMax = Math.max(Math.abs(rightDomain[0]), Math.abs(rightDomain[1]));

  const isLoading = isLoadingLeft || isLoadingRight;
  const leftColorValue = getColorValue(leftColor);
  const rightColorValue = getColorValue(rightColor);

  // Get source abbreviation
  const getSourceAbbr = (sourceType: string) => {
    return sourceType === 'marine' ? 'MMD' : sourceType;
  };

  // Format parameter with source label
  const formatParameterWithSource = (parameter: string, sourceType: string): string => {
    const baseLabel = getParameterLabelWithUnit(parameter);
    const sourceLabel = getSourceAbbr(sourceType);
    return `${baseLabel} (${sourceLabel})`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          {/* Editable Title */}
          <Input
            value={plotTitle}
            onChange={(e) => setPlotTitle(e.target.value)}
            className="font-semibold text-base max-w-md"
          />

          {/* Action Buttons */}
          <div className="flex gap-2">
            {onUnmerge && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUnmerge(instanceId)}
              >
                <Split className="h-4 w-4 mr-2" />
                Unmerge
              </Button>
            )}
            {onRemovePlot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemovePlot(instanceId)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

      </CardHeader>

      <CardContent>
        {/* Main layout: Chart on left, Parameters on right */}
        <div className="flex gap-4">
          {/* Chart and Brush Column */}
          <div className="flex-1 space-y-3">
            {/* Chart Container */}
            <div style={{ height: '250px' }}>
            {leftError || rightError ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm font-medium">Error loading data</p>
                {leftError && (
                  <p className="text-xs text-muted-foreground">Left: {leftError}</p>
                )}
                {rightError && (
                  <p className="text-xs text-muted-foreground">Right: {rightError}</p>
                )}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading data...</span>
              </div>
            ) : displayData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-sm text-muted-foreground">No data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

              {/* X-Axis */}
              <XAxis
                dataKey="time"
                tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))', angle: -45, textAnchor: 'end', dy: 8 }}
                stroke="hsl(var(--border))"
                tickFormatter={formatDateTick}
                height={45}
              />

              {/* Left Y-Axis */}
              <YAxis
                yAxisId="left"
                orientation="left"
                domain={leftDomain}
                tick={{ fontSize: '0.65rem', fill: leftColorValue }}
                stroke={leftColorValue}
                tickFormatter={(value) => formatYAxisTick(value, leftRange, leftMax)}
                label={{
                  value: formatParameterWithSource(leftParam.parameter, leftParam.sourceType),
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: { fill: leftColorValue, fontSize: '0.65rem', fontWeight: 500, textAnchor: 'middle' }
                }}
              />

              {/* Right Y-Axis */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={rightDomain}
                tick={{ fontSize: '0.65rem', fill: rightColorValue }}
                stroke={rightColorValue}
                tickFormatter={(value) => formatYAxisTick(value, rightRange, rightMax)}
                label={{
                  value: formatParameterWithSource(rightParam.parameter, rightParam.sourceType),
                  angle: 90,
                  position: 'insideRight',
                  offset: 10,
                  style: { fill: rightColorValue, fontSize: '0.65rem', fontWeight: 500, textAnchor: 'middle' }
                }}
              />

              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '0.75rem'
                }}
                labelFormatter={formatDateTick}
              />

              <Legend
                wrapperStyle={{ fontSize: '0.75rem' }}
                formatter={(value) => {
                  if (value === leftParam.parameter) {
                    return `${value} (${getSourceAbbr(leftParam.sourceType)})`;
                  }
                  return `${value} (${getSourceAbbr(rightParam.sourceType)})`;
                }}
              />

              {/* Left Parameter Line */}
              {leftVisible && (
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey={leftParam.parameter}
                  stroke={leftColorValue}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls={true}
                  name={leftParam.parameter}
                  isAnimationActive={false}
                />
              )}

              {/* Right Parameter Line */}
              {rightVisible && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey={rightParam.parameter}
                  stroke={rightColorValue}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls={true}
                  name={rightParam.parameter}
                  isAnimationActive={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
            )}
            </div>

            {/* Time Range Brush - separate container matching unmerged mode */}
            {mergedData.length > 10 && (timeAxisMode === 'separate' || isLastPlot) && !isLoading && (
              <div className="h-10 w-full border rounded-md bg-card p-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedData} margin={{ top: 2, right: 15, left: 15, bottom: 0 }}>
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatDateTick}
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: '0.6rem' }}
                      height={10}
                      interval="preserveStartEnd"
                    />
                    <Brush
                      data={mergedData}
                      dataKey="time"
                      height={16}
                      stroke="hsl(var(--primary))"
                      fill="transparent"
                      tickFormatter={() => ""}
                      travellerWidth={10}
                      startIndex={activeBrushStart}
                      endIndex={activeBrushEnd}
                      onChange={(range) => {
                        if ('startIndex' in range && 'endIndex' in range) {
                          if (timeAxisMode === 'common' && onBrushChange) {
                            // In common mode, propagate to parent
                            onBrushChange({
                              startIndex: range.startIndex ?? 0,
                              endIndex: range.endIndex
                            });
                          } else {
                            // In separate mode, update local state
                            setLocalBrushStart(range.startIndex ?? 0);
                            setLocalBrushEnd(range.endIndex);
                          }
                        }
                      }}
                      y={12}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Parameter Panel on the right */}
          <div className={cn("space-y-2 transition-all duration-300", isParameterPanelExpanded ? "w-56" : "w-40")}>
            {/* Header with expand button */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-accent/50"
                onClick={() => setIsParameterPanelExpanded(!isParameterPanelExpanded)}
                title={isParameterPanelExpanded ? "Collapse panel" : "Expand panel"}
              >
                {isParameterPanelExpanded ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>

              <p className="text-xs font-medium">
                Parameters (2 merged)
              </p>
            </div>

            {/* Parameter List */}
            <div className="space-y-1">
              {/* Left Parameter */}
              <div className="flex items-center justify-between p-1.5 rounded border bg-card/50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Checkbox
                    id="left-param"
                    checked={leftVisible}
                    onCheckedChange={(checked) => setLeftVisible(checked as boolean)}
                    className="h-3 w-3"
                  />
                  <Label
                    htmlFor="left-param"
                    className="text-xs cursor-pointer truncate flex-1"
                    title={formatParameterWithSource(leftParam.parameter, leftParam.sourceType)}
                  >
                    {formatParameterWithSource(leftParam.parameter, leftParam.sourceType)}
                  </Label>
                  <span
                    className="text-[0.6rem] font-semibold px-1 rounded"
                    style={{ color: leftColorValue, backgroundColor: `${leftColorValue}1a` }}
                  >
                    L
                  </span>
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: leftColorValue }}
                  />
                  {/* Color picker gear icon */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:bg-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="end" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Pick Color</p>
                        <div className="relative">
                          <HexColorPicker
                            color={leftColor.startsWith('#') ? leftColor : cssVarToHex(leftColor)}
                            onChange={(hex) => setLeftColor(hex)}
                            style={{ width: '200px', height: '150px' }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Right Parameter */}
              <div className="flex items-center justify-between p-1.5 rounded border bg-card/50">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Checkbox
                    id="right-param"
                    checked={rightVisible}
                    onCheckedChange={(checked) => setRightVisible(checked as boolean)}
                    className="h-3 w-3"
                  />
                  <Label
                    htmlFor="right-param"
                    className="text-xs cursor-pointer truncate flex-1"
                    title={formatParameterWithSource(rightParam.parameter, rightParam.sourceType)}
                  >
                    {formatParameterWithSource(rightParam.parameter, rightParam.sourceType)}
                  </Label>
                  <span
                    className="text-[0.6rem] font-semibold px-1 rounded"
                    style={{ color: rightColorValue, backgroundColor: `${rightColorValue}1a` }}
                  >
                    R
                  </span>
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: rightColorValue }}
                  />
                  {/* Color picker gear icon */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 hover:bg-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="end" onClick={(e) => e.stopPropagation()}>
                      <div className="space-y-2">
                        <p className="text-xs font-medium">Pick Color</p>
                        <div className="relative">
                          <HexColorPicker
                            color={rightColor.startsWith('#') ? rightColor : cssVarToHex(rightColor)}
                            onChange={(hex) => setRightColor(hex)}
                            style={{ width: '200px', height: '150px' }}
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
