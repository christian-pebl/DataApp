
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
const INTERNAL_DEFAULT_CHART_HEIGHT = 350; // Default if prop not provided

const formatXAxisTick = (timeValue: string | number): string => {
  try {
    // Check if already in YY-MM-DD format
    if (typeof timeValue === 'string' && /^\d{2}-\d{2}-\d{2}$/.test(timeValue)) {
      return timeValue;
    }
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) {
      // Attempt to parse YYYY-MM-DD... format
      if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(timeValue)) {
        const year = timeValue.substring(2, 4);
        const month = timeValue.substring(5, 7);
        const day = timeValue.substring(8, 10);
        return `${year}-${month}-${day}`;
      }
      return String(timeValue); // Fallback to original string if unparsable
    }
    const year = date.getFullYear().toString().slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return `${year}-${month}-${day}`;
  } catch (e) {
    // In case of any error during date parsing
    return String(timeValue);
  }
};

export function ChartDisplay({
  data,
  plottableSeries,
  timeAxisLabel,
  plotTitle = "Chart",
  chartRenderHeight: propChartRenderHeight,
}: ChartDisplayProps) {
  const chartHeightToUse = propChartRenderHeight ?? INTERNAL_DEFAULT_CHART_HEIGHT;

  // Main wrapper for the entire chart display area
  const wrapperStyle: React.CSSProperties = {
    height: `${chartHeightToUse}px`, // Use dynamic or default height
    width: '100%',
  };

  // Memoize processed chart data
  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }
    // Convert all plottable series values to numbers, or keep as string if not parsable
    return data.map(point => {
      const newPoint: DataPoint = { time: point.time };
      Object.keys(point).forEach(key => {
        if (key !== 'time') { // Exclude the time key itself from numeric conversion attempt here
          const value = point[key];
          if (typeof value === 'string') {
            const num = parseFloat(value.replace(/,/g, '')); // Handle thousands separators
            newPoint[key] = isNaN(num) ? value : num; // Store number or original string
          } else {
            newPoint[key] = value; // Already a number or undefined
          }
        }
      });
      return newPoint;
    });
  }, [data]);

  // Check if there's any numeric data for the currently selected series
  const hasAnyNumericDataForSelectedSeries = React.useMemo(() => {
    if (!chartData || chartData.length === 0 || plottableSeries.length === 0) return false;
    return plottableSeries.some(seriesName =>
      chartData.some(point => typeof point[seriesName] === 'number' && !isNaN(Number(point[seriesName])))
    );
  }, [chartData, plottableSeries]);


  const renderNoDataMessage = (icon: React.ReactNode, primaryText: string, secondaryText?: string) => (
    <div style={wrapperStyle} className="flex flex-col items-center justify-center p-2 h-full">
      <div className="text-center text-muted-foreground">
        {icon}
        <p className="text-xs mt-1">{primaryText}</p>
        {secondaryText && <p className="text-2xs mt-1">{secondaryText}</p>}
      </div>
    </div>
  );

  if (!data || data.length === 0) {
    return renderNoDataMessage(<Info className="h-8 w-8 mx-auto" />, `No data loaded for ${plotTitle}.`, "Upload a file to get started.");
  }

  if (plottableSeries.length === 0) {
    return renderNoDataMessage(<Info className="h-8 w-8 mx-auto" />, `Please select at least one variable to plot for ${plotTitle}.`, "Check the boxes in the 'Select Variables' panel.");
  }

  if (!hasAnyNumericDataForSelectedSeries) {
     return renderNoDataMessage(
        <Info className="h-8 w-8 mx-auto" />,
        `No valid numeric data for selected series in ${plotTitle}: "${plottableSeries.join(', ')}".`,
        "Check CSV columns or select different variables."
      );
  }

  return (
    <div style={wrapperStyle} className="flex-1 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 20, 
            left: 5,  
            bottom: 60, // Adjusted bottom margin
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="time"
            stroke="hsl(var(--foreground))"
            angle={-45}
            textAnchor="end"
            height={60} // Adjusted height for X-axis area
            interval="preserveStartEnd"
            tickFormatter={formatXAxisTick}
            tick={{ fontSize: '0.7rem' }}
          >
            {timeAxisLabel && (
              <Label
                value={`${timeAxisLabel} (Adjust time window with slider)`}
                offset={15} // Adjusted offset
                position="insideBottom"
                fill="hsl(var(--muted-foreground))"
                dy={15} // Adjusted dy
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
              dx={-5} 
            />
          </YAxis>
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              borderColor: "hsl(var(--border))",
              color: "hsl(var(--foreground))",
              fontSize: '0.7rem', 
            }}
            itemStyle={{ color: "hsl(var(--foreground))" }}
            cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "10px", fontSize: '0.7rem' }} // Adjusted legend padding
          />
          {plottableSeries.map((seriesName, index) => (
            <Line
              key={seriesName}
              type="monotone"
              dataKey={seriesName}
              stroke={`hsl(var(${chartColors[index % chartColors.length]}))`}
              strokeWidth={1.5}
              dot={false} // No dots on the line
              name={seriesName}
              connectNulls={true} // Connect lines even if there are null/NaN values
            />
          ))}
          <Brush
            dataKey="time"
            height={12} // Slimmer brush
            stroke="hsl(var(--primary))"
            fill="hsl(var(--muted))"
            fillOpacity={0.3}
            tickFormatter={formatXAxisTick}
            travellerWidth={8} // Slimmer handles
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
