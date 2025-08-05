
"use client";

import React, { useMemo } from 'react';
import { parseISO, startOfDay, format, isValid } from 'date-fns';
import { scaleLinear } from 'd3-scale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined | null;
}

interface HeatmapDisplayProps {
  data: DataPoint[];
  series: string[];
  containerHeight: number;
}

interface ProcessedCell {
  date: string; // YYYY-MM-DD
  series: string;
  value: number;
  count: number;
}

export function HeatmapDisplay({ data, series, containerHeight }: HeatmapDisplayProps) {
  
  const processedData = useMemo(() => {
    const dailyData = new Map<string, { sum: number; count: number }>();
    const allValues: number[] = [];

    data.forEach(point => {
      const date = parseISO(point.time as string);
      if (!isValid(date)) return;
      const dayKey = format(startOfDay(date), 'yyyy-MM-dd');

      series.forEach(s => {
        const value = point[s];
        if (value !== null && value !== undefined && typeof value === 'number' && !isNaN(value)) {
          const cellKey = `${dayKey}__${s}`;
          const existing = dailyData.get(cellKey) || { sum: 0, count: 0 };
          existing.sum += value;
          existing.count++;
          dailyData.set(cellKey, existing);
        }
      });
    });

    const cells: ProcessedCell[] = [];
    dailyData.forEach((stats, key) => {
      const [date, seriesName] = key.split('__');
      if (stats.count > 0) {
        const avg = stats.sum / stats.count;
        cells.push({ date, series: seriesName, value: avg, count: stats.count });
        allValues.push(avg);
      }
    });

    const uniqueDays = [...new Set(cells.map(c => c.date))].sort();
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    return { cells, uniqueDays, series, minValue, maxValue };
  }, [data, series]);

  const colorScale = useMemo(() => {
    const minColor = 'hsl(var(--muted))';
    const maxColor = 'hsl(var(--primary))';
    
    return scaleLinear<string>()
      .domain([processedData.minValue, processedData.maxValue])
      .range([minColor, maxColor]);
  }, [processedData.minValue, processedData.maxValue]);
  
  if (!data || data.length === 0 || series.length === 0) {
    return (
      <div style={{ height: `${containerHeight}px` }} className="flex items-center justify-center text-muted-foreground text-sm p-2 border rounded-md bg-muted/20">
        No data available for heatmap view.
      </div>
    );
  }

  const { cells, uniqueDays, series: visibleSeries } = processedData;
  const cellMap = new Map<string, ProcessedCell>(cells.map(c => [`${c.date}__${c.series}`, c]));

  return (
    <div 
      style={{ height: `${containerHeight}px` }} 
      className="overflow-auto border rounded-md p-2 bg-muted/20"
    >
      <TooltipProvider>
        <div 
          className="grid gap-px"
          style={{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${uniqueDays.length}, minmax(40px, 1fr))`}}
        >
          {/* Header Row */}
          <div className="sticky top-0 bg-background/95 backdrop-blur-sm p-1 text-xs font-medium text-muted-foreground text-left z-10">Series</div>
          {uniqueDays.map(day => (
            <div key={day} className="sticky top-0 bg-background/95 backdrop-blur-sm p-1 text-xs font-medium text-muted-foreground text-center z-10">
              {format(parseISO(day), 'dd MMM')}
            </div>
          ))}

          {/* Data Rows */}
          {visibleSeries.map(s => (
            <React.Fragment key={s}>
              <div className="p-1 text-xs font-medium text-foreground truncate sticky left-0 bg-background/95 backdrop-blur-sm" title={s}>{s}</div>
              {uniqueDays.map(day => {
                const cell = cellMap.get(`${day}__${s}`);
                const cellStyle = cell ? { backgroundColor: colorScale(cell.value) } : {};
                
                return (
                  <Tooltip key={`${s}-${day}`} delayDuration={100}>
                    <TooltipTrigger asChild>
                      <div 
                        className={cn(
                          "w-full h-10 flex items-center justify-center rounded-sm text-xs",
                          cell ? 'text-primary-foreground' : 'bg-muted/30'
                        )}
                        style={cellStyle}
                      >
                        {cell ? cell.value.toFixed(1) : '-'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-bold">{format(parseISO(day), 'PPP')}</p>
                      <p>{s}: {cell ? cell.value.toFixed(2) : 'No data'}</p>
                      {cell && <p className="text-muted-foreground text-xs">({cell.count} records)</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}
