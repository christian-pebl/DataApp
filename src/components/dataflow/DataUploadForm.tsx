
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
        if (jsonData.length > 0 && jsonData.every(item => typeof item.value === 'number')) {
             parsedResult = { data: jsonData, seriesNames: ["value"] };
        } else if (jsonData.length > 0) {
            const firstItemKeys = Object.keys(jsonData[0]).filter(k => k !== 'time' && typeof jsonData[0][k] === 'number');
            if (firstItemKeys.length > 0) {
                parsedResult = { data: jsonData, seriesNames: firstItemKeys };
            }
        }
      } else {
        toast({
          variant: "destructive",
          title: "Unsupported File Format",
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
          description += "Please ensure your CSV file has a header row, a 'time' column (or similar like 'date', 'timestamp') as the first column, and at least one other column with numerical data.";
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
          description: `${file.name} has been processed.`,
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
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const parseCsv = (csvText: string): { data: DataPoint[]; seriesNames: string[] } | null => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 2) return null; 

    const headers = lines[0].split(',').map(h => h.trim());
    const timeHeaderCandidates = ['time', 'date', 'timestamp'];
    const timeHeader = headers[0];
    // Not strictly enforcing 'time' to allow flexibility like 'Date' or 'Timestamp' for the first column.
    if (headers.length < 2) return null; 

    const seriesNames = headers.slice(1).filter(name => name); 
    if (seriesNames.length === 0) return null; 

    const data = lines.slice(1).map(line => {
      const values = line.split(',');
      const timeValue = values[0]?.trim();
      if (!timeValue) return null; 

      const dataPoint: DataPoint = { time: timeValue };
      let hasNumericValueInRow = false;
      seriesNames.forEach((seriesName, index) => {
        const rawValue = values[index + 1]?.trim();
        if (rawValue === undefined || rawValue === "") { 
            dataPoint[seriesName] = NaN; 
            return; 
        }
        const seriesValue = parseFloat(rawValue);
        if (!isNaN(seriesValue)) {
          dataPoint[seriesName] = seriesValue;
          hasNumericValueInRow = true;
        } else {
          dataPoint[seriesName] = NaN; 
        }
      });
      return hasNumericValueInRow ? dataPoint : null; 
    }).filter(item => item !== null) as DataPoint[];

    if (data.length === 0) return null;
    return { data, seriesNames };
  };

  const parseJson = (jsonText: string): DataPoint[] => { 
    const jsonData = JSON.parse(jsonText);
    if (!Array.isArray(jsonData)) {
      throw new Error("JSON data must be an array of objects.");
    }
    return jsonData.map((item: any) => {
      const time = item.time ?? item.timestamp ?? item.date;
      if (time === undefined) return null; 

      const dataPoint: DataPoint = { time: String(time) };
      let hasNumericValue = false;
      Object.keys(item).forEach(key => {
        if (key !== 'time' && key !== 'timestamp' && key !== 'date') {
          if (typeof item[key] === 'number' && !isNaN(item[key])) { 
            dataPoint[key] = item[key];
            hasNumericValue = true;
          } else if (typeof item[key] === 'string') { 
            const parsedNum = parseFloat(item[key]);
            if (!isNaN(parsedNum)) {
                dataPoint[key] = parsedNum;
                hasNumericValue = true;
            }
          }
        }
      });
      return hasNumericValue ? dataPoint : null; 
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
        <CardDescription>Upload a CSV or JSON file. For CSV, the first column should be 'time' (or similar like 'date', 'timestamp'), and subsequent columns are data series. JSON should be an array of objects with a 'time' key and numeric data keys.</CardDescription>
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
        {isProcessing && <p className="text-sm text-primary animate-pulse">Processing file...</p>}
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
