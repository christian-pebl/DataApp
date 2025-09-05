"use client";

import React, { useState, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Settings2, BarChart, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
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
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <BarChart className="h-4 w-4 text-primary" />
            <Input
              value={plotTitle}
              onChange={(e) => setPlotTitle(e.target.value)}
              className="text-sm font-medium border-none p-0 h-auto bg-transparent focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                // Settings will be implemented in later steps
                toast({ title: "Settings", description: "Plot settings coming in next steps!" });
              }}
            >
              <Settings2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onRemovePlot(instanceId)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-xs text-muted-foreground">
          {fileType} Data • {files.length} file{files.length > 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-3">
        {isProcessingFiles ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Processing {fileType} files with advanced parser...</p>
            </div>
          </div>
        ) : parseResult ? (
          <div className="space-y-3">
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              {parseResult.errors.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : parseResult.data.length > 0 ? (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <p className="text-xs font-medium">
                {parseResult.errors.length === 0 ? 'Parsing Successful' : 
                 parseResult.data.length > 0 ? 'Parsing Complete with Warnings' : 
                 'Parsing Failed'}
              </p>
            </div>

            {/* Enhanced data summary */}
            <div className="bg-muted/30 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs font-medium">Data Summary</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Valid rows:</span>
                  <span className="ml-1 font-medium">{parseResult.summary.validRows}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total rows:</span>
                  <span className="ml-1 font-medium">{parseResult.summary.totalRows}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Columns:</span>
                  <span className="ml-1 font-medium">{parseResult.summary.columns}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Time column:</span>
                  <span className="ml-1 font-medium">{parseResult.summary.timeColumn || 'Auto-detected'}</span>
                </div>
              </div>

              {parseResult.headers.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Parameters detected:</p>
                  <p className="text-xs font-mono text-wrap">
                    {parseResult.headers.filter(h => h !== parseResult.summary.timeColumn).join(', ')}
                  </p>
                </div>
              )}
            </div>

            {/* Errors/Warnings */}
            {parseResult.errors.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2 border border-yellow-200 dark:border-yellow-800">
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Issues found ({parseResult.errors.length}):
                </p>
                <div className="max-h-20 overflow-y-auto">
                  {parseResult.errors.slice(0, 3).map((error, index) => (
                    <p key={index} className="text-xs text-yellow-700 dark:text-yellow-300">
                      • {error}
                    </p>
                  ))}
                  {parseResult.errors.length > 3 && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 italic">
                      ... and {parseResult.errors.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            )}
            
            {/* Interactive Chart Display */}
            <div className="border rounded bg-card/50 p-3">
              <PinChartDisplay 
                data={parseResult.data}
                fileType={fileType}
                timeColumn={parseResult.summary.timeColumn}
              />
            </div>
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