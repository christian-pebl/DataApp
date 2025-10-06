"use client";

import React, { useState, useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Brush, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { HexColorPicker } from 'react-colorful';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronUp, ChevronDown, BarChart3, Info, TableIcon, ChevronRight, ChevronLeft, Settings, Circle, Filter, AlertCircle, Database } from "lucide-react";
import { cn } from '@/lib/utils';
import { getParameterLabelWithUnit } from '@/lib/units';
import type { ParsedDataPoint } from './csvParser';
import { fileStorageService } from '@/lib/supabase/file-storage-service';

interface PinChartDisplayProps {
  data: ParsedDataPoint[];
  fileType: 'GP' | 'FPOD' | 'Subcam';
  timeColumn: string | null;
  showYAxisLabels?: boolean;
  fileName?: string;
  dataSource?: 'csv' | 'marine';
  // Time synchronization props
  timeAxisMode?: 'separate' | 'common';
  globalTimeRange?: { min: Date | null; max: Date | null };
  globalBrushRange?: { startIndex: number; endIndex: number | undefined };
  onBrushChange?: (brushData: { startIndex?: number; endIndex?: number }) => void;
  isLastPlot?: boolean;
  // Visibility tracking for merge feature
  onVisibilityChange?: (visibleParams: string[], paramColors: Record<string, string>) => void;
  // Default settings (for merged plots)
  defaultAxisMode?: 'single' | 'multi';
  defaultParametersExpanded?: boolean;
  // Date format toggle
  currentDateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  onDateFormatChange?: (format: 'DD/MM/YYYY' | 'MM/DD/YYYY') => void;
  // Raw CSV file for viewing original data
  rawFiles?: File[];
  // Pin ID for saving corrected files to database
  pinId?: string;
}

// Color palette matching the marine data theme
const CHART_COLORS = [
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
  '--chart-6', '--chart-7', '--chart-8', '--chart-9'
];

interface ParameterState {
  visible: boolean;
  color: string;
  opacity?: number; // 0-1 range, defaults to 1 (fully opaque)
  isSolo?: boolean;
  timeFilter?: {
    enabled: boolean;
    excludeStart: string; // "HH:mm" format
    excludeEnd: string;
  };
  movingAverage?: {
    enabled: boolean;
    windowDays: number;
    showLine: boolean;
  };
}

const formatDateTick = (timeValue: string | number, dataSource?: 'csv' | 'marine'): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    // Use dd/MM format for both CSV and marine data
    return format(dateObj, 'dd/MM');
  } catch (e) {
    return String(timeValue);
  }
};

// Intelligent Y-axis formatter with nice rounded tick spacings
const formatYAxisTick = (value: number, dataRange: number, dataMax: number): string => {
  if (!isFinite(value) || isNaN(value)) return '0';

  const absMax = Math.abs(dataMax);
  const absValue = Math.abs(value);

  // Determine decimal places based on data scale
  let decimals = 0;

  if (absMax >= 1000) {
    decimals = 0; // Large values: no decimals (e.g., 1500)
  } else if (absMax >= 100) {
    decimals = dataRange < 10 ? 1 : 0; // Medium-large: 1 decimal if small range
  } else if (absMax >= 10) {
    decimals = dataRange < 1 ? 2 : 1; // Medium: 1-2 decimals
  } else if (absMax >= 1) {
    decimals = dataRange < 0.5 ? 2 : 1; // Small: 1-2 decimals
  } else if (absMax >= 0.1) {
    decimals = 2; // Tiny: 2 decimals
  } else {
    decimals = 3; // Very tiny: 3 decimals
  }

  return value.toFixed(decimals);
};

// Fallback color palette when CSS variables aren't loaded
const FALLBACK_COLORS: Record<string, string> = {
  '--chart-1': '#3b82f6', // blue
  '--chart-2': '#10b981', // green
  '--chart-3': '#f59e0b', // amber
  '--chart-4': '#ef4444', // red
  '--chart-5': '#8b5cf6', // purple
  '--chart-6': '#06b6d4', // cyan
  '--chart-7': '#ec4899', // pink
  '--chart-8': '#f97316', // orange
  '--chart-9': '#14b8a6', // teal
};

