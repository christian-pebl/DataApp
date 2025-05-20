
"use client";

import type { CSSProperties } from "react";
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
import { Info } from "lucide-react";

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined;
}

interface ChartDisplayProps {
  data: DataPoint[];
  plottableSeries: string[];
  timeAxisLabel: string | undefined;
  plotTitle?: string;
  chartRenderHeight?: number;
}

const chartColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const INTERNAL_DEFAULT_CHART_HEIGHT = 250; // Default height for the chart rendering area

const formatXAxisTick = (timeValue: string | number): string => {
  try {
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) {
      // If it's not a valid date, try to parse specific string formats or return as is
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timeValue)) {
        // Format "YYYY-MM-DD..." to "YY-MM-DD"
        const year = timeValue.substring(2, 4);
        const month = timeValue.substring(5, 7);
        const day = timeValue.substring(8, 10);
        return `${year}-${month}-${day}`;
      }
      return String(timeValue); // Fallback for other non-date strings
    }
    // If it's a valid date object
    const year = date.getFullYear().toString().slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  } catch (e) {
    // Fallback in case of any error during formatting
    return String(timeValue);
  }
};

export function ChartDisplay({
  data,
  plottableSeries,
  timeAxisLabel,
  plotTitle = "Time Series Plot",
  chartRenderHeight: propChartRenderHeight,
}: ChartDisplayProps) {
  const chartHeightToUse = propChartRenderHeight ?? INTERNAL_DEFAULT_CHART_HEIGHT;
  const clippedHeight = chartHeightToUse * 0.80; // Apply 20% clip from the bottom

  const wrapperStyle: CSSProperties = {
    height: `${clippedHeight}px`,
    overflow: 'hidden',
  };

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
            newPoint[key] = isNaN(num) ? value : num; // Keep as string if not parsable, Recharts handles this for non-numeric series
          } else {
            newPoint[key] = value;
          }
        }
      });
      return newPoint;
    });
  }, [data]);

  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    // Check if at least one selected series has at least one numeric data point
    return plottableSeries.some(seriesName =>
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);


  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-2">
        <div className="text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-1" />
          <p className="text-xs">No data loaded for {plotTitle}. Upload a file.</p>
        </div>
      </div>
    );
  }

  if (plottableSeries.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-2">
        <div className="text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-1" />
          <p className="text-xs">Please select at least one variable to plot for {plotTitle}.</p>
        </div>
      </div>
    );
  }

  if (!hasAnyNumericDataForSelectedSeries && plottableSeries.length > 0) {
     return (
      <div className="flex flex-col h-full items-center justify-center p-2">
        <div className="text-center text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-1" />
          <p className="text-xs">No valid numeric data for selected series in {plotTitle}: "{plottableSeries.join(', ')}".</p>
          <p className="text-2xs mt-1">Check CSV columns or select different variables.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle} className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height={chartHeightToUse}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 15, // Reduced right margin
            left: 5,  // Reduced left margin
            bottom: 85, // Adjusted bottom margin for X-axis, Brush, and Legend
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            stroke="hsl(var(--foreground))"
            angle={-45}
            textAnchor="end"
            height={50} // Reduced height for X-axis area
            interval="preserveStartEnd"
            tickFormatter={formatXAxisTick}
            tick={{ fontSize: '0.7rem' }}
          >
            {timeAxisLabel && (
              <Label
                value={`${timeAxisLabel} (Adjust time window with slider)`}
                offset={10} 
                position="insideBottom"
                fill="hsl(var(--muted-foreground))"
                dy={10} // Adjusted dy to position label appropriately
                style={{ fontSize: '0.7rem', textAnchor: 'middle' }}
              />
            )}
          </XAxis>
          <YAxis stroke="hsl(var(--foreground))" domain={['auto', 'auto']} tick={{ fontSize: '0.7rem' }}>
            <Label
              value="Value"
              angle={-90}
              position="insideLeft"
              style={{ textAnchor: 'middle', fontSize: '0.7rem' }}
              fill="hsl(var(--foreground))"
              dx={-5} // Nudge Y-axis label slightly left
            />
          </YAxis>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--foreground))",
              fontSize: '0.7rem', // Smaller tooltip text
            }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
            cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "20px", fontSize: '0.7rem' }} // Increased paddingTop for more space above legend
          />
          {plottableSeries.map((seriesName, index) => (
            <Line
              key={seriesName}
              type="monotone"
              dataKey={seriesName}
              stroke={`hsl(var(${chartColors[index % chartColors.length]}))`}
              strokeWidth={1.5} // Thinner lines
              dot={false} // No dots on lines
              name={seriesName}
              connectNulls={true}
            />
          ))}
          <Brush
            dataKey="time"
            height={12} // Slimmer brush
            stroke="hsl(var(--primary))"
            fill="hsl(var(--muted))"
            fillOpacity={0.3} // More transparent brush fill
            tickFormatter={formatXAxisTick}
            travellerWidth={10} // Slimmer brush handles
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
