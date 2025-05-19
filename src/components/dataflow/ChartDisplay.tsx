
"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";
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
  [key: string]: string | number;
}

interface ChartDisplayProps {
  data: DataPoint[];
  chartType: "line" | "bar" | "scatter" | string;
  selectedSeries: string | undefined;
  fileName?: string;
  timeAxisLabel?: string;
}

export interface ChartDisplayHandle {
  getSvgRef: () => React.RefObject<SVGSVGElement | null>;
}

const ChartDisplay = forwardRef<ChartDisplayHandle, ChartDisplayProps>(({ data, chartType, selectedSeries, fileName, timeAxisLabel }, ref) => {
  const internalSvgRef = useRef<SVGSVGElement | null>(null);

  useImperativeHandle(ref, () => ({
    getSvgRef: () => internalSvgRef,
  }));

  const baseChartTitle = fileName ? `${fileName.split('.')[0]}` : "Data Visualization";
  const chartTitle = selectedSeries ? `${selectedSeries} from ${baseChartTitle}` : baseChartTitle;

  if (!data || data.length === 0) {
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

  // Using data directly without custom sorting for simplification
  const chartData = data;

  const renderChart = () => {
    const chartProps = {
      data: chartData,
      // Simplified margins
      margin: { top: 5, right: 30, left: 20, bottom: 30 }, 
    };

    const commonComponents = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          stroke="hsl(var(--border))"
          interval="preserveStartEnd" // Keep this to avoid too many ticks
          // Simplified X-axis label, can be removed if still problematic
          label={{ value: timeAxisLabel || "Time", position: 'insideBottom', offset: -15, fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
        />
        <YAxis
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          stroke="hsl(var(--border))"
          // Simplified Y-axis label
          label={selectedSeries ? { value: selectedSeries, angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12, dx: -10 } : undefined}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Legend wrapperStyle={{ color: 'hsl(var(--foreground))', paddingTop: '10px' }} />
        {/* Brush component removed for simplification */}
      </>
    );

    const dataKeyValue = selectedSeries; 

    switch (chartType) {
      case "line":
        return (
          <LineChart {...chartProps} ref={internalSvgRef as any}>
            {commonComponents}
            <Line type="monotone" dataKey={dataKeyValue} name={selectedSeries} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
          </LineChart>
        );
      case "bar":
        return (
          <BarChart {...chartProps} ref={internalSvgRef as any}>
            {commonComponents}
            <Bar dataKey={dataKeyValue} name={selectedSeries} fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" />
          </BarChart>
        );
      case "scatter":
        return (
          <ScatterChart {...chartProps} ref={internalSvgRef as any}>
            {commonComponents}
            <Scatter name={selectedSeries} dataKey={dataKeyValue} fill="hsl(var(--primary))" />
          </ScatterChart>
        );
      default:
        return <p>Unknown chart type selected.</p>;
    }
  };

  return (
    <Card className="h-full flex flex-col shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{chartTitle}</CardTitle>
        <CardDescription>Interactive time series visualization for '{selectedSeries}'</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-4 pb-8"> {/* Ensure CardContent allows growth */}
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

ChartDisplay.displayName = "ChartDisplay";
export default ChartDisplay;
