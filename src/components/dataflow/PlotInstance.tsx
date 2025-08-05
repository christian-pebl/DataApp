
"use client";

import type { ChangeEvent, CSSProperties, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import React, { useState, useEffect, useId, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label as UiLabel } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { HeatmapDisplay } from "@/components/dataflow/HeatmapDisplay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator as DropdownMenuSeparatorShadcn,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Settings2, X, Maximize2, Minimize2, Plus, Palette, Copy, Trash2, UploadCloud,
  Hourglass, CheckCircle2, XCircle as XCircleIcon, ListFilter, Info,
  ChevronsDown, ChevronsUp, GripVertical, MoveRight, Spline, ArrowUpRight, FilePenLine,
  Move as MoveIcon, Ban, Save, ChevronsLeft, ChevronsRight, RotateCcw,
  PenLine as PenLineIcon, BarChart, Sun
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parse, isValid, parseISO } from 'date-fns';

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined | null;
}

interface LineAnnotation {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  arrowStyle?: 'none' | 'end' | 'both';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  strokeWidth?: number;
  color?: string;
}

type PlotType = 'line' | 'heatmap';

interface SavedPlotState {
  rawCsvText: string;
  currentFileName: string;
  plotTitle: string;
  plotType?: PlotType;
  timeAxisLabel?: string;
  dataSeries: string[];
  visibleSeries: Record<string, boolean>;
  isPlotExpanded: boolean;
  isMinimalistView: boolean;
  brushStartIndex?: number;
  brushEndIndex?: number;
  lines?: LineAnnotation[];
  isOverlayActive?: boolean;
  activeTool?: 'line' | 'move' | null;
}

const DEFAULT_LINE_COLOR = 'hsl(var(--primary))';
const DEFAULT_STROKE_WIDTH = 1.5;
const SELECTED_STROKE_WIDTH_OFFSET = 1;

const DEFAULT_PLOT_HEIGHT = 350;
const EXPANDED_PLOT_HEIGHT = 600;

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;


interface PlotInstanceProps {
  instanceId: string;
  onRemovePlot: (id: string) => void;
  initialPlotTitle?: string;
}

interface ValidationStep {
  id: string;
  label: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message?: string;
}

const LineStyleIcon = ({ style, className }: { style: 'solid' | 'dashed' | 'dotted', className?: string }) => {
  let strokeDasharray;
  if (style === 'dashed') strokeDasharray = "3,2";
  if (style === 'dotted') strokeDasharray = "1,2";
  return (
    <svg width="16" height="16" viewBox="0 0 24 16" className={cn("h-3.5 w-3.5", className)}>
      <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray={strokeDasharray} />
    </svg>
  );
};

const ArrowStyleIcon = ({ style, uniqueId, className }: { style: 'none' | 'end' | 'both', uniqueId: string, className?: string }) => {
  const markerWidth = 3;
  const markerHeight = 3.5;
  const refY = markerHeight / 2;
  const padding = 2;
  let x1 = padding;
  let x2 = 24 - padding;

  const endMarkerId = `dropdown-arrow-end-preview-${uniqueId}-${style}`;
  const startMarkerId = `dropdown-arrow-start-preview-${uniqueId}-${style}`;

  if (style === 'both') { x1 += markerWidth; x2 -= markerWidth; }
  else if (style === 'end') { x2 -= markerWidth; }

  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className={cn("h-4 w-6", className)}>
      <defs>
        <marker id={endMarkerId} markerWidth={markerWidth} markerHeight={markerHeight} refX={markerWidth} refY={refY} orient="auto" fill="currentColor"><polygon points={`0 0, ${markerWidth} ${refY}, 0 ${markerHeight}`} /></marker>
        <marker id={startMarkerId} markerWidth={markerWidth} markerHeight={markerHeight} refX="0" refY={refY} orient="auto-start-reverse" fill="currentColor"><polygon points={`0 0, ${markerWidth} ${refY}, 0 ${markerHeight}`} /></marker>
      </defs>
      <line
        x1={x1} y1="8" x2={x2} y2="8" stroke="currentColor" strokeWidth="2"
        markerStart={style === 'both' ? `url(#${startMarkerId})` : undefined}
        markerEnd={(style === 'end' || style === 'both') ? `url(#${endMarkerId})` : undefined}
      />
    </svg>
  );
};

const ColorSwatch = ({ color, className }: { color: string, className?: string }) => (
  <div className={cn("w-3 h-3 rounded-sm border border-border mr-2 flex-shrink-0", className)} style={{ backgroundColor: color }} />
);


