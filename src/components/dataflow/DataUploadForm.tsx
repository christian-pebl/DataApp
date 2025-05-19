
"use client";

import type { ChangeEvent } from "react";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, Hourglass, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DataPoint {
  time: string | number;
  [key: string]: string | number;
}

interface DataUploadFormProps {
  onDataUploaded: (data: DataPoint[], seriesNames: string[], fileName: string) => void;
  onClearData: () => void;
  currentFileNameFromParent?: string;
}

interface ValidationStep {
  id: string;
  label: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

const initialValidationSteps: ValidationStep[] = [
  { id: 'fileSelection', label: 'File selected', status: 'pending' },
  { id: 'fileType', label: 'Checking file type (must be .csv)', status: 'pending' },
  { id: 'fileRead', label: 'Reading file content', status: 'pending' },
  { id: 'headerParse', label: 'Checking for header row', status: 'pending' },
  { id: 'timeColumnCheck', label: 'Verifying first column as time/date', status: 'pending' },
  { id: 'variableColumnCheck', label: 'Verifying variable column headers', status: 'pending' },
  { id: 'dataRowFormat', label: 'Checking data rows for numeric values', status: 'pending' },
  { id: 'dataReady', label: 'Data processed successfully', status: 'pending' },
];

export function DataUploadForm({ onDataUploaded, onClearData, currentFileNameFromParent }: DataUploadFormProps) {
  const [currentDisplayedFileName, setCurrentDisplayedFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationSteps, setValidationSteps] = useState<ValidationStep[]>([]);
  const [currentFileForValidation, setCurrentFileForValidation] = useState<string | null>(null);
  const { toast } = useToast();

  const updateStepStatus = (stepId: string, status: 'success' | 'error', message?: string) => {
    setValidationSteps(prevSteps =>
      prevSteps.map(step =>
        step.id === stepId ? { ...step, status, message: message || (status === 'error' ? 'Failed' : 'Completed') } : step
      )
    );
  };

  const parseAndValidateCsv = (csvText: string): { data: DataPoint[]; seriesNames: string[] } | null => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
      updateStepStatus('headerParse', 'error', "CSV must have a header row and at least one data row.");
      return null;
    }
    updateStepStatus('headerParse', 'success', "Header row found.");

    const delimiterRegex = /\s*[,;\t]\s*|\s+/;
    const headers = lines[0].trim().split(delimiterRegex).map(h => h.trim()).filter(h => h);

    if (headers.length < 1) {
      updateStepStatus('timeColumnCheck', 'error', "CSV header row is missing or has no column names.");
      return null;
    }
    updateStepStatus('timeColumnCheck', 'success', `Time column identified: '${headers[0]}'`);

    const seriesNames = headers.slice(1).filter(name => name);
    if (seriesNames.length === 0) {
      updateStepStatus('variableColumnCheck', 'error', "No data variable columns found after the first (time) column.");
      return null;
    }
    updateStepStatus('variableColumnCheck', 'success', `Variable columns identified: ${seriesNames.join(', ')}`);

    const data: DataPoint[] = [];
    let someRowsHadNonNumericData = false;
    let validDataRowsCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const values = trimmedLine.split(delimiterRegex).map(v => v.trim());
      
      const timeValue = values[0];
      if (!timeValue && values.slice(1).some(v => v && v.trim() !== "")) { // If time is missing but other data exists
        // This specific error might be too noisy if many rows have it.
        // updateStepStatus('dataRowFormat', 'error', `Row ${i + 1} is missing a time value but has other data. Skipping row.`);
        // For now, we just skip such rows or let NaN propagate if they are included.
        // Let's choose to skip rows where time is absolutely critical and missing.
        continue;
      }
      if (!timeValue && values.length === 1 && values[0] === "") continue; // skip completely empty lines that might result from split

      const dataPoint: DataPoint = { time: timeValue || "N/A" }; // Use N/A if timeValue is empty but row is processed
      let hasNumericValueInRow = false;
      let rowHasParsingIssue = false;

      seriesNames.forEach((seriesName) => {
        const headerIndex = headers.indexOf(seriesName);
        const rawValue = values[headerIndex];

        if (rawValue === undefined || rawValue.trim() === "") {
          dataPoint[seriesName] = NaN; // Treat empty strings as NaN
          return;
        }
        const cleanedValue = rawValue.replace(/,/g, ''); // Remove commas for thousands separators
        const seriesValue = parseFloat(cleanedValue);

        if (!isNaN(seriesValue)) {
          dataPoint[seriesName] = seriesValue;
          hasNumericValueInRow = true;
        } else {
          dataPoint[seriesName] = NaN; // Store NaN if parsing fails
          someRowsHadNonNumericData = true;
          rowHasParsingIssue = true;
        }
      });
      
