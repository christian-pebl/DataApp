
"use client";

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
import { Card, CardContent } from "@/components/ui/card"; // Removed CardHeader, CardTitle
import { Info } from "lucide-react";

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined;
}

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[];
  timeAxisLabel: string | undefined;
  currentFileName?: string;
  plotTitle?: string; 
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

const formatXAxisTick = (timeValue: string | number): string => {
  try {
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
    const year = date.getFullYear().toString().slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(timeValue);
  }
};

export function ChartDisplay({ 
  data, 
  plottableSeries, 
  timeAxisLabel, 
  currentFileName, 
  plotTitle = "Time Series Plot",
}: ChartDisplayProps) {

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
            newPoint[key] = isNaN(num) ? value : num;
          } else {
            newPoint[key] = value;
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
  
  const chartContainerHeight = 350; 
  const clippedHeight = chartContainerHeight * 0.75; 

  const wrapperStyle = {
    height: `${clippedHeight}px`, 
    overflow: 'hidden', 
  };

  const chartBottomMargin = 100; 

  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col h-fit">
        <CardContent className="flex-grow flex items-center justify-center p-2">
          <div className="text-center text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-1.5" />
            <p className="text-xs">No data loaded for {plotTitle}. Upload a file to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (plottableSeries.length === 0) {
    return (
      <Card className="flex flex-col h-fit">
        <CardContent className="flex-grow flex items-center justify-center p-2">
          <div className="text-center text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-1.5" />
            <p className="text-xs">Please select at least one variable to plot for {plotTitle}.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasAnyNumericDataForSelectedSeries && plottableSeries.length > 0) {
     return (
      <Card className="flex flex-col h-fit">
        <CardContent className="flex-grow flex items-center justify-center p-2">
          <div className="text-center text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-1.5" />
            <p className="text-xs">No valid numeric data found for the currently selected series in {plotTitle}: "{plottableSeries.join(', ')}".</p>
            <p className="text-2xs mt-1">This can happen if the selected columns contain non-numeric text, are empty, or all values were treated as missing data.</p>
            <p className="text-2xs mt-1">Please check the columns in your CSV file or select different variables.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-fit"> 
      <CardContent className="p-1 flex-shrink-0"> 
        <div style={wrapperStyle}> 
          <ResponsiveContainer width="100%" height={chartContainerHeight}> 
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 15, 
                left: 5,   
                bottom: chartBottomMargin, 
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
                tickFormatter={formatXAxisTick}
                tick={{ fontSize: '0.75em' }} 
              >
                {timeAxisLabel && (
                  <Label
                    value={`${timeAxisLabel} (Adjust time window with slider)`}
                    offset={10} 
                    position="insideBottom"
                    fill="hsl(var(--muted-foreground))"
                    dy={45} 
                    style={{ fontSize: '0.75em', textAnchor: 'middle' }} 
                  />
                )}
              </XAxis>
              <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.75em' }}>
                <Label
                  value="Value"
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: 'middle', fontSize: '0.75em' }} 
                  fill="hsl(var(--foreground))"
                  dx={-5} 
                />
              </YAxis>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  fontSize: '0.75em', 
                }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
              />
              <Legend wrapperStyle={{ paddingTop: "15px", fontSize: '0.75em' }} /> 
              {plottableSeries.map((seriesName, index) => (
                <Line
                  key={seriesName}
                  type="monotone"
                  dataKey={seriesName}
                  stroke={`hsl(var(${chartColors[index % chartColors.length]}))`}
                  strokeWidth={1.5}
                  dot={false} 
                  name={seriesName}
                  connectNulls={true}
                />
              ))}
              <Brush
                dataKey="time"
                height={14} 
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
                fillOpacity={0.3} 
                tickFormatter={formatXAxisTick}
                travellerWidth={10} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
