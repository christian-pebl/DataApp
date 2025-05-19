
"use client";

import React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info, BarChartHorizontalBig } from "lucide-react";

interface DataPoint {
  time: string | number;
  [key: string]: number | string; // Allow string for time, number for series values after parsing
}

interface ChartDisplayProps {
  data: DataPoint[];
  chartType: "line" | "bar" | "scatter" | string;
  selectedSeries: string | undefined;
  fileName?: string;
  timeAxisLabel?: string;
}

const ChartDisplay: React.FC<ChartDisplayProps> = ({ data, chartType, selectedSeries, fileName, timeAxisLabel }) => {
  console.log("ChartDisplay: Props received", { data, chartType, selectedSeries, fileName, timeAxisLabel });

  const baseChartTitle = fileName ? `${fileName.split('.')[0]}` : "Data Visualization";
  const chartTitle = selectedSeries ? `${selectedSeries} from ${baseChartTitle}` : baseChartTitle;

  if (!data || data.length === 0) {
    console.log("ChartDisplay: No data to display.");
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
             <Info className="h-6 w-6" /> {chartTitle}
          </CardTitle>
          <CardDescription>No data to display. Upload a file to get started.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4" />
            <p>Upload data using the controls on the left.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedSeries) {
    console.log("ChartDisplay: Data loaded, but no series selected.");
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
             <Info className="h-6 w-6" /> {chartTitle}
          </CardTitle>
          <CardDescription>Data loaded. Please select a series to visualize.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <BarChartHorizontalBig className="h-16 w-16 mx-auto mb-4" />
            <p>Choose a data series from the selector on the left.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Ensure data for the selected series is numeric. Recharts expects numbers for the Y-axis.
  const chartData = data.map(point => ({
    ...point,
    [selectedSeries]: typeof point[selectedSeries] === 'string' ? parseFloat(point[selectedSeries] as string) : point[selectedSeries]
  })).filter(point => typeof point[selectedSeries] === 'number' && !isNaN(point[selectedSeries] as number));
  
  console.log(`ChartDisplay: Processed chartData for series "${selectedSeries}":`, chartData);

  if (chartData.length === 0) {
    console.log(`ChartDisplay: No valid numeric data found for selected series "${selectedSeries}".`);
     return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-destructive" /> Error
          </CardTitle>
          <CardDescription>
            No valid numeric data points found for the selected series: "{selectedSeries}".
            Please check if this column contains numbers in your CSV file.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex items-center justify-center">
            <p className="text-muted-foreground">Try selecting a different series or check your file.</p>
        </CardContent>
      </Card>
    );
  }


  const renderChart = () => {
    const chartProps = {
      data: chartData,
      margin: { top: 5, right: 20, left: 20, bottom: 20 },
    };

    const commonComponents = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="time" label={{ value: timeAxisLabel || "Time", position: 'insideBottom', offset: -10, fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
        <YAxis label={{ value: selectedSeries, angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12, dx: -10 }} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Legend wrapperStyle={{ color: 'hsl(var(--foreground))', paddingTop: '10px' }} />
      </>
    );

    const dataKeyValue = selectedSeries; 

    switch (chartType) {
      case "line":
        return (
          <LineChart {...chartProps}>
            {commonComponents}
            <Line type="monotone" dataKey={dataKeyValue} name={selectedSeries} stroke="#8884d8" strokeWidth={2} dot={{ r: 3, fill: '#8884d8' }} activeDot={{ r: 6 }} />
          </LineChart>
        );
      case "bar":
        return (
          <BarChart {...chartProps}>
            {commonComponents}
            <Bar dataKey={dataKeyValue} name={selectedSeries} fill="#82ca9d" stroke="hsl(var(--foreground))"/>
          </BarChart>
        );
      case "scatter":
        return (
          <ScatterChart {...chartProps}>
            {commonComponents}
            <Scatter name={selectedSeries} dataKey={dataKeyValue} fill="#ffc658" />
          </ScatterChart>
        );
      default:
        console.error("ChartDisplay: Unknown chart type selected:", chartType);
        return <p>Unknown chart type selected.</p>;
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{chartTitle}</CardTitle>
        <CardDescription>Displaying '{selectedSeries}' as a {chartType} chart.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-4 pb-8">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

ChartDisplay.displayName = "ChartDisplay";
export default ChartDisplay;
