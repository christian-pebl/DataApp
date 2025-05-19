
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
  value: number;
  [key: string]: any; // Allow for additional properties if needed
}

interface DataUploadFormProps {
  onDataUploaded: (data: DataPoint[], fileName: string) => void;
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
      let parsedData: DataPoint[] = [];

      if (file.name.endsWith(".csv")) {
        parsedData = parseCsv(fileContent);
      } else if (file.name.endsWith(".json")) {
        parsedData = parseJson(fileContent);
      } else {
        toast({
          variant: "destructive",
          title: "Unsupported File Type",
          description: "Please upload a CSV or JSON file.",
        });
        setIsProcessing(false);
        return;
      }

      if (parsedData.length === 0) {
        toast({
          variant: "destructive",
          title: "Parsing Error",
          description: "Could not parse data or file is empty. Ensure 'time' and 'value' fields.",
        });
      } else {
        onDataUploaded(parsedData, file.name);
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
       // Reset file input to allow re-uploading the same file
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const parseCsv = (csvText: string): DataPoint[] => {
    const lines = csvText.trim().split(/\r\n|\n/);
    if (lines.length < 1) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const timeIndex = headers.findIndex(h => h.toLowerCase() === 'time' || h.toLowerCase() === 'timestamp' || h.toLowerCase() === 'date');
    const valueIndex = headers.findIndex(h => h.toLowerCase() === 'value');

    // If no headers or specific keys not found, assume first column is time, second is value
    const effectiveTimeIndex = timeIndex !== -1 ? timeIndex : 0;
    const effectiveValueIndex = valueIndex !== -1 ? valueIndex : 1;
    
    const dataStartIndex = (timeIndex !== -1 || valueIndex !== -1) ? 1 : 0; // Skip header row if headers were found

    return lines.slice(dataStartIndex).map(line => {
      const values = line.split(',');
      const time = values[effectiveTimeIndex]?.trim();
      const value = parseFloat(values[effectiveValueIndex]?.trim());
      if (time && !isNaN(value)) {
        return { time, value };
      }
      return null;
    }).filter(item => item !== null) as DataPoint[];
  };

  const parseJson = (jsonText: string): DataPoint[] => {
    const jsonData = JSON.parse(jsonText);
    if (!Array.isArray(jsonData)) {
      throw new Error("JSON data must be an array of objects.");
    }
    return jsonData.map((item: any) => {
      const time = item.time ?? item.timestamp ?? item.date;
      const value = item.value;
      if (time !== undefined && typeof value === 'number') {
        return { time: String(time), value };
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
        <CardDescription>Upload a CSV or JSON file with 'time' and 'value' columns/keys.</CardDescription>
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
        {fileName && <p className="text-sm text-muted-foreground">Loaded: {fileName}</p>}
        {isProcessing && <p className="text-sm text-accent">Processing...</p>}
        <Button onClick={handleClear} variant="outline" className="w-full" disabled={!fileName && !isProcessing}>
          Clear Data
        </Button>
      </CardContent>
    </Card>
  );
}
