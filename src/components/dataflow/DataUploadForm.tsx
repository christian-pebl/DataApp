
"use client";

import type { ChangeEvent } from "react";
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataPoint {
  time: string | number;
  [key: string]: string | number; // Allows multiple data series
}

interface DataUploadFormProps {
  onDataUploaded: (data: DataPoint[], seriesNames: string[], fileName: string) => void;
  onClearData: () => void;
  currentFileNameFromParent?: string; // Added prop to get parent's current file name
}

export function DataUploadForm({ onDataUploaded, onClearData, currentFileNameFromParent }: DataUploadFormProps) {
  const [fileName, setFileName] = useState<string | null>(null); // Local fileName for immediate UI feedback
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      return;
    }

    setFileName(file.name); // Set local filename for display

    try {
      const fileContent = await file.text();
      let parsedResult: { data: DataPoint[]; seriesNames: string[] } | null = null;

      if (file.name.endsWith(".csv")) {
        parsedResult = parseCsv(fileContent);
      } else if (file.name.endsWith(".json")) {
        const jsonData = parseJson(fileContent);
        // Basic validation for JSON structure - assuming array of objects
        // Further validation if 'value' is the only series or if multiple series exist
        if (jsonData.length > 0 && jsonData.every(item => typeof item.value === 'number')) {
             parsedResult = { data: jsonData, seriesNames: ["value"] }; // Default series name "value"
        } else if (jsonData.length > 0) {
            // Attempt to find numeric series keys from the first item
            const firstItemKeys = Object.keys(jsonData[0]).filter(k => k !== 'time' && k !== 'timestamp' && k !== 'date' && typeof jsonData[0][k] === 'number');
            if (firstItemKeys.length > 0) {
                parsedResult = { data: jsonData, seriesNames: firstItemKeys };
            }
        }
      } else {
        toast({
          variant: "destructive",
          title: "Unsupported File Type",
          description: "Please upload a CSV (.csv) or JSON (.json) file.",
        });
        setFileName(null); 
        setIsProcessing(false);
        if (event.target) event.target.value = ""; 
        return;
      }

      if (!parsedResult || parsedResult.data.length === 0 || parsedResult.seriesNames.length === 0) {
        let description = "Could not parse data from the file. ";
        if (file.name.endsWith(".csv")) {
          description += "Please ensure your CSV file has a header row, with the first column being a time/date. Subsequent columns should contain numerical data. Columns should be separated by commas, tabs, or spaces. Numbers like '1,234.56' will be treated as '1234.56'.";
        } else if (file.name.endsWith(".json")) {
          description += "Please ensure your JSON file is an array of objects, where each object has a 'time' (or 'timestamp'/'date') field and at least one other field with numerical data.";
        } else {
          description += "The file might be empty, incorrectly formatted, or not contain any usable data series."
        }
        toast({
          variant: "destructive",
          title: "Data Parsing Error",
          description: description,
        });
        setFileName(null); 
      } else {
        onDataUploaded(parsedResult.data, parsedResult.seriesNames, file.name);
        toast({
          title: "File Uploaded Successfully",
          description: `${file.name} has been processed. Select a series to visualize!`,
        });
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        variant: "destructive",
        title: "File Processing Error",
        description: `An unexpected error occurred while trying to process the file: ${error instanceof Error ? error.message : String(error)}. Please check the file and try again.`,
      });
      setFileName(null); 
    } finally {
      setIsProcessing(false);
      // Reset file input so the same file can be re-uploaded if needed after an error
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const parseCsv = (csvText: string): { data: DataPoint[]; seriesNames: string[] } | null => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) return null; // Must have header and at least one data row

    // Regex to split by comma, semicolon, tab, or one or more spaces, trimming whitespace around delimiters
    const delimiterRegex = /\s*[,;\t]\s*|\s+/;

    const headers = lines[0].trim().split(delimiterRegex).map(h => h.trim()).filter(h => h); // Filter out empty headers
    
    if (headers.length < 2) return null; // Must have a time column and at least one data column

    const timeHeader = headers[0]; // Assume first column is time
    const seriesNames = headers.slice(1).filter(name => name); // Ensure series names are not empty
    if (seriesNames.length === 0) return null; // No valid data series found

    const data = lines.slice(1).map(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return null; // Skip empty lines

      const values = trimmedLine.split(delimiterRegex).map(v => v.trim());
      if (values.length < headers.length) { 
        // Handle potentially shorter lines by padding with NaN or similar, or skip
        // For now, let's skip if it doesn't at least have a time value
        if (!values[0]) return null;
      }

      const timeValue = values[0];
      if (!timeValue) return null;

      const dataPoint: DataPoint = { time: timeValue };
      let hasNumericValueInRow = false;

      seriesNames.forEach((seriesName, index) => {
        const headerIndex = headers.indexOf(seriesName); // Find original index of this seriesName in headers
        const rawValue = values[headerIndex]; // Use original header index to get value

        if (rawValue === undefined || rawValue === "") {
          dataPoint[seriesName] = NaN; // Handle missing values for a series
          return;
        }
        // Remove commas from numbers (e.g., "1,234.56" -> "1234.56") before parsing
        const cleanedValue = rawValue.replace(/,/g, '');
        const seriesValue = parseFloat(cleanedValue);

        if (!isNaN(seriesValue)) {
          dataPoint[seriesName] = seriesValue;
          hasNumericValueInRow = true;
        } else {
          dataPoint[seriesName] = NaN; // Store NaN if parsing fails for this specific value
        }
      });
      return hasNumericValueInRow ? dataPoint : null; // Only include rows with at least one valid number
    }).filter(item => item !== null) as DataPoint[];

    if (data.length === 0) return null;
    return { data, seriesNames };
  };


  const parseJson = (jsonText: string): DataPoint[] => { 
    // Basic JSON parsing, assumes an array of objects.
    // Each object should have a 'time' (or 'timestamp'/'date') key,
    // and other keys for data series with numerical values.
    const jsonData = JSON.parse(jsonText);
    if (!Array.isArray(jsonData)) {
      throw new Error("JSON data must be an array of objects.");
    }
    return jsonData.map((item: any) => {
      const time = item.time ?? item.timestamp ?? item.date;
      if (time === undefined) return null; // Skip items without a time key

      const dataPoint: DataPoint = { time: String(time) };
      let hasNumericValue = false;
      Object.keys(item).forEach(key => {
        if (key !== 'time' && key !== 'timestamp' && key !== 'date') {
          if (typeof item[key] === 'number' && !isNaN(item[key])) { // Ensure it's a valid number
            dataPoint[key] = item[key];
            hasNumericValue = true;
          } else if (typeof item[key] === 'string') { // Try to parse if it's a string
            const parsedNum = parseFloat(item[key].replace(/,/g, '')); // Also handle commas in JSON string numbers
            if (!isNaN(parsedNum)) {
                dataPoint[key] = parsedNum;
                hasNumericValue = true;
            }
          }
        }
      });
      return hasNumericValue ? dataPoint : null; // Only include if there's at least one numeric data point
    }).filter(item => item !== null) as DataPoint[];
  };
  
  const handleClear = () => {
    setFileName(null); // Clear local file name display
    onClearData(); // Call parent's clear function
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
        <CardDescription>Upload a CSV or JSON file. For CSV, the first column should be 'time' (or similar like 'date', 'timestamp'), and subsequent columns are data series (separated by comma, tab, or spaces). JSON should be an array of objects with a 'time' key and numeric data keys.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="sr-only">Upload File</Label>
          <Input
            id="file-upload"
            type="file"
            accept=".csv,.json"
            onChange={handleFileChange}
            disabled={isProcessing}
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
        </div>
        {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
        {isProcessing && <p className="text-sm text-primary animate-pulse">Parsing your data...</p>}
        <Button 
            onClick={handleClear} 
            variant="outline" 
            className="w-full" 
            disabled={isProcessing || !currentFileNameFromParent} // Use parent's file name status
        >
          Clear Data & Chart
        </Button>
      </CardContent>
    </Card>
  );
}

