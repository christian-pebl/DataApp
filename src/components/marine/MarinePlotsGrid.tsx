
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Tooltip as RechartsTooltip, LabelList, ReferenceLine } from 'recharts';
import type { CombinedDataPoint, CombinedParameterKey, ParameterConfigItem } from '@/app/om-marine-explorer/shared';
import { PARAMETER_CONFIG, ALL_PARAMETERS, KNOTS_CONVERSION_FACTOR } from '@/app/om-marine-explorer/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Info, ChevronUp, ChevronDown, Thermometer, Wind as WindIcon, CloudSun, Compass as CompassIcon, Waves, Sailboat, Timer as TimerIcon, Sun as SunIcon, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';


const formatDateTickBrush = (timeValue: string | number): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    return format(dateObj, 'EEE, dd/MM');
  } catch (e) {
    return String(timeValue);
  }
};

type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';

type PlotConfigInternal = ParameterConfigItem & { 
  dataKey: CombinedParameterKey; 
  Icon: LucideIcon; 
  isDirectional?: boolean;
  dataTransform?: (value: number | null | undefined) => number | null | undefined 
};

// A simple arrow shape for the data labels
const DirectionArrow = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="14" height="14" viewBox="0 0 24 24" 
        fill="currentColor" stroke="hsl(var(--background))" 
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" 
        className={cn("lucide lucide-navigation", className)}
        {...props}
    >
        <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
    </svg>
);


// Custom Label for Directional Plots
const DirectionLabel = (props: any) => {
    const { x, y, value, index } = props;

    // Only render for every 10th item to prevent clutter
    if (index % 10 !== 0 || value === null || value === undefined) {
        return null;
    }

    return (
        <foreignObject x={x - 7} y={y - 7} width="14" height="14">
            <DirectionArrow
                style={{ transform: `rotate(${value + 180}deg)`, transformOrigin: 'center center' }} 
                className="text-foreground/80"
            />
        </foreignObject>
    );
};


