
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Tooltip as RechartsTooltip } from 'recharts';
import type { CombinedDataPoint, CombinedParameterKey, ParameterConfigItem } from '@/app/om-marine-explorer/shared'; // Adjusted import path
import { PARAMETER_CONFIG, ALL_PARAMETERS } from '@/app/om-marine-explorer/shared'; // Adjusted import path
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Info, ChevronUp, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';

const MPH_CONVERSION_FACTOR = 2.23694;

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

interface MarinePlotsGridProps {
  marineData: CombinedDataPoint[] | null;
  isLoading: boolean;
  error: string | null;
  plotVisibility: PlotVisibilityState;
  // handlePlotVisibilityChange and plotConfigIcons are no longer passed as props
}

export function MarinePlotsGrid({
  marineData,
  isLoading,
  error,
  plotVisibility: externalPlotVisibility, // Renamed to avoid conflict with internal state
}: MarinePlotsGridProps) {
  
  // Log incoming props
  console.log("MarinePlotsGrid PROPS:", { 
    marineDataLength: marineData ? marineData.length : 'null', 
    isLoading, 
    error, 
    externalPlotVisibility 
  });
  if (marineData && marineData.length > 0) {
    // console.log("MarinePlotsGrid - Sample marineData[0]:", marineData[0]);
  }

  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  
  // Internal state for plot configurations, allowing reordering
  const [plotConfigsInternal, setPlotConfigsInternal] = useState<Array<ParameterConfigItem & { dataKey: CombinedParameterKey; Icon: LucideIcon; dataTransform?: (value: number | null | undefined) => number | null | undefined; }>>([]);
  
  // Internal state for plot visibility if not controlled externally
  const [internalPlotVisibility, setInternalPlotVisibility] = useState<PlotVisibilityState>(externalPlotVisibility);
  const [seriesDataAvailability, setSeriesDataAvailability] = useState<Record<CombinedParameterKey, SeriesAvailabilityStatus>>({});

  // Initialize plotConfigsInternal from shared config
  useEffect(() => {
    const configs = ALL_PARAMETERS.map(key => {
      const baseConfig = PARAMETER_CONFIG[key as CombinedParameterKey];
      let dataTransformFunc: ((value: number | null | undefined) => number | null | undefined) | undefined = undefined;
      let displayUnit = baseConfig.unit;

      if (key === 'windSpeed10m' && baseConfig.apiSource === 'weather') {
        displayUnit = 'mph'; // Display in mph
        dataTransformFunc = (value) => {
          if (typeof value !== 'number') return value; // Pass through null/undefined
          return parseFloat((value * MPH_CONVERSION_FACTOR).toFixed(1));
        }
      }
      
      return {
        ...baseConfig,
        dataKey: key as CombinedParameterKey,
        unit: displayUnit,
        Icon: (baseConfig as { icon?: LucideIcon }).icon || Info,
        color: baseConfig.color || '--chart-1',
        dataTransform: dataTransformFunc,
      };
    });
    setPlotConfigsInternal(configs);
    console.log("MarinePlotsGrid - plotConfigsInternal initialized:", configs.map(c => c.dataKey));
  }, []); // Runs once on mount

  // Initialize plot visibility based on external prop or default to all true
  useEffect(() => {
    setInternalPlotVisibility(externalPlotVisibility || 
      Object.fromEntries(ALL_PARAMETERS.map(key => [key, true])) as Record<CombinedParameterKey, boolean>
    );
  }, [externalPlotVisibility]);

  // Update series data availability
  useEffect(() => {
    console.log("MarinePlotsGrid - seriesDataAvailability effect triggered. isLoading:", isLoading, "marineData length:", marineData?.length);
    if (isLoading) {
      setSeriesDataAvailability(prev => {
        const newState = { ...prev };
        plotConfigsInternal.forEach(pc => {
          newState[pc.dataKey] = 'pending';
        });
        console.log("MarinePlotsGrid - seriesDataAvailability set to pending for all:", newState);
        return newState;
      });
      return;
    }
    
    const newAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
    if (!marineData || marineData.length === 0) {
      plotConfigsInternal.forEach(pc => {
        newAvailability[pc.dataKey] = 'unavailable';
      });
      console.log("MarinePlotsGrid - No marineData, all series unavailable:", newAvailability);
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
      console.log("MarinePlotsGrid - seriesDataAvailability calculated:", newAvailability);
    }
    setSeriesDataAvailability(newAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
  }, [marineData, isLoading, plotConfigsInternal]);


  useEffect(() => {
    if (marineData && marineData.length > 0 && brushEndIndex === undefined) {
      setBrushStartIndex(0);
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
    const slicedData = marineData.slice(start, end + 1);
    console.log("MarinePlotsGrid - displayData calculated. Length:", slicedData.length, "Brush Start:", start, "Brush End:", end);
    if (slicedData.length > 0) {
      // console.log("MarinePlotsGrid - Sample displayData[0] (for brush range):", slicedData[0]);
    }
    return slicedData;
  }, [marineData, brushStartIndex, brushEndIndex]);

  const handleMovePlot = useCallback((index: number, direction: 'up' | 'down') => {
    setPlotConfigsInternal(prevConfigs => {
      const newConfigs = [...prevConfigs];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex >= 0 && targetIndex < newConfigs.length) {
        [newConfigs[index], newConfigs[targetIndex]] = [newConfigs[targetIndex], newConfigs[index]];
      }
      return newConfigs;
    });
  }, []);
  
  const handlePlotVisibilityChangeLocal = useCallback((key: CombinedParameterKey, checked: boolean) => {
    setInternalPlotVisibility(prev => ({ ...prev, [key]: checked }));
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
  
  if (!plotConfigsInternal || plotConfigsInternal.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <Info className="h-10 w-10 mb-2" />
        <p>Plot configurations not loaded.</p>
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
          const IconComponent = config.Icon || Info;
          const availabilityStatus = seriesDataAvailability[config.dataKey];
          const isVisible = internalPlotVisibility[config.dataKey]; // Use internal state
          
          const transformedDisplayData = displayData.map(point => {
            const value = point[config.dataKey as keyof CombinedDataPoint];
            if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
              return { ...point, [config.dataKey]: undefined };
            }
            if (typeof value === 'number' && config.dataTransform) {
              return { ...point, [config.dataKey]: config.dataTransform(value) };
            }
            return point;
          });
          console.log(`MarinePlotsGrid - [Plot: ${config.name}] Transformed display data sample (first 2):`, transformedDisplayData.slice(0,2));


          const lastDataPointWithValidValue = [...transformedDisplayData].reverse().find(p => {
            const val = p[config.dataKey as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          });

          const currentValue = lastDataPointWithValidValue ? lastDataPointWithValidValue[config.dataKey as keyof CombinedDataPoint] as number | undefined : undefined;
          
          let displayValue = "";
          if (isVisible && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
            displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits: 1})}${config.unit || ''}`;
          }

          const hasValidDataForSeriesInView = transformedDisplayData.some(p => {
            const val = p[config.dataKey as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          });
          
           console.log(`MarinePlotsGrid - Rendering plot for: ${config.name} (key: ${config.dataKey})`, {
            isVisible,
            availabilityStatus,
            hasValidDataForSeriesInView,
            currentValue,
            displayValue,
          });

          return (
            <div key={config.dataKey as string} className="border rounded-md p-1.5 shadow-sm bg-card flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-1 pt-0.5 text-xs">
                 {/* Left side of header: Checkbox, Icon, Title, Status */}
                <div className="flex flex-1 items-center gap-1 min-w-0">
                    <Checkbox
                        id={`visibility-${config.dataKey}-${index}`}
                        checked={isVisible}
                        onCheckedChange={(checked) => handlePlotVisibilityChangeLocal(config.dataKey, !!checked)}
                        className="h-3.5 w-3.5"
                    />
                    <Label htmlFor={`visibility-${config.dataKey}-${index}`} className="flex items-center gap-1 cursor-pointer min-w-0">
                        <IconComponent className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis" title={config.name}>
                            {config.name}
                        </span>
                    </Label>
                    <div className="flex-shrink-0 flex items-center ml-1">
                        {(isLoading && availabilityStatus === 'pending') && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
                        {(!isLoading && availabilityStatus === 'available' && isVisible && hasValidDataForSeriesInView) && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        {(!isLoading && (availabilityStatus === 'unavailable' || (availabilityStatus === 'available' && !hasValidDataForSeriesInView)) && isVisible) && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                    </div>
                </div>
                {/* Right side of header: Current Value, Reorder Buttons */}
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
                          width={35} // Reduced width for Y-axis
                          axisLine={false}
                          tickLine={false}
                        />
                        <XAxis dataKey="time" hide />
                         <RechartsTooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', fontSize: '0.6rem' }}
                            itemStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: number | null | undefined, name: string, props) => { // name is the dataKey
                                const currentConfig = plotConfigsInternal.find(pc => pc.dataKey === name);
                                const formattedValue = (value !== null && value !== undefined && typeof value === 'number' && !isNaN(value)) 
                                    ? value.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) 
                                    : 'N/A';
                                return [`${formattedValue}${currentConfig?.unit || ''}`, currentConfig?.name || name];
                            }}
                            labelFormatter={(label) => {
                                try {
                                    const date = parseISO(String(label));
                                    return isValid(date) ? format(date, 'MMM dd, HH:mm') : String(label);
                                } catch {
                                    return String(label);
                                }
                            }}
                            isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={config.dataKey as string}
                          stroke={`hsl(var(${config.color || '--chart-1'}))} `}
                          strokeWidth={1.5}
                          dot={false}
                          connectNulls
                          name={config.name} // Use config.name for tooltip title
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
                      {isLoading && availabilityStatus === 'pending' ? "Loading plot data..." : 
                       !isLoading && availabilityStatus === 'unavailable' ? "Data unavailable for this parameter." : 
                       !isLoading && availabilityStatus === 'available' && !hasValidDataForSeriesInView ? "No data points in selected range." :
                       "Checking data..."
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {marineData && marineData.length > 0 && (
        <div className="h-[65px] w-full border rounded-md p-1 shadow-sm bg-card mt-2 flex-shrink-0">
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
               <Line dataKey={plotConfigsInternal.find(p => internalPlotVisibility[p.dataKey] && seriesDataAvailability[p.dataKey] === 'available')?.dataKey || plotConfigsInternal[0]?.dataKey} stroke="transparent" dot={false} isAnimationActive={false} />
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
                y={10} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
