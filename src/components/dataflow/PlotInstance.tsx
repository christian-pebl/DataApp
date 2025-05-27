
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
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay"; // Added YAxisConfig
import {
  Hourglass, CheckCircle2, XCircle, ListFilter, X, Maximize2, Minimize2, Settings2, ChevronsDown, ChevronsUp,
  ChevronsLeft, ChevronsRight, UploadCloud, Save, Upload, Scissors, TrendingDown,
  Plus, Ban, PenLine, MoveRight, Spline, Palette, Copy, GripVertical, Trash2, Move as MoveIcon, Highlighter, CornerUpRight, Minus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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


interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined;
}

interface ValidationStep {
  id: string;
  label: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

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

const DEFAULT_PLOT_HEIGHT = 272;
const EXPANDED_PLOT_HEIGHT = 544;
const CHART_HEIGHT_STEP = 50;
const MIN_CHART_HEIGHT = 150;
const MAX_CHART_HEIGHT = 800;

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
  lines?: LineAnnotation[]; // Save annotations
}

interface PlotInstanceProps {
  instanceId: string;
  onRemovePlot: (id: string) => void;
  initialPlotTitle?: string;
}

// Annotation related types and constants
interface LineAnnotation {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  arrowStyle?: 'none' | 'end' | 'both';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  strokeWidth?: number;
  color?: string;
}

const DEFAULT_STROKE_WIDTH = 1.5;
const SELECTED_STROKE_WIDTH_OFFSET = 1;
const DEFAULT_LINE_COLOR = 'hsl(var(--primary))';
const TOOLBAR_APPROX_HEIGHT = 36;
const TOOLBAR_APPROX_WIDTH_THREE_BUTTONS = 100; // For Copy, Delete
const VERTICAL_GAP_TOOLBAR = 8;
const HORIZONTAL_EDGE_BUFFER_TOOLBAR = 8;
const TOOLBAR_OFFSET_FROM_LINE_Y = 15;


// Helper components for dropdowns (can be moved to a utility file if used elsewhere)
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

const ArrowStyleIcon = ({ style }: { style: 'none' | 'end' | 'both' }) => {
  const markerWidth = 3;
  const padding = 2;
  let x1 = padding;
  let x2 = 24 - padding;

  if (style === 'end') {
    x2 -= markerWidth;
  } else if (style === 'both') {
    x1 += markerWidth;
    x2 -= markerWidth;
  }

  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="mr-2">
      <defs>
        <marker id={`dropdown-arrow-end-preview-${useId()}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto" fill="currentColor">
          <polygon points="0 0, 3 1.75, 0 3.5" />
        </marker>
        <marker id={`dropdown-arrow-start-preview-${useId()}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto-start-reverse" fill="currentColor">
          <polygon points="0 0, 3 1.75, 0 3.5" />
        </marker>
      </defs>
      <line
        x1={x1}
        y1="8"
        x2={x2}
        y2="8"
        stroke="currentColor"
        strokeWidth="2"
        markerStart={(style === 'both') ? `url(#dropdown-arrow-start-preview-${useId()})` : undefined}
        markerEnd={(style === 'end' || style === 'both') ? `url(#dropdown-arrow-end-preview-${useId()})` : undefined}
      />
    </svg>
  );
};

const ColorSwatch = ({ color }: { color: string }) => (
  <div className="w-4 h-4 rounded-sm border border-border mr-2" style={{ backgroundColor: color }} />
);


