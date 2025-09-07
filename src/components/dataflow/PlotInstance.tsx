
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
  Settings2, X, Maximize2, Minimize2, Plus, Copy, Trash2, UploadCloud,
  Hourglass, CheckCircle2, XCircle as XCircleIcon, ListFilter, Info,
  ChevronsDown, ChevronsUp,
  Save, ChevronsLeft, ChevronsRight, RotateCcw,
  BarChart, Sun, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parse, isValid, parseISO } from 'date-fns';

interface DataPoint {
  time: string | number;
  [key: string]: string | number | undefined | null;
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
  timeFormat?: 'short' | 'full';
}

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
  const [timeFormat, setTimeFormat] = useState<'short' | 'full'>('short');
  const linePlotVisibleSeriesRef = useRef<Record<string, boolean>>({});

  // Validation and UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>(() => initialValidationSteps.map(s => ({...s})));
  const [currentFileForValidation, setCurrentFileForValidation] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMinimalistView, setIsMinimalistView] = useState(false);

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

  const isFilteredForHeatmap = (name: string): boolean => {
    const keywordsToExclude = ['total', 'cumulative', 'unique', 'recording'];
    const lowerCaseName = name.toLowerCase();
    return !keywordsToExclude.some(keyword => lowerCaseName.includes(keyword));
  };
  
  const handlePlotTypeChange = useCallback((newType: PlotType) => {
    if (newType === plotType) return;
  
    if (newType === 'heatmap') {
      linePlotVisibleSeriesRef.current = { ...visibleSeries };
  
      const newHeatmapVisible: Record<string, boolean> = {};
      dataSeries.forEach(name => {
        newHeatmapVisible[name] = isFilteredForHeatmap(name);
      });
      setVisibleSeries(newHeatmapVisible);
  
    } else if (newType === 'line') {
      if (Object.keys(linePlotVisibleSeriesRef.current).length > 0) {
        setVisibleSeries(linePlotVisibleSeriesRef.current);
      } else {
        const newVisible: Record<string, boolean> = {};
        dataSeries.forEach((name, index) => {
          newVisible[name] = index < 4;
        });
        setVisibleSeries(newVisible);
      }
    }
  
    setPlotType(newType);
  }, [plotType, visibleSeries, dataSeries]);

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

    const dateFormatsToTry = [
      "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'", // ISO formats
      'dd/MM/yyyy HH:mm:ss', 'dd/MM/yyyy HH:mm', 'yyyy/MM/dd HH:mm:ss',
      'MM/dd/yyyy HH:mm:ss', 'MM/dd/yyyy HH:mm',
      'yyyy-MM-dd HH:mm:ss', 'yyyy-MM-dd HH:mm',
      'yyyy/MM/dd HH:mm:ss', 'yyyy/MM/dd HH:mm',
      'dd-MM-yyyy HH:mm:ss', 'dd-MM-yyyy HH:mm',
      'dd/MM/yy HH:mm:ss', 'dd/MM/yy HH:mm',
      'MM/dd/yy HH:mm:ss', 'MM/dd/yy HH:mm',
      'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd',
      'dd-MM-yyyy', 'dd/MM/yy', 'MM/dd/yy',
    ];

    const parseDateString = (dateString: string): Date | null => {
        if (!dateString || !dateString.trim()) return null;
        
        let date = parseISO(dateString);
        if (isValid(date)) return date;

        for (const fmt of dateFormatsToTry) {
            date = parse(dateString, fmt, new Date());
            if (isValid(date)) {
                return date;
            }
        }
        return null;
    };

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
      linePlotVisibleSeriesRef.current = { ...newVisibleSeries };


      setBrushStartIndex(0);
      setBrushEndIndex(parsedResult.data.length > 0 ? parsedResult.data.length - 1 : undefined);
      
      const successToast = toast({ title: "File Processed Successfully", description: `${fileName} processed.` });
      if (successToast?.id) setTimeout(() => dismiss(successToast.id), 2000);
      return { success: true, seriesNames: parsedResult.seriesNames, timeHeader: parsedResult.timeHeader };
    }
    return { success: false };
  }, [parseAndValidateCsv, toast, dismiss]);

  // Direct click handlers for upload buttons - optimized for speed
  const handleUploadClick = useCallback(() => {
    if (csvFileInputRef.current) {
      csvFileInputRef.current.click();
    }
  }, []);

  const handleLoadPlotClick = useCallback(() => {
    if (jsonLoadInputRef.current) {
      jsonLoadInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    setCurrentFileForValidation(null);
    const freshValidationSteps = initialValidationSteps.map(step => ({ ...step, status: 'pending' as const, message: undefined }));
    setValidationSteps(freshValidationSteps);

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
        
        const newPlotType = savedState.plotType || 'line';
        if (newPlotType === 'heatmap') {
          handlePlotTypeChange('heatmap');
        } else {
          const restoredVisibleSeries: Record<string, boolean> = {};
          actualSeriesInLoadedCsv.forEach(name => {
            restoredVisibleSeries[name] = savedState.visibleSeries[name] === true; 
          });
          setVisibleSeries(restoredVisibleSeries);
        }
        setPlotType(newPlotType);

        setTimeFormat(savedState.timeFormat || 'short');


        setIsPlotExpanded(savedState.isPlotExpanded === true);
        setIsMinimalistView(savedState.isMinimalistView === true);

        if (savedState.brushStartIndex !== undefined && savedState.brushEndIndex !== undefined) {
            setBrushStartIndex(savedState.brushStartIndex);
            setBrushEndIndex(savedState.brushEndIndex);
        } else if (parsedData.length > 0) {
            setBrushStartIndex(0);
            setBrushEndIndex(parsedData.length - 1);
        }
        
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
  }, [instanceId, processCsvFileContent, toast, initialValidationSteps, updateStepStatus, parsedData.length, handlePlotTypeChange]);

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
      timeFormat,
    };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plotTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'plot_save'}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast({ title: "Plot State Saved", description: `Configuration saved as ${a.download}.` });
  }, [rawCsvText, currentFileName, plotTitle, plotType, timeAxisLabel, dataSeries, visibleSeries, isPlotExpanded, isMinimalistView, brushStartIndex, brushEndIndex, timeFormat, toast]);


  const handleClearDataInstance = useCallback(() => {
    setRawCsvText(null); setParsedData([]); setCurrentFileName(undefined);
    setPlotTitle(initialPlotTitle); setDataSeries([]); setVisibleSeries({});
    setTimeAxisLabel(undefined); setPlotType('line'); setTimeFormat('short');
    setValidationSteps(initialValidationSteps.map(s => ({ ...s })));
    setCurrentFileForValidation(null); setAccordionValue("");
    setIsPlotExpanded(false); setIsMinimalistView(false);
    setBrushStartIndex(0); setBrushEndIndex(undefined);
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

  const currentPlotHeight = isPlotExpanded ? EXPANDED_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT;

  const summaryStep = getSummaryStep();

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
            disabled={isProcessing}
          />
        </CardTitle>
        <div className="flex items-center gap-0.5">
          <Separator orientation="vertical" className="h-5 mx-0.5" />
          <TooltipProvider delayDuration={100}>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={handleSavePlot} aria-label="Save plot state" className="h-7 w-7" disabled={!rawCsvText}><Save className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Save Plot</p></TooltipContent></Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setIsMinimalistView(!isMinimalistView)} aria-label={isMinimalistView ? "Show controls" : "Hide controls"} className="h-7 w-7">
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
                        disabled={parsedData.length === 0}
                    >
                        {isPlotExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{isPlotExpanded ? "Collapse Plot" : "Expand Plot"}</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)} aria-label={isMinimized ? "Expand plot instance" : "Minimize plot instance"}>
                  {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{isMinimized ? "Expand Instance" : "Minimize Instance"}</p></TooltipContent>
            </Tooltip>
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => onRemovePlot(instanceId)} aria-label="Remove plot" className="h-7 w-7"><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom"><p>Remove Plot</p></TooltipContent></Tooltip>
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
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs w-full" 
                    disabled={isProcessing}
                    onClick={handleUploadClick}
                  >
                    <UploadCloud className="h-3.5 w-3.5 mr-1.5"/> Choose file
                  </Button>
                  <Input ref={csvFileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="sr-only"/>
                </div>
                <div className="px-1 pb-0.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-7 text-xs" 
                    disabled={isProcessing}
                    onClick={handleLoadPlotClick}
                  >
                    <UploadCloud className="h-3.5 w-3.5 mr-1.5"/> Load Plot
                  </Button>
                  <Input ref={jsonLoadInputRef} type="file" accept=".json" onChange={handleLoadSavedPlotFileChange} className="sr-only"/>
                </div>

                <div className="space-y-1 px-1 pt-1">
                    <div className="flex items-center space-x-1">
                      <TooltipProvider delayDuration={100}>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => handlePlotTypeChange('line')} disabled={plotType === 'line' || parsedData.length === 0} className={cn("h-6 w-6 flex-1", plotType === 'line' && "bg-accent text-accent-foreground")}>
                                      <BarChart className="h-3.5 w-3.5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>Line Plot</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="outline" size="icon" onClick={() => handlePlotTypeChange('heatmap')} disabled={plotType === 'heatmap' || parsedData.length === 0} className={cn("h-6 w-6 flex-1", plotType === 'heatmap' && "bg-accent text-accent-foreground")}>
                                      <Sun className="h-3.5 w-3.5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>Heatmap</p></TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                    </div>
                </div>
                
                <div className="flex items-center justify-between p-1">
                  <UiLabel htmlFor={`time-format-switch-${instanceId}-${uniqueComponentId}`} className="text-xs flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground"/>
                    Time format
                  </UiLabel>
                  <Switch
                    id={`time-format-switch-${instanceId}-${uniqueComponentId}`}
                    checked={timeFormat === 'full'}
                    onCheckedChange={(checked) => setTimeFormat(checked ? 'full' : 'short')}
                    disabled={parsedData.length === 0}
                    className="h-4 w-8 [&>span]:h-3 [&>span]:w-3 [&>span[data-state=checked]]:translate-x-4"
                  />
                </div>

                {summaryStep && (
                  <div className="px-1">
                  <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue} className="w-full">
                    <AccordionItem value={"validation-details-" + instanceId} className="border-b-0">
                      <AccordionTrigger
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
                <div className="px-1 pb-0.5 pt-1 space-y-1">
                  <Button onClick={handleClearDataInstance} variant="outline" size="sm" className="w-full h-7 text-xs" disabled={isProcessing || (!currentFileName && !rawCsvText)}>Clear Data</Button>
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
                        <Checkbox id={`select-all-rhs-${instanceId}-${uniqueComponentId}`} checked={allSeriesSelected} onCheckedChange={(checked) => handleSelectAllToggle(!!checked)} disabled={dataSeries.length === 0} aria-label={allSeriesSelected ? "Deselect all series" : "Select all series"} className="h-3.5 w-3.5" />
                        <UiLabel htmlFor={`select-all-rhs-${instanceId}-${uniqueComponentId}`} className="text-xs font-medium leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            {allSeriesSelected ? "Deselect All" : "Select All"} ({dataSeries.filter(s => visibleSeries[s]).length}/{dataSeries.length})
                        </UiLabel>
                    </div>
                    <ScrollArea className="w-full rounded-md border p-1 flex-1">
                        {dataSeries.length > 0 ? (
                            dataSeries.map((seriesName) => (
                            <div key={seriesName} className="flex items-center space-x-1.5 py-0.5">
                                <Checkbox id={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`} checked={!!visibleSeries[seriesName]} onCheckedChange={(checked) => handleSeriesVisibilityChange(seriesName, !!checked)} className="h-3.5 w-3.5" />
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
              <div ref={chartAreaRef} className="relative">
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
                      timeFormat={timeFormat}
                    />
                ) : (
                    <HeatmapDisplay
                        data={parsedData}
                        series={plottableSeries}
                        containerHeight={currentPlotHeight}
                        brushStartIndex={brushStartIndex}
                        brushEndIndex={brushEndIndex}
                        onBrushChange={handleBrushChange}
                        timeFormat={timeFormat}
                    />
                )
              ) : (
                <div style={{ height: `${DEFAULT_PLOT_HEIGHT}px` }} className="flex items-center justify-center text-muted-foreground text-sm p-2 border rounded-md bg-muted/20">
                  {currentFileName ? "No data to display for " + currentFileName : "Choose a file, or load a plot to get started."}
                </div>
              )}
            </div>
            </div>
        </CardContent>
      )}
    </Card>
  );
}

