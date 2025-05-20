
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

export function ChartDisplay({ data, plottableSeries, timeAxisLabel, currentFileName }: ChartDisplayProps) {
  
  // Data is assumed to have numeric values for plottableSeries where possible,
  // as DataUploadForm attempts conversion. Recharts will handle non-numeric values by not plotting them for that point.
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0 || plottableSeries.length === 0) {
      return [];
    }
    // Map data to ensure only plottable series are included in each point for the chart
    // and that 'time' is present.
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      plottableSeries.forEach(seriesName => {
        // Pass through the value as is; numeric conversion was attempted upstream.
        newPoint[seriesName] = point[seriesName]; 
      });
      return newPoint;
    });
  }, [data, plottableSeries]);

  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!data || data.length === 0 || plottableSeries.length === 0) return false;
    // Check if at least one of the plottable series has at least one numeric data point.
    return plottableSeries.some(seriesName => 
      data.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [data, plottableSeries]);


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
              bottom: 50, 
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--foreground))" angle={0} textAnchor="middle" height={60} interval="preserveStartEnd">
              {timeAxisLabel && (
                <Label value={timeAxisLabel} offset={10} position="insideBottom" fill="hsl(var(--foreground))" dy={10} />
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
                stroke={`hsl(var(${chartColors[index % chartColors.length]}))` /* Cycle through colors */}
                strokeWidth={2}
                dot={false} 
                name={seriesName}
                connectNulls={true} // Connect lines even if there are null/NaN values in between
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

    