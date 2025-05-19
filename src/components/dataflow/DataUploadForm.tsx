
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
}

export function DataUploadForm({ onDataUploaded, onClearData }: DataUploadFormProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setIsProcessing(true);
    const file = event.target.files?.[0];
    if (!file) {
      setIsProcessing(false);
      return;
    }

    setFileName(file.name);

    try {
      const fileContent = await file.text();
      let parsedResult: { data: DataPoint[]; seriesNames: string[] } | null = null;

      if (file.name.endsWith(".csv")) {
        parsedResult = parseCsv(fileContent);
      } else if (file.name.endsWith(".json")) {
        // JSON parsing needs to be adapted if it's also meant to support multiple series
        // For now, assuming JSON provides a 'value' field or this needs specific handling
        const jsonData = parseJson(fileContent);
        if (jsonData.length > 0 && jsonData.every(item => typeof item.value === 'number')) {
             parsedResult = { data: jsonData, seriesNames: ["value"] };
        } else if (jsonData.length > 0) {
            // Attempt to find series from JSON if no 'value' key but other numeric keys
            const firstItemKeys = Object.keys(jsonData[0]).filter(k => k !== 'time' && typeof jsonData[0][k] === 'number');
            if (firstItemKeys.length > 0) {
                parsedResult = { data: jsonData, seriesNames: firstItemKeys };
            }
        }
      } else {
        toast({
          variant: "destructive",
          title: "Unsupported File Type",
          description: "Please upload a CSV or JSON file.",
        });
        setIsProcessing(false);
        return;
      }

      if (!parsedResult || parsedResult.data.length === 0 || parsedResult.seriesNames.length === 0) {
        toast({
          variant: "destructive",
          title: "Parsing Error",
          description: "Could not parse data, file is empty, or no valid data series found. Ensure CSV has headers and numeric data columns, or JSON has 'time' and numeric value fields.",
        });
      } else {
        onDataUploaded(parsedResult.data, parsedResult.seriesNames, file.name);
        toast({
          title: "File Uploaded",
          description: `${file.name} processed successfully.`,
        });
      }
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        variant: "destructive",
        title: "Processing Error",
        description: `An error occurred: ${error instanceof Error ? error.message : String(error)}`,
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
    if (lines.length < 2) return null; // Must have headers and at least one data row

    const headers = lines[0].split(',').map(h => h.trim());
    if (headers.length < 2) return null; // Must have at least a time column and one data column

    const timeHeader = headers[0];
    const seriesNames = headers.slice(1); // All other columns are data series

    const data = lines.slice(1).map(line => {
      const values = line.split(',');
      const timeValue = values[0]?.trim();
      if (!timeValue) return null;

      const dataPoint: DataPoint = { time: timeValue };
      let hasNumericValue = false;
      seriesNames.forEach((seriesName, index) => {
        const seriesValue = parseFloat(values[index + 1]?.trim());
        if (!isNaN(seriesValue)) {
          dataPoint[seriesName] = seriesValue;
          hasNumericValue = true;
        } else {
          dataPoint[seriesName] = NaN; // Or handle as needed, e.g., skip series or point
        }
      });
      return hasNumericValue ? dataPoint : null;
    }).filter(item => item !== null) as DataPoint[];

    if (data.length === 0) return null;
    return { data, seriesNames };
  };

  const parseJson = (jsonText: string): DataPoint[] => { // Keep original JSON parsing for simplicity, can be expanded
    const jsonData = JSON.parse(jsonText);
    if (!Array.isArray(jsonData)) {
      throw new Error("JSON data must be an array of objects.");
    }
    return jsonData.map((item: any) => {
      const time = item.time ?? item.timestamp ?? item.date;
      // Retain flexibility: if 'value' exists, use it. Otherwise, other numeric keys might be picked up by logic in handleFileChange.
      const dataPoint: DataPoint = { time: String(time) };
      Object.keys(item).forEach(key => {
        if (key !== 'time' && key !== 'timestamp' && key !== 'date') {
          if (typeof item[key] === 'number') {
            dataPoint[key] = item[key];
          }
        }
      });
      if (time !== undefined && Object.keys(dataPoint).some(k => k !== 'time' && typeof dataPoint[k] === 'number')) {
        return dataPoint;
      }
      return null;
    }).filter(item => item !== null) as DataPoint[];
  };
  
  const handleClear = () => {
    setFileName(null);
    onClearData();
    toast({
      title: "Data Cleared",
      description: "Chart data has been cleared.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-6 w-6 text-primary" />
          Import Data
        </CardTitle>
        <CardDescription>Upload a CSV file. First column is 'time', subsequent columns are data series.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="file-upload" className="sr-only">Upload File</Label>
          <Input
            id="file-upload"
            type="file"
            accept=".csv,.json" // Keeping JSON for now, though primary focus is CSV
            onChange={handleFileChange}
            disabled={isProcessing}
            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
        </div>
        {fileName && <p className="text-sm text-muted-foreground">Loaded: {fileName}</p>}
        {isProcessing && <p className="text-sm text-accent">Processing...</p>}
        <Button onClick={handleClear} variant="outline" className="w-full" disabled={!fileName && !isProcessing}>
          Clear Data
        </Button>
      </CardContent>
    </Card>
  );
}
