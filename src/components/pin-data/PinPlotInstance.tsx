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
  onRemovePlot?: (id: string) => void; // Optional - undefined means can't remove
  fileType: 'GP' | 'FPOD' | 'Subcam';
  files: File[];
  // Pre-parsed data for merged plots (bypasses CSV parsing)
  preParsedData?: ParseResult;
  // Time synchronization props
  timeAxisMode?: 'separate' | 'common';
  globalTimeRange?: { min: Date | null; max: Date | null };
  globalBrushRange?: { startIndex: number; endIndex: number | undefined };
  onDataParsed?: (plotId: string, parseResult: ParseResult) => void;
  onBrushChange?: (brushData: { startIndex?: number; endIndex?: number }) => void;
  isLastPlot?: boolean;
  // Visibility tracking for merge feature
  onVisibilityChange?: (visibleParams: string[], paramColors: Record<string, string>) => void;
}


export function PinPlotInstance({
  instanceId,
  initialPlotTitle,
  onRemovePlot,
  fileType,
  files,
  preParsedData,
  timeAxisMode,
  globalTimeRange,
  globalBrushRange,
  onDataParsed,
  onBrushChange,
  isLastPlot,
  onVisibilityChange
}: PinPlotInstanceProps) {
  const { toast } = useToast();
  const componentId = useId();
  
  // State
  const [plotTitle, setPlotTitle] = useState(initialPlotTitle);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Handle pre-parsed data (for merged plots) or process CSV files
  useEffect(() => {
    if (preParsedData) {
      // Use pre-parsed data directly (merged plot scenario)
      setParseResult(preParsedData);
      if (onDataParsed) {
        onDataParsed(instanceId, preParsedData);
      }
      setIsProcessingFiles(false);
    } else if (files.length > 0) {
      // Normal flow: process CSV files
      processCSVFiles(files);
    }
  }, [files, preParsedData, instanceId, onDataParsed]);

  const processCSVFiles = async (csvFiles: File[]) => {
    setIsProcessingFiles(true);
    setParseResult(null);

    try {
      const result = await parseMultipleCSVFiles(csvFiles, fileType);
      setParseResult(result);

      // Notify parent of parsed data for synchronization
      if (onDataParsed) {
        onDataParsed(instanceId, result);
      }

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
    <Card className="shadow-sm relative">
      {/* Remove button - only show if onRemovePlot is provided */}
      {onRemovePlot && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 z-10"
          onClick={() => onRemovePlot(instanceId)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardContent className="p-3">
        {isProcessingFiles ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Processing {fileType} files...</p>
            </div>
          </div>
        ) : parseResult ? (
          <div className="min-h-[285px]">
            <PinChartDisplay
              data={parseResult.data}
              fileType={fileType}
              timeColumn={parseResult.summary.timeColumn}
              showYAxisLabels={true}
              fileName={files.length > 0 ? files[0].name : undefined}
              dataSource="csv"
              timeAxisMode={timeAxisMode}
              globalTimeRange={globalTimeRange}
              globalBrushRange={globalBrushRange}
              onBrushChange={onBrushChange}
              isLastPlot={isLastPlot}
              onVisibilityChange={onVisibilityChange}
              // Set defaults for merged plots (detected by preParsedData)
              defaultAxisMode={preParsedData ? 'multi' : 'single'}
              defaultParametersExpanded={preParsedData ? true : false}
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