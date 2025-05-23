
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
  Label as RechartsLabel, // Renamed to avoid conflict with ShadCN Label
  Brush,
} from "recharts";
import { Info } from "lucide-react";

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined;
}

export interface YAxisConfig {
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
  yAxisConfigs?: YAxisConfig[]; // Made optional for flexibility
  // Removed clipPlotBottom as it's no longer used
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const INTERNAL_DEFAULT_CHART_HEIGHT = 278; // Default render height for chart when not specified


const formatXAxisTick = (timeValue: string | number, dataForFormatting?: DataPoint[]): string => {
  try {
    if (typeof timeValue === 'string' && /^\d{2}-\d{2}-\d{2}$/.test(timeValue)) {
      return timeValue;
    }
    
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) {
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue)) {
        // Handle ISO string "YYYY-MM-DDTHH:MM" specifically if parseISO fails (e.g. due to TZ issues)
        const [datePart, timePart] = timeValue.split('T');
        const [year, month, day] = datePart.split('-');
        const [hours, minutes] = timePart.split(':');
        if (hours === "00" && minutes === "00" && (dataForFormatting?.[0]?.time === timeValue || !dataForFormatting)) {
            return `${day}-${month}-${year.slice(-2)}`; // DD-MM-YY for midnight
        }
        return `${hours}:${minutes}`; // H:M
      }
      return String(timeValue);
    }

    let isHourly = false;
    if (dataForFormatting && dataForFormatting.length > 1) {
        const firstTime = new Date(dataForFormatting[0].time).getTime();
        const secondTime = new Date(dataForFormatting[1].time).getTime();
        if (!isNaN(firstTime) && !isNaN(secondTime)) {
            const diff = secondTime - firstTime;
            const oneHour = 60 * 60 * 1000;
            if (diff <= oneHour * 1.5) {
                isHourly = true;
            }
        }
    } else if (typeof timeValue === 'string' && timeValue.includes('T')) {
        isHourly = true;
    }


    if (isHourly) {
      const isFirstTick = dataForFormatting && dataForFormatting.length > 0 && dataForFormatting[0].time === timeValue;
      if (isFirstTick || (date.getHours() === 0 && date.getMinutes() === 0)) {
        const year = date.getFullYear().toString().slice(-2);
        const month = ('0' + (date.getMonth() + 1)).slice(-2);
        const day = ('0' + date.getDate()).slice(-2);
        return `${day}-${month}-${year}`; 
      }
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'});
    } else { 
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
            newPoint[key] = isNaN(num) ? undefined : num; 
          } else if (typeof value === 'number') {
            newPoint[key] = value;
          } else {
            newPoint[key] = undefined; // Ensure only numbers or undefined for plotting
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
  
  const visibleChartAreaHeight = chartHeightToUse * 0.85; // 15% clip from bottom applied to container
  const wrapperStyle: React.CSSProperties = {
    height: `${yAxisConfigs.length > 0 ? chartHeightToUse : visibleChartAreaHeight}px`, // Use full height for multi-axis weather plot, clipped for CSV plot
    width: '100%',
    overflow: yAxisConfigs.length > 0 ? 'visible' : 'hidden', // Allow axes to render outside for weather, clip for CSV
  };
  
  const renderNoDataMessage = (icon: React.ReactNode, primaryText: string, secondaryText?: string) => (
    <div style={wrapperStyle} className="flex flex-col items-center justify-center p-2 h-full">
      <div className="text-center text-muted-foreground">
        {icon}
        <p className="text-sm mt-2">{primaryText}</p>
        {secondaryText && <p className="text-xs mt-1">{secondaryText}</p>}
      </div>
    </div>
  );

  if (!data || data.length === 0) {
    return renderNoDataMessage(<Info className="h-10 w-10 mx-auto" />, `No data loaded for ${plotTitle || 'this plot'}.`, "Fetch or upload data to get started.");
  }
  
  const activeSeriesToPlot = plottableSeries.filter(seriesName =>
    yAxisConfigs.some(config => config.dataKey === seriesName) || // If it has a Y-axis config
    chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName]))) 
  );


  if (activeSeriesToPlot.length === 0) {
     return renderNoDataMessage(<Info className="h-10 w-10 mx-auto" />, `Please select at least one variable to plot for ${plotTitle || 'this plot'}.`);
  }

  if (!hasAnyNumericDataForSelectedSeries) {
     return renderNoDataMessage(
      <Info className="h-10 w-10 mx-auto" />,
      `No valid numeric data for selected series in ${plotTitle || 'this plot'}.`,
      "Check data source or select different variables."
    );
  }
  
  const yAxisOffset = (index: number, orientation: 'left' | 'right') => {
    const axesOnSameSide = yAxisConfigs.filter(c => c.orientation === orientation);
    const currentAxisIndexOnSide = axesOnSameSide.findIndex(c => c.id === yAxisConfigs.find(yc => yc.id === yAxisConfigs[index]?.id)?.id);

    if (currentAxisIndexOnSide > 0) {
        return currentAxisIndexOnSide * (orientation === 'right' ? 50 : 40); // Adjust spacing for left/right
    }
    return 0;
  };


  return (
    <div style={wrapperStyle}> {/* Wrapper applies clipping or full height */}
      <ResponsiveContainer width="100%" height={chartHeightToUse}> {/* Chart renders at full intended height */}
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: yAxisConfigs.filter(c => c.orientation === 'right').length * 40 + 20, 
            left: yAxisConfigs.filter(c => c.orientation === 'left').length * 40 + 5,  
            bottom: 63, // Consistent bottom margin
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
              <RechartsLabel
                value={`${timeAxisLabel} (Adjust time window with slider)`}
                offset={15} 
                position="insideBottom"
                fill="hsl(var(--muted-foreground))"
                dy={22} 
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
              tickFormatter={(value) => `${typeof value === 'number' ? value.toFixed(1) : value}${config.unit || ''}`}
              label={{ 
                value: config.label, 
                angle: -90, 
                position: config.orientation === 'left' ? 'insideLeft' : 'insideRight', 
                style: { textAnchor: 'middle', fontSize: '0.7rem', fill: `hsl(var(${config.color}))` },
                dx: config.orientation === 'left' ? -10 : (yAxisConfigs.filter(c => c.orientation === 'right').length > 1 ? 5 : 10) + yAxisOffset(index, 'right'), // Offset for multiple right axes
                dy: 0,
              }}
              width={40} // Give Y-axes a bit more width for labels
              dx={config.orientation === 'left' ? yAxisOffset(index, 'left') : 0}
            />
          )) : ( // Fallback to a single default Y-axis if no configs are provided
             <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.6rem' }}>
                <RechartsLabel
                value="Value"
                angle={-90}
                position="insideLeft"
                style={{ textAnchor: 'middle', fontSize: '0.7rem' }}
                fill="hsl(var(--foreground))"
                dx={-10}
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
            wrapperStyle={{ paddingTop: '8px', fontSize: '0.6rem', paddingBottom: '5px' }} 
          />
          {activeSeriesToPlot.map((seriesName, index) => {
            const yAxisConfigForSeries = yAxisConfigs.find(c => c.dataKey === seriesName);
            return (
                <Line
                key={seriesName}
                type="monotone"
                dataKey={seriesName}
                stroke={`hsl(var(${yAxisConfigForSeries ? yAxisConfigForSeries.color : chartColors[index % chartColors.length]}))`}
                strokeWidth={1.5}
                dot={false}
                name={seriesName.charAt(0).toUpperCase() + seriesName.slice(1)} // Capitalize for legend
                connectNulls={true}
                yAxisId={yAxisConfigForSeries ? yAxisConfigForSeries.id : (yAxisConfigs[0]?.id || 0)} 
                />
            );
           })}
          <Brush
            dataKey="time"
            height={11} 
            stroke="hsl(var(--primary))"
            fill="transparent" 
            // fillOpacity={0.3} // Removed for full transparency
            tickFormatter={(tick) => formatXAxisTick(tick, chartData)}
            travellerWidth={8}
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={onBrushChange}
            // y={chartHeightToUse - 40} // Example positioning, adjust as needed
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
