"use client";

import React, { useState, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Settings2, BarChart, Loader2, AlertCircle, CheckCircle2, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseMultipleCSVFiles, type ParseResult, type ParsedDataPoint } from "./csvParser";
import { PinChartDisplay } from "./PinChartDisplay";

interface PinPlotInstanceProps {
  instanceId: string;
  initialPlotTitle: string;
  onRemovePlot: (id: string) => void;
  fileType: 'GP' | 'FPOD' | 'Subcam';
  files: File[];
}


export function PinPlotInstance({
  instanceId,
  initialPlotTitle,
  onRemovePlot,
  fileType,
  files
}: PinPlotInstanceProps) {
  const { toast } = useToast();
  const componentId = useId();
  
  // State
  const [plotTitle, setPlotTitle] = useState(initialPlotTitle);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Process CSV files on mount and when files change
  useEffect(() => {
    if (files.length > 0) {
      processCSVFiles(files);
    }
  }, [files]);

  const processCSVFiles = async (csvFiles: File[]) => {
    setIsProcessingFiles(true);
    setParseResult(null);
    
    try {
      const result = await parseMultipleCSVFiles(csvFiles, fileType);
      setParseResult(result);
      
      if (result.errors.length > 0) {
        toast({
          variant: result.data.length > 0 ? "default" : "destructive",
          title: result.data.length > 0 ? "Data Processed with Warnings" : "Processing Error",
          description: `${result.errors.length} issue${result.errors.length > 1 ? 's' : ''} found. ${result.data.length} valid data points loaded.`
        });
      } else {
        toast({
          title: "Data Processed Successfully",
          description: `Loaded ${result.data.length} data points from ${csvFiles.length} file${csvFiles.length > 1 ? 's' : ''}`
        });
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process CSV files';
      setParseResult({
        data: [],
        headers: [],
        errors: [errorMessage],
        summary: { totalRows: 0, validRows: 0, columns: 0, timeColumn: null }
      });
      toast({
        variant: "destructive",
        title: "Processing Error",
        description: errorMessage
      });
    } finally {
      setIsProcessingFiles(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-3">
        {isProcessingFiles ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Processing {fileType} files...</p>
            </div>
          </div>
        ) : parseResult ? (
          <div className="min-h-[300px]">
            <PinChartDisplay 
              data={parseResult.data}
              fileType={fileType}
              timeColumn={parseResult.summary.timeColumn}
              showYAxisLabels={true}
              fileName={files.length > 0 ? files[0].name : undefined}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-center">
            <div>
              <p className="text-xs text-muted-foreground">No data processed yet</p>
              <p className="text-xs text-muted-foreground opacity-70">Upload CSV files to begin</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}