
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Tooltip as RechartsTooltip, Label as RechartsLabel } from 'recharts';
import type { CombinedParameterKey, CombinedDataPoint, ParameterConfigItem } from '@/app/om-marine-explorer/shared';
import { PARAMETER_CONFIG, ALL_PARAMETERS } from '@/app/om-marine-explorer/shared';
import { Info, CheckCircle2, XCircle, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PlotConfigInternal extends ParameterConfigItem {
  dataKey: CombinedParameterKey;
  Icon: LucideIcon;
  dataTransform?: (value: number) => number;
  stationName?: string; // For tide plot specifically
}

export interface MarinePlotsGridProps {
  marineData: CombinedDataPoint[] | null;
  isLoading: boolean;
  error: string | null;
  // plotVisibility and handlePlotVisibilityChange are managed internally now
  tideStationName?: string | null; // Used for tide plot header
}

type PlotVisibilityKeys = CombinedParameterKey;
type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';
const MPH_CONVERSION_FACTOR = 2.23694; // For wind speed (m/s to mph)

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
  tideStationName,
}: MarinePlotsGridProps) {
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  
  const [plotConfigsInternal, setPlotConfigsInternal] = useState<PlotConfigInternal[]>([]);

  useEffect(() => {
    const initialConfigs: PlotConfigInternal[] = ALL_PARAMETERS.map(key => {
      const config = PARAMETER_CONFIG[key as CombinedParameterKey];
      let dataTransformFunc: ((value: number) => number) | undefined = undefined;
      let displayUnit = config.unit;

      if (key === 'windSpeed10m') { // Open-Meteo weather gives km/h, we want mph
        displayUnit = 'mph';
         // Assuming API gives m/s and we want mph
        dataTransformFunc = (value: number /* m/s */) => parseFloat((value * MPH_CONVERSION_FACTOR).toFixed(1));
      }
      
      return {
        ...config,
        dataKey: key,
        unit: displayUnit,
        Icon: (config as { icon?: LucideIcon }).icon || Info,
        dataTransform: dataTransformFunc,
        stationName: key === 'seaLevelHeightMsl' ? tideStationName || undefined : undefined,
      };
    }).sort((a, b) => {
      const order: CombinedParameterKey[] = [
        'temperature2m',
        'windSpeed10m',
        'windDirection10m',
        'ghi',
        'seaLevelHeightMsl',
        'waveHeight',
        'waveDirection',
        'wavePeriod',
        'seaSurfaceTemperature',
      ];
      return order.indexOf(a.dataKey) - order.indexOf(b.dataKey);
    });
    setPlotConfigsInternal(initialConfigs);
  }, [tideStationName]); // Re-run if tideStationName changes for the tide plot header


  const initialVisibility = useMemo(() =>
    Object.fromEntries(
      plotConfigsInternal.map(pc => [pc.dataKey, true])
    ) as Record<PlotVisibilityKeys, boolean>,
  [plotConfigsInternal]);

  const [plotVisibility, setPlotVisibility] = useState<Record<PlotVisibilityKeys, boolean>>(initialVisibility);
  
  const initialAvailability = useMemo(() =>
    Object.fromEntries(
      plotConfigsInternal.map(pc => [pc.dataKey, 'pending'])
    ) as Record<PlotVisibilityKeys, SeriesAvailabilityStatus>,
    [plotConfigsInternal]
  );

  const [seriesDataAvailability, setSeriesDataAvailability] = useState<Record<PlotVisibilityKeys, SeriesAvailabilityStatus>>(initialAvailability);

  useEffect(() => {
    if (plotConfigsInternal.length > 0) {
      const newVisibility = Object.fromEntries(
        plotConfigsInternal.map(pc => [pc.dataKey, plotVisibility[pc.dataKey] ?? true]) // Preserve existing or default to true
      ) as Record<PlotVisibilityKeys, boolean>;
      setPlotVisibility(newVisibility);

      const newAvailability = Object.fromEntries(
         plotConfigsInternal.map(pc => [pc.dataKey, seriesDataAvailability[pc.dataKey] ?? 'pending'])
      ) as Record<PlotVisibilityKeys, SeriesAvailabilityStatus>;
      setSeriesDataAvailability(newAvailability);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotConfigsInternal]); // Rerun when plotConfigsInternal is initialized


  useEffect(() => {
    if (isLoading) {
      setSeriesDataAvailability(prev => 
        Object.fromEntries(plotConfigsInternal.map(pc => [pc.dataKey, 'pending'])) as Record<PlotVisibilityKeys, SeriesAvailabilityStatus>
      );
      return;
    }
    
    const newAvailability: Partial<Record<PlotVisibilityKeys, SeriesAvailabilityStatus>> = {};
    const newVisibilityState: Partial<Record<PlotVisibilityKeys, boolean>> = {};

    if (!combinedData || combinedData.length === 0) {
      plotConfigsInternal.forEach(pc => {
        newAvailability[pc.dataKey] = 'unavailable';
        newVisibilityState[pc.dataKey] = plotVisibility[pc.dataKey] ?? false; 
      });
    } else {
      plotConfigsInternal.forEach(pc => {
        const hasData = combinedData.some(
          point => {
            const val = point[pc.dataKey as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          }
        );
        newAvailability[pc.dataKey] = hasData ? 'available' : 'unavailable';
        newVisibilityState[pc.dataKey] = plotVisibility[pc.dataKey] === undefined ? hasData : plotVisibility[pc.dataKey];
      });
    }
    setSeriesDataAvailability(newAvailability as Record<PlotVisibilityKeys, SeriesAvailabilityStatus>);
    setPlotVisibility(newVisibilityState as Record<PlotVisibilityKeys, boolean>);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [combinedData, isLoading, plotConfigsInternal]); // plotVisibility removed to avoid loop with its own setter


  useEffect(() => {
    if (combinedData && combinedData.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(combinedData.length -1);
    } else if ((!combinedData || combinedData.length === 0)) {
      setBrushStartIndex(0);
      setBrushEndIndex(undefined);
    }
  }, [combinedData, brushEndIndex]);

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

  const handlePlotVisibilityChange = useCallback((key: PlotVisibilityKeys, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  const handleMovePlot = useCallback((index: number, direction: 'up' | 'down') => {
    setPlotConfigsInternal(prevConfigs => {
      const newConfigs = [...prevConfigs];
      if (direction === 'up' && index > 0) {
        [newConfigs[index - 1], newConfigs[index]] = [newConfigs[index], newConfigs[index - 1]];
      } else if (direction === 'down' && index < newConfigs.length - 1) {
        [newConfigs[index + 1], newConfigs[index]] = [newConfigs[index], newConfigs[index + 1]];
      }
      return newConfigs;
    });
  }, []);


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
          <p>No data available for the selected criteria.</p>
          <p className="text-sm">Try adjusting the location or date range.</p>
        </div>
      );
  }
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-grow flex flex-col space-y-1 overflow-y-auto pr-1">
        {plotConfigsInternal.map((config, index) => {
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

          const lastDataPointWithValidValue = [...transformedDisplayData].reverse().find(p => {
            const val = p[config.dataKey as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          });

          const currentValue = lastDataPointWithValidValue ? lastDataPointWithValidValue[config.dataKey as keyof CombinedDataPoint] as number | undefined : undefined;
          
          let displayValue = "";
          if (isPlotCurrentlyVisible && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
            displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits: 1})}${config.unit || ''}`;
          }

          const hasValidDataForSeriesInView = transformedDisplayData.some(p => p[config.dataKey as keyof CombinedDataPoint] !== undefined && !isNaN(Number(p[config.dataKey as keyof CombinedDataPoint])));

          return (
            <div key={config.dataKey as string} className="border rounded-md p-1.5 shadow-sm bg-card flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-1 pt-0.5 text-xs">
                <div className="flex items-center gap-1.5">
                   <Checkbox
                        id={`visibility-${config.dataKey}-${index}`}
                        checked={isPlotCurrentlyVisible}
                        onCheckedChange={(checked) => handlePlotVisibilityChange(config.dataKey, !!checked)}
                        className="h-3.5 w-3.5"
                    />
                    <Label htmlFor={`visibility-${config.dataKey}-${index}`} className="flex items-center gap-1 cursor-pointer">
                        <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {config.title}
                          {config.dataKey === 'seaLevelHeightMsl' && config.stationName && ` (${config.stationName})`}
                        </span>
                    </Label>
                  {availabilityStatus === 'pending' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin ml-1" />}
                  {availabilityStatus === 'available' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />}
                  {availabilityStatus === 'unavailable' && <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />}
                </div>
                <div className="flex items-center">
                    {isPlotCurrentlyVisible && displayValue && (
                        <span className="text-muted-foreground text-xs ml-auto pl-2">{displayValue}</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleMovePlot(index, 'up')} disabled={index === 0}>
                        <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleMovePlot(index, 'down')} disabled={index === plotConfigsInternal.length - 1}>
                        <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                </div>
              </div>

              {isPlotCurrentlyVisible && (
                <div className="flex-grow h-[80px] mt-1">
                  {availabilityStatus === 'available' && hasValidDataForSeriesInView ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={transformedDisplayData} margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
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
                         <RechartsTooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', fontSize: '0.6rem' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: number, name: string, props) => [`${value.toFixed(1)}${config.unit || ''}`, config.title]}
                            labelFormatter={(label) => format(parseISO(label), 'MMM dd, HH:mm')}
                        />
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
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                      {availabilityStatus === 'available' ? "No data points for selected time range." : "Data unavailable for this plot."}
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
                height={60} 
                angle={-45}
                textAnchor="end"
                dy={5} 
                interval="preserveStartEnd"
              />
               <Line dataKey={plotConfigsInternal.find(p => plotVisibility[p.dataKey] && seriesDataAvailability[p.dataKey] === 'available')?.dataKey || plotConfigsInternal[0]?.dataKey} stroke="transparent" dot={false} />
              <Brush
                dataKey="time"
                height={14}
                stroke="hsl(var(--primary))"
                fill="transparent"
                tickFormatter={formatDateTickBrush}
                travellerWidth={8}
                startIndex={brushStartIndex}
                endIndex={brushEndIndex}
                onChange={handleBrushChangeLocal}
                y={5} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