export function PlotInstance({ instanceId, onRemovePlot, initialPlotTitle = "New Plot" }: PlotInstanceProps) {
  const [rawCsvText, setRawCsvText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [dataSeries, setDataSeries] = useState<string[]>([]);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({});
  const [timeAxisLabel, setTimeAxisLabel] = useState<string | undefined>(undefined);
  const [plotTitle, setPlotTitle] = useState<string>(initialPlotTitle);

  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);
  const [currentFileForValidation, setCurrentFileForValidation] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const { toast, dismiss } = useToast();
  const uniqueComponentId = useId(); // For unique IDs for file inputs

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMinimalistView, setIsMinimalistView] = useState(false);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false);
  
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  
  const currentChartHeight = isPlotExpanded ? EXPANDED_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT;

  // Annotation State
  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [lines, setLines] = useState<LineAnnotation[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const [draggingPoint, setDraggingPoint] = useState<{ lineId: string; pointType: 'start' | 'end' } | null>(null);
  const [movingLineId, setMovingLineId] = useState<string | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [lineBeingMovedOriginalState, setLineBeingMovedOriginalState] = useState<LineAnnotation | null>(null);
  const [contextualToolbarPosition, setContextualToolbarPosition] = useState<{x: number, y: number} | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [toolbarDragStart, setToolbarDragStart] = useState<{ x: number; y: number } | null>(null);
  const [toolbarInitialPosition, setToolbarInitialPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!isProcessing && validationSteps.length > 0) {
      const hasError = validationSteps.some(step => step.status === 'error');
      if (hasError) {
        setAccordionValue("validation-details-" + instanceId);
      }
    }
  }, [isProcessing, validationSteps, instanceId]);

  const updateStepStatus = (stepId: string, status: 'success' | 'error', message?: string) => {
    setValidationSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status, message: message || (status === 'error' ? 'Failed' : 'Completed') } : step
      )
    );
  };

  const parseAndValidateCsv = (csvText: string, fileName: string): { data: DataPoint[], seriesNames: string[], timeHeader: string } | null => {
    const newValidationSteps = initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }));
    setValidationSteps(newValidationSteps); 

    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
      updateStepStatus('headerParse', 'error', `File "${fileName}": CSV content error. Must have a header row and at least one data row.`);
      updateStepStatus('xAxisIdentified', 'error', 'Cannot identify X-axis: Header row missing.');
      updateStepStatus('variableColumnCheck', 'error', 'Cannot identify variable columns: Header row missing.');
      updateStepStatus('yAxisFirstVarIdentified', 'error', 'Cannot identify first Y-axis variable: Header row missing.');
      updateStepStatus('dataRowFormat', 'error', 'Cannot check data rows: Header row missing.');
      return null;
    }
    updateStepStatus('headerParse', 'success', "Header row found.");

    const delimiterRegex = /\s*[,;\t]\s*/; // Comma, semicolon, or tab, with optional surrounding whitespace
    const originalHeaders = lines[0].trim().split(delimiterRegex).map(h => h.trim());

    const timeHeader = originalHeaders[0]?.trim() || "X-Axis Time (Default)";
    updateStepStatus('xAxisIdentified', 'success', `Using CSV Column 1 header: '${timeHeader}' for X-axis data.`);
    
    let potentialVariableHeaders = originalHeaders.slice(1);
    let actualVariableHeadersToProcess: string[];

    if (potentialVariableHeaders.length > 0 && potentialVariableHeaders[potentialVariableHeaders.length - 1].trim().toLowerCase() === 'rec') {
      actualVariableHeadersToProcess = potentialVariableHeaders.slice(0, -1);
      updateStepStatus('variableColumnCheck', 'success', `Identified variable columns. Last column "Rec" (header: "${potentialVariableHeaders[potentialVariableHeaders.length - 1]}") was found and excluded from plotting.`);
    } else if (potentialVariableHeaders.length === 0 && originalHeaders.length > 1) {
       updateStepStatus('variableColumnCheck', 'error', `File "${fileName}": CSV structure error. No data variable columns found after the first (time) column (and after potentially excluding a final "Rec" column). Ensure your CSV uses comma, semicolon, or tab delimiters.`);
       updateStepStatus('yAxisFirstVarIdentified', 'error', `File "${fileName}": No variable columns for Y-axis. CSV must have at least two columns (time + one variable), excluding a final "Rec" column if it was present.`);
       return null;
    } else if (originalHeaders.length <= 1) {
        updateStepStatus('variableColumnCheck', 'error', `File "${fileName}": CSV structure error. Expected at least two columns (time + one variable). Found ${originalHeaders.length} column(s). Ensure your CSV uses comma, semicolon, or tab delimiters.`);
        updateStepStatus('yAxisFirstVarIdentified', 'error', `File "${fileName}": No variable columns for Y-axis. Ensure your CSV uses comma, semicolon, or tab delimiters and has at least two columns.`);
        return null;
    }
     else {
      actualVariableHeadersToProcess = [...potentialVariableHeaders];
      updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s): ${actualVariableHeadersToProcess.map(h => `"${h}"`).join(', ')}. No "Rec" column found at the end, or it was not the last column to be excluded.`);
    }

    if (actualVariableHeadersToProcess.length === 0) {
        const yAxisErrorMsg = (originalHeaders.length === 2 && originalHeaders[1].trim().toLowerCase() === 'rec') ?
            `File "${fileName}": Only a time column and a "Rec" column found. No other variables to plot.` :
            `File "${fileName}": No plottable variable columns found after processing headers (e.g., after excluding "Rec" column if it was the only other variable). Ensure your CSV has at least one variable column after the time column. Delimiters: comma, semicolon, or tab.`;
        updateStepStatus('yAxisFirstVarIdentified', 'error', yAxisErrorMsg);
        return null;
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

    if (uniqueSeriesNamesForDropdown.length > 0) {
       const firstVarOriginalHeader = actualVariableHeadersToProcess[0]?.trim() || "Unnamed";
       const firstVarPlotKey = uniqueSeriesNamesForDropdown[0]; 
       updateStepStatus('yAxisFirstVarIdentified', 'success', `CSV Column 2 (original header: "${firstVarOriginalHeader}") provides data for the first variable. It will be plotted using data key: "${firstVarPlotKey}". Total plottable variables: ${uniqueSeriesNamesForDropdown.length}.`);
    } else {
      updateStepStatus('yAxisFirstVarIdentified', 'error', `File "${fileName}": No plottable variable columns were ultimately identified. Check CSV structure and delimiters (comma, semicolon, or tab).`);
      return null;
    }

    const data: DataPoint[] = [];
    let someRowsHadNonNumericData = false;
    let validDataRowsCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
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
      updateStepStatus('dataRowFormat', 'error', `File "${fileName}": CSV data error. No processable data rows found. Ensure variable columns contain numeric data and time values are present. Also check for correct delimiter (comma, semicolon, or tab).`);
      return null;
    }

    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows appear fully numeric for at least one variable.`;
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric or empty values in variable columns were encountered; these will be treated as missing (NaN) by the chart.";
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    } else {
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    }

    updateStepStatus('dataReady', 'success', "Import complete");
    return { data, seriesNames: uniqueSeriesNamesForDropdown, timeHeader };
  };

  const processCsvFileContent = (fileContent: string, fileName: string): { success: boolean; seriesNames?: string[] } => {
    const parsedResult = parseAndValidateCsv(fileContent, fileName);
    if (parsedResult) {
      setRawCsvText(fileContent);
      setParsedData(parsedResult.data);
      setCurrentFileName(fileName);
      setPlotTitle(fileName); 
      setDataSeries(parsedResult.seriesNames);
      setTimeAxisLabel(parsedResult.timeHeader);
      
      const newVisibleSeries: Record<string, boolean> = {};
      parsedResult.seriesNames.forEach((name, index) => {
        newVisibleSeries[name] = index < 4;
      });
      setVisibleSeries(newVisibleSeries); 

      setBrushStartIndex(0); // Reset brush to start
      setBrushEndIndex(parsedResult.data.length > 0 ? Math.min(Math.max(0, parsedResult.data.length - 1), 23) : undefined); // Show first 24 points or less

      setLines([]); // Clear previous annotations on new data
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
      setIsOverlayActive(false); // Deactivate annotation overlay on new data

      const successToast = toast({
        title: "File Processed Successfully",
        description: `${fileName} has been processed.`,
      });
      setTimeout(() => {
        if(successToast && successToast.id) dismiss(successToast.id);
      }, 2000);
      return { success: true, seriesNames: parsedResult.seriesNames };
    }
    return { success: false };
  };


  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    setCurrentFileForValidation(null);
    const file = event.target.files?.[0];
    
    const freshValidationSteps = initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }));
    setValidationSteps(freshValidationSteps);
    setAccordionValue("");

    if (!file) {
      setIsProcessing(false);
      if (event.target) event.target.value = ""; 
      return;
    }

    setCurrentFileForValidation(file.name);

    const updateAndReturnError = (stepId: string, errorMsg: string, title?: string) => {
      setValidationSteps(prevSteps =>
        prevSteps.map(step => {
          if (step.id === stepId) return { ...step, status: 'error', message: errorMsg };
          const stepIndex = initialValidationSteps.findIndex(s => s.id === step.id);
          const errorStepIndex = initialValidationSteps.findIndex(s => s.id === stepId);
          if (stepIndex > errorStepIndex && step.status === 'pending') {
            return { ...step, status: 'error', message: 'Prerequisite step failed.' };
          }
          return step;
        })
      );
      toast({ variant: "destructive", title: title || "File Validation Error", description: errorMsg });
      setAccordionValue("validation-details-" + instanceId); 
      return null;
    };

    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      updateAndReturnError('fileType', `File name "${file.name}" does not end with .csv. Please select a valid CSV file and try again.`, "Unsupported File Type");
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateAndReturnError('fileType', `File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please upload a smaller file and try again.`, "File Too Large");
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }
    updateStepStatus('fileType', 'success', 'File is a .csv and within size limits.');

    let fileContent;
    try {
      fileContent = await file.text();
      if (!fileContent.trim()) {
        updateAndReturnError('fileRead', `File "${file.name}" is empty or contains only whitespace. Please upload a file with content and try again.`, "Empty File");
        setIsProcessing(false);
        if (event.target) event.target.value = "";
        return;
      }
      updateStepStatus('fileRead', 'success', 'File content read successfully.');
    } catch (e: any) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      updateAndReturnError('fileRead', `Could not read content from file "${file.name}": ${errorMsg}. It may be corrupted or not a plain text file. Please check the file and try again.`, "File Read Error");
      setIsProcessing(false);
      if (event.target) event.target.value = "";
      return;
    }
    
    processCsvFileContent(fileContent, file.name);
    
    setIsProcessing(false);
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleLoadSavedPlotFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      return;
    }

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
        actualSeriesInLoadedCsv.forEach(name => {
          restoredVisibleSeries[name] = savedState.visibleSeries[name] === true;
        });
        setVisibleSeries(restoredVisibleSeries);

        setIsPlotExpanded(savedState.isPlotExpanded === true); // Ensure boolean
        setIsMinimalistView(savedState.isMinimalistView === true); // Ensure boolean
        setBrushStartIndex(savedState.brushStartIndex);
        setBrushEndIndex(savedState.brushEndIndex);
        setLines(savedState.lines || []); // Restore annotations
        
        if (savedState.timeAxisLabel !== undefined) {
            setTimeAxisLabel(savedState.timeAxisLabel);
        }
        
        toast({
          title: "Plot State Loaded",
          description: `Successfully loaded state from ${file.name}.`,
        });
      } else {
         toast({
          variant: "destructive",
          title: "Load Error",
          description: `Could not process CSV data from loaded file ${file.name}. Check validation details.`,
        });
      }
    } catch (error: any) {
      console.error("Error loading plot state:", error);
      toast({
        variant: "destructive",
        title: "Load Failed",
        description: error.message || `Could not load plot state from ${file.name}. Invalid file.`,
      });
      const freshValidationSteps = initialValidationSteps.map(s => s.id === 'fileSelection' ? {...s, status: 'error', message: `Failed to load plot state from ${file.name}: ${error.message || 'Invalid file'}`} : {...s, status: 'error', message: 'Prerequisite step failed.'} );
      setValidationSteps(freshValidationSteps);
      setAccordionValue("validation-details-" + instanceId);
    }

    setIsProcessing(false);
    if (event.target) {
      event.target.value = ""; 
    }
  };

  const handleSavePlot = () => {
    if (!rawCsvText || !currentFileName) {
      toast({
        variant: "destructive",
        title: "Cannot Save Plot",
        description: "No data loaded to save.",
      });
      return;
    }

    const stateToSave: SavedPlotState = {
      rawCsvText,
      currentFileName,
      plotTitle,
      timeAxisLabel,
      dataSeries, 
      visibleSeries,
      isPlotExpanded,
      isMinimalistView,
      brushStartIndex,
      brushEndIndex,
      lines, // Save annotations
    };

    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plotTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'plot_save'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Plot State Saved",
      description: `Configuration saved as ${a.download}.`,
    });
  };

  const handleBrushChange = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };


  const handleClearDataInstance = () => {
    setRawCsvText(null);
    setParsedData([]);
    setCurrentFileName(undefined);
    setPlotTitle(initialPlotTitle); 
    setDataSeries([]);
    setVisibleSeries({});
    setTimeAxisLabel(undefined);
    setValidationSteps([]);
    setCurrentFileForValidation(null);
    setAccordionValue("");
    setIsPlotExpanded(false); 
    setIsMinimalistView(false);
    setBrushStartIndex(undefined);
    setBrushEndIndex(undefined);
    setLines([]); // Clear annotations
    setSelectedLineId(null);
    setContextualToolbarPosition(null);
    setIsOverlayActive(false);
    toast({
      title: "Data Cleared",
      description: "Plot data and annotations have been cleared for this instance.",
    });
  };

  const handleSeriesVisibilityChange = (seriesName: string, isVisible: boolean) => {
    setVisibleSeries(prev => ({ ...prev, [seriesName]: isVisible }));
  };

  const handleSelectAllToggle = (selectAll: boolean) => {
    const newVisibleSeries: Record<string, boolean> = {};
    dataSeries.forEach(name => {
      newVisibleSeries[name] = selectAll;
    });
    setVisibleSeries(newVisibleSeries);
  };

  const getSummaryStep = (): ValidationStep | null => {
    if (!validationSteps.length && !isProcessing && !currentFileForValidation) return null;
    if (isProcessing && validationSteps.every(s => s.status === 'pending')) {
        return {id: 'processing', label: `Preparing to process ${currentFileForValidation || 'file'}...`, status: 'pending'};
    }
    if (validationSteps.length === 0 && currentFileForValidation) {
        return {id: 'fileSelectedSummary', label: `Processing: ${currentFileForValidation}`, status: 'pending' };
    }
    if (validationSteps.length === 0) return null;

    const currentProcessingStep = validationSteps.find(step => step.status === 'pending');
    if (isProcessing && currentProcessingStep) {
      return { ...currentProcessingStep, label: `Processing: ${currentProcessingStep.label}` };
    }

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
  };

  const summaryStep = getSummaryStep();
  const allSeriesSelected = dataSeries.length > 0 && dataSeries.every(series => visibleSeries[series]);
  
  // YAxis configuration for ChartDisplay
  const yAxisConfigs: YAxisConfig[] = useMemo(() => {
    if (dataSeries.length > 0) {
      // For CSV explorer, create a single Y-axis config based on the first *visible* series,
      // or the first series if none are visible yet.
      const firstVisibleSeriesKey = dataSeries.find(key => visibleSeries[key]) || dataSeries[0];
      if (firstVisibleSeriesKey) {
        return [{
          id: 'y-axis-csv',
          orientation: 'left',
          label: firstVisibleSeriesKey, // Use the series name as label
          color: '--chart-1', // Use the first chart color
          dataKey: firstVisibleSeriesKey,
          unit: '', // CSV data has no predefined units in this context
        }];
      }
    }
    return []; // Default to no Y-axes if no data or series
  }, [dataSeries, visibleSeries]);

  // Filter plottable series based on visibility
  const plottableSeries = useMemo(() => dataSeries.filter(seriesName => visibleSeries[seriesName]), [dataSeries, visibleSeries]);


  // Annotation Handlers and Logic
  const getNormalizedCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent<Element> | MouseEvent | TouchEvent) => {
    if ('touches' in event && event.touches.length > 0) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    if ('clientX' in event) {
      return { clientX: event.clientX, clientY: event.clientY };
    }
    return { clientX: 0, clientY: 0 };
  }, []);

  const updateContextualToolbarPos = useCallback((line: LineAnnotation | null) => {
    if (!line || !svgOverlayRef.current) {
      setContextualToolbarPosition(null);
      return;
    }
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const midX = (line.x1 + line.x2) / 2;
    const midY = (line.y1 + line.y2) / 2;

    let toolbarX = midX;
    let toolbarY = midY - TOOLBAR_OFFSET_FROM_LINE_Y - TOOLBAR_APPROX_HEIGHT / 2;

    if (toolbarY - (TOOLBAR_APPROX_HEIGHT / 2) < VERTICAL_GAP_TOOLBAR) {
      toolbarY = midY + TOOLBAR_APPROX_HEIGHT / 2 + TOOLBAR_OFFSET_FROM_LINE_Y;
    }
    
    toolbarY = Math.max(
      TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR,
      Math.min(toolbarY, svgRect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR)
    );
    toolbarX = Math.max(
      TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR,
      Math.min(toolbarX, svgRect.width - TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR)
    );
    
    setContextualToolbarPosition({ x: toolbarX, y: toolbarY });
  }, []);

  const handleAddLine = () => {
    if (!svgOverlayRef.current || draggingPoint || movingLineId || isDraggingToolbar) return;
    
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const centerX = svgRect.width / 2;
    const centerY = svgRect.height / 2;
    const defaultLineLength = Math.min(svgRect.width, svgRect.height) * 0.2;

    const newLine: LineAnnotation = {
      id: Date.now().toString() + instanceId, // Ensure unique ID across instances
      x1: centerX - defaultLineLength / 2,
      y1: centerY,
      x2: centerX + defaultLineLength / 2,
      y2: centerY,
      arrowStyle: 'none',
      lineStyle: 'solid',
      strokeWidth: DEFAULT_STROKE_WIDTH,
      color: DEFAULT_LINE_COLOR,
    };

    setLines(prevLines => [...prevLines, newLine]);
    setSelectedLineId(newLine.id);
    updateContextualToolbarPos(newLine);
  };
  
  const handleDraggablePointInteractionStart = (lineId: string, pointType: 'start' | 'end', event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if ('preventDefault' in event) event.preventDefault(); 
    setSelectedLineId(lineId); 
    setDraggingPoint({ lineId, pointType });
  };

  const handleLineHitboxInteractionStart = (lineId: string, event: React.MouseEvent | React.TouchEvent<Element>) => {
    event.stopPropagation();
    if (draggingPoint || isDraggingToolbar) return;

    const lineToInteract = lines.find(l => l.id === lineId);
    if (!lineToInteract) return;
    
    setSelectedLineId(lineId);
    updateContextualToolbarPos(lineToInteract);
    
    if (!svgOverlayRef.current) return;
    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setMovingLineId(lineId);
    setDragStartCoords({ x, y });
    setLineBeingMovedOriginalState({ ...lineToInteract });
  };

  const handleToolbarDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation(); 
    if (!contextualToolbarPosition) return; 
    setIsDraggingToolbar(true);
    const { clientX, clientY } = getNormalizedCoordinates(event);
    setToolbarDragStart({ x: clientX, y: clientY }); 
    setToolbarInitialPosition({ ...contextualToolbarPosition }); 
  };

  const handleInteractionMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!svgOverlayRef.current) return;
    
    const isTouchEvent = event.type.startsWith('touch');
    if (isTouchEvent && (draggingPoint || movingLineId || isDraggingToolbar)) {
      if ('preventDefault' in event) event.preventDefault();
    }

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    if (draggingPoint) {
      x = Math.max(0, Math.min(x, rect.width));
      y = Math.max(0, Math.min(y, rect.height));
      let movedLine: LineAnnotation | null = null;
      setLines(prevLines =>
        prevLines.map(line => {
          if (line.id === draggingPoint.lineId) {
            movedLine = draggingPoint.pointType === 'start' ? { ...line, x1: x, y1: y } : { ...line, x2: x, y2: y };
            return movedLine;
          }
          return line;
        })
      );
      if (movedLine) updateContextualToolbarPos(movedLine);
    } else if (movingLineId && dragStartCoords && lineBeingMovedOriginalState) {
      const dx = x - dragStartCoords.x;
      const dy = y - dragStartCoords.y;
      let movedLine: LineAnnotation | null = null;
      setLines(prevLines =>
        prevLines.map(line => {
          if (line.id === movingLineId) {
             movedLine = {
              ...line,
              x1: Math.max(0, Math.min(lineBeingMovedOriginalState.x1 + dx, rect.width)),
              y1: Math.max(0, Math.min(lineBeingMovedOriginalState.y1 + dy, rect.height)),
              x2: Math.max(0, Math.min(lineBeingMovedOriginalState.x2 + dx, rect.width)),
              y2: Math.max(0, Math.min(lineBeingMovedOriginalState.y2 + dy, rect.height)),
            };
            return movedLine;
          }
          return line;
        })
      );
      if (movedLine) updateContextualToolbarPos(movedLine);
    } else if (isDraggingToolbar && toolbarDragStart && toolbarInitialPosition) {
        const dxGlobal = clientX - toolbarDragStart.x;
        const dyGlobal = clientY - toolbarDragStart.y;
        let newToolbarX = toolbarInitialPosition.x + dxGlobal;
        let newToolbarY = toolbarInitialPosition.y + dyGlobal;

        newToolbarY = Math.max(
            TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR,
            Math.min(newToolbarY, rect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR)
        );
        newToolbarX = Math.max(
            TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR,
            Math.min(newToolbarX, rect.width - TOOLBAR_APPROX_WIDTH_THREE_BUTTONS / 2 - HORIZONTAL_EDGE_BUFFER_TOOLBAR)
        );
        setContextualToolbarPosition({ x: newToolbarX, y: newToolbarY });
    }
  }, [draggingPoint, movingLineId, dragStartCoords, lineBeingMovedOriginalState, getNormalizedCoordinates, updateContextualToolbarPos, isDraggingToolbar, toolbarDragStart, toolbarInitialPosition]);

  const handleInteractionEnd = useCallback(() => {
    let finalLine: LineAnnotation | null = null;
    if (draggingPoint) {
      finalLine = lines.find(l => l.id === draggingPoint.lineId) || null;
      setDraggingPoint(null);
    }
    if (movingLineId) {
      finalLine = lines.find(l => l.id === movingLineId) || null;
      setMovingLineId(null);
      setDragStartCoords(null);
      setLineBeingMovedOriginalState(null);
    }
    if (isDraggingToolbar) {
        setIsDraggingToolbar(false);
        setToolbarDragStart(null);
        setToolbarInitialPosition(null);
    }
    if (finalLine) updateContextualToolbarPos(finalLine); 
  }, [draggingPoint, movingLineId, lines, updateContextualToolbarPos, isDraggingToolbar]);

  useEffect(() => {
    const isAnyDragActive = !!(draggingPoint || movingLineId || isDraggingToolbar);
    if (isAnyDragActive) {
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
  
  const handleArrowStyleChange = (style: 'none' | 'end' | 'both') => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, arrowStyle: style } : line
        )
      );
    }
  };

  const handleLineStyleChange = (style: 'solid' | 'dashed' | 'dotted') => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, lineStyle: style } : line
        )
      );
    }
  };

  const handleStrokeWeightChange = (newWeightArray: number[]) => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      const newWeight = newWeightArray[0];
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, strokeWidth: newWeight } : line
        )
      );
    }
  };

  const handleLineColorChange = (color: string) => {
     if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, color: color } : line
        )
      );
    }
  };

  const handleDeleteSelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
    }
  };

  const handleCopySelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      const lineToCopy = lines.find(l => l.id === selectedLineId);
      if (lineToCopy && svgOverlayRef.current) {
        const svgRect = svgOverlayRef.current.getBoundingClientRect();
        const offsetX = Math.min(20, svgRect.width * 0.05); 
        const offsetY = Math.min(20, svgRect.height * 0.05);

        let newX1 = lineToCopy.x1 + offsetX;
        let newY1 = lineToCopy.y1 + offsetY;
        let newX2 = lineToCopy.x2 + offsetX;
        let newY2 = lineToCopy.y2 + offsetY;
        
        if (newX1 > svgRect.width || newY1 > svgRect.height || newX2 > svgRect.width || newY2 > svgRect.height ||
            newX1 < 0 || newY1 < 0 || newX2 < 0 || newY2 < 0) {
          newX1 = lineToCopy.x1 - offsetX;
          newY1 = lineToCopy.y1 - offsetY;
          newX2 = lineToCopy.x2 - offsetX;
          newY2 = lineToCopy.y2 - offsetY;
        }
        
        const newLine: LineAnnotation = {
          ...lineToCopy,
          id: Date.now().toString() + instanceId, // Ensure unique ID
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
  };

  const selectedLineForToolbar = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);
  
  const isMainToolbarButtonDisabled = (buttonType?: 'style' | 'color' | 'action') => {
    if (draggingPoint || movingLineId || isDraggingToolbar) return true;
    if (buttonType === 'style' || buttonType === 'color' || buttonType === 'action') return !selectedLineId;
    return false; 
  };
  
  const getStrokeDasharray = (style?: 'solid' | 'dashed' | 'dotted') => {
    switch (style) {
      case 'dashed': return "5,5";
      case 'dotted': return "1,4";
      case 'solid': default: return undefined;
    }
  };

  const handleSvgBackgroundClick = (event: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (event.target === svgOverlayRef.current && !draggingPoint && !movingLineId && !isDraggingToolbar) {
        setSelectedLineId(null);
        setContextualToolbarPosition(null);
    }
  };

  const anyAnnotationInteractionActive = !!(draggingPoint || movingLineId || isDraggingToolbar);

  const svgCursor = useMemo(() => {
    if (isDraggingToolbar) return 'grabbing';
    if (movingLineId) return 'grabbing';
    if (draggingPoint) return 'grabbing'; 
    if (selectedLineId && !anyAnnotationInteractionActive) return 'move'; 
    return 'default'; 
  }, [selectedLineId, draggingPoint, movingLineId, isDraggingToolbar, anyAnnotationInteractionActive]);

  const isContextualToolbarDisabled = isDraggingToolbar || draggingPoint || movingLineId;


  const csvFileInputId = `${uniqueComponentId}-csv-upload-${instanceId}`;
  const jsonLoadInputId = `${uniqueComponentId}-json-load-${instanceId}`;


  return (
    <Card className="shadow-lg"> {/* Removed mb-6, parent `space-y-3` will handle it */}
      <CardHeader className="flex flex-row items-center justify-between p-3"> {/* Reduced padding */}
        <CardTitle className="flex items-center gap-2 text-sm"> {/* Reduced text size */}
          <Settings2 className="h-4 w-4"/> {/* Reduced icon size */}
          {plotTitle || "Data Plot"}
        </CardTitle>
        <div className="flex items-center gap-0.5"> {/* Reduced gap */}
           {/* Annotation Tools Switch - Moved to header */}
           {parsedData.length > 0 && (
            <>
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch
                      id={`annotation-overlay-switch-${instanceId}`}
                      checked={isOverlayActive}
                      onCheckedChange={(checked) => {
                        setIsOverlayActive(checked);
                        if (!checked) {
                          setSelectedLineId(null); setDraggingPoint(null); setMovingLineId(null);
                          setContextualToolbarPosition(null); setIsDraggingToolbar(null);
                        }
                      }}
                      className="mr-1 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span[data-state=checked]]:translate-x-4 [&>span[data-state=unchecked]]:translate-x-0"
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
                  <Save className="h-3.5 w-3.5" /> {/* Reduced icon size */}
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
        <CardContent className={cn("p-2 pt-0 md:grid", isMinimalistView ? "block" : "md:grid-cols-12 gap-2")}>
          {/* ==== Import & Validate Section (LEFT) ==== */}
          {!isMinimalistView && (
            <div className="md:col-span-2 space-y-1.5 flex flex-col">
              <div className="space-y-1 border p-1.5 rounded-md flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-1">
                   <Settings2 className="h-3 w-3 text-[#2B7A78]" />
                   <h3 className="text-xs font-semibold text-[#2B7A78]">Import & Validate</h3>
                </div>
                <div className="px-1 py-1.5">
                   <Button asChild variant="outline" size="sm" className="w-full h-7 text-[0.7rem]">
                     <Label htmlFor={csvFileInputId} className="cursor-pointer flex items-center justify-center">
                       Choose file
                     </Label>
                   </Button>
                   <Input
                     id={csvFileInputId}
                     type="file"
                     accept=".csv"
                     onChange={handleFileChange}
                     disabled={isProcessing}
                     className="sr-only"
                   />
                 </div>
                 <div className="px-1 pb-1">
                   <Button asChild variant="outline" size="sm" className="w-full h-7 text-[0.7rem]">
                     <Label htmlFor={jsonLoadInputId} className="cursor-pointer flex items-center justify-center">
                       <Upload className="mr-1.5 h-3 w-3" /> Load Plot
                     </Label>
                   </Button>
                   <Input
                     id={jsonLoadInputId}
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
                          (isProcessing || summaryStep.status === 'pending') && 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20'
                      )}>
                        <div className="flex items-center gap-1 min-w-0"> 
                          {isProcessing || summaryStep.status === 'pending' ? <Hourglass className="h-3 w-3 animate-spin flex-shrink-0" /> :
                           summaryStep.status === 'success' ? <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" /> :
                           <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                           <span className="font-medium text-[0.55rem] break-words whitespace-normal"> {/* Reduced font, allow wrap */}
                             {summaryStep.label}
                           </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0.5 pb-0 max-h-28 overflow-y-auto"> 
                        <div className="text-[0.55rem] text-muted-foreground px-1 pb-0.5">
                            File: {currentFileForValidation || currentFileName || "N/A"}
                        </div>
                        <ScrollArea className="w-full rounded-md border p-1 bg-muted/20 max-h-24"> {/* Reduced max-h */}
                          {validationSteps.map(step => (
                            <li key={step.id} className="flex items-start list-none">
                              <div className="flex-shrink-0 w-2.5 h-2.5 mr-1 mt-0.5"> 
                                {step.status === 'pending' && <Hourglass className="h-full w-full text-muted-foreground animate-spin" />}
                                {step.status === 'success' && <CheckCircle2 className="h-full w-full text-green-500" />}
                                {step.status === 'error' && <XCircle className="h-full w-full text-red-500" />}
                              </div>
                              <div className="flex-grow min-w-0"> 
                                <span className={cn('block text-[0.55rem]', step.status === 'error' && 'text-destructive font-semibold', step.status === 'success' && 'text-green-600')}>
                                  {step.label}
                                </span>
                                {step.message && step.status !== 'pending' && (
                                    <span className={cn("text-[0.45rem] block whitespace-pre-wrap", step.status === 'error' ? 'text-red-700' : 'text-muted-foreground')} title={step.message}>
                                       &ndash; {step.message}
                                    </span>
                                )}
                                 {step.status === 'pending' && <span className="text-[0.45rem] text-muted-foreground block">&ndash; Pending...</span>}
                              </div>
                            </li>
                          ))}
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                  </div>
                )}
                {!summaryStep && !isProcessing && currentFileForValidation && (
                    <p className="text-[0.6rem] text-muted-foreground px-1">Awaiting processing for <span className="font-semibold">{currentFileForValidation}</span>.</p>
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
          )}
          
          {/* ==== Select Variables Section (MIDDLE) ==== */}
          {!isMinimalistView && (
            <div className="md:col-span-2 space-y-1.5 flex flex-col">
               <div className="space-y-1 p-1.5 border rounded-md flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-1">
                  <ListFilter className="h-3 w-3 text-[#2B7A78]" />
                  <h3 className="text-xs font-semibold text-[#2B7A78]">Select Variables</h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Checkbox id={`select-all-rhs-${instanceId}-${uniqueComponentId}`} checked={allSeriesSelected} onCheckedChange={() => handleSelectAllToggle(!allSeriesSelected)} disabled={dataSeries.length === 0} aria-label={allSeriesSelected ? "Deselect all series" : "Select all series"} className="h-3.5 w-3.5" />
                  <Label htmlFor={`select-all-rhs-${instanceId}-${uniqueComponentId}`} className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {allSeriesSelected ? "Deselect All" : "Select All"} ({plottableSeries.length}/{dataSeries.length})
                  </Label>
                </div>
                 <ScrollArea className="w-full rounded-md border p-1 flex-1"> {/* Removed h-32 */}
                  {dataSeries.length > 0 ? (
                    dataSeries.map((seriesName) => (
                      <div key={seriesName} className="flex items-center space-x-1.5 py-0.5"> {/* Reduced py */}
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
          )}
          
          {/* ==== Plot Area (RIGHT) ==== */}
           <div className={cn("flex flex-col min-h-0", isMinimalistView ? "col-span-full" : "md:col-span-8")}> {/* Dynamic col-span */}
            {/* Main Annotation Toolbar */}
            {isOverlayActive && parsedData.length > 0 && (
              <TooltipProvider delayDuration={0}>
                <div className="bg-card border shadow-lg rounded-md p-1 flex items-center space-x-1 mb-1 self-start">
                  <Tooltip><TooltipTrigger asChild><Button variant={"outline"} className="h-8 px-2" onClick={handleAddLine} disabled={isMainToolbarButtonDisabled()}><Plus className="h-4 w-4 mr-1" /> Line</Button></TooltipTrigger><TooltipContent><p>Add Straight Line</p></TooltipContent></Tooltip>
                  <Separator orientation="vertical" className="h-6 mx-1" />
                  <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled('style')} aria-label="Arrow Style Options"><MoveRight className="h-4 w-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Arrow Style</p></TooltipContent></Tooltip>
                    <DropdownMenuContent className="w-56"><DropdownMenuLabel>Arrow Style</DropdownMenuLabel><DropdownMenuSeparatorShadcn /><DropdownMenuRadioGroup value={selectedLineForToolbar?.arrowStyle || 'none'} onValueChange={(value) => handleArrowStyleChange(value as 'none' | 'end' | 'both')}>{['none', 'end', 'both'].map(s => <DropdownMenuRadioItem key={s} value={s}><ArrowStyleIcon style={s as 'none' | 'end' | 'both'} /></DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled('style')} aria-label="Line Style & Thickness Options"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4"><path d="M2 4h12v1H2zM2 7.5h12v2H2zM2 11h12v3H2z"/></svg></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Line Style & Thickness</p></TooltipContent></Tooltip>
                    <DropdownMenuContent className="w-56"><DropdownMenuLabel>Line Style</DropdownMenuLabel><DropdownMenuSeparatorShadcn /><DropdownMenuRadioGroup value={selectedLineForToolbar?.lineStyle || 'solid'} onValueChange={(value) => handleLineStyleChange(value as 'solid' | 'dashed' | 'dotted')}>{['solid', 'dashed', 'dotted'].map(s => <DropdownMenuRadioItem key={s} value={s}><LineStyleIcon style={s as 'solid' | 'dashed' | 'dotted'} /></DropdownMenuRadioItem>)}</DropdownMenuRadioGroup><DropdownMenuSeparatorShadcn /><DropdownMenuLabel>Stroke Weight</DropdownMenuLabel><div className="px-2 py-1.5 flex items-center space-x-2"><Slider defaultValue={[DEFAULT_STROKE_WIDTH]} value={[selectedLineForToolbar?.strokeWidth || DEFAULT_STROKE_WIDTH]} onValueChange={handleStrokeWeightChange} min={1} max={10} step={0.5} disabled={isMainToolbarButtonDisabled('style')} className="flex-grow" /><span className="text-xs w-10 text-right">{(selectedLineForToolbar?.strokeWidth || DEFAULT_STROKE_WIDTH).toFixed(1)}px</span></div></DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu><Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled('color')} aria-label="Line Color Options"><Palette className="h-4 w-4" /></Button></DropdownMenuTrigger></TooltipTrigger><TooltipContent><p>Line Color</p></TooltipContent></Tooltip>
                    <DropdownMenuContent className="w-56"><DropdownMenuLabel>Line Color</DropdownMenuLabel><DropdownMenuSeparatorShadcn /><DropdownMenuRadioGroup value={selectedLineForToolbar?.color || DEFAULT_LINE_COLOR} onValueChange={handleLineColorChange}>
                        <DropdownMenuRadioItem value={'hsl(var(--primary))'}><ColorSwatch color="hsl(var(--primary))" />Primary</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value={'hsl(var(--accent))'}><ColorSwatch color="hsl(var(--accent))" />Accent</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value={'hsl(var(--foreground))'}><ColorSwatch color="hsl(var(--foreground))" />Foreground</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value={'hsl(var(--destructive))'}><ColorSwatch color="hsl(var(--destructive))" />Destructive</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup></DropdownMenuContent>
                  </DropdownMenu>
                  {/* Copy and Delete moved to contextual toolbar */}
                </div>
              </TooltipProvider>
            )}

            <div ref={chartAreaRef} className={cn("relative flex-1 min-h-0", (isOverlayActive && parsedData.length > 0) && "opacity-30 pointer-events-none")}>
                <ChartDisplay
                    data={parsedData}
                    plottableSeries={plottableSeries}
                    yAxisConfigs={yAxisConfigs}
                    timeAxisLabel={timeAxisLabel}
                    plotTitle={""} // No separate title for chart display itself
                    chartRenderHeight={currentChartHeight}
                    brushStartIndex={brushStartIndex}
                    brushEndIndex={brushEndIndex}
                    onBrushChange={handleBrushChange}
                />
            </div>
             {/* SVG Overlay for Line Annotations */}
            {isOverlayActive && parsedData.length > 0 && chartAreaRef.current && (
                 <svg
                    ref={svgOverlayRef}
                    className="absolute top-0 left-0 w-full h-full z-10" 
                    onMouseDown={handleSvgBackgroundClick} // Using onMouseDown for consistency with other interactions
                    onTouchStart={handleSvgBackgroundClick}
                    style={{ cursor: svgCursor, pointerEvents: anyAnnotationInteractionActive || selectedLineId ? 'auto' : 'auto' }}
                  >
                    <defs>
                        <marker id={`arrowheadEnd-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                        <marker id={`arrowheadStart-${instanceId}`} markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto-start-reverse" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                    </defs>
                    {lines.map((line) => (
                      <g key={line.id}>
                        <line
                          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                          stroke="transparent" strokeWidth="20"
                          className={cn("cursor-pointer", selectedLineId === line.id && !anyAnnotationInteractionActive && "cursor-move")}
                          onMouseDown={(e) => handleLineHitboxInteractionStart(line.id, e)}
                          onTouchStart={(e) => handleLineHitboxInteractionStart(line.id, e as unknown as React.TouchEvent<SVGLineElement>)}
                          style={{ pointerEvents: (draggingPoint || (movingLineId && movingLineId !== line.id) || isDraggingToolbar) ? 'none' : 'auto' }}
                        />
                        <line
                          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                          stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : (line.color || DEFAULT_LINE_COLOR)}
                          strokeWidth={selectedLineId === line.id ? (line.strokeWidth || DEFAULT_STROKE_WIDTH) + SELECTED_STROKE_WIDTH_OFFSET : (line.strokeWidth || DEFAULT_STROKE_WIDTH)} 
                          markerStart={(line.arrowStyle === 'both') ? `url(#arrowheadStart-${instanceId})` : undefined}
                          markerEnd={(line.arrowStyle === 'end' || line.arrowStyle === 'both') ? `url(#arrowheadEnd-${instanceId})` : undefined}
                          strokeDasharray={getStrokeDasharray(line.lineStyle)}
                          style={{ pointerEvents: 'none' }} 
                        />
                        {selectedLineId === line.id && !movingLineId && !isDraggingToolbar && (
                          <>
                            <circle cx={line.x1} cy={line.y1} r="8" fill="hsl(var(--destructive))" opacity="0.5" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} style={{ pointerEvents: 'auto' }}/>
                            <circle cx={line.x1} cy={line.y1} r="4" fill="hsl(var(--destructive))" style={{ pointerEvents: 'none' }}/>
                            <circle cx={line.x2} cy={line.y2} r="8" fill="hsl(var(--destructive))" opacity="0.5" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} style={{ pointerEvents: 'auto' }}/>
                            <circle cx={line.x2} cy={line.y2} r="4" fill="hsl(var(--destructive))" style={{ pointerEvents: 'none' }}/>
                          </>
                        )}
                      </g>
                    ))}
                  </svg>
              )}
               {/* Contextual Toolbar */}
              {isOverlayActive && selectedLineId && contextualToolbarPosition && !anyAnnotationInteractionActive && (
                  <div
                      className="absolute bg-card border shadow-lg rounded-md p-1 flex items-center space-x-0.5 z-30" // Reduced space-x
                      style={{
                          left: `${contextualToolbarPosition.x}px`,
                          top: `${contextualToolbarPosition.y}px`,
                          transform: `translateX(-50%) translateY(-${TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR}px)`, 
                          cursor: isDraggingToolbar ? 'grabbing' : 'default',
                      }}
                  >
                      <TooltipProvider delayDuration={100}>
                          <div className="p-0.5 cursor-grab active:cursor-grabbing" onMouseDown={handleToolbarDragStart} onTouchStart={handleToolbarDragStart}><GripVertical className="h-4 w-4 text-muted-foreground" /></div>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopySelectedLine} disabled={isContextualToolbarDisabled} aria-label="Copy Selected Line"><Copy className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Copy Line</p></TooltipContent></Tooltip>
                          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDeleteSelectedLine} disabled={isContextualToolbarDisabled} aria-label="Delete Selected Line"><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Delete Line</p></TooltipContent></Tooltip>
                      </TooltipProvider>
                  </div>
              )}

            {/* Helper text for annotations */}
            {isOverlayActive && parsedData.length > 0 && (
              <div className="text-center text-[0.6rem] text-muted-foreground pt-0.5">
                {selectedLineId && !anyAnnotationInteractionActive && "Line selected. Drag endpoints to move/resize. Use main toolbar to style."}
                {anyAnnotationInteractionActive && (draggingPoint ? 'Dragging endpoint...' : (movingLineId ? 'Moving line...' : (isDraggingToolbar ? 'Dragging toolbar...' : 'Drawing...')))}
                {!selectedLineId && !anyAnnotationInteractionActive && "Click '+ Line' to add. Click line to select/move. Drag endpoints to resize."}
              </div>
            )}
          </div>

          {parsedData.length > 0 && !isMinimalistView && !isMinimized && (
             <div className="flex justify-center pt-1 pb-1 border-t md:col-span-12"> {/* Ensure this takes full width of content grid */}
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="ghost" size="icon" onClick={() => setIsPlotExpanded(!isPlotExpanded)} aria-label={isPlotExpanded ? "Collapse plot height" : "Expand plot height"} className="h-7 w-7">
                        {isPlotExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>{isPlotExpanded ? "Collapse Plot Height" : "Expand Plot Height"}</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
