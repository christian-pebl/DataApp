
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
  Label as RechartsYAxisLabel,
} from 'recharts';
import { format, parseISO, isValid, differenceInHours, addHours, subDays } from 'date-fns';
import type { YAxisConfig } from './ChartDisplay'; // Self-referential for type export

// Interface for a single data point
interface DataPoint {
  time: string | number; // Can be ISO string or timestamp number
  [key: string]: string | number | undefined | null; // Other data series
}

// Re-export YAxisConfig if it's used by parent components
export type { YAxisConfig } from './ChartDisplay'; // Adjust path if necessary, or define inline

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

const ANNOTATION_PAGE_CHART_RENDERING_BASE_HEIGHT = 350; // Fallback if chartRenderHeight not provided

const formatDateTickBrush = (timeValue: string | number): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    return format(dateObj, 'dd/MM/yy');
  } catch (e) {
    return String(timeValue);
  }
};

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

  const chartData = useMemo(() => {
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

  const memoizedXAxisTickFormatter = React.useCallback((timeValue: string | number): string => {
    if (!chartData || chartData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) {
      const dateObjFallback = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      return isValid(dateObjFallback) ? format(dateObjFallback, 'dd/MM/yy HH:mm') : String(timeValue);
    }
    const firstVisibleTime = chartData[brushStartIndex]?.time;
    const lastVisibleTime = chartData[brushEndIndex]?.time;

    if (!firstVisibleTime || !lastVisibleTime) {
      const dateObjFallback = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      return isValid(dateObjFallback) ? format(dateObjFallback, 'dd/MM/yy HH:mm') : String(timeValue);
    }

    const startDate = typeof firstVisibleTime === 'string' ? parseISO(firstVisibleTime) : new Date(firstVisibleTime);
    const endDate = typeof lastVisibleTime === 'string' ? parseISO(lastVisibleTime) : new Date(lastVisibleTime);

    if (!isValid(startDate) || !isValid(endDate)) {
      const dateObjFallback = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      return isValid(dateObjFallback) ? format(dateObjFallback, 'dd/MM/yy HH:mm') : String(timeValue);
    }
    
    const durationHours = differenceInHours(endDate, startDate);

    try {
      const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      if (!isValid(dateObj)) return String(timeValue);
      if (durationHours < 48) {
        return format(dateObj, 'HH:mm');
      }
      return format(dateObj, 'dd/MM/yy HH:mm');
    } catch (e) {
      return String(timeValue);
    }
  }, [chartData, brushStartIndex, brushEndIndex]);

  const memoizedXAxisTicks = useMemo(() => {
    if (!chartData || chartData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) {
      return undefined;
    }
    const firstVisibleTime = chartData[brushStartIndex]?.time;
    const lastVisibleTime = chartData[brushEndIndex]?.time;

    if (!firstVisibleTime || !lastVisibleTime) return undefined;

    const startDate = typeof firstVisibleTime === 'string' ? parseISO(firstVisibleTime) : new Date(firstVisibleTime);
    const endDate = typeof lastVisibleTime === 'string' ? parseISO(lastVisibleTime) : new Date(lastVisibleTime);
    
    if (!isValid(startDate) || !isValid(endDate)) return undefined;

    const durationHours = differenceInHours(endDate, startDate);

    if (durationHours < 48) {
      const ticks = [];
      let currentTickTime = startDate.getTime();
      // Adjust interval based on duration to avoid too many ticks
      const intervalMillis = durationHours <= 6 ? 1 * 60 * 60 * 1000 : // Every hour for <= 6 hours
                              durationHours <= 12 ? 2 * 60 * 60 * 1000 : // Every 2 hours for <= 12 hours
                              durationHours <= 24 ? 3 * 60 * 60 * 1000 : // Every 3 hours for <= 24 hours
                              6 * 60 * 60 * 1000; // Every 6 hours for < 48 hours

      while (currentTickTime <= endDate.getTime()) {
        ticks.push(currentTickTime);
        currentTickTime += intervalMillis;
      }
      // Ensure the last actual data point's time is considered if not exactly on an interval
      if (ticks.length > 0 && ticks[ticks.length - 1] < endDate.getTime() && chartData[brushEndIndex]?.time) {
          const lastDataTime = typeof chartData[brushEndIndex].time === 'string' ? parseISO(chartData[brushEndIndex].time as string).getTime() : Number(chartData[brushEndIndex].time);
          if (lastDataTime > ticks[ticks.length -1]) ticks.push(lastDataTime);
      }
      return ticks.length > 1 ? ticks : undefined; // Return undefined if only one tick to let Recharts decide
    }
    return undefined; // Let Recharts decide for longer ranges (will use dd/MM/yy HH:mm format)
  }, [chartData, brushStartIndex, brushEndIndex]);


  const hasAnyNumericDataForSelectedSeries = useMemo(() => {
    if (!chartData || chartData.length === 0) return false;
    return plottableSeries.some(seriesKey =>
      chartData.some(point => {
        const val = point[seriesKey];
        return typeof val === 'number' && !isNaN(val);
      })
    );
  }, [chartData, plottableSeries]);

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
     return <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>{renderNoDataMessage(`No valid numeric data found for the selected series: ${plottableSeries.join(', ')}.`)}</div>;
  }

  return (
    <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
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
            tick={{ fontSize: '0.7rem', fill: 'hsl(var(--muted-foreground))' }}
            ticks={memoizedXAxisTicks} // Use memoized ticks for short durations
            interval={memoizedXAxisTicks ? 0 : "preserveStartEnd"} // Use interval 0 if ticks are provided
          >
            {timeAxisLabel && (
              <RechartsYAxisLabel
                value={timeAxisLabel}
                position="insideBottom"
                offset={-30} // Adjusted offset to sit correctly below angled ticks
                dy={20}
                style={{ textAnchor: 'middle', fontSize: '0.7rem', fill: 'hsl(var(--foreground))' }}
              />
            )}
          </XAxis>

          {yAxisConfigs.map(config => (
            <YAxis
              key={config.yAxisId}
              yAxisId={config.yAxisId}
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
              return [`${value.toFixed(2)}${config?.unit ? ` ${config.unit}` : ''}`, config?.label || name];
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '0.75em' }} />

          {plottableSeries.map(seriesKey => {
            const yAxisConfig = yAxisConfigs.find(yc => yc.dataKey === seriesKey) || (yAxisConfigs.length > 0 ? yAxisConfigs[0] : { yAxisId: '0' });
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
              y={10} // Adjusted to sit comfortably below XAxis based on LineChart margin
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
