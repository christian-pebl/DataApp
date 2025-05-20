
"use client";

import type { ChangeEvent } from "react";
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { UploadCloud, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DataPoint {
  time: string | number; // Data from the first CSV column
  [key: string]: string | number | undefined; // Data from subsequent CSV columns, using unique series names
}

interface DataUploadFormProps {
  onDataUploaded: (data: DataPoint[], fileName: string, seriesNames: string[], timeHeader: string) => void;
  onClearData: () => void;
  currentFileNameFromParent?: string;
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
  { id: 'variableColumnCheck', label: 'Verifying variable column headers', status: 'pending' },
  { id: 'yAxisIdentified', label: 'Default Y-axis (first variable) column identified', status: 'pending' }, // This step label might be less relevant with checkbox selector
  { id: 'dataRowFormat', label: 'Checking data rows for numeric values', status: 'pending' },
  { id: 'dataReady', label: 'Data processed successfully', status: 'pending' },
];

export function DataUploadForm({ onDataUploaded, onClearData, currentFileNameFromParent }: DataUploadFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);
  const [currentFileForValidation, setCurrentFileForValidation] = useState<string | null>(null);
  const [accordionValue, setAccordionValue] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (!isProcessing && validationSteps.length > 0) {
      const hasError = validationSteps.some(step => step.status === 'error');
      if (hasError) {
        setAccordionValue("validation-details");
      }
    }
  }, [isProcessing, validationSteps]);

  const updateStepStatus = (stepId: string, status: 'success' | 'error', message?: string) => {
    setValidationSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status, message: message || (status === 'error' ? 'Failed' : 'Completed') } : step
      )
    );
  };

  const parseAndValidateCsv = (csvText: string, fileName: string): { data: DataPoint[], seriesNames: string[], timeHeader: string } | null => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
      updateStepStatus('headerParse', 'error', `File "${fileName}": CSV content error. Must have a header row and at least one data row.`);
      updateStepStatus('xAxisIdentified', 'error', 'Cannot identify X-axis: Header row missing.');
      updateStepStatus('variableColumnCheck', 'error', 'Cannot identify variable columns: Header row missing.');
      updateStepStatus('yAxisIdentified', 'error', 'Cannot identify Y-axis: Header row missing.');
      updateStepStatus('dataRowFormat', 'error', 'Cannot check data rows: Header row missing.');
      return null;
    }
    updateStepStatus('headerParse', 'success', "Header row found.");

    const delimiterRegex = /\s*[,;\t]\s*|\s+/; // Supports comma, semicolon, tab, or space(s)
    const originalHeaders = lines[0].trim().split(delimiterRegex).map(h => h.trim());

    if (originalHeaders.length < 1 || !originalHeaders[0]?.trim()) {
      updateStepStatus('xAxisIdentified', 'error', `File "${fileName}": CSV header error. First column (expected for X-axis time/date) header is missing or empty.`);
      updateStepStatus('variableColumnCheck', 'error', 'Cannot identify variable columns: X-axis header missing.');
      updateStepStatus('yAxisIdentified', 'error', 'Cannot identify Y-axis: X-axis header missing.');
      return null;
    }
    const timeHeader = originalHeaders[0].trim();
    updateStepStatus('xAxisIdentified', 'success', `Using header: '${timeHeader}' from column 1 for X-axis.`);

    let potentialVariableHeaders = originalHeaders.slice(1);
    let actualVariableHeadersToProcess = [...potentialVariableHeaders];

    // Check if the last column's header is "Rec" (case-insensitive) and exclude it
    if (potentialVariableHeaders.length > 0 && originalHeaders[originalHeaders.length - 1].trim().toLowerCase() === 'rec') {
      actualVariableHeadersToProcess = potentialVariableHeaders.slice(0, -1); // Exclude the last item
      updateStepStatus('variableColumnCheck', 'success', `Identified variable columns. Last column "Rec" will be excluded from plotting.`);
    } else if (potentialVariableHeaders.length === 0) {
       updateStepStatus('variableColumnCheck', 'error', `File "${fileName}": CSV structure error. No data variable columns found after the first (time) column.`);
       updateStepStatus('yAxisIdentified', 'error', `File "${fileName}": No variable columns for Y-axis. CSV must have at least two columns (time + one variable). "Rec" column (if last) is ignored.`);
       return null;
    } else {
        updateStepStatus('variableColumnCheck', 'success', `Identified ${actualVariableHeadersToProcess.length} variable column(s): ${actualVariableHeadersToProcess.join(', ') || 'None available after "Rec" exclusion'}.`);
    }
    
    if (actualVariableHeadersToProcess.length === 0 && originalHeaders[originalHeaders.length - 1].trim().toLowerCase() === 'rec' && originalHeaders.length === 2) {
        // Special case: CSV only had "Time" and "Rec"
        updateStepStatus('yAxisIdentified', 'error', `File "${fileName}": Only a time column and a "Rec" column found. No other variables to plot.`);
        return null;
    }


    const uniqueSeriesNamesForDropdown: string[] = [];
    const usedKeyNamesForDataPoint = new Set<string>();

    actualVariableHeadersToProcess.forEach(originalVarHeader => {
        let processedHeader = (originalVarHeader || "Unnamed Series").trim();
        if (!processedHeader) processedHeader = "Unnamed Series";

        let uniqueKey = processedHeader;
        let suffix = 1;
        
        while (uniqueKey.toLowerCase() === 'time' || usedKeyNamesForDataPoint.has(uniqueKey)) {
            uniqueKey = `${processedHeader}_${suffix}`; // Use underscore for better readability than space+(num)
            suffix++;
        }
        
        uniqueSeriesNamesForDropdown.push(uniqueKey);
        usedKeyNamesForDataPoint.add(uniqueKey);
    });
    
    if (uniqueSeriesNamesForDropdown.length > 0) {
       updateStepStatus('yAxisIdentified', 'success', `First plottable variable (default for Y-axis if needed, now using checkboxes): '${uniqueSeriesNamesForDropdown[0]}' (from CSV column 2 header: "${actualVariableHeadersToProcess[0]}"). Total plottable variables: ${uniqueSeriesNamesForDropdown.length}.`);
    } else {
      updateStepStatus('yAxisIdentified', 'error', `File "${fileName}": No plottable variable columns found after processing headers (and potentially excluding "Rec" column).`);
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

      if (!timeValue && values.slice(1).every(v => !v || v.trim() === "")) {
        continue;
      }

      const dataPoint: DataPoint = { time: timeValue || "N/A" };
      let hasNumericValueInRow = false;
      let rowHasParsingIssue = false;

      // Iterate based on uniqueSeriesNamesForDropdown, which respects the "Rec" exclusion
      uniqueSeriesNamesForDropdown.forEach((uniqueKey, seriesIdx) => {
        // seriesIdx corresponds to the index in actualVariableHeadersToProcess
        // The actual CSV column index for this variable is seriesIdx + 1 (because column 0 is time)
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
            numericValue = NaN; // Explicitly set to NaN if empty or undefined
            someRowsHadNonNumericData = true; 
            rowHasParsingIssue = true; 
        }
        dataPoint[uniqueKey] = numericValue; 
      });
      
      if (timeValue || hasNumericValueInRow) { // Keep row if time value exists or any variable has numeric data
         data.push(dataPoint);
         if (!rowHasParsingIssue && hasNumericValueInRow) {
            validDataRowsCount++;
         }
      }
    }

    if (data.length === 0) {
      updateStepStatus('dataRowFormat', 'error', `File "${fileName}": CSV data error. No processable data rows found. Ensure variable columns contain numeric data and time values are present. Also check for correct delimiter (comma, semicolon, tab, or space).`);
      return null;
    }

    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows appear fully numeric for at least one variable.`;
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric or empty values in variable columns were encountered; these will be treated as missing (NaN) by the chart.";
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    } else {
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    }

    updateStepStatus('dataReady', 'success', "Data is ready.");
    return { data, seriesNames: uniqueSeriesNamesForDropdown, timeHeader };
  };

  const processFile = async (file: File): Promise<{ data: DataPoint[], seriesNames: string[], timeHeader: string } | null> => {
    const newValidationSteps = initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }));
    setValidationSteps(newValidationSteps); 
    setCurrentFileForValidation(file.name);
    setAccordionValue(""); 
    
    const updateAndReturnNull = (stepId: string, errorMsg: string, isToastError: boolean = true, title?: string) => {
      updateStepStatus(stepId, 'error', errorMsg);
      if (isToastError) {
        toast({ variant: "destructive", title: title || "File Validation Error", description: errorMsg });
      }
      setAccordionValue("validation-details");
      return null;
    };

    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return updateAndReturnNull('fileType', `File name "${file.name}" does not end with .csv. Please select a valid CSV file and try again.`, true, "Unsupported File Type");
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return updateAndReturnNull('fileType', `File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please upload a smaller file and try again.`, true, "File Too Large");
    }
    updateStepStatus('fileType', 'success', 'File is a .csv and within size limits.');

    let fileContent;
    try {
      fileContent = await file.text();
      if (!fileContent.trim()) {
        return updateAndReturnNull('fileRead', `File "${file.name}" is empty or contains only whitespace. Please upload a file with content and try again.`, true, "Empty File");
      }
      updateStepStatus('fileRead', 'success', 'File content read successfully.');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      return updateAndReturnNull('fileRead', `Could not read content from file "${file.name}": ${errorMsg}. It may be corrupted or not a plain text file. Please check the file and try again.`, true, "File Read Error");
    }

    const result = parseAndValidateCsv(fileContent, file.name);
    if (!result) {
       toast({
         variant: "destructive",
         title: "CSV Data Validation Failed",
         description: `File "${file.name}": Please check the validation checklist above for details and ensure your CSV file meets the requirements. You can then try uploading again.`,
       });
       setAccordionValue("validation-details"); 
    }
    return result;
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    setValidationSteps([]); 
    setCurrentFileForValidation(null);

    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      return;
    }

    const parsedResult = await processFile(file);

    if (parsedResult) {
        onDataUploaded(parsedResult.data, file.name, parsedResult.seriesNames, parsedResult.timeHeader);
        toast({
          title: "File Uploaded Successfully",
          description: `${file.name} has been processed.`,
        });
    } 
    
    setIsProcessing(false);
    if (event.target) { 
      event.target.value = ""; 
    }
  };

  const handleClear = () => {
    onClearData();
    setValidationSteps([]);
    setCurrentFileForValidation(null);
    setAccordionValue("");
    toast({
      title: "Data Cleared",
      description: "Uploaded file information has been cleared.",
    });
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" />
          Import Data
        </CardTitle>
        <CardDescription>
          Upload a CSV file. The first column is time/date. Subsequent columns are data series. The last column, if named "Rec", will be ignored. Delimiters can be comma, semicolon, tab, or space(s). Max file size: {MAX_FILE_SIZE_MB}MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="sr-only">Upload File</Label>
          <Input
            id="file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={isProcessing}
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
        </div>

        {currentFileForValidation && !summaryStep && isProcessing && ( 
             <p className="text-sm text-primary animate-pulse">Processing: <span className="font-semibold">{currentFileForValidation}</span>...</p>
        )}

        {summaryStep && (
          <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue} className="w-full">
            <AccordionItem value="validation-details" className="border-b-0">
              <AccordionTrigger 
                className={cn(
                  "flex items-center justify-between text-sm p-3 rounded-md hover:no-underline hover:bg-muted/50 text-left",
                  summaryStep.status === 'error' && 'bg-destructive/10 text-destructive hover:bg-destructive/20',
                  summaryStep.status === 'success' && validationSteps.every(s => s.status === 'success' || s.status === 'pending') && !isProcessing && 'bg-green-500/10 text-green-700 hover:bg-green-500/20',
                  (isProcessing || summaryStep.status === 'pending') && 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20'
              )}>
                <div className="flex items-center gap-2 min-w-0"> 
                  {isProcessing || summaryStep.status === 'pending' ? <Hourglass className="h-4 w-4 animate-spin flex-shrink-0" /> :
                   summaryStep.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" /> :
                   <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />}
                  <span className="truncate font-medium">{summaryStep.label}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-0">
                <div className="text-xs text-muted-foreground px-3 pb-2">
                    File: {currentFileForValidation || "N/A"}
                </div>
                <ul className="space-y-1 border rounded-md p-3 bg-muted/20 max-h-60 overflow-y-auto">
                  {validationSteps.map(step => (
                    <li key={step.id} className="flex items-start text-sm">
                      <div className="flex-shrink-0 w-5 h-5 mr-2 mt-0.5">
                        {step.status === 'pending' && <Hourglass className="h-full w-full text-muted-foreground animate-spin" />}
                        {step.status === 'success' && <CheckCircle2 className="h-full w-full text-green-500" />}
                        {step.status === 'error' && <XCircle className="h-full w-full text-red-500" />}
                      </div>
                      <div className="flex-grow min-w-0"> 
                        <span className={cn(
                          step.status === 'error' && 'text-destructive font-semibold',
                          step.status === 'success' && 'text-green-600',
                          'block'
                        )}>
                          {step.label}
                        </span>
                        {step.message && step.status !== 'pending' && (
                            <span className={cn(
                                "text-xs block truncate", 
                                step.status === 'error' ? 'text-red-700' : 'text-muted-foreground'
                            )} title={step.message}> 
                               &ndash; {step.message}
                            </span>
                        )}
                         {step.status === 'pending' && <span className="text-xs text-muted-foreground block">&ndash; Pending...</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {!summaryStep && !isProcessing && currentFileForValidation && ( 
            <p className="text-sm text-muted-foreground">Awaiting processing for <span className="font-semibold">{currentFileForValidation}</span>.</p>
        )}
        {!summaryStep && !isProcessing && !currentFileForValidation && (
             <p className="text-sm text-muted-foreground">Upload a CSV file to begin.</p>
        )}


        <Button
            onClick={handleClear}
            variant="outline"
            className="w-full"
            disabled={isProcessing || !currentFileNameFromParent}
        >
          Clear Data
        </Button>
      </CardContent>
    </Card>
  );
}
    

    