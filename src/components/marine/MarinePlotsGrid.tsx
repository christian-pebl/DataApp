
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Label as RechartsLabel } from 'recharts';
import type { CombinedParameterKey, CombinedDataPoint, ParameterConfigItem } from '@/app/om-marine-explorer/shared';
import { PARAMETER_CONFIG, ALL_PARAMETERS } from '@/app/om-marine-explorer/shared'; // Ensure ALL_PARAMETERS is imported
import { Info, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


interface PlotConfigInternal extends ParameterConfigItem {
  dataKey: CombinedParameterKey;
  Icon: LucideIcon;
  dataTransform?: (value: number) => number;
}

export interface MarinePlotsGridProps {
  marineData: CombinedDataPoint[] | null;
  isLoading: boolean;
  error: string | null;
  // plotVisibility and handlePlotVisibilityChange are removed as props
}

type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';
const MPH_CONVERSION_FACTOR = 2.23694; // For wind speed (km/h to mph)

const formatDateTickBrush = (timeValue: string | number): string => {
  try {
    const date = new Date(timeValue);
    if (!isValid(date)) {
       if (typeof timeValue === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue)) {
        const parsed = parseISO(timeValue);
        if (isValid(parsed)) return format(parsed, 'dd-MM-yy');
      }
      return String(timeValue);
    }
    return format(date, 'dd-MM-yy');
  } catch (e) {
    return String(timeValue);
  }
};

