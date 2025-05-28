
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Tooltip as RechartsTooltip, Label as RechartsYAxisLabel } from 'recharts';
import type { CombinedDataPoint, CombinedParameterKey, ParameterConfigItem } from '@/app/om-marine-explorer/shared';
import { PARAMETER_CONFIG, ALL_PARAMETERS } from '@/app/om-marine-explorer/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Info, ChevronUp, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

const MPH_CONVERSION_FACTOR = 2.23694; // m/s to mph

type PlotVisibilityState = Record<CombinedParameterKey, boolean>;
type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';

const formatDateTickBrush = (timeValue: string | number): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    return format(dateObj, 'dd/MM/yy');
  } catch (e) {
    return String(timeValue);
  }
};

export interface MarinePlotsGridProps {
  marineData: CombinedDataPoint[] | null;
  isLoading: boolean;
  error: string | null;
}

export function MarinePlotsGrid({
  marineData,
  isLoading,
  error,
}: MarinePlotsGridProps) {
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const initialVisibility = useMemo(() => {
     const visibility: Partial<Record<CombinedParameterKey, boolean>> = {};
    ALL_PARAMETERS.forEach((key, index) => {
      visibility[key as CombinedParameterKey] = index < 2; // Select first two by default
    });
    return visibility as Record<CombinedParameterKey, boolean>;
  }, []);
  
  const [plotVisibility, setPlotVisibility] = useState<Record<CombinedParameterKey, boolean>>(initialVisibility);

  const [plotConfigsInternal, setPlotConfigsInternal] = useState<Array<ParameterConfigItem & { dataKey: CombinedParameterKey; Icon: LucideIcon; dataTransform?: (value: number) => number; }>>([]);
  const [seriesDataAvailability, setSeriesDataAvailability] = useState<Record<CombinedParameterKey, SeriesAvailabilityStatus>>({});

  useEffect(() => {
    const configs = ALL_PARAMETERS.map(key => {
      const baseConfig = PARAMETER_CONFIG[key as CombinedParameterKey];
      let dataTransformFunc: ((value: number) => number) | undefined = undefined;
      let displayUnit = baseConfig.unit;

      if (key === 'windSpeed10m' && baseConfig.apiSource === 'weather') {
        // Assuming API provides m/s, convert to mph for display
        displayUnit = 'mph';
        dataTransformFunc = (value: number /* m/s */) => parseFloat((value * MPH_CONVERSION_FACTOR).toFixed(1));
      }
      
      return {
        ...baseConfig,
        dataKey: key as CombinedParameterKey,
        unit: displayUnit,
        Icon: (baseConfig as { icon?: LucideIcon }).icon || Info,
        dataTransform: dataTransformFunc,
      };
    }).sort((a, b) => ALL_PARAMETERS.indexOf(a.dataKey) - ALL_PARAMETERS.indexOf(b.dataKey));
    setPlotConfigsInternal(configs);
  }, []);

  useEffect(() => {
    if (isLoading) {
      setSeriesDataAvailability(prev => {
        const newState = { ...prev };
        plotConfigsInternal.forEach(pc => {
          newState[pc.dataKey] = 'pending';
        });
        return newState;
      });
      return;
    }
    
    const newAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
    if (!marineData || marineData.length === 0) {
      plotConfigsInternal.forEach(pc => {
        newAvailability[pc.dataKey] = 'unavailable';
      });
    } else {
      plotConfigsInternal.forEach(pc => {
        const hasData = marineData.some(
          point => {
            const val = point[pc.dataKey as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          }
        );
        newAvailability[pc.dataKey] = hasData ? 'available' : 'unavailable';
      });
    }
    setSeriesDataAvailability(newAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
  }, [marineData, isLoading, plotConfigsInternal]);


  useEffect(() => {
    if (marineData && marineData.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(marineData.length - 1);
    } else if ((!marineData || marineData.length === 0)) {
      setBrushStartIndex(0);
      setBrushEndIndex(undefined);
    }
  }, [marineData, brushEndIndex]);

  const handleBrushChangeLocal = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };

  const displayData = useMemo(() => {
    if (!marineData || marineData.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) {
      return [];
    }
    const start = Math.max(0, brushStartIndex);
    const end = Math.min(marineData.length - 1, brushEndIndex);
    return marineData.slice(start, end + 1);
  }, [marineData, brushStartIndex, brushEndIndex]);

  const handlePlotVisibilityChange = useCallback((key: CombinedParameterKey, checked: boolean) => {
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


  if (isLoading && (!marineData || marineData.length === 0)) { 
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        <Loader2 className="animate-spin h-8 w-8 text-primary mr-2" />
        Fetching data...
      </div>
    );
  }

  if (error && (!marineData || marineData.length === 0)) { 
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
        <Info className="h-10 w-10 mb-2" />
        <p className="font-semibold">Error Fetching Data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  
  if (!marineData || marineData.length === 0) {
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
          const isVisible = plotVisibility[config.dataKey];
          
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
          if (isVisible && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
            displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits: 1})}${config.unit || ''}`;
          }

          const hasValidDataForSeriesInView = transformedDisplayData.some(p => p[config.dataKey as keyof CombinedDataPoint] !== undefined && !isNaN(Number(p[config.dataKey as keyof CombinedDataPoint])));

          return (
            <div key={config.dataKey as string} className="border rounded-md p-1.5 shadow-sm bg-card flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-1 pt-0.5 text-xs">
                <div className="flex flex-1 items-center gap-1.5 min-w-0">
                  <Checkbox
                    id={`visibility-${config.dataKey}-${index}`}
                    checked={isVisible}
                    onCheckedChange={(checked) => handlePlotVisibilityChange(config.dataKey, !!checked)}
                    className="h-3.5 w-3.5"
                  />
                  <Label htmlFor={`visibility-${config.dataKey}-${index}`} className="flex items-center gap-1 cursor-pointer min-w-0">
                    <IconComponent className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis" title={config.name}>
                      {config.name}
                    </span>
                  </Label>
                  <div className="flex-shrink-0 flex items-center">
                    {isLoading && availabilityStatus === 'pending' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin ml-1" />}
                    {!isLoading && availabilityStatus === 'available' && isVisible && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-1" />}
                    {!isLoading && availabilityStatus === 'unavailable' && isVisible && <XCircle className="h-3.5 w-3.5 text-red-500 ml-1" />}
                  </div>
                </div>
                <div className="flex items-center flex-shrink-0">
                    {displayValue && (
                        <span className={cn("text-muted-foreground text-xs ml-auto pl-2 whitespace-nowrap")}>{displayValue}</span>
                    )}
                    <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleMovePlot(index, 'up')} disabled={index === 0}>
                        <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleMovePlot(index, 'down')} disabled={index === plotConfigsInternal.length - 1}>
                        <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                </div>
              </div>

              {isVisible && (
                <div className="flex-grow h-[80px] mt-1">
                  {(availabilityStatus === 'available' && hasValidDataForSeriesInView) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={transformedDisplayData} margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
                        <YAxis
                          domain={['auto', 'auto']}
                          tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}) : String(value)}
                          tick={{ fontSize: '0.6rem', fill: 'hsl(var(--muted-foreground))' }}
                          stroke="hsl(var(--border))"
                          width={35}
                          axisLine={false}
                          tickLine={false}
                        />
                        <XAxis dataKey="time" hide />
                         <RechartsTooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', fontSize: '0.6rem' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: number, name: string, props) => {
                                const currentConfig = plotConfigsInternal.find(pc => pc.dataKey === name);
                                return [`${value.toFixed(1)}${currentConfig?.unit || ''}`, currentConfig?.name || name];
                            }}
                            labelFormatter={(label) => {
                                try {
                                    return format(parseISO(label), 'MMM dd, HH:mm');
                                } catch {
                                    return label;
                                }
                            }}
                        />
                        <Line
                          type="monotone"
                          dataKey={config.dataKey as string}
                          stroke={`hsl(var(${config.color || '--chart-1'}))} `}
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                          name={config.dataKey as string}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                      {availabilityStatus === 'pending' ? "Loading plot data..." : "Data unavailable for this plot."}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {marineData && marineData.length > 0 && (
        <div className="h-[70px] w-full border rounded-md p-1 shadow-sm bg-card mt-2 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={marineData} margin={{ top: 5, right: 25, left: 25, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tickFormatter={formatDateTickBrush}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.6rem' }}
                height={50} 
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
