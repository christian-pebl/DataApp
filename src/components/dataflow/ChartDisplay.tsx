
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
  [key: string]: string | number;
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
    return data.map(point => ({
      ...point,
      [selectedSeries]: typeof point[selectedSeries] === 'string' ? parseFloat(point[selectedSeries] as string) : point[selectedSeries],
    })).filter(point => point[selectedSeries] !== null && !isNaN(Number(point[selectedSeries])));
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
            <p className="text-sm mt-1">Please check the column in your CSV file or select a different variable.</p>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="h-[600px] flex flex-col"> {/* Increased height */}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChartIcon className="h-6 w-6 text-primary" />
          Time Series Plot: {selectedSeries}
        </CardTitle>
        <CardDescription>
          Visualizing "{selectedSeries}" from file "{currentFileName}" ({chartData.length} valid data points).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2"> {/* Added padding top */}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 50, // Increased bottom margin for X-axis label
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--foreground))" angle={-30} textAnchor="end" height={60}>
              {timeAxisLabel && (
                <Label value={timeAxisLabel} offset={10} position="insideBottom" fill="hsl(var(--foreground))" dy={10} />
              )}
            </XAxis>
            <YAxis stroke="hsl(var(--foreground))">
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
              stroke="hsl(var(--chart-1))" // Use theme color for line
              strokeWidth={2}
              dot={{ r: 3, fill: "hsl(var(--chart-1))" }}
              activeDot={{ r: 6, stroke: "hsl(var(--background))", strokeWidth: 2, fill: "hsl(var(--chart-1))" }}
              name={selectedSeries}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

    