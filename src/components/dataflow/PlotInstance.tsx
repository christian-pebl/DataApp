"use client";

import type { ChangeEvent } from "react";
import React, { useState, useEffect, useId, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { Switch } from "@/components/ui/switch";
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
  Hourglass, CheckCircle2, XCircle, ListFilter, X, Maximize2, Minimize2, Settings2, ChevronsDown, ChevronsUp,
  UploadCloud, Save, Upload, PenLine, Plus, Ban, Palette, Copy, GripVertical, Trash2, MoveRight,
  Move as MoveIcon, ArrowUpRight, Spline, Highlighter, Scissors, CornerUpRight, ChevronsLeft, ChevronsRight // Added ChevronsLeft and ChevronsRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// --- Constants and Type Definitions ---
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

const TOOLBAR_APPROX_WIDTH_THREE_BUTTONS = 120;
const TOOLBAR_APPROX_HEIGHT = 30;
const VERTICAL_GAP_TOOLBAR = 8;
const HORIZONTAL_EDGE_BUFFER_TOOLBAR = 8;
const TOOLBAR_OFFSET_FROM_LINE_Y = 10;

const CHART_RENDERING_BASE_HEIGHT = 278; // Used for default rendering before expansion

const initialValidationSteps: ValidationStep[] = [
  { id: 'fileSelection', label: 'File selected', status: 'pending' },
  { id: 'fileType', label: `Checking file name, type, and size (must be .csv, < ${MAX_FILE_SIZE_MB}MB)`, status: 'pending' },
  { id: 'fileRead', label: 'Reading file content (checking if empty or unreadable)', status: 'pending' },
  { id: 'headerParse', label: 'Checking for header row', status: 'pending' },
  { id: 'xAxisIdentified', label: 'X-axis (time) column identified', status: 'pending' },
  { id: 'variableColumnCheck', label: 'Verifying variable column headers (and excluding "Rec" if last)', status: 'pending' },
  { id: 'yAxisFirstVarIdentified', label: 'First Variable Column (for Y-axis) identified', status: 'pending' },
  { id: 'dataRowFormat', label: 'Checking data rows for numeric values', status: 'pending' },
  { id: 'dataReady', label: 'Import complete', status: 'pending' },
];

// --- Helper Components (Defined outside main component for clarity if complex) ---
const LineStyleIcon = ({ style }: { style: 'solid' | 'dashed' | 'dotted' }) => {
  let strokeDasharray;
  if (style === 'dashed') strokeDasharray = "3,2";
  if (style === 'dotted') strokeDasharray = "1,2";
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="mr-2">
      <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray={strokeDasharray} />
    </svg>
  );
};

const ArrowStyleIcon = ({ style, uniqueId }: { style: 'none' | 'end' | 'both', uniqueId: string }) => {
  const markerWidth = 3;
  const markerHeight = 3.5;
  const refY = markerHeight / 2;
  const padding = 2;
  let x1 = padding;
  let x2 = 24 - padding;

  const startMarkerId = `dropdown-arrow-start-preview-${uniqueId}`;
  const endMarkerId = `dropdown-arrow-end-preview-${uniqueId}`;

  if (style === 'end' || style === 'both') x2 -= markerWidth;
  if (style === 'both') x1 += markerWidth;

  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="mr-2">
      <defs>
        <marker id={endMarkerId} markerWidth={markerWidth} markerHeight={markerHeight} refX="0" refY={refY} orient="auto" fill="currentColor">
          <polygon points={`0 0, ${markerWidth} ${refY}, 0 ${markerHeight}`} />
        </marker>
        <marker id={startMarkerId} markerWidth={markerWidth} markerHeight={markerHeight} refX="0" refY={refY} orient="auto-start-reverse" fill="currentColor">
          <polygon points={`0 0, ${markerWidth} ${refY}, 0 ${markerHeight}`} />
        </marker>
      </defs>
      <line
        x1={x1} y1="8" x2={x2} y2="8" stroke="currentColor" strokeWidth="2"
        markerStart={style === 'both' ? `url(#${startMarkerId})` : undefined}
        markerEnd={(style === 'end' || style === 'both') ? `url(#${endMarkerId})` : undefined}
      />
    </svg>
  );
};

const ColorSwatch = ({ color }: { color: string }) => (
  <div className="w-3 h-3 rounded-sm border border-border mr-2 flex-shrink-0" style={{ backgroundColor: color }} />
);


interface PlotInstanceProps {
  instanceId: string;
  onRemovePlot: (id: string) => void;
  initialPlotTitle?: string;
}

