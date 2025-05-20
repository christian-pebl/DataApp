
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
  
  // console.log("[ChartDisplay] Props received:", { data, selectedSeries, timeAxisLabel, currentFileName });

  const chartData = React.useMemo(() => {
    if (!selectedSeries || !data || data.length === 0) {
      // console.log("[ChartDisplay] No selected series or no data, returning empty for chartData.");
      return [];
    }
    
    const mappedData = data.map(point => {
      const rawValue = point[selectedSeries];
      let numericValue = NaN;
      if (rawValue !== undefined && rawValue !== null) {
        if (typeof rawValue === 'string') {
          const cleanedValue = rawValue.replace(/,/g, ''); // Remove thousands separators
          numericValue = parseFloat(cleanedValue);
        } else if (typeof rawValue === 'number') {
          numericValue = rawValue;
        }
      }
      return {
        ...point, // This ensures the 'time' field and other series data are preserved
        [selectedSeries]: numericValue, // The selected series is now explicitly numeric or NaN
      };
    });

    const filteredData = mappedData.filter(point => {
      const value = point[selectedSeries];
      return typeof value === 'number' && !isNaN(value);
    });
    
    // console.log(`[ChartDisplay] Processing series: "${selectedSeries}". Original points: ${data.length}. Mapped points: ${mappedData.length}. Filtered numeric points: ${filteredData.length}`);
    // if (filteredData.length > 0) {
    //   console.log("[ChartDisplay] First 3 filtered data points for chart:", filteredData.slice(0, 3).map(p => ({ time: p.time, [selectedSeries]: p[selectedSeries] })));
    // } else if (mappedData.length > 0) {
    //   console.log("[ChartDisplay] First 3 mapped data points (before filtering for NaN):", mappedData.slice(0,3).map(p => ({ time: p.time, [selectedSeries]: p[selectedSeries] })));
    // }


    return filteredData;

  }, [data, selectedSeries]);

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

  if (!selectedSeries) {
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
            <p>Please select a variable to plot from the controls on the left.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (chartData.length === 0 && selectedSeries) {
     return (
      <Card className="h-[600px] flex flex-col">
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
            <p className="text-sm mt-1">This can happen if the column contains non-numeric text, is empty, or all values were converted to Not-a-Number (NaN).</p>
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
          {/* The X-axis uses the '${timeAxisLabel}' column. The Y-axis displays '${selectedSeries}'. */}
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
            {/* X-axis explicitly uses the 'time' dataKey, which is populated from the first CSV column */}
            <XAxis dataKey="time" stroke="hsl(var(--foreground))" angle={-30} textAnchor="end" height={60}>
              {timeAxisLabel && (
                <Label value={timeAxisLabel} offset={10} position="insideBottom" fill="hsl(var(--foreground))" dy={10} />
              )}
            </XAxis>
            {/* Y-axis domain is auto-calculated. Label uses the selectedSeries name. */}
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
            {/* Line component uses selectedSeries as its dataKey, plotting data from the chosen CSV column */}
            <Line
              type="monotone"
              dataKey={selectedSeries} 
              stroke="hsl(var(--chart-1))" 
              strokeWidth={2}
              dot={false} 
              name={selectedSeries}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
