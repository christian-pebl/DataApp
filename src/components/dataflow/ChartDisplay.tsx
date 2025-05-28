
"use client";

import React, { useMemo, useCallback } from 'react';
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

const ANNOTATION_PAGE_CHART_RENDERING_BASE_HEIGHT = 350; // Default height for Annotation page

// Helper function to format ticks for the Brush component
const formatDateTickBrush = (timeValue: string | number): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    return format(dateObj, 'dd/MM/yy');
  } catch (e) {
    return String(timeValue);
  }
};

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[];
  yAxisConfigs: YAxisConfig[];
  timeAxisLabel?: string;
  chartRenderHeight?: number; // Overall height for the chart component area
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

  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      plottableSeries.forEach(seriesKey => {
        const value = point[seriesKey];
        if (value !== null && value !== undefined && !isNaN(Number(value))) {
          newPoint[seriesKey] = Number(value);
        } else {
          newPoint[seriesKey] = null; // Keep as null if not a valid number for plotting
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

  const memoizedXAxisTickFormatter = React.useCallback((timeValue: string | number): string => {
    try {
      const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      if (!isValid(dateObj)) {
        return String(timeValue);
      }
      return format(dateObj, 'dd/MM/yy');
    } catch (e) {
      return String(timeValue);
    }
  }, []);

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
          bottom: 60, // Adjusted for potentially angled X-axis labels, title, Brush, and Legend
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
            offset: 15,
            dy: 15,
            style: { textAnchor: 'middle', fontSize: '0.6rem', fill: 'hsl(var(--foreground))' }
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
            domain={['dataMin', 'dataMax']} // Explicitly scale to min/max of visible data
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
          isAnimationActive={false}
        />
        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '0.6rem' }} />

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
              connectNulls={true}
              name={yAxisConfig?.label || seriesKey}
              isAnimationActive={false}
            />
          );
        })}
        {data.length > 1 && onBrushChange && (
          <Brush
            dataKey="time"
            height={12}
            stroke="hsl(var(--primary))"
            fill="transparent"
            fillOpacity={0.3}
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