// --- Main Component ---
export function PlotInstance({ instanceId, onRemovePlot, initialPlotTitle = "Data Plot" }: PlotInstanceProps) {
  // --- Hooks: Order is critical ---
  // 1. useId
  const uniqueComponentId = useId();

  // 2. useState
  const [rawCsvText, setRawCsvText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [dataSeries, setDataSeries] = useState<string[]>([]);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({});
  const [timeAxisLabel, setTimeAxisLabel] = useState<string | undefined>(undefined);
  const [plotTitle, setPlotTitle] = useState<string>(initialPlotTitle);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>(() => initialValidationSteps.map(s => ({...s})));
  const [currentFileForValidation, setCurrentFileForValidation] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMinimalistView, setIsMinimalistView] = useState(false);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false);
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

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
  const [activeTool, setActiveTool] = useState<'line' | null>(null);


  // 3. useRef
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const jsonLoadInputRef = useRef<HTMLInputElement>(null);


  // 4. Other library/custom hooks
  const { toast, dismiss } = useToast();

  // 5. useMemo
  const currentChartHeight = useMemo(() => isPlotExpanded ? EXPANDED_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT, [isPlotExpanded]);
  const allSeriesSelected = useMemo(() => dataSeries.length > 0 && dataSeries.every(series => visibleSeries[series]), [dataSeries, visibleSeries]);

  const yAxisConfigs: YAxisConfig[] = useMemo(() => {
    if (dataSeries.length > 0) {
      const firstVisibleSeriesKey = dataSeries.find(key => visibleSeries[key]) || dataSeries[0];
      if (firstVisibleSeriesKey) {
        return [{
          id: `y-axis-csv-${instanceId}`,
          orientation: 'left',
          label: firstVisibleSeriesKey,
          color: '--chart-1',
          dataKey: firstVisibleSeriesKey,
          unit: '',
        }];
      }
    }
    return [];
  }, [dataSeries, visibleSeries, instanceId]);

  const plottableSeries = useMemo(() => dataSeries.filter(seriesName => visibleSeries[seriesName]), [dataSeries, visibleSeries]);
  const selectedLineForToolbar = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);

  const anyAnnotationInteractionActive = useMemo(() => !!(draggingPoint || movingLineId || isDraggingToolbar), [draggingPoint, movingLineId, isDraggingToolbar]);
  const isDrawingToolActive = useMemo(() => activeTool === 'line', [activeTool]);

  const svgCursor = useMemo(() => {
    if (isDraggingToolbar) return 'grabbing';
    if (movingLineId) return 'grabbing';
    if (draggingPoint) return 'grabbing';
    if (activeTool === 'line') return 'crosshair';
    if (selectedLineId && !anyAnnotationInteractionActive) return 'move'; // For the whole line move via hitbox
    return 'default';
  }, [selectedLineId, draggingPoint, movingLineId, isDraggingToolbar, activeTool, anyAnnotationInteractionActive]);

  const isMainToolbarButtonDisabled = useMemo(() => anyAnnotationInteractionActive || isDrawingToolActive, [anyAnnotationInteractionActive, isDrawingToolActive]);
  const isContextualToolbarButtonDisabled = useMemo(() => anyAnnotationInteractionActive || isDrawingToolActive, [anyAnnotationInteractionActive, isDrawingToolActive]);


  // 6. useCallback
  const updateStepStatus = useCallback((stepId: string, status: 'success' | 'error' | 'pending' | 'warning', message?: string) => {
    setValidationSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status, message: message || (status === 'error' ? 'Failed' : 'Completed') } : step
      )
    );
  }, []); // setValidationSteps is stable

  const parseAndValidateCsv = useCallback((csvText: string, fileName: string): { data: DataPoint[], seriesNames: string[], timeHeader: string, success: boolean } | { success: false } => {
    const newValidationSteps = initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }));
    setValidationSteps(newValidationSteps);

    const localLines = csvText.trim().split(/\r\n|\n/);
    if (localLines.length < 2) {
      updateStepStatus('headerParse', 'error', `CSV error: Must have a header row and at least one data row in file '${fileName}'.`);
      initialValidationSteps.slice(initialValidationSteps.findIndex(s => s.id === 'headerParse') + 1).forEach(s => updateStepStatus(s.id, 'error', 'Prerequisite step failed.'));
      return { success: false };
    }
    updateStepStatus('headerParse', 'success', "Header row found.");

    const delimiterRegex = /\s*[,;\t]\s*/;
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
    let recColumnExcluded = false;

    if (potentialVariableHeaders.length > 0 && potentialVariableHeaders[potentialVariableHeaders.length - 1].trim().toLowerCase() === 'rec') {
      actualVariableHeadersToProcess = potentialVariableHeaders.slice(0, -1);
      recColumnExcluded = true;
      updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s). Last column "Rec" excluded.`);
    } else if (potentialVariableHeaders.length === 0 && originalHeaders.length > 1) {
       updateStepStatus('variableColumnCheck', 'error', `No data variable columns found after the first (time) column in file '${fileName}'. Delimiters: comma, semicolon, or tab.`);
       updateStepStatus('yAxisFirstVarIdentified', 'error', `No variable columns for Y-axis. CSV must have at least two columns (time + one variable).`);
       return { success: false };
    } else if (originalHeaders.length <= 1) {
        updateStepStatus('variableColumnCheck', 'error', `Expected at least two columns (time + one variable) in file '${fileName}'. Found ${originalHeaders.length}. Delimiters: comma, semicolon, or tab.`);
        updateStepStatus('yAxisFirstVarIdentified', 'error', `No variable columns for Y-axis.`);
        return { success: false };
    } else {
      actualVariableHeadersToProcess = [...potentialVariableHeaders];
      updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s).`);
    }

    if (actualVariableHeadersToProcess.length === 0) {
        const yAxisErrorMsg = recColumnExcluded ?
            `Only a time column and a "Rec" column found. No other variables to plot.` :
            `No plottable variable columns found after processing headers. Check CSV structure and delimiters (comma, semicolon, or tab).`;
        updateStepStatus('yAxisFirstVarIdentified', 'error', yAxisErrorMsg);
        return { success: false };
    }

    const uniqueSeriesNamesForDropdown: string[] = [];
    const usedKeyNamesForDataPoint = new Set<string>();
    usedKeyNamesForDataPoint.add('time');

    actualVariableHeadersToProcess.forEach(originalVarHeader => {
        let processedHeader = (originalVarHeader || "Unnamed_Variable").trim();
        if (!processedHeader) processedHeader = "Unnamed_Variable";

        let uniqueKey = processedHeader;
        let suffix = 1;
        while (uniqueKey.toLowerCase() === 'time' || usedKeyNamesForDataPoint.has(uniqueKey)) {
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
      updateStepStatus('dataRowFormat', 'error', `No processable data rows found in '${fileName}'. Ensure variable columns contain numeric data. Delimiters: comma, semicolon, or tab.`);
      return { success: false };
    }

    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows fully numeric.`;
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric/empty values found; treated as missing (NaN).";
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    } else {
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    }

    updateStepStatus('dataReady', 'success', "Import complete");
    return { data, seriesNames: uniqueSeriesNamesForDropdown, timeHeader, success: true };
  }, [updateStepStatus]); // setValidationSteps removed as it's managed by updateStepStatus

  const processCsvFileContent = useCallback((fileContent: string, fileName: string): { success: boolean; seriesNames?: string[] } => {
    const parsedResult = parseAndValidateCsv(fileContent, fileName);
    if (parsedResult.success) {
      setRawCsvText(fileContent);
      setParsedData(parsedResult.data);
      setCurrentFileName(fileName);
      setPlotTitle(fileName);
      setDataSeries(parsedResult.seriesNames);
      setTimeAxisLabel(parsedResult.timeHeader);

      const newVisibleSeries: Record<string, boolean> = {};
      parsedResult.seriesNames.forEach((name, index) => { newVisibleSeries[name] = index < 4; });
      setVisibleSeries(newVisibleSeries);
      setBrushStartIndex(0);
      setBrushEndIndex(parsedResult.data.length > 0 ? Math.min(Math.max(0, parsedResult.data.length - 1), 23) : undefined);
      setLines([]); setSelectedLineId(null); setContextualToolbarPosition(null); setIsOverlayActive(false);

      const successToast = toast({ title: "File Processed Successfully", description: `${fileName} has been processed.` });
      setTimeout(() => { if(successToast && successToast.id) dismiss(successToast.id); }, 2000);
      return { success: true, seriesNames: parsedResult.seriesNames };
    }
    return { success: false };
  }, [parseAndValidateCsv, toast, dismiss]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true); setCurrentFileForValidation(null);
    const file = event.target.files?.[0];
    const freshValidationSteps = initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }));
    setValidationSteps(freshValidationSteps); setAccordionValue("");

    if (!file) {
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }
    setCurrentFileForValidation(file.name);

    const updateAndReturnError = (stepId: string, errorMsg: string, title?: string) => {
      updateStepStatus(stepId, 'error', errorMsg);
      setValidationSteps(prevSteps =>
        prevSteps.map(step => {
          const stepIndex = initialValidationSteps.findIndex(s => s.id === step.id);
          const errorStepIndex = initialValidationSteps.findIndex(s => s.id === stepId);
          if (stepIndex > errorStepIndex && step.status === 'pending') {
            return { ...step, status: 'error', message: 'Prerequisite step failed.' };
          }
          return step;
        })
      );
      toast({ variant: "destructive", title: title || "File Validation Error", description: `${file.name}: ${errorMsg}` });
      setAccordionValue("validation-details-" + instanceId);
      return null;
    };

    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      updateAndReturnError('fileType', `File name does not end with .csv. Please select a .csv file and try again.`, "Unsupported File Type");
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateAndReturnError('fileType', `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Max size is ${MAX_FILE_SIZE_MB}MB. Please select a smaller .csv file and try again.`, "File Too Large");
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }
    updateStepStatus('fileType', 'success', 'File is .csv and within size limits.');

    let fileContent;
    try {
      fileContent = await file.text();
      if (!fileContent.trim()) {
        updateAndReturnError('fileRead', `File '${file.name}' is empty or contains only whitespace. Please select a file with content.`, "Empty File");
        setIsProcessing(false); if (event.target) event.target.value = ""; return;
      }
      updateStepStatus('fileRead', 'success', 'File content read successfully.');
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      updateAndReturnError('fileRead', `Could not read content from '${file.name}': ${errorMsg}. It may be corrupted or not a plain text file.`, "File Read Error");
      setIsProcessing(false); if (event.target) event.target.value = ""; return;
    }

    processCsvFileContent(fileContent, file.name);
    setIsProcessing(false); 
    if (csvFileInputRef.current) csvFileInputRef.current.value = ""; // Clear file input

  }, [instanceId, processCsvFileContent, toast, updateStepStatus]);


  const handleLoadSavedPlotFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true); const file = event.target.files?.[0];
    if (!file) { setIsProcessing(false); return; }
    try {
      const jsonText = await file.text();
      const savedState = JSON.parse(jsonText) as SavedPlotState;
      if (!savedState.rawCsvText || !savedState.currentFileName || !savedState.plotTitle || !savedState.dataSeries || savedState.visibleSeries === undefined) {
        throw new Error("Invalid save file structure. Missing essential fields.");
      }
      const { success: successfullyProcessed, seriesNames: actualSeriesInLoadedCsv } = processCsvFileContent(savedState.rawCsvText, savedState.currentFileName);
      if (successfullyProcessed && actualSeriesInLoadedCsv) {
        setPlotTitle(savedState.plotTitle);
        const restoredVisibleSeries: Record<string, boolean> = {};
        actualSeriesInLoadedCsv.forEach(name => { restoredVisibleSeries[name] = savedState.visibleSeries[name] === true; });
        setVisibleSeries(restoredVisibleSeries);
        setIsPlotExpanded(savedState.isPlotExpanded === true); setIsMinimalistView(savedState.isMinimalistView === true);
        setBrushStartIndex(savedState.brushStartIndex); setBrushEndIndex(savedState.brushEndIndex); 
        setLines(savedState.lines || []); 
        setIsOverlayActive(savedState.isOverlayActive === true);
        if (savedState.timeAxisLabel !== undefined) setTimeAxisLabel(savedState.timeAxisLabel);
        toast({ title: "Plot State Loaded", description: `Successfully loaded state from ${file.name}.` });
      } else {
         toast({ variant: "destructive", title: "Load Error", description: `Could not process CSV data from loaded file ${file.name}. Check validation details.` });
      }
    } catch (error: any) {
      console.error("Error loading plot state:", error);
      toast({ variant: "destructive", title: "Load Failed", description: error.message || `Could not load plot state from ${file.name}. Invalid file.` });
      const freshValidationSteps = initialValidationSteps.map(s => s.id === 'fileSelection' ? {...s, status: 'error', message: `Failed to load plot state: ${error.message || 'Invalid file'}`} : {...s, status: 'error', message: 'Prerequisite step failed.'} );
      setValidationSteps(freshValidationSteps); setAccordionValue("validation-details-" + instanceId);
    }
    setIsProcessing(false); 
    if (jsonLoadInputRef.current) jsonLoadInputRef.current.value = "";
  }, [instanceId, processCsvFileContent, toast]);

  const handleSavePlot = useCallback(() => {
    if (!rawCsvText || !currentFileName) {
      toast({ variant: "destructive", title: "Cannot Save Plot", description: "No data loaded to save." }); return;
    }
    const stateToSave: SavedPlotState = {
      rawCsvText, currentFileName, plotTitle, timeAxisLabel, dataSeries, visibleSeries,
      isPlotExpanded, isMinimalistView, brushStartIndex, brushEndIndex, lines, isOverlayActive
    };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${plotTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'plot_save'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Plot State Saved", description: `Configuration saved as ${a.download}.` });
  }, [rawCsvText, currentFileName, plotTitle, timeAxisLabel, dataSeries, visibleSeries, isPlotExpanded, isMinimalistView, brushStartIndex, brushEndIndex, lines, isOverlayActive, toast]);

  const handleBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex); setBrushEndIndex(newIndex.endIndex);
  }, []);

  const handleClearDataInstance = useCallback(() => {
    setRawCsvText(null); setParsedData([]); setCurrentFileName(undefined);
    setPlotTitle(initialPlotTitle); setDataSeries([]); setVisibleSeries({}); setTimeAxisLabel(undefined);
    setValidationSteps(initialValidationSteps.map(s => ({...s}))); setCurrentFileForValidation(null); setAccordionValue("");
    setIsPlotExpanded(false); setIsMinimalistView(false);
    setBrushStartIndex(undefined); setBrushEndIndex(undefined);
    setLines([]); setSelectedLineId(null); setContextualToolbarPosition(null); setIsOverlayActive(false); setActiveTool(null);
    if (csvFileInputRef.current) csvFileInputRef.current.value = "";
    if (jsonLoadInputRef.current) jsonLoadInputRef.current.value = "";
    toast({ title: "Data Cleared", description: "Plot data and annotations have been cleared." });
  }, [initialPlotTitle, toast]);

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

  // --- Annotation Event Handlers ---
  const getNormalizedCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent<Element> | MouseEvent | TouchEvent) => {
    let clientX = 0, clientY = 0;
    if ('touches' in event && event.touches.length > 0) { clientX = event.touches[0].clientX; clientY = event.touches[0].clientY;
    } else if ('clientX' in event) { clientX = event.clientX; clientY = event.clientY; }
    return { clientX, clientY };
  }, []);

  const updateContextualToolbarPos = useCallback((line: LineAnnotation | null) => {
    if (!line || !svgOverlayRef.current) { setContextualToolbarPosition(null); return; }
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const midX = (line.x1 + line.x2) / 2; const midY = (line.y1 + line.y2) / 2;
    let toolbarX = midX; let toolbarY = midY - TOOLBAR_OFFSET_FROM_LINE_Y - TOOLBAR_APPROX_HEIGHT / 2;
    if (toolbarY - (TOOLBAR_APPROX_HEIGHT / 2) < VERTICAL_GAP_TOOLBAR) {
        toolbarY = midY + TOOLBAR_APPROX_HEIGHT / 2 + TOOLBAR_OFFSET_FROM_LINE_Y;
    }
    toolbarY = Math.max(TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR, Math.min(toolbarY, svgRect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR));
    toolbarX = Math.max(TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR, Math.min(toolbarX, svgRect.width - TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 - HORIZONTAL_EDGE_BUFFER_TOOLBAR));
    setContextualToolbarPosition({ x: toolbarX, y: toolbarY });
  }, []);

  const handleAddLine = useCallback(() => {
    if (!svgOverlayRef.current || anyAnnotationInteractionActive) return;
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const centerX = svgRect.width / 2; const centerY = svgRect.height / 2;
    const defaultLineLength = Math.min(svgRect.width, svgRect.height) * 0.2;
    const newLine: LineAnnotation = {
      id: `${Date.now()}-${instanceId}`, x1: centerX - defaultLineLength / 2, y1: centerY,
      x2: centerX + defaultLineLength / 2, y2: centerY, arrowStyle: 'none', lineStyle: 'solid',
      strokeWidth: DEFAULT_STROKE_WIDTH, color: DEFAULT_LINE_COLOR,
    };
    setLines(prevLines => [...prevLines, newLine]);
    setSelectedLineId(newLine.id);
    updateContextualToolbarPos(newLine);
    setActiveTool(null); // Exit any active tool
  }, [instanceId, anyAnnotationInteractionActive, updateContextualToolbarPos]);

  const handleInteractionMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!svgOverlayRef.current) return;
    const isTouchEvent = event.type.startsWith('touch');
    if (isTouchEvent && (draggingPoint || movingLineId || isDraggingToolbar)) { if ('preventDefault' in event) event.preventDefault(); }

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    let svgX = clientX - rect.left;
    let svgY = clientY - rect.top;

    // Clamp coordinates to SVG boundaries
    svgX = Math.max(0, Math.min(svgX, rect.width));
    svgY = Math.max(0, Math.min(svgY, rect.height));

    let lineToUpdateToolbarFor: LineAnnotation | null = null;

    if (draggingPoint) {
      setLines(prevLines => prevLines.map(line => {
        if (line.id === draggingPoint.lineId) {
          const updatedLine = draggingPoint.pointType === 'start' ? { ...line, x1: svgX, y1: svgY } : { ...line, x2: svgX, y2: svgY };
          lineToUpdateToolbarFor = updatedLine; return updatedLine;
        } return line;
      }));
    } else if (movingLineId && dragStartCoords && lineBeingMovedOriginalState) {
      const dx = svgX - dragStartCoords.x;
      const dy = svgY - dragStartCoords.y;
      setLines(prevLines => prevLines.map(line => {
        if (line.id === movingLineId) {
          const updatedLine = {
            ...line,
            x1: Math.max(0, Math.min(lineBeingMovedOriginalState.x1 + dx, rect.width)),
            y1: Math.max(0, Math.min(lineBeingMovedOriginalState.y1 + dy, rect.height)),
            x2: Math.max(0, Math.min(lineBeingMovedOriginalState.x2 + dx, rect.width)),
            y2: Math.max(0, Math.min(lineBeingMovedOriginalState.y2 + dy, rect.height)),
          };
          lineToUpdateToolbarFor = updatedLine; return updatedLine;
        } return line;
      }));
    } else if (isDraggingToolbar && toolbarDragStart && toolbarInitialPosition) {
      const dxGlobal = clientX - toolbarDragStart.x;
      const dyGlobal = clientY - toolbarDragStart.y;
      let newToolbarX = toolbarInitialPosition.x + dxGlobal;
      let newToolbarY = toolbarInitialPosition.y + dyGlobal;
      newToolbarY = Math.max(TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR, Math.min(newToolbarY, rect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR));
      newToolbarX = Math.max(TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR, Math.min(newToolbarX, rect.width - TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 - HORIZONTAL_EDGE_BUFFER_TOOLBAR));
      setContextualToolbarPosition({ x: newToolbarX, y: newToolbarY });
    }
    if(lineToUpdateToolbarFor) updateContextualToolbarPos(lineToUpdateToolbarFor);
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
    }
    if(lineForToolbarUpdate) updateContextualToolbarPos(lineForToolbarUpdate);
  }, [lines, draggingPoint, movingLineId, isDraggingToolbar, updateContextualToolbarPos]);


  const handleDraggablePointInteractionStart = useCallback((lineId: string, pointType: 'start' | 'end', event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    if (activeTool) return; // Don't allow point drag if another tool is active
    setSelectedLineId(lineId);
    setDraggingPoint({ lineId, pointType });
    setContextualToolbarPosition(null); // Hide toolbar during point drag
  }, [activeTool]);

  const handleLineHitboxInteractionStart = useCallback((line: LineAnnotation, event: React.MouseEvent | React.TouchEvent<Element>) => {
    event.stopPropagation();
    if (anyAnnotationInteractionActive && !movingLineId && selectedLineId !== line.id) return; // Prevent starting new interactions if one is ongoing for another line
    if (activeTool) return; // Don't allow selection/move if a tool is active

    if (selectedLineId === line.id && !draggingPoint) { // If line already selected, and not dragging an endpoint, initiate move
        if (!svgOverlayRef.current) return;
        const { clientX, clientY } = getNormalizedCoordinates(event);
        const rect = svgOverlayRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        setMovingLineId(line.id);
        setDragStartCoords({ x, y });
        setLineBeingMovedOriginalState({ ...line });
        setContextualToolbarPosition(null); // Hide toolbar during move
    } else if (selectedLineId !== line.id) { // If different line clicked, just select it
        setSelectedLineId(line.id);
        updateContextualToolbarPos(line);
    } else { // If selected line clicked, but some other interaction (like endpoint drag) is happening, do nothing here
      // This case might be redundant if draggingPoint check is robust
    }
  }, [selectedLineId, anyAnnotationInteractionActive, activeTool, getNormalizedCoordinates, updateContextualToolbarPos, draggingPoint]);


  const handleSvgBackgroundClick = useCallback((event: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const targetIsSvg = event.target === svgOverlayRef.current;
    if (targetIsSvg && !anyAnnotationInteractionActive && !activeTool) {
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
    }
  }, [anyAnnotationInteractionActive, activeTool]);

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

  const handleDeleteSelectedLine = useCallback(() => {
    if (selectedLineId && !anyAnnotationInteractionActive) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
    }
  }, [selectedLineId, anyAnnotationInteractionActive]);

  const handleCopySelectedLine = useCallback(() => {
    if (selectedLineId && !anyAnnotationInteractionActive) {
      const lineToCopy = lines.find(l => l.id === selectedLineId);
      if (lineToCopy && svgOverlayRef.current) {
        const svgRect = svgOverlayRef.current.getBoundingClientRect();
        let offsetX = Math.min(10, svgRect.width * 0.02);
        let offsetY = Math.min(10, svgRect.height * 0.02);

        const attemptPosition = (lx1: number, ly1: number, lx2: number, ly2: number) =>
          lx1 >= 0 && ly1 >= 0 && lx2 >= 0 && ly2 >= 0 &&
          lx1 <= svgRect.width && ly1 <= svgRect.height &&
          lx2 <= svgRect.width && ly2 <= svgRect.height;

        let newX1 = lineToCopy.x1 + offsetX; let newY1 = lineToCopy.y1 + offsetY;
        let newX2 = lineToCopy.x2 + offsetX; let newY2 = lineToCopy.y2 + offsetY;

        if (!attemptPosition(newX1, newY1, newX2, newY2)) {
          offsetX = -offsetX;
          offsetY = -offsetY;
          newX1 = lineToCopy.x1 + offsetX; newY1 = lineToCopy.y1 + offsetY;
          newX2 = lineToCopy.x2 + offsetX; newY2 = lineToCopy.y2 + offsetY;
        }

        const newLine: LineAnnotation = {
          ...lineToCopy, id: `${Date.now()}-${instanceId}`,
          x1: Math.max(0, Math.min(newX1, svgRect.width)),
          y1: Math.max(0, Math.min(newY1, svgRect.height)),
          x2: Math.max(0, Math.min(newX2, svgRect.width)),
          y2: Math.max(0, Math.min(newY2, svgRect.height)),
        };
        setLines(prevLines => [...prevLines, newLine]);
        setSelectedLineId(newLine.id);
        updateContextualToolbarPos(newLine);
      }
    }
  }, [selectedLineId, anyAnnotationInteractionActive, lines, instanceId, updateContextualToolbarPos]);

  const handleToolbarDragStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if (!contextualToolbarPosition) return;
    setIsDraggingToolbar(true);
    const { clientX, clientY } = getNormalizedCoordinates(event);
    setToolbarDragStart({ x: clientX, y: clientY });
    setToolbarInitialPosition({ ...contextualToolbarPosition });
  }, [contextualToolbarPosition, getNormalizedCoordinates]);

  const getStrokeDasharray = useCallback((style?: 'solid' | 'dashed' | 'dotted') => {
    switch (style) {
      case 'dashed': return "5,5";
      case 'dotted': return "1,4";
      case 'solid': default: return undefined;
    }
  }, []);

  // --- Effect Hooks ---
  useEffect(() => {
    if (!isProcessing && validationSteps.length > 0) {
      const hasError = validationSteps.some(step => step.status === 'error');
      if (hasError) {
        setAccordionValue("validation-details-" + instanceId);
      }
    }
  }, [isProcessing, validationSteps, instanceId]); // accordionValue removed

  useEffect(() => {
    const isAnyInteraction = !!(draggingPoint || movingLineId || isDraggingToolbar);
    if (isAnyInteraction) {
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

  // --- JSX ---
  const summaryStep = getSummaryStep();
  const csvFileInputId = `${uniqueComponentId}-csv-upload-${instanceId}`;
  const jsonLoadInputId = `${uniqueComponentId}-json-load-${instanceId}`;

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <CardTitle className="flex items-center gap-2 text-sm text-primary">
          <Settings2 className="h-4 w-4"/>
          {plotTitle}
        </CardTitle>
        <div className="flex items-center gap-0.5">
           {parsedData.length > 0 && (
            <>
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch
                      id={`annotation-overlay-switch-${instanceId}`}
                      checked={isOverlayActive}
                      onCheckedChange={(checked) => {
                        setIsOverlayActive(checked);
                        if (!checked) {
                          setSelectedLineId(null); setDraggingPoint(null); setMovingLineId(null);
                          setContextualToolbarPosition(null); setIsDraggingToolbar(false); setActiveTool(null);
                        }
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p>Annotation Tools</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Label htmlFor={`annotation-overlay-switch-${instanceId}`} className="text-xs mr-1">Annotate</Label>
              <Separator orientation="vertical" className="h-5 mx-1" />
            </>
          )}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSavePlot} aria-label="Save plot state" className="h-7 w-7" disabled={!rawCsvText}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Save Plot</p></TooltipContent>
            </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsPlotExpanded(!isPlotExpanded)} disabled={parsedData.length === 0} aria-label={isPlotExpanded ? "Collapse plot area" : "Expand plot area"}>
                   {isPlotExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                 </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{isPlotExpanded ? "Collapse Plot Height" : "Expand Plot Height"}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsMinimized(!isMinimized)} aria-label={isMinimized ? "Expand plot" : "Minimize plot"} className="h-7 w-7">
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{isMinimized ? "Expand Plot" : "Minimize Plot"}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => onRemovePlot(instanceId)} aria-label="Remove plot" className="h-7 w-7">
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Remove Plot</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className={cn("p-2 pt-1", isMinimalistView ? "block" : "md:grid md:grid-cols-12 gap-2")}>
          {!isMinimalistView && (
            <>
              {/* Left Column: Import & Validate */}
              <div className="md:col-span-3 space-y-1.5 flex flex-col">
                <div className="space-y-1 p-1.5 border rounded-md flex flex-col flex-1 min-h-0">
                  <div className="flex items-center gap-1">
                     <Settings2 className="h-3 w-3 text-[#2B7A78]" />
                     <h3 className="text-xs font-semibold text-[#2B7A78]">Import & Validate</h3>
                  </div>
                  <div className="px-1 py-1.5">
                    <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                      <Label htmlFor={csvFileInputId} className="cursor-pointer flex items-center justify-center">
                        Choose file
                      </Label>
                    </Button>
                    <Input
                      id={csvFileInputId}
                      ref={csvFileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={isProcessing}
                      className="sr-only"
                    />
                  </div>
                  <div className="px-1 pb-1">
                    <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                      <Label htmlFor={jsonLoadInputId} className="cursor-pointer flex items-center justify-center">
                        <Upload className="mr-1.5 h-3 w-3" /> Load Plot
                      </Label>
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
                       <p className="text-[0.6rem] text-primary animate-pulse px-1">Preparing to process: <span className="font-semibold">{currentFileForValidation}</span>...</p>
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
                            "[&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3 py-1" // Smaller chevron and padding
                        )}>
                          <div className="flex items-center gap-1 min-w-0">
                            {isProcessing || summaryStep.status === 'pending' ? <Hourglass className="h-2.5 w-2.5 animate-spin flex-shrink-0" /> :
                             summaryStep.status === 'success' ? <CheckCircle2 className="h-2.5 w-2.5 text-green-600 flex-shrink-0" /> :
                             <XCircle className="h-2.5 w-2.5 text-destructive flex-shrink-0" />}
                             <span className="font-medium text-[0.55rem] whitespace-normal leading-tight">
                               {summaryStep.label}
                             </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-0.5 pb-0">
                          <div className="text-[0.55rem] text-muted-foreground px-1 pb-0.5">
                              File: {currentFileForValidation || currentFileName || "N/A"}
                          </div>
                          <ScrollArea className="w-full rounded-md border p-1 bg-muted/20 max-h-28"> {/* Adjusted max-height */}
                            {validationSteps.map(step => (
                              <li key={step.id} className="flex items-start list-none py-0.5">
                                <div className="flex-shrink-0 w-2.5 h-2.5 mr-1 mt-0.5">
                                  {step.status === 'pending' && <Hourglass className="h-full w-full text-muted-foreground animate-spin" />}
                                  {step.status === 'success' && <CheckCircle2 className="h-full w-full text-green-500" />}
                                  {step.status === 'error' && <XCircle className="h-full w-full text-red-500" />}
                                  {step.status === 'warning' && <XCircle className="h-full w-full text-yellow-500" />}
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
                 <div className="space-y-1 p-1.5 border rounded-md flex flex-col flex-1 min-h-0"> {/* Allow this box to grow */}
                  <div className="flex items-center gap-1">
                    <ListFilter className="h-3 w-3 text-[#2B7A78]" />
                    <h3 className="text-xs font-semibold text-[#2B7A78]">Select Variables</h3>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Checkbox id={`select-all-rhs-${instanceId}-${uniqueComponentId}`} checked={allSeriesSelected} onCheckedChange={() => handleSelectAllToggle(!allSeriesSelected)} disabled={dataSeries.length === 0} aria-label={allSeriesSelected ? "Deselect all series" : "Select all series"} className="h-3.5 w-3.5" />
                    <Label htmlFor={`select-all-rhs-${instanceId}-${uniqueComponentId}`} className="text-xs font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {allSeriesSelected ? "Deselect All" : "Select All"} ({plottableSeries.length}/{dataSeries.length})
                    </Label>
                  </div>
                   <ScrollArea className="w-full rounded-md border p-1 flex-1"> {/* ScrollArea takes available space */}
                    {dataSeries.length > 0 ? (
                      dataSeries.map((seriesName) => (
                        <div key={seriesName} className="flex items-center space-x-1.5 py-0.5">
                          <Checkbox id={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`} checked={!!visibleSeries[seriesName]} onCheckedChange={(checked) => handleSeriesVisibilityChange(seriesName, !!checked)} className="h-3.5 w-3.5" />
                          <Label htmlFor={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`} className="text-xs leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate" title={seriesName}>
                            {seriesName}
                          </Label>
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
          <div className={cn(!isMinimalistView ? "md:col-span-7" : "col-span-full", "flex flex-col min-h-0")}>
            {isOverlayActive && parsedData.length > 0 && (
                <TooltipProvider delayDuration={100}>
                    <div className="bg-card border shadow-lg rounded-md p-1 flex items-center space-x-0.5 mb-1 self-start flex-wrap">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={activeTool === 'line' ? "secondary" : "outline"}
                                    className="h-8 px-2"
                                    onClick={handleAddLine}
                                    disabled={anyAnnotationInteractionActive && activeTool !== 'line'}
                                    aria-label={activeTool === 'line' ? "Cancel Line Drawing" : "Add Line"}
                                >
                                    {activeTool === 'line' ? <Ban className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                                    <span className="text-xs">Line</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>{activeTool === 'line' ? "Cancel Line Drawing" : "Add Line"}</p></TooltipContent>
                        </Tooltip>

                        <Separator orientation="vertical" className="h-5 mx-1" />

                        <DropdownMenu>
                             <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Style & Thickness Options">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path d="M2 3h12v1H2zM2 7.5h12v1H2zM2 12h12v1H2z"/></svg>
                             </Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Line Style & Thickness</p></TooltipContent></Tooltip>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>Line Style</DropdownMenuLabel>
                                <DropdownMenuSeparatorShadcn />
                                <DropdownMenuRadioGroup value={selectedLineForToolbar?.lineStyle || 'solid'} onValueChange={(value) => handleLineStyleChange(value as 'solid' | 'dashed' | 'dotted')}>
                                    {['solid', 'dashed', 'dotted'].map(s => <DropdownMenuRadioItem key={s} value={s} className="text-xs"><LineStyleIcon style={s as 'solid' | 'dashed' | 'dotted'} /></DropdownMenuRadioItem>)}
                                </DropdownMenuRadioGroup>
                                <DropdownMenuSeparatorShadcn />
                                <DropdownMenuLabel>Stroke Weight</DropdownMenuLabel>
                                <div className="px-2 py-1.5 flex items-center space-x-2">
                                    <Slider defaultValue={[DEFAULT_STROKE_WIDTH]} value={[selectedLineForToolbar?.strokeWidth || DEFAULT_STROKE_WIDTH]} onValueChange={handleStrokeWeightChange} min={1} max={10} step={0.5} disabled={!selectedLineId} className="flex-grow" />
                                    <span className="text-xs w-12 text-right">{(selectedLineForToolbar?.strokeWidth || DEFAULT_STROKE_WIDTH).toFixed(1)}px</span>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Arrow Style Options"><MoveRight className="h-4 w-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Arrow Style</p></TooltipContent></Tooltip>
                            <DropdownMenuContent className="w-60">
                                <DropdownMenuLabel>Arrow Style</DropdownMenuLabel><DropdownMenuSeparatorShadcn />
                                <DropdownMenuRadioGroup value={selectedLineForToolbar?.arrowStyle || 'none'} onValueChange={(value) => handleArrowStyleChange(value as 'none' | 'end' | 'both')}>
                                    {[
                                        { value: 'none', label: "No Arrowhead" },
                                        { value: 'end', label: "Arrowhead on one side" },
                                        { value: 'both', label: "Arrowhead on both sides" }
                                    ].map((opt) => <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs"><ArrowStyleIcon style={opt.value as 'none' | 'end' | 'both'} uniqueId={`${instanceId}-${opt.value}`} /></DropdownMenuRadioItem>)}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                            <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Color Options"><Palette className="h-4 w-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Line Color</p></TooltipContent></Tooltip>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>Line Color</DropdownMenuLabel><DropdownMenuSeparatorShadcn />
                                <DropdownMenuRadioGroup value={selectedLineForToolbar?.color || DEFAULT_LINE_COLOR} onValueChange={handleLineColorChange}>
                                {[
                                    { value: 'hsl(var(--primary))', label: "Primary" }, { value: 'hsl(var(--accent))', label: "Accent" },
                                    { value: 'hsl(var(--foreground))', label: "Foreground" }, { value: 'hsl(var(--destructive))', label: "Destructive" },
                                    { value: 'hsl(var(--chart-2))', label: "Chart Color 2" }, { value: 'hsl(var(--chart-3))', label: "Chart Color 3" },
                                ].map(colorOpt => ( <DropdownMenuRadioItem key={colorOpt.value} value={colorOpt.value} className="text-xs"><ColorSwatch color={colorOpt.value} />{colorOpt.label}</DropdownMenuRadioItem> ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </TooltipProvider>
            )}
            <div ref={chartAreaRef} className={cn("relative flex-1 min-h-0", (isOverlayActive && (anyAnnotationInteractionActive || isDrawingToolActive)) && "opacity-70")} style={{ height: `${CHART_RENDERING_BASE_HEIGHT * 0.85}px` }}>
                <ChartDisplay
                    data={parsedData}
                    plottableSeries={plottableSeries}
                    yAxisConfigs={yAxisConfigs}
                    timeAxisLabel={timeAxisLabel || "Time"}
                    chartRenderHeight={currentChartHeight}
                    brushStartIndex={brushStartIndex}
                    brushEndIndex={brushEndIndex}
                    onBrushChange={handleBrushChange}
                    activeHighlightRange={null} // Highlighting tool not re-added to CSV explorer yet
                />
                 {isOverlayActive && (
                    <svg
                        ref={svgOverlayRef}
                        className="absolute top-0 left-0 w-full h-full z-10"
                        onMouseDown={handleSvgBackgroundClick}
                        onTouchStart={handleSvgBackgroundClick}
                        style={{ cursor: svgCursor, pointerEvents: (isOverlayActive && (anyAnnotationInteractionActive || isDrawingToolActive)) ? 'auto' : 'none' }}
                    >
                        <defs>
                            <marker id={`arrowheadEnd-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                            <marker id={`arrowheadStart-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto-start-reverse" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                        </defs>
                        {lines.map((line) => (
                        <g key={line.id}>
                            <line // Hitbox
                            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                            stroke="transparent" strokeWidth="20"
                            className={cn("cursor-pointer", selectedLineId === line.id && !anyAnnotationInteractionActive && !activeTool && "cursor-move")}
                            onMouseDown={(e) => handleLineHitboxInteractionStart(line, e)}
                            onTouchStart={(e) => handleLineHitboxInteractionStart(line, e as unknown as React.TouchEvent<SVGLineElement>)}
                            style={{ pointerEvents: (draggingPoint || (movingLineId === line.id && anyAnnotationInteractionActive) || (movingLineId && movingLineId !== line.id) || isDraggingToolbar || activeTool) ? 'none' : 'auto' }}
                            />
                            <line // Visible line
                            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                            stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : (line.color || DEFAULT_LINE_COLOR)}
                            strokeWidth={selectedLineId === line.id ? (line.strokeWidth || DEFAULT_STROKE_WIDTH) + SELECTED_STROKE_WIDTH_OFFSET : (line.strokeWidth || DEFAULT_STROKE_WIDTH)}
                            markerStart={(line.arrowStyle === 'both') ? `url(#arrowheadStart-${instanceId})` : undefined}
                            markerEnd={(line.arrowStyle === 'end' || line.arrowStyle === 'both') ? `url(#arrowheadEnd-${instanceId})` : undefined}
                            strokeDasharray={getStrokeDasharray(line.lineStyle)}
                            style={{ pointerEvents: 'none' }}
                            />
                            {selectedLineId === line.id && !movingLineId && !isDraggingToolbar && !activeTool && (
                            <>
                                <circle cx={line.x1} cy={line.y1} r="8" fill="hsl(var(--destructive))" opacity="0.3" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} style={{ pointerEvents: 'auto' }}/>
                                <circle cx={line.x1} cy={line.y1} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }}/>
                                <circle cx={line.x2} cy={line.y2} r="8" fill="hsl(var(--destructive))" opacity="0.3" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} style={{ pointerEvents: 'auto' }}/>
                                <circle cx={line.x2} cy={line.y2} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }}/>
                            </>
                            )}
                        </g>
                        ))}
                    </svg>
                )}
               {selectedLineId && contextualToolbarPosition && isOverlayActive && (
                  <div
                      className="absolute bg-card border shadow-lg rounded-md p-0.5 flex items-center space-x-0.5 z-30"
                      style={{
                          left: `${contextualToolbarPosition.x}px`,
                          top: `${contextualToolbarPosition.y}px`,
                          transform: `translateX(-50%) translateY(-${TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR}px)`,
                          cursor: isDraggingToolbar ? 'grabbing' : 'default',
                      }}
                      onMouseDown={handleToolbarDragStart}
                      onTouchStart={handleToolbarDragStart}
                  >
                      <TooltipProvider delayDuration={100}>
                          <div className="p-0.5 cursor-grab active:cursor-grabbing"><GripVertical className="h-3.5 w-3.5 text-muted-foreground" /></div>
                           <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopySelectedLine} disabled={isContextualToolbarButtonDisabled} aria-label="Copy Selected Line"><Copy className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Copy Line</p></TooltipContent></Tooltip>
                           <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDeleteSelectedLine} disabled={isContextualToolbarButtonDisabled} aria-label="Delete Selected Line"><Trash2 className="h-3 w-3" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Delete Line</p></TooltipContent></Tooltip>
                      </TooltipProvider>
                  </div>
              )}
            </div>
            {!isMinimalistView && !isMinimized && parsedData.length > 0 && (
                <div className="flex justify-center pt-1 pb-1 border-t">
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setIsPlotExpanded(!isPlotExpanded)}
                                    aria-label={isPlotExpanded ? "Collapse Plot Area" : "Expand Plot Area"}
                                >
                                    {isPlotExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{isPlotExpanded ? "Collapse Plot Area" : "Expand Plot Area"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// --- Saved Plot State Interface ---
interface SavedPlotState {
  rawCsvText: string;
  currentFileName: string;
  plotTitle: string;
  timeAxisLabel?: string;
  dataSeries: string[];
  visibleSeries: Record<string, boolean>;
  isPlotExpanded: boolean;
  isMinimalistView: boolean;
  brushStartIndex?: number;
  brushEndIndex?: number;
  lines?: LineAnnotation[];
  isOverlayActive?: boolean;
}
