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

  // Data loading states
  const [leftData, setLeftData] = useState<ParsedDataPoint[]>([]);
  const [rightData, setRightData] = useState<ParsedDataPoint[]>([]);
  const [isLoadingLeft, setIsLoadingLeft] = useState(true);
  const [isLoadingRight, setIsLoadingRight] = useState(true);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);

  // Load left parameter data
  useEffect(() => {
    const loadLeftData = async () => {
      setIsLoadingLeft(true);
      setLeftError(null);
      try {
        if (leftParam.sourceType === 'marine') {
          // Fetch marine data
          const result = await fetchCombinedDataAction({
            latitude: leftParam.location!.lat,
            longitude: leftParam.location!.lon,
            startDate: leftParam.timeRange!.startDate,
            endDate: leftParam.timeRange!.endDate,
            parameters: [leftParam.parameter]
          });

          if (result.success && result.data) {
            // Convert to ParsedDataPoint format
            const parsed: ParsedDataPoint[] = result.data.map(point => {
              const value = point[leftParam.parameter as keyof CombinedDataPoint];
              return {
                time: point.time,
                [leftParam.parameter]: value
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
  }, [leftParam]);

  // Load right parameter data
  useEffect(() => {
    const loadRightData = async () => {
      setIsLoadingRight(true);
      setRightError(null);
      try {
        if (rightParam.sourceType === 'marine') {
          console.log('🌊 Loading RIGHT Marine data:', {
            parameter: rightParam.parameter,
            location: rightParam.location,
            timeRange: rightParam.timeRange
          });

          // Fetch marine data
          const result = await fetchCombinedDataAction({
            latitude: rightParam.location!.lat,
            longitude: rightParam.location!.lon,
            startDate: rightParam.timeRange!.startDate,
            endDate: rightParam.timeRange!.endDate,
            parameters: [rightParam.parameter]
          });

          console.log('🌊 RIGHT Marine fetch result:', {
            success: result.success,
            dataLength: result.data?.length,
            error: result.error,
            firstDataPoint: result.data?.[0]
          });

          if (result.success && result.data) {
            // Convert to ParsedDataPoint format
            const parsed: ParsedDataPoint[] = result.data.map(point => {
              const value = point[rightParam.parameter as keyof CombinedDataPoint];
              return {
                time: point.time,
                [rightParam.parameter]: value
              };
            });

            console.log('🌊 RIGHT Marine parsed data:', {
              parsedLength: parsed.length,
              firstParsed: parsed[0],
              parameterName: rightParam.parameter,
              firstValue: parsed[0]?.[rightParam.parameter]
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
  }, [rightParam]);

  // Merge data by time (UNION - include all timestamps)
  const mergedData = useMemo(() => {
    console.log('🔄 Merging data:', {
      leftDataLength: leftData.length,
      rightDataLength: rightData.length,
      leftParam: leftParam.parameter,
      rightParam: rightParam.parameter,
      leftSample: leftData[0],
      rightSample: rightData[0],
      leftKeys: leftData[0] ? Object.keys(leftData[0]) : [],
      rightKeys: rightData[0] ? Object.keys(rightData[0]) : []
    });

    if (leftData.length === 0 && rightData.length === 0) {
      console.log('⚠️ No data to merge');
      return [];
    }

    // Create time-to-data maps
    const leftMap = new Map(leftData.map(d => [d.time, d]));
    const rightMap = new Map(rightData.map(d => [d.time, d]));

    // Get UNION of all timestamps (sorted)
    const allTimestamps = Array.from(
      new Set([...leftData.map(d => d.time), ...rightData.map(d => d.time)])
    ).sort();

    console.log('🔄 Merge details:', {
      allTimestampsLength: allTimestamps.length,
      leftParamKey: leftParam.parameter,
      rightParamKey: rightParam.parameter,
      sampleLeftPoint: leftMap.get(allTimestamps[0]),
      sampleRightPoint: rightMap.get(allTimestamps[0])
    });

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

    console.log('✅ Merged data:', {
      mergedLength: merged.length,
      firstPoint: merged[0],
      lastPoint: merged[merged.length - 1],
      midPoint: merged[Math.floor(merged.length / 2)],
      mergedKeys: merged[0] ? Object.keys(merged[0]) : [],
      leftParamInFirst: leftParam.parameter in (merged[0] || {}),
      rightParamInFirst: rightParam.parameter in (merged[0] || {}),
      leftValueInFirst: merged[0]?.[leftParam.parameter],
      rightValueInFirst: merged[0]?.[rightParam.parameter]
    });

    return merged;
  }, [leftData, rightData, leftParam.parameter, rightParam.parameter]);

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

    // In separate mode or no global range, use brush indices
    if (globalBrushRange) {
      const start = globalBrushRange.startIndex || 0;
      const end = globalBrushRange.endIndex ?? mergedData.length - 1;
      return mergedData.slice(start, end + 1);
    }

    return mergedData;
  }, [mergedData, timeAxisMode, globalTimeRange, globalBrushRange]);

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
          {/* Chart Container */}
          <div className="flex-1" style={{ height: '250px' }}>
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
                  connectNulls={false}
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
                  connectNulls={false}
                  name={rightParam.parameter}
                  isAnimationActive={false}
                />
              )}

              {/* Brush - only on last plot in common mode */}
              {isLastPlot && timeAxisMode === 'common' && (
                <Brush
                  dataKey="time"
                  height={30}
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--muted))"
                  tickFormatter={formatDateTick}
                  onChange={(range) => {
                    if (onBrushChange && 'startIndex' in range && 'endIndex' in range) {
                      onBrushChange({
                        startIndex: range.startIndex ?? 0,
                        endIndex: range.endIndex ?? mergedData.length - 1
                      });
                    }
                  }}
                  startIndex={globalBrushRange?.startIndex}
                  endIndex={globalBrushRange?.endIndex}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
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
