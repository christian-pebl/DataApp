
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
  plotTitle?: string;
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

const formatXAxisTick = (timeValue: string | number): string => {
  try {
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) {
      // If not a valid date, try to parse as YYYY-MM-DD string and extract YY-MM-DD
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timeValue)) {
        const year = timeValue.substring(2, 4);
        const month = timeValue.substring(5, 7);
        const day = timeValue.substring(8, 10);
        return `${year}-${month}-${day}`;
      }
      return String(timeValue); // Fallback to original string if not a date and not YYYY-MM-DD
    }
    // Format valid date as YY-MM-DD
    const year = date.getFullYear().toString().slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback for any other error during date parsing/formatting
    return String(timeValue);
  }
};

export function ChartDisplay({ data, plottableSeries, timeAxisLabel, currentFileName, plotTitle = "Time Series Plot" }: ChartDisplayProps) {

  // Prepare data for Recharts: ensure numeric values for plottable series
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time }; // Keep time as is
      // Convert selected series values to numbers, or keep as string if not convertible
      Object.keys(point).forEach(key => {
        if (key !== 'time') { // Don't process the time key itself for numeric conversion
          const value = point[key];
          if (typeof value === 'string') {
            const num = parseFloat(value.replace(/,/g, '')); // Remove commas for thousands
            newPoint[key] = isNaN(num) ? value : num; // Store as number if valid, else original string
          } else {
            newPoint[key] = value; // Already a number or undefined
          }
        }
      });
      return newPoint;
    });
  }, [data]);

  // Check if there's any valid numeric data for any of the selected plottable series
  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    return plottableSeries.some(seriesName =>
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);


  if (!data || data.length === 0) {
    return (
      <Card className="flex flex-col"> {/* Min height for empty state cards */}
        <CardHeader className="p-2">
          <CardTitle className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <LineChartIcon className="h-4 w-4" /> {plotTitle}
          </CardTitle>
          <CardDescription className="text-xs">Upload a CSV file to visualize your data.</CardDescription>
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

  if (plottableSeries.length === 0) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="p-2">
          <CardTitle className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <LineChartIcon className="h-4 w-4" /> {plotTitle}
          </CardTitle>
          <CardDescription className="text-xs">
            Data from "{currentFileName}" is loaded ({data.length} rows).
          </CardDescription>
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

  if (!hasAnyNumericDataForSelectedSeries && plottableSeries.length > 0) {
     return (
      <Card className="flex flex-col">
        <CardHeader className="p-2">
          <CardTitle className="flex items-center gap-1.5 text-muted-foreground text-sm">
            <LineChartIcon className="h-4 w-4" /> {plotTitle}
          </CardTitle>
          <CardDescription className="text-xs">
            Displaying data for selected series from "{currentFileName}".
          </CardDescription>
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

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <LineChartIcon className="h-4 w-4 text-primary" />
          {plotTitle}
        </CardTitle>
        <CardDescription className="text-xs">
          {currentFileName ? `Visualizing data from "${currentFileName}"` : "Visualizing uploaded data"} ({chartData.length} data points prepared for chart).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-1 p-2">
        <ResponsiveContainer width="100%" height={350}> {/* Reduced height by 30% (500 * 0.7 = 350) */}
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 15, 
              left: 5,  
              bottom: 130, 
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
                  value={timeAxisLabel ? `${timeAxisLabel} (Adjust time window with slider)` : "Time (Adjust time window with slider)"}
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
              height={20} 
              stroke="hsl(var(--primary))"
              fill="hsl(var(--muted))" 
              tickFormatter={formatXAxisTick}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

