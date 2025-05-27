
"use client";

import type { CSSProperties } from "react";
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip, 
  Legend,
  ResponsiveContainer,
  Label as RechartsYAxisLabel, // Renamed to avoid conflict with ShadCN Label
  Brush,
} from "recharts";
import { Info, LineChart as LineChartIcon } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined | null; // Allow null for highlightedData
}

export interface YAxisConfig {
  id: string;
  orientation: 'left' | 'right';
  label: string;
  color: string; // CSS variable name, e.g., '--chart-1'
  dataKey: string;
  unit?: string;
}

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[]; // Array of keys to plot from data
  timeAxisLabel?: string;
  plotTitle?: string; // Optional title for the chart area
  chartRenderHeight?: number; // Explicit height for the chart rendering area
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (newIndex: { startIndex?: number; endIndex?: number }) => void;
  yAxisConfigs?: YAxisConfig[]; // Configuration for one or more Y-axes
  activeHighlightRange?: { startIndex: number; endIndex: number } | null; // For highlighting
}

const INTERNAL_DEFAULT_CHART_HEIGHT = 278; // Base height for ChartDisplay

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

// Consistent date formatting for ticks
const formatDateTick = (timeValue: string | number): string => {
  try {
    const date = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    // Check if the parsed date is valid
    if (!isValid(date)) {
      // Fallback for strings that parseISO might fail on but are still date-like
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue)) {
        const parsed = parseISO(timeValue); // Try parsing again if it fits common ISO prefix
        if (isValid(parsed)) return format(parsed, 'dd-MM-yy');
      }
      return String(timeValue); // Fallback to string representation
    }
    return format(date, 'dd-MM-yy');
  } catch (e) {
    // Catch any other errors during parsing/formatting
    return String(timeValue);
  }
};

