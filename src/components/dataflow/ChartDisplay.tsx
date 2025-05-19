
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
  Brush,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Info } from "lucide-react";

interface DataPoint {
  time: string | number;
  value: number;
  [key: string]: any;
}

interface ChartDisplayProps {
  data: DataPoint[];
  chartType: "line" | "bar" | "scatter" | string;
  fileName?: string;
}

export interface ChartDisplayHandle {
  getSvgRef: () => React.RefObject<SVGSVGElement | null>;
}

const ChartDisplay = forwardRef<ChartDisplayHandle, ChartDisplayProps>(({ data, chartType, fileName }, ref) => {
  const internalSvgRef = useRef<SVGSVGElement | null>(null);

  useImperativeHandle(ref, () => ({
    getSvgRef: () => internalSvgRef,
  }));
  
  const chartTitle = fileName ? `Chart: ${fileName.split('.')[0]}` : "Data Visualization";

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

  // Ensure data is sorted by time for line and bar charts if time is numeric or parsable as date
  const sortedData = [...data].sort((a, b) => {
    const timeA = new Date(a.time).getTime();
    const timeB = new Date(b.time).getTime();
    if (!isNaN(timeA) && !isNaN(timeB)) {
      return timeA - timeB;
    }
    if (typeof a.time === 'string' && typeof b.time === 'string') {
      return a.time.localeCompare(b.time);
    }
    if (typeof a.time === 'number' && typeof b.time === 'number') {
      return a.time - b.time;
    }
    return 0;
  });
  
  const renderChart = () => {
    const chartProps = {
      data: sortedData,
      margin: { top: 5, right: 30, left: 20, bottom: 50 }, // Increased bottom margin for Brush
    };

    const commonComponents = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="time" 
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
          stroke="hsl(var(--border))"
          angle={-30}
          textAnchor="end"
          height={60} // Adjust height to accommodate angled labels
          interval="preserveStartEnd" // Show first and last tick, auto for others
        />
        <YAxis 
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
          stroke="hsl(var(--border))"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          itemStyle={{ color: 'hsl(var(--primary))' }}
        />
        <Legend wrapperStyle={{ color: 'hsl(var(--foreground))', paddingTop: '10px' }} />
        <Brush 
            dataKey="time" 
            height={30} 
            stroke="hsl(var(--primary))" 
            fill="hsl(var(--background))"
            travellerWidth={10}
            y={undefined} // Let Recharts position it
            />
      </>
    );

    switch (chartType) {
      case "line":
        return (
          <LineChart {...chartProps} ref={internalSvgRef as any /* Recharts types can be tricky with refs */}>
            {commonComponents}
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--primary))' }} activeDot={{ r: 6 }} />
          </LineChart>
        );
      case "bar":
        return (
          <BarChart {...chartProps} ref={internalSvgRef as any}>
            {commonComponents}
            <Bar dataKey="value" fill="hsl(var(--accent))" />
          </BarChart>
        );
      case "scatter":
        return (
          <ScatterChart {...chartProps} ref={internalSvgRef as any}>
            {commonComponents}
            <Scatter name="Data Points" dataKey="value" fill="hsl(var(--primary))" />
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
        <CardDescription>Interactive time series visualization</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-4 pb-8"> {/* Added padding for aesthetics */}
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
});

ChartDisplay.displayName = "ChartDisplay";
export default ChartDisplay;

