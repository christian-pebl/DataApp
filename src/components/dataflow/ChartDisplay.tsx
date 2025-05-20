
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

  // For debugging Brush visibility
  console.log("ChartDisplay: chartData length:", chartData.length);
  if (chartData.length > 0) {
    console.log("ChartDisplay: first chartData point:", chartData[0]);
  }
  console.log("ChartDisplay: plottableSeries:", plottableSeries);


  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    return plottableSeries.some(seriesName => 
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);


  if (!data || data.length === 0) {
    return (
      <Card className="h-[650px] flex flex-col"> {/* Increased height */}
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
      <Card className="h-[650px] flex flex-col"> {/* Increased height */}
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
      <Card className="h-[650px] flex flex-col"> {/* Increased height */}
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
    <Card className="h-[650px] flex flex-col"> {/* Increased height */}
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
              bottom: 120, // Increased margin for angled X-axis labels, axis title, and Brush
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
            >
              {timeAxisLabel && (
                <Label 
                  value={timeAxisLabel} 
                  offset={10} 
                  position="insideBottom" 
                  fill="hsl(var(--foreground))" 
                  dy={45} // Adjusted dy
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
              fill="hsl(var(--muted))" // Added fill for visibility
              tickFormatter={formatXAxisTick} 
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