export function MarinePlotsGrid({
  marineData: combinedData,
  isLoading,
  error,
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
        dataTransformFunc = (value: number /* km/h */) => parseFloat(((value * 0.277778) * MPH_CONVERSION_FACTOR).toFixed(1));
      }
      
      return {
        ...config,
        dataKey: key,
        unit: displayUnit,
        Icon: (config as { icon?: LucideIcon }).icon || Info,
        dataTransform: dataTransformFunc,
      };
    }).sort((a, b) => {
      const order: CombinedParameterKey[] = ['temperature2m', 'windSpeed10m', 'windDirection10m', 'ghi', 'seaLevelHeightMsl', 'waveHeight', 'waveDirection', 'wavePeriod', 'seaSurfaceTemperature'];
      return order.indexOf(a.dataKey) - order.indexOf(b.dataKey);
    });
  }, []);
  
  const initialVisibility = useMemo(() =>
    Object.fromEntries(
      plotConfigs.map(pc => [pc.dataKey, true]) // Default all to true
    ) as Record<CombinedParameterKey, boolean>,
  [plotConfigs]);

  const [plotVisibility, setPlotVisibility] = useState<Record<CombinedParameterKey, boolean>>(initialVisibility);

  const handlePlotVisibilityChange = useCallback((key: CombinedParameterKey, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
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
      // Also reset plotVisibility on new load, or keep user's last choice?
      // For now, let's re-initialize based on data availability after loading
      return;
    }
    
    const newAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
    const newVisibility: Partial<Record<CombinedParameterKey, boolean>> = {};

    if (!combinedData || combinedData.length === 0) {
      plotConfigs.forEach(pc => {
        newAvailability[pc.dataKey] = 'unavailable';
        newVisibility[pc.dataKey] = false; // If no data, don't make it visible by default
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
        newVisibility[pc.dataKey] = hasData; // Default to visible if data is available
      });
    }
    setSeriesDataAvailability(newAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
    setPlotVisibility(newVisibility as Record<CombinedParameterKey, boolean>); // Initialize visibility based on data
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
        <Info className="h-10 w-10 mb-2" />
        <p className="font-semibold">Error Fetching Data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  
  if (!combinedData || combinedData.length === 0) {
     return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
            <Info className="h-10 w-10 mb-2" />
            <p>No data to display.</p>
            <p className="text-sm">Select location and date, then click "Fetch Data".</p>
          </div>
        );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow flex flex-col space-y-1 overflow-y-auto pr-1">
        {plotConfigs.map((config) => {
          const IconComponent = config.Icon;
          const availabilityStatus = seriesDataAvailability[config.dataKey];
          const isPlotCurrentlyVisible = plotVisibility[config.dataKey] ?? false;

          const transformedDisplayData = displayData.map(point => {
            const value = point[config.dataKey as keyof CombinedDataPoint] as number | undefined;
            if (value === undefined || value === null || isNaN(Number(value))) return { ...point, [config.dataKey]: undefined };
            if (typeof value === 'number' && config.dataTransform) {
              return { ...point, [config.dataKey]: config.dataTransform(value) };
            }
            return point;
          });

          const lastDataPoint = transformedDisplayData.length > 0 ? transformedDisplayData[transformedDisplayData.length - 1] : null;
          const currentValue = lastDataPoint ? lastDataPoint[config.dataKey as keyof CombinedDataPoint] as number | undefined : undefined;
          
          let displayValue = "";
          if (isPlotCurrentlyVisible && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
            displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits: 1})}${config.unit || ''}`;
          }

          const hasValidDataForSeries = transformedDisplayData.some(p => p[config.dataKey] !== undefined && !isNaN(Number(p[config.dataKey])));

          if (availabilityStatus === 'pending' || (availabilityStatus === 'unavailable' && !isLoading)) {
            // Render header even if data is unavailable, but no chart
            return (
              <div key={config.dataKey as string} className="border rounded-md p-1.5 shadow-sm bg-card flex-shrink-0 flex flex-col">
                <div className="flex items-center justify-between px-2 pt-0.5 pb-0.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                        id={`visibility-${config.dataKey}`}
                        checked={isPlotCurrentlyVisible}
                        onCheckedChange={(checked) => handlePlotVisibilityChange(config.dataKey, !!checked)}
                        className="h-3.5 w-3.5"
                        disabled={availabilityStatus === 'unavailable'}
                    />
                    <Label htmlFor={`visibility-${config.dataKey}`} className="flex items-center gap-1 cursor-pointer">
                        <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{config.name}</span>
                    </Label>
                    {availabilityStatus === 'pending' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin ml-1" />}
                    {availabilityStatus === 'available' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />}
                    {availabilityStatus === 'unavailable' && <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />}
                  </div>
                   {isPlotCurrentlyVisible && displayValue && (
                    <span className="text-muted-foreground text-xs ml-auto pl-2">{displayValue}</span>
                  )}
                </div>
                {isPlotCurrentlyVisible && availabilityStatus === 'unavailable' && (
                  <div className="flex items-center justify-center h-[80px] text-xs text-red-500 italic">
                    Data unavailable for this plot.
                  </div>
                )}
              </div>
            );
          }


          return (
            <div key={config.dataKey as string} className="border rounded-md p-1.5 shadow-sm bg-card flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-2 pt-0.5 pb-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                   <Checkbox
                        id={`visibility-${config.dataKey}`}
                        checked={isPlotCurrentlyVisible}
                        onCheckedChange={(checked) => handlePlotVisibilityChange(config.dataKey, !!checked)}
                        className="h-3.5 w-3.5"
                    />
                    <Label htmlFor={`visibility-${config.dataKey}`} className="flex items-center gap-1 cursor-pointer">
                        <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{config.name}</span>
                    </Label>
                  {availabilityStatus === 'available' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />}
                </div>
                {isPlotCurrentlyVisible && displayValue && (
                  <span className="text-muted-foreground text-xs ml-auto pl-2">{displayValue}</span>
                )}
              </div>

              {isPlotCurrentlyVisible && (
                <div className="flex-grow h-[80px]">
                  {hasValidDataForSeries ? (
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
                          name={config.name}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-red-500 italic">
                      No data points for selected range.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {combinedData && combinedData.length > 0 && (
        <div className="h-[75px] w-full border rounded-md p-1 shadow-sm bg-card mt-2 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData} margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
              <XAxis
                dataKey="time"
                tickFormatter={formatDateTickBrush}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.6rem' }}
                height={60} // Increased height for angled labels
                angle={-45}
                textAnchor="end"
                dy={5} 
              />
               <Line dataKey={(ALL_PARAMETERS).find(p => plotVisibility[p] && seriesDataAvailability[p] === 'available') || plotConfigs[0]?.dataKey} stroke="transparent" dot={false} />
              <Brush
                dataKey="time"
                height={14}
                stroke="hsl(var(--primary))"
                fill="transparent"
                fillOpacity={0.3}
                tickFormatter={formatDateTickBrush}
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

