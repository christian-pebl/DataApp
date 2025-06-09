
"use client";

import type { CSSProperties } from "react";
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

export interface YAxisConfig {
  dataKey: string;
  label: string;
  unit?: string;
  orientation: 'left' | 'right';
  yAxisId: string;
  color?: string; 
  tickFormatter?: (value: any) => string;
}

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined | null;
}

const INTERNAL_DEFAULT_CHART_HEIGHT = 350;

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
  const chartHeightToUse = chartRenderHeight || INTERNAL_DEFAULT_CHART_HEIGHT;

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

  const memoizedXAxisTickFormatter = React.useCallback((timeValue: string | number): string => {
    try {
      const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      if (!isValid(dateObj)) {
        console.warn(`Invalid date encountered in XAxis: ${timeValue}`);
        return String(timeValue); 
      }
      return format(dateObj, 'dd/MM/yy'); 
    } catch (e) {
      console.error(`Error formatting date in XAxis: ${timeValue}`, e);
      return String(timeValue); 
    }
  }, []);

  const formatDateTickBrush = useCallback((timeValue: string | number): string => {
    try {
      const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      if (!isValid(dateObj)) return String(timeValue);
      return format(dateObj, 'dd/MM/yy'); 
    } catch (e) {
      return String(timeValue);
    }
  }, []);

  const yAxisLabelText = React.useMemo(() => {
    if (yAxisConfigs.length === 1 && yAxisConfigs[0]) {
      const config = yAxisConfigs[0];
      return `${config.label}${config.unit ? ` (${config.unit})` : ''}`;
    }
    return "Value";
  }, [yAxisConfigs]);


  const renderNoDataMessage = (message: string) => (
    <div
      className="flex items-center justify-center h-full text-muted-foreground text-sm p-4"
      style={{ height: `${chartHeightToUse}px` }}
    >
      {message}
    </div>
  );

  if (!data || data.length === 0) {
    return renderNoDataMessage("No data loaded or data is empty.");
  }
  if (plottableSeries.length === 0) {
    return renderNoDataMessage("Please select at least one variable to plot.");
  }
   if (!hasAnyNumericDataForSelectedSeries && plottableSeries.length > 0) {
     return renderNoDataMessage(`No valid numeric data found for the selected series (${plottableSeries.join(', ')}) in the current view. Please check data or selected range.`);
  }

  return (
    <div style={{ height: `${chartHeightToUse}px`, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: yAxisConfigs.some(yc => yc.orientation === 'right' && plottableSeries.includes(yc.dataKey)) ? 20 : 5,
            left: yAxisConfigs.some(yc => yc.orientation === 'left' && plottableSeries.includes(yc.dataKey)) ? 25 : 5,
            bottom: 85, 
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
            tick={{ fontSize: '0.7rem' }}
            interval="preserveStartEnd"
            label={{
              value: timeAxisLabel,
              position: 'insideBottom',
              offset: 15, 
              dy: 25,    
              style: { textAnchor: 'middle', fontSize: '0.7rem', fill: 'hsl(var(--foreground))' } as CSSProperties
            }}
          />

          {yAxisConfigs.map(config => {
            if (!plottableSeries.includes(config.dataKey)) return null;
            return (
              <YAxis
                key={config.yAxisId}
                yAxisId={config.yAxisId}
                orientation={config.orientation}
                stroke={config.color ? `hsl(var(${config.color}))` : "hsl(var(--muted-foreground))"}
                tickFormatter={config.tickFormatter || ((value) => typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}) : String(value))}
                tick={{ fontSize: '0.7rem' }}
                width={config.orientation === 'left' ? 40 : 35}
                domain={['dataMin', 'dataMax']}
                label={
                  config.label ? (
                    <RechartsYAxisLabel
                      angle={config.orientation === 'left' ? -90 : 90}
                      value={`${config.label}${config.unit ? ` (${config.unit})` : ''}`}
                      position={config.orientation === 'left' ? 'insideLeft' : 'insideRight'}
                      style={{ textAnchor: 'middle', fontSize: '0.7rem', fill: 'hsl(var(--foreground))' } as CSSProperties}
                      offset={config.orientation === 'left' ? -5 : 10}
                    />
                  ) : undefined
                }
              />
            );
          })}

          <RechartsTooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              fontSize: '0.7rem', 
              boxShadow: '0 2px 8px hsla(var(--foreground) / 0.1)',
            } as CSSProperties}
            labelFormatter={(label) => {
              try {
                const date = typeof label === 'string' ? parseISO(label) : new Date(label);
                return isValid(date) ? format(date, 'PPp') : String(label);
              } catch { return String(label); }
            }}
            formatter={(value: number | null | undefined, name: string) => {
              const config = yAxisConfigs.find(yc => yc.dataKey === name);
              return [`${value !== null && value !== undefined && !isNaN(value) ? value.toFixed(2) : 'N/A'}${config?.unit ? ` ${config.unit}` : ''}`, config?.label || name];
            }}
            isAnimationActive={false}
          />
          <Legend wrapperStyle={{ paddingTop: '15px', fontSize: '0.7rem' }} />

          {plottableSeries.map(seriesKey => {
            const yAxisConfigForLine = yAxisConfigs.find(yc => yc.dataKey === seriesKey) || (yAxisConfigs.length > 0 ? yAxisConfigs[0] : undefined);
            if (!yAxisConfigForLine) return null;
            return (
              <Line
                key={seriesKey}
                type="monotone"
                dataKey={seriesKey}
                stroke={yAxisConfigForLine?.color ? `hsl(var(${yAxisConfigForLine.color}))` : "hsl(var(--chart-1))"}
                strokeWidth={1.5}
                yAxisId={yAxisConfigForLine?.yAxisId}
                dot={false}
                connectNulls={true}
                name={yAxisConfigForLine?.label || seriesKey}
                isAnimationActive={false}
              />
            );
          })}
          {data.length > 1 && onBrushChange && (
            <Brush
              dataKey="time"
              height={20} 
              stroke="hsl(var(--primary))"
              fill="transparent"
              tickFormatter={formatDateTickBrush}
              startIndex={brushStartIndex}
              endIndex={brushEndIndex}
              onChange={onBrushChange}
              travellerWidth={10} 
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

