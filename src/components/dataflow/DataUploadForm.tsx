
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
  [key: string]: string | number; // Data from subsequent CSV columns
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
  { id: 'timeColumnCheck', label: 'Verifying first column as time/date', status: 'pending' },
  { id: 'variableColumnCheck', label: 'Verifying variable column headers', status: 'pending' },
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
      return null;
    }
    updateStepStatus('headerParse', 'success', "Header row found.");

    const delimiterRegex = /\s*[,;\t]\s*|\s+/;
    const originalHeaders = lines[0].trim().split(delimiterRegex).map(h => h.trim());

    if (originalHeaders.length < 1 || !originalHeaders[0]?.trim()) {
      updateStepStatus('timeColumnCheck', 'error', `File "${fileName}": CSV header error. First column (time/date) header is missing or empty.`);
      return null;
    }
    const timeHeader = originalHeaders[0].trim();
    updateStepStatus('timeColumnCheck', 'success', `Time column identified: '${timeHeader}'`);

    const variableHeaders = originalHeaders.slice(1);

    if (variableHeaders.length === 0) {
      updateStepStatus('variableColumnCheck', 'error', `File "${fileName}": CSV structure error. No data variable columns found after the first (time) column.`);
      return null;
    }

    const uniqueSeriesNamesForDropdown: string[] = [];
    const usedKeyNamesForDataPoint = new Set<string>(); // Tracks keys used in DataPoint to avoid clashes, including the fixed 'time' key

    variableHeaders.forEach(originalVarHeader => {
        let processedHeader = (originalVarHeader || "Unnamed Series").trim();
        if (!processedHeader) processedHeader = "Unnamed Series";

        let uniqueKey = processedHeader;
        let suffix = 1;

        // Ensure the key for DataPoint is not 'time' (case-insensitive) and is unique among other variable keys
        // The name for the dropdown will also be this uniqueKey.
        while (uniqueKey.toLowerCase() === 'time' || usedKeyNamesForDataPoint.has(uniqueKey)) {
            suffix++;
            uniqueKey = `${processedHeader} (${suffix})`;
        }
        
        uniqueSeriesNamesForDropdown.push(uniqueKey);
        usedKeyNamesForDataPoint.add(uniqueKey);
    });
    updateStepStatus('variableColumnCheck', 'success', `Variable columns identified: ${uniqueSeriesNamesForDropdown.join(', ')}.`);


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

      uniqueSeriesNamesForDropdown.forEach((uniqueKey, seriesIdx) => {
        const originalCsvColumnIndexForVar = seriesIdx + 1; // Index in originalHeaders for this variable
        const rawValue = values[originalCsvColumnIndexForVar];

        let numericValue = NaN; 
        if (rawValue !== undefined && rawValue !== null && rawValue.trim() !== "") {
          const cleanedValue = rawValue.replace(/,/g, '');
          const parsedFloat = parseFloat(cleanedValue);
          if (!isNaN(parsedFloat)) {
            numericValue = parsedFloat;
            hasNumericValueInRow = true;
          } else {
            someRowsHadNonNumericData = true;
            rowHasParsingIssue = true;
          }
        } else { // Empty cell for a variable
            someRowsHadNonNumericData = true; // Treat as missing data
            rowHasParsingIssue = true; // Potentially an issue if all are empty for a row.
        }
        dataPoint[uniqueKey] = numericValue; // Use the uniqueKey (which cannot be "time")
      });
      
      if (hasNumericValueInRow || (timeValue && values.length > 1 && values.slice(1).some(v => v && v.trim() !== ""))) {
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

    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows are fully numeric.`;
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric or empty values in variable columns encountered and treated as missing (NaN).";
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    } else {
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    }

    updateStepStatus('dataReady', 'success', "Data is ready.");
    return { data, seriesNames: uniqueSeriesNamesForDropdown, timeHeader };
  };

  const processFile = async (file: File): Promise<{ data: DataPoint[], seriesNames: string[], timeHeader: string } | null> => {
    setValidationSteps(initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined })));
    setCurrentFileForValidation(file.name);
    setAccordionValue(""); 
    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      const errorMsg = `File name "${file.name}" does not end with .csv. Please select a valid CSV file and try again.`;
      updateStepStatus('fileType', 'error', errorMsg);
      toast({ variant: "destructive", title: "Unsupported File Type", description: errorMsg });
      setAccordionValue("validation-details");
      return null;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const errorMsg = `File "${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please upload a smaller file and try again.`;
      updateStepStatus('fileType', 'error', errorMsg); 
      toast({ variant: "destructive", title: "File Too Large", description: errorMsg });
      setAccordionValue("validation-details");
      return null;
    }
    updateStepStatus('fileType', 'success', 'File is a .csv and within size limits.');

    let fileContent;
    try {
      fileContent = await file.text();
      if (!fileContent.trim()) {
        const errorMsg = `File "${file.name}" is empty or contains only whitespace. Please upload a file with content and try again.`;
        updateStepStatus('fileRead', 'error', errorMsg);
        toast({ variant: "destructive", title: "Empty File", description: errorMsg });
        setAccordionValue("validation-details");
        return null;
      }
      updateStepStatus('fileRead', 'success', 'File content read successfully.');
    } catch (e) {
      const errorMsg = `Could not read content from file "${file.name}". It may be corrupted, not a plain text file, or permissions might be an issue. Please check the file and try again.`;
      updateStepStatus('fileRead', 'error', errorMsg);
      toast({ variant: "destructive", title: "File Read Error", description: errorMsg });
      setAccordionValue("validation-details");
      return null;
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
    if (!validationSteps.length) return null;

    if (isProcessing) {
      const firstPending = validationSteps.find(step => step.status === 'pending');
      if (firstPending) return { ...firstPending, label: `Processing: ${firstPending.label}` };
      const lastProcessing = validationSteps.filter(s => s.status !== 'pending').pop();
      if(lastProcessing) return {...lastProcessing, status: 'pending', label: `Processing: ${lastProcessing.label}`};
    } else { 
      const firstError = validationSteps.find(step => step.status === 'error');
      if (firstError) return firstError; 
      
      const allSuccessful = validationSteps.every(step => step.status === 'success');
      if (allSuccessful) {
        const dataReadyStep = validationSteps.find(step => step.id === 'dataReady');
        if (dataReadyStep) return dataReadyStep;
      }
      const lastCompleted = [...validationSteps].reverse().find(step => step.status === 'success' || step.status === 'error');
      if (lastCompleted) return lastCompleted;
    }
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
          Upload a CSV file. The first column should be time/date. Subsequent columns are data series with headers in the first row and numeric data below. Delimiters can be comma, semicolon, tab, or space(s). Max file size: {MAX_FILE_SIZE_MB}MB.
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

        {currentFileForValidation && (
          <p className="text-sm font-medium">
            Status for: <span className="font-semibold">{currentFileForValidation}</span>
          </p>
        )}

        {validationSteps.length > 0 && summaryStep && (
          <Accordion type="single" collapsible value={accordionValue} onValueChange={setAccordionValue} className="w-full">
            <AccordionItem value="validation-details" className="border-b-0">
              <AccordionTrigger className={cn(
                "flex items-center justify-between text-sm p-3 rounded-md hover:no-underline hover:bg-muted/50",
                summaryStep.status === 'error' && 'bg-destructive/10 text-destructive hover:bg-destructive/20',
                summaryStep.status === 'success' && validationSteps.every(s => s.status === 'success' || s.status === 'pending') && !isProcessing && 'bg-green-500/10 text-green-700 hover:bg-green-500/20',
                isProcessing && 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20'
              )}>
                <div className="flex items-center gap-2">
                  {isProcessing || summaryStep.status === 'pending' ? <Hourglass className="h-4 w-4 animate-spin" /> :
                   summaryStep.status === 'success' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                   <XCircle className="h-4 w-4 text-destructive" />}
                  <span className="truncate">{summaryStep.label}</span>
                  {summaryStep.message && summaryStep.status !== 'pending' && <span className="text-xs text-muted-foreground truncate hidden sm:inline"> - {summaryStep.message}</span>}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-0">
                <ul className="space-y-1 border rounded-md p-3 bg-muted/20">
                  {validationSteps.map(step => (
                    <li key={step.id} className="flex items-start text-sm">
                      <div className="flex-shrink-0 w-5 h-5 mr-2 mt-0.5">
                        {step.status === 'pending' && <Hourglass className="h-full w-full text-muted-foreground animate-spin" />}
                        {step.status === 'success' && <CheckCircle2 className="h-full w-full text-green-500" />}
                        {step.status === 'error' && <XCircle className="h-full w-full text-red-500" />}
                      </div>
                      <div className="flex-grow">
                        <span className={cn(
                          step.status === 'error' && 'text-destructive font-semibold',
                          step.status === 'success' && 'text-green-600',
                          'block'
                        )}>
                          {step.label}
                        </span>
                        {step.message && step.status !== 'pending' && (
                            <span className={cn(
                                "text-xs block",
                                step.status === 'error' ? 'text-red-700' : 'text-muted-foreground'
                            )}>
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

        {isProcessing && validationSteps.length === 0 && <p className="text-sm text-primary animate-pulse">Preparing for validation...</p>}

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
    

    