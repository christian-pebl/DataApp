
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
  Label,
  Brush,
} from "recharts";
import { Info } from "lucide-react";

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined;
}

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[];
  timeAxisLabel: string | undefined;
  plotTitle?: string;
  chartRenderHeight?: number;
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (newIndex: { startIndex?: number; endIndex?: number }) => void;
  yAxisConfigs?: Array<{
    id: string;
    orientation: 'left' | 'right';
    label: string;
    color: string; // CSS variable for stroke
    dataKey: string; // The key in DataPoint this YAxis is for
    unit?: string;
  }>;
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const INTERNAL_DEFAULT_CHART_HEIGHT = 278; 

const formatXAxisTick = (timeValue: string | number): string => {
  try {
    if (typeof timeValue === 'string' && /^\d{2}-\d{2}-\d{2}$/.test(timeValue)) {
      return timeValue;
    }
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) {
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timeValue)) {
        const year = timeValue.substring(2, 4);
        const month = timeValue.substring(5, 7);
        const day = timeValue.substring(8, 10);
        return `${year}-${month}-${day}`;
      }
      return String(timeValue);
    }
    // More detailed for hourly data, less detailed for daily/longer
    const diff = data.length > 1 ? new Date(data[1].time).getTime() - new Date(data[0].time).getTime() : 0;
    const oneDay = 24 * 60 * 60 * 1000;

    if (diff < oneDay && data.length > 24) { // Show H:M if less than a day interval and many points
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
    } else { // Show YY-MM-DD for daily or sparser data
        const year = date.getFullYear().toString().slice(-2);
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        return `${year}-${month}-${day}`;
    }
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
  yAxisConfigs = [], // Default to empty array
}: ChartDisplayProps) {
  const chartHeightToUse = chartRenderHeight ?? INTERNAL_DEFAULT_CHART_HEIGHT;

  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      Object.keys(point).forEach(key => {
        if (key !== 'time') {
          const value = point[key];
          if (typeof value === 'string') {
            const num = parseFloat(value.replace(/,/g, ''));
            newPoint[key] = isNaN(num) ? undefined : num; // Store as number or undefined
          } else if (typeof value === 'number') {
            newPoint[key] = value;
          } else {
            newPoint[key] = undefined;
          }
        }
      });
      return newPoint;
    });
  }, [data]);

  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    return plottableSeries.some(seriesName =>
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);

  const visibleChartAreaHeight = chartHeightToUse * 0.85; 

  const clippingWrapperStyle: React.CSSProperties = {
    height: `${visibleChartAreaHeight}px`,
    width: '100%',
    overflow: 'hidden',
  };

  const renderNoDataMessage = (icon: React.ReactNode, primaryText: string, secondaryText?: string) => (
    <div style={{ height: `${visibleChartAreaHeight}px`, width: '100%' }} className="flex flex-col items-center justify-center p-2 h-full">
      <div className="text-center text-muted-foreground">
        {icon}
        <p className="text-sm mt-2">{primaryText}</p>
        {secondaryText && <p className="text-xs mt-1">{secondaryText}</p>}
      </div>
    </div>
  );

  if (!data || data.length === 0) {
    return renderNoDataMessage(<Info className="h-10 w-10 mx-auto" />, `No data loaded for ${plotTitle || 'this plot'}.`, "Fetch data to get started.");
  }

  if (plottableSeries.length === 0 && yAxisConfigs.length === 0) {
    return renderNoDataMessage(<Info className="h-10 w-10 mx-auto" />, `Please select at least one variable to plot for ${plotTitle || 'this plot'}.`);
  }

  if (!hasAnyNumericDataForSelectedSeries && yAxisConfigs.every(config => !plottableSeries.includes(config.dataKey))) {
     return renderNoDataMessage(
      <Info className="h-10 w-10 mx-auto" />,
      `No valid numeric data for selected series in ${plotTitle || 'this plot'}.`,
      "Check data source or select different variables."
    );
  }
  
  const yAxisOffset = (index: number) => {
    if (index === 0) return 0; // First right axis
    return index * 60; // Subsequent right axes offset by 60px
  };


  return (
    <div style={yAxisConfigs.length > 0 ? { height: `${chartHeightToUse}px`, width: '100%'} : clippingWrapperStyle}> 
      <ResponsiveContainer width="100%" height={chartHeightToUse}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: yAxisConfigs.filter(c => c.orientation === 'right').length * 50 + 20, // Dynamic right margin
            left: yAxisConfigs.filter(c => c.orientation === 'left').length * 50 + 5,   // Dynamic left margin
            bottom: 78, 
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            stroke="hsl(var(--foreground))"
            angle={-45}
            textAnchor="end"
            height={60} 
            interval="preserveStartEnd"
            tickFormatter={(tick) => formatXAxisTick(tick)}
            tick={{ fontSize: '0.6rem' }}
          >
            {timeAxisLabel && (
              <Label
                value={`${timeAxisLabel} (Adjust time window with slider)`}
                offset={28} 
                position="insideBottom"
                fill="hsl(var(--muted-foreground))"
                dy={30} 
                style={{ fontSize: '0.6rem', textAnchor: 'middle' }}
              />
            )}
          </XAxis>

          {yAxisConfigs.length > 0 ? yAxisConfigs.map((config, index) => (
            <YAxis
              key={config.id}
              yAxisId={config.id}
              orientation={config.orientation}
              stroke={`hsl(var(${config.color}))`}
              domain={['auto', 'auto']}
              tick={{ fontSize: '0.6rem' }}
              tickFormatter={(value) => `${value}${config.unit || ''}`}
              label={{ 
                value: config.label, 
                angle: -90, 
                position: config.orientation === 'left' ? 'insideLeft' : 'insideRight', 
                style: { textAnchor: 'middle', fontSize: '0.6rem', fill: `hsl(var(${config.color}))` },
                dx: config.orientation === 'left' ? -5 : 5,
              }}
              // Apply offset only to subsequent right axes
              dx={config.orientation === 'right' ? yAxisOffset(yAxisConfigs.filter(c => c.orientation === 'right').findIndex(c => c.id === config.id)) : 0}
            />
          )) : (
             <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.6rem' }}>
                <Label
                value="Value"
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
              fontSize: '0.6rem', 
            }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
            cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '25px', fontSize: '0.6rem' }} 
          />
          {plottableSeries.map((seriesName, index) => {
            const yAxisConfig = yAxisConfigs.find(c => c.dataKey === seriesName);
            return (
                <Line
                key={seriesName}
                type="monotone"
                dataKey={seriesName}
                stroke={`hsl(var(${yAxisConfig ? yAxisConfig.color : chartColors[index % chartColors.length]}))`}
                strokeWidth={1.5}
                dot={false}
                name={seriesName.charAt(0).toUpperCase() + seriesName.slice(1)} // Capitalize for legend
                connectNulls={true}
                yAxisId={yAxisConfig ? yAxisConfig.id : (yAxisConfigs[0]?.id || 0)} // Default to first yAxisId or 0 if none
                />
            );
           })}
          <Brush
            dataKey="time"
            height={14} 
            stroke="hsl(var(--primary))"
            fill="transparent"
            fillOpacity={0.3}
            tickFormatter={(tick) => formatXAxisTick(tick)}
            travellerWidth={8}
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={onBrushChange}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
