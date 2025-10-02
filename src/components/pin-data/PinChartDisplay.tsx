"use client";

import React, { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronUp, ChevronDown, BarChart3, Info, TableIcon, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from '@/lib/utils';
import { getParameterLabelWithUnit } from '@/lib/units';
import type { ParsedDataPoint } from './csvParser';

interface PinChartDisplayProps {
  data: ParsedDataPoint[];
  fileType: 'GP' | 'FPOD' | 'Subcam';
  timeColumn: string | null;
  showYAxisLabels?: boolean;
  fileName?: string;
  dataSource?: 'csv' | 'marine';
  // Time synchronization props
  timeAxisMode?: 'separate' | 'common';
  globalTimeRange?: { min: Date | null; max: Date | null };
  globalBrushRange?: { startIndex: number; endIndex: number | undefined };
  onBrushChange?: (brushData: { startIndex?: number; endIndex?: number }) => void;
  isLastPlot?: boolean;
}

// Color palette matching the marine data theme
const CHART_COLORS = [
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--chart-6', '--chart-7', '--chart-8', '--chart-9'
];

interface ParameterState {
  visible: boolean;
  color: string;
}

const formatDateTick = (timeValue: string | number, dataSource?: 'csv' | 'marine'): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    // Use dd/MM format for both CSV and marine data
    return format(dateObj, 'dd/MM');
  } catch (e) {
    return String(timeValue);
  }
};

// Intelligent Y-axis formatter with nice rounded tick spacings
const formatYAxisTick = (value: number, dataRange: number, dataMax: number): string => {
  if (!isFinite(value) || isNaN(value)) return '0';

  const absMax = Math.abs(dataMax);
  const absValue = Math.abs(value);

  // Determine decimal places based on data scale
  let decimals = 0;

  if (absMax >= 1000) {
    decimals = 0; // Large values: no decimals (e.g., 1500)
  } else if (absMax >= 100) {
    decimals = dataRange < 10 ? 1 : 0; // Medium-large: 1 decimal if small range
  } else if (absMax >= 10) {
    decimals = dataRange < 1 ? 2 : 1; // Medium: 1-2 decimals
  } else if (absMax >= 1) {
    decimals = dataRange < 0.5 ? 2 : 1; // Small: 1-2 decimals
  } else if (absMax >= 0.1) {
    decimals = 2; // Tiny: 2 decimals
  } else {
    decimals = 3; // Very tiny: 3 decimals
  }

  return value.toFixed(decimals);
};