export function PlotInstance({ instanceId, onRemovePlot, initialPlotTitle = "Data Plot" }: PlotInstanceProps) {
  const uniqueComponentId = useId();
  const fileInputId = `${uniqueComponentId}-csv-upload-${instanceId}`;
  const jsonLoadInputId = `${uniqueComponentId}-json-load-${instanceId}`;

  const initialValidationSteps = useMemo<ValidationStep[]>(() => [
    { id: 'fileSelection', label: 'File selection', status: 'pending', message: undefined },
    { id: 'fileType', label: `Checking file name, type, and size (must be .csv, < ${MAX_FILE_SIZE_MB}MB)`, status: 'pending', message: undefined },
    { id: 'fileRead', label: 'Reading file content (checking if empty or unreadable)', status: 'pending', message: undefined },
    { id: 'headerParse', label: 'Checking for header row', status: 'pending', message: undefined },
    { id: 'xAxisIdentified', label: 'X-axis (time) column identified', status: 'pending', message: undefined },
    { id: 'yAxisFirstVarIdentified', label: 'First Variable Column (for Y-axis) identified', status: 'pending', message: undefined },
    { id: 'variableColumnCheck', label: 'Verifying variable column headers (and excluding "Rec" if last)', status: 'pending', message: undefined },
    { id: 'dataRowFormat', label: 'Checking data rows for numeric values', status: 'pending', message: undefined },
    { id: 'dataReady', label: 'Import complete', status: 'pending', message: undefined },
  ], []);

  // Data and UI State
  const [rawCsvText, setRawCsvText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [dataSeries, setDataSeries] = useState<string[]>([]);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({});
  const [timeAxisLabel, setTimeAxisLabel] = useState<string | undefined>(undefined);
  const [plotTitle, setPlotTitle] = useState<string>(initialPlotTitle);
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false);
  const [plotType, setPlotType] = useState<PlotType>('line');

  // Validation and UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>(() => initialValidationSteps.map(s => ({...s})));
  const [currentFileForValidation, setCurrentFileForValidation] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMinimalistView, setIsMinimalistView] = useState(false);

  // Annotation State
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [activeTool, setActiveTool] = useState<'line' | 'move' | null>(null);
  const [lines, setLines] = useState<LineAnnotation[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const [draggingPoint, setDraggingPoint] = useState<{ lineId: string; pointType: 'start' | 'end' } | null>(null);
  
  const [movingLineId, setMovingLineId] = useState<string | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [lineBeingMovedOriginalState, setLineBeingMovedOriginalState] = useState<LineAnnotation | null>(null);

  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [toolbarDragStart, setToolbarDragStart] = useState<{ x: number; y: number } | null>(null);
  const [toolbarInitialPosition, setToolbarInitialPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextualToolbarPosition, setContextualToolbarPosition] = useState<{ x: number, y: number } | null>(null);

  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const jsonLoadInputRef = useRef<HTMLInputElement>(null);

  const { toast, dismiss } = useToast();
  
  const updateStepStatus = useCallback((stepId: string, status: 'success' | 'error' | 'pending' | 'warning', message?: string) => {
    setValidationSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status, message: message || (status === 'error' ? 'Failed' : 'Completed') } : step
      )
    );
  }, []);

  const getNormalizedCoordinates = useCallback((event: ReactMouseEvent | ReactTouchEvent<Element> | globalThis.MouseEvent | globalThis.TouchEvent) => {
    let clientX = 0, clientY = 0;
    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    return { clientX, clientY };
  }, []);

  const TOOLBAR_APPROX_WIDTH_MIN = 160; // Adjusted for new buttons
  const TOOLBAR_APPROX_HEIGHT = 32;
  const HORIZONTAL_EDGE_BUFFER_TOOLBAR = 8;
  const VERTICAL_GAP_TOOLBAR = 8;
  const TOOLBAR_OFFSET_FROM_LINE_Y = 20;

  const updateContextualToolbarPos = useCallback((line: LineAnnotation | null) => {
    if (!line || !svgOverlayRef.current || !chartAreaRef.current) {
      setContextualToolbarPosition(null);
      return;
    }
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    let toolbarWidth = TOOLBAR_APPROX_WIDTH_MIN;
    const toolbarElement = document.querySelector(`#plot-instance-${instanceId}-${uniqueComponentId} .contextual-toolbar`);
    if (toolbarElement) {
      toolbarWidth = toolbarElement.clientWidth;
    }
    const toolbarHeight = TOOLBAR_APPROX_HEIGHT;

    const midX = (line.x1 + line.x2) / 2;
    let midY = (line.y1 + line.y2) / 2;

    let finalToolbarCenterY = midY - TOOLBAR_OFFSET_FROM_LINE_Y - toolbarHeight / 2;
    if (finalToolbarCenterY - toolbarHeight / 2 < VERTICAL_GAP_TOOLBAR) {
      finalToolbarCenterY = midY + TOOLBAR_OFFSET_FROM_LINE_Y + toolbarHeight / 2;
    }
    
    finalToolbarCenterY = Math.max(
      toolbarHeight / 2 + VERTICAL_GAP_TOOLBAR,
      Math.min(finalToolbarCenterY, svgRect.height - toolbarHeight / 2 - VERTICAL_GAP_TOOLBAR)
    );

    const finalToolbarCenterX = Math.max(
      toolbarWidth / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR,
      Math.min(midX, svgRect.width - toolbarWidth / 2 - HORIZONTAL_EDGE_BUFFER_TOOLBAR)
    );
    setContextualToolbarPosition({ x: finalToolbarCenterX, y: finalToolbarCenterY });
  }, [instanceId, uniqueComponentId]);


  const anyAnnotationInteractionActive = useMemo(() =>
    !!(draggingPoint || movingLineId || isDraggingToolbar),
  [draggingPoint, movingLineId, isDraggingToolbar]);

  const isMainToolbarButtonDisabled = useMemo(() =>
    anyAnnotationInteractionActive || activeTool === 'line',
    [anyAnnotationInteractionActive, activeTool]
  );

  const isContextualToolbarButtonDisabled = useMemo(() =>
     anyAnnotationInteractionActive || !selectedLineId || activeTool === 'line',
     [anyAnnotationInteractionActive, selectedLineId, activeTool]
  );

  const selectedLine = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);

  const svgCursor = useMemo(() => {
    if (isDraggingToolbar) return 'grabbing';
    if (movingLineId) return 'grabbing';
    if (draggingPoint) return 'grabbing';
    if (activeTool === 'move' && selectedLineId) return 'move';
    if (activeTool === 'line') return 'crosshair'; // This condition will rarely be met as 'line' tool auto-adds
    return 'default';
  }, [activeTool, selectedLineId, draggingPoint, movingLineId, isDraggingToolbar]);

  const parseAndValidateCsv = useCallback((csvText: string, fileName: string): { success: boolean; data?: DataPoint[], seriesNames?: string[], timeHeader?: string } => {
    const freshValidationSteps = initialValidationSteps.map(step => ({ ...step, status: 'pending' as const, message: undefined }));
    setValidationSteps(freshValidationSteps);
    updateStepStatus('fileRead', 'success', 'File content read successfully.');
    const localLines = csvText.trim().split(/\r\n|\n/);
    if (localLines.length < 2) {
      updateStepStatus('headerParse', 'error', `CSV error in '${fileName}': Must have a header row and at least one data row.`);
      initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'headerParse') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
      return { success: false };
    }
    updateStepStatus('headerParse', 'success', "Header row found.");

    const delimiterRegex = /\s*[,;\t]\s*/;
    const originalHeaders = localLines[0].trim().split(delimiterRegex).map(h => h.trim());

    let timeHeader = originalHeaders[0]?.trim();
    if (!timeHeader) {
        timeHeader = "Time";
        updateStepStatus('xAxisIdentified', 'success', `Using CSV Column 1 header: '${timeHeader}' (defaulted as header was empty) for X-axis data.`);
    } else {
        updateStepStatus('xAxisIdentified', 'success', `Using CSV Column 1 header: '${timeHeader}' for X-axis data.`);
    }

    let potentialVariableHeaders = originalHeaders.slice(1);
    let actualVariableHeadersToProcess: string[];
    let recColumnExcluded = false;

    if (potentialVariableHeaders.length > 0 && potentialVariableHeaders[potentialVariableHeaders.length - 1].trim().toLowerCase() === 'rec') {
      actualVariableHeadersToProcess = potentialVariableHeaders.slice(0, -1);
      recColumnExcluded = true;
      updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s). Last column "Rec" excluded.`);
    } else {
      actualVariableHeadersToProcess = [...potentialVariableHeaders];
      updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s).`);
    }

    if (actualVariableHeadersToProcess.length === 0) {
      const yAxisErrorMsg = `No data variable columns found after the first (time) column${recColumnExcluded ? ' (and excluding "Rec" column)' : ''} in '${fileName}'. Supported delimiters: comma, semicolon, or tab.`;
      updateStepStatus('yAxisFirstVarIdentified', 'error', yAxisErrorMsg);
      initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'yAxisFirstVarIdentified') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
      return { success: false };
    }

    const uniqueSeriesNamesForDropdown: string[] = [];
    const headerCounts = new Map<string, number>();

    actualVariableHeadersToProcess.forEach((originalVarHeader) => {
      let baseKey = (originalVarHeader || "Unnamed_Variable").trim();
      let processedHeader: string;
      if (baseKey.toLowerCase() === "time") {
        let count = headerCounts.get("time_var") || 0;
        baseKey = "time_var"; 
        processedHeader = count > 0 ? `${baseKey}_(${count + 1})` : baseKey;
        headerCounts.set(baseKey, count + 1);
      } else {
        let count = headerCounts.get(baseKey) || 0;
        processedHeader = count > 0 ? `${baseKey}_(${count + 1})` : baseKey;
        headerCounts.set(baseKey, count + 1);
      }
      uniqueSeriesNamesForDropdown.push(processedHeader);
    });

    if (uniqueSeriesNamesForDropdown.length > 0) {
        const firstVarOriginalHeader = actualVariableHeadersToProcess[0]?.trim() || "Unnamed";
        const firstVarPlotKey = uniqueSeriesNamesForDropdown[0];
        updateStepStatus('yAxisFirstVarIdentified', 'success', `CSV Column 2 (original header: "${firstVarOriginalHeader}") provides data for the first variable. It will be plotted using data key: "${firstVarPlotKey}". Total plottable variables: ${uniqueSeriesNamesForDropdown.length}.`);
    }

    // --- Start of new date parsing logic ---
    const dateFormatsToTry = [
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'", // ISO formats
      'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy HH:mm',
      'MM/dd/yyyy HH:mm:ss', 'MM/dd/yyyy HH:mm',
      'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm',
      'dd-MM-yyyy HH:mm:ss', 'dd-MM-yyyy HH:mm',
      'dd/MM/yy HH:mm:ss', 'dd/MM/yy HH:mm',
      'MM/dd/yy HH:mm:ss', 'MM/dd/yy HH:mm',
      'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd',
      'dd-MM-yyyy', 'dd/MM/yy', 'MM/dd/yy',
    ];

    const parseDateString = (dateString: string): Date | null => {
        if (!dateString || !dateString.trim()) return null;
        
        // First try ISO parsing, as it's the most common and standardized
        let date = parseISO(dateString);
        if (isValid(date)) return date;

        // Then try other formats
        for (const fmt of dateFormatsToTry) {
            date = parse(dateString, fmt, new Date());
            if (isValid(date)) {
                // Heuristic to avoid matching short formats too greedily
                // e.g. 'dd/MM/yy' matching 'dd/MM/yyyy' but getting the wrong year.
                // This is tricky, so we'll rely on the user providing somewhat consistent formats.
                return date;
            }
        }
        return null;
    };
    // --- End of new date parsing logic ---

    const data: DataPoint[] = [];
    let someRowsHadNonNumericData = false;
    let someRowsHadInvalidDate = false;
    let validDataRowsCount = 0;

    for (let i = 1; i < localLines.length; i++) {
      const lineVal = localLines[i];
      const trimmedLine = lineVal.trim();
      if (!trimmedLine) continue;

      const values = trimmedLine.split(delimiterRegex).map(v => v.trim());
      const rawTimeValue = values[0];
      const parsedDate = parseDateString(rawTimeValue);
      let isoTimeValue;

      if (parsedDate) {
        isoTimeValue = parsedDate.toISOString();
      } else {
        isoTimeValue = rawTimeValue || "N/A"; // Keep original if unparsable
        if (rawTimeValue) someRowsHadInvalidDate = true;
      }

      if (!rawTimeValue && values.slice(1, 1 + uniqueSeriesNamesForDropdown.length).every(v => !v || v.trim() === "")) {
        continue;
      }
      
      const dataPoint: DataPoint = { time: isoTimeValue };
      let hasNumericValueInRow = false;
      let rowHasParsingIssue = false;

      uniqueSeriesNamesForDropdown.forEach((uniqueKey, seriesIdx) => {
        const originalCsvColumnIndexForVar = seriesIdx + 1;
        const rawValue = values[originalCsvColumnIndexForVar];
        let numericValue: string | number | undefined | null = null;

        if (rawValue !== undefined && rawValue !== null && rawValue.trim() !== "") {
          const cleanedValue = rawValue.replace(/,/g, '');
          const parsedFloat = parseFloat(cleanedValue);
          if (!isNaN(parsedFloat)) {
            numericValue = parsedFloat;
            hasNumericValueInRow = true;
          } else {
            numericValue = null;
            someRowsHadNonNumericData = true;
            rowHasParsingIssue = true;
          }
        } else {
          numericValue = null;
        }
        dataPoint[uniqueKey] = numericValue;
      });

      if (rawTimeValue || hasNumericValueInRow) {
        data.push(dataPoint);
        if (!rowHasParsingIssue && hasNumericValueInRow && parsedDate) {
          validDataRowsCount++;
        }
      }
    }

    if (data.length === 0 && uniqueSeriesNamesForDropdown.length > 0) {
      updateStepStatus('dataRowFormat', 'error', `No processable data rows found in '${fileName}'. Check variable columns for numeric data. Supported delimiters: comma, semicolon, or tab.`);
      initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'dataRowFormat') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
      return { success: false };
    }
    
    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows contained valid numeric data.`;
    let dataRowStatus: 'success' | 'warning' = 'success';
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric/empty values encountered and treated as missing (null) for plotting.";
      dataRowStatus = 'warning';
    }
    if (someRowsHadInvalidDate) {
        dataRowMessage += " Some time values were in an unrecognized format and could not be parsed.";
        dataRowStatus = 'warning';
    }
    updateStepStatus('dataRowFormat', dataRowStatus, dataRowMessage);

    updateStepStatus('dataReady', 'success', "Import complete");
    return { data, seriesNames: uniqueSeriesNamesForDropdown, timeHeader, success: true };
  }, [updateStepStatus, initialValidationSteps]);

  const processCsvFileContent = useCallback((fileContent: string, fileName: string): { success: boolean; seriesNames?: string[]; timeHeader?: string } => {
    const parsedResult = parseAndValidateCsv(fileContent, fileName);
    if (parsedResult.success && parsedResult.data && parsedResult.seriesNames) {
      setRawCsvText(fileContent);
      setParsedData(parsedResult.data);
      setCurrentFileName(fileName);
      setPlotTitle(fileName.split('.')[0] || "Data Plot");
      setDataSeries(parsedResult.seriesNames);
      setTimeAxisLabel(parsedResult.timeHeader);

      const newVisibleSeries: Record<string, boolean> = {};
      parsedResult.seriesNames.forEach((name, index) => {
        newVisibleSeries[name] = index < 4; // Default to first 4 series visible
      });
      setVisibleSeries(newVisibleSeries);

      setBrushStartIndex(0);
      setBrushEndIndex(parsedResult.data.length > 0 ? parsedResult.data.length - 1 : undefined);

      setLines([]); setSelectedLineId(null); setContextualToolbarPosition(null); setActiveTool(null);
      setDraggingPoint(null); setMovingLineId(null); setDragStartCoords(null);
      setLineBeingMovedOriginalState(null); setIsDraggingToolbar(false);
      setToolbarDragStart(null); setToolbarInitialPosition(null);

      const successToast = toast({ title: "File Processed Successfully", description: `${fileName} processed.` });
      if (successToast?.id) setTimeout(() => dismiss(successToast.id), 2000);
      return { success: true, seriesNames: parsedResult.seriesNames, timeHeader: parsedResult.timeHeader };
    }
    return { success: false };
  }, [parseAndValidateCsv, toast, dismiss]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    setCurrentFileForValidation(null);
    // Reset validation steps explicitly here
    const freshValidationSteps = initialValidationSteps.map(step => ({ ...step, status: 'pending' as const, message: undefined }));
    setValidationSteps(freshValidationSteps);
    // setAccordionValue("validation-details-" + instanceId); // Keep accordion closed by default unless error

    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }
    setCurrentFileForValidation(file.name);

    const updateAndReturnError = (stepId: string, errorMsg: string, title?: string) => {
      updateStepStatus(stepId, 'error', errorMsg);
      setValidationSteps(prevSteps => prevSteps.map(step => {
        const stepIndex = initialValidationSteps.findIndex(s => s.id === step.id);
        const errorStepIndex = initialValidationSteps.findIndex(s => s.id === stepId);
        if (stepIndex > errorStepIndex && step.status === 'pending') {
          return { ...step, status: 'error' as const, message: 'Prerequisite step failed.' };
        }
        return step;
      }));
      toast({ variant: "destructive", title: title || "File Validation Error", description: `${file.name}: ${errorMsg}` });
      setAccordionValue("validation-details-" + instanceId); // Open accordion on error
      return null;
    };

    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      updateAndReturnError('fileType', `File name does not end with .csv. Please select a .csv file and try again.`, "Unsupported File Type");
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateAndReturnError('fileType', `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Max size is ${MAX_FILE_SIZE_MB}MB.`, "File Too Large");
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }
    updateStepStatus('fileType', 'success', 'File is .csv and within size limits.');

    let fileContent;
    try {
      fileContent = await file.text();
      if (!fileContent.trim()) {
        updateAndReturnError('fileRead', `File '${file.name}' is empty or contains only whitespace.`, "Empty File");
        setIsProcessing(false);
        if (event.target) event.target.value = "";
        return;
      }
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      updateAndReturnError('fileRead', `Could not read content from '${file.name}': ${errorMsg}.`, "File Read Error");
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }

    processCsvFileContent(fileContent, file.name);
    setIsProcessing(false);
    if (csvFileInputRef.current) csvFileInputRef.current.value = "";
  }, [instanceId, processCsvFileContent, toast, updateStepStatus, initialValidationSteps]);

  const handleLoadSavedPlotFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }
    const freshValidationSteps = initialValidationSteps.map(step => ({ ...step, status: 'pending' as const, message: undefined }));
    setValidationSteps(freshValidationSteps);
    setCurrentFileForValidation(file.name);
    updateStepStatus('fileSelection', 'success', `Loading state from: ${file.name}`);

    try {
      const jsonText = await file.text();
      const savedState = JSON.parse(jsonText) as SavedPlotState;

      if (
        !savedState.rawCsvText ||
        !savedState.currentFileName ||
        !savedState.plotTitle ||
        !Array.isArray(savedState.dataSeries) ||
        savedState.visibleSeries === undefined
      ) {
        const errorMsg = "Invalid save file structure. Missing essential fields.";
        updateStepStatus('fileType', 'error', errorMsg);
        initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'fileType') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
        toast({ variant: "destructive", title: "Load Error", description: errorMsg });
        setAccordionValue("validation-details-" + instanceId);
        setIsProcessing(false);
        if (event.target) event.target.value = "";
        return;
      }
      updateStepStatus('fileType', 'success', 'Save file structure appears valid.');

      const { success: successfullyProcessed, seriesNames: actualSeriesInLoadedCsv } = processCsvFileContent(savedState.rawCsvText, savedState.currentFileName);

      if (successfullyProcessed && actualSeriesInLoadedCsv) {
        setPlotTitle(savedState.plotTitle);
        setPlotType(savedState.plotType || 'line');

        const restoredVisibleSeries: Record<string, boolean> = {};
        actualSeriesInLoadedCsv.forEach(name => {
          restoredVisibleSeries[name] = savedState.visibleSeries[name] === true; 
        });
        setVisibleSeries(restoredVisibleSeries);

        setIsPlotExpanded(savedState.isPlotExpanded === true);
        setIsMinimalistView(savedState.isMinimalistView === true);

        if (savedState.brushStartIndex !== undefined && savedState.brushEndIndex !== undefined) {
            setBrushStartIndex(savedState.brushStartIndex);
            setBrushEndIndex(savedState.brushEndIndex);
        } else if (parsedData.length > 0) {
            setBrushStartIndex(0);
            setBrushEndIndex(parsedData.length - 1);
        }

        setLines(savedState.lines || []);
        setIsOverlayActive(savedState.isOverlayActive === true);
        setActiveTool(savedState.activeTool || null);
        setSelectedLineId(null);
        setContextualToolbarPosition(null);
        
        if (savedState.timeAxisLabel !== undefined) {
          setTimeAxisLabel(savedState.timeAxisLabel);
        }
        updateStepStatus('dataReady', 'success', "Import complete");
        toast({ title: "Plot State Loaded", description: `Successfully loaded state from ${file.name}.` });
      } else {
        const errorMsg = `Could not process CSV data from loaded file ${file.name}. Embedded CSV might be invalid.`;
        updateStepStatus('dataRowFormat', 'error', errorMsg);
        initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'dataRowFormat') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
        toast({ variant: "destructive", title: "Load Error", description: errorMsg });
        setAccordionValue("validation-details-" + instanceId);
      }

    } catch (error: any) {
      console.error("Error loading plot state:", error);
      const errorMsg = error.message || `Could not load plot state from ${file.name}. File might be corrupted or not a valid plot save file.`;
      updateStepStatus('fileRead', 'error', errorMsg);
      initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'fileRead') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
      toast({ variant: "destructive", title: "Load Failed", description: errorMsg });
      setAccordionValue("validation-details-" + instanceId);
    }
    setIsProcessing(false);
    if (jsonLoadInputRef.current) jsonLoadInputRef.current.value = "";
  }, [instanceId, processCsvFileContent, toast, initialValidationSteps, updateStepStatus, parsedData.length]);

  const handleSavePlot = useCallback(() => {
    if (!rawCsvText || !currentFileName) {
      toast({ variant: "destructive", title: "Cannot Save Plot", description: "No data loaded to save." });
      return;
    }
    const stateToSave: SavedPlotState = {
      rawCsvText,
      currentFileName,
      plotTitle,
      plotType,
      timeAxisLabel,
      dataSeries,
      visibleSeries,
      isPlotExpanded,
      isMinimalistView,
      brushStartIndex,
      brushEndIndex,
      lines: lines || [],
      isOverlayActive: isOverlayActive || false,
      activeTool: activeTool || null,
    };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plotTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'plot_save'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Plot State Saved", description: `Configuration saved as ${a.download}.` });
  }, [rawCsvText, currentFileName, plotTitle, plotType, timeAxisLabel, dataSeries, visibleSeries, isPlotExpanded, isMinimalistView, brushStartIndex, brushEndIndex, lines, isOverlayActive, activeTool, toast]);


  const handleClearDataInstance = useCallback(() => {
    setRawCsvText(null); setParsedData([]); setCurrentFileName(undefined);
    setPlotTitle(initialPlotTitle); setDataSeries([]); setVisibleSeries({});
    setTimeAxisLabel(undefined); setPlotType('line');
    setValidationSteps(initialValidationSteps.map(s => ({ ...s })));
    setCurrentFileForValidation(null); setAccordionValue("");
    setIsPlotExpanded(false); setIsMinimalistView(false);
    setBrushStartIndex(0); setBrushEndIndex(undefined);
    setLines([]); setSelectedLineId(null); setContextualToolbarPosition(null);
    setDraggingPoint(null); setMovingLineId(null); setDragStartCoords(null);
    setLineBeingMovedOriginalState(null); setIsDraggingToolbar(false);
    setToolbarDragStart(null); setToolbarInitialPosition(null);
    setIsOverlayActive(false); setActiveTool(null);
    setIsProcessing(false);
    if (csvFileInputRef.current) csvFileInputRef.current.value = "";
    if (jsonLoadInputRef.current) jsonLoadInputRef.current.value = "";
    toast({ title: "Data Cleared", description: "Plot data and annotations have been cleared." });
  }, [initialPlotTitle, toast, initialValidationSteps]);

  const handleSeriesVisibilityChange = useCallback((seriesName: string, isVisible: boolean) => {
    setVisibleSeries(prev => ({ ...prev, [seriesName]: isVisible }));
  }, []);

  const handleSelectAllToggle = useCallback((selectAll: boolean) => {
    const newVisibleSeries: Record<string, boolean> = {};
    dataSeries.forEach(name => {
      newVisibleSeries[name] = selectAll;
    });
    setVisibleSeries(newVisibleSeries);
  }, [dataSeries]);

  const getSummaryStep = useCallback((): ValidationStep | null => {
    if (isProcessing) {
      const currentProcessingStep = validationSteps.find(step => step.status === 'pending');
      if (currentProcessingStep) {
        return { ...currentProcessingStep, label: `Processing: ${currentProcessingStep.label}` };
      }
      return { id: 'processing_fallback', label: `Processing ${currentFileForValidation || 'file'}...`, status: 'pending' };
    }
  
    const firstError = validationSteps.find(step => step.status === 'error');
    if (firstError) return firstError;
  
    const dataReadySuccess = validationSteps.find(step => step.id === 'dataReady' && step.status === 'success');
    if (dataReadySuccess) return dataReadySuccess;
  
    if (currentFileForValidation) { 
      const lastSignificantStep = [...validationSteps].reverse().find(step => 
        (step.status === 'success' || step.status === 'warning') && step.id !== 'fileSelection'
      );
      if (lastSignificantStep) return lastSignificantStep;
    }
    return null; 
  }, [validationSteps, isProcessing, currentFileForValidation]);


  useEffect(() => {
    if (!isProcessing && validationSteps.length > 0) {
      const hasError = validationSteps.some(step => step.status === 'error');
      if (hasError) {
        setAccordionValue("validation-details-" + instanceId);
      } else {
        const isSuccessful = validationSteps.find(step => step.id === 'dataReady' && step.status === 'success');
        if (isSuccessful) {
          setAccordionValue(""); // Close on success
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing, validationSteps]); // Removed instanceId as it's stable

  const allSeriesSelected = useMemo(() => dataSeries.length > 0 && dataSeries.every(series => visibleSeries[series]), [dataSeries, visibleSeries]);

  const yAxisConfigs = useMemo((): YAxisConfig[] => {
    if (dataSeries.length === 0 || Object.keys(visibleSeries).filter(key => visibleSeries[key]).length === 0) {
      return [{ dataKey: "value", label: "Value", unit: '', orientation: 'left', yAxisId: 'left-axis-' + instanceId, color: '--chart-1' }];
    }
    const visibleKeys = dataSeries.filter(s => visibleSeries[s]);
    if (visibleKeys.length === 0) {
      return [{ dataKey: "value", label: "Value", unit: '', orientation: 'left', yAxisId: 'left-axis-' + instanceId, color: '--chart-1' }];
    }
    return visibleKeys.map((seriesKey, index) => ({
      dataKey: seriesKey,
      label: seriesKey,
      unit: '',
      orientation: index % 2 === 0 ? 'left' : 'right',
      yAxisId: `${seriesKey}-axis-${instanceId}`,
      color: `--chart-${(index % 5) + 1}` as any,
    }));
  }, [dataSeries, visibleSeries, instanceId]);

  const plottableSeries = useMemo(() => {
    return dataSeries.filter(s => visibleSeries[s]);
  }, [dataSeries, visibleSeries]);

  const handleBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  }, []);

  // --- Annotation Handlers ---
  const handleAddLine = useCallback(() => {
    if (!svgOverlayRef.current || anyAnnotationInteractionActive) return;
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const centerX = svgRect.width / 2;
    const centerY = svgRect.height / 2;
    const defaultLineLength = Math.min(svgRect.width, svgRect.height) * 0.2;

    const newLine: LineAnnotation = {
      id: `${Date.now()}-${uniqueComponentId}-line-${instanceId}`,
      x1: centerX - defaultLineLength / 2, y1: centerY,
      x2: centerX + defaultLineLength / 2, y2: centerY,
      arrowStyle: 'none', lineStyle: 'solid',
      strokeWidth: DEFAULT_STROKE_WIDTH, color: DEFAULT_LINE_COLOR,
    };
    setLines(prevLines => [...prevLines, newLine]);
    setSelectedLineId(newLine.id);
    updateContextualToolbarPos(newLine);
    setActiveTool(null);
  }, [uniqueComponentId, instanceId, anyAnnotationInteractionActive, updateContextualToolbarPos]);

  const handleLineStyleChange = useCallback((style: 'solid' | 'dashed' | 'dotted') => {
    if (selectedLineId) {
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, lineStyle: style } : l));
    }
  }, [selectedLineId]);

  const handleStrokeWeightChange = useCallback((newWeightArray: number[]) => {
    if (selectedLineId) {
      const newWeight = newWeightArray[0];
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, strokeWidth: newWeight } : l));
    }
  }, [selectedLineId]);

  const handleLineColorChange = useCallback((color: string) => {
     if (selectedLineId) {
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, color: color } : l));
    }
  }, [selectedLineId]);

  const handleArrowStyleChange = useCallback((style: 'none' | 'end' | 'both') => {
    if (selectedLineId) {
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, arrowStyle: style } : l));
    }
  }, [selectedLineId]);

  const handleCopySelectedLine = useCallback(() => {
    if (!selectedLineId || anyAnnotationInteractionActive) return;
    const lineToCopy = lines.find(l => l.id === selectedLineId);
    if (lineToCopy && svgOverlayRef.current) {
      const svgRect = svgOverlayRef.current.getBoundingClientRect();
      let offsetX = 10, offsetY = 10;
      let newX1 = lineToCopy.x1 + offsetX; let newY1 = lineToCopy.y1 + offsetY;
      let newX2 = lineToCopy.x2 + offsetX; let newY2 = lineToCopy.y2 + offsetY;

      if (newX1 < 0 || newX2 > svgRect.width || newY1 < 0 || newY2 > svgRect.height) {
          offsetX = -10; offsetY = -10;
          newX1 = lineToCopy.x1 + offsetX; newY1 = lineToCopy.y1 + offsetY;
          newX2 = lineToCopy.x2 + offsetX; newY2 = lineToCopy.y2 + offsetY;
      }
      newX1 = Math.max(0, Math.min(newX1, svgRect.width));
      newY1 = Math.max(0, Math.min(newY1, svgRect.height));
      newX2 = Math.max(0, Math.min(newX2, svgRect.width));
      newY2 = Math.max(0, Math.min(newY2, svgRect.height));

      const newCopiedLine: LineAnnotation = {
          ...lineToCopy, id: `${Date.now()}-${uniqueComponentId}-line-copy-${instanceId}`,
          x1: newX1, y1: newY1, x2: newX2, y2: newY2,
      };
      setLines(prevLines => [...prevLines, newCopiedLine]);
      setSelectedLineId(newCopiedLine.id);
      updateContextualToolbarPos(newCopiedLine);
      toast({ title: "Line Copied", duration: 2000 });
    }
  }, [selectedLineId, lines, uniqueComponentId, instanceId, toast, anyAnnotationInteractionActive, updateContextualToolbarPos]);

  const handleDeleteSelectedLine = useCallback(() => {
    if (selectedLineId && !anyAnnotationInteractionActive) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
      toast({ title: "Line Deleted", duration: 2000 });
    }
  }, [selectedLineId, toast, anyAnnotationInteractionActive]);

  const getStrokeDasharray = useCallback((style?: 'solid' | 'dashed' | 'dotted') => {
    switch (style) {
      case 'dashed': return "5,5"; case 'dotted': return "1,4";
      case 'solid': default: return undefined;
    }
  }, []);

  const handleSvgBackgroundClick = useCallback((event: ReactMouseEvent<SVGElement> | ReactTouchEvent<SVGElement>) => {
    if (event.target === svgOverlayRef.current && !draggingPoint && !movingLineId && !isDraggingToolbar && activeTool !== 'move') {
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
      setActiveTool(null); 
    }
  }, [draggingPoint, movingLineId, isDraggingToolbar, activeTool]);

  const handleLineHitboxInteractionStart = useCallback((line: LineAnnotation, event: ReactMouseEvent<SVGGElement> | ReactTouchEvent<SVGGElement>) => {
    event.stopPropagation();
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    
    if (anyAnnotationInteractionActive && !(activeTool === 'move' && selectedLineId === line.id)) return;

    setSelectedLineId(line.id); // Always select the line on interaction start
    updateContextualToolbarPos(line);

    if (activeTool === 'move' && selectedLineId === line.id) { // If move tool is active for THIS line
      if (!svgOverlayRef.current) return;
      const { clientX, clientY } = getNormalizedCoordinates(event);
      const svgRect = svgOverlayRef.current.getBoundingClientRect();
      setDragStartCoords({ x: clientX - svgRect.left, y: clientY - svgRect.top });
      setLineBeingMovedOriginalState({ ...line });
      setMovingLineId(line.id);
    }
  }, [getNormalizedCoordinates, anyAnnotationInteractionActive, activeTool, selectedLineId, updateContextualToolbarPos]);


  const handleDraggablePointInteractionStart = useCallback((lineId: string, pointType: 'start' | 'end', event: ReactMouseEvent<SVGCircleElement> | ReactTouchEvent<SVGCircleElement>) => {
    event.stopPropagation();
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    if (movingLineId || isDraggingToolbar || activeTool === 'move') return;

    setSelectedLineId(lineId);
    setDraggingPoint({ lineId, pointType });
    updateContextualToolbarPos(lines.find(l => l.id === lineId) || null);
  }, [movingLineId, isDraggingToolbar, activeTool, lines, updateContextualToolbarPos]);

  const handleInteractionMove = useCallback((event: globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!svgOverlayRef.current) return;
    if ('preventDefault' in event && (draggingPoint || movingLineId || isDraggingToolbar)) event.preventDefault();

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    let svgX = clientX - svgRect.left;
    let svgY = clientY - svgRect.top;

    let lineToUpdateForToolbar: LineAnnotation | null = null;

    if (draggingPoint) {
      svgX = Math.max(0, Math.min(svgX, svgRect.width));
      svgY = Math.max(0, Math.min(svgY, svgRect.height));
      setLines(prevLines => prevLines.map(l => {
        if (l.id === draggingPoint.lineId) {
          const updatedLine = draggingPoint.pointType === 'start' ? { ...l, x1: svgX, y1: svgY } : { ...l, x2: svgX, y2: svgY };
          lineToUpdateForToolbar = updatedLine;
          return updatedLine;
        }
        return l;
      }));
    } else if (movingLineId && dragStartCoords && lineBeingMovedOriginalState) {
      const dx = svgX - dragStartCoords.x;
      const dy = svgY - dragStartCoords.y;
      setLines(prevLines => prevLines.map(l => {
        if (l.id === movingLineId) {
          const newX1 = Math.max(0, Math.min(lineBeingMovedOriginalState.x1 + dx, svgRect.width));
          const newY1 = Math.max(0, Math.min(lineBeingMovedOriginalState.y1 + dy, svgRect.height));
          const newX2 = Math.max(0, Math.min(lineBeingMovedOriginalState.x2 + dx, svgRect.width));
          const newY2 = Math.max(0, Math.min(lineBeingMovedOriginalState.y2 + dy, svgRect.height));
          const updatedLine = { ...l, x1: newX1, y1: newY1, x2: newX2, y2: newY2 };
          lineToUpdateForToolbar = updatedLine;
          return updatedLine;
        }
        return l;
      }));
    } else if (isDraggingToolbar && toolbarDragStart && toolbarInitialPosition) {
        const dxGlobal = clientX - toolbarDragStart.x;
        const dyGlobal = clientY - toolbarDragStart.y;
        const HORIZONTAL_EDGE_BUFFER_TOOLBAR_DRAG = HORIZONTAL_EDGE_BUFFER_TOOLBAR; 
        const VERTICAL_GAP_TOOLBAR_DRAG = VERTICAL_GAP_TOOLBAR; 
        let currentToolbarWidth = TOOLBAR_APPROX_WIDTH_MIN;
        const toolbarElement = document.querySelector(`#plot-instance-${instanceId}-${uniqueComponentId} .contextual-toolbar`);
        if (toolbarElement) {
          currentToolbarWidth = toolbarElement.clientWidth;
        }

        let newToolbarX = toolbarInitialPosition.x + dxGlobal;
        let newToolbarY = toolbarInitialPosition.y + dyGlobal;

        newToolbarY = Math.max(TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR_DRAG, Math.min(newToolbarY, svgRect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR_DRAG));
        newToolbarX = Math.max(currentToolbarWidth / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR_DRAG, Math.min(newToolbarX, svgRect.width - currentToolbarWidth / 2 - HORIZONTAL_EDGE_BUFFER_TOOLBAR_DRAG));
        setContextualToolbarPosition({ x: newToolbarX, y: newToolbarY });
    }
    if (lineToUpdateForToolbar && (draggingPoint || movingLineId)) {
      updateContextualToolbarPos(lineToUpdateForToolbar);
    }
  }, [draggingPoint, movingLineId, dragStartCoords, lineBeingMovedOriginalState, getNormalizedCoordinates, updateContextualToolbarPos, isDraggingToolbar, toolbarDragStart, toolbarInitialPosition, instanceId, uniqueComponentId]);

  const handleInteractionEnd = useCallback(() => {
    let lineForToolbarUpdate: LineAnnotation | null = null;
    if(draggingPoint) lineForToolbarUpdate = lines.find(l => l.id === draggingPoint.lineId) || null;
    else if (movingLineId) lineForToolbarUpdate = lines.find(l => l.id === movingLineId) || null;

    setDraggingPoint(null);
    setMovingLineId(null);
    setDragStartCoords(null);
    setLineBeingMovedOriginalState(null);
    // Do not reset activeTool here, it's toggled by its button

    if (isDraggingToolbar) {
        setIsDraggingToolbar(false);
        setToolbarDragStart(null);
        setToolbarInitialPosition(null);
    } else if(lineForToolbarUpdate) { 
        updateContextualToolbarPos(lineForToolbarUpdate);
    }
  }, [lines, draggingPoint, movingLineId, isDraggingToolbar, updateContextualToolbarPos]);

  const handleToolbarDragStart = useCallback((event: ReactMouseEvent | ReactTouchEvent) => {
    event.stopPropagation();
    if (!contextualToolbarPosition || anyAnnotationInteractionActive || activeTool === 'line' ) return;
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();

    const { clientX, clientY } = getNormalizedCoordinates(event);
    setToolbarDragStart({ x: clientX, y: clientY });
    setToolbarInitialPosition({ ...contextualToolbarPosition });
    setIsDraggingToolbar(true);
  }, [contextualToolbarPosition, getNormalizedCoordinates, anyAnnotationInteractionActive, activeTool]);

  useEffect(() => {
    if (draggingPoint || movingLineId || isDraggingToolbar) {
      window.addEventListener('mousemove', handleInteractionMove);
      window.addEventListener('touchmove', handleInteractionMove, { passive: false });
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchend', handleInteractionEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchend', handleInteractionEnd);
    };
  }, [draggingPoint, movingLineId, isDraggingToolbar, handleInteractionMove, handleInteractionEnd]);

  useEffect(() => {
    if (!isOverlayActive) {
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
      setDraggingPoint(null);
      setMovingLineId(null);
      setIsDraggingToolbar(false);
      setActiveTool(null);
    }
  }, [isOverlayActive]);

  const currentPlotHeight = isPlotExpanded ? EXPANDED_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT;

  const summaryStep = getSummaryStep();

  const handleToggleMoveTool = useCallback(() => {
    if (selectedLineId) {
      setActiveTool(prev => (prev === 'move' ? null : 'move'));
    } else {
      setActiveTool(null);
    }
  }, [selectedLineId]);

  const yAxisConfigsForChartDisplay: YAxisConfig[] = useMemo(() => {
    if (dataSeries.length === 0) {
      return [{ dataKey: "value", label: "Value", unit: '', orientation: 'left', yAxisId: 'left-axis-' + instanceId, color: '--chart-1' }];
    }
    return dataSeries
      .filter(seriesKey => visibleSeries[seriesKey])
      .map((seriesKey, index) => ({
        dataKey: seriesKey,
        label: seriesKey,
        unit: '', // Assuming no specific unit for CSV data for now
        orientation: index % 2 === 0 ? 'left' : 'right',
        yAxisId: `${seriesKey}-axis-${instanceId}`,
        color: `--chart-${(index % 5) + 1}` as any, // Cycle through 5 chart colors
      }));
  }, [dataSeries, visibleSeries, instanceId]);

  const showAnnotationToolbar = useMemo(() => isOverlayActive && !isMinimized && parsedData.length > 0 && plotType === 'line', [isOverlayActive, isMinimized, parsedData, plotType]);

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
          <Settings2 className="h-4 w-4"/>
          <Input
            type="text"
            value={plotTitle}
            onChange={(e) => setPlotTitle(e.target.value)}
            className="text-sm font-semibold p-1 border-none focus:ring-0 h-auto bg-transparent w-auto max-w-[150px] truncate text-foreground"
            disabled={isProcessing || anyAnnotationInteractionActive}
          />
        </CardTitle>
        <div className="flex items-center gap-0.5">
           <div className="flex items-center space-x-1 mr-1">
              <Switch
                id={`annotate-switch-${instanceId}-${uniqueComponentId}`}
                checked={isOverlayActive}
                onCheckedChange={setIsOverlayActive}
                className="data-[state=unchecked]:bg-input data-[state=unchecked]:border-border data-[state=unchecked]:hover:bg-muted/80"
                disabled={parsedData.length === 0 || isProcessing || anyAnnotationInteractionActive || plotType !== 'line'}
              />
              <UiLabel htmlFor={`annotate-switch-${instanceId}-${uniqueComponentId}`} className={cn("text-sm font-medium text-foreground", (plotType !== 'line') && "text-muted-foreground")}>
                Annotate
              </UiLabel>
            </div>
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          <TooltipProvider delayDuration={100}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleSavePlot} aria-label="Save plot state" className="h-7 w-7" disabled={!rawCsvText || anyAnnotationInteractionActive}><Save className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Save Plot</p></TooltipContent></Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsMinimalistView(!isMinimalistView)} aria-label={isMinimalistView ? "Show controls" : "Hide controls"} className="h-7 w-7" disabled={anyAnnotationInteractionActive}>
                  {isMinimalistView ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{isMinimalistView ? "Show Controls" : "Minimalist View"}</p></TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIsPlotExpanded(!isPlotExpanded)}
                        aria-label={isPlotExpanded ? "Collapse plot area" : "Expand plot area"}
                        disabled={parsedData.length === 0 || anyAnnotationInteractionActive}
                    >
                        {isPlotExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{isPlotExpanded ? "Collapse Plot" : "Expand Plot"}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)} aria-label={isMinimized ? "Expand plot instance" : "Minimize plot instance"} disabled={anyAnnotationInteractionActive}>
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{isMinimized ? "Expand Instance" : "Minimize Instance"}</p></TooltipContent>
            </Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onRemovePlot(instanceId)} aria-label="Remove plot" className="h-7 w-7" disabled={anyAnnotationInteractionActive}><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Remove Plot</p></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!isMinimized && (
         <CardContent className={cn("p-2 pt-1", !isMinimalistView && "md:grid md:grid-cols-12 md:gap-2")}>
          {!isMinimalistView && (
            <>
            <div className="md:col-span-2 space-y-1.5 flex flex-col">
              <div className="space-y-1 p-1 border rounded-md flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-1">
                  <Settings2 className="h-3 w-3 text-[#2B7A78]" />
                  <h3 className="text-[0.65rem] font-semibold text-[#2B7A78]">Import &amp; Validate</h3>
                </div>
                <div className="px-1 py-1.5 flex justify-center">
                  <Button asChild variant="outline" size="sm" className="h-8 text-xs w-full" disabled={isProcessing || anyAnnotationInteractionActive}>
                    <UiLabel htmlFor={fileInputId} className="cursor-pointer flex items-center justify-center gap-1.5 w-full">
                      <UploadCloud className="h-3.5 w-3.5"/> Choose file
                    </UiLabel>
                  </Button>
                  <Input id={fileInputId} ref={csvFileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="sr-only"/>
                </div>
                <div className="px-1 pb-0.5">
                  <Button asChild variant="outline" size="sm" className="w-full h-7 text-xs" disabled={isProcessing || anyAnnotationInteractionActive}>
                    <UiLabel htmlFor={jsonLoadInputId} className="cursor-pointer flex items-center justify-center gap-1.5 w-full"><UploadCloud className="h-3.5 w-3.5"/> Load Plot</UiLabel>
                  </Button>
                  <Input id={jsonLoadInputId} ref={jsonLoadInputRef} type="file" accept=".json" onChange={handleLoadSavedPlotFileChange} className="sr-only"/>
                </div>

                <div className="px-1 pt-1">
                  <div className="flex items-center space-x-1">
                      <TooltipProvider delayDuration={100}>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => setPlotType('line')} disabled={plotType === 'line' || parsedData.length === 0} className={cn("h-6 w-6 flex-1", plotType === 'line' && "bg-accent text-accent-foreground")}>
                                      <BarChart className="h-3.5 w-3.5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>Line Plot</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => setPlotType('heatmap')} disabled={plotType === 'heatmap' || parsedData.length === 0} className={cn("h-6 w-6 flex-1", plotType === 'heatmap' && "bg-accent text-accent-foreground")}>
                                      <Sun className="h-3.5 w-3.5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>Heatmap</p></TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                  </div>
                </div>
                
                {summaryStep && (
                  <div className="px-1">
                  <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue} className="w-full">
                    <AccordionItem value={"validation-details-" + instanceId} className="border-b-0">
                      <AccordionTrigger
                        disabled={anyAnnotationInteractionActive}
                        className={cn(
                          "flex items-center justify-between text-[0.6rem] p-1 rounded-md hover:no-underline hover:bg-muted/50 text-left",
                          summaryStep.status === 'error' && 'bg-destructive/10 text-destructive hover:bg-destructive/20',
                          summaryStep.status === 'success' && 'bg-green-500/10 text-green-700 hover:bg-green-500/20',
                          summaryStep.status === 'pending' && 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20',
                          summaryStep.status === 'warning' && 'bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20',
                          "[&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3 py-1"
                      )}>
                        <div className="flex items-center gap-1 min-w-0">
                          {isProcessing ? <Hourglass className="h-2.5 w-2.5 animate-spin flex-shrink-0" /> :
                           summaryStep.status === 'success' ? <CheckCircle2 className="h-2.5 w-2.5 text-green-600 flex-shrink-0" /> :
                           summaryStep.status === 'warning' ? <Info className="h-2.5 w-2.5 text-yellow-600 flex-shrink-0" /> :
                           summaryStep.status === 'error' ? <XCircleIcon className="h-2.5 w-2.5 text-red-500 flex-shrink-0" /> :
                           <UploadCloud className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />}
                           <span className="font-medium text-[0.55rem] whitespace-nowrap overflow-hidden text-ellipsis">
                             {summaryStep.label}
                           </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0.5 pb-0">
                        <div className="text-[0.55rem] text-muted-foreground px-1 pb-0.5">File: {currentFileForValidation || currentFileName || "N/A"}</div>
                        <ScrollArea className="w-full rounded-md border p-1 bg-muted/20 max-h-28">
                          {validationSteps.map(step => (
                            <li key={step.id} className="flex items-start list-none py-0.5">
                              <div className="flex-shrink-0 w-2.5 h-2.5 mr-1 mt-0.5">
                                {step.status === 'pending' && <Hourglass className="h-full w-full text-muted-foreground animate-spin" />}
                                {step.status === 'success' && <CheckCircle2 className="h-full w-full text-green-500" />}
                                {step.status === 'error' && <XCircleIcon className="h-full w-full text-red-500" />}
                                {step.status === 'warning' && <Info className="h-full w-full text-yellow-500" />}
                              </div>
                              <div className="flex-grow min-w-0">
                                <span className={cn('block text-[0.55rem] leading-tight', step.status === 'error' && 'text-destructive font-semibold', step.status === 'success' && 'text-green-600', step.status === 'warning' && 'text-yellow-600 dark:text-yellow-400')}>{step.label}</span>
                                {step.message && step.status !== 'pending' && (<span className={cn("text-[0.45rem] block whitespace-pre-wrap leading-tight", step.status === 'error' ? 'text-red-700' : step.status === 'warning' ? 'text-yellow-700' : 'text-muted-foreground')} title={step.message}>&ndash; {step.message}</span>)}
                                 {step.status === 'pending' && <span className="text-[0.45rem] text-muted-foreground block leading-tight">&ndash; Pending...</span>}
                              </div>
                            </li>
                          ))}
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  </div>
                )}
                {(!summaryStep && !isProcessing) && (<p className="text-[0.6rem] text-muted-foreground px-1 pb-0.5">Upload CSV or Load Plot.</p>)}
                <div className="px-1 pb-0.5 pt-1 space-y-1">
                  <Button onClick={handleClearDataInstance} variant="outline" size="sm" className="w-full h-7 text-xs" disabled={isProcessing || (!currentFileName && !rawCsvText) || anyAnnotationInteractionActive}>Clear Data</Button>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-1.5 flex flex-col">
                <div className="space-y-1 p-1 border rounded-md flex flex-col flex-1 min-h-0"> 
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-1">
                            <ListFilter className="h-3 w-3 text-[#2B7A78]" />
                            <h3 className="text-[0.65rem] font-semibold text-[#2B7A78]">Controls</h3>
                        </div>
                    </div>
                    <Separator className="my-1"/>
                    <div className="flex items-center space-x-1.5">
                        <Checkbox id={`select-all-rhs-${instanceId}-${uniqueComponentId}`} checked={allSeriesSelected} onCheckedChange={(checked) => handleSelectAllToggle(!!checked)} disabled={dataSeries.length === 0 || anyAnnotationInteractionActive} aria-label={allSeriesSelected ? "Deselect all series" : "Select all series"} className="h-3.5 w-3.5" />
                        <UiLabel htmlFor={`select-all-rhs-${instanceId}-${uniqueComponentId}`} className="text-xs font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {allSeriesSelected ? "Deselect All" : "Select All"} ({dataSeries.filter(s => visibleSeries[s]).length}/{dataSeries.length})
                        </UiLabel>
                    </div>
                    <ScrollArea className="w-full rounded-md border p-1 flex-1">
                        {dataSeries.length > 0 ? (
                            dataSeries.map((seriesName) => (
                            <div key={seriesName} className="flex items-center space-x-1.5 py-0.5">
                                <Checkbox id={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`} checked={!!visibleSeries[seriesName]} onCheckedChange={(checked) => handleSeriesVisibilityChange(seriesName, !!checked)} disabled={anyAnnotationInteractionActive} className="h-3.5 w-3.5" />
                                <UiLabel htmlFor={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`} className="text-xs leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate min-w-0" title={seriesName}>
                                {seriesName}
                                </UiLabel>
                            </div>
                            ))
                        ) : (
                            <p className="text-xs text-center text-muted-foreground py-2">No variables loaded.</p>
                        )}
                    </ScrollArea>
                </div>
            </div>
            </>
          )}
            <div className={cn(!isMinimalistView ? "md:col-span-8" : "col-span-full", isMinimalistView ? "" : "")}>
              <div ref={chartAreaRef} className={cn("relative", (isOverlayActive && anyAnnotationInteractionActive) && "opacity-70 pointer-events-none" )}>
              {parsedData.length > 0 ? (
                plotType === 'line' ? (
                    <ChartDisplay
                    data={parsedData}
                    plottableSeries={plottableSeries}
                    yAxisConfigs={yAxisConfigsForChartDisplay}
                    timeAxisLabel={timeAxisLabel}
                    chartRenderHeight={currentPlotHeight}
                    brushStartIndex={brushStartIndex}
                    brushEndIndex={brushEndIndex}
                    onBrushChange={handleBrushChange}
                    />
                ) : (
                    <HeatmapDisplay
                    data={parsedData}
                    series={plottableSeries}
                    containerHeight={currentPlotHeight}
                    />
                )
              ) : (
                <div style={{ height: `${DEFAULT_PLOT_HEIGHT}px` }} className="flex items-center justify-center text-muted-foreground text-sm p-2 border rounded-md bg-muted/20">
                  {currentFileName ? "No data to display for " + currentFileName : "Upload a CSV file or load a saved plot to visualize data."}
                </div>
              )}

              {isOverlayActive && parsedData.length > 0 && plotType === 'line' && (
                <svg
                  ref={svgOverlayRef}
                  width="100%"
                  height="100%"
                  className="absolute top-0 left-0 z-10"
                  onClick={handleSvgBackgroundClick}
                  onTouchStart={handleSvgBackgroundClick}
                  style={{ cursor: svgCursor, pointerEvents: (anyAnnotationInteractionActive || activeTool === 'line' || selectedLineId || isDraggingToolbar) ? 'auto' : 'none' }}
                >
                  <defs>
                     <marker id={`arrowheadEnd-${uniqueComponentId}-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                     <marker id={`arrowheadStart-${uniqueComponentId}-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="3" refY="1.75" orient="auto-start-reverse" fill="currentColor"><polygon points="0 1.75, 3 0, 3 3.5" /></marker>
                  </defs>
                  {lines.map(line => (
                    <g key={line.id} >
                      <line
                        x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                        stroke="transparent" strokeWidth="20"
                        className={cn(selectedLineId === line.id && !anyAnnotationInteractionActive && activeTool !== 'move' ? "cursor-move" : (activeTool === 'move' && selectedLineId === line.id ? "cursor-move" : "cursor-pointer"))}
                        onMouseDown={(e) => handleLineHitboxInteractionStart(line, e)}
                        onTouchStart={(e) => handleLineHitboxInteractionStart(line, e as unknown as ReactTouchEvent<SVGGElement>)}
                        style={{ pointerEvents: (anyAnnotationInteractionActive && movingLineId !== line.id && draggingPoint?.lineId !== line.id && activeTool !== 'move') ? 'none' : 'auto' }}
                      />
                      <line
                        x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                        stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : (line.color || DEFAULT_LINE_COLOR)}
                        strokeWidth={selectedLineId === line.id ? (line.strokeWidth || DEFAULT_STROKE_WIDTH) + SELECTED_STROKE_WIDTH_OFFSET : (line.strokeWidth || DEFAULT_STROKE_WIDTH)}
                        strokeDasharray={getStrokeDasharray(line.lineStyle)}
                        markerStart={ (line.arrowStyle === 'start' || line.arrowStyle === 'both') ? `url(#arrowheadStart-${uniqueComponentId}-${instanceId})` : undefined }
                        markerEnd={ (line.arrowStyle === 'end' || line.arrowStyle === 'both') ? `url(#arrowheadEnd-${uniqueComponentId}-${instanceId})` : undefined }
                        style={{ pointerEvents: 'none' }}
                      />
                      {selectedLineId === line.id && !movingLineId && !isDraggingToolbar && activeTool !== 'move' && ( 
                        <>
                          <circle cx={line.x1} cy={line.y1} r="8" fill="hsl(var(--destructive))" fillOpacity="0.3" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'start', e as unknown as ReactTouchEvent<SVGCircleElement>)} style={{ pointerEvents: (anyAnnotationInteractionActive && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }} />
                          <circle cx={line.x1} cy={line.y1} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
                          <circle cx={line.x2} cy={line.y2} r="8" fill="hsl(var(--destructive))" fillOpacity="0.3" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'end', e as unknown as ReactTouchEvent<SVGCircleElement>)} style={{ pointerEvents: (anyAnnotationInteractionActive && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }} />
                          <circle cx={line.x2} cy={line.y2} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
                        </>
                      )}
                    </g>
                  ))}
                  {selectedLineId && contextualToolbarPosition && isOverlayActive && (
                    <foreignObject
                      id={`plot-instance-${instanceId}-${uniqueComponentId}`}
                      x={contextualToolbarPosition.x - ((document.querySelector(`#plot-instance-${instanceId}-${uniqueComponentId} .contextual-toolbar`)?.clientWidth || TOOLBAR_APPROX_WIDTH_MIN) / 2)}
                      y={contextualToolbarPosition.y - (TOOLBAR_APPROX_HEIGHT / 2)}
                      width={((document.querySelector(`#plot-instance-${instanceId}-${uniqueComponentId} .contextual-toolbar`)?.clientWidth || TOOLBAR_APPROX_WIDTH_MIN) + 10)}
                      height={TOOLBAR_APPROX_HEIGHT + 10}
                      style={{ pointerEvents: (anyAnnotationInteractionActive && !isDraggingToolbar) ? 'none' : 'auto' }}
                    >
                       <TooltipProvider delayDuration={0}>
                          <div
                              className="contextual-toolbar flex items-center space-x-0.5 p-0.5 bg-card border shadow-xl rounded-md w-fit"
                          >
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 cursor-grab active:cursor-grabbing"
                                      disabled={isContextualToolbarButtonDisabled || isDraggingToolbar}
                                      aria-label="Move Toolbar"
                                      onMouseDown={(e) => {e.stopPropagation(); handleToolbarDragStart(e); }}
                                      onTouchStart={(e) => {e.stopPropagation(); handleToolbarDragStart(e); }}
                                  >
                                      <GripVertical className="h-4 w-4"/>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom"><p>Move Toolbar</p></TooltipContent>
                              </Tooltip>
                              <Separator orientation="vertical" className="h-4 mx-0.5"/>
                               <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className={cn("h-7 w-7", activeTool === 'move' && selectedLineId && "bg-accent text-accent-foreground hover:bg-accent/90")} 
                                      onClick={handleToggleMoveTool} 
                                      disabled={isContextualToolbarButtonDisabled} 
                                      aria-label="Toggle Move Line"
                                  >
                                      <MoveIcon className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom"><p>Move Line</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopySelectedLine} disabled={isContextualToolbarButtonDisabled} aria-label="Copy Line">
                                      <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom"><p>Copy Line</p></TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleDeleteSelectedLine} disabled={isContextualToolbarButtonDisabled} aria-label="Delete Line">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom"><p>Delete Line</p></TooltipContent>
                              </Tooltip>
                          </div>
                       </TooltipProvider>
                    </foreignObject>
                  )}
                </svg>
              )}
            </div>
            </div>
        </CardContent>
      )}

      {showAnnotationToolbar && (
        <div className="p-2 border-t bg-card flex items-center space-x-1 flex-wrap shadow sticky bottom-0 z-20">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={"outline"}
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={handleAddLine}
                  disabled={isMainToolbarButtonDisabled}
                  aria-label={"Add Line"}
                >
                  <Plus className="h-4 w-4 mr-1" /> Line
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Add New Line</p></TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-5 mx-0.5" />
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Style &amp; Thickness Options">
                       <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                          <rect y="3" width="16" height="1.5" rx="0.5"/>
                          <rect y="6.25" width="16" height="2.5" rx="0.5"/>
                          <rect y="10.5" width="16" height="3.5" rx="0.5"/>
                        </svg>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60">
                    <DropdownMenuLabel>Line Style</DropdownMenuLabel>
                    <DropdownMenuSeparatorShadcn />
                    <DropdownMenuRadioGroup value={selectedLine?.lineStyle || 'solid'} onValueChange={(value) => handleLineStyleChange(value as 'solid' | 'dashed' | 'dotted')}>
                      {(['solid', 'dashed', 'dotted'] as const).map(s =>
                        <DropdownMenuRadioItem key={s} value={s} className="text-xs py-1 flex items-center">
                          <LineStyleIcon style={s} className="mr-2" />
                           {/* Text removed based on previous request */}
                        </DropdownMenuRadioItem>
                      )}
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparatorShadcn />
                    <DropdownMenuLabel>Stroke Weight</DropdownMenuLabel>
                    <div className="px-2 py-1.5 flex items-center space-x-2">
                      <Slider
                        value={[selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH]}
                        onValueChange={handleStrokeWeightChange}
                        min={1} max={10} step={0.5}
                        disabled={isMainToolbarButtonDisabled || !selectedLineId}
                        className="flex-grow"
                      />
                      <span className="text-xs w-12 text-right tabular-nums">{(selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH).toFixed(1)}px</span>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent><p>Line Style &amp; Thickness</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Arrow Style Options">
                      <MoveRight className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Arrow Style</DropdownMenuLabel>
                    <DropdownMenuSeparatorShadcn />
                    <DropdownMenuRadioGroup value={selectedLine?.arrowStyle || 'none'} onValueChange={(value) => handleArrowStyleChange(value as 'none' | 'end' | 'both')}>
                       {[
                        { value: 'none', label: "No Arrowhead" },
                        { value: 'end', label: "Arrowhead on one side" },
                        { value: 'both', label: "Arrowhead on both sides" }
                      ].map((opt) =>
                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs py-1 flex items-center">
                          <ArrowStyleIcon style={opt.value as 'none' | 'end' | 'both'} uniqueId={`${uniqueComponentId}-${instanceId}-${opt.value}`} className="mr-2"/>
                          {opt.label}
                        </DropdownMenuRadioItem>
                      )}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent><p>Arrow Style</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Color Options">
                      <Palette className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Line Color</DropdownMenuLabel>
                    <DropdownMenuSeparatorShadcn />
                    <DropdownMenuRadioGroup value={selectedLine?.color || DEFAULT_LINE_COLOR} onValueChange={handleLineColorChange}>
                      {[
                        { value: 'hsl(var(--primary))', label: "Primary" }, { value: 'hsl(var(--accent))', label: "Accent" },
                        { value: 'hsl(var(--foreground))', label: "Foreground" }, { value: 'hsl(var(--destructive))', label: "Destructive" },
                        { value: 'hsl(var(--chart-2))', label: "Chart Color 2" }, { value: 'hsl(var(--chart-3))', label: "Chart Color 3" },
                      ].map(colorOpt => (
                        <DropdownMenuRadioItem key={colorOpt.value} value={colorOpt.value} className="text-xs flex items-center">
                          <ColorSwatch color={colorOpt.value} className="mr-2" />{colorOpt.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent><p>Line Color</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </Card>
  );
}
