
"use client";

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { parseISO, startOfDay, format, isValid, eachDayOfInterval } from 'date-fns';
import { scaleLinear, scaleBand } from 'd3-scale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, Brush } from 'recharts';


interface DataPoint {
  time: string | number;
  [key:string]: string | number | undefined | null;
}

interface HeatmapDisplayProps {
  data: DataPoint[];
  series: string[];
  containerHeight: number;
  brushStartIndex?: number;
  brushEndIndex?: number;
  onBrushChange?: (newIndex: { startIndex?: number; endIndex?: number }) => void;
  timeFormat?: 'short' | 'full';
  customColor?: string; // Custom color for heatmap (hex format)
}

interface ProcessedCell {
  date: string; // YYYY-MM-DD
  series: string;
  value: number;
  count: number;
}

interface OverviewDataPoint {
    time: string;
    value: number;
}

export function HeatmapDisplay({
    data,
    series,
    containerHeight,
    brushStartIndex,
    brushEndIndex,
    onBrushChange,
    timeFormat = 'short',
    customColor
}: HeatmapDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  const BRUSH_CHART_HEIGHT = 60;
  const heatmapHeight = onBrushChange ? containerHeight - BRUSH_CHART_HEIGHT : containerHeight;
  const margin = { top: 20, right: 20, bottom: 60, left: 150 };

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) {
        return;
      }
      const { width } = entries[0].contentRect;
      setSvgDimensions({ width, height: heatmapHeight });
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [heatmapHeight]);

  const { processedData } = useMemo(() => {
    if (!data || data.length === 0 || brushStartIndex === undefined || brushEndIndex === undefined) { 
        return { 
            processedData: { cells: [], uniqueDays: [], series: [], minValue: 0, maxValue: 0, dateInterval: null },
        };
    }

    const start = Math.max(0, brushStartIndex);
    const end = Math.min(data.length - 1, brushEndIndex);
    const visibleData = data.slice(start, end + 1);

    const dailyData = new Map<string, { sum: number; count: number }>();
    const allValues: number[] = [];
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    visibleData.forEach(point => {
      const date = parseISO(point.time as string);
      if (!isValid(date)) return;

      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;

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

    const dateInterval = minDate && maxDate ? eachDayOfInterval({ start: minDate, end: maxDate }) : [];
    if (dateInterval.length > 150) {
        const limitedEndDate = dateInterval[149];
        if(limitedEndDate) maxDate = limitedEndDate;
    }
    const finalInterval = minDate && maxDate ? eachDayOfInterval({ start: minDate, end: maxDate }) : [];

    const cells: ProcessedCell[] = [];
    dailyData.forEach((stats, key) => {
      const [dateStr, seriesName] = key.split('__');
      if (stats.count > 0 && finalInterval.some(d => format(d, 'yyyy-MM-dd') === dateStr)) {
        const avg = stats.sum / stats.count;
        cells.push({ date: dateStr, series: seriesName, value: avg, count: stats.count });
        allValues.push(avg);
      }
    });

    const uniqueDays = finalInterval.map(d => format(d, 'yyyy-MM-dd')).sort();
    const minValue = Math.min(0, ...allValues);
    const maxValue = Math.max(...allValues);

    const processedResult = { cells, uniqueDays, series, minValue, maxValue, dateInterval: finalInterval };
    return { processedData: processedResult };

  }, [data, series, brushStartIndex, brushEndIndex]);

  const colorScale = useMemo(() => {
    // Convert hex to rgba for gradient
    const hexToRgba = (hex: string, alpha: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const lightColor = customColor
      ? hexToRgba(customColor, 0.1)
      : "hsla(var(--primary) / 0.1)";
    const darkColor = customColor
      ? hexToRgba(customColor, 1.0)
      : "hsla(var(--primary) / 1.0)";

    return scaleLinear<string>()
      .domain([Math.max(0.001, processedData.minValue), processedData.maxValue])
      .range([lightColor, darkColor])
      .clamp(true);
  }, [processedData.minValue, processedData.maxValue, customColor]);
  
  if (!data || data.length === 0 || series.length === 0 || processedData.uniqueDays.length === 0) {
    return (
      <div style={{ height: `${containerHeight}px` }} className="flex items-center justify-center text-muted-foreground text-sm p-2 border rounded-md bg-muted/20">
        No data available for heatmap view. Check selected range.
      </div>
    );
  }

  const { cells, uniqueDays, series: visibleSeries } = processedData;
  const cellMap = new Map<string, ProcessedCell>(cells.map(c => [`${c.date}__${c.series}`, c]));
  
  const { width, height } = svgDimensions;
  const plotWidth = width > 0 ? width - margin.left - margin.right : 0;
  const plotHeight = height > 0 ? height - margin.top - margin.bottom : 0;

  const xScale = scaleBand<string>().domain(uniqueDays).range([0, plotWidth]).padding(0.05);
  const yScale = scaleBand<string>().domain(visibleSeries).range([0, plotHeight]).padding(0.05);
  
  const tickValues = useMemo(() => {
    if (uniqueDays.length <= 10) return uniqueDays;
    const tickInterval = Math.ceil(uniqueDays.length / 10);
    return uniqueDays.filter((_, i) => i % tickInterval === 0);
  }, [uniqueDays]);
  
  const formatDateTickBrush = (timeValue: string | number): string => {
    try {
      const dateObj = parseISO(String(timeValue));
      if (!isValid(dateObj)) return String(timeValue);
      return format(dateObj, 'dd MMM'); 
    } catch (e) {
      return String(timeValue);
    }
  };

  return (
    <div className="w-full h-full">
        <div 
          ref={containerRef}
          style={{ height: `${heatmapHeight}px` }} 
          className="w-full h-full border rounded-md p-2 bg-muted/20"
        >
          <TooltipProvider>
            <svg width="100%" height="100%">
              {plotWidth > 0 && plotHeight > 0 && (
              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Y-axis */}
                <g className="y-axis">
                  {yScale.domain().map(seriesName => (
                    <text
                      key={seriesName}
                      x={-10}
                      y={(yScale(seriesName) ?? 0) + yScale.bandwidth() / 2}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="text-xs fill-current text-muted-foreground"
                      title={seriesName}
                    >
                      {seriesName.length > 20 ? `${seriesName.substring(0, 18)}...` : seriesName}
                    </text>
                  ))}
                </g>
                
                {/* X-axis */}
                <g className="x-axis" transform={`translate(0, ${plotHeight})`}>
                  {tickValues.map(day => (
                    <g key={day} transform={`translate(${(xScale(day) ?? 0) + xScale.bandwidth() / 2}, 0)`}>
                        <text
                            transform="rotate(-45)"
                            y={10}
                            x={-5}
                            textAnchor="end"
                            dominantBaseline="middle"
                            className="text-xs fill-current text-muted-foreground"
                        >
                            {format(parseISO(day), 'dd MMM')}
                        </text>
                    </g>
                  ))}
                </g>

                {/* Heatmap Cells */}
                <g className="cells">
                  {visibleSeries.map(s => (
                    <React.Fragment key={s}>
                      {uniqueDays.map(day => {
                        const cell = cellMap.get(`${day}__${s}`);
                        const cellValue = cell?.value ?? 0;
                        const fillColor = cellValue > 0 ? colorScale(cellValue) : 'hsl(var(--muted)/0.3)';

                        // Determine font size based on cell dimensions
                        const cellWidth = xScale.bandwidth();
                        const cellHeight = yScale.bandwidth();
                        // Calculate font size - scale down for very small cells
                        const fontSize = Math.max(6, Math.min(cellWidth * 1.2, cellHeight / 1.5, 11));
                        // Show text for non-zero values with very minimal thresholds
                        // Only require minimum height, ignore width constraint
                        const showText = cell && cell.value > 0 && cellHeight > 8;

                        // Debug logging for first few cells
                        if (day === uniqueDays[0] && s === visibleSeries[0]) {
                          console.log('[HEATMAP TEXT DEBUG]', {
                            cellWidth,
                            cellHeight,
                            fontSize,
                            showText,
                            cellValue: cell?.value,
                            hasCell: !!cell,
                            reason: !showText ? (!cell ? 'no cell' : cell.value <= 0 ? 'zero value' : cellHeight <= 8 ? 'height too small' : 'unknown') : 'showing'
                          });
                        }

                        return (
                          <Tooltip key={`${s}-${day}`} delayDuration={200}>
                            <TooltipTrigger asChild>
                              <g
                                transform={`translate(${xScale(day)}, ${yScale(s)})`}
                                style={{ cursor: 'pointer' }}
                              >
                                <rect
                                  width={xScale.bandwidth()}
                                  height={yScale.bandwidth()}
                                  fill={fillColor}
                                  className="stroke-background/50 hover:stroke-foreground"
                                  strokeWidth={1}
                                  style={{ pointerEvents: 'all' }}
                                />
                                {showText && (
                                  <text
                                    x={xScale.bandwidth() / 2}
                                    y={yScale.bandwidth() / 2}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="pointer-events-none font-bold select-none"
                                    style={{
                                      fontSize: `${fontSize}px`,
                                      fill: 'white',
                                      paintOrder: 'stroke',
                                      stroke: 'rgba(200,200,200,0.7)',
                                      strokeWidth: '1.2px',
                                      strokeLinejoin: 'round'
                                    }}
                                  >
                                    {cell.value.toFixed(0)}
                                  </text>
                                )}
                              </g>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-bold text-sm">{format(parseISO(day), 'PPP')}</p>
                                <p className="text-sm">{s}: <span className="font-semibold">{cell ? cell.value.toFixed(2) : 'No data'}</span></p>
                                {cell && <p className="text-muted-foreground text-xs">({cell.count} {cell.count === 1 ? 'record' : 'records'})</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </g>
              </g>
              )}
            </svg>
          </TooltipProvider>
        </div>
        {onBrushChange && data.length > 0 && (
             <div style={{ height: `${BRUSH_CHART_HEIGHT}px`}} className="w-full mt-1 border rounded-md p-1 shadow-sm bg-card">
                 <ResponsiveContainer width="100%" height="100%">
                     <LineChart
                         data={data}
                         syncId={`brush-sync-${React.useId()}`}
                         margin={{ top: 5, right: margin.right, left: margin.left, bottom: 5 }}
                     >
                         <XAxis 
                            dataKey="time"
                            tickFormatter={formatDateTickBrush}
                            stroke="hsl(var(--muted-foreground))"
                            tick={{ fontSize: '0.65rem' }}
                            height={15}
                            interval="preserveStartEnd"
                          />
                         <Line type="monotone" dataKey={() => 0} stroke="transparent" dot={false} />
                         <Brush 
                             dataKey="time"
                             height={20}
                             stroke="hsl(var(--primary))"
                             tickFormatter={() => ""}
                             startIndex={brushStartIndex}
                             endIndex={brushEndIndex}
                             onChange={onBrushChange}
                             travellerWidth={10}
                             y={30}
                         />
                     </LineChart>
                 </ResponsiveContainer>
             </div>
        )}
    </div>
  );
}
