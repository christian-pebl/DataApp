
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
  plottableSeries: string[]; // Array of series names to plot
  timeAxisLabel: string | undefined;
  currentFileName?: string;
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

export function ChartDisplay({ data, plottableSeries, timeAxisLabel, currentFileName }: ChartDisplayProps) {
  
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0 || plottableSeries.length === 0) {
      return [];
    }
    
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      plottableSeries.forEach(seriesName => {
        const rawValue = point[seriesName];
        let numericValue = NaN;
        if (rawValue !== undefined && rawValue !== null) {
          if (typeof rawValue === 'string') {
            const cleanedValue = rawValue.replace(/[^0-9.-]/g, '');
            if (cleanedValue !== "") {
              numericValue = parseFloat(cleanedValue);
            }
          } else if (typeof rawValue === 'number') {
            numericValue = rawValue;
          }
        }
        newPoint[seriesName] = numericValue;
      });
      return newPoint;
    }).filter(point => plottableSeries.some(seriesName => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName]))));
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
  
  if (chartData.length === 0 && plottableSeries.length > 0) {
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
            <p>No valid numeric data found for the selected series: "{plottableSeries.join(', ')}".</p>
            <p className="text-sm mt-1">This can happen if the selected columns contain non-numeric text, are empty, or all values were converted to Not-a-Number (NaN) after attempting to clean them.</p>
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
          {currentFileName ? `Visualizing data from "${currentFileName}"` : "Visualizing uploaded data"} ({chartData.length} valid data points shown).
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
                stroke={`hsl(var(${chartColors[index % chartColors.length]}))`}
                strokeWidth={2}
                dot={false} 
                name={seriesName}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
