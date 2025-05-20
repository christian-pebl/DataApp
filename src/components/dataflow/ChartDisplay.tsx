
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
import { Card, CardContent } from "@/components/ui/card";
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
  chartRenderHeight?: number;
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

const formatXAxisTick = (timeValue: string | number): string => {
  try {
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) {
      // Attempt to parse YYYY-MM-DD (potentially followed by time)
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timeValue)) {
        const year = timeValue.substring(2, 4); // YY
        const month = timeValue.substring(5, 7); // MM
        const day = timeValue.substring(8, 10); // DD
        return `${year}-${month}-${day}`;
      }
      return String(timeValue); // Fallback for non-standard or non-date strings
    }
    // If it's a valid date object
    const year = date.getFullYear().toString().slice(-2); // YY
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // MM
    const day = ('0' + date.getDate()).slice(-2); // DD
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(timeValue); // Fallback if any error occurs during formatting
  }
};

export function ChartDisplay({
  data,
  plottableSeries,
  timeAxisLabel,
  currentFileName,
  plotTitle = "Time Series Plot", // Default title if not provided
  chartRenderHeight = 350, // Default height if not provided
}: ChartDisplayProps) {

  // Memoize processed chart data to prevent re-computation on every render
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    // Ensure numeric values for plotting, convert strings if possible
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      Object.keys(point).forEach(key => {
        if (key !== 'time') {
          const value = point[key];
          if (typeof value === 'string') {
            const num = parseFloat(value.replace(/,/g, '')); // Remove thousands separators
            newPoint[key] = isNaN(num) ? value : num; // Keep as string if not a number
          } else {
            newPoint[key] = value;
          }
        }
      });
      return newPoint;
    });
  }, [data]);

  // Check if there's any valid numeric data for the series selected to be plotted
  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    return plottableSeries.some(seriesName =>
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);

  // Apply clipping to the chart container (wrapper for ResponsiveContainer)
  const clippedHeight = chartRenderHeight * 0.75; // Clip to 75% of the render height

  const wrapperStyle: React.CSSProperties = {
    height: `${clippedHeight}px`,
    overflow: 'hidden',
  };

  // Define bottom margin for the LineChart to accommodate X-axis labels, title, and Brush
  const chartBottomMargin = 120; // Increased bottom margin

  // Display messages for various states (no data, no series selected, no numeric data)
  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col h-fit"> {/* Card adapts to content height */}
        <CardContent className="flex-grow flex items-center justify-center p-2"> {/* Minimal padding */}
          <div className="text-center text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-1.5" /> {/* Icon size */}
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

  // Render the chart
  return (
    <Card className="flex flex-col h-fit"> {/* Card adapts to content height */}
      <CardContent className="p-1 flex-shrink-0"> {/* Minimal padding, prevent growing */}
        <div style={wrapperStyle}> {/* Apply clipping style */}
          <ResponsiveContainer width="100%" height={chartRenderHeight}>
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 15, // Adjusted for better tick label visibility on right
                left: 5,  // Adjusted for better tick label visibility on left
                bottom: chartBottomMargin,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--foreground))"
                angle={-45}
                textAnchor="end"
                height={70} // Increased height for angled labels and title
                interval="preserveStartEnd" // Show start and end ticks, auto-hide others if crowded
                tickFormatter={formatXAxisTick}
                tick={{ fontSize: '0.75em' }} // Reduced tick font size
              >
                {timeAxisLabel && (
                  <Label
                    value={`${timeAxisLabel} (Adjust time window with slider)`}
                    offset={10} // Offset from axis line
                    position="insideBottom"
                    fill="hsl(var(--muted-foreground))"
                    dy={50} // Distance from axis line, increased for more padding
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
                  dx={-5} // Adjusted to prevent overlap with ticks
                />
              </YAxis>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  fontSize: '0.75em', // Smaller tooltip text
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
                  dot={false} // No dots on the line
                  name={seriesName}
                  connectNulls={true} // Connect line over null/NaN values
                />
              ))}
              <Brush
                dataKey="time"
                height={14} // Taller brush bar
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
                fillOpacity={0.3} // More transparent
                tickFormatter={formatXAxisTick}
                travellerWidth={10} // Slimmer handles
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

