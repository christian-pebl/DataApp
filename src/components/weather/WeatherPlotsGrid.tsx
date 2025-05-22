
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush, Label } from 'recharts';
import type { WeatherDataPoint } from '@/app/weather/shared';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from 'lucide-react';

interface WeatherPlotsGridProps {
  weatherData: WeatherDataPoint[];
  isLoading: boolean;
  error: string | null;
  plotVisibility: Record<string, boolean>; // New prop
}

const plotConfigs = [
  { dataKey: 'temperature', title: 'Temperature', unit: '°C', color: '--chart-1' },
  { dataKey: 'windSpeed', title: 'Wind Speed', unit: ' m/s', color: '--chart-2' },
  { dataKey: 'cloudCover', title: 'Cloud Cover', unit: '%', color: '--chart-3' },
  { dataKey: 'windDirection', title: 'Wind Direction', unit: '°', color: '--chart-4' },
];

// Simplified tick formatter for the main Brush X-axis
const formatXAxisTickBrush = (timeValue: string | number): string => {
  try {
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) return String(timeValue);

    if (date.getHours() === 0 && date.getMinutes() === 0) {
      const year = date.getFullYear().toString().slice(-2);
      const month = ('0' + (date.getMonth() + 1)).slice(-2);
      const day = ('0' + date.getDate()).slice(-2);
      return `${day}-${month}-${year}`;
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(timeValue);
  }
};


export function WeatherPlotsGrid({ weatherData, isLoading, error, plotVisibility }: WeatherPlotsGridProps) {
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(weatherData.length > 0 ? weatherData.length -1 : undefined);

  useEffect(() => {
    if (weatherData.length > 0) {
      setBrushStartIndex(0);
      setBrushEndIndex(weatherData.length - 1);
    } else {
      setBrushStartIndex(undefined);
      setBrushEndIndex(undefined);
    }
  }, [weatherData]);

  const handleBrushChange = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };

  const displayData = useMemo(() => {
    if (!weatherData || weatherData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) {
      return [];
    }
    return weatherData.slice(brushStartIndex, brushEndIndex + 1);
  }, [weatherData, brushStartIndex, brushEndIndex]);
  
  const visiblePlotConfigs = useMemo(() => {
    return plotConfigs.filter(config => plotVisibility[config.dataKey]);
  }, [plotVisibility]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
        Fetching data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
        <Info className="h-10 w-10 mb-2" />
        <p className="font-semibold">Error Fetching Data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  
  if (weatherData.length === 0 && !isLoading && !error) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
            <Info className="h-10 w-10 mb-2" />
            <p>No data to display.</p>
            <p className="text-sm">Please select location and date range, then click "Search & Fetch Weather".</p>
          </div>
        );
  }
  
  if (visiblePlotConfigs.length === 0 && weatherData.length > 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
          <Info className="h-10 w-10 mb-2" />
          <p>No plots selected for display.</p>
          <p className="text-sm">Please check at least one weather parameter to view its plot.</p>
        </div>
      );
  }


  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow flex flex-col space-y-1 overflow-y-auto pr-1"> {/* Added pr-1 for scrollbar space */}
        {visiblePlotConfigs.map((config) => {
          const hasValidDataForSeries = displayData.some(point => 
            typeof point[config.dataKey as keyof WeatherDataPoint] === 'number' && 
            !isNaN(point[config.dataKey as keyof WeatherDataPoint] as number)
          );

          return (
            <div key={config.dataKey} className="h-[100px] w-full border rounded-md p-2 shadow-sm bg-card flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => `${value}${config.unit}`}
                    tick={{ fontSize: '0.6rem', fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--border))"
                    width={45} 
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: config.title,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: '0.6rem', fill: `hsl(var(${config.color}))`, textAnchor: 'middle' },
                      dy: 20, // Adjust dy to position label correctly
                      dx: -10,
                    }}
                  />
                  <XAxis dataKey="time" hide />
                  {hasValidDataForSeries ? (
                    <Line 
                      type="monotone" 
                      dataKey={config.dataKey as string} 
                      stroke={`hsl(var(${config.color}))`} 
                      strokeWidth={1.5} 
                      dot={false} 
                      connectNulls 
                      name={config.title}
                    />
                  ) : null}
                   {displayData.length > 0 && !hasValidDataForSeries && (
                     <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--muted-foreground))" fontSize="0.7rem">
                       No data for {config.title}
                     </text>
                   )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      {weatherData.length > 0 && (
        <div className="h-[60px] w-full border rounded-md p-1 shadow-sm bg-card mt-2 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weatherData} margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
              <XAxis 
                dataKey="time" 
                tickFormatter={formatXAxisTickBrush} 
                stroke="hsl(var(--muted-foreground))" 
                tick={{ fontSize: '0.6rem' }}
                height={30} 
                dy={5} 
              />
              <Line dataKey={plotConfigs[0].dataKey as string} stroke="transparent" dot={false} />
              <Brush 
                dataKey="time" 
                height={20} 
                stroke="hsl(var(--primary))" 
                fill="hsl(var(--muted))"
                fillOpacity={0.3}
                tickFormatter={formatXAxisTickBrush}
                travellerWidth={8}
                startIndex={brushStartIndex}
                endIndex={brushEndIndex}
                onChange={handleBrushChange}
                y={10} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

    