export function PinChartDisplay({
  data,
  fileType,
  timeColumn,
  showYAxisLabels = false,
  fileName,
  dataSource = 'csv',
  timeAxisMode = 'separate',
  globalTimeRange,
  globalBrushRange,
  onBrushChange,
  isLastPlot = true
}: PinChartDisplayProps) {
  // Toggle state for switching between chart and table view
  const [showTable, setShowTable] = useState(false);

  // Axis mode state - single or multi axis
  const [axisMode, setAxisMode] = useState<'single' | 'multi'>('single');

  // Parameter panel expansion state
  const [isParameterPanelExpanded, setIsParameterPanelExpanded] = useState(false);
  
  // Get all parameters (for table view)
  const allParameters = useMemo(() => {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    return Object.keys(firstRow).filter(key => key !== 'time' && key !== timeColumn);
  }, [data, timeColumn]);
  
  // Get all numeric parameters (excluding time)
  const numericParameters = useMemo(() => {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    return Object.keys(firstRow)
      .filter(key => key !== 'time' && key !== timeColumn)
      .filter(key => {
        // Check if parameter has numeric values
        return data.some(row => {
          const value = row[key];
          return typeof value === 'number' && !isNaN(value);
        });
      });
  }, [data, timeColumn]);

  // Initialize parameter visibility state
  const [parameterStates, setParameterStates] = useState<Record<string, ParameterState>>(() => {
    const initialState: Record<string, ParameterState> = {};
    numericParameters.forEach((param, index) => {
      initialState[param] = {
        visible: index < 5, // Show first 5 parameters by default
        color: CHART_COLORS[index % CHART_COLORS.length]
      };
    });
    return initialState;
  });

  // Brush state for time range selection (local state for separate mode)
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  // Get visible parameters
  const visibleParameters = useMemo(() => {
    return numericParameters.filter(param => parameterStates[param]?.visible);
  }, [numericParameters, parameterStates]);

  // Determine which brush indices to use based on mode
  const activeBrushStart = timeAxisMode === 'common' && globalBrushRange ? globalBrushRange.startIndex : brushStartIndex;
  const activeBrushEnd = timeAxisMode === 'common' && globalBrushRange ? globalBrushRange.endIndex : brushEndIndex;

  // Get data slice for current brush selection
  const displayData = useMemo(() => {
    if (data.length === 0) return [];

    // In common mode with global time range, filter by actual time values for marine data
    if (timeAxisMode === 'common' && globalTimeRange && globalTimeRange.min && globalTimeRange.max && dataSource === 'marine') {
      return data.filter(point => {
        try {
          const pointDate = parseISO(point.time);
          if (!isValid(pointDate)) return false;
          return pointDate >= globalTimeRange.min! && pointDate <= globalTimeRange.max!;
        } catch {
          return false;
        }
      });
    }

    // For CSV data or separate mode, use brush indices
    const start = Math.max(0, activeBrushStart);
    const end = Math.min(data.length - 1, activeBrushEnd ?? data.length - 1);
    return data.slice(start, end + 1);
  }, [data, activeBrushStart, activeBrushEnd, timeAxisMode, globalTimeRange, dataSource]);

  // Calculate Y-axis domain based on visible parameters in displayData (for single axis mode)
  const yAxisDomain = useMemo(() => {
    if (displayData.length === 0 || visibleParameters.length === 0) {
      return [0, 100]; // Default domain
    }

    let min = Infinity;
    let max = -Infinity;

    displayData.forEach(point => {
      visibleParameters.forEach(param => {
        const value = point[param];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    // Add 5% padding to top and bottom
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [displayData, visibleParameters]);

  // Calculate data range and max for Y-axis formatting
  const dataRange = useMemo(() => {
    if (yAxisDomain[1] - yAxisDomain[0] === 0) return 1;
    return Math.abs(yAxisDomain[1] - yAxisDomain[0]);
  }, [yAxisDomain]);

  const dataMax = useMemo(() => {
    return Math.max(Math.abs(yAxisDomain[0]), Math.abs(yAxisDomain[1]));
  }, [yAxisDomain]);

  // Calculate the maximum number of digits in y-axis tick labels (for single axis)
  const maxTickDigits = useMemo(() => {
    const maxValue = Math.max(Math.abs(yAxisDomain[0]), Math.abs(yAxisDomain[1]));
    const formatted = formatYAxisTick(maxValue, dataRange, dataMax);
    return formatted.length;
  }, [yAxisDomain, dataRange, dataMax]);

  // Calculate label offset based on tick label width (for single axis)
  const getLabelOffset = (digitCount: number) => {
    if (digitCount <= 2) return 15;
    if (digitCount === 3) return 20;
    return 25; // 4+ digits
  };

  // Calculate offset for multi-axis based on parameter domain
  const getMultiAxisLabelOffset = (domain: [number, number], dataRange: number, dataMax: number) => {
    const maxValue = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
    const formatted = formatYAxisTick(maxValue, dataRange, dataMax);
    const digitCount = formatted.length;

    if (digitCount <= 2) return 10;
    if (digitCount === 3) return 13;
    return 17; // 4+ digits
  };

  // Calculate individual Y-axis domains for each parameter (for multi-axis mode)
  const parameterDomains = useMemo(() => {
    const domains: Record<string, [number, number]> = {};

    if (displayData.length === 0) {
      return domains;
    }

    visibleParameters.forEach(param => {
      let min = Infinity;
      let max = -Infinity;

      displayData.forEach(point => {
        const value = point[param];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });

      // Add 5% padding to top and bottom
      const padding = (max - min) * 0.05;
      domains[param] = [min - padding, max + padding];
    });

    return domains;
  }, [displayData, visibleParameters]);

  // Set initial brush end index
  React.useEffect(() => {
    if (data.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(data.length - 1);
    }
  }, [data.length, brushEndIndex]);

  const handleBrushChange = (brushData: { startIndex?: number; endIndex?: number }) => {
    if (timeAxisMode === 'common' && onBrushChange) {
      // In common mode, propagate to parent
      onBrushChange(brushData);
    } else {
      // In separate mode, update local state
      setBrushStartIndex(brushData.startIndex ?? 0);
      setBrushEndIndex(brushData.endIndex);
    }
  };

  const toggleParameterVisibility = (parameter: string) => {
    setParameterStates(prev => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        visible: !prev[parameter]?.visible
      }
    }));
  };

  const showOnlyParameter = (parameter: string) => {
    setParameterStates(prev => {
      const newState = { ...prev };
      // Hide all parameters except the clicked one
      Object.keys(newState).forEach(key => {
        newState[key] = {
          ...newState[key],
          visible: key === parameter
        };
      });
      return newState;
    });
  };

  const moveParameter = (parameter: string, direction: 'up' | 'down') => {
    // This would implement parameter reordering - simplified for now
    console.log(`Move ${parameter} ${direction}`);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-center">
        <div className="text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No data to display</p>
        </div>
      </div>
    );
  }

  if (numericParameters.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-center">
        <div className="text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No numeric parameters found</p>
          <p className="text-xs opacity-70">Check data format</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle Switches - at the top */}
      <div className="flex items-center justify-between pr-12">
        {/* File name */}
        {fileName && (
          <div className="text-xs text-muted-foreground font-medium">
            {fileName}
          </div>
        )}

        {/* View Toggles */}
        <div className="flex items-center gap-4">
          {/* Chart/Table Toggle */}
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Chart</span>
            <Switch
              checked={showTable}
              onCheckedChange={setShowTable}
              className="h-5 w-9"
            />
            <span className="text-xs text-muted-foreground">Table</span>
            <TableIcon className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Single/Multi Axis Toggle - only show in chart mode */}
          {!showTable && (
            <div className="flex items-center gap-2 pl-4 border-l">
              <span className="text-xs text-muted-foreground">Single</span>
              <Switch
                checked={axisMode === 'multi'}
                onCheckedChange={(checked) => setAxisMode(checked ? 'multi' : 'single')}
                className="h-5 w-9"
              />
              <span className="text-xs text-muted-foreground">Multi</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart or Table View */}
      {showTable ? (
        // Table View
        <div className="h-96 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Time</TableHead>
                {allParameters.map(param => (
                  <TableHead key={param} className="text-xs">{param}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 100).map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="text-xs font-mono">
                    {row.time || 'N/A'}
                  </TableCell>
                  {allParameters.map(param => (
                    <TableCell key={param} className="text-xs">
                      {row[param] !== null && row[param] !== undefined 
                        ? (typeof row[param] === 'number' 
                          ? Number(row[param]).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 3})
                          : String(row[param])
                        )
                        : 'N/A'
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.length > 100 && (
            <div className="p-2 text-xs text-center text-muted-foreground border-t">
              Showing first 100 of {data.length} rows
            </div>
          )}
        </div>
      ) : (
        // Chart View (existing chart code)
        <div className="flex gap-3">
          {/* Main Chart - Takes up most space */}
          <div className="flex-1 space-y-3">
      {visibleParameters.length > 0 && (
        <div className="h-52 w-full border rounded-md bg-card p-2">
          {/* Warning for too many parameters in multi-axis mode */}
          {axisMode === 'multi' && visibleParameters.length > 4 && (
            <div className="mb-2 p-2 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded flex items-center gap-2">
              <Info className="h-3 w-3 text-yellow-600" />
              <span className="text-yellow-700">Multi-axis works best with 4 or fewer parameters. Consider deselecting some for better visibility.</span>
            </div>
          )}

          {/* Single Axis Mode */}
          {axisMode === 'single' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                margin={{ top: 5, right: 12, left: 5, bottom: -5 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))', angle: -45, textAnchor: 'end', dy: 8 }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(value) => formatDateTick(value, dataSource)}
                  height={45}
                />

                <YAxis
                  tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  width={showYAxisLabels ? 80 : 50}
                  domain={yAxisDomain}
                  tickFormatter={(value) => formatYAxisTick(value, dataRange, dataMax)}
                  label={showYAxisLabels ? {
                    value: visibleParameters.length === 1
                      ? getParameterLabelWithUnit(visibleParameters[0])
                      : 'Value',
                    angle: -90,
                    position: 'insideLeft',
                    offset: getLabelOffset(maxTickDigits),
                    style: { textAnchor: 'middle', fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))' }
                  } : undefined}
                />

                {/* Frame lines - top and right edges */}
                <ReferenceLine y={yAxisDomain[1]} stroke="hsl(var(--border))" strokeWidth={1} strokeOpacity={0.3} />
                {displayData.length > 0 && (
                  <ReferenceLine x={displayData[displayData.length - 1].time} stroke="hsl(var(--border))" strokeWidth={1} strokeOpacity={0.3} />
                )}

                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    fontSize: '0.7rem',
                    padding: '8px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string) => [
                    typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:3}) : 'N/A',
                    name
                  ]}
                  labelFormatter={(label) => {
                    try {
                      const date = parseISO(String(label));
                      return isValid(date) ? format(date, 'EEE, MMM dd, HH:mm:ss') : String(label);
                    } catch {
                      return String(label);
                    }
                  }}
                  isAnimationActive={false}
                />

                {visibleParameters.map((parameter) => {
                  const state = parameterStates[parameter];
                  return (
                    <Line
                      key={parameter}
                      type="monotone"
                      dataKey={parameter}
                      stroke={`hsl(var(${state.color}))`}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls={false}
                      name={parameter}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Multi Axis Mode */}
          {axisMode === 'multi' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                margin={{
                  top: 5,
                  right: Math.ceil(visibleParameters.length / 2) * 35,
                  left: 35,
                  bottom: -5
                }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))', angle: -45, textAnchor: 'end', dy: 8 }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(value) => formatDateTick(value, dataSource)}
                  height={45}
                />

                {/* One YAxis per visible parameter */}
                {visibleParameters.map((parameter, index) => {
                  const orientation = index % 2 === 0 ? 'left' : 'right';
                  const yAxisId = `axis-${parameter}`;
                  const domain = parameterDomains[parameter] || [0, 100];
                  const paramRange = Math.abs(domain[1] - domain[0]);
                  const paramMax = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));

                  return (
                    <YAxis
                      key={yAxisId}
                      yAxisId={yAxisId}
                      orientation={orientation}
                      tick={{ fontSize: '0.55rem', fill: `hsl(var(${parameterStates[parameter].color}))` }}
                      stroke={`hsl(var(${parameterStates[parameter].color}))`}
                      width={32}
                      tickFormatter={(value) => formatYAxisTick(value, paramRange, paramMax)}
                      label={{
                        value: getParameterLabelWithUnit(parameter),
                        angle: -90,
                        position: orientation === 'left' ? 'insideLeft' : 'insideRight',
                        offset: getMultiAxisLabelOffset(domain, paramRange, paramMax),
                        style: {
                          textAnchor: 'middle',
                          fontSize: '0.55rem',
                          fill: `hsl(var(${parameterStates[parameter].color}))`,
                          fontWeight: 500
                        }
                      }}
                      domain={domain}
                    />
                  );
                })}

                {/* Frame lines - top edges for each Y-axis */}
                {visibleParameters.map((parameter) => {
                  const domain = parameterDomains[parameter] || [0, 100];
                  const yAxisId = `axis-${parameter}`;
                  return (
                    <ReferenceLine
                      key={`ref-${yAxisId}`}
                      y={domain[1]}
                      yAxisId={yAxisId}
                      stroke="hsl(var(--border))"
                      strokeWidth={1}
                      strokeOpacity={0.3}
                    />
                  );
                })}

                {/* Frame lines - right edge (using first axis) */}
                {displayData.length > 0 && visibleParameters.length > 0 && (
                  <ReferenceLine
                    x={displayData[displayData.length - 1].time}
                    yAxisId={`axis-${visibleParameters[0]}`}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                  />
                )}

                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    fontSize: '0.7rem',
                    padding: '8px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number, name: string) => [
                    typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:3}) : 'N/A',
                    name
                  ]}
                  labelFormatter={(label) => {
                    try {
                      const date = parseISO(String(label));
                      return isValid(date) ? format(date, 'EEE, MMM dd, HH:mm:ss') : String(label);
                    } catch {
                      return String(label);
                    }
                  }}
                  isAnimationActive={false}
                />

                {visibleParameters.map((parameter) => {
                  const state = parameterStates[parameter];
                  const yAxisId = `axis-${parameter}`;

                  return (
                    <Line
                      key={parameter}
                      type="monotone"
                      dataKey={parameter}
                      yAxisId={yAxisId}
                      stroke={`hsl(var(${state.color}))`}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls={false}
                      name={parameter}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Time Range Brush - only show in separate mode OR if last plot in common mode */}
      {data.length > 10 && (timeAxisMode === 'separate' || isLastPlot) && (
        <div className="h-10 w-full border rounded-md bg-card p-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 2, right: 15, left: 15, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tickFormatter={(value) => formatDateTick(value, dataSource)}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.6rem' }}
                height={10}
                interval="preserveStartEnd"
              />
              <Brush
                dataKey="time"
                height={16}
                stroke="hsl(var(--primary))"
                fill="transparent"
                tickFormatter={() => ""}
                travellerWidth={10}
                startIndex={activeBrushStart}
                endIndex={activeBrushEnd}
                onChange={handleBrushChange}
                y={12}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

          </div>

          {/* Parameter Controls - On the right side */}
          <div className={cn("space-y-2 transition-all duration-300", isParameterPanelExpanded ? "w-56" : "w-40")}>
            {/* Header with expand button and label */}
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
                Parameters ({visibleParameters.length} visible)
                {axisMode === 'multi' && visibleParameters.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-1">- Multi-axis</span>
                )}
              </p>
            </div>

            <div className="space-y-1 h-[210px] overflow-y-auto">
              {numericParameters.map((parameter, index) => {
                const state = parameterStates[parameter];
                if (!state) return null;

                // Get axis position for this parameter in multi-axis mode
                const visibleIndex = visibleParameters.indexOf(parameter);
                const axisPosition = visibleIndex >= 0 ? (visibleIndex % 2 === 0 ? 'L' : 'R') : null;

                return (
                  <div key={parameter} className="flex items-center justify-between p-1.5 rounded border bg-card/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Checkbox
                        id={`param-${parameter}`}
                        checked={state.visible}
                        onCheckedChange={() => toggleParameterVisibility(parameter)}
                        className="h-3 w-3"
                      />
                      <Label
                        htmlFor={`param-${parameter}`}
                        className="text-xs cursor-pointer truncate flex-1"
                        title={parameter}
                      >
                        {parameter}
                      </Label>
                      {/* Show axis indicator in multi-axis mode */}
                      {axisMode === 'multi' && state.visible && axisPosition && (
                        <span
                          className="text-[0.6rem] font-semibold px-1 rounded"
                          style={{ color: `hsl(var(${state.color}))`, backgroundColor: `hsl(var(${state.color}) / 0.1)` }}
                        >
                          {axisPosition}
                        </span>
                      )}
                      <div
                        className="w-3 h-3 rounded-full border cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all"
                        style={{
                          backgroundColor: `hsl(var(${state.color}))`,
                          '--tw-ring-color': `hsl(var(${state.color}))`
                        } as React.CSSProperties}
                        onClick={() => showOnlyParameter(parameter)}
                        title="Show only this parameter"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}