      // Only add row if it has at least one numeric value or if it's not entirely empty beyond time
      if (hasNumericValueInRow || (timeValue && values.slice(1).some(v => v && v.trim() !== ""))) {
         data.push(dataPoint);
         if (!rowHasParsingIssue && hasNumericValueInRow) {
            validDataRowsCount++;
         }
      }
    }

    if (data.length === 0) {
      updateStepStatus('dataRowFormat', 'error', "No processable data rows found. Check for numeric values in variable columns or ensure time values are present.");
      return null;
    }
    
    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows are fully numeric.`;
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric values encountered and treated as missing (NaN).";
      updateStepStatus('dataRowFormat', 'success', dataRowMessage); // Success with a note
    } else {
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    }
    
    updateStepStatus('dataReady', 'success', "Data is ready for visualization.");
    return { data, seriesNames };
  };

  const processFile = async (file: File): Promise<{ data: DataPoint[]; seriesNames: string[] } | null> => {
    setValidationSteps(initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }))); // Reset messages
    setCurrentFileForValidation(file.name);
    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);

    if (!file.name.endsWith(".csv")) {
      updateStepStatus('fileType', 'error', "Unsupported file type. Please upload a CSV (.csv) file.");
      toast({ variant: "destructive", title: "Unsupported File Type", description: "Please upload a CSV file." });
      return null;
    }
    updateStepStatus('fileType', 'success');

    let fileContent;
    try {
      fileContent = await file.text();
      updateStepStatus('fileRead', 'success');
    } catch (e) {
      updateStepStatus('fileRead', 'error', "Could not read file content.");
      toast({ variant: "destructive", title: "File Read Error", description: "Could not read the file." });
      return null;
    }

    if (file.name.endsWith(".csv")) {
      const result = parseAndValidateCsv(fileContent);
      if (!result) {
         toast({
           variant: "destructive",
           title: "CSV Data Validation Failed",
           description: "Please check the validation checklist above for details and ensure your CSV file meets the requirements.",
         });
      }
      return result;
    }
    // Fallback for non-CSV if we were to support JSON again, but problem statement implies CSV only
    updateStepStatus('fileType', 'error', "Logic error: Should only process CSV here.");
    return null;
  };


  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    // Reset validation steps fully for a new file upload attempt
    setValidationSteps([]); 
    setCurrentFileForValidation(null);


    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      return;
    }

    setCurrentDisplayedFileName(file.name);

    const parsedResult = await processFile(file);

    if (parsedResult) {
        onDataUploaded(parsedResult.data, parsedResult.seriesNames, file.name);
        toast({
          title: "File Uploaded Successfully",
          description: `${file.name} has been processed. Select a series to visualize!`,
        });
    } else {
        // Errors are handled within processFile and parseAndValidateCsv via updateStepStatus and toasts
        // Clear the displayed file name if parsing fails and we intend to clear the input
        setCurrentDisplayedFileName(null); 
    }

    setIsProcessing(false);
    if (event.target) {
      event.target.value = ""; // Reset file input for re-upload
    }
  };
  
  const handleClear = () => {
    setCurrentDisplayedFileName(null);
    onClearData();
    setValidationSteps([]); 
    setCurrentFileForValidation(null);
    toast({
      title: "Data Cleared",
      description: "Chart data and uploaded file information have been cleared.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" />
          Import Data
        </CardTitle>
        <CardDescription>
          Upload a CSV file. The first column should be time/date. Subsequent columns are data series with headers in the first row and numeric data below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="sr-only">Upload File</Label>
          <Input
            id="file-upload"
            type="file"
            accept=".csv" // Only accept .csv
            onChange={handleFileChange}
            disabled={isProcessing}
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
        </div>
        {currentDisplayedFileName && !isProcessing && validationSteps.length === 0 && <p className="text-sm text-muted-foreground">Selected: {currentDisplayedFileName}</p>}
        
        {validationSteps.length > 0 && (
          <div className="mt-4 space-y-2 border-t pt-4">
            {currentFileForValidation && <p className="text-sm font-medium mb-2">Validation for: <span className="font-semibold">{currentFileForValidation}</span></p>}
            <ul className="space-y-1">
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
          </div>
        )}

        {isProcessing && validationSteps.length === 0 && <p className="text-sm text-primary animate-pulse">Preparing for validation...</p>}
        
        <Button 
            onClick={handleClear} 
            variant="outline" 
            className="w-full" 
            disabled={isProcessing || !currentFileNameFromParent}
        >
          Clear Data & Chart
        </Button>
      </CardContent>
    </Card>
  );
}

    