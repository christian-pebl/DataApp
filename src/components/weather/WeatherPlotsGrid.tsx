
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

    // Show date for the first tick or if it's midnight
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


export function WeatherPlotsGrid({ weatherData, isLoading, error }: WeatherPlotsGridProps) {
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
            <p className="text-sm">Please select criteria and fetch weather data.</p>
          </div>
        );
  }


  return (
    <div className="w-full">
      <div className="flex flex-col space-y-2 mb-3">
        {plotConfigs.map((config) => {
          // Check if there's any valid data for this specific series in the current displayData
          const hasValidDataForSeries = displayData.some(point => 
            typeof point[config.dataKey as keyof WeatherDataPoint] === 'number' && 
            !isNaN(point[config.dataKey as keyof WeatherDataPoint] as number)
          );

          return (
            <div key={config.dataKey} className="h-[120px] w-full border rounded-md p-2 shadow-sm bg-card">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayData} margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => `${value}${config.unit}`}
                    tick={{ fontSize: '0.6rem', fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--border))"
                    width={55} // Adjusted width for Y-axis labels
                    axisLine={false}
                    tickLine={false}
                    label={{
                      value: config.title,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: '0.7rem', fill: `hsl(var(${config.color}))`, textAnchor: 'middle' },
                      dy: 40, // Adjust dy to position label correctly
                      dx: -15,
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
                  ) : (
                    // Optional: Render something if no data for this series, or just let it be blank
                    null
                  )}
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
        <div className="h-[70px] w-full border rounded-md p-1 shadow-sm bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weatherData} margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
              <XAxis 
                dataKey="time" 
                tickFormatter={formatXAxisTickBrush} 
                stroke="hsl(var(--muted-foreground))" 
                tick={{ fontSize: '0.6rem' }}
                height={30} // Give XAxis some height
                dy={5} // Push ticks down a bit
              />
               {/* Add a dummy line to make Brush show correctly with only XAxis in its own chart */}
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
                y={15} // Position Brush slightly lower to not overlap X-axis labels
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

