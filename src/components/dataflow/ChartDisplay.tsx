
"use client";

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  Line,
  Brush,
  Label as RechartsYAxisLabel, // Keep alias for YAxis Label if used, or general Label
} from 'recharts';
import { format, parseISO, isValid, differenceInHours, addHours, subDays, differenceInMilliseconds } from 'date-fns'; // Added differenceInMilliseconds

// Interface for Y-axis configuration (if it's not already defined or imported elsewhere)
export interface YAxisConfig {
  dataKey: string;
  label: string;
  unit?: string;
  orientation: 'left' | 'right';
  yAxisId: string;
  color?: string; // e.g., '--chart-1'
  tickFormatter?: (value: any) => string;
}

// Interface for a single data point
interface DataPoint {
  time: string | number; // Can be ISO string or timestamp number
  [key: string]: string | number | undefined | null; // Other data series
}

const ANNOTATION_PAGE_CHART_RENDERING_BASE_HEIGHT = 350; // Fallback if chartRenderHeight not provided

// Helper function to format ticks for the Brush component
const formatDateTickBrush = (timeValue: string | number): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    return format(dateObj, 'dd/MM/yy'); // Simple date format for Brush
  } catch (e) {
    return String(timeValue);
  }
};

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[];
  yAxisConfigs: YAxisConfig[];
  timeAxisLabel?: string;
  chartRenderHeight?: number;
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (newIndex: { startIndex?: number; endIndex?: number }) => void;
}

