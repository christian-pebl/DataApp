
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
  Brush, // Added Brush
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
}

// Define a list of distinct colors for the lines from the theme
const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

const formatXAxisTick = (timeValue: string | number): string => {
  try {
    // Assuming timeValue is a string like "2024-06-06 00:00:00+00:00"
    // or any other format that new Date() can parse.
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) { // Check if date is invalid
      // If it's a string that might be just 'YYYY-MM-DD', try to extract YY-MM-DD
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timeValue)) {
        const year = timeValue.substring(2, 4); // YY
        const month = timeValue.substring(5, 7); // MM
        const day = timeValue.substring(8, 10); // DD
        return `${year}-${month}-${day}`;
      }
      return String(timeValue); // Fallback for unparsable items
    }
    const year = date.getFullYear().toString().slice(-2); // YY
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // MM (0-indexed)
    const day = ('0' + date.getDate()).slice(-2); // DD
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback for any unexpected error during formatting
    return String(timeValue); 
  }
};


export function ChartDisplay({ data, plottableSeries, timeAxisLabel, currentFileName }: ChartDisplayProps) {
  
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


  if (!data || data.length === 0) {
    return (
      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <LineChartIcon className="h-6 w-6" /> Data Visualization
          </CardTitle>
          <CardDescription>Upload a CSV file to visualize your data.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Info className="h-16 w-16 mx-auto mb-4" />
            <p>No data loaded. Upload a file to get started.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (plottableSeries.length === 0) {
    return (
      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <LineChartIcon className="h-6 w-6" /> Data Visualization
          </CardTitle>
          <CardDescription>
            Data from "{currentFileName}" is loaded ({data.length} rows).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Info className="h-16 w-16 mx-auto mb-4" />
            <p>Please select at least one variable to plot using the checkboxes on the left.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!hasAnyNumericDataForSelectedSeries && plottableSeries.length > 0) {
     return (
      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <LineChartIcon className="h-6 w-6" /> Data Visualization
          </CardTitle>
          <CardDescription>
            Displaying data for selected series from "{currentFileName}".
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Info className="h-16 w-16 mx-auto mb-4" />
            <p>No valid numeric data found for the currently selected series: "{plottableSeries.join(', ')}".</p>
            <p className="text-sm mt-1">This can happen if the selected columns contain non-numeric text, are empty, or all values were treated as missing data.</p>
            <p className="text-sm mt-1">Please check the columns in your CSV file or select different variables.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChartIcon className="h-6 w-6 text-primary" />
          Time Series Plot
        </CardTitle>
        <CardDescription>
          {currentFileName ? `Visualizing data from "${currentFileName}"` : "Visualizing uploaded data"} ({chartData.length} data points prepared for chart).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 110, // Increased margin for angled X-axis labels, axis title, and Brush
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="time" 
              stroke="hsl(var(--foreground))" 
              angle={-45} // Angle the labels
              textAnchor="end" // Anchor for angled labels
              height={60} // Allocate space for angled labels
              interval="preserveStartEnd" // Smart tick display
              tickFormatter={formatXAxisTick} // Custom tick formatting
            >
              {timeAxisLabel && (
                <Label 
                  value={timeAxisLabel} 
                  offset={10} 
                  position="insideBottom" 
                  fill="hsl(var(--foreground))" 
                  dy={55} // Adjusted dy to position label below angled ticks and above brush
                />
              )}
            </XAxis>
            <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']}>
              <Label value="Value" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="hsl(var(--foreground))" />
            </YAxis>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                borderColor: "hsl(var(--border))",
                color: "hsl(var(--foreground))",
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
              cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            {plottableSeries.map((seriesName, index) => (
              <Line
                key={seriesName}
                type="monotone"
                dataKey={seriesName} 
                stroke={`hsl(var(${chartColors[index % chartColors.length]}))`}
                strokeWidth={2}
                dot={false} 
                name={seriesName}
                connectNulls={true} 
              />
            ))}
            <Brush 
              dataKey="time" 
              height={30} 
              stroke="hsl(var(--primary))"
              tickFormatter={formatXAxisTick} // Use the same formatter for Brush ticks
              y={510} // Position brush: 600 (card height) - CardHeader - CardContent padding - Brush height - margin.
                       // This needs fine-tuning, or better, let Recharts manage its position relative to XAxis.
                       // Removing explicit y, let margin handle it.
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
