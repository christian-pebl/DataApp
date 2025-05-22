
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush } from 'recharts';
import type { WeatherDataPoint } from '@/app/weather/shared'; 
import { Info, Thermometer, Wind, Cloud, Compass, Waves, CheckCircle2, XCircle } from 'lucide-react'; // Added CheckCircle2, XCircle
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label"; 

type PlotVisibilityKeys = 'temperature' | 'windSpeed' | 'windDirection' | 'cloudCover' | 'tideHeight';
type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';

interface WeatherPlotsGridProps {
  weatherData: WeatherDataPoint[] | null; // Can be null initially
  isLoading: boolean;
  error: string | null;
  tideStationName?: string;
}

const MPH_CONVERSION_FACTOR = 2.23694;

interface PlotConfig {
  dataKey: PlotVisibilityKeys;
  title: string;
  unit: string;
  color: string;
  Icon: React.ElementType;
  dataTransform?: (value: number) => number;
  stationName?: string; 
}

const initialPlotVisibility: Record<PlotVisibilityKeys, boolean> = {
  temperature: true,
  windSpeed: true,
  windDirection: true,
  cloudCover: true,
  tideHeight: true,
};

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

export function WeatherPlotsGrid({ weatherData, isLoading, error, tideStationName }: WeatherPlotsGridProps) {
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  
  const [plotVisibility, setPlotVisibility] = useState(initialPlotVisibility);

  const plotConfigs = useMemo((): PlotConfig[] => [
    { dataKey: 'temperature', title: 'Temperature', unit: '°C', color: '--chart-1', Icon: Thermometer },
    { dataKey: 'windSpeed', title: 'Wind Speed', unit: ' mph', color: '--chart-2', Icon: Wind, dataTransform: (value) => parseFloat((value * MPH_CONVERSION_FACTOR).toFixed(1)) },
    { dataKey: 'windDirection', title: 'Wind Direction', unit: '°', color: '--chart-4', Icon: Compass },
    { dataKey: 'cloudCover', title: 'Cloud Cover', unit: '%', color: '--chart-3', Icon: Cloud },
    { dataKey: 'tideHeight', title: 'Tide', unit: 'm', color: '--chart-5', Icon: Waves, stationName: tideStationName },
  ], [tideStationName]);

  const initialAvailability = useMemo(() => 
    Object.fromEntries(
      plotConfigs.map(pc => [pc.dataKey, 'pending'])
    ) as Record<PlotVisibilityKeys, SeriesAvailabilityStatus>,
    [plotConfigs] // Recalculate if plotConfigs definition changes (e.g. tideStationName changes)
  );
  
  const [seriesDataAvailability, setSeriesDataAvailability] = useState<Record<PlotVisibilityKeys, SeriesAvailabilityStatus>>(initialAvailability);

  useEffect(() => {
    if (weatherData && weatherData.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(weatherData.length -1);
    } else if ((!weatherData || weatherData.length === 0) && brushEndIndex !== undefined) {
      setBrushStartIndex(0);
      setBrushEndIndex(undefined);
    }
  }, [weatherData, brushEndIndex]);


  useEffect(() => {
    if (isLoading) {
      setSeriesDataAvailability(initialAvailability);
      return;
    }

    const newAvailability: Partial<Record<PlotVisibilityKeys, SeriesAvailabilityStatus>> = {};
    if (!weatherData || weatherData.length === 0) {
      plotConfigs.forEach(pc => {
        newAvailability[pc.dataKey] = 'unavailable';
      });
    } else {
      plotConfigs.forEach(pc => {
        const hasData = weatherData.some(
          point => {
            const val = point[pc.dataKey as keyof WeatherDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          }
        );
        newAvailability[pc.dataKey] = hasData ? 'available' : 'unavailable';
      });
    }

    if (tideStationName === "Tide data unavailable") {
      newAvailability.tideHeight = 'unavailable';
    }
    
    setSeriesDataAvailability(newAvailability as Record<PlotVisibilityKeys, SeriesAvailabilityStatus>);

  }, [weatherData, isLoading, tideStationName, plotConfigs, initialAvailability]);


  const handlePlotVisibilityChange = useCallback((plotKey: PlotVisibilityKeys, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [plotKey]: checked }));
  }, []);

  const handleBrushChange = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };

  const displayData = useMemo(() => {
    if (!weatherData || weatherData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) {
      return [];
    }
    const start = Math.max(0, brushStartIndex);
    const end = Math.min(weatherData.length - 1, brushEndIndex);
    return weatherData.slice(start, end + 1);
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

  if (!weatherData && !isLoading && !error) { // weatherData can be null
      return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
            <Info className="h-10 w-10 mb-2" />
            <p>No data to display.</p>
            <p className="text-sm">Please select location and date range, then click "Search & Fetch Weather".</p>
          </div>
        );
  }
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow flex flex-col space-y-1 overflow-y-auto pr-1">
        {plotConfigs.map((config) => {
          const IconComponent = config.Icon;
          const availabilityStatus = seriesDataAvailability[config.dataKey];
          const isPlotEffectivelyVisible = plotVisibility[config.dataKey]; // Checkbox state

          const transformedDisplayData = displayData.map(point => {
            const value = point[config.dataKey as keyof WeatherDataPoint] as number | undefined;
            if (value === undefined || value === null) return { ...point, [config.dataKey]: undefined };
            if (typeof value === 'number' && config.dataTransform) {
              return { ...point, [config.dataKey]: config.dataTransform(value) };
            }
            return point;
          });

          const lastDataPoint = transformedDisplayData[transformedDisplayData.length - 1];
          const currentValue = lastDataPoint ? lastDataPoint[config.dataKey as keyof WeatherDataPoint] as number | undefined : undefined;
          
          let displayValue = "";
          if (typeof currentValue === 'number' && !isNaN(currentValue)) {
            displayValue = `${currentValue.toLocaleString()}${config.unit}`;
          }
          
          return (
            <div key={config.dataKey as string} className="h-auto w-full border rounded-md p-1 shadow-sm bg-card flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-2 pt-0.5 pb-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <Checkbox
                    id={`plot-visibility-${config.dataKey}`}
                    checked={plotVisibility[config.dataKey]}
                    onCheckedChange={(checked) => handlePlotVisibilityChange(config.dataKey, !!checked)}
                    className="h-3.5 w-3.5"
                  />
                  <UiLabel htmlFor={`plot-visibility-${config.dataKey}`} className="flex items-center gap-1 cursor-pointer">
                    <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{config.title}</span>
                     {config.dataKey === 'tideHeight' && config.stationName && config.stationName !== "Tide data unavailable" && (
                       <span className="text-muted-foreground text-[0.65rem] ml-1">({config.stationName})</span>
                     )}
                  </UiLabel>
                  {/* Status Icon */}
                  {availabilityStatus === 'available' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />}
                  {availabilityStatus === 'unavailable' && <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />}
                </div>
                {isPlotEffectivelyVisible && availabilityStatus === 'available' && displayValue && (
                  <span className="text-muted-foreground text-xs ml-auto pl-2">{displayValue}</span>
                )}
              </div>

              {isPlotEffectivelyVisible && (
                availabilityStatus === 'available' ? (
                  <div className="flex-grow h-[80px]"> 
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={transformedDisplayData} margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <YAxis
                          domain={['auto', 'auto']}
                          tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString() : String(value)}
                          tick={{ fontSize: '0.6rem', fill: 'hsl(var(--muted-foreground))' }}
                          stroke="hsl(var(--border))"
                          width={45}
                          axisLine={false}
                          tickLine={false}
                        />
                        <XAxis dataKey="time" hide />
                        <Line
                          type="monotone"
                          dataKey={config.dataKey as string}
                          stroke={`hsl(var(${config.color}))`}
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                          name={config.title}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex-grow h-[80px] flex items-center justify-center text-xs text-red-500 italic">
                    Data unavailable for this plot.
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {weatherData && weatherData.length > 0 && (
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
              <Line dataKey={plotConfigs.find(p => plotVisibility[p.dataKey] && seriesDataAvailability[p.dataKey] === 'available')?.dataKey || plotConfigs[0].dataKey} stroke="transparent" dot={false} /> 
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