const PlotRow = React.memo(({
  config,
  index,
  plotCount,
  displayData,
  isPlotVisible,
  availabilityStatus,
  dailyReferenceLines,
  onVisibilityChange,
  onMove
}: {
  config: PlotConfigInternal;
  index: number;
  plotCount: number;
  displayData: CombinedDataPoint[];
  isPlotVisible: boolean;
  availabilityStatus: SeriesAvailabilityStatus;
  dailyReferenceLines: string[];
  onVisibilityChange: (key: CombinedParameterKey, checked: boolean) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}) => {

  const isDirectional = config.isDirectional;

  const transformedDisplayData = useMemo(() => displayData.map(point => {
    const value = point[config.dataKey as keyof CombinedDataPoint];
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
      return { ...point, [config.dataKey]: null };
    }
    if (typeof value === 'number' && config.dataTransform) {
      return { ...point, [config.dataKey]: config.dataTransform(value) };
    }
    return point;
  }), [displayData, config.dataKey, config.dataTransform]);

  const hasValidDataForSeriesInView = useMemo(() => transformedDisplayData.some(p => {
    const val = p[config.dataKey as keyof CombinedDataPoint];
    return val !== null && !isNaN(Number(val));
  }), [transformedDisplayData, config.dataKey]);

  const lastDataPointWithValidValue = useMemo(() => [...transformedDisplayData].reverse().find(p => {
    const val = p[config.dataKey as keyof CombinedDataPoint];
    return val !== null && !isNaN(Number(val));
  }), [transformedDisplayData, config.dataKey]);
  
  const currentValue = lastDataPointWithValidValue ? lastDataPointWithValidValue[config.dataKey as keyof CombinedDataPoint] as number | undefined : undefined;
  
  let displayValue = "";
  if (isPlotVisible && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
    displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits: 1})}${isDirectional ? '' : config.unit || ''}`;
  }

  const IconComponent = config.Icon;

  return (
    <div key={config.dataKey as string} className="border rounded-md p-1.5 shadow-sm bg-card flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-1 pt-0.5 text-xs">
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <Checkbox
            id={`visibility-${config.dataKey}-${index}`}
            checked={isPlotVisible}
            onCheckedChange={(checked) => onVisibilityChange(config.dataKey, !!checked)}
            className="h-3.5 w-3.5 flex-shrink-0"
          />
          <Label htmlFor={`visibility-${config.dataKey}-${index}`} className="flex items-center gap-1 cursor-pointer min-w-0">
            <IconComponent className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis" title={config.name}>
              {config.name}
            </span>
          </Label>
          <div className="flex-shrink-0 flex items-center ml-1">
            {availabilityStatus === 'pending' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
            {availabilityStatus === 'available' && isPlotVisible && hasValidDataForSeriesInView && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
            {availabilityStatus !== 'pending' && isPlotVisible && (!hasValidDataForSeriesInView || availabilityStatus === 'unavailable') && <XCircle className="h-3.5 w-3.5 text-red-500" />}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0">
          {displayValue && (
            <span className={cn("text-muted-foreground text-xs ml-auto pl-2 whitespace-nowrap")}>{displayValue}
             {isDirectional && typeof currentValue === 'number' && <DirectionArrow style={{ display: 'inline-block', transform: `rotate(${currentValue + 180}deg)`, height: '1em', width: '1em', marginLeft: '0.25em', verticalAlign: 'middle' }} />}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => onMove(index, 'up')} disabled={index === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onMove(index, 'down')} disabled={index === plotCount - 1}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isPlotVisible && (
        <div className="flex-grow h-[56px] mt-1">
          {(availabilityStatus === 'available' && hasValidDataForSeriesInView) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={transformedDisplayData} margin={{ top: 5, right: 15, left: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
                {dailyReferenceLines.map(time => (
                  <ReferenceLine key={time} yAxisId={config.dataKey} x={time} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                ))}
                <YAxis
                  yAxisId={config.dataKey}
                  domain={isDirectional ? [0, 360] : ['auto', 'auto']}
                  ticks={isDirectional ? [0, 90, 180, 270, 360] : undefined}
                  tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}) : String(value)}
                  tick={{ fontSize: '0.6rem', fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  width={35} 
                />
                <XAxis dataKey="time" hide />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', fontSize: '0.6rem' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number | null | undefined, name: string, props) => { 
                    const formattedValue = (value !== null && value !== undefined && typeof value === 'number' && !isNaN(value)) 
                      ? value.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) 
                      : 'N/A';
                    return [
                       <div key="val" style={{ display: 'flex', alignItems: 'center' }}>
                         {`${formattedValue}${isDirectional ? '' : (config.unit || '')}`}
                         {isDirectional && typeof value === 'number' && <DirectionArrow style={{ transform: `rotate(${value + 180}deg)`, height: '1em', width: '1em', marginLeft: '0.5em' }} />}
                       </div>,
                       name
                    ];
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
                    yAxisId={config.dataKey}
                    type="monotone"
                    dataKey={config.dataKey as string}
                    stroke={`hsl(var(${config.color || '--chart-1'}))`}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={true}
                    name={config.name} 
                    isAnimationActive={false}
                  >
                    {isDirectional && <LabelList dataKey={config.dataKey as string} content={<DirectionLabel />} />}
                  </Line>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
              {availabilityStatus === 'pending' ? "Loading plot data..." : 
               availabilityStatus === 'unavailable' ? "Data unavailable for this parameter." : 
               availabilityStatus === 'available' && !hasValidDataForSeriesInView ? "No data points in selected range." :
               "Checking data..."
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PlotRow.displayName = 'PlotRow';


interface MarinePlotsGridProps {
  marineData: CombinedDataPoint[] | null;
  isLoading: boolean;
  error: string | null;
  plotVisibility: Record<CombinedParameterKey, boolean>;
  handlePlotVisibilityChange: (key: CombinedParameterKey, checked: boolean) => void;
}

export function MarinePlotsGrid({
  marineData,
  isLoading,
  error,
  plotVisibility,
  handlePlotVisibilityChange,
}: MarinePlotsGridProps) {
  
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  
  const [plotConfigsInternal, setPlotConfigsInternal] = useState<PlotConfigInternal[]>([]);
  const [seriesDataAvailability, setSeriesDataAvailability] = useState<Record<CombinedParameterKey, SeriesAvailabilityStatus>>({});

  useEffect(() => {
    const configs: PlotConfigInternal[] = ALL_PARAMETERS.map(key => {
      const baseConfig = PARAMETER_CONFIG[key as CombinedParameterKey];
      let dataTransformFunc: ((value: number | null | undefined) => number | null | undefined) | undefined = undefined;
      let displayUnit = baseConfig.unit;
      let iconComp: LucideIcon = Info; // Default icon
      const isDirectional = key === 'waveDirection' || key === 'windDirection10m';

      // Fallbacks if no icon is in PARAMETER_CONFIG
      if (key === 'seaLevelHeightMsl') iconComp = Waves;
      else if (key === 'waveHeight') iconComp = Sailboat;
      else if (key === 'waveDirection') iconComp = CompassIcon;
      else if (key === 'wavePeriod') iconComp = TimerIcon;
      else if (key === 'seaSurfaceTemperature') iconComp = Thermometer;
      else if (key === 'temperature2m') iconComp = Thermometer;
      else if (key === 'windSpeed10m') iconComp = WindIcon;
      else if (key === 'windDirection10m') iconComp = CompassIcon;
      else if (key === 'ghi') iconComp = SunIcon;
      
      if (key === 'windSpeed10m' && baseConfig.apiSource === 'weather') {
        displayUnit = 'knots'; 
        dataTransformFunc = (value) => {
          if (typeof value !== 'number' || isNaN(value)) return undefined; 
          return parseFloat((value * KNOTS_CONVERSION_FACTOR).toFixed(1));
        }
      }
      
      return {
        ...baseConfig,
        dataKey: key as CombinedParameterKey,
        unit: displayUnit,
        Icon: iconComp,
        color: baseConfig.color || '--chart-1',
        isDirectional,
        dataTransform: dataTransformFunc,
      };
    });
    setPlotConfigsInternal(configs);
  }, []);

  useEffect(() => {
    if (isLoading) {
      const pendingAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
      ALL_PARAMETERS.forEach(key => {
        pendingAvailability[key as CombinedParameterKey] = 'pending';
      });
      setSeriesDataAvailability(pendingAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
      return;
    }
    
    const newAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
    if (!marineData || marineData.length === 0) {
      ALL_PARAMETERS.forEach(key => {
        newAvailability[key as CombinedParameterKey] = 'unavailable';
      });
    } else {
      ALL_PARAMETERS.forEach(key => {
        const hasData = marineData.some(
          point => {
            const val = point[key as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          }
        );
        newAvailability[key as CombinedParameterKey] = hasData ? 'available' : 'unavailable';
      });
    }
    setSeriesDataAvailability(newAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
  }, [marineData, isLoading]);

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
    return slicedData;
  }, [marineData, brushStartIndex, brushEndIndex]);

  const dailyReferenceLines = useMemo(() => {
    if (!marineData || marineData.length === 0) return [];
    const dailyTimestamps = new Set<string>();

    marineData.forEach(point => {
      try {
        const date = parseISO(point.time);
        if (isValid(date)) {
          // Get the ISO string for the start of the day
          const dayStartISO = startOfDay(date).toISOString();
          dailyTimestamps.add(dayStartISO);
        }
      } catch (e) {
        // ignore invalid time format
      }
    });

    // The reference lines need to match exact timestamps in the data.
    // We find the first timestamp for each day.
    return Array.from(dailyTimestamps).map(dayStartISO => {
        return marineData.find(p => p.time.startsWith(dayStartISO.substring(0, 10)))?.time;
    }).filter((t): t is string => !!t);

  }, [marineData]);

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
        <AlertCircle className="h-10 w-10 mb-2" />
        <p className="font-semibold">Error Fetching Data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }
  
  if (plotConfigsInternal.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
        <Info className="h-10 w-10 mb-2" />
        <p>Plot configurations not loaded.</p>
      </div>
    );
  }
  
  if ((!marineData || marineData.length === 0) && !isLoading && !error) {
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
        {plotConfigsInternal.map((config, index) => (
          <PlotRow
            key={config.dataKey}
            config={config}
            index={index}
            plotCount={plotConfigsInternal.length}
            displayData={displayData}
            isPlotVisible={plotVisibility[config.dataKey] ?? false}
            availabilityStatus={seriesDataAvailability[config.dataKey] || 'pending'}
            dailyReferenceLines={dailyReferenceLines}
            onVisibilityChange={handlePlotVisibilityChange}
            onMove={handleMovePlot}
          />
        ))}
      </div>

      {marineData && marineData.length > 0 && (
        <div className="h-[48px] w-full border rounded-md p-1 shadow-sm bg-card mt-2 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={marineData} margin={{ top: 5, right: 25, left: 25, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tickFormatter={formatDateTickBrush}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.65rem' }}
                height={15}
                interval="preserveStartEnd"
              />
              <Brush
                dataKey="time"
                height={20}
                stroke="hsl(var(--primary))"
                fill="transparent"
                tickFormatter={() => ""} // Hide labels on brush itself
                travellerWidth={8}
                startIndex={brushStartIndex}
                endIndex={brushEndIndex}
                onChange={handleBrushChangeLocal}
                y={20} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

    
