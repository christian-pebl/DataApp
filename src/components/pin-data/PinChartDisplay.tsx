"use client";

import React, { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Tooltip as RechartsTooltip } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronUp, ChevronDown, BarChart3, Info, TableIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import type { ParsedDataPoint } from './csvParser';

interface PinChartDisplayProps {
  data: ParsedDataPoint[];
  fileType: 'GP' | 'FPOD' | 'Subcam';
  timeColumn: string | null;
  showYAxisLabels?: boolean;
  fileName?: string;
  dataSource?: 'csv' | 'marine';
}

// Color palette matching the marine data theme
const CHART_COLORS = [
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--chart-6', '--chart-7', '--chart-8', '--chart-9'
];

interface ParameterState {
  visible: boolean;
  color: string;
}

const formatDateTick = (timeValue: string | number, dataSource?: 'csv' | 'marine'): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    // Use different formats based on data source
    if (dataSource === 'marine') {
      return format(dateObj, 'EEE, dd/MM');
    } else {
      // Format for CSV data - using DD/MM for chart readability
      return format(dateObj, 'dd/MM');
    }
  } catch (e) {
    return String(timeValue);
  }
};

export function PinChartDisplay({ data, fileType, timeColumn, showYAxisLabels = false, fileName, dataSource = 'csv' }: PinChartDisplayProps) {
  // Toggle state for switching between chart and table view
  const [showTable, setShowTable] = useState(false);
  
  // Get all parameters (for table view)
  const allParameters = useMemo(() => {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    return Object.keys(firstRow).filter(key => key !== 'time' && key !== timeColumn);
  }, [data, timeColumn]);
  
  // Get all numeric parameters (excluding time)
  const numericParameters = useMemo(() => {
    if (data.length === 0) return [];
    
    const firstRow = data[0];
    return Object.keys(firstRow)
      .filter(key => key !== 'time' && key !== timeColumn)
      .filter(key => {
        // Check if parameter has numeric values
        return data.some(row => {
          const value = row[key];
          return typeof value === 'number' && !isNaN(value);
        });
      });
  }, [data, timeColumn]);

  // Initialize parameter visibility state
  const [parameterStates, setParameterStates] = useState<Record<string, ParameterState>>(() => {
    const initialState: Record<string, ParameterState> = {};
    numericParameters.forEach((param, index) => {
      initialState[param] = {
        visible: index < 5, // Show first 5 parameters by default
        color: CHART_COLORS[index % CHART_COLORS.length]
      };
    });
    return initialState;
  });

  // Brush state for time range selection
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  // Get visible parameters
  const visibleParameters = useMemo(() => {
    return numericParameters.filter(param => parameterStates[param]?.visible);
  }, [numericParameters, parameterStates]);

  // Get data slice for current brush selection
  const displayData = useMemo(() => {
    if (data.length === 0) return [];
    
    const start = Math.max(0, brushStartIndex);
    const end = Math.min(data.length - 1, brushEndIndex ?? data.length - 1);
    return data.slice(start, end + 1);
  }, [data, brushStartIndex, brushEndIndex]);

  // Set initial brush end index
  React.useEffect(() => {
    if (data.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(data.length - 1);
    }
  }, [data.length, brushEndIndex]);

  const handleBrushChange = (brushData: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(brushData.startIndex ?? 0);
    setBrushEndIndex(brushData.endIndex);
  };

  const toggleParameterVisibility = (parameter: string) => {
    setParameterStates(prev => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        visible: !prev[parameter]?.visible
      }
    }));
  };

  const moveParameter = (parameter: string, direction: 'up' | 'down') => {
    // This would implement parameter reordering - simplified for now
    console.log(`Move ${parameter} ${direction}`);
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-center">
        <div className="text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No data to display</p>
        </div>
      </div>
    );
  }

  if (numericParameters.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-center">
        <div className="text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No numeric parameters found</p>
          <p className="text-xs opacity-70">Check data format</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toggle Switch - at the top */}
      <div className="flex items-center justify-between">
        {/* File name */}
        {fileName && (
          <div className="text-xs text-muted-foreground font-medium">
            {fileName}
          </div>
        )}
        
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Chart</span>
          <Switch 
            checked={showTable} 
            onCheckedChange={setShowTable}
            className="h-5 w-9"
          />
          <span className="text-xs text-muted-foreground">Table</span>
          <TableIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Chart or Table View */}
      {showTable ? (
        // Table View
        <div className="h-96 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Time</TableHead>
                {allParameters.map(param => (
                  <TableHead key={param} className="text-xs">{param}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 100).map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="text-xs font-mono">
                    {row.time || 'N/A'}
                  </TableCell>
                  {allParameters.map(param => (
                    <TableCell key={param} className="text-xs">
                      {row[param] !== null && row[param] !== undefined 
                        ? (typeof row[param] === 'number' 
                          ? Number(row[param]).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 3})
                          : String(row[param])
                        )
                        : 'N/A'
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.length > 100 && (
            <div className="p-2 text-xs text-center text-muted-foreground border-t">
              Showing first 100 of {data.length} rows
            </div>
          )}
        </div>
      ) : (
        // Chart View (existing chart code)
        <div className="flex gap-3">
          {/* Main Chart - Takes up most space */}
          <div className="flex-1 space-y-3">
      {visibleParameters.length > 0 && (
        <div className="h-64 w-full border rounded-md bg-card p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData} margin={{ top: 5, right: 12, left: 5, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
              
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--border))"
                tickFormatter={(value) => formatDateTick(value, dataSource)}
              />
              
              <YAxis
                tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--border))"
                width={showYAxisLabels ? 80 : 50}
                label={showYAxisLabels ? { 
                  value: 'Value', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))' }
                } : undefined}
              />
              
              <RechartsTooltip
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))', 
                  fontSize: '0.7rem',
                  padding: '8px',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number, name: string) => [
                  typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:3}) : 'N/A',
                  name
                ]}
                labelFormatter={(label) => {
                  try {
                    const date = parseISO(String(label));
                    return isValid(date) ? format(date, 'EEE, MMM dd, HH:mm:ss') : String(label);
                  } catch {
                    return String(label);
                  }
                }}
                isAnimationActive={false}
              />
              
              {visibleParameters.map((parameter) => {
                const state = parameterStates[parameter];
                return (
                  <Line
                    key={parameter}
                    type="monotone"
                    dataKey={parameter}
                    stroke={`hsl(var(${state.color}))`}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={false}
                    name={parameter}
                    isAnimationActive={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Time Range Brush */}
      {data.length > 10 && (
        <div className="h-12 w-full border rounded-md bg-card p-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 15, left: 15, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tickFormatter={(value) => formatDateTick(value, dataSource)}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.6rem' }}
                height={12}
                interval="preserveStartEnd"
              />
              <Brush
                dataKey="time"
                height={18}
                stroke="hsl(var(--primary))"
                fill="transparent"
                tickFormatter={() => ""}
                travellerWidth={10}
                startIndex={brushStartIndex}
                endIndex={brushEndIndex}
                onChange={handleBrushChange}
                y={15}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

          </div>

          {/* Parameter Controls - On the right side */}
          <div className="w-64 space-y-2">
            <p className="text-xs font-medium">Parameters ({visibleParameters.length} visible)</p>
            
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {numericParameters.map((parameter, index) => {
                const state = parameterStates[parameter];
                if (!state) return null;

                return (
                  <div key={parameter} className="flex items-center justify-between p-1.5 rounded border bg-card/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Checkbox
                        id={`param-${parameter}`}
                        checked={state.visible}
                        onCheckedChange={() => toggleParameterVisibility(parameter)}
                        className="h-3 w-3"
                      />
                      <Label 
                        htmlFor={`param-${parameter}`} 
                        className="text-xs cursor-pointer truncate flex-1"
                        title={parameter}
                      >
                        {parameter}
                      </Label>
                      <div 
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: `hsl(var(${state.color}))` }}
                      />
                    </div>
                    
                    <div className="flex items-center">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5" 
                        onClick={() => moveParameter(parameter, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5" 
                        onClick={() => moveParameter(parameter, 'down')}
                        disabled={index === numericParameters.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}