// Convert HSL CSS variable to hex color
const cssVarToHex = (cssVar: string): string => {
  if (cssVar.startsWith('#')) return cssVar; // Already hex

  const hslValue = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar.replace('--', ''))
    .trim();

  if (!hslValue) return FALLBACK_COLORS[cssVar] || '#3b82f6'; // Use fallback palette

  // Parse HSL string like "220 100% 50%"
  const matches = hslValue.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (!matches) return FALLBACK_COLORS[cssVar] || '#3b82f6';

  const h = parseFloat(matches[1]) / 360;
  const s = parseFloat(matches[2]) / 100;
  const l = parseFloat(matches[3]) / 100;

  // HSL to RGB conversion
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Convert hex to HSL CSS variable format
const hexToHslVar = (hex: string): string => {
  // Remove # if present
  hex = hex.replace('#', '');

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

export function PinChartDisplay({
  data,
  fileType,
  timeColumn,
  showYAxisLabels = false,
  fileName,
  dataSource = 'csv',
  timeAxisMode = 'separate',
  globalTimeRange,
  globalBrushRange,
  onBrushChange,
  isLastPlot = true,
  onVisibilityChange,
  defaultAxisMode = 'single',
  defaultParametersExpanded = false,
  currentDateFormat,
  onDateFormatChange,
  rawFiles,
  pinId
}: PinChartDisplayProps) {
  // Toggle state for switching between chart and table view
  const [showTable, setShowTable] = useState(false);

  // Axis mode state - default to multi axis
  const [axisMode, setAxisMode] = useState<'single' | 'multi'>('multi');

  // Parameter panel expansion state
  const [isParameterPanelExpanded, setIsParameterPanelExpanded] = useState(defaultParametersExpanded);

  // Date format preview dialog state
  const [showDateFormatDialog, setShowDateFormatDialog] = useState(false);
  const [pendingDateFormat, setPendingDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY' | null>(null);

  // Raw CSV viewing state
  const [showRawCSV, setShowRawCSV] = useState(false);
  const [rawCSVContent, setRawCSVContent] = useState<string>('');

  // Log when data changes
  React.useEffect(() => {
    if (data.length > 0) {
      console.log('[CHART DISPLAY] Data updated! First 3 timestamps:', data.slice(0, 3).map(d => d.time));
      console.log('[CHART DISPLAY] currentDateFormat:', currentDateFormat);
    }
  }, [data, currentDateFormat]);

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
    const params = Object.keys(firstRow)
      .filter(key => key !== 'time' && key !== timeColumn)
      .filter(key => {
        // Check if parameter has numeric values
        return data.some(row => {
          const value = row[key];
          return typeof value === 'number' && !isNaN(value);
        });
      });

    console.log('📊 PinChartDisplay received data:', {
      dataLength: data.length,
      numericParameters: params,
      firstDataPoint: data[0],
      lastDataPoint: data[data.length - 1],
      fileName
    });

    return params;
  }, [data, timeColumn, fileName]);

  // Initialize parameter visibility state
  const [parameterStates, setParameterStates] = useState<Record<string, ParameterState>>(() => {
    const initialState: Record<string, ParameterState> = {};
    // Show only first 4 parameters by default
    const defaultVisibleCount = 4;
    numericParameters.forEach((param, index) => {
      // Convert CSS variable to hex immediately to ensure unique colors
      const cssVar = CHART_COLORS[index % CHART_COLORS.length];
      const hexColor = cssVarToHex(cssVar);
      initialState[param] = {
        visible: index < defaultVisibleCount,
        color: hexColor, // Store as hex, not CSS variable
        opacity: 1.0 // Default to fully opaque
      };
    });
    return initialState;
  });

  // Update parameter states when numericParameters changes (e.g., new data loaded)
  React.useEffect(() => {
    setParameterStates(prev => {
      const newState: Record<string, ParameterState> = {};
      // For merged plots (small number of params), show all by default
      const defaultVisibleCount = numericParameters.length <= 3 ? numericParameters.length :
                                   ((fileType === 'GP' || dataSource === 'marine') ? 4 : 5);

      numericParameters.forEach((param, index) => {
        // Preserve existing state if parameter already exists
        if (prev[param]) {
          newState[param] = prev[param];
        } else {
          // Initialize new parameter with hex color
          const cssVar = CHART_COLORS[index % CHART_COLORS.length];
          const hexColor = cssVarToHex(cssVar);
          newState[param] = {
            visible: index < defaultVisibleCount,
            color: hexColor, // Store as hex, not CSS variable
            opacity: 1.0 // Default to fully opaque
          };
        }
      });

      return newState;
    });
  }, [numericParameters.join(','), fileType, dataSource]); // Use join to avoid array reference changes

  // Brush state for time range selection (local state for separate mode)
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  // Get visible parameters
  const visibleParameters = useMemo(() => {
    return numericParameters.filter(param => parameterStates[param]?.visible);
  }, [numericParameters, parameterStates]);

  // Track previous visibility state to avoid infinite loops
  const prevVisibilityRef = React.useRef<string>('');

  // Notify parent when visibility changes (for merge feature)
  React.useEffect(() => {
    if (!onVisibilityChange) return;

    // Extract colors for visible parameters
    const colors = visibleParameters.reduce((acc, param) => {
      acc[param] = parameterStates[param]?.color || '--chart-1';
      return acc;
    }, {} as Record<string, string>);

    // Create a stable key for comparison
    const currentKey = JSON.stringify({ params: visibleParameters, colors });

    // Only call callback if values actually changed
    if (currentKey !== prevVisibilityRef.current) {
      prevVisibilityRef.current = currentKey;
      onVisibilityChange(visibleParameters, colors);
    }
  }, [visibleParameters, parameterStates, onVisibilityChange]);

  // Helper function to check if a time falls within an exclusion range
  const isTimeExcluded = (timeStr: string, excludeStart: string, excludeEnd: string): boolean => {
    try {
      const date = parseISO(timeStr);
      if (!isValid(date)) return false;

      const hours = date.getHours();
      const minutes = date.getMinutes();
      const timeInMinutes = hours * 60 + minutes;

      const [startH, startM] = excludeStart.split(':').map(Number);
      const [endH, endM] = excludeEnd.split(':').map(Number);
      const startInMinutes = startH * 60 + startM;
      const endInMinutes = endH * 60 + endM;

      // Handle ranges that cross midnight
      if (startInMinutes <= endInMinutes) {
        return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
      } else {
        return timeInMinutes >= startInMinutes || timeInMinutes <= endInMinutes;
      }
    } catch {
      return false;
    }
  };

  // Determine which brush indices to use based on mode
  const activeBrushStart = timeAxisMode === 'common' && globalBrushRange ? globalBrushRange.startIndex : brushStartIndex;
  const activeBrushEnd = timeAxisMode === 'common' && globalBrushRange ? globalBrushRange.endIndex : brushEndIndex;

  // Get data slice for current brush selection
  const displayData = useMemo(() => {
    if (data.length === 0) return [];

    // Step 1: Get base data based on brush/time range
    let baseData: ParsedDataPoint[];

    // In common mode with global time range, filter by actual time values for marine data
    if (timeAxisMode === 'common' && globalTimeRange && globalTimeRange.min && globalTimeRange.max && dataSource === 'marine') {
      baseData = data.filter(point => {
        try {
          const pointDate = parseISO(point.time);
          if (!isValid(pointDate)) return false;
          return pointDate >= globalTimeRange.min! && pointDate <= globalTimeRange.max!;
        } catch {
          return false;
        }
      });
    } else {
      // For CSV data or separate mode, use brush indices
      const start = Math.max(0, activeBrushStart);
      const end = Math.min(data.length - 1, activeBrushEnd ?? data.length - 1);
      baseData = data.slice(start, end + 1);
    }

    // Step 2: Apply time-of-day filters (if any parameter has them enabled)
    const hasTimeFilters = Object.values(parameterStates).some(state => state?.timeFilter?.enabled);

    if (!hasTimeFilters) {
      return baseData; // No filters, return as-is
    }

    // Apply time filters
    const filteredData = baseData.map(point => {
      const newPoint = { ...point };

      // For each parameter with time filter enabled
      Object.keys(parameterStates).forEach(param => {
        const state = parameterStates[param];
        if (state?.timeFilter?.enabled && state.timeFilter.excludeStart && state.timeFilter.excludeEnd) {
          // Check if this time should be excluded
          if (isTimeExcluded(point.time, state.timeFilter.excludeStart, state.timeFilter.excludeEnd)) {
            // Set to null to create gap in line
            newPoint[param] = null;
          }
        }
      });

      return newPoint;
    });

    // Step 3: Calculate moving averages (if any parameter has them enabled)
    const hasMovingAverages = Object.values(parameterStates).some(state => state?.movingAverage?.enabled);

    if (!hasMovingAverages) {
      return filteredData; // No MA, return filtered data
    }

    // Calculate moving averages and add MA data keys
    return filteredData.map((point, index) => {
      const newPoint = { ...point };

      // For each parameter with MA enabled
      Object.keys(parameterStates).forEach(param => {
        const state = parameterStates[param];
        if (state?.movingAverage?.enabled) {
          const windowDays = state.movingAverage.windowDays || 7;

          // Calculate window size (assume hourly data: 24 points/day)
          const windowSize = windowDays * 24;

          // Collect values in window (looking backward from current index)
          const windowStart = Math.max(0, index - windowSize + 1);
          const windowValues: number[] = [];

          for (let i = windowStart; i <= index; i++) {
            const value = filteredData[i][param];
            if (typeof value === 'number' && !isNaN(value) && value !== null) {
              windowValues.push(value);
            }
          }

          // Calculate average
          if (windowValues.length > 0) {
            const sum = windowValues.reduce((a, b) => a + b, 0);
            newPoint[`${param}_ma`] = sum / windowValues.length;
          } else {
            newPoint[`${param}_ma`] = null;
          }
        }
      });

      return newPoint;
    });
  }, [data, activeBrushStart, activeBrushEnd, timeAxisMode, globalTimeRange, dataSource, parameterStates]);

  // Calculate Y-axis domain based on visible parameters in displayData (for single axis mode)
  const yAxisDomain = useMemo(() => {
    if (displayData.length === 0 || visibleParameters.length === 0) {
      return [0, 100]; // Default domain
    }

    let min = Infinity;
    let max = -Infinity;

    displayData.forEach(point => {
      visibleParameters.forEach(param => {
        const value = point[param];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    // Add 5% padding to top and bottom
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [displayData, visibleParameters]);

  // Calculate data range and max for Y-axis formatting
  const dataRange = useMemo(() => {
    if (yAxisDomain[1] - yAxisDomain[0] === 0) return 1;
    return Math.abs(yAxisDomain[1] - yAxisDomain[0]);
  }, [yAxisDomain]);

  const dataMax = useMemo(() => {
    return Math.max(Math.abs(yAxisDomain[0]), Math.abs(yAxisDomain[1]));
  }, [yAxisDomain]);

  // Calculate the maximum number of digits in y-axis tick labels (for single axis)
  const maxTickDigits = useMemo(() => {
    const maxValue = Math.max(Math.abs(yAxisDomain[0]), Math.abs(yAxisDomain[1]));
    const formatted = formatYAxisTick(maxValue, dataRange, dataMax);
    return formatted.length;
  }, [yAxisDomain, dataRange, dataMax]);

  // Calculate label offset based on tick label width (for single axis)
  const getLabelOffset = (digitCount: number) => {
    if (digitCount <= 2) return 15;
    if (digitCount === 3) return 20;
    return 25; // 4+ digits
  };

  // Calculate offset for multi-axis based on parameter domain
  const getMultiAxisLabelOffset = (domain: [number, number], dataRange: number, dataMax: number) => {
    const maxValue = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
    const formatted = formatYAxisTick(maxValue, dataRange, dataMax);
    const digitCount = formatted.length;

    if (digitCount <= 2) return -10;
    if (digitCount === 3) return -7;
    return -3; // 4+ digits
  };

  // Calculate individual Y-axis domains for each parameter (for multi-axis mode)
  const parameterDomains = useMemo(() => {
    const domains: Record<string, [number, number]> = {};

    if (displayData.length === 0) {
      return domains;
    }

    visibleParameters.forEach(param => {
      let min = Infinity;
      let max = -Infinity;

      displayData.forEach(point => {
        const value = point[param];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });

      // Add 5% padding to top and bottom
      const padding = (max - min) * 0.05;
      domains[param] = [min - padding, max + padding];
    });

    return domains;
  }, [displayData, visibleParameters]);

  // Set initial brush end index
  React.useEffect(() => {
    if (data.length > 0 && brushEndIndex === undefined) {
      setBrushEndIndex(data.length - 1);
    }
  }, [data.length, brushEndIndex]);

  const handleBrushChange = (brushData: { startIndex?: number; endIndex?: number }) => {
    if (timeAxisMode === 'common' && onBrushChange) {
      // In common mode, propagate to parent
      onBrushChange(brushData);
    } else {
      // In separate mode, update local state
      setBrushStartIndex(brushData.startIndex ?? 0);
      setBrushEndIndex(brushData.endIndex);
    }
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

  const toggleSolo = (parameter: string) => {
    setParameterStates(prev => {
      const newState = { ...prev };
      const currentlySolo = newState[parameter]?.isSolo || false;

      // If this parameter is currently solo, turn off solo and show all
      // If not solo, make this one solo and hide others
      Object.keys(newState).forEach(key => {
        if (key === parameter) {
          newState[key] = {
            ...newState[key],
            visible: true,
            isSolo: !currentlySolo
          };
        } else {
          newState[key] = {
            ...newState[key],
            visible: currentlySolo ? true : false, // If turning off solo, show others; if turning on, hide them
            isSolo: false
          };
        }
      });
      return newState;
    });
  };

  const showOnlyParameter = (parameter: string) => {
    setParameterStates(prev => {
      const newState = { ...prev };
      // Hide all parameters except the clicked one
      Object.keys(newState).forEach(key => {
        newState[key] = {
          ...newState[key],
          visible: key === parameter
        };
      });
      return newState;
    });
  };

  const updateParameterColor = (parameter: string, hexColor: string) => {
    setParameterStates(prev => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        color: hexColor // Store hex directly instead of CSS var
      }
    }));
  };

  const updateParameterOpacity = (parameter: string, opacity: number) => {
    setParameterStates(prev => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        opacity: Math.max(0, Math.min(1, opacity)) // Clamp between 0 and 1
      }
    }));
  };

  const updateTimeFilter = (parameter: string, enabled: boolean, excludeStart?: string, excludeEnd?: string) => {
    setParameterStates(prev => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        timeFilter: {
          enabled,
          excludeStart: excludeStart || '05:00',
          excludeEnd: excludeEnd || '20:00'
        }
      }
    }));
  };

  const updateMovingAverage = (parameter: string, enabled: boolean, windowDays?: number, showLine?: boolean) => {
    setParameterStates(prev => ({
      ...prev,
      [parameter]: {
        ...prev[parameter],
        movingAverage: {
          enabled,
          windowDays: windowDays || 7,
          showLine: showLine !== undefined ? showLine : true
        }
      }
    }));
  };

  // Helper to get color value for rendering (supports both CSS vars and hex, with opacity)
  const getColorValue = (colorString: string, opacity: number = 1.0): string => {
    // Convert hex to rgba with opacity
    if (colorString.startsWith('#')) {
      const hex = colorString.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // For CSS variables, we need to convert HSL to rgba
    const hslValue = getComputedStyle(document.documentElement)
      .getPropertyValue(colorString.replace('--', ''))
      .trim();

    if (!hslValue) return `rgba(59, 130, 246, ${opacity})`; // fallback blue with opacity

    // Parse HSL string like "220 100% 50%" and convert to RGB
    const matches = hslValue.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
    if (!matches) return `rgba(59, 130, 246, ${opacity})`;

    const h = parseFloat(matches[1]) / 360;
    const s = parseFloat(matches[2]) / 100;
    const l = parseFloat(matches[3]) / 100;

    // HSL to RGB conversion
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
    const g = Math.round(hue2rgb(p, q, h) * 255);
    const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  // Generate preview timestamps showing what they'll look like with swapped format
  const generatePreviewTimestamps = (format: 'DD/MM/YYYY' | 'MM/DD/YYYY') => {
    // Take first 5 rows as examples
    return data.slice(0, 5).map(row => {
      const currentTime = row.time;
      if (!currentTime) return { current: 'N/A', preview: 'N/A' };

      // Parse current timestamp and extract date parts
      // Format: "2025-02-05T06:05:50Z" -> need to show what it would be with swapped month/day
      const match = currentTime.match(/^(\d{4})-(\d{2})-(\d{2})T(.+)$/);
      if (!match) return { current: currentTime, preview: 'N/A' };

      const [, year, month, day, timePart] = match;

      // Show what the NEW timestamp will be if we swap month and day
      // Current format shows YYYY-MM-DD, but this came from either DD/MM or MM/DD in the file
      // If we're switching TO DD/MM/YYYY, it means the file currently has MM/DD/YYYY
      // So we need to reinterpret month as day and day as month
      const newTimestamp = format === 'DD/MM/YYYY'
        ? `${year}-${day}-${month}T${timePart}` // Swap: month becomes day, day becomes month
        : `${year}-${month}-${day}T${timePart}`; // Keep as is

      return {
        current: currentTime,
        preview: newTimestamp,
        changed: currentTime !== newTimestamp
      };
    });
  };

  const handleDateFormatClick = (format: 'DD/MM/YYYY' | 'MM/DD/YYYY') => {
    console.log('[DATE FORMAT] Button clicked:', format);
    console.log('[DATE FORMAT] Current format:', currentDateFormat);
    console.log('[DATE FORMAT] onDateFormatChange available:', !!onDateFormatChange);

    if (format === currentDateFormat) {
      console.log('[DATE FORMAT] Already using this format, ignoring');
      return; // Already using this format
    }

    console.log('[DATE FORMAT] Opening dialog with pending format:', format);
    setPendingDateFormat(format);
    setShowDateFormatDialog(true);
  };

  const handleConfirmDateFormat = () => {
    console.log('[DATE FORMAT] Confirm clicked, pending format:', pendingDateFormat);
    if (pendingDateFormat && onDateFormatChange) {
      console.log('[DATE FORMAT] Calling onDateFormatChange with:', pendingDateFormat);
      onDateFormatChange(pendingDateFormat);
    }
    setShowDateFormatDialog(false);
    setPendingDateFormat(null);
  };

  const handleSaveAsCsv = () => {
    console.log('[SAVE CSV] Exporting data with corrected timestamps');

    if (data.length === 0) {
      console.log('[SAVE CSV] No data to export');
      return;
    }

    // Get all parameter keys from the first data point
    const firstDataPoint = data[0];
    const parameterKeys = Object.keys(firstDataPoint).filter(key => key !== 'time');

    // Build CSV header
    const header = ['Time', ...parameterKeys].join(',');

    // Build CSV rows
    const rows = data.map(point => {
      const timeStr = point.time;
      const values = parameterKeys.map(key => point[key] ?? '');
      return [timeStr, ...values].join(',');
    });

    // Combine header and rows
    const csvContent = [header, ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `corrected_data_${currentDateFormat?.replace(/\//g, '')}_${timestamp}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('[SAVE CSV] CSV file downloaded:', filename);
  };

  const handleSaveToDatabase = async () => {
    console.log('[SAVE DB] Saving corrected data to database');

    if (data.length === 0) {
      console.log('[SAVE DB] No data to save');
      return;
    }

    if (!pinId) {
      console.log('[SAVE DB] No pin ID provided');
      alert('Cannot save to database: No pin ID available');
      return;
    }

    try {
      // Get all parameter keys from the first data point
      const firstDataPoint = data[0];
      const parameterKeys = Object.keys(firstDataPoint).filter(key => key !== 'time');

      // Build CSV header
      const header = ['Time', ...parameterKeys].join(',');

      // Build CSV rows
      const rows = data.map(point => {
        const timeStr = point.time;
        const values = parameterKeys.map(key => point[key] ?? '');
        return [timeStr, ...values].join(',');
      });

      // Combine header and rows
      const csvContent = [header, ...rows].join('\n');

      // Create a File object from the CSV content
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const originalFileName = rawFiles && rawFiles.length > 0 ? rawFiles[0].name : 'data.csv';
      const baseName = originalFileName.replace(/\.csv$/i, '');
      const newFileName = `${baseName}_corrected_${currentDateFormat?.replace(/\//g, '')}_${timestamp}.csv`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const file = new File([blob], newFileName, { type: 'text/csv' });

      console.log('[SAVE DB] Uploading file:', newFileName, 'Size:', file.size, 'bytes');

      // Upload to Supabase
      const result = await fileStorageService.uploadPinFile(pinId, file);

      if (result) {
        console.log('[SAVE DB] File saved successfully:', result);
        alert(`File saved to database successfully!\n\nFile: ${newFileName}\nSize: ${(file.size / 1024).toFixed(2)} KB`);
      } else {
        console.error('[SAVE DB] Failed to save file');
        alert('Failed to save file to database. Please check the console for details.');
      }
    } catch (error) {
      console.error('[SAVE DB] Error saving to database:', error);
      alert('Error saving file to database. Please check the console for details.');
    }
  };

  const handleSavePreviewAsCsv = async () => {
    console.log('[SAVE CSV] Starting with SWAP approach');
    console.log('[SAVE CSV] Pending format:', pendingDateFormat);

    if (!pendingDateFormat || data.length === 0) {
      alert('No data to export');
      return;
    }

    try {
      // Import swap function
      const { swapDatesInData } = await import('./swapDates');
      
      // Show before
      console.log('[SWAP VALIDATION] BEFORE (first 5):');
      data.slice(0, 5).forEach((point, i) => {
        console.log(`  [${i}] ${point.time}`);
      });
      
      // Swap dates
      const swappedData = swapDatesInData(data);
      
      // Show after
      console.log('[SWAP VALIDATION] AFTER (first 5):');
      swappedData.slice(0, 5).forEach((point, i) => {
        console.log(`  [${i}] ${point.time}`);
      });
      
      // Validate swap worked
      let changedCount = 0;
      for (let i = 0; i < Math.min(5, data.length); i++) {
        if (data[i].time !== swappedData[i].time) {
          changedCount++;
        }
      }
      
      if (changedCount === 0) {
        console.error('[SWAP] ERROR: No dates changed!');
        alert('ERROR: Date swap failed - no timestamps changed.');
        return;
      }
      
      console.log(`[SWAP] SUCCESS: ${changedCount} dates swapped`);
      
      // Build CSV
      const firstDataPoint = swappedData[0];
      const parameterKeys = Object.keys(firstDataPoint).filter(key => key !== 'time');
      const header = ['Time', ...parameterKeys].join(',');
      const rows = swappedData.map(point => {
        const timeStr = point.time;
        const values = parameterKeys.map(key => point[key] ?? '');
        return [timeStr, ...values].join(',');
      });
      const csvContent = [header, ...rows].join('\n');
      
      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `swapped_dates_${timestamp}.csv`;
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('[SAVE CSV] Downloaded:', filename);
      alert(`SUCCESS!\n\nFile: ${filename}\n\nSwapped ${changedCount} timestamps\n\nBefore: ${data[0].time}\nAfter: ${swappedData[0].time}`);
    } catch (error) {
      console.error('[SAVE CSV] Error:', error);
      alert('Failed to export. Check console.');
    }
  };

  const handleSavePreviewToDatabase = async () => {
    console.log('[SAVE PREVIEW DB] Saving preview data to database');

    if (!pendingDateFormat || !rawFiles || rawFiles.length === 0) {
      console.log('[SAVE PREVIEW DB] Missing required data');
      return;
    }

    if (!pinId) {
      console.log('[SAVE PREVIEW DB] No pin ID provided');
      alert('Cannot save to database: No pin ID available');
      return;
    }

    try {
      // Re-parse the file with the pending format to get corrected data
      const { parseMultipleCSVFiles } = await import('./csvParser');
      const result = await parseMultipleCSVFiles(rawFiles, fileType, pendingDateFormat);

      if (result.data.length === 0) {
        alert('No data to save');
        return;
      }

      // Get all parameter keys from the first data point
      const firstDataPoint = result.data[0];
      const parameterKeys = Object.keys(firstDataPoint).filter(key => key !== 'time');

      // Build CSV header
      const header = ['Time', ...parameterKeys].join(',');

      // Build CSV rows
      const rows = result.data.map(point => {
        const timeStr = point.time;
        const values = parameterKeys.map(key => point[key] ?? '');
        return [timeStr, ...values].join(',');
      });

      // Combine header and rows
      const csvContent = [header, ...rows].join('\n');

      // Create a File object from the CSV content
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const originalFileName = rawFiles[0].name;
      const baseName = originalFileName.replace(/\.csv$/i, '');
      const newFileName = `${baseName}_corrected_${pendingDateFormat.replace(/\//g, '')}_${timestamp}.csv`;

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const file = new File([blob], newFileName, { type: 'text/csv' });

      console.log('[SAVE PREVIEW DB] Uploading file:', newFileName, 'Size:', file.size, 'bytes');

      // Upload to Supabase
      const result2 = await fileStorageService.uploadPinFile(pinId, file);

      if (result2) {
        console.log('[SAVE PREVIEW DB] File saved successfully:', result2);
        alert(`File saved to database successfully!\n\nFile: ${newFileName}\nSize: ${(file.size / 1024).toFixed(2)} KB`);
      } else {
        console.error('[SAVE PREVIEW DB] Failed to save file');
        alert('Failed to save file to database. Please check the console for details.');
      }
    } catch (error) {
      console.error('[SAVE PREVIEW DB] Error saving to database:', error);
      alert('Error saving file to database. Please check the console for details.');
    }
  };

  const handleCancelDateFormat = () => {
    console.log('[DATE FORMAT] Cancel clicked');
    setShowDateFormatDialog(false);
    setPendingDateFormat(null);
  };

  const handleViewRawCSV = async () => {
    if (!rawFiles || rawFiles.length === 0) {
      console.log('[RAW CSV] No raw files available');
      return;
    }

    try {
      const file = rawFiles[0]; // Take first file
      const text = await file.text();
      setRawCSVContent(text);
      setShowRawCSV(true);
      console.log('[RAW CSV] Loaded raw CSV, length:', text.length);
    } catch (error) {
      console.error('[RAW CSV] Error reading file:', error);
    }
  };

  // Get source label abbreviation
  const getSourceLabel = (): string => {
    if (dataSource === 'marine') return 'OM';
    if (fileType === 'Subcam') return 'SC';
    return fileType; // Returns 'GP' or 'FPOD'
  };

  // Format parameter label with source
  const formatParameterWithSource = (parameter: string): string => {
    const baseLabel = getParameterLabelWithUnit(parameter);

    // Check if parameter already has a source label (e.g., "IR [GP]")
    if (/\[(?:GP|FPOD|SC|Subcam|OM)\]$/.test(baseLabel)) {
      // Already has source label, return as-is
      return baseLabel;
    }

    // Add source label
    const sourceLabel = getSourceLabel();
    return `${baseLabel} [${sourceLabel}]`;
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
      {/* Toggle Switches - at the top */}
      <div className="flex items-center justify-between pr-12">
        {/* File name */}
        {fileName && (
          <div className="text-xs text-muted-foreground font-medium">
            {fileName}
          </div>
        )}

        {/* View Toggles */}
        <div className="flex items-center gap-4">
          {/* Chart/Table Toggle */}
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

          {/* Single/Multi Axis Toggle - only show in chart mode */}
          {!showTable && (
            <div className="flex items-center gap-2 pl-4 border-l">
              <span className="text-xs text-muted-foreground">Single</span>
              <Switch
                checked={axisMode === 'multi'}
                onCheckedChange={(checked) => setAxisMode(checked ? 'multi' : 'single')}
                className="h-5 w-9"
              />
              <span className="text-xs text-muted-foreground">Multi</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart or Table View */}
      {showTable ? (
        // Table View
        <div className="space-y-2">
          {console.log('[TABLE VIEW] Rendering table view. onDateFormatChange:', !!onDateFormatChange, 'rawFiles:', !!rawFiles)}
          {/* Table controls - single row with date format and raw CSV button */}
          {(onDateFormatChange || (rawFiles && rawFiles.length > 0)) && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted/30 rounded-md border">
              {/* Left side: Date format controls */}
              {onDateFormatChange && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">Date Format:</span>
                    {currentDateFormat ? (
                      <span className="text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded font-semibold">
                        {currentDateFormat}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 rounded font-semibold">
                        Auto-Detected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Switch to:</span>
                    <Button
                      variant={currentDateFormat === 'DD/MM/YYYY' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => handleDateFormatClick('DD/MM/YYYY')}
                      disabled={currentDateFormat === 'DD/MM/YYYY'}
                    >
                      DD/MM/YYYY
                    </Button>
                    <Button
                      variant={currentDateFormat === 'MM/DD/YYYY' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs px-3"
                      onClick={() => handleDateFormatClick('MM/DD/YYYY')}
                      disabled={currentDateFormat === 'MM/DD/YYYY'}
                    >
                      MM/DD/YYYY
                    </Button>
                  </div>
                </div>
              )}

              {/* Right side: Action buttons */}
              <div className="flex items-center gap-2">
                {rawFiles && rawFiles.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs px-4 font-semibold"
                    onClick={handleViewRawCSV}
                  >
                    <TableIcon className="h-4 w-4 mr-2" />
                    View Original CSV
                  </Button>
                )}
                {currentDateFormat && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs px-4 font-semibold"
                      onClick={handleSaveAsCsv}
                    >
                      Save as CSV
                    </Button>
                    {pinId && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8 text-xs px-4 font-semibold"
                        onClick={handleSaveToDatabase}
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Save to Database
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
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
        </div>
      ) : (
        // Chart View (existing chart code)
        <div className="flex gap-3">
          {/* Main Chart - Takes up most space */}
          <div className="flex-1 space-y-3">
      {visibleParameters.length > 0 && (
        <div className="h-52 w-full border rounded-md bg-card p-2">
          {/* Single Axis Mode */}
          {axisMode === 'single' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                margin={{ top: 5, right: 12, left: 5, bottom: -5 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))', angle: -45, textAnchor: 'end', dy: 8 }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(value) => formatDateTick(value, dataSource)}
                  height={45}
                />

                <YAxis
                  tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  width={showYAxisLabels ? 80 : 50}
                  domain={yAxisDomain}
                  tickFormatter={(value) => formatYAxisTick(value, dataRange, dataMax)}
                  label={showYAxisLabels ? {
                    value: visibleParameters.length === 1
                      ? formatParameterWithSource(visibleParameters[0])
                      : 'Value',
                    angle: -90,
                    position: 'insideLeft',
                    offset: getLabelOffset(maxTickDigits),
                    style: { textAnchor: 'middle', fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))' }
                  } : undefined}
                />

                {/* Frame lines - top and right edges */}
                <ReferenceLine y={yAxisDomain[1]} stroke="hsl(var(--border))" strokeWidth={1} strokeOpacity={0.3} />
                {displayData.length > 0 && (
                  <ReferenceLine x={displayData[displayData.length - 1].time} stroke="hsl(var(--border))" strokeWidth={1} strokeOpacity={0.3} />
                )}

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
                  const colorValue = getColorValue(state.color, state.opacity ?? 1.0);

                  return (
                    <Line
                      key={parameter}
                      type="monotone"
                      dataKey={parameter}
                      stroke={colorValue}
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
          )}

          {/* Multi Axis Mode */}
          {axisMode === 'multi' && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                margin={{
                  top: 5,
                  right: Math.ceil(visibleParameters.length / 2) * 50,
                  left: 50,
                  bottom: -5
                }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />

                <XAxis
                  dataKey="time"
                  tick={{ fontSize: '0.65rem', fill: 'hsl(var(--muted-foreground))', angle: -45, textAnchor: 'end', dy: 8 }}
                  stroke="hsl(var(--border))"
                  tickFormatter={(value) => formatDateTick(value, dataSource)}
                  height={45}
                />

                {/* One YAxis per visible parameter */}
                {visibleParameters.map((parameter, index) => {
                  const orientation = index % 2 === 0 ? 'left' : 'right';
                  const yAxisId = `axis-${parameter}`;
                  const domain = parameterDomains[parameter] || [0, 100];
                  const paramRange = Math.abs(domain[1] - domain[0]);
                  const paramMax = Math.max(Math.abs(domain[0]), Math.abs(domain[1]));
                  const paramColor = getColorValue(parameterStates[parameter].color);
                  // Add gap between left axes: 3rd axis (index 2) gets +10px width
                  const axisWidth = (index === 2) ? 42 : 32;

                  return (
                    <YAxis
                      key={yAxisId}
                      yAxisId={yAxisId}
                      orientation={orientation}
                      tick={{ fontSize: '0.55rem', fill: paramColor }}
                      stroke={paramColor}
                      width={axisWidth}
                      tickFormatter={(value) => formatYAxisTick(value, paramRange, paramMax)}
                      label={{
                        value: formatParameterWithSource(parameter),
                        angle: -90,
                        position: orientation === 'left' ? 'insideLeft' : 'insideRight',
                        offset: getMultiAxisLabelOffset(domain, paramRange, paramMax),
                        style: {
                          textAnchor: 'middle',
                          fontSize: '0.55rem',
                          fill: paramColor,
                          fontWeight: 500
                        }
                      }}
                      domain={domain}
                    />
                  );
                })}

                {/* Frame lines - top edges for each Y-axis */}
                {visibleParameters.map((parameter) => {
                  const domain = parameterDomains[parameter] || [0, 100];
                  const yAxisId = `axis-${parameter}`;
                  return (
                    <ReferenceLine
                      key={`ref-${yAxisId}`}
                      y={domain[1]}
                      yAxisId={yAxisId}
                      stroke="hsl(var(--border))"
                      strokeWidth={1}
                      strokeOpacity={0.3}
                    />
                  );
                })}

                {/* Frame lines - right edge (using first axis) */}
                {displayData.length > 0 && visibleParameters.length > 0 && (
                  <ReferenceLine
                    x={displayData[displayData.length - 1].time}
                    yAxisId={`axis-${visibleParameters[0]}`}
                    stroke="hsl(var(--border))"
                    strokeWidth={1}
                    strokeOpacity={0.3}
                  />
                )}

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
                  const yAxisId = `axis-${parameter}`;
                  const colorValue = getColorValue(state.color, state.opacity ?? 1.0);

                  return (
                    <Line
                      key={parameter}
                      type="monotone"
                      dataKey={parameter}
                      yAxisId={yAxisId}
                      stroke={colorValue}
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
          )}
        </div>
      )}

      {/* Time Range Brush - only show in separate mode OR if last plot in common mode */}
      {data.length > 10 && (timeAxisMode === 'separate' || isLastPlot) && (
        <div className="h-10 w-full border rounded-md bg-card p-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 2, right: 15, left: 15, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tickFormatter={(value) => formatDateTick(value, dataSource)}
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: '0.6rem' }}
                height={10}
                interval="preserveStartEnd"
              />
              <Brush
                dataKey="time"
                height={16}
                stroke="hsl(var(--primary))"
                fill="transparent"
                tickFormatter={() => ""}
                travellerWidth={10}
                startIndex={activeBrushStart}
                endIndex={activeBrushEnd}
                onChange={handleBrushChange}
                y={12}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

          </div>

          {/* Parameter Controls - On the right side */}
          <div className={cn("space-y-2 transition-all duration-300", isParameterPanelExpanded ? "w-56" : "w-40")}>
            {/* Header with expand button and label */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 hover:bg-accent/50"
                onClick={() => setIsParameterPanelExpanded(!isParameterPanelExpanded)}
                title={isParameterPanelExpanded ? "Collapse panel" : "Expand panel"}
              >
                {isParameterPanelExpanded ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>

              <p className="text-xs font-medium">
                Parameters ({visibleParameters.length} visible)
                {axisMode === 'multi' && visibleParameters.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-1">- Multi-axis</span>
                )}
              </p>
            </div>

            <div className="space-y-1 h-[210px] overflow-y-auto">
              {numericParameters.map((parameter, index) => {
                const state = parameterStates[parameter];
                if (!state) return null;

                // Get axis position for this parameter in multi-axis mode
                const visibleIndex = visibleParameters.indexOf(parameter);
                const axisPosition = visibleIndex >= 0 ? (visibleIndex % 2 === 0 ? 'L' : 'R') : null;

                const colorValue = getColorValue(state.color);

                return (
                  <div key={parameter} className="flex items-center justify-between p-1.5 rounded border bg-card/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Checkbox
                        id={`param-${parameter}`}
                        checked={state.visible}
                        onCheckedChange={() => toggleParameterVisibility(parameter)}
                        className="h-3 w-3"
                      />

                      {/* Solo button - small circular button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-4 w-4 p-0 rounded-full hover:bg-accent",
                          state.isSolo && "bg-primary/20 hover:bg-primary/30"
                        )}
                        onClick={() => toggleSolo(parameter)}
                        title={state.isSolo ? "Exit solo mode" : "Show only this parameter"}
                      >
                        <Circle className={cn(
                          "h-2.5 w-2.5",
                          state.isSolo ? "fill-primary text-primary" : "text-muted-foreground"
                        )} />
                      </Button>

                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <Label
                          htmlFor={`param-${parameter}`}
                          className="text-xs cursor-pointer truncate"
                          title={formatParameterWithSource(parameter)}
                        >
                          {formatParameterWithSource(parameter)}
                        </Label>
                        {/* Filter indicator */}
                        {state.timeFilter?.enabled && (
                          <Filter
                            className="h-2.5 w-2.5 text-primary opacity-70"
                            title={`Time filter: ${state.timeFilter.excludeStart}-${state.timeFilter.excludeEnd}`}
                          />
                        )}
                        {/* MA indicator */}
                        {state.movingAverage?.enabled && (
                          <BarChart3
                            className="h-2.5 w-2.5 text-primary opacity-70"
                            title={`${state.movingAverage.windowDays}d MA ${state.movingAverage.showLine ? '(visible)' : '(hidden)'}`}
                          />
                        )}
                      </div>
                      {/* Show axis indicator in multi-axis mode */}
                      {axisMode === 'multi' && state.visible && axisPosition && (
                        <span
                          className="text-[0.6rem] font-semibold px-1 rounded"
                          style={{ color: colorValue, backgroundColor: `${colorValue}1a` }}
                        >
                          {axisPosition}
                        </span>
                      )}

                      {/* Colored circle with color picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <div
                            className="w-3 h-3 rounded-full border cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all"
                            style={{
                              backgroundColor: getColorValue(state.color, state.opacity ?? 1.0),
                              '--tw-ring-color': colorValue
                            } as React.CSSProperties}
                            title="Change color and transparency"
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="end" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-3">
                            <p className="text-xs font-medium">Color & Transparency</p>
                            <div className="relative">
                              <HexColorPicker
                                color={state.color.startsWith('#') ? state.color : cssVarToHex(state.color)}
                                onChange={(hex) => updateParameterColor(parameter, hex)}
                                style={{ width: '200px', height: '150px' }}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Opacity</Label>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round((state.opacity ?? 1.0) * 100)}%
                                </span>
                              </div>
                              <Input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={Math.round((state.opacity ?? 1.0) * 100)}
                                onChange={(e) => updateParameterOpacity(parameter, parseInt(e.target.value) / 100)}
                                className="h-2 cursor-pointer"
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs flex-1"
                                  onClick={() => updateParameterOpacity(parameter, 0.25)}
                                >
                                  25%
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs flex-1"
                                  onClick={() => updateParameterOpacity(parameter, 0.5)}
                                >
                                  50%
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs flex-1"
                                  onClick={() => updateParameterOpacity(parameter, 0.75)}
                                >
                                  75%
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs flex-1"
                                  onClick={() => updateParameterOpacity(parameter, 1.0)}
                                >
                                  100%
                                </Button>
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Settings icon - contains filters and MA */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-5 w-5 p-0 hover:bg-accent",
                              (state.timeFilter?.enabled || state.movingAverage?.enabled) && "text-primary"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3" align="end" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-4">
                            <p className="text-xs font-semibold border-b pb-2">Settings - {parameter}</p>

                            {/* Time Filter Section */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">Data Filter</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`filter-${parameter}`}
                                  checked={state.timeFilter?.enabled || false}
                                  onCheckedChange={(checked) =>
                                    updateTimeFilter(
                                      parameter,
                                      checked as boolean,
                                      state.timeFilter?.excludeStart,
                                      state.timeFilter?.excludeEnd
                                    )
                                  }
                                  className="h-3 w-3"
                                />
                                <Label htmlFor={`filter-${parameter}`} className="text-xs cursor-pointer">
                                  Enable time filter
                                </Label>
                              </div>
                              {state.timeFilter?.enabled && (
                                <div className="pl-5 space-y-2">
                                  <p className="text-xs text-muted-foreground">Hide data between:</p>
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs w-12">From:</Label>
                                    <Input
                                      type="time"
                                      value={state.timeFilter?.excludeStart || '08:00'}
                                      onChange={(e) =>
                                        updateTimeFilter(
                                          parameter,
                                          true,
                                          e.target.value,
                                          state.timeFilter?.excludeEnd
                                        )
                                      }
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs w-12">To:</Label>
                                    <Input
                                      type="time"
                                      value={state.timeFilter?.excludeEnd || '18:00'}
                                      onChange={(e) =>
                                        updateTimeFilter(
                                          parameter,
                                          true,
                                          state.timeFilter?.excludeStart,
                                          e.target.value
                                        )
                                      }
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <p className="text-[0.65rem] text-muted-foreground italic">
                                    Filters applied to each day in the time series
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Moving Average Section */}
                            <div className="space-y-2 border-t pt-3">
                              <div className="flex items-center gap-2">
                                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-medium">Moving Average</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={`ma-${parameter}`}
                                  checked={state.movingAverage?.enabled || false}
                                  onCheckedChange={(checked) =>
                                    updateMovingAverage(
                                      parameter,
                                      checked as boolean,
                                      state.movingAverage?.windowDays,
                                      state.movingAverage?.showLine
                                    )
                                  }
                                  className="h-3 w-3"
                                />
                                <Label htmlFor={`ma-${parameter}`} className="text-xs cursor-pointer">
                                  Enable moving average
                                </Label>
                              </div>
                              {state.movingAverage?.enabled && (
                                <div className="pl-5 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-xs w-16">Window:</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      max="365"
                                      value={state.movingAverage?.windowDays || 7}
                                      onChange={(e) =>
                                        updateMovingAverage(
                                          parameter,
                                          true,
                                          parseInt(e.target.value) || 7,
                                          state.movingAverage?.showLine
                                        )
                                      }
                                      className="h-7 text-xs w-20"
                                    />
                                    <span className="text-xs text-muted-foreground">days</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`ma-show-${parameter}`}
                                      checked={state.movingAverage?.showLine !== false}
                                      onCheckedChange={(checked) =>
                                        updateMovingAverage(
                                          parameter,
                                          true,
                                          state.movingAverage?.windowDays,
                                          checked as boolean
                                        )
                                      }
                                      className="h-3 w-3"
                                    />
                                    <Label htmlFor={`ma-show-${parameter}`} className="text-xs cursor-pointer">
                                      Show MA line on chart
                                    </Label>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Date Format Preview Dialog */}
      <Dialog open={showDateFormatDialog} onOpenChange={setShowDateFormatDialog}>
        <DialogContent className="max-w-2xl z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirm Date Format Change
            </DialogTitle>
            <DialogDescription>
              You are about to change the date format to <strong>{pendingDateFormat}</strong>.
              This will reparse the file and swap the month and day values. Please review the changes below:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm font-medium">Preview (first 5 timestamps):</div>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-12">#</TableHead>
                    <TableHead className="text-xs">Current</TableHead>
                    <TableHead className="text-xs">→</TableHead>
                    <TableHead className="text-xs">After Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDateFormat && generatePreviewTimestamps(pendingDateFormat).map((preview, idx) => (
                    <TableRow key={idx} className={preview.changed ? 'bg-amber-50' : ''}>
                      <TableCell className="text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-xs font-mono">{preview.current}</TableCell>
                      <TableCell className="text-xs text-center">
                        {preview.changed ? '→' : '='}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-semibold">
                        {preview.preview}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="text-xs text-muted-foreground">
              <strong>Note:</strong> Changed timestamps are highlighted in amber. The file will be reparsed with the new format.
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Button
                variant="secondary"
                onClick={handleSavePreviewAsCsv}
                className="flex-1"
              >
                Save as CSV
              </Button>
              {pinId && (
                <Button
                  variant="secondary"
                  onClick={handleSavePreviewToDatabase}
                  className="flex-1"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Save to Database
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancelDateFormat}>
                Cancel
              </Button>
              <Button onClick={handleConfirmDateFormat}>
                Apply Change
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raw CSV Viewer Dialog */}
      <Dialog open={showRawCSV} onOpenChange={setShowRawCSV}>
        <DialogContent className="max-w-4xl max-h-[80vh] z-[9999]">
          <DialogHeader>
            <DialogTitle>Original CSV File</DialogTitle>
            <DialogDescription>
              This is the raw CSV file as stored. Use this to verify the date format and data structure.
            </DialogDescription>
          </DialogHeader>

          <div className="h-[60vh] overflow-auto border rounded-md bg-muted/20 p-3">
            <pre className="text-xs font-mono whitespace-pre">
              {rawCSVContent}
            </pre>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowRawCSV(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