export function ChartDisplay({
  data,
  plottableSeries,
  timeAxisLabel,
  plotTitle, // Kept for potential future use, though not rendered as CardTitle anymore
  chartRenderHeight,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
  yAxisConfigs = [],
  activeHighlightRange,
}: ChartDisplayProps) {
  
  const chartHeightToUse = React.useMemo(() => {
    return chartRenderHeight ?? INTERNAL_DEFAULT_CHART_HEIGHT;
  }, [chartRenderHeight]);

  // Memoize processed chart data
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    // Ensure all plottable series values are numbers or undefined/null
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      plottableSeries.forEach(seriesName => {
        const value = point[seriesName];
        if (typeof value === 'string') {
          const num = parseFloat(value.replace(/,/g, '')); // Handle thousands separators
          newPoint[seriesName] = isNaN(num) ? undefined : num;
        } else if (typeof value === 'number') {
          newPoint[seriesName] = value;
        } else {
          newPoint[seriesName] = undefined; // or null if preferred
        }
      });
      return newPoint;
    });
  }, [data, plottableSeries]);

  // Check if there's any numeric data for the selected plottable series
  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    return plottableSeries.some(seriesName =>
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);

  const highlightedData = React.useMemo(() => {
    if (activeHighlightRange && chartData.length > 0 && plottableSeries.length > 0) {
      const { startIndex, endIndex } = activeHighlightRange;
      // Ensure indices are within bounds
      const validStartIndex = Math.max(0, Math.min(startIndex, chartData.length - 1));
      const validEndIndex = Math.max(0, Math.min(endIndex, chartData.length - 1));
      
      // For AnnotationPage, plottableSeries is just ['temperature']
      // If there are multiple series, this logic would need to decide which one is "highlightable"
      // or if all get a highlighted segment. For now, assume the first plottable series.
      const seriesKeyToHighlight = plottableSeries[0];

      if (validStartIndex <= validEndIndex && seriesKeyToHighlight) {
        return chartData.map((point, index) => {
          const newPoint: DataPoint = { time: point.time };
          // Highlighted segment for the target series
          if (index >= validStartIndex && index <= validEndIndex) {
            newPoint[seriesKeyToHighlight] = point[seriesKeyToHighlight];
          } else {
            newPoint[seriesKeyToHighlight] = null; // Set to null outside range for this series
          }
          // Ensure other plottable series are null if this is the highlight data (to only show one highlight)
          plottableSeries.forEach(ps => {
            if (ps !== seriesKeyToHighlight) {
              newPoint[ps] = null;
            }
          });
          return newPoint;
        });
      }
    }
    return null; // No active highlight or invalid range/data
  }, [activeHighlightRange, chartData, plottableSeries]);

  const yAxisLabelText = React.useMemo(() => {
    // If only one Y-axis config and one series, use specific label
    return yAxisConfigs.length === 1 && plottableSeries.length === 1
    ? `${yAxisConfigs[0].label}${yAxisConfigs[0].unit ? ` (${yAxisConfigs[0].unit})` : ''}`
    : "Value"; // Generic label for multiple series/axes
  }, [yAxisConfigs, plottableSeries]);
  
  // Centralized function for rendering "no data" or "no series" messages
  const renderNoDataMessage = (icon: React.ReactNode, primaryText: string, secondaryText?: string) => (
     <div style={{ height: `${chartHeightToUse}px`, width: '100%' }} className="flex flex-col items-center justify-center p-2">
      <div className="text-center text-muted-foreground">
        {icon}
        <p className="text-sm mt-2">{primaryText}</p>
        {secondaryText && <p className="text-xs mt-1">{secondaryText}</p>}
      </div>
    </div>
  );

  // Early returns for invalid states
  if (!data || data.length === 0) {
    return renderNoDataMessage(<LineChartIcon className="h-8 w-8 mx-auto text-muted" />, `No data loaded for ${plotTitle || 'this plot'}.`);
  }

  if (plottableSeries.length === 0) {
    return renderNoDataMessage(<Info className="h-8 w-8 mx-auto text-muted" />, `Please select at least one variable to plot for ${plotTitle || 'this plot'}.`);
  }

  if (!hasAnyNumericDataForSelectedSeries) {
    return renderNoDataMessage(
      <Info className="h-8 w-8 mx-auto text-muted" />,
      `No valid numeric data for selected series: ${plottableSeries.join(', ')} in ${plotTitle || 'this plot'}.`,
      "Check data source or ensure series contain numeric values."
    );
  }

  // Calculate offset for Y-axes if multiple are on the same side
  const yAxisOffset = (index: number, orientation: 'left' | 'right') => {
    const axesOnSameSide = yAxisConfigs.filter(c => c.orientation === orientation);
    const currentAxisIndexOnSide = axesOnSameSide.findIndex(c => c.id === yAxisConfigs[index]?.id);
    return currentAxisIndexOnSide > 0 ? currentAxisIndexOnSide * 40 : 0; // 40px offset for each subsequent axis
  };

  return (
    <ResponsiveContainer width="100%" height={chartHeightToUse}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: yAxisConfigs.filter(c => c.orientation === 'right').length > 0 ? yAxisConfigs.filter(c => c.orientation === 'right').length * 40 + 5 : 20,
          left: yAxisConfigs.filter(c => c.orientation === 'left').length > 0 ? yAxisConfigs.filter(c => c.orientation === 'left').length * 40 -15 : 5, // Adjusted left margin
          bottom: 110, // Sufficient space for angled X-axis, title, brush, and legend
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--foreground))"
          angle={-45}
          textAnchor="end"
          height={60} // Increased height for angled labels
          interval="preserveStartEnd" // Helps show first and last tick
          tickFormatter={formatDateTick}
          tick={{ fontSize: '0.6rem' }}
        >
          <RechartsYAxisLabel
            value={timeAxisLabel || "Time (Adjust time window with slider)"}
            offset={10} 
            position="insideBottom"
            fill="hsl(var(--muted-foreground))"
            dy={35} // Position label below angled ticks
            style={{ fontSize: '0.7rem', textAnchor: 'middle' } as React.CSSProperties}
          />
        </XAxis>

        {/* Dynamic Y-Axes */}
        {yAxisConfigs.length > 0 ? yAxisConfigs.map((config, index) => (
          <YAxis
            key={config.id}
            yAxisId={config.id}
            orientation={config.orientation}
            stroke={`hsl(var(${config.color}))`}
            domain={['auto', 'auto']}
            tick={{ fontSize: '0.6rem' }}
            tickFormatter={(value) => `${typeof value === 'number' ? value.toFixed(1) : value}${config.unit || ''}`}
            label={{
              value: config.label,
              angle: -90,
              position: config.orientation === 'left' ? 'insideLeft' : 'insideRight',
              style: { textAnchor: 'middle', fontSize: '0.7rem', fill: `hsl(var(${config.color}))` } as React.CSSProperties,
              dx: config.orientation === 'left' ? -5 - yAxisOffset(index, 'left') : 5 + yAxisOffset(index, 'right'),
              dy: 0, // Centered vertically
            }}
            width={40} // Base width for Y-axis
          />
        )) : (
          // Fallback to a single default Y-axis if no specific configs
          <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.6rem' }}>
            <RechartsYAxisLabel
              value={yAxisLabelText}
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: 'middle', fontSize: '0.7rem' } as React.CSSProperties}
              fill="hsl(var(--foreground))"
              dx={-5}
            />
          </YAxis>
        )}

        <RechartsTooltip
          contentStyle={{
            backgroundColor: "hsl(var(--background))",
            borderColor: "hsl(var(--border))",
            color: "hsl(var(--foreground))",
            fontSize: '0.7rem',
          } as CSSProperties}
          itemStyle={{ color: "hsl(var(--foreground))" } as CSSProperties}
          cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
        />
        <Legend
          verticalAlign="bottom"
          wrapperStyle={{ paddingTop: '20px', fontSize: '0.7rem' } as React.CSSProperties} // More padding above legend
        />
        
        {/* Dynamic Lines for plottable series */}
        {plottableSeries.map((seriesName, index) => {
          const yAxisConfigForSeries = yAxisConfigs.find(c => c.dataKey === seriesName);
          const mainLineColor = `hsl(var(${yAxisConfigForSeries ? yAxisConfigForSeries.color : chartColors[index % chartColors.length]}))`;
          // Use the label from YAxisConfig if available, otherwise format seriesName
          const seriesDisplayName = yAxisConfigForSeries ? yAxisConfigForSeries.label : seriesName.charAt(0).toUpperCase() + seriesName.slice(1);

          return (
            <React.Fragment key={seriesName}>
              {activeHighlightRange && highlightedData && seriesName === plottableSeries[0] ? ( // Assuming highlight applies to first series
                <>
                  {/* Background greyed-out line */}
                  <Line
                    type="monotone"
                    dataKey={seriesName} // This uses chartData by default from LineChart
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.3}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={true} // Connect across nulls in the full dataset
                    yAxisId={yAxisConfigForSeries ? yAxisConfigForSeries.id : (yAxisConfigs[0]?.id || 0)}
                    legendType="none" // Don't show this in legend
                    isAnimationActive={false}
                  />
                  {/* Highlighted segment */}
                  <Line
                    data={highlightedData} // Use the specifically prepared highlightedData array
                    type="monotone"
                    dataKey={seriesName} // dataKey must match the one in highlightedData
                    stroke={mainLineColor}
                    strokeWidth={2} // Slightly thicker for emphasis
                    dot={false}
                    name={`${seriesDisplayName} (Highlighted)`}
                    connectNulls={true} // Crucial for drawing segment correctly
                    yAxisId={yAxisConfigForSeries ? yAxisConfigForSeries.id : (yAxisConfigs[0]?.id || 0)}
                    isAnimationActive={false}
                  />
                </>
              ) : (
                // Normal line rendering if no highlight or not the highlighted series
                <Line
                  type="monotone"
                  dataKey={seriesName}
                  stroke={mainLineColor}
                  strokeWidth={1.5}
                  dot={false}
                  name={seriesDisplayName}
                  connectNulls={true}
                  yAxisId={yAxisConfigForSeries ? yAxisConfigForSeries.id : (yAxisConfigs[0]?.id || 0)}
                  isAnimationActive={false}
                />
              )}
            </React.Fragment>
          );
        })}
        <Brush
          dataKey="time"
          height={20} // Slimmer brush
          stroke="hsl(var(--primary))"
          fill="transparent" // Transparent fill to see grid lines
          tickFormatter={formatDateTick}
          travellerWidth={8}
          startIndex={brushStartIndex}
          endIndex={brushEndIndex}
          onChange={onBrushChange}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

    
