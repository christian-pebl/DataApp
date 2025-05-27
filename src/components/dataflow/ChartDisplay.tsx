
"use client";

import type { CSSProperties } from "react";
import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Label as RechartsYAxisLabel,
  Brush,
} from "recharts";
import { Info, LineChart as LineChartIcon } from "lucide-react";
import { format, parseISO, isValid, differenceInMilliseconds, addHours } from 'date-fns';

interface DataPoint {
  time: string | number; // ISO string or timestamp
  [key: string]: string | number | undefined | null;
}

export interface YAxisConfig {
  id: string;
  orientation: 'left' | 'right';
  label: string;
  color: string; // CSS variable name like '--chart-1'
  dataKey: string;
  unit?: string;
}

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[];
  timeAxisLabel?: string;
  plotTitle?: string; // Added for context in messages
  chartRenderHeight?: number;
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (newIndex: { startIndex?: number; endIndex?: number }) => void;
  yAxisConfigs?: YAxisConfig[];
}

const INTERNAL_DEFAULT_CHART_HEIGHT = 350;
const MILLISECONDS_IN_48_HOURS = 48 * 60 * 60 * 1000;

export function ChartDisplay({
  data,
  plottableSeries,
  timeAxisLabel,
  plotTitle,
  chartRenderHeight,
  brushStartIndex,
  brushEndIndex,
  onBrushChange,
  yAxisConfigs = [],
}: ChartDisplayProps) {

  const chartHeightToUse = chartRenderHeight ?? INTERNAL_DEFAULT_CHART_HEIGHT;

  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      plottableSeries.forEach(seriesName => {
        const value = point[seriesName];
        if (typeof value === 'string') {
          const num = parseFloat(value.replace(/,/g, ''));
          newPoint[seriesName] = isNaN(num) ? undefined : num;
        } else if (typeof value === 'number') {
          newPoint[seriesName] = value;
        } else {
          newPoint[seriesName] = undefined;
        }
      });
      return newPoint;
    });
  }, [data, plottableSeries]);

  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    return plottableSeries.some(seriesName =>
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);

  const visibleTimeRangeInfo = useMemo(() => {
    if (!chartData || chartData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined || brushStartIndex > brushEndIndex) {
      return { durationMs: Infinity, ticks: undefined, format: "dd-MM-yy" };
    }
    const startIdx = Math.max(0, brushStartIndex);
    const endIdx = Math.min(chartData.length - 1, brushEndIndex);

    if (startIdx >= chartData.length || endIdx < 0 || startIdx > endIdx) {
         return { durationMs: Infinity, ticks: undefined, format: "dd-MM-yy" };
    }

    const startTimeValue = chartData[startIdx]?.time;
    const endTimeValue = chartData[endIdx]?.time;

    if (!startTimeValue || !endTimeValue) {
         return { durationMs: Infinity, ticks: undefined, format: "dd-MM-yy" };
    }

    const startDate = typeof startTimeValue === 'string' ? parseISO(startTimeValue) : new Date(startTimeValue);
    const endDate = typeof endTimeValue === 'string' ? parseISO(endTimeValue) : new Date(endTimeValue);

    if (!isValid(startDate) || !isValid(endDate)) {
        return { durationMs: Infinity, ticks: undefined, format: "dd-MM-yy" };
    }
    
    const durationMs = differenceInMilliseconds(endDate, startDate);

    if (durationMs < MILLISECONDS_IN_48_HOURS) {
      const ticks: number[] = [];
      let currentTick = startDate;
      while (currentTick <= endDate) {
        ticks.push(currentTick.getTime());
        currentTick = addHours(currentTick, 6);
      }
      // Ensure the last data point's time is also a potential tick if it's not covered
      if (ticks.length > 0 && ticks[ticks.length-1] < endDate.getTime() && (endDate.getTime() - ticks[ticks.length-1]) > 2*60*60*1000 ) {
         // ticks.push(endDate.getTime()); // Only add if significantly past last 6hr tick
      }
      // Add first tick if not present
      if (ticks.length === 0 || (ticks.length > 0 && startDate.getTime() < ticks[0] && (ticks[0] - startDate.getTime() > 2*60*60*1000))) {
        // ticks.unshift(startDate.getTime());
      }


      return { durationMs, ticks: ticks.length > 0 ? ticks : undefined, format: "HH:mm" };
    }

    return { durationMs, ticks: undefined, format: "dd-MM-yy" };
  }, [chartData, brushStartIndex, brushEndIndex]);

  const formatXAxisTick = (timeValue: string | number): string => {
    try {
      const date = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
      if (!isValid(date)) {
        return String(timeValue); // Fallback for unparseable values
      }
      return format(date, visibleTimeRangeInfo.format);
    } catch (e) {
      return String(timeValue); // Fallback for any error
    }
  };

  const renderNoDataMessage = (icon: React.ReactNode, primaryText: string, secondaryText?: string) => (
     <div style={{ height: `${chartHeightToUse}px`, width: '100%' }} className="flex flex-col items-center justify-center p-2">
      <div className="text-center text-muted-foreground">
        {icon}
        <p className="text-sm mt-2">{primaryText}</p>
        {secondaryText && <p className="text-xs mt-1">{secondaryText}</p>}
      </div>
    </div>
  );

  if (!data || data.length === 0) {
    return renderNoDataMessage(<LineChartIcon className="h-6 w-6 mx-auto text-muted" />, `No data loaded for ${plotTitle || 'this plot'}.`);
  }
  if (plottableSeries.length === 0) {
    return renderNoDataMessage(<Info className="h-6 w-6 mx-auto text-muted" />, `Please select at least one variable to plot for ${plotTitle || 'this plot'}.`);
  }
  if (!hasAnyNumericDataForSelectedSeries) {
    return renderNoDataMessage(
      <Info className="h-6 w-6 mx-auto text-muted" />,
      `No valid numeric data for selected series: ${plottableSeries.join(', ')} in ${plotTitle || 'this plot'}.`,
      "Check data source or ensure series contain numeric values."
    );
  }

  const yAxisLabelText = React.useMemo(() => {
    return yAxisConfigs.length === 1 && yAxisConfigs[0]
    ? `${yAxisConfigs[0].label}${yAxisConfigs[0].unit ? ` (${yAxisConfigs[0].unit})` : ''}`
    : "Value";
  }, [yAxisConfigs]);


  return (
    <ResponsiveContainer width="100%" height={chartHeightToUse}>
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: yAxisConfigs.filter(c => c.orientation === 'right').length > 0 ? Math.max(20, yAxisConfigs.filter(c => c.orientation === 'right').length * 40 + 5) : 20,
          left: yAxisConfigs.filter(c => c.orientation === 'left').length > 0 ? Math.max(25, yAxisConfigs.filter(c => c.orientation === 'left').length * 40 -15) : 25,
          bottom: 75, // Adjusted for X-axis labels, title, and Brush
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--foreground))"
          angle={-45}
          textAnchor="end"
          height={60} 
          interval="preserveStartEnd" // Recharts will attempt to show ticks without overlap
          ticks={visibleTimeRangeInfo.ticks} // Pass dynamic ticks for <48h range
          tickFormatter={formatXAxisTick}
          tick={{ fontSize: '0.6rem' }}
        >
          <RechartsYAxisLabel
            value={timeAxisLabel || "Time"}
            offset={15}
            position="insideBottom"
            fill="hsl(var(--muted-foreground))"
            dy={15}
            style={{ fontSize: '0.6rem', textAnchor: 'middle' } as React.CSSProperties}
          />
        </XAxis>

        {yAxisConfigs.length > 0 ? yAxisConfigs.map((config, index) => {
          const axesOnSameSide = yAxisConfigs.filter(c => c.orientation === config.orientation);
          const currentAxisIndexOnSide = axesOnSameSide.findIndex(c => c.id === config.id);
          const axisOffset = currentAxisIndexOnSide > 0 ? currentAxisIndexOnSide * 40 : 0;

          return (
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
                dx: config.orientation === 'left' ? -5 - axisOffset : 5 + axisOffset,
                dy: 0,
              }}
              width={40} // Base width
            />
          );
        }) : (
          <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.6rem' }} width={40}>
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
          labelFormatter={(label) => {
            const date = typeof label === 'string' ? parseISO(label) : new Date(label as number);
            return isValid(date) ? format(date, 'dd-MM-yy HH:mm') : String(label);
          }}
          isAnimationActive={false}
        />
        <Legend
          verticalAlign="bottom"
          wrapperStyle={{ paddingTop: '10px', fontSize: '0.6rem', position: 'relative', bottom: -5 }}
          iconSize={8}
        />

        {plottableSeries.map((seriesName, index) => {
          const yAxisConfigForSeries = yAxisConfigs.find(c => c.dataKey === seriesName);
          const mainLineColor = `hsl(var(${yAxisConfigForSeries ? yAxisConfigForSeries.color : `chart-${(index % 5) + 1}`}))`;
          const seriesDisplayName = yAxisConfigForSeries ? yAxisConfigForSeries.label : seriesName.charAt(0).toUpperCase() + seriesName.slice(1);

          return (
            <Line
              key={seriesName}
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
          );
        })}
        <Brush
          dataKey="time"
          height={12}
          stroke="hsl(var(--primary))"
          fill="transparent"
          tickFormatter={(timeValue) => format(parseISO(timeValue as string), 'dd-MM-yy')} // Brush uses fixed format
          travellerWidth={8}
          startIndex={brushStartIndex}
          endIndex={brushEndIndex}
          onChange={onBrushChange}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
