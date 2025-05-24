
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush } from 'recharts';
import type { IrradianceParameterKey, IrradianceDataPoint } from '@/app/irradiance-explorer/shared';
import { IRRADIANCE_PARAMETER_CONFIG, ALL_IRRADIANCE_PARAMETERS } from '@/app/irradiance-explorer/shared';
import { Info, CheckCircle2, XCircle, Loader2, AlertCircle, Sun, Sunrise } from "lucide-react"; // Added Sun, Sunrise
import type { LucideIcon } from "lucide-react";

interface PlotConfigInternal {
  dataKey: IrradianceParameterKey;
  title: string;
  unit: string;
  color: string;
  Icon: LucideIcon;
}

export interface IrradiancePlotsGridProps {
  irradianceData: IrradianceDataPoint[] | null;
  isLoading: boolean;
  error: string | null;
  plotVisibility: Record<IrradianceParameterKey, boolean>;
}

type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';

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

export function IrradiancePlotsGrid({
  irradianceData,
  isLoading,
  error,
  plotVisibility,
}: IrradiancePlotsGridProps) {
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const plotConfigs = useMemo((): PlotConfigInternal[] => {
    return ALL_IRRADIANCE_PARAMETERS.map(key => {
      const config = IRRADIANCE_PARAMETER_CONFIG[key];
      return {
        dataKey: key,
        title: config.name,
        unit: config.unit,
        color: config.color,
        Icon: (config as { icon?: LucideIcon }).icon || Info,
      };
    });
  }, []);

  const initialAvailability = useMemo(() =>
    Object.fromEntries(
      plotConfigs.map(pc => [pc.dataKey, 'pending'])
    ) as Record<IrradianceParameterKey, SeriesAvailabilityStatus>,
    [plotConfigs]
  );

  const [seriesDataAvailability, setSeriesDataAvailability] = useState<Record<IrradianceParameterKey, SeriesAvailabilityStatus>>(initialAvailability);

  useEffect(() => {
    if (irradianceData && irradianceData.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(irradianceData.length - 1);
    } else if ((!irradianceData || irradianceData.length === 0)) {
      setBrushStartIndex(0);
      setBrushEndIndex(undefined);
    }
  }, [irradianceData, brushEndIndex]);

  useEffect(() => {
    if (isLoading) {
      setSeriesDataAvailability(initialAvailability);
      return;
    }
    const newAvailability: Partial<Record<IrradianceParameterKey, SeriesAvailabilityStatus>> = {};
    if (!irradianceData || irradianceData.length === 0) {
      plotConfigs.forEach(pc => {
        newAvailability[pc.dataKey] = 'unavailable';
      });
    } else {
      plotConfigs.forEach(pc => {
        const hasData = irradianceData.some(
          point => {
            const val = point[pc.dataKey as keyof IrradianceDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          }
        );
        newAvailability[pc.dataKey] = hasData ? 'available' : 'unavailable';
      });
    }
    setSeriesDataAvailability(newAvailability as Record<IrradianceParameterKey, SeriesAvailabilityStatus>);
  }, [irradianceData, isLoading, plotConfigs, initialAvailability]);

  const handleBrushChangeLocal = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };

  const displayData = useMemo(() => {
    if (!irradianceData || irradianceData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) {
      return [];
    }
    const start = Math.max(0, brushStartIndex);
    const end = Math.min(irradianceData.length - 1, brushEndIndex);
    return irradianceData.slice(start, end + 1);
  }, [irradianceData, brushStartIndex, brushEndIndex]);

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

  if (!irradianceData && !isLoading && !error) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
            <Info className="h-10 w-10 mb-2" />
            <p>No data to display.</p>
            <p className="text-sm">Select location, date, parameters, then click "Fetch Irradiance Data".</p>
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
          
          const lastDataPoint = displayData[displayData.length - 1];
          const currentValue = lastDataPoint ? lastDataPoint[config.dataKey as keyof IrradianceDataPoint] as number | undefined : undefined;
          let displayValue = "";
          if (plotVisibility[config.dataKey] && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
            displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits: 1})}${config.unit}`;
          } else if (plotVisibility[config.dataKey] && availabilityStatus === 'unavailable') {
             // displayValue = ""; // Keep header clean, chart area will show "Data unavailable"
          }

          return (
            <div key={config.dataKey as string} className="h-auto w-full border rounded-md p-1 shadow-sm bg-card flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-2 pt-0.5 pb-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                  <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium text-foreground">{config.title}</span>
                  {availabilityStatus === 'pending' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin ml-1" />}
                  {availabilityStatus === 'available' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />}
                  {availabilityStatus === 'unavailable' && <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />}
                </div>
                {displayValue && (
                  <span className="text-muted-foreground text-xs ml-auto pl-2">{displayValue}</span>
                )}
              </div>

              <div className="flex-grow h-[80px]">
                {availabilityStatus === 'available' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayData} margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
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
            </div>
          );
        })}
      </div>

      {irradianceData && irradianceData.length > 0 && (
        <div className="h-[60px] w-full border rounded-md p-1 shadow-sm bg-card mt-2 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={irradianceData} margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxisTickBrush}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.6rem' }}
                height={30}
                dy={5}
              />
               <Line dataKey={(ALL_IRRADIANCE_PARAMETERS).find(p => plotVisibility[p] && seriesDataAvailability[p] === 'available') || plotConfigs[0]?.dataKey} stroke="transparent" dot={false} />
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
