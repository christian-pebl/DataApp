
"use client";

import type { ChangeEvent } from "react";
import React, { useState, useEffect, useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartDisplay } from "@/components/dataflow/ChartDisplay";
import { Hourglass, CheckCircle2, XCircle, ListFilter, X, Maximize2, Minimize2, Settings2, ChevronsDown, ChevronsUp, ChevronsLeft, ChevronsRight, UploadCloud, Save, Upload, Scissors, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

const DEFAULT_PLOT_HEIGHT = 278;
const EXPANDED_PLOT_HEIGHT = 555;

interface SavedPlotState {
  rawCsvText: string;
  currentFileName: string;
  plotTitle: string;
  timeAxisLabel?: string;
  dataSeries: string[]; // Array of original series names from the CSV used at save time
  visibleSeries: Record<string, boolean>; // Map of series names to their visibility state
  isPlotExpanded: boolean;
  isMinimalistView: boolean;
  brushStartIndex?: number;
  brushEndIndex?: number;
}

interface PlotInstanceProps {
  instanceId: string;
  onRemovePlot: (id: string) => void;
  initialPlotTitle?: string;
}

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
  const uniqueComponentId = useId();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMinimalistView, setIsMinimalistView] = useState(false);
  const [isPlotExpanded, setIsPlotExpanded] = useState(false);
  
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);
  

  const currentChartHeight = isPlotExpanded ? EXPANDED_PLOT_HEIGHT : DEFAULT_PLOT_HEIGHT;

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

    const delimiterRegex = /\s*[,;\t]\s*/;
    const originalHeaders = lines[0].trim().split(delimiterRegex).map(h => h.trim());

    const timeHeader = originalHeaders[0]?.trim() || "X-Axis Time (Default)";
     if (!originalHeaders[0]?.trim()){
        updateStepStatus('xAxisIdentified', 'success', `Using CSV Column 1 header: '${timeHeader}' for X-axis data.`);
    } else {
        updateStepStatus('xAxisIdentified', 'success', `Using CSV Column 1 header: '${timeHeader}' for X-axis data.`);
    }

    let potentialVariableHeaders = originalHeaders.slice(1);
    let actualVariableHeadersToProcess: string[];

    if (potentialVariableHeaders.length > 0 && potentialVariableHeaders[potentialVariableHeaders.length - 1].trim().toLowerCase() === 'rec') {
      actualVariableHeadersToProcess = potentialVariableHeaders.slice(0, -1);
      updateStepStatus('variableColumnCheck', 'success', `Identified variable columns. Last column "Rec" (header: "${potentialVariableHeaders[potentialVariableHeaders.length - 1]}") was found and excluded from plotting.`);
    } else if (potentialVariableHeaders.length === 0 && originalHeaders.length > 1) {
       updateStepStatus('variableColumnCheck', 'error', `File "${fileName}": CSV structure error. No data variable columns found after the first (time) column (and after potentially excluding a final "Rec" column). Ensure your CSV uses comma, semicolon, or tab delimiters.`);
       updateStepStatus('yAxisFirstVarIdentified', 'error', `File "${fileName}": No variable columns for Y-axis. CSV must have at least two columns (time + one variable), excluding a final "Rec" column if present.`);
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
      setPlotTitle(fileName); // Default plot title to filename
      setDataSeries(parsedResult.seriesNames);
      setTimeAxisLabel(parsedResult.timeHeader);
      
      // Default visibility - this will be overridden if loading a saved plot
      const defaultVisibleSeries: Record<string, boolean> = {};
      parsedResult.seriesNames.forEach((name, index) => {
        defaultVisibleSeries[name] = index < 4;
      });
      setVisibleSeries(defaultVisibleSeries); 

      setBrushStartIndex(undefined); // Reset brush on new data
      setBrushEndIndex(undefined);
      const successToast = toast({
        title: "File Processed Successfully",
        description: `${fileName} has been processed.`,
      });
      setTimeout(() => {
        dismiss(successToast.id);
      }, 2000);
      return { success: true, seriesNames: parsedResult.seriesNames };
    }
    return { success: false };
  };


  const handleCsvFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    setCurrentFileForValidation(null);
    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      return;
    }

    setCurrentFileForValidation(file.name);
    setAccordionValue(""); 

    const updateAndReturnError = (stepId: string, errorMsg: string, title?: string) => {
      updateStepStatus(stepId, 'error', errorMsg);
      const stepIndex = initialValidationSteps.findIndex(s => s.id === stepId);
      if (stepIndex !== -1) {
        for (let i = stepIndex + 1; i < initialValidationSteps.length; i++) {
            const currentStep = validationSteps.find(s => s.id === initialValidationSteps[i].id) || initialValidationSteps[i];
            if(currentStep.status === 'pending') { 
                 updateStepStatus(initialValidationSteps[i].id, 'error', 'Prerequisite step failed.');
            }
        }
      }
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

      // Validate loaded state structure (basic check)
      if (!savedState.rawCsvText || !savedState.currentFileName || !savedState.plotTitle || !savedState.dataSeries || savedState.visibleSeries === undefined) {
        throw new Error("Invalid save file structure. Missing essential fields (rawCsvText, currentFileName, plotTitle, dataSeries, visibleSeries).");
      }
      
      const { success: successfullyProcessed, seriesNames: actualSeriesInLoadedCsv } = processCsvFileContent(savedState.rawCsvText, savedState.currentFileName);

      if (successfullyProcessed && actualSeriesInLoadedCsv) {
        setPlotTitle(savedState.plotTitle); 
        
        const restoredVisibleSeries: Record<string, boolean> = {};
        actualSeriesInLoadedCsv.forEach(name => {
          restoredVisibleSeries[name] = savedState.visibleSeries[name] === true;
        });
        setVisibleSeries(restoredVisibleSeries);

        setIsPlotExpanded(savedState.isPlotExpanded);
        setIsMinimalistView(savedState.isMinimalistView);
        setBrushStartIndex(savedState.brushStartIndex);
        setBrushEndIndex(savedState.brushEndIndex);
        
        // Restore timeAxisLabel if it was saved and differs from what the CSV parsing might set
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
          description: `Could not process CSV data from loaded file ${file.name}. Check validation details if any.`,
        });
      }
    } catch (error: any) {
      console.error("Error loading plot state:", error);
      toast({
        variant: "destructive",
        title: "Load Failed",
        description: error.message || `Could not load plot state from ${file.name}. The file might be corrupted or not a valid save file.`,
      });
      setValidationSteps(initialValidationSteps.map(s => s.id === 'fileSelection' ? {...s, status: 'error', message: `Failed to load plot state from ${file.name}: ${error.message || 'Invalid file'}`} : {...s, status: 'error', message: 'Prerequisite step failed.'} ));
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
      dataSeries, // This should be the unique series names used for plotting
      visibleSeries,
      isPlotExpanded,
      isMinimalistView,
      brushStartIndex,
      brushEndIndex,
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
    setIsMinimalistView(false); // Also reset minimalist view
    setBrushStartIndex(undefined);
    setBrushEndIndex(undefined);
    toast({
      title: "Data Cleared",
      description: "Plot data has been cleared for this instance.",
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
  const plottableSeries = dataSeries.filter(seriesName => visibleSeries[seriesName]);

  const csvFileInputId = `${uniqueComponentId}-csv-upload-${instanceId}`;
  const jsonLoadInputId = `${uniqueComponentId}-json-load-${instanceId}`;


  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between p-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings2 className="h-4 w-4"/> 
          {plotTitle || "Data Plot"}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleSavePlot} aria-label="Save plot state" className="h-7 w-7" disabled={!rawCsvText}>
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsPlotExpanded(!isPlotExpanded)}
            aria-label={isPlotExpanded ? "Collapse plot height" : "Expand plot height"}
            className="h-7 w-7"
            disabled={parsedData.length === 0}
          >
            {isPlotExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsMinimalistView(!isMinimalistView)} aria-label={isMinimalistView ? "Show controls" : "Hide controls"} className="h-7 w-7">
            {isMinimalistView ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsMinimized(!isMinimized)} aria-label={isMinimized ? "Expand plot" : "Minimize plot"} className="h-7 w-7">
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onRemovePlot(instanceId)} aria-label="Remove plot" className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className={cn("p-2 pt-0 md:grid gap-2", isMinimalistView ? "block" : "md:grid-cols-12")}>
          {!isMinimalistView && (
             <div className="md:col-span-2 flex flex-col space-y-1.5">
              <div className="space-y-1 border p-1.5 rounded-md flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-1 px-1 pt-0.5 pb-0.5">
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
                     type="file"
                     accept=".csv"
                     onChange={handleCsvFileChange}
                     disabled={isProcessing}
                     className="sr-only"
                   />
                 </div>
                 <div className="px-1 pb-1">
                   <Button asChild variant="outline" size="sm" className="w-full h-8 text-xs">
                     <Label htmlFor={jsonLoadInputId} className="cursor-pointer flex items-center justify-center">
                       <Upload className="mr-1.5 h-3.5 w-3.5" /> Load Saved Plot
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
                           <span className="font-medium text-[0.6rem] break-words">
                             {summaryStep.label}
                           </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0.5 pb-0">
                        <div className="text-[0.55rem] text-muted-foreground px-1 pb-0.5">
                            File: {currentFileForValidation || currentFileName || "N/A"}
                        </div>
                        <ScrollArea className="w-full rounded-md border p-1 bg-muted/20 max-h-28 overflow-y-auto"> 
                          {validationSteps.map(step => (
                            <li key={step.id} className="flex items-start list-none">
                              <div className="flex-shrink-0 w-2.5 h-2.5 mr-1 mt-0.5"> 
                                {step.status === 'pending' && <Hourglass className="h-full w-full text-muted-foreground animate-spin" />}
                                {step.status === 'success' && <CheckCircle2 className="h-full w-full text-green-500" />}
                                {step.status === 'error' && <XCircle className="h-full w-full text-red-500" />}
                              </div>
                              <div className="flex-grow min-w-0"> 
                                <span className={cn(
                                  'block text-[0.55rem]', 
                                  step.status === 'error' && 'text-destructive font-semibold',
                                  step.status === 'success' && 'text-green-600'
                                )}>
                                  {step.label}
                                </span>
                                {step.message && step.status !== 'pending' && (
                                    <span className={cn(
                                        "text-[0.45rem] block whitespace-pre-wrap", 
                                        step.status === 'error' ? 'text-red-700' : 'text-muted-foreground'
                                    )} title={step.message}>
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
                     <p className="text-[0.6rem] text-muted-foreground px-1 pb-0.5">Upload a CSV or Load Plot.</p>
                )}
                <div className="px-1 pb-0.5 pt-1 space-y-1"> 
                  <Button
                      onClick={handleClearDataInstance}
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      disabled={isProcessing || (!currentFileName && !rawCsvText)}
                  >
                    Clear Data
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {!isMinimalistView && (
            <div className="md:col-span-2 flex flex-col space-y-1.5">
               <div className="space-y-1 p-1.5 border rounded-md flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-1">
                  <ListFilter className="h-3 w-3 text-[#2B7A78]" />
                  <h3 className="text-xs font-semibold text-[#2B7A78]">Select Variables</h3>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Checkbox
                    id={`select-all-rhs-${instanceId}-${uniqueComponentId}`}
                    checked={allSeriesSelected}
                    onCheckedChange={() => handleSelectAllToggle(!allSeriesSelected)}
                    disabled={dataSeries.length === 0}
                    aria-label={allSeriesSelected ? "Deselect all series" : "Select all series"}
                    className="h-3.5 w-3.5" 
                  />
                  <Label
                    htmlFor={`select-all-rhs-${instanceId}-${uniqueComponentId}`}
                    className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {allSeriesSelected ? "Deselect All" : "Select All"} ({dataSeries.filter(s => visibleSeries[s]).length}/{dataSeries.length})
                  </Label>
                </div>
                 <ScrollArea className="w-full rounded-md border p-1 h-32">
                  {dataSeries.length > 0 ? (
                    dataSeries.map((seriesName) => (
                      <div key={seriesName} className="flex items-center space-x-1.5 py-0.5">
                        <Checkbox
                          id={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`}
                          checked={!!visibleSeries[seriesName]}
                          onCheckedChange={(checked) => handleSeriesVisibilityChange(seriesName, !!checked)}
                          className="h-3.5 w-3.5" 
                        />
                        <Label
                          htmlFor={`series-rhs-${seriesName}-${instanceId}-${uniqueComponentId}`}
                          className="text-xs leading-snug peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate" 
                          title={seriesName}
                        >
                          {seriesName}
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      No variables found. Upload a file.
                    </p>
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
          
           <div className={cn(isMinimalistView ? "col-span-full" : "md:col-span-8", "flex flex-col min-h-0")}>
             <div className={cn(isMinimalistView ? "flex-1 min-h-0" : "")}>
                <ChartDisplay
                    data={parsedData}
                    plottableSeries={plottableSeries}
                    timeAxisLabel={timeAxisLabel}
                    plotTitle={plotTitle || "Chart"}
                    chartRenderHeight={currentChartHeight}
                    brushStartIndex={brushStartIndex}
                    brushEndIndex={brushEndIndex}
                    onBrushChange={handleBrushChange}
                />
             </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

