
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Brush } from 'recharts';
import type { CombinedParameterKey, CombinedDataPoint } from '@/app/om-marine-explorer/shared';
import { PARAMETER_CONFIG, ALL_PARAMETERS } from '@/app/om-marine-explorer/shared';
import { Info, CheckCircle2, XCircle, Loader2, AlertCircle, Waves, Sailboat, Compass, Timer, Thermometer, Wind as WindIcon, Sun as SunIcon } from "lucide-react"; // Removed CloudSun
import type { LucideIcon } from "lucide-react";

interface PlotConfigInternal {
  dataKey: CombinedParameterKey;
  title: string;
  unit: string;
  color: string;
  Icon: LucideIcon;
  dataTransform?: (value: number) => number;
}

export interface MarinePlotsGridProps {
  marineData: CombinedDataPoint[] | null;
  isLoading: boolean;
  error: string | null;
  plotVisibility: Record<CombinedParameterKey, boolean>;
}

type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';
const MPH_CONVERSION_FACTOR = 2.23694; // For wind speed (km/h to mph)

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

export function MarinePlotsGrid({
  marineData: combinedData,
  isLoading,
  error,
  plotVisibility,
}: MarinePlotsGridProps) {

  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const plotConfigs = useMemo((): PlotConfigInternal[] => {
    return (ALL_PARAMETERS).map(key => {
      const config = PARAMETER_CONFIG[key as CombinedParameterKey];
      let dataTransformFunc: ((value: number) => number) | undefined = undefined;
      let displayUnit = config.unit;

      if (key === 'windSpeed10m' && config.apiParam === 'windspeed_10m') {
        displayUnit = 'mph';
        dataTransformFunc = (value: number) => parseFloat(((value / 3.6) * MPH_CONVERSION_FACTOR).toFixed(1));
      }

      return {
        dataKey: key,
        title: config.name,
        unit: displayUnit,
        color: config.color,
        Icon: (config as { icon?: LucideIcon }).icon || Info,
        dataTransform: dataTransformFunc,
      };
    });
  }, []);

  const initialAvailability = useMemo(() =>
    Object.fromEntries(
      plotConfigs.map(pc => [pc.dataKey, 'pending'])
    ) as Record<CombinedParameterKey, SeriesAvailabilityStatus>,
    [plotConfigs]
  );

  const [seriesDataAvailability, setSeriesDataAvailability] = useState<Record<CombinedParameterKey, SeriesAvailabilityStatus>>(initialAvailability);

  useEffect(() => {
    if (combinedData && combinedData.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(combinedData.length -1);
    } else if ((!combinedData || combinedData.length === 0)) {
      setBrushStartIndex(0);
      setBrushEndIndex(undefined);
    }
  }, [combinedData, brushEndIndex]);


  useEffect(() => {
    if (isLoading) {
      setSeriesDataAvailability(initialAvailability);
      return;
    }

    const newAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
    if (!combinedData || combinedData.length === 0) {
      plotConfigs.forEach(pc => {
        newAvailability[pc.dataKey] = 'unavailable';
      });
    } else {
      plotConfigs.forEach(pc => {
        const hasData = combinedData.some(
          point => {
            const val = point[pc.dataKey as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          }
        );
        newAvailability[pc.dataKey] = hasData ? 'available' : 'unavailable';
      });
    }
    setSeriesDataAvailability(newAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
  }, [combinedData, isLoading, plotConfigs, initialAvailability]);

  const handleBrushChangeLocal = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };

  const displayData = useMemo(() => {
    if (!combinedData || combinedData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) {
      return [];
    }
    const start = Math.max(0, brushStartIndex);
    const end = Math.min(combinedData.length - 1, brushEndIndex);
    return combinedData.slice(start, end + 1);
  }, [combinedData, brushStartIndex, brushEndIndex]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        <Loader2 className="animate-spin h-8 w-8 text-primary mr-2" />
        Fetching data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
        <AlertCircle className="h-10 w-10 mb-2" />
        <p className="font-semibold">Error Fetching Data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!combinedData && !isLoading && !error) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
            <Info className="h-10 w-10 mb-2" />
            <p>No data to display.</p>
            <p className="text-sm">Select parameters, location, and date, then click "Fetch Data".</p>
          </div>
        );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow flex flex-col space-y-1 overflow-y-auto pr-1">
        {plotConfigs.map((config) => {
          if (!plotVisibility[config.dataKey]) return null;

          const IconComponent = config.Icon;
          const availabilityStatus = seriesDataAvailability[config.dataKey];

          const transformedDisplayData = displayData.map(point => {
            const value = point[config.dataKey as keyof CombinedDataPoint] as number | undefined;
            if (value === undefined || value === null) return { ...point, [config.dataKey]: undefined };
            if (typeof value === 'number' && config.dataTransform) {
              return { ...point, [config.dataKey]: config.dataTransform(value) };
            }
            return point;
          });

          const lastDataPoint = transformedDisplayData[transformedDisplayData.length - 1];
          const currentValue = lastDataPoint ? lastDataPoint[config.dataKey as keyof CombinedDataPoint] as number | undefined : undefined;

          let displayValue = "";
          if (plotVisibility[config.dataKey] && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
            displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits: 1})}${config.unit}`;
          } else if (plotVisibility[config.dataKey] && availabilityStatus === 'unavailable') {
             // displayValue = "(N/A)"; // Let the chart area handle "Data unavailable"
          }

          return (
            <div key={config.dataKey as string} className="h-auto w-full border rounded-md p-1 shadow-sm bg-card flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-2 pt-0.5 pb-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{config.title}</span>
                  {availabilityStatus === 'available' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />}
                  {availabilityStatus === 'unavailable' && <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />}
                </div>
                {displayValue && (
                  <span className="text-muted-foreground text-xs ml-auto pl-2">{displayValue}</span>
                )}
              </div>

              {plotVisibility[config.dataKey] ? (
                <div className="flex-grow h-[80px]">
                  {availabilityStatus === 'available' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={transformedDisplayData} margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <YAxis
                          domain={['auto', 'auto']}
                          tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}) : String(value)}
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
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-red-500 italic">
                      Data unavailable for this plot.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {combinedData && combinedData.length > 0 && (
        <div className="h-[60px] w-full border rounded-md p-1 shadow-sm bg-card mt-2 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData} margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxisTickBrush}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.6rem' }}
                height={30}
                dy={5}
              />
               <Line dataKey={(ALL_PARAMETERS).find(p => plotVisibility[p] && seriesDataAvailability[p] === 'available') || plotConfigs[0]?.dataKey} stroke="transparent" dot={false} />
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
                onChange={handleBrushChangeLocal}
                y={10}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
