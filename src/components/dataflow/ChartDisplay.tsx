
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, LineChart as LineChartIcon } from "lucide-react";

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
    // Check if the date is invalid
    if (isNaN(date.getTime())) {
      // If it's a string that looks like a date start (YYYY-MM-DD), try to format part of it
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timeValue)) {
        const year = timeValue.substring(2, 4); // YY
        const month = timeValue.substring(5, 7); // MM
        const day = timeValue.substring(8, 10); // DD
        return `${year}-${month}-${day}`;
      }
      return String(timeValue); // Fallback to string if not a valid date or parsable format
    }
    // If it's a valid date, format it
    const year = date.getFullYear().toString().slice(-2); // YY
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // MM
    const day = ('0' + date.getDate()).slice(-2); // DD
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback for any other error during date parsing/formatting
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
    // Attempt to convert plottable series values to numbers
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      Object.keys(point).forEach(key => {
        if (key !== 'time') { // Process only variable columns
          const value = point[key];
          if (typeof value === 'string') {
            const num = parseFloat(value.replace(/,/g, '')); // Remove commas for thousands
            newPoint[key] = isNaN(num) ? value : num; // Store as number if parsable, else keep original (Recharts might handle some strings)
          } else {
            newPoint[key] = value; // Already a number or undefined
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
  
  const chartContainerHeight = 350; // Base height for the chart rendering area
  const clippedHeight = chartContainerHeight * 0.75; // Permanent 25% clip from bottom

  const wrapperStyle = {
    height: `${clippedHeight}px`, // Apply the 75% height
    overflow: 'hidden', // This will clip the bottom 25%
  };

  const chartBottomMargin = 100; // Fixed bottom margin for X-axis, its label, and Brush

  // Message for no data
  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col h-fit">
        <CardHeader className="p-2"> 
          <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground"> 
            <LineChartIcon className="h-4 w-4" /> {plotTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-2">
          <div className="text-center text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-1.5" />
            <p className="text-xs">No data loaded. Upload a file to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Message if no series are selected to be plotted
  if (plottableSeries.length === 0) {
    return (
      <Card className="flex flex-col h-fit">
        <CardHeader className="p-2"> 
          <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground"> 
            <LineChartIcon className="h-4 w-4" /> {plotTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-2">
          <div className="text-center text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-1.5" />
            <p className="text-xs">Please select at least one variable to plot using the checkboxes.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Message if selected series have no numeric data
  if (!hasAnyNumericDataForSelectedSeries && plottableSeries.length > 0) {
     return (
      <Card className="flex flex-col h-fit">
        <CardHeader className="p-2"> 
          <CardTitle className="flex items-center gap-1.5 text-sm text-muted-foreground"> 
            <LineChartIcon className="h-4 w-4" /> {plotTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center p-2">
          <div className="text-center text-muted-foreground">
            <Info className="h-10 w-10 mx-auto mb-1.5" />
            <p className="text-xs">No valid numeric data found for the currently selected series: "{plottableSeries.join(', ')}".</p>
            <p className="text-2xs mt-1">This can happen if the selected columns contain non-numeric text, are empty, or all values were treated as missing data.</p>
            <p className="text-2xs mt-1">Please check the columns in your CSV file or select different variables.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Main chart rendering
  return (
    <Card className="flex flex-col h-fit"> {/* Ensure card shrinks to content */}
      <CardHeader className="p-2"> {/* Reduced padding */}
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <LineChartIcon className="h-4 w-4 text-primary" /> {/* Reduced icon and text size */}
          {plotTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1 flex-shrink-0"> {/* Reduced padding, ensure it doesn't grow unnecessarily */}
        <div style={wrapperStyle}> {/* This div applies the clipping */}
          <ResponsiveContainer width="100%" height={chartContainerHeight}> {/* Chart renders at full size, then gets clipped */}
            <LineChart
              data={chartData}
              margin={{
                top: 5,
                right: 15, // Reduced right margin
                left: 5,   // Reduced left margin
                bottom: chartBottomMargin, // Use fixed bottom margin
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--foreground))"
                angle={-45}
                textAnchor="end"
                height={60} // Height for angled labels
                interval="preserveStartEnd"
                tickFormatter={formatXAxisTick}
                tick={{ fontSize: '0.75em' }} // Reduced tick font size
              >
                {timeAxisLabel && (
                  <Label
                    value={`${timeAxisLabel} (Adjust time window with slider)`}
                    offset={10} // Adjusted offset
                    position="insideBottom"
                    fill="hsl(var(--muted-foreground))"
                    dy={30} // Position label above Brush
                    style={{ fontSize: '0.75em', textAnchor: 'middle' }} // Reduced label font size
                  />
                )}
              </XAxis>
              <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.75em' }}>
                <Label
                  value="Value"
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: 'middle', fontSize: '0.75em' }} // Reduced label font size
                  fill="hsl(var(--foreground))"
                  dx={-5} // Adjusted position
                />
              </YAxis>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  fontSize: '0.75em', // Reduced tooltip font size
                }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
              />
              <Legend wrapperStyle={{ paddingTop: "15px", fontSize: '0.75em' }} /> {/* Reduced legend font size */}
              {plottableSeries.map((seriesName, index) => (
                <Line
                  key={seriesName}
                  type="monotone"
                  dataKey={seriesName}
                  stroke={`hsl(var(${chartColors[index % chartColors.length]}))`}
                  strokeWidth={1.5}
                  dot={false} // No dots on lines
                  name={seriesName}
                  connectNulls={true}
                />
              ))}
              <Brush
                dataKey="time"
                height={14} // Slightly taller Brush bar
                stroke="hsl(var(--primary))"
                fill="hsl(var(--muted))"
                fillOpacity={0.3} // More transparent fill
                tickFormatter={formatXAxisTick}
                travellerWidth={10} // Slimmer handles
                // Removed explicit y prop
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