export function ChartDisplay({
  data,
  plottableSeries,
  yAxisConfigs,
  timeAxisLabel = "Time",
  chartRenderHeight,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
}: ChartDisplayProps) {
  const chartHeightToUse = chartRenderHeight || ANNOTATION_PAGE_CHART_RENDERING_BASE_HEIGHT;

  // Memoize chart data transformation
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      plottableSeries.forEach(seriesKey => {
        const value = point[seriesKey];
        if (value !== null && value !== undefined && !isNaN(Number(value))) {
          newPoint[seriesKey] = Number(value);
        } else {
          newPoint[seriesKey] = null; // Ensure non-numeric or missing values are null for Recharts
        }
      });
      return newPoint;
    });
  }, [data, plottableSeries]);

  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return false;
    return plottableSeries.some(seriesKey =>
      chartData.some(point => {
        const val = point[seriesKey];
        return typeof val === 'number' && !isNaN(val);
      })
    );
  }, [chartData, plottableSeries]);

  // Calculate visible range duration for dynamic tick formatting
  const visibleTimeRangeDurationMs = React.useMemo(() => {
    if (!chartData || chartData.length < 2 || brushStartIndex === undefined || brushEndIndex === undefined || brushStartIndex >= brushEndIndex) {
      return null; // Not enough data or invalid brush range
    }
    const firstVisibleTime = chartData[brushStartIndex]?.time;
    const lastVisibleTime = chartData[brushEndIndex]?.time;

    if (!firstVisibleTime || !lastVisibleTime) return null;

    const startDate = typeof firstVisibleTime === 'string' ? parseISO(firstVisibleTime) : new Date(firstVisibleTime);
    const endDate = typeof lastVisibleTime === 'string' ? parseISO(lastVisibleTime) : new Date(lastVisibleTime);

    if (!isValid(startDate) || !isValid(endDate)) return null;

    return differenceInMilliseconds(endDate, startDate);
  }, [chartData, brushStartIndex, brushEndIndex]);

  const memoizedXAxisTickFormatter = React.useCallback((timeValue: string | number): string => {
    try {
      const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      if (!isValid(dateObj)) return String(timeValue);

      if (visibleTimeRangeDurationMs !== null && visibleTimeRangeDurationMs < 48 * 60 * 60 * 1000) { // Less than 48 hours
        return format(dateObj, 'HH:mm');
      }
      return format(dateObj, 'dd/MM/yy HH:mm');
    } catch (e) {
      return String(timeValue);
    }
  }, [visibleTimeRangeDurationMs]);

  const memoizedXAxisTicks = React.useMemo(() => {
    if (!chartData || chartData.length < 2 || brushStartIndex === undefined || brushEndIndex === undefined || brushStartIndex >= brushEndIndex || visibleTimeRangeDurationMs === null) {
      return undefined; // Let Recharts decide
    }

    if (visibleTimeRangeDurationMs < 48 * 60 * 60 * 1000) { // Less than 48 hours
      const firstVisibleTime = chartData[brushStartIndex]?.time;
      const lastVisibleTime = chartData[brushEndIndex]?.time;
      if (!firstVisibleTime || !lastVisibleTime) return undefined;

      const startDate = typeof firstVisibleTime === 'string' ? parseISO(firstVisibleTime) : new Date(firstVisibleTime);
      const endDate = typeof lastVisibleTime === 'string' ? parseISO(lastVisibleTime) : new Date(lastVisibleTime);
      if (!isValid(startDate) || !isValid(endDate)) return undefined;

      const ticks = [];
      let currentTickTime = startDate;
      const intervalMillis = 6 * 60 * 60 * 1000; // 6-hour intervals

      while (currentTickTime.getTime() <= endDate.getTime()) {
        ticks.push(currentTickTime.getTime()); // Store as timestamp for Recharts
        currentTickTime = addHours(currentTickTime, 6);
      }
      // Ensure the last actual data point's time is considered if not exactly on an interval
      if (ticks.length > 0 && ticks[ticks.length - 1] < endDate.getTime()) {
          const lastDataTime = typeof chartData[brushEndIndex].time === 'string' ? parseISO(chartData[brushEndIndex].time as string).getTime() : Number(chartData[brushEndIndex].time);
          if (lastDataTime > ticks[ticks.length -1]) ticks.push(lastDataTime);
      }
      return ticks.length > 1 ? ticks : undefined;
    }
    return undefined; // Let Recharts decide for longer ranges
  }, [chartData, brushStartIndex, brushEndIndex, visibleTimeRangeDurationMs]);

  const yAxisLabelText = React.useMemo(() => {
    return yAxisConfigs.length === 1 && yAxisConfigs[0]
    ? `${yAxisConfigs[0].label}${yAxisConfigs[0].unit ? ` (${yAxisConfigs[0].unit})` : ''}`
    : "Value";
  }, [yAxisConfigs]);


  const renderNoDataMessage = (message: string) => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
      {message}
    </div>
  );

  if (!data || data.length === 0) {
    return <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>{renderNoDataMessage("No data loaded or data is empty.")}</div>;
  }
  if (plottableSeries.length === 0) {
    return <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>{renderNoDataMessage("Please select at least one variable to plot.")}</div>;
  }
  if (!hasAnyNumericDataForSelectedSeries) {
     return <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>{renderNoDataMessage(`No valid numeric data found for the selected series in the current view. Please check data or selected range.`)}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeightToUse}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 25,
          left: yAxisConfigs.some(yc => yc.orientation === 'left') ? 25 : 5,
          bottom: 110, // Increased to accommodate XAxis, Brush, and Legend
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          tickFormatter={memoizedXAxisTickFormatter}
          angle={-45}
          textAnchor="end"
          height={60} // Adjusted height for angled labels and title
          stroke="hsl(var(--muted-foreground))"
          tick={{ fontSize: '0.6rem', fill: 'hsl(var(--muted-foreground))' }}
          ticks={memoizedXAxisTicks}
          interval={memoizedXAxisTicks ? 0 : "preserveStartEnd"}
          label={{
            value: timeAxisLabel,
            position: 'insideBottom',
            offset: 0, // Adjust as needed, 0 will center it within the remaining space
            style: { textAnchor: 'middle', fontSize: '0.7rem', fill: 'hsl(var(--foreground))' }
          }}
        />

        {yAxisConfigs.map(config => (
          <YAxis
            key={config.yAxisId}
            yAxisId={config.yAxisId}
            orientation={config.orientation}
            stroke={config.color ? `hsl(var(${config.color}))` : "hsl(var(--muted-foreground))"}
            tickFormatter={config.tickFormatter || ((value) => typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}) : String(value))}
            tick={{ fontSize: '0.7rem', fill: 'hsl(var(--muted-foreground))' }}
            width={config.orientation === 'left' ? 45 : 40} // Adjusted for potential Y-axis label
            label={
              config.label ? (
                <RechartsYAxisLabel // This is type Label from 'recharts'
                  angle={config.orientation === 'left' ? -90 : 90}
                  value={`${config.label}${config.unit ? ` (${config.unit})` : ''}`}
                  position={config.orientation === 'left' ? 'insideLeft' : 'insideRight'}
                  style={{ textAnchor: 'middle', fontSize: '0.7rem', fill: 'hsl(var(--foreground))' }}
                  offset={config.orientation === 'left' ? -5 : 10}
                />
              ) : undefined
            }
          />
        ))}

        <RechartsTooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 'var(--radius)',
            fontSize: '0.7rem',
            boxShadow: '0 2px 8px hsla(var(--foreground) / 0.1)',
          } as React.CSSProperties}
          labelFormatter={(label) => {
            try {
              const date = typeof label === 'string' ? parseISO(label) : new Date(label);
              return isValid(date) ? format(date, 'PPp') : String(label); // 'PPp' is a long date with time
            } catch { return String(label); }
          }}
          formatter={(value: number, name: string) => {
            const config = yAxisConfigs.find(yc => yc.dataKey === name);
            return [`${value !== null && value !== undefined ? value.toFixed(2) : 'N/A'}${config?.unit ? ` ${config.unit}` : ''}`, config?.label || name];
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '0.75em' }} />

        {plottableSeries.map(seriesKey => {
          const yAxisConfig = yAxisConfigs.find(yc => yc.dataKey === seriesKey) || (yAxisConfigs.length > 0 ? yAxisConfigs[0] : { yAxisId: '0', dataKey: 'value', label: 'Value', orientation: 'left' });
          return (
            <Line
              key={seriesKey}
              type="monotone"
              dataKey={seriesKey}
              stroke={yAxisConfig?.color ? `hsl(var(${yAxisConfig.color}))` : "hsl(var(--chart-1))"}
              strokeWidth={2}
              yAxisId={yAxisConfig?.yAxisId || "0"}
              dot={false}
              activeDot={{ r: 6 }}
              connectNulls={true}
              name={yAxisConfig?.label || seriesKey}
              isAnimationActive={false}
            />
          );
        })}
        {data.length > 1 && onBrushChange && (
          <Brush
            dataKey="time"
            height={20} // Standard height for brush
            stroke="hsl(var(--primary))"
            fill="transparent"
            tickFormatter={formatDateTickBrush} // Uses dd/MM/yy
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={onBrushChange}
            travellerWidth={8}
            // y prop removed to allow Recharts to position it
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
