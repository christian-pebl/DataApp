
"use client";

import type { ChangeEvent } from "react";
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { UploadCloud, Hourglass, CheckCircle2, XCircle } from "lucide-react"; // Removed ChevronDown, ChevronUp as Accordion handles it
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DataPoint {
  time: string | number;
  [key: string]: string | number;
}

interface DataUploadFormProps {
  onDataUploaded: (data: DataPoint[], seriesNames: string[], fileName: string, timeColumnName: string) => void;
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
  const [accordionValue, setAccordionValue] = useState<string>(""); 
  const { toast } = useToast();

  useEffect(() => {
    if (!isProcessing && validationSteps.length > 0) {
      const hasError = validationSteps.some(step => step.status === 'error');
      if (hasError) {
        setAccordionValue("validation-details"); 
      } else {
        // setAccordionValue(""); // Optionally close on success
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

  const parseAndValidateCsv = (csvText: string): { data: DataPoint[]; seriesNames: string[]; timeColumnName: string } | null => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) {
      updateStepStatus('headerParse', 'error', "CSV must have a header row and at least one data row.");
      return null;
    }
    updateStepStatus('headerParse', 'success', "Header row found.");

    const delimiterRegex = /\s*[,;\t]\s*|\s+/; // Handles comma, semicolon, tab, or space delimiters
    const originalHeaders = lines[0].trim().split(delimiterRegex).map(h => h.trim()); // Keep empty strings if they exist for indexing

    if (originalHeaders.length < 1 || !originalHeaders[0]?.trim()) {
      updateStepStatus('timeColumnCheck', 'error', "CSV header row is missing, empty, or first column (time/date) header is missing.");
      return null;
    }
    const timeColumnName = originalHeaders[0].trim();
    updateStepStatus('timeColumnCheck', 'success', `Time column identified: '${timeColumnName}'`);

    const variableHeaders = originalHeaders.slice(1); // All headers after the first (time) column

    if (variableHeaders.length === 0) {
      updateStepStatus('variableColumnCheck', 'error', "No data variable columns found after the first (time) column.");
      return null;
    }

    // Process variableHeaders to make them unique
    const processedSeriesNames: string[] = [];
    const usedNames = new Set<string>();
    variableHeaders.forEach(originalHeader => {
        let currentName = (originalHeader || "Unnamed Series").trim();
        if (!currentName) currentName = "Unnamed Series"; // Ensure it's not empty after trim

        if (!usedNames.has(currentName)) {
            processedSeriesNames.push(currentName);
            usedNames.add(currentName);
        } else {
            let count = 2;
            let newName = `${currentName} (${count})`;
            while (usedNames.has(newName)) {
                count++;
                newName = `${currentName} (${count})`;
            }
            processedSeriesNames.push(newName);
            usedNames.add(newName);
        }
    });
    updateStepStatus('variableColumnCheck', 'success', `Variable columns identified: ${processedSeriesNames.join(', ')} (duplicates renamed if any).`);


    const data: DataPoint[] = [];
    let someRowsHadNonNumericData = false;
    let validDataRowsCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const values = trimmedLine.split(delimiterRegex).map(v => v.trim());
      
      const timeValue = values[0];
      // Skip row if timeValue is missing and all other values are also missing/empty
      if (!timeValue && values.slice(1).every(v => !v || v.trim() === "")) { 
        continue;
      }
      // Skip completely blank rows (e.g. ",,,")
      if (!timeValue && values.length > 1 && values.slice(1).every(v => v === "")) continue; 


      const dataPoint: DataPoint = { time: timeValue || "N/A" }; 
      let hasNumericValueInRow = false;
      let rowHasParsingIssue = false;

      processedSeriesNames.forEach((uniqueSeriesName, idx) => {
        // idx is the index in processedSeriesNames, which corresponds to variableHeaders.
        // The actual column in the original CSV's `values` array is `idx + 1`.
        const csvColumnIndex = idx + 1;
        const rawValue = values[csvColumnIndex];

        if (rawValue === undefined || rawValue.trim() === "") {
          dataPoint[uniqueSeriesName] = NaN; 
          return;
        }
        const cleanedValue = rawValue.replace(/,/g, ''); 
        const seriesValue = parseFloat(cleanedValue);

        if (!isNaN(seriesValue)) {
          dataPoint[uniqueSeriesName] = seriesValue;
          hasNumericValueInRow = true;
        } else {
          dataPoint[uniqueSeriesName] = NaN; 
          someRowsHadNonNumericData = true;
          rowHasParsingIssue = true;
        }
      });
      
      // Add data point if it has at least one numeric value OR if time value exists and some other values are present
      if (hasNumericValueInRow || (timeValue && values.length > 1 && values.slice(1).some(v => v && v.trim() !== ""))) {
         data.push(dataPoint);
         if (!rowHasParsingIssue && hasNumericValueInRow) {
            validDataRowsCount++;
         }
      }
    }

    if (data.length === 0) {
      updateStepStatus('dataRowFormat', 'error', "No processable data rows found. Ensure variable columns contain numeric data and time values are present. Check for correct delimiter (comma, tab, or space).");
      return null;
    }
    
    let dataRowMessage = `Processed ${data.length} data rows. ${validDataRowsCount} rows are fully numeric.`;
    if (someRowsHadNonNumericData) {
      dataRowMessage += " Some non-numeric values encountered and treated as missing (NaN).";
      updateStepStatus('dataRowFormat', 'success', dataRowMessage); 
    } else {
      updateStepStatus('dataRowFormat', 'success', dataRowMessage);
    }
    
    updateStepStatus('dataReady', 'success', "Data is ready for visualization.");
    return { data, seriesNames: processedSeriesNames, timeColumnName };
  };

  const processFile = async (file: File): Promise<{ data: DataPoint[]; seriesNames: string[]; timeColumnName: string } | null> => {
    setValidationSteps(initialValidationSteps.map(step => ({...step, status: 'pending', message: undefined }))); 
    setCurrentFileForValidation(file.name);
    setAccordionValue(""); 
    updateStepStatus('fileSelection', 'success', `Selected: ${file.name}`);

    if (!file.name.endsWith(".csv")) {
      updateStepStatus('fileType', 'error', "Unsupported file type. Please select a .csv file and try again.");
      toast({ variant: "destructive", title: "Upload Failed", description: "Unsupported file type. Please select a .csv file and try again." });
      setAccordionValue("validation-details"); 
      return null;
    }
    updateStepStatus('fileType', 'success');

    let fileContent;
    try {
      fileContent = await file.text();
      updateStepStatus('fileRead', 'success');
    } catch (e) {
      updateStepStatus('fileRead', 'error', "Could not read file content. Please ensure the file is accessible and try again.");
      toast({ variant: "destructive", title: "File Read Error", description: "Could not read the file. Please try again." });
      setAccordionValue("validation-details"); 
      return null;
    }

    const result = parseAndValidateCsv(fileContent);
    if (!result) {
       toast({
         variant: "destructive",
         title: "CSV Data Validation Failed",
         description: "Please check the validation checklist above for details and ensure your CSV file meets the requirements. You can then try uploading again.",
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

    setCurrentDisplayedFileName(file.name); 

    const parsedResult = await processFile(file);

    if (parsedResult) {
        onDataUploaded(parsedResult.data, parsedResult.seriesNames, file.name, parsedResult.timeColumnName);
        toast({
          title: "File Uploaded Successfully",
          description: `${file.name} has been processed. Select a series to visualize!`,
        });
    } else {
      // If parsedResult is null, it means an error occurred and was handled by processFile
      // Ensure displayed file name is cleared if upload truly failed at a critical step like file type
      if (!file.name.endsWith(".csv")) {
         setCurrentDisplayedFileName(null); // Only clear if it's a definite non-starter like wrong type
      }
    }
    setIsProcessing(false);
    // Clear the file input so the same file can be re-uploaded if needed after an error
    if (event.target) {
      event.target.value = ""; 
    }
  };
  
  const handleClear = () => {
    setCurrentDisplayedFileName(null);
    onClearData();
    setValidationSteps([]); 
    setCurrentFileForValidation(null);
    setAccordionValue("");
    toast({
      title: "Data Cleared",
      description: "Chart data and uploaded file information have been cleared.",
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
      const lastSuccess = validationSteps.filter(step => step.status === 'success').pop();
      if (lastSuccess && lastSuccess.id === 'dataReady') return lastSuccess; 
      if (lastSuccess) return lastSuccess; 
    }
    return validationSteps[validationSteps.length -1]; 
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
          Upload a CSV file. The first column should be time/date. Subsequent columns are data series with headers in the first row and numeric data below. Delimiters can be comma, semicolon, tab, or space(s).
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
          Clear Data & Chart
        </Button>
      </CardContent>
    </Card>
  );
}
