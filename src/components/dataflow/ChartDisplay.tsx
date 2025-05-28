
"use client";

import React, { useMemo, useCallback } from 'react'; // Added useCallback
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
  Label as RechartsYAxisLabel,
} from 'recharts';
import { format, parseISO, isValid, differenceInMilliseconds } from 'date-fns';
// import type { YAxisConfig } from './ChartDisplay'; // Self-referential type for export

// Interface for Y-axis configuration
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

const ANNOTATION_PAGE_CHART_RENDERING_BASE_HEIGHT = 350;

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

  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      plottableSeries.forEach(seriesKey => {
        const value = point[seriesKey];
        if (value !== null && value !== undefined && !isNaN(Number(value))) {
          newPoint[seriesKey] = Number(value);
        } else {
          newPoint[seriesKey] = null;
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

  const visibleTimeRangeDurationMs = React.useMemo(() => {
    if (!chartData || chartData.length < 2 || brushStartIndex === undefined || brushEndIndex === undefined || brushStartIndex >= brushEndIndex) {
      return null;
    }
    const firstVisibleTime = chartData[brushStartIndex]?.time;
    const lastVisibleTime = chartData[brushEndIndex]?.time;

    if (!firstVisibleTime || !lastVisibleTime) return null;

    let startDate, endDate;
    try {
      startDate = typeof firstVisibleTime === 'string' ? parseISO(firstVisibleTime) : new Date(firstVisibleTime);
      endDate = typeof lastVisibleTime === 'string' ? parseISO(lastVisibleTime) : new Date(lastVisibleTime);
    } catch (e) {
      return null; 
    }

    if (!isValid(startDate) || !isValid(endDate)) return null;

    return differenceInMilliseconds(endDate, startDate);
  }, [chartData, brushStartIndex, brushEndIndex]);

  const memoizedXAxisTickFormatter = React.useCallback((timeValue: string | number): string => {
    try {
      const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      if (!isValid(dateObj)) {
        // If date is not valid, return the original string.
        // This is likely why you might be seeing the "full format" if your CSV time strings aren't ISO 8601.
        return String(timeValue);
      }

      if (visibleTimeRangeDurationMs !== null && visibleTimeRangeDurationMs < (48 * 60 * 60 * 1000)) {
        return format(dateObj, 'HH'); // Hour only
      }
      return format(dateObj, 'dd/MM/yy HH'); // Date and Hour for longer ranges
    } catch (e) {
      return String(timeValue);
    }
  }, [visibleTimeRangeDurationMs]);


  const yAxisLabelText = React.useMemo(() => { // This hook was already here
    return yAxisConfigs.length === 1 && yAxisConfigs[0]
    ? `${yAxisConfigs[0].label}${yAxisConfigs[0].unit ? ` (${yAxisConfigs[0].unit})` : ''}`
    : "Value";
  }, [yAxisConfigs]);


  const renderNoDataMessage = (message: string) => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
      {message}
    </div>
  );

  // Ensure all hooks are called before this point
  if (!data || data.length === 0) {
    return <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>{renderNoDataMessage("No data loaded or data is empty.")}</div>;
  }
  if (plottableSeries.length === 0) {
    return <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>{renderNoDataMessage("Please select at least one variable to plot.")}</div>;
  }
  if (!hasAnyNumericDataForSelectedSeries) {
     return <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>{renderNoDataMessage(`No valid numeric data found for the selected series (${plottableSeries.join(', ')}) in the current view. Please check data or selected range.`)}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={chartHeightToUse}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: yAxisConfigs.some(yc => yc.orientation === 'right') ? 25 : 5,
          left: yAxisConfigs.some(yc => yc.orientation === 'left') ? 25 : 5,
          bottom: 110,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          tickFormatter={memoizedXAxisTickFormatter}
          angle={-45}
          textAnchor="end"
          height={60}
          stroke="hsl(var(--muted-foreground))"
          tick={{ fontSize: '0.6rem', fill: 'hsl(var(--muted-foreground))' }}
          interval="preserveStartEnd"
          label={{
            value: timeAxisLabel,
            position: 'insideBottom',
            offset: 0,
            dy: 30,
            style: { textAnchor: 'middle', fontSize: '0.7rem', fill: 'hsl(var(--foreground))' }
          }}
        />

        {yAxisConfigs.map(config => (
          <YAxis
            key={config.yAxisId}
            yAxisId={config.yAxisId}
            dataKey={config.dataKey}
            orientation={config.orientation}
            stroke={config.color ? `hsl(var(${config.color}))` : "hsl(var(--muted-foreground))"}
            tickFormatter={config.tickFormatter || ((value) => typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}) : String(value))}
            tick={{ fontSize: '0.7rem', fill: 'hsl(var(--muted-foreground))' }}
            width={config.orientation === 'left' ? 45 : 40}
            label={
              config.label ? (
                <RechartsYAxisLabel
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
              return isValid(date) ? format(date, 'PPp') : String(label);
            } catch { return String(label); }
          }}
          formatter={(value: number, name: string) => {
            const config = yAxisConfigs.find(yc => yc.dataKey === name);
            return [`${value !== null && value !== undefined ? value.toFixed(2) : 'N/A'}${config?.unit ? ` ${config.unit}` : ''}`, config?.label || name];
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '0.75em' }} />

        {plottableSeries.map(seriesKey => {
          const yAxisConfig = yAxisConfigs.find(yc => yc.dataKey === seriesKey) || (yAxisConfigs.length > 0 ? yAxisConfigs[0] : { yAxisId: 'left-axis', dataKey: 'value', label: 'Value', orientation: 'left', color: '--chart-1' });
          return (
            <Line
              key={seriesKey}
              type="monotone"
              dataKey={seriesKey}
              stroke={yAxisConfig?.color ? `hsl(var(${yAxisConfig.color}))` : "hsl(var(--chart-1))"}
              strokeWidth={2}
              yAxisId={yAxisConfig?.yAxisId || "left-axis"}
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
            height={20}
            stroke="hsl(var(--primary))"
            fill="hsl(var(--muted))"
            tickFormatter={formatDateTickBrush}
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={onBrushChange}
            travellerWidth={8}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

    