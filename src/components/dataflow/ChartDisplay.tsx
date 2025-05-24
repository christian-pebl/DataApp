
"use client";

import type { CSSProperties } from "react";
import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label as RechartsLabel,
  Brush,
} from "recharts";
import { Info, LineChart as LineChartIcon } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined;
}

export interface YAxisConfig {
  id: string;
  orientation: 'left' | 'right';
  label: string;
  color: string;
  dataKey: string;
  unit?: string;
}

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[];
  timeAxisLabel?: string;
  plotTitle?: string;
  chartRenderHeight?: number;
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (newIndex: { startIndex?: number; endIndex?: number }) => void;
  yAxisConfigs?: YAxisConfig[];
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const INTERNAL_DEFAULT_CHART_HEIGHT = 280; // Default render height for chart rendering if prop not provided

const formatDateTick = (timeValue: string | number): string => {
  try {
    const date = new Date(timeValue);
    if (!isValid(date)) {
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue)) {
        const parsed = parseISO(timeValue);
        if (isValid(parsed)) return format(parsed, 'dd-MM-yy');
      }
      return String(timeValue); 
    }
    return format(date, 'dd-MM-yy');
  } catch (e) {
    return String(timeValue); 
  }
};

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

  // This wrapperStyle ensures the chart rendering area is clipped if needed
  const visibleChartAreaHeight = chartHeightToUse * 0.85; // Apply 15% clip from bottom
  const wrapperStyle: React.CSSProperties = {
    height: `${visibleChartAreaHeight}px`, // Clipped height
    width: '100%',
    overflow: 'hidden', // This will clip the bottom part
  };

  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
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

  const yAxisLabelText = yAxisConfigs.length === 1 && plottableSeries.length === 1
    ? `${plottableSeries[0]}${yAxisConfigs[0].unit ? ` (${yAxisConfigs[0].unit})` : ''}`
    : "Value";
  
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
  
  const yAxisOffset = (index: number, orientation: 'left' | 'right') => {
    const axesOnSameSide = yAxisConfigs.filter(c => c.orientation === orientation);
    const currentAxisIndexOnSide = axesOnSameSide.findIndex(c => c.id === yAxisConfigs[index]?.id);
    return currentAxisIndexOnSide > 0 ? currentAxisIndexOnSide * 40 : 0;
  };

  return (
    // This outer div takes the full chartHeightToUse, the inner one applies clipping
    <div style={{ height: `${chartHeightToUse}px`, width: '100%' }} className="flex-1 min-h-0">
      <div style={wrapperStyle}> {/* This div clips the bottom */}
        <ResponsiveContainer width="100%" height={chartHeightToUse}> {/* Chart renders at full intended height */}
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: yAxisConfigs.filter(c => c.orientation === 'right').length > 0 ? yAxisConfigs.filter(c => c.orientation === 'right').length * 40 + 5 : 20,
              left: yAxisConfigs.filter(c => c.orientation === 'left').length > 0 ? yAxisConfigs.filter(c => c.orientation === 'left').length * 40 -15 : 5,
              bottom: 75, // Increased margin for X-axis elements
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              stroke="hsl(var(--foreground))"
              angle={-45}
              textAnchor="end"
              height={70} // Increased height for angled labels and title
              interval="preserveStartEnd"
              tickFormatter={formatDateTick}
              tick={{ fontSize: '0.6rem' }}
            >
              <RechartsLabel
                value={timeAxisLabel ? `${timeAxisLabel} (Adjust time window with slider)` : "Time (Adjust time window with slider)"}
                offset={15} 
                position="insideBottom"
                fill="hsl(var(--muted-foreground))"
                dy={25} // Increased dy to move title further down
                style={{ fontSize: '0.6rem', textAnchor: 'middle' }}
              />
            </XAxis>

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
                  style: { textAnchor: 'middle', fontSize: '0.6rem', fill: `hsl(var(${config.color}))` },
                  dx: config.orientation === 'left' ? -5 - yAxisOffset(index, 'left') : 5 + yAxisOffset(index, 'right'),
                  dy: 0,
                }}
                width={40}
              />
            )) : (
              <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.6rem' }}>
                <RechartsLabel
                  value={yAxisLabelText}
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: 'middle', fontSize: '0.6rem' }}
                  fill="hsl(var(--foreground))"
                  dx={-5}
                />
              </YAxis>
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
                color: "hsl(var(--foreground))",
                fontSize: '0.7rem',
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
              cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
            />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ paddingTop: '8px', fontSize: '0.6rem' }}
            />
            {plottableSeries.map((seriesName, index) => {
              const yAxisConfigForSeries = yAxisConfigs.find(c => c.dataKey === seriesName);
              return (
                <Line
                  key={seriesName}
                  type="monotone"
                  dataKey={seriesName}
                  stroke={`hsl(var(${yAxisConfigForSeries ? yAxisConfigForSeries.color : chartColors[index % chartColors.length]}))`}
                  strokeWidth={1.5}
                  dot={false}
                  name={yAxisConfigForSeries ? yAxisConfigForSeries.label : seriesName.charAt(0).toUpperCase() + seriesName.slice(1)}
                  connectNulls={true}
                  yAxisId={yAxisConfigForSeries ? yAxisConfigForSeries.id : (yAxisConfigs[0]?.id || 0)}
                />
              );
            })}
            <Brush
              dataKey="time"
              height={11} // Kept Brush height slim
              stroke="hsl(var(--primary))"
              fill="transparent"
              tickFormatter={formatDateTick}
              travellerWidth={8}
              startIndex={brushStartIndex}
              endIndex={brushEndIndex}
              onChange={onBrushChange}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
