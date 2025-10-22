"use client";
// Force reload - fixed FileIcon import
import React, { useState, useEffect, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Settings2, BarChart, Loader2, AlertCircle, CheckCircle2, Info, ChevronDown, ChevronUp, FileIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseMultipleCSVFiles, type ParseResult, type ParsedDataPoint } from "./csvParser";
import { PinChartDisplay } from "./PinChartDisplay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";

interface MergedFileMetadata {
  mergeMode: 'sequential' | 'stack-parameters';
  sourceFiles: string[];
  sourceFilesMetadata?: Record<string, any>;
  startDate?: Date | null;
  endDate?: Date | null;
  createdAt?: Date;
}

interface PinPlotInstanceProps {
  instanceId: string;
  initialPlotTitle: string;
  onRemovePlot?: (id: string) => void; // Optional - undefined means can't remove
  fileType: 'GP' | 'FPOD' | 'Subcam';
  files: File[];
  // Pre-parsed data for merged plots (bypasses CSV parsing)
  preParsedData?: ParseResult;
  // Merged file metadata (for displaying file info)
  mergedFileMetadata?: MergedFileMetadata;
  // Time synchronization props
  timeAxisMode?: 'separate' | 'common';
  globalTimeRange?: { min: Date | null; max: Date | null };
  globalBrushRange?: { startIndex: number; endIndex: number | undefined };
  onDataParsed?: (plotId: string, parseResult: ParseResult) => void;
  onBrushChange?: (brushData: { startIndex?: number; endIndex?: number }) => void;
  isLastPlot?: boolean;
  // Visibility tracking for merge feature
  onVisibilityChange?: (visibleParams: string[], paramColors: Record<string, string>) => void;
  // Pin ID for saving corrected files to database
  pinId?: string;
}


export function PinPlotInstance({
  instanceId,
  initialPlotTitle,
  onRemovePlot,
  fileType,
  files,
  preParsedData,
  mergedFileMetadata,
  timeAxisMode,
  globalTimeRange,
  globalBrushRange,
  onDataParsed,
  onBrushChange,
  isLastPlot,
  onVisibilityChange,
  pinId
}: PinPlotInstanceProps) {
  const { toast } = useToast();
  const componentId = useId();

  // State
  const [plotTitle, setPlotTitle] = useState(initialPlotTitle);
  const [isLoading, setIsLoading] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showMergeInfo, setShowMergeInfo] = useState(false);
  const [dateFormat, setDateFormat] = useState<'DD/MM/YYYY' | 'MM/DD/YYYY' | undefined>(undefined);

  // Handle pre-parsed data (for merged plots) or process CSV files
  useEffect(() => {
    console.log('[PLOT INSTANCE] useEffect triggered. dateFormat:', dateFormat, 'files:', files.length, 'preParsedData:', !!preParsedData);

    if (preParsedData) {
      // Use pre-parsed data directly (merged plot scenario)
      setParseResult(preParsedData);
      if (onDataParsed) {
        onDataParsed(instanceId, preParsedData);
      }
      setIsProcessingFiles(false);
    } else if (files.length > 0) {
      // Normal flow: process CSV files
      console.log('[PLOT INSTANCE] Calling processCSVFiles with format override:', dateFormat);
      processCSVFiles(files, dateFormat);
    }
  }, [files, preParsedData, instanceId, onDataParsed, dateFormat]);

  const processCSVFiles = async (csvFiles: File[], formatOverride?: 'DD/MM/YYYY' | 'MM/DD/YYYY') => {
    console.log('[PLOT INSTANCE] processCSVFiles called with formatOverride:', formatOverride);
    setIsProcessingFiles(true);
    setParseResult(null);

    try {
      const result = await parseMultipleCSVFiles(csvFiles, fileType, formatOverride);
      console.log('[PLOT INSTANCE] CSV parsed. First 3 timestamps:', result.data.slice(0, 3).map(d => d.time));
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

      {/* File Info button for merged files */}
      {mergedFileMetadata && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-10 h-6 w-6 z-10"
          onClick={() => setShowMergeInfo(true)}
          title="View merge info"
        >
          <FileIcon className="h-4 w-4 text-primary" />
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
              // Date format toggle (only for non-merged plots)
              currentDateFormat={dateFormat}
              onDateFormatChange={!preParsedData ? setDateFormat : undefined}
              // Raw files for viewing original CSV
              rawFiles={files.length > 0 ? files : undefined}
              // Pin ID for saving corrected files to database
              pinId={pinId}
              // Spot-sample data props (for CROP, CHEM, WQ, EDNA files)
              detectedSampleIdColumn={parseResult.detectedSampleIdColumn}
              headers={parseResult.headers}
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

      {/* Merge Info Dialog */}
      {mergedFileMetadata && (
        <Dialog open={showMergeInfo} onOpenChange={setShowMergeInfo}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Merged File Information</DialogTitle>
              <DialogDescription>
                Details about the source files used to create this merge
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Merge Mode */}
              <div>
                <h4 className="text-sm font-semibold mb-1">Merge Mode</h4>
                <p className="text-sm text-muted-foreground">
                  {mergedFileMetadata.mergeMode === 'sequential' ?
                    'Sequential (files combined one after another)' :
                    'Stack Parameters (parameters stacked side-by-side)'}
                </p>
              </div>

              {/* Date Range */}
              {(mergedFileMetadata.startDate || mergedFileMetadata.endDate) && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Date Range</h4>
                  <p className="text-sm text-muted-foreground">
                    {mergedFileMetadata.startDate && format(mergedFileMetadata.startDate, 'PPP')}
                    {mergedFileMetadata.startDate && mergedFileMetadata.endDate && ' → '}
                    {mergedFileMetadata.endDate && format(mergedFileMetadata.endDate, 'PPP')}
                  </p>
                </div>
              )}

              {/* Source Files */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Source Files ({mergedFileMetadata.sourceFiles.length})</h4>
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  <ul className="divide-y">
                    {mergedFileMetadata.sourceFiles.map((fileName, index) => (
                      <li key={index} className="p-2 text-sm hover:bg-accent/50">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">#{index + 1}</span>
                          <span>{fileName}</span>
                        </div>
                        {mergedFileMetadata.sourceFilesMetadata?.[fileName] && (
                          <div className="text-xs text-muted-foreground ml-8 mt-1">
                            {/* Display any additional metadata if available */}
                            {mergedFileMetadata.sourceFilesMetadata[fileName].rows &&
                              `${mergedFileMetadata.sourceFilesMetadata[fileName].rows} rows`}
                            {mergedFileMetadata.sourceFilesMetadata[fileName].columns &&
                              ` • ${mergedFileMetadata.sourceFilesMetadata[fileName].columns} columns`}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Created At */}
              {mergedFileMetadata.createdAt && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Created</h4>
                  <p className="text-sm text-muted-foreground">
                    {format(mergedFileMetadata.createdAt, 'PPP p')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setShowMergeInfo(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}