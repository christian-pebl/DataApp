
"use client";

import type { ChangeEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent, CSSProperties } from "react";
import React, { useState, useEffect, useId, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label as UiLabel } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
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
import {
  Settings2, X, Maximize2, Minimize2, UploadCloud, Save, Upload, Plus, Palette, Copy, Trash2,
  ChevronsLeft, ChevronsRight, ChevronsDown, ChevronsUp, GripVertical, Move as MoveIcon, Spline, MoveRight,
  Hourglass, CheckCircle2, XCircle as XCircleIcon, ListFilter, Info, FilePenLine, Ban, PenLine, CornerUpRight,
} from "lucide-react"; // Ensured CornerUpRight is imported
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  color?: string;
  strokeWidth?: number;
}

interface ValidationStep {
  id: string;
  label: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message?: string;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const DEFAULT_PLOT_HEIGHT = 272;
const EXPANDED_PLOT_HEIGHT = 544;

const DEFAULT_STROKE_WIDTH = 1.5; 
const SELECTED_STROKE_WIDTH_OFFSET = 1; 
const DEFAULT_LINE_COLOR = 'hsl(var(--primary))';

// Contextual Toolbar Constants
const TOOLBAR_APPROX_WIDTH_MIN = 130; // Increased for Grip + Copy + Delete + Move
const TOOLBAR_APPROX_HEIGHT = 32; 
const VERTICAL_GAP_TOOLBAR = 8; 
const HORIZONTAL_EDGE_BUFFER = 8; 
const TOOLBAR_OFFSET_FROM_LINE_Y = 20;

// Base height for chart rendering area within ChartDisplay
const CHART_RENDERING_BASE_HEIGHT = 272; 


const LineStyleIcon = ({ style, className }: { style: 'solid' | 'dashed' | 'dotted', className?: string }) => {
  let strokeDasharray;
  if (style === 'dashed') strokeDasharray = "3,2";
  if (style === 'dotted') strokeDasharray = "1,2";
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className={cn("h-4 w-6", className)}>
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

  const endMarkerId = `dropdown-arrow-end-preview-${uniqueId}`;
  const startMarkerId = `dropdown-arrow-start-preview-${uniqueId}`;
  
  if (style === 'end') { x2 -= markerWidth; } 
  else if (style === 'both') { x1 += markerWidth; x2 -= markerWidth; }

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

interface PlotInstanceProps {
  instanceId: string;
  onRemovePlot: (id: string) => void;
  initialPlotTitle?: string;
}

export function PlotInstance({ instanceId, onRemovePlot, initialPlotTitle = "Data Plot" }: PlotInstanceProps) {
  const uniqueComponentId = useId(); // For unique IDs within this instance
  const { toast } = useToast();

  // Data and Plotting State
  const [rawCsvText, setRawCsvText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [dataSeries, setDataSeries] = useState<string[]>([]);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({});
  const [timeAxisLabel, setTimeAxisLabel] = useState<string | undefined>(undefined);
  const [plotTitle, setPlotTitle] = useState<string>(initialPlotTitle);
  const [isPlotCardExpanded, setIsPlotCardExpanded] = useState(false); // For chart height
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  
  // Validation and UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>(() => initialValidationSteps.map(s => ({...s})));
  const [currentFileForValidation, setCurrentFileForValidation] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMinimalistView, setIsMinimalistView] = useState(false);

  // Annotation State
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [lines, setLines] = useState<LineAnnotation[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  const [draggingPoint, setDraggingPoint] = useState<{ lineId: string; pointType: 'start' | 'end' } | null>(null);
  
  const [movingLineId, setMovingLineId] = useState<string | null>(null); 
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [lineBeingMovedOriginalState, setLineBeingMovedOriginalState] = useState<LineAnnotation | null>(null);

  const [contextualToolbarPosition, setContextualToolbarPosition] = useState<{x: number, y: number} | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [toolbarDragStart, setToolbarDragStart] = useState<{ x: number; y: number } | null>(null);
  const [toolbarInitialPosition, setToolbarInitialPosition] = useState<{ x: number; y: number } | null>(null);

  // Refs
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null); // This ref isn't explicitly used for sizing anymore, but could be for other purposes
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const jsonLoadInputRef = useRef<HTMLInputElement>(null);

  const currentChartHeight = useMemo(() => isPlotCardExpanded ? EXPANDED_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT, [isPlotCardExpanded]);
  const allSeriesSelected = useMemo(() => dataSeries.length > 0 && dataSeries.every(series => visibleSeries[series]), [dataSeries, visibleSeries]);
  const plottableSeries = useMemo(() => dataSeries.filter(seriesName => visibleSeries[seriesName]), [dataSeries, visibleSeries]);
  const selectedLine = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);

  const anyAnnotationInteractionActive = useMemo(() => 
    !!(draggingPoint || movingLineId || isDraggingToolbar),
  [draggingPoint, movingLineId, isDraggingToolbar]);
  
  const isMainToolbarButtonDisabled = useMemo(() => 
     anyAnnotationInteractionActive || !isOverlayActive, 
  [anyAnnotationInteractionActive, isOverlayActive]);
  
  const isContextualToolbarButtonDisabled = useMemo(() => 
     anyAnnotationInteractionActive || !selectedLineId, 
     [anyAnnotationInteractionActive, selectedLineId]
  );

  const svgCursor = useMemo(() => {
    if (isDraggingToolbar) return 'grabbing';
    if (movingLineId) return 'grabbing'; 
    if (draggingPoint) return 'grabbing'; // When dragging an endpoint
    if (selectedLineId && !anyAnnotationInteractionActive) return 'move'; // When selected, line itself can be moved
    return 'default';
  }, [selectedLineId, draggingPoint, movingLineId, isDraggingToolbar, anyAnnotationInteractionActive]);

  const yAxisConfigs: YAxisConfig[] = useMemo(() => {
    if (plottableSeries.length === 0) return [];
    // For CSV data, we usually have one or two primary Y-axes.
    // This example shows how you might configure up to two.
    const configs: YAxisConfig[] = [];
    if (plottableSeries[0]) {
      configs.push({
        id: `y-axis-csv-${instanceId}-${plottableSeries[0].replace(/[^a-zA-Z0-9]/g, '')}`,
        orientation: 'left',
        label: plottableSeries[0], // Use series name as label
        color: '--chart-1', 
        dataKey: plottableSeries[0],
        unit: '', // Unit is often unknown for generic CSV
      });
    }
    if (plottableSeries[1]) {
      configs.push({
        id: `y-axis-csv-${instanceId}-${plottableSeries[1].replace(/[^a-zA-Z0-9]/g, '')}`,
        orientation: 'right',
        label: plottableSeries[1],
        color: '--chart-2',
        dataKey: plottableSeries[1],
        unit: '',
      });
    }
    return configs;
  }, [plottableSeries, instanceId]);

   const initialValidationSteps: ValidationStep[] = useMemo(() => [
    { id: 'fileSelection', label: 'File selected', status: 'pending' },
    { id: 'fileType', label: `Checking file name, type, and size (must be .csv, < ${MAX_FILE_SIZE_MB}MB)`, status: 'pending' },
    { id: 'fileRead', label: 'Reading file content (checking if empty or unreadable)', status: 'pending' },
    { id: 'headerParse', label: 'Checking for header row', status: 'pending' },
    { id: 'xAxisIdentified', label: 'X-axis (time) column identified', status: 'pending' },
    { id: 'yAxisFirstVarIdentified', label: 'First Variable Column (for Y-axis) identified', status: 'pending' },
    { id: 'variableColumnCheck', label: 'Verifying variable column headers (and excluding "Rec" if last)', status: 'pending' },
    { id: 'dataRowFormat', label: 'Checking data rows for numeric values', status: 'pending' },
    { id: 'dataReady', label: 'Import complete', status: 'pending' },
  ], []);


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

  const updateContextualToolbarPos = useCallback((line: LineAnnotation | null) => {
    if (!line || !svgOverlayRef.current) {
      setContextualToolbarPosition(null);
      return;
    }
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const midX = (line.x1 + line.x2) / 2;
    let midY = (line.y1 + line.y2) / 2; // Initial Y, may be adjusted

    // Calculate potential top and bottom positions for the toolbar
    const toolbarTopY = midY - (TOOLBAR_APPROX_HEIGHT / 2) - TOOLBAR_OFFSET_FROM_LINE_Y;
    const toolbarBottomY = midY + (TOOLBAR_APPROX_HEIGHT / 2) + TOOLBAR_OFFSET_FROM_LINE_Y;

    let finalToolbarCenterY = toolbarTopY + (TOOLBAR_APPROX_HEIGHT / 2); // Default to above

    // Prefer above, but switch to below if not enough space above OR significantly more space below
    if (toolbarTopY < VERTICAL_GAP_TOOLBAR || 
        ( (svgRect.height - (midY + TOOLBAR_APPROX_HEIGHT + TOOLBAR_OFFSET_FROM_LINE_Y)) > (midY - TOOLBAR_OFFSET_FROM_LINE_Y - TOOLBAR_APPROX_HEIGHT) && 
          toolbarBottomY + (TOOLBAR_APPROX_HEIGHT / 2) + VERTICAL_GAP_TOOLBAR < svgRect.height ) ) {
      finalToolbarCenterY = toolbarBottomY - (TOOLBAR_APPROX_HEIGHT / 2);
    }
    
    // Clamp Y to stay within SVG bounds
    finalToolbarCenterY = Math.max(
      (TOOLBAR_APPROX_HEIGHT / 2) + VERTICAL_GAP_TOOLBAR,
      Math.min(finalToolbarCenterY, svgRect.height - (TOOLBAR_APPROX_HEIGHT / 2) - VERTICAL_GAP_TOOLBAR)
    );

    // Clamp X to stay within SVG bounds
    const halfToolbarWidth = TOOLBAR_APPROX_WIDTH_MIN / 2;
    const finalToolbarCenterX = Math.max(
      halfToolbarWidth + HORIZONTAL_EDGE_BUFFER,
      Math.min(midX, svgRect.width - halfToolbarWidth - HORIZONTAL_EDGE_BUFFER)
    );
    
    setContextualToolbarPosition({ x: finalToolbarCenterX, y: finalToolbarCenterY });
  }, []);

  const updateStepStatus = useCallback((stepId: string, status: 'success' | 'error' | 'pending' | 'warning', message?: string) => {
    setValidationSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status, message: message || (status === 'error' ? 'Failed' : 'Completed') } : step
      )
    );
  }, []);

  const parseAndValidateCsv = useCallback((csvText: string, fileName: string): { success: boolean; data?: DataPoint[], seriesNames?: string[], timeHeader?: string } => {
    const freshValidationSteps = initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }));
    setValidationSteps(freshValidationSteps); 

    const localLines = csvText.trim().split(/\r\n|\n/);

    if (localLines.length < 2) {
      updateStepStatus('headerParse', 'error', `CSV error: Must have a header row and at least one data row in file '${fileName}'.`);
      initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'headerParse') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
      return { success: false };
    }
    updateStepStatus('headerParse', 'success', "Header row found.");
    
    const delimiterRegex = /\s*[,;\t]\s*/; // Only comma, semicolon, or tab, with optional surrounding spaces
    const originalHeaders = localLines[0].trim().split(delimiterRegex).map(h => h.trim());
    
    let timeHeader = originalHeaders[0]?.trim();
    if (!timeHeader) {
      updateStepStatus('xAxisIdentified', 'warning', 'CSV Column 1 header is empty. Using "Time" as default X-axis label.');
      timeHeader = "Time";
    } else {
      updateStepStatus('xAxisIdentified', 'success', `Using CSV Column 1 header: '${timeHeader}' for X-axis data.`);
    }
    
    let potentialVariableHeaders = originalHeaders.slice(1);
    let actualVariableHeadersToProcess: string[];
    
    if (potentialVariableHeaders.length > 0 && potentialVariableHeaders[potentialVariableHeaders.length - 1].trim().toLowerCase() === 'rec') {
      actualVariableHeadersToProcess = potentialVariableHeaders.slice(0, -1);
      updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s). Last column "Rec" excluded.`);
    } else if (potentialVariableHeaders.length === 0 && originalHeaders.length > 1) {
       updateStepStatus('variableColumnCheck', 'error', `No data variable columns found after the first (time) column in file '${fileName}'. Supported delimiters: comma, semicolon, or tab.`);
       updateStepStatus('yAxisFirstVarIdentified', 'error', `No variable columns for Y-axis. CSV must have at least two columns (time + one variable).`);
       return { success: false };
    } else if (originalHeaders.length <= 1) {
        updateStepStatus('variableColumnCheck', 'error', `Expected at least two columns (time + one variable) in file '${fileName}'. Found ${originalHeaders.length}. Supported delimiters: comma, semicolon, or tab.`);
        updateStepStatus('yAxisFirstVarIdentified', 'error', `No variable columns for Y-axis.`);
        return { success: false };
    } else {
      actualVariableHeadersToProcess = [...potentialVariableHeaders];
      updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s).`);
    }

    if (actualVariableHeadersToProcess.length === 0) {
        const yAxisErrorMsg = `No plottable variable columns found after processing headers. Check CSV structure and delimiters (comma, semicolon, or tab).`;
        updateStepStatus('yAxisFirstVarIdentified', 'error', yAxisErrorMsg);
        return { success: false };
    }

    const uniqueSeriesNamesForDropdown: string[] = [];
    const usedKeyNamesForDataPoint = new Set<string>();
    usedKeyNamesForDataPoint.add('time'); 
    
    actualVariableHeadersToProcess.forEach(originalVarHeader => {
        let processedHeader = (originalVarHeader || "Unnamed_Variable").trim();
        if (!processedHeader || processedHeader.trim().toLowerCase() === 'time') { // Prevent 'time' as a variable name
          processedHeader = processedHeader.trim().toLowerCase() === 'time' ? `Time_Var_${(Math.random()*100).toFixed(0)}` : `Unnamed_Var_${(Math.random()*100).toFixed(0)}`;
        }
        
        let uniqueKey = processedHeader;
        let suffix = 1;
        while (usedKeyNamesForDataPoint.has(uniqueKey)) {
            uniqueKey = `${processedHeader}_(${suffix})`; 
            suffix++;
        }
        uniqueSeriesNamesForDropdown.push(uniqueKey);
        usedKeyNamesForDataPoint.add(uniqueKey);
    });
    
    const firstVarOriginalHeader = actualVariableHeadersToProcess[0]?.trim() || "Unnamed";
    const firstVarPlotKey = uniqueSeriesNamesForDropdown[0];
    updateStepStatus('yAxisFirstVarIdentified', 'success', `CSV Column 2 (original header: "${firstVarOriginalHeader}") provides data for the first variable. It will be plotted using data key: "${firstVarPlotKey}". Total plottable variables: ${uniqueSeriesNamesForDropdown.length}.`);
    
    const data: DataPoint[] = [];
    let someRowsHadNonNumericData = false;
    let validDataRowsCount = 0;

    for (let i = 1; i < localLines.length; i++) {
      const lineVal = localLines[i];
      const trimmedLine = lineVal.trim();
      if (!trimmedLine) continue; 
      
      const values = trimmedLine.split(delimiterRegex).map(v => v.trim());
      const timeValue = values[0];

      if (!timeValue && values.slice(1, 1 + uniqueSeriesNamesForDropdown.length).every(v => !v || v.trim() === "")) {
        continue;
      }
      
      const dataPoint: DataPoint = { time: timeValue || "N/A" };
      let hasNumericValueInRow = false;
      let rowHasParsingIssue = false;
      
      uniqueSeriesNamesForDropdown.forEach((uniqueKey, seriesIdx) => {
        const originalCsvColumnIndexForVar = seriesIdx + 1; 
        const rawValue = values[originalCsvColumnIndexForVar];
        let numericValue: string | number = NaN; 
        
        if (rawValue !== undefined && rawValue !== null && rawValue.trim() !== "") {
          const cleanedValue = rawValue.replace(/,/g, ''); 
          const parsedFloat = parseFloat(cleanedValue);
          if (!isNaN(parsedFloat)) {
            numericValue = parsedFloat;
            hasNumericValueInRow = true;
          } else {
            numericValue = rawValue; 
            someRowsHadNonNumericData = true;
            rowHasParsingIssue = true;
          }
        } else {
            numericValue = NaN; 
            someRowsHadNonNumericData = true;
            rowHasParsingIssue = true;
        }
        dataPoint[uniqueKey] = numericValue;
      });
      
      if (timeValue || hasNumericValueInRow) { 
         data.push(dataPoint);
         if (!rowHasParsingIssue && hasNumericValueInRow) { 
            validDataRowsCount++;
         }
      }
    }

    if (data.length === 0) {
      updateStepStatus('dataRowFormat', 'error', `No processable data rows found in '${fileName}'. Ensure variable columns contain numeric data. Supported delimiters: comma, semicolon, or tab.`);
      return { success: false };
    }
    
    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows fully numeric.`;
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric/empty values found; treated as missing (NaN) for plotting.";
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    } else {
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    }
    
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
      parsedResult.seriesNames.forEach((name, index) => { newVisibleSeries[name] = index < 4; }); // Default to first 4 selected
      setVisibleSeries(newVisibleSeries);
      
      setBrushStartIndex(0);
      setBrushEndIndex(parsedResult.data.length > 0 ? Math.min(Math.max(0, parsedResult.data.length - 1), 23) : undefined);
      
      // Reset annotation state when new data is loaded
      setLines([]); setSelectedLineId(null); setContextualToolbarPosition(null); 
      // isOverlayActive remains as is, user might want to annotate new data.
      setDraggingPoint(null); setMovingLineId(null); setDragStartCoords(null); 
      setLineBeingMovedOriginalState(null); setIsDraggingToolbar(false); setToolbarDragStart(null); setToolbarInitialPosition(null);

      const successToast = toast({ title: "File Processed Successfully", description: `${fileName} processed.` });
      if(successToast?.id) setTimeout(() => toast.dismiss(successToast.id), 2000);
      return { success: true, seriesNames: parsedResult.seriesNames, timeHeader: parsedResult.timeHeader };
    }
    return { success: false };
  }, [parseAndValidateCsv, toast]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true); 
    setCurrentFileForValidation(null);
    const file = event.target.files?.[0];
    const freshValidationSteps = initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }));
    setValidationSteps(freshValidationSteps); 
    setAccordionValue(""); 
    if (!file) {
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }
    setCurrentFileForValidation(file.name);
    const updateAndReturnError = (stepId: string, errorMsg: string, title?: string) => {
      updateStepStatus(stepId, 'error', errorMsg);
      setValidationSteps(prevSteps => prevSteps.map(step => {
          const stepIndex = initialValidationSteps.findIndex(s => s.id === step.id);
          const errorStepIndex = initialValidationSteps.findIndex(s => s.id === stepId);
          if (stepIndex > errorStepIndex && step.status === 'pending') {
            return { ...step, status: 'error', message: 'Prerequisite step failed.' };
          } return step;
      }));
      toast({ variant: "destructive", title: title || "File Validation Error", description: `${file.name}: ${errorMsg}` });
      setAccordionValue("validation-details-" + instanceId); return null;
    };
    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);
    if (!file.name.toLowerCase().endsWith(".csv")) {
      updateAndReturnError('fileType', `File name does not end with .csv. Please select a .csv file and try again.`, "Unsupported File Type");
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateAndReturnError('fileType', `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Max size is ${MAX_FILE_SIZE_MB}MB.`, "File Too Large");
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }
    updateStepStatus('fileType', 'success', 'File is .csv and within size limits.');
    let fileContent;
    try {
      fileContent = await file.text();
      if (!fileContent.trim()) {
        updateAndReturnError('fileRead', `File '${file.name}' is empty or contains only whitespace.`, "Empty File");
        setIsProcessing(false); if (event.target) event.target.value = ""; return;
      } updateStepStatus('fileRead', 'success', 'File content read successfully.');
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      updateAndReturnError('fileRead', `Could not read content from '${file.name}': ${errorMsg}.`, "File Read Error");
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }
    processCsvFileContent(fileContent, file.name);
    setIsProcessing(false); if (csvFileInputRef.current) csvFileInputRef.current.value = ""; 
  }, [instanceId, processCsvFileContent, toast, updateStepStatus, initialValidationSteps]);

  interface SavedPlotState {
    rawCsvText: string; currentFileName: string; plotTitle: string; timeAxisLabel?: string;
    dataSeries: string[]; visibleSeries: Record<string, boolean>; isPlotCardExpanded: boolean;
    isMinimalistView: boolean; brushStartIndex?: number; brushEndIndex?: number;
    lines?: LineAnnotation[]; isOverlayActive?: boolean;
  }

  const handleLoadSavedPlotFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true); 
    const file = event.target.files?.[0];
    if (!file) { setIsProcessing(false); return; }
    try {
      const jsonText = await file.text();
      const savedState = JSON.parse(jsonText) as SavedPlotState;
      if (!savedState.rawCsvText || !savedState.currentFileName || !savedState.plotTitle || !savedState.dataSeries || savedState.visibleSeries === undefined ) {
        throw new Error("Invalid save file structure. Missing essential fields.");
      }
      const { success: successfullyProcessed, seriesNames: actualSeriesInLoadedCsv, timeHeader: actualTimeHeader } = processCsvFileContent(savedState.rawCsvText, savedState.currentFileName);
      if (successfullyProcessed && actualSeriesInLoadedCsv) {
        setPlotTitle(savedState.plotTitle);
        const restoredVisibleSeries: Record<string, boolean> = {};
        actualSeriesInLoadedCsv.forEach(name => { restoredVisibleSeries[name] = savedState.visibleSeries[name] === true; });
        setVisibleSeries(restoredVisibleSeries);
        setIsPlotCardExpanded(savedState.isPlotCardExpanded === true); 
        setIsMinimalistView(savedState.isMinimalistView === true);
        setParsedData(currentParsedData => { 
          const dataLength = currentParsedData.length;
          setBrushStartIndex(dataLength > 0 && savedState.brushStartIndex !== undefined ? Math.min(dataLength -1, savedState.brushStartIndex) : 0);
          setBrushEndIndex(dataLength > 0 && savedState.brushEndIndex !== undefined ? Math.min(dataLength -1, savedState.brushEndIndex) : undefined);
          return currentParsedData; 
        });
        setLines(savedState.lines || []); setIsOverlayActive(savedState.isOverlayActive === true);
        if (savedState.timeAxisLabel !== undefined) setTimeAxisLabel(savedState.timeAxisLabel); 
        else if (actualTimeHeader) setTimeAxisLabel(actualTimeHeader);
        toast({ title: "Plot State Loaded", description: `Successfully loaded state from ${file.name}.` });
      } else {
         toast({ variant: "destructive", title: "Load Error", description: `Could not process CSV data from ${file.name}.` });
      }
    } catch (error: any) {
      console.error("Error loading plot state:", error);
      toast({ variant: "destructive", title: "Load Failed", description: error.message || `Could not load plot state from ${file.name}.` });
      const freshValidationSteps = initialValidationSteps.map(s => s.id === 'fileSelection' ? {...s, status: 'error', message: `Failed to load: ${error.message || 'Invalid file'}`} : {...s, status: 'error', message: 'Prerequisite step failed.'} );
      setValidationSteps(freshValidationSteps); setAccordionValue("validation-details-" + instanceId);
    }
    setIsProcessing(false); if (jsonLoadInputRef.current) jsonLoadInputRef.current.value = "";
  }, [instanceId, processCsvFileContent, toast, initialValidationSteps]);

  const handleSavePlot = useCallback(() => {
    if (!rawCsvText || !currentFileName) {
      toast({ variant: "destructive", title: "Cannot Save Plot", description: "No data loaded to save." }); return;
    }
    const stateToSave: SavedPlotState = {
      rawCsvText, currentFileName, plotTitle, timeAxisLabel, dataSeries, visibleSeries,
      isPlotCardExpanded, isMinimalistView, brushStartIndex, brushEndIndex, lines, isOverlayActive
    };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${plotTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'plot_save'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Plot State Saved", description: `Configuration saved as ${a.download}.` });
  }, [rawCsvText, currentFileName, plotTitle, timeAxisLabel, dataSeries, visibleSeries, isPlotCardExpanded, isMinimalistView, brushStartIndex, brushEndIndex, lines, isOverlayActive, toast]);

  const handleBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex); setBrushEndIndex(newIndex.endIndex);
  }, []);

  const handleClearDataInstance = useCallback(() => {
    setRawCsvText(null); setParsedData([]); setCurrentFileName(undefined);
    setPlotTitle(initialPlotTitle); setDataSeries([]); setVisibleSeries({}); setTimeAxisLabel(undefined);
    setValidationSteps(initialValidationSteps.map(s => ({...s}))); setCurrentFileForValidation(null); setAccordionValue("");
    setIsPlotCardExpanded(false); setIsMinimalistView(false);
    setBrushStartIndex(undefined); setBrushEndIndex(undefined);
    // Reset annotation states as well
    setLines([]); setSelectedLineId(null); setContextualToolbarPosition(null); setIsOverlayActive(false);
    setDraggingPoint(null); setMovingLineId(null); setDragStartCoords(null); 
    setLineBeingMovedOriginalState(null); setIsDraggingToolbar(false); setToolbarDragStart(null); setToolbarInitialPosition(null);
    if (csvFileInputRef.current) csvFileInputRef.current.value = "";
    if (jsonLoadInputRef.current) jsonLoadInputRef.current.value = "";
    toast({ title: "Data Cleared", description: "Plot data and annotations have been cleared." });
  }, [initialPlotTitle, toast, initialValidationSteps]);

  const handleSeriesVisibilityChange = useCallback((seriesName: string, isVisible: boolean) => {
    setVisibleSeries(prev => ({ ...prev, [seriesName]: isVisible }));
  }, []);

  const handleSelectAllToggle = useCallback((selectAll: boolean) => {
    const newVisibleSeries: Record<string, boolean> = {};
    dataSeries.forEach(name => { newVisibleSeries[name] = selectAll; });
    setVisibleSeries(newVisibleSeries);
  }, [dataSeries]);

  const getSummaryStep = useCallback((): ValidationStep | null => {
    if (!validationSteps.length && !isProcessing && !currentFileForValidation) return null;
    if (isProcessing && validationSteps.every(s => s.status === 'pending')) {
      return {id: 'processing', label: `Preparing to process ${currentFileForValidation || 'file'}...`, status: 'pending'};
    }
    if (validationSteps.length === 0 && currentFileForValidation) {
      return {id: 'fileSelectedSummary', label: `Processing: ${currentFileForValidation}`, status: 'pending' };
    }
    if (validationSteps.length === 0) return null;
    const currentProcessingStep = validationSteps.find(step => step.status === 'pending');
    if (isProcessing && currentProcessingStep) return { ...currentProcessingStep, label: `Processing: ${currentProcessingStep.label}` };
    const firstError = validationSteps.find(step => step.status === 'error');
    if (firstError) return firstError;
    const allSuccessful = validationSteps.every(step => step.status === 'success');
    if (allSuccessful) {
      const dataReadyStep = validationSteps.find(step => step.id === 'dataReady');
      if (dataReadyStep) return dataReadyStep;
    }
    const lastNonPendingStep = [...validationSteps].reverse().find(step => step.status !== 'pending');
    if (lastNonPendingStep) return lastNonPendingStep;
    return validationSteps[0] || null; 
  }, [validationSteps, isProcessing, currentFileForValidation]);

  const toggleOverlay = useCallback(() => {
    setIsOverlayActive(prev => {
      const nextState = !prev;
      if (!nextState) { 
        setSelectedLineId(null); setDraggingPoint(null); setMovingLineId(null);
        setContextualToolbarPosition(null); setIsDraggingToolbar(false); 
      }
      return nextState;
    });
  }, []);

  const handleAddLine = useCallback(() => {
    if (!svgOverlayRef.current || anyAnnotationInteractionActive) return;
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const centerX = svgRect.width / 2;
    const centerY = svgRect.height / 2;
    const defaultLineLength = Math.min(svgRect.width, svgRect.height) * 0.2;
    const newLine: LineAnnotation = {
      id: `${Date.now()}-${uniqueComponentId}-line`,
      x1: centerX - defaultLineLength / 2, y1: centerY,
      x2: centerX + defaultLineLength / 2, y2: centerY,
      arrowStyle: 'none', lineStyle: 'solid', strokeWidth: DEFAULT_STROKE_WIDTH, color: DEFAULT_LINE_COLOR,
    };
    setLines(prevLines => [...prevLines, newLine]);
    setSelectedLineId(newLine.id);
    updateContextualToolbarPos(newLine);
  }, [uniqueComponentId, anyAnnotationInteractionActive, updateContextualToolbarPos]);

  const handleArrowStyleChange = useCallback((style: 'none' | 'end' | 'both') => {
    if (selectedLineId && !anyAnnotationInteractionActive) {
      setLines(prevLines => prevLines.map(line => line.id === selectedLineId ? { ...line, arrowStyle: style } : line));
    }
  }, [selectedLineId, anyAnnotationInteractionActive]);

  const handleLineStyleChange = useCallback((style: 'solid' | 'dashed' | 'dotted') => {
    if (selectedLineId && !anyAnnotationInteractionActive) {
      setLines(prevLines => prevLines.map(line => line.id === selectedLineId ? { ...line, lineStyle: style } : line));
    }
  }, [selectedLineId, anyAnnotationInteractionActive]);

  const handleStrokeWeightChange = useCallback((newWeightArray: number[]) => {
    if (selectedLineId && !anyAnnotationInteractionActive) {
      const newWeight = newWeightArray[0];
      setLines(prevLines => prevLines.map(line => line.id === selectedLineId ? { ...line, strokeWidth: newWeight } : line));
    }
  }, [selectedLineId, anyAnnotationInteractionActive]);
  
  const handleLineColorChange = useCallback((color: string) => {
     if (selectedLineId && !anyAnnotationInteractionActive) {
      setLines(prevLines => prevLines.map(line => line.id === selectedLineId ? { ...line, color: color } : line));
    }
  }, [selectedLineId, anyAnnotationInteractionActive]);

  const handleCopySelectedLine = useCallback(() => {
    if (!selectedLineId || anyAnnotationInteractionActive) return;
    const lineToCopy = lines.find(l => l.id === selectedLineId);
    if (lineToCopy && svgOverlayRef.current) {
        const svgRect = svgOverlayRef.current.getBoundingClientRect();
        let offsetX = 10, offsetY = 10;
        
        let newX1 = lineToCopy.x1 + offsetX;
        let newY1 = lineToCopy.y1 + offsetY;
        let newX2 = lineToCopy.x2 + offsetX;
        let newY2 = lineToCopy.y2 + offsetY;

        // If offset pushes it too far, try offsetting in the opposite direction
        if (newX2 > svgRect.width || newX1 < 0 || newY2 > svgRect.height || newY1 < 0) {
            offsetX = -10; offsetY = -10;
            newX1 = lineToCopy.x1 + offsetX; newY1 = lineToCopy.y1 + offsetY;
            newX2 = lineToCopy.x2 + offsetX; newY2 = lineToCopy.y2 + offsetY;
        }
        
        // Clamp to bounds
        newX1 = Math.max(0, Math.min(newX1, svgRect.width));
        newY1 = Math.max(0, Math.min(newY1, svgRect.height));
        newX2 = Math.max(0, Math.min(newX2, svgRect.width));
        newY2 = Math.max(0, Math.min(newY2, svgRect.height));

        const newCopiedLine: LineAnnotation = {
            ...lineToCopy, 
            id: `${Date.now()}-${uniqueComponentId}-line-copy`,
            x1: newX1, y1: newY1,
            x2: newX2, y2: newY2,
        };
        setLines(prevLines => [...prevLines, newCopiedLine]);
        setSelectedLineId(newCopiedLine.id);
        updateContextualToolbarPos(newCopiedLine);
        toast({ title: "Line Copied", duration: 2000 });
    }
  }, [selectedLineId, lines, uniqueComponentId, toast, anyAnnotationInteractionActive, updateContextualToolbarPos]);

  const handleDeleteSelectedLine = useCallback(() => {
    if (selectedLineId && !anyAnnotationInteractionActive) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
      toast({ title: "Line Deleted", duration: 2000 });
    }
  }, [selectedLineId, toast, anyAnnotationInteractionActive]);

  const handleToolbarDragStart = useCallback((event: ReactMouseEvent | ReactTouchEvent) => {
    event.stopPropagation();
    if (!contextualToolbarPosition || draggingPoint || movingLineId ) return;
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    
    const { clientX, clientY } = getNormalizedCoordinates(event);
    setToolbarDragStart({ x: clientX, y: clientY });
    setToolbarInitialPosition({ ...contextualToolbarPosition });
    setIsDraggingToolbar(true);
  }, [contextualToolbarPosition, getNormalizedCoordinates, draggingPoint, movingLineId]);

  const getStrokeDasharray = useCallback((style?: 'solid' | 'dashed' | 'dotted') => {
    switch (style) {
      case 'dashed': return "5,5";
      case 'dotted': return "1,4";
      case 'solid': default: return undefined;
    }
  }, []);

  const handleSvgBackgroundClick = useCallback((event: ReactMouseEvent<SVGElement> | ReactTouchEvent<SVGElement>) => {
    if (event.target === svgOverlayRef.current && !draggingPoint && !movingLineId && !isDraggingToolbar) { 
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
    }
  }, [draggingPoint, movingLineId, isDraggingToolbar]);

  const handleLineHitboxInteractionStart = useCallback((line: LineAnnotation, event: ReactMouseEvent<SVGGElement> | ReactTouchEvent<SVGGElement>) => {
    event.stopPropagation();
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    if (draggingPoint) return; // If already dragging an endpoint, don't start a line move

    setSelectedLineId(line.id); // Select the line first
    updateContextualToolbarPos(line); // Show toolbar for selected line

    // Initiate whole line move
    if (!svgOverlayRef.current) return;
    const { clientX, clientY } = getNormalizedCoordinates(event);
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    setDragStartCoords({ x: clientX - svgRect.left, y: clientY - svgRect.top });
    setLineBeingMovedOriginalState({ ...line });
    setMovingLineId(line.id); // Set movingLineId to indicate a line move is in progress
    
  }, [getNormalizedCoordinates, draggingPoint, updateContextualToolbarPos]);
  
  const handleDraggablePointInteractionStart = useCallback((lineId: string, pointType: 'start' | 'end', event: ReactMouseEvent<SVGCircleElement> | ReactTouchEvent<SVGCircleElement>) => {
    event.stopPropagation();
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    if (movingLineId) return; // If moving whole line, don't start endpoint drag

    setSelectedLineId(lineId);
    setDraggingPoint({ lineId, pointType });
  }, [movingLineId]);

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
        
        let newToolbarX = toolbarInitialPosition.x + dxGlobal;
        let newToolbarY = toolbarInitialPosition.y + dyGlobal;
        
        const halfToolbarWidth = TOOLBAR_APPROX_WIDTH_MIN / 2;
        newToolbarY = Math.max(TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR, Math.min(newToolbarY, svgRect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR));
        newToolbarX = Math.max(halfToolbarWidth + HORIZONTAL_EDGE_BUFFER, Math.min(newToolbarX, svgRect.width - halfToolbarWidth - HORIZONTAL_EDGE_BUFFER));
        setContextualToolbarPosition({ x: newToolbarX, y: newToolbarY });
    }
    
    if (lineToUpdateForToolbar && (draggingPoint || movingLineId)) {
      updateContextualToolbarPos(lineToUpdateForToolbar);
    }

  }, [draggingPoint, movingLineId, dragStartCoords, lineBeingMovedOriginalState, getNormalizedCoordinates, updateContextualToolbarPos, isDraggingToolbar, toolbarDragStart, toolbarInitialPosition]);

  const handleInteractionEnd = useCallback(() => {
    let lineForToolbarUpdate: LineAnnotation | null = null;
    if(draggingPoint) lineForToolbarUpdate = lines.find(l => l.id === draggingPoint.lineId) || null;
    else if (movingLineId) lineForToolbarUpdate = lines.find(l => l.id === movingLineId) || null;
    
    setDraggingPoint(null);
    setMovingLineId(null);
    setDragStartCoords(null);
    setLineBeingMovedOriginalState(null);

    if (isDraggingToolbar) {
        setIsDraggingToolbar(false);
        setToolbarDragStart(null);
        setToolbarInitialPosition(null);
    } else if(lineForToolbarUpdate) { // Only update toolbar if a line was being manipulated
        updateContextualToolbarPos(lineForToolbarUpdate);
    }
  }, [lines, draggingPoint, movingLineId, isDraggingToolbar, updateContextualToolbarPos]);

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
    if (!isProcessing && validationSteps.length > 0) {
      const hasError = validationSteps.some(step => step.status === 'error');
      if (hasError) {
        setAccordionValue("validation-details-" + instanceId);
      }
    }
  }, [isProcessing, validationSteps, instanceId]);

  useEffect(() => {
    if (!isOverlayActive) {
      setSelectedLineId(null); setContextualToolbarPosition(null); setDraggingPoint(null);
      setMovingLineId(null); setIsDraggingToolbar(false); 
    }
  }, [isOverlayActive]);

  const summaryStep = getSummaryStep();
  const csvFileInputId = `${uniqueComponentId}-csv-upload-${instanceId}`;
  const jsonLoadInputId = `${uniqueComponentId}-json-load-${instanceId}`;
  const chartRenderingHeight = isPlotCardExpanded ? EXPANDED_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT;

  return (
    <Card className="shadow-lg"> {/* Removed mb-6, parent `space-y-3` will handle it */}
      {/* CardHeader (same as before) ... */}
      <CardHeader className="flex flex-row items-center justify-between p-3"> {/* Reduced padding */}
        <CardTitle className="flex items-center gap-2 text-sm text-foreground"> {/* Reduced text size */}
          <Settings2 className="h-4 w-4"/> {/* Reduced icon size */}
          {plotTitle}
        </CardTitle>
        <div className="flex items-center gap-0.5">
            {/* Annotation Toggle */}
            <TooltipProvider delayDuration={100}>
               <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant={isOverlayActive ? "default" : "outline"}
                        onClick={toggleOverlay}
                        className={cn(
                          "h-7 px-2 text-xs", // Combined icon + text button
                          isOverlayActive 
                            ? "bg-accent hover:bg-accent/90 text-accent-foreground"
                            : "border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                        )}
                        aria-label="Toggle Annotation Tools"
                    >
                        <FilePenLine className="h-3.5 w-3.5 mr-1" />
                        Annotate
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{isOverlayActive ? "Disable" : "Enable"} Annotation Tools</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Separator orientation="vertical" className="h-5 mx-0.5" /> {/* Reduced margin */}
          
          <TooltipProvider delayDuration={0}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleSavePlot} aria-label="Save plot state" className="h-7 w-7" disabled={!rawCsvText}><Save className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Save Plot</p></TooltipContent></Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsMinimalistView(!isMinimalistView)} aria-label={isMinimalistView ? "Show controls" : "Hide controls"} className="h-7 w-7">
                  {isMinimalistView ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{isMinimalistView ? "Show Controls" : "Minimalist View"}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
           <TooltipProvider delayDuration={0}>
            <Tooltip><TooltipTrigger asChild>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7" 
                    onClick={() => setIsPlotCardExpanded(!isPlotCardExpanded)} 
                    disabled={parsedData.length === 0 || isMinimalistView || isMinimized} 
                    aria-label={isPlotCardExpanded ? "Collapse plot height" : "Expand plot height"}
                 >
                    {isPlotCardExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                 </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>{isPlotCardExpanded ? "Collapse Plot Height" : "Expand Plot Height"}</p></TooltipContent></Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={0}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => setIsMinimized(!isMinimized)} aria-label={isMinimized ? "Expand plot" : "Minimize plot"} className="h-7 w-7">{isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}</Button></TooltipTrigger><TooltipContent side="bottom"><p>{isMinimized ? "Expand Plot" : "Minimize Plot"}</p></TooltipContent></Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={0}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onRemovePlot(instanceId)} aria-label="Remove plot" className="h-7 w-7"><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Remove Plot</p></TooltipContent></Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className={cn("p-2 pt-1", !isMinimalistView && "md:grid md:grid-cols-12 md:gap-2")}>
          {!isMinimalistView && (
            <>
              {/* Left Column: Import & Validate */}
              <div className="md:col-span-2 space-y-1.5 flex flex-col">
                <div className="space-y-1 border p-1.5 rounded-md flex flex-col flex-1 min-h-0">
                     <div className="flex items-center gap-1">
                         <Settings2 className="h-3 w-3 text-[#2B7A78]" />
                         <h3 className="text-xs font-semibold text-[#2B7A78]">Import & Validate</h3>
                     </div>
                    <div className="px-1 py-1.5">
                        <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                          <UiLabel htmlFor={csvFileInputId} className="cursor-pointer flex items-center justify-center">
                            Choose file
                          </UiLabel>
                        </Button>
                        <Input
                          id={csvFileInputId}
                          ref={csvFileInputRef}
                          type="file"
                          accept=".csv"
                          onChange={handleFileChange}
                          disabled={isProcessing}
                          className="text-xs text-transparent file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[0.7rem] file:font-normal file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                        />
                    </div>
                  <div className="px-1 pb-1">
                    <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                      <UiLabel htmlFor={jsonLoadInputId} className="cursor-pointer flex items-center justify-center">
                        <Upload className="mr-1.5 h-3 w-3" /> Load Plot
                      </UiLabel>
                    </Button>
                    <Input
                      id={jsonLoadInputId}
                      ref={jsonLoadInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleLoadSavedPlotFileChange}
                      disabled={isProcessing}
                      className="sr-only"
                    />
                  </div>
                  {currentFileForValidation && !summaryStep && isProcessing && (
                       <p className="text-[0.6rem] text-primary animate-pulse px-1">Preparing: <span className="font-semibold">{currentFileForValidation}</span>...</p>
                  )}
                  {summaryStep && (
                    <div className="px-1">
                    <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue} className="w-full">
                      <AccordionItem value={"validation-details-" + instanceId} className="border-b-0">
                        <AccordionTrigger
                          className={cn(
                            "flex items-center justify-between text-[0.6rem] p-1 rounded-md hover:no-underline hover:bg-muted/50 text-left",
                            summaryStep.status === 'error' && 'bg-destructive/10 text-destructive hover:bg-destructive/20',
                            summaryStep.status === 'success' && validationSteps.every(s => s.status === 'success' || s.status === 'pending') && !isProcessing && 'bg-green-500/10 text-green-700 hover:bg-green-500/20',
                            (isProcessing || summaryStep.status === 'pending') && 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20',
                            "[&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3 py-1"
                        )}>
                          <div className="flex items-center gap-1 min-w-0">
                            {isProcessing || summaryStep.status === 'pending' ? <Hourglass className="h-2.5 w-2.5 animate-spin flex-shrink-0" /> :
                             summaryStep.status === 'success' ? <CheckCircle2 className="h-2.5 w-2.5 text-green-600 flex-shrink-0" /> :
                             <XCircleIcon className="h-2.5 w-2.5 text-destructive flex-shrink-0" />}
                             <span className="font-medium text-[0.55rem] whitespace-nowrap overflow-hidden text-ellipsis">
                               {summaryStep.label}
                             </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0.5 pb-0">
                          <div className="text-[0.55rem] text-muted-foreground px-1 pb-0.5">
                              File: {currentFileForValidation || currentFileName || "N/A"}
                          </div>
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
                                  <span className={cn('block text-[0.55rem] leading-tight', step.status === 'error' && 'text-destructive font-semibold', step.status === 'success' && 'text-green-600', step.status === 'warning' && 'text-yellow-600')}>
                                    {step.label}
                                  </span>
                                  {step.message && step.status !== 'pending' && (
                                      <span className={cn("text-[0.45rem] block whitespace-pre-wrap leading-tight", step.status === 'error' ? 'text-red-700' : step.status === 'warning' ? 'text-yellow-700' : 'text-muted-foreground')} title={step.message}>
                                         &ndash; {step.message}
                                      </span>
                                  )}
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
                  {!summaryStep && !isProcessing && !currentFileForValidation && (
                       <p className="text-[0.6rem] text-muted-foreground px-1 pb-0.5">Upload CSV or Load Plot.</p>
                  )}
                  <div className="px-1 pb-0.5 pt-1 space-y-1">
                    <Button onClick={handleClearDataInstance} variant="outline" size="sm" className="w-full h-7 text-xs" disabled={isProcessing || (!currentFileName && !rawCsvText)}>
                      Clear Data
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Middle Column: Select Variables */}
              <div className="md:col-span-2 space-y-1.5 flex flex-col">
                 <div className="space-y-1 p-1.5 border rounded-md flex flex-col flex-1 min-h-0">
                  <div className="flex items-center gap-1">
                    <ListFilter className="h-3 w-3 text-[#2B7A78]" />
                    <h3 className="text-xs font-semibold text-[#2B7A78]">Select Variables</h3>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Checkbox id={`select-all-rhs-${instanceId}-${uniqueComponentId}`} checked={allSeriesSelected} onCheckedChange={() => handleSelectAllToggle(!allSeriesSelected)} disabled={dataSeries.length === 0} aria-label={allSeriesSelected ? "Deselect all series" : "Select all series"} className="h-3.5 w-3.5" />
                    <UiLabel htmlFor={`select-all-rhs-${instanceId}-${uniqueComponentId}`} className="text-xs font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {allSeriesSelected ? "Deselect All" : "Select All"} ({plottableSeries.length}/{dataSeries.length})
                    </UiLabel>
                  </div>
                   <ScrollArea className="w-full rounded-md border p-1 h-48">
                    {dataSeries.length > 0 ? (
                      dataSeries.map((seriesName) => (
                        <div key={seriesName} className="flex items-center space-x-1.5 py-0.5">
                          <Checkbox id={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`} checked={!!visibleSeries[seriesName]} onCheckedChange={(checked) => handleSeriesVisibilityChange(seriesName, !!checked)} className="h-3.5 w-3.5" />
                          <UiLabel htmlFor={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`} className="text-xs leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate" title={seriesName}>
                            {seriesName}
                          </UiLabel>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        No variables found.
                      </p>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </>
          )}

          {/* Right Column: Plot Area */}
          <div className={cn(!isMinimalistView ? "md:col-span-8 md:self-start" : "", isMinimalistView ? "flex-1 min-h-0" : "")}>
             <div ref={chartAreaRef} className="relative" style={{ height: `${CHART_RENDERING_BASE_HEIGHT * 0.85}px` }}> {/* This div defines the drawing "box" */}
                <div className={cn(
                    "w-full h-full", 
                    (isOverlayActive && (anyAnnotationInteractionActive || isDrawingLine)) && "opacity-30 pointer-events-none"
                )}>
                    <ChartDisplay
                        data={parsedData}
                        plottableSeries={plottableSeries}
                        yAxisConfigs={yAxisConfigs}
                        timeAxisLabel={timeAxisLabel || "Time"}
                        chartRenderHeight={chartRenderingHeight}
                        brushStartIndex={brushStartIndex}
                        brushEndIndex={brushEndIndex}
                        onBrushChange={handleBrushChange}
                        plotTitle={plotTitle}
                    />
                </div>
                {isOverlayActive && (
                  <>
                    {/* Main Fixed Annotation Toolbar */}
                    <div className="absolute top-1 left-1 z-20 bg-card border shadow-lg rounded-md p-0.5 flex items-center space-x-0.5 flex-wrap">
                       <TooltipProvider delayDuration={100}>
                          <Tooltip>
                              <TooltipTrigger asChild>
                              <Button
                                  variant={"outline"}
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={handleAddLine}
                                  disabled={isMainToolbarButtonDisabled}
                                  aria-label={"Add Line"}
                              >
                                  <Plus className="h-3.5 w-3.5 mr-1" /> Line
                              </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Add New Line</p></TooltipContent>
                          </Tooltip>
                          <Separator orientation="vertical" className="h-5 mx-0.5" />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Style & Thickness Options">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                                      <rect y="3" width="16" height="1.5" rx="0.5"/><rect y="6.25" width="16" height="2.5" rx="0.5"/><rect y="10.5" width="16" height="3.5" rx="0.5"/>
                                    </svg>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-60">
                                  <DropdownMenuLabel>Line Style</DropdownMenuLabel>
                                  <DropdownMenuSeparatorShadcn />
                                  <DropdownMenuRadioGroup value={selectedLine?.lineStyle || 'solid'} onValueChange={(value) => handleLineStyleChange(value as 'solid' | 'dashed' | 'dotted')}>
                                    {(['solid', 'dashed', 'dotted'] as const).map(s => 
                                      <DropdownMenuRadioItem key={s} value={s} className="text-xs py-1 flex items-center">
                                        <LineStyleIcon style={s} className="mr-2"/> 
                                      </DropdownMenuRadioItem>
                                    )}
                                  </DropdownMenuRadioGroup>
                                  <DropdownMenuSeparatorShadcn />
                                  <DropdownMenuLabel>Stroke Weight</DropdownMenuLabel>
                                  <div className="px-2 py-1.5 flex items-center space-x-2">
                                    <Slider defaultValue={[DEFAULT_STROKE_WIDTH]} value={[selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH]} onValueChange={handleStrokeWeightChange} min={1} max={10} step={0.5} disabled={isMainToolbarButtonDisabled || !selectedLineId} className="flex-grow" />
                                    <span className="text-xs w-12 text-right tabular-nums">{(selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH).toFixed(1)}px</span>
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TooltipTrigger>
                            <TooltipContent><p>Line Style & Thickness</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Arrow Style Options">
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
                                        <ArrowStyleIcon style={opt.value as 'none' | 'end' | 'both'} uniqueId={`${uniqueComponentId}-${opt.value}`} className="mr-2"/>
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
                                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Color Options">
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
                    {/* SVG Overlay for drawing */}
                    <svg
                        ref={svgOverlayRef}
                        width="100%"
                        height="100%"
                        className="absolute top-0 left-0 z-10"
                        onMouseDown={handleSvgBackgroundClick} // Used for deselecting lines
                        onTouchStart={handleSvgBackgroundClick}
                        onMouseMove={handleInteractionMove} // Handles global move for dragging
                        onTouchMove={handleInteractionMove}
                        onMouseUp={handleInteractionEnd} // Handles global end for dragging
                        onTouchEnd={handleInteractionEnd}
                        style={{ 
                          cursor: svgCursor,
                          pointerEvents: (isOverlayActive && (anyAnnotationInteractionActive)) ? 'auto' : 'none'
                        }}
                    >
                      <defs>
                        <marker id={`arrowheadEnd-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                        <marker id={`arrowheadStart-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="3" refY="1.75" orient="auto-start-reverse" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                      </defs>
                        
                      {lines.map((line) => (
                      <g key={line.id} >
                          {/* Hitbox for selection and starting move */}
                          <line 
                              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                              stroke="transparent" strokeWidth="20"
                              className={cn( (selectedLineId === line.id && !anyAnnotationInteractionActive) ? "cursor-move" : "cursor-pointer")}
                              onMouseDown={(e) => handleLineHitboxInteractionStart(line, e)}
                              onTouchStart={(e) => handleLineHitboxInteractionStart(line, e as unknown as ReactTouchEvent<SVGGElement>)}
                              style={{ pointerEvents: (anyAnnotationInteractionActive && movingLineId !== line.id && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }}
                          />
                          {/* Visible line */}
                          <line 
                              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                              stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : (line.color || DEFAULT_LINE_COLOR)}
                              strokeWidth={selectedLineId === line.id ? (line.strokeWidth || DEFAULT_STROKE_WIDTH) + SELECTED_STROKE_WIDTH_OFFSET : (line.strokeWidth || DEFAULT_STROKE_WIDTH)}
                              markerStart={(line.arrowStyle === 'start' || line.arrowStyle === 'both') ? `url(#arrowheadStart-${instanceId})` : undefined}
                              markerEnd={(line.arrowStyle === 'end' || line.arrowStyle === 'both') ? `url(#arrowheadEnd-${instanceId})` : undefined}
                              strokeDasharray={getStrokeDasharray(line.lineStyle)}
                              style={{ pointerEvents: 'none' }} 
                          />
                          {/* Draggable endpoint handles for selected line */}
                          {selectedLineId === line.id && !movingLineId && !isDraggingToolbar && (
                          <>
                              <circle cx={line.x1} cy={line.y1} r="8" fill="hsl(var(--destructive))" fillOpacity="0.3" className="cursor-grab active:cursor-grabbing" 
                                onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} 
                                onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} 
                                style={{ pointerEvents: (anyAnnotationInteractionActive && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }}/>
                              <circle cx={line.x1} cy={line.y1} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }}/>
                              <circle cx={line.x2} cy={line.y2} r="8" fill="hsl(var(--destructive))" fillOpacity="0.3" className="cursor-grab active:cursor-grabbing" 
                                onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} 
                                onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} 
                                style={{ pointerEvents: (anyAnnotationInteractionActive && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }}/>
                              <circle cx={line.x2} cy={line.y2} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }}/>
                          </>
                          )}
                      </g>
                      ))}
                      {/* Floating Contextual Toolbar */}
                      {isOverlayActive && selectedLineId && contextualToolbarPosition && !draggingPoint && !movingLineId && (
                        <foreignObject 
                          x={contextualToolbarPosition.x - (TOOLBAR_APPROX_WIDTH_MIN / 2)} 
                          y={contextualToolbarPosition.y - (TOOLBAR_APPROX_HEIGHT / 2)} 
                          width={TOOLBAR_APPROX_WIDTH_MIN} height={TOOLBAR_APPROX_HEIGHT} 
                          style={{ pointerEvents: anyAnnotationInteractionActive ? 'none' : 'auto' }}
                        >
                           <TooltipProvider delayDuration={0}>
                              <div 
                                  className="flex items-center space-x-0.5 p-0.5 bg-card border shadow-xl rounded-md cursor-default" 
                                  onMouseDown={(e) => e.stopPropagation()} // Prevent SVG click from deselecting line
                                  onTouchStart={(e) => e.stopPropagation()}
                              >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="h-7 w-7 cursor-grab active:cursor-grabbing"
                                          onMouseDown={handleToolbarDragStart}
                                          onTouchStart={handleToolbarDragStart}
                                          disabled={isContextualToolbarButtonDisabled}
                                          aria-label="Move Toolbar"
                                      >
                                          <GripVertical className="h-4 w-4"/>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom"><p>Move Toolbar</p></TooltipContent>
                                  </Tooltip>
                                  <Separator orientation="vertical" className="h-4 mx-0.5"/>
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
                  </>
                )}
            </div>
          </div>
        </CardContent>
      )}
      {/* PlotInstance Footer for expanding plot area - only if not minimized and data exists */}
      {parsedData.length > 0 && !isMinimalistView && !isMinimized && (
        <div className="flex justify-center pt-1 pb-1 border-t">
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7" 
                            onClick={() => setIsPlotCardExpanded(!isPlotCardExpanded)} 
                            aria-label={isPlotCardExpanded ? "Collapse plot height" : "Expand plot height"}
                        >
                            {isPlotCardExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{isPlotCardExpanded ? "Collapse Plot Height" : "Expand Plot Height"}</p></TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
      )}
    </Card>
  );
}
