
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

export interface YAxisConfig { // Export YAxisConfig
  id: string;
  orientation: 'left' | 'right';
  label: string;
  color: string; // CSS variable for stroke
  dataKey: string; // The key in DataPoint this YAxis is for
  unit?: string;
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
  yAxisConfigs?: YAxisConfig[]; // Made optional
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const INTERNAL_DEFAULT_CHART_HEIGHT = 278; 

const formatXAxisTick = (timeValue: string | number, dataForFormatting?: DataPoint[]): string => {
  try {
    if (typeof timeValue === 'string' && /^\d{2}-\d{2}-\d{2}$/.test(timeValue)) {
      return timeValue; // Already in YY-MM-DD from PlotInstance
    }
    
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) {
      // Handle cases where date might already be pre-formatted or is just a string
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue)) {
        // ISO string like "2024-07-16T14:00"
        const year = date.getFullYear().toString().slice(-2);
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        const hours = ('0' + date.getHours()).slice(-2);
        const minutes = ('0' + date.getMinutes()).slice(-2);
        
        // Check if it's a daily tick (00:00)
        if (date.getHours() === 0 && date.getMinutes() === 0 && (dataForFormatting?.[0]?.time === timeValue || !dataForFormatting)) {
            return `${year}-${month}-${day}`;
        }
        return `${hours}:${minutes}`; // Default to H:M for hourly data
      }
      return String(timeValue); // Fallback for other string types
    }

    // Determine data interval for smarter formatting
    let isHourly = false;
    if (dataForFormatting && dataForFormatting.length > 1) {
        const firstTime = new Date(dataForFormatting[0].time).getTime();
        const secondTime = new Date(dataForFormatting[1].time).getTime();
        if (!isNaN(firstTime) && !isNaN(secondTime)) {
            const diff = secondTime - firstTime;
            const oneHour = 60 * 60 * 1000;
            if (diff <= oneHour * 1.5) { // allow some flexibility for hourly data
                isHourly = true;
            }
        }
    } else if (typeof timeValue === 'string' && timeValue.includes('T')) { // Assume hourly if it's an ISO timestamp string
        isHourly = true;
    }


    if (isHourly) {
      // Show date for the first tick or if it's midnight
      const isFirstTick = dataForFormatting && dataForFormatting.length > 0 && dataForFormatting[0].time === timeValue;
      if (isFirstTick || (date.getHours() === 0 && date.getMinutes() === 0)) {
        const year = date.getFullYear().toString().slice(-2);
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        return `${day}-${month}-${year}`; // Use DD-MM-YY for the date part on hourly data key ticks
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
    } else { // Show YY-MM-DD for daily or sparser data
        const year = date.getFullYear().toString().slice(-2);
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        return `${year}-${month}-${day}`;
    }
  } catch (e) {
    return String(timeValue); // Fallback
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
            newPoint[key] = isNaN(num) ? undefined : num; 
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
    <div style={yAxisConfigs.length > 0 ? { height: `${chartHeightToUse}px`, width: '100%'} : clippingWrapperStyle} className="flex flex-col items-center justify-center p-2 h-full">
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
  
  const activeSeriesToPlot = plottableSeries.filter(seriesName =>
    yAxisConfigs.some(config => config.dataKey === seriesName) || // If it has a Y-axis config
    chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName]))) // Or if it has numeric data and no specific Y-axis (default behavior)
  );


  if (activeSeriesToPlot.length === 0) {
     return renderNoDataMessage(<Info className="h-10 w-10 mx-auto" />, `Please select at least one variable to plot with valid data for ${plotTitle || 'this plot'}.`);
  }

  if (!hasAnyNumericDataForSelectedSeries) {
     return renderNoDataMessage(
      <Info className="h-10 w-10 mx-auto" />,
      `No valid numeric data for selected series in ${plotTitle || 'this plot'}.`,
      "Check data source or select different variables."
    );
  }
  
  const yAxisOffset = (index: number) => {
    // Only apply offset to right-oriented axes after the first one on the right
    const rightAxes = yAxisConfigs.filter(c => c.orientation === 'right');
    const currentAxisIndexOnRight = rightAxes.findIndex(c => c.id === yAxisConfigs[index]?.id);
     if (yAxisConfigs[index]?.orientation === 'right' && currentAxisIndexOnRight > 0) {
        return currentAxisIndexOnRight * 60; 
    }
    return 0;
  };


  return (
    // Conditionally apply clipping wrapper style only if NOT using yAxisConfigs (like on the main page)
    // For weather page with yAxisConfigs, we let the chart take its full height.
    <div style={yAxisConfigs.length > 0 ? { height: `${chartHeightToUse}px`, width: '100%'} : clippingWrapperStyle}> 
      <ResponsiveContainer width="100%" height={chartHeightToUse}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: yAxisConfigs.filter(c => c.orientation === 'right').length * 50 + (yAxisConfigs.filter(c => c.orientation === 'right').length > 1 ? 30 : 20), // Dynamic right margin
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
            tickFormatter={(tick) => formatXAxisTick(tick, chartData)}
            tick={{ fontSize: '0.6rem' }}
          >
            {timeAxisLabel && (
              <Label
                value={`${timeAxisLabel} (Adjust time window with slider)`}
                offset={15} 
                position="insideBottom"
                fill="hsl(var(--muted-foreground))"
                dy={35} 
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
              dx={yAxisOffset(index)}
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
            wrapperStyle={{ paddingTop: '10px', fontSize: '0.6rem' }} 
          />
          {activeSeriesToPlot.map((seriesName, index) => {
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
                yAxisId={yAxisConfig ? yAxisConfig.id : (yAxisConfigs[0]?.id || 0)} 
                />
            );
           })}
          <Brush
            dataKey="time"
            height={12} 
            stroke="hsl(var(--primary))"
            fill="transparent"
            fillOpacity={0.3}
            tickFormatter={(tick) => formatXAxisTick(tick, chartData)}
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
