
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
  [key: string]: string | number | undefined; // Allow undefined for potentially missing series
}

interface ChartDisplayProps {
  data: DataPoint[];
  selectedSeries: string | undefined;
  timeAxisLabel: string | undefined;
  currentFileName?: string;
}

export function ChartDisplay({ data, selectedSeries, timeAxisLabel, currentFileName }: ChartDisplayProps) {
  
  const chartData = React.useMemo(() => {
    if (!selectedSeries || data.length === 0) return [];
    
    // 1. Map to ensure the selectedSeries key exists and attempt conversion
    const mappedData = data.map(point => {
      const rawValue = point[selectedSeries];
      let numericValue = NaN;
      if (rawValue !== undefined && rawValue !== null) {
        if (typeof rawValue === 'string') {
          numericValue = parseFloat(rawValue);
        } else if (typeof rawValue === 'number') {
          numericValue = rawValue;
        }
      }
      return {
        ...point,
        [selectedSeries]: numericValue, 
      };
    });

    // 2. Filter out points where the selectedSeries value is not a valid number
    return mappedData.filter(point => {
      const value = point[selectedSeries];
      return typeof value === 'number' && !isNaN(value);
    });

  }, [data, selectedSeries]);

  if (data.length === 0) {
    return (
      <Card className="h-full flex flex-col">
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

  if (!selectedSeries) {
    return (
      <Card className="h-full flex flex-col">
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
            <p>Please select a variable to plot from the controls on the left.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (chartData.length === 0 && selectedSeries) {
     return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <LineChartIcon className="h-6 w-6" /> Data Visualization
          </CardTitle>
          <CardDescription>
            Displaying data for "{selectedSeries}" from "{currentFileName}".
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Info className="h-16 w-16 mx-auto mb-4" />
            <p>No valid numeric data found for the selected series: "{selectedSeries}".</p>
            <p className="text-sm mt-1">This can happen if the column contains non-numeric text, is empty, or all values are missing for this series.</p>
            <p className="text-sm mt-1">Please check the column in your CSV file or select a different variable.</p>
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
          Time Series Plot: {selectedSeries}
        </CardTitle>
        <CardDescription>
          Visualizing "{selectedSeries}" from file "{currentFileName}" ({chartData.length} valid data points).
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
            <XAxis dataKey="time" stroke="hsl(var(--foreground))" angle={-30} textAnchor="end" height={60}>
              {timeAxisLabel && (
                <Label value={timeAxisLabel} offset={10} position="insideBottom" fill="hsl(var(--foreground))" dy={10} />
              )}
            </XAxis>
            <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']}>
              <Label value={selectedSeries} angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="hsl(var(--foreground))" />
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
            <Line
              type="monotone"
              dataKey={selectedSeries}
              stroke="hsl(var(--chart-1))" 
              strokeWidth={2}
              dot={false} // Removed dots
              name={selectedSeries}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
