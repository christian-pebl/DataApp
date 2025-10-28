"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, FileText, Table2, GitMerge, Layers } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ParsedFileData, FileValidationResult, MergeMode } from "@/lib/multiFileValidator";
import { validateFilesCompatibility } from "@/lib/multiFileValidator";

interface MultiFileConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedFiles: ParsedFileData[];
  validation: FileValidationResult;
  onConfirm: (mode: MergeMode) => void;
  onCancel: () => void;
}

export function MultiFileConfirmDialog({
  open,
  onOpenChange,
  parsedFiles,
  validation: initialValidation,
  onConfirm,
  onCancel,
}: MultiFileConfirmDialogProps) {
  // Merge mode state
  const [mergeMode, setMergeMode] = useState<MergeMode>('sequential');
  const [validation, setValidation] = useState<FileValidationResult>(initialValidation);

  // Re-validate when merge mode changes
  useEffect(() => {
    const newValidation = validateFilesCompatibility(parsedFiles, mergeMode);
    setValidation(newValidation);
  }, [mergeMode, parsedFiles]);

  // Calculate merged stats based on mode
  const totalRows = parsedFiles.reduce((sum, file) => sum + file.data.length, 0);
  const allHeaders = new Set<string>();
  parsedFiles.forEach(file => {
    file.headers.slice(1).forEach(header => allHeaders.add(header));
  });

  // Calculate expected output based on mode
  const expectedOutputRows = mergeMode === 'stack-parameters'
    ? (() => {
        // Calculate common time points
        const fileMaps = parsedFiles.map(file => {
          const times = new Set<string>();
          file.data.forEach(row => {
            const timeValue = row[file.timeColumn];
            if (timeValue) {
              times.add(new Date(timeValue).toISOString());
            }
          });
          return times;
        });

        // Find intersection
        const commonTimes = Array.from(fileMaps[0]).filter(time =>
          fileMaps.every(map => map.has(time))
        );

        return commonTimes.length;
      })()
    : totalRows; // Sequential mode preserves all rows

  const expectedParameters = mergeMode === 'stack-parameters'
    ? parsedFiles.reduce((sum, file) => sum + (file.headers.length - 1), 0) // All parameters stacked
    : allHeaders.size; // Sequential mode may deduplicate

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Confirm Multi-File Merge</DialogTitle>
          <DialogDescription>
            Select merge mode and review validation results before merging {parsedFiles.length} files
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-4">
            {/* Merge Mode Selector */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Merge Mode</h3>
              <RadioGroup value={mergeMode} onValueChange={(value) => setMergeMode(value as MergeMode)}>
                <div className="space-y-2">
                  {/* Sequential Merge */}
                  <div className="flex items-start space-x-2 border rounded-lg p-2 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="sequential" id="mode-sequential" className="mt-1" />
                    <Label htmlFor="mode-sequential" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-0.5">
                        <GitMerge className="h-4 w-4" />
                        <span className="font-medium text-sm">Sequential Merge</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Combines files along the time axis. Best for files covering different time periods with the same parameters.
                      </p>
                    </Label>
                  </div>

                  {/* Stack Parameters */}
                  <div className="flex items-start space-x-2 border rounded-lg p-2 hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="stack-parameters" id="mode-stack" className="mt-1" />
                    <Label htmlFor="mode-stack" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Layers className="h-4 w-4" />
                        <span className="font-medium text-sm">Stack Parameters</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Stacks all parameters from all files on a common time axis. Best for files with matching timestamps but different parameters.
                      </p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
            {/* Validation Status */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                {validation.isValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                Validation Status
              </h3>

              {validation.isValid ? (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-2 text-xs text-green-800 dark:text-green-200">
                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                  All validation checks passed. Files are compatible for merging.
                </div>
              ) : (
                <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 inline mr-1" />
                  Validation failed. Files cannot be merged.
                </div>
              )}

              {/* Validation Errors */}
              {validation.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-destructive">Errors:</p>
                  {validation.errors.map((error, index) => (
                    <div key={index} className="text-xs text-destructive bg-destructive/5 p-1.5 rounded">
                      • {error}
                    </div>
                  ))}
                </div>
              )}

              {/* Validation Warnings */}
              {validation.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-yellow-600 dark:text-yellow-500">Warnings:</p>
                  {validation.warnings.map((warning, index) => (
                    <div key={index} className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 p-1.5 rounded">
                      • {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* File Details */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Files to Merge
              </h3>
              <div className="space-y-2">
                {parsedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="bg-muted/30 border rounded-md p-2 text-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-mono font-medium text-xs mb-1">{file.fileName}</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">Rows:</span> {file.data.length}
                          </div>
                          <div>
                            <span className="font-medium">Columns:</span> {file.headers.length}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Time Column:</span> {file.timeColumn}
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium">Parameters:</span>{" "}
                            <span className="text-xs">
                              {file.headers.slice(1).join(", ")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 ml-2" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Merged Output Preview */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Table2 className="h-4 w-4" />
                Merged Output Preview
              </h3>
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-2">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Files:</span>
                    <span className="font-medium">{parsedFiles.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Rows:</span>
                    <span className="font-medium">{expectedOutputRows}</span>
                  </div>
                  {mergeMode === 'stack-parameters' && expectedOutputRows !== totalRows && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/30 p-1.5 rounded">
                      ℹ️ Only common time points ({expectedOutputRows} of {totalRows}) will be included
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Column:</span>
                    <span className="font-medium font-mono">{parsedFiles[0]?.timeColumn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Parameters:</span>
                    <span className="font-medium">{expectedParameters}</span>
                  </div>
                  <div className="pt-1 border-t mt-1">
                    <p className="text-xs text-muted-foreground mb-1">
                      {mergeMode === 'stack-parameters' ? 'All Parameters (with source labels):' : 'Merged Parameters:'}
                    </p>
                    <p className="text-xs font-mono bg-muted/50 p-1.5 rounded max-h-20 overflow-y-auto">
                      {mergeMode === 'stack-parameters'
                        ? parsedFiles.map((file, idx) => {
                            const sourceId = file.fileName.replace(/\.[^/.]+$/, '');
                            const params = file.headers.slice(1).map(h => `${h} [${sourceId}]`);
                            return params.join(", ");
                          }).join(", ")
                        : Array.from(allHeaders).join(", ")
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-muted/20 border rounded-md p-2 text-xs text-muted-foreground">
              <p className="font-medium mb-1">What will happen:</p>
              {mergeMode === 'sequential' ? (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Files will be combined along the time axis</li>
                  <li>All time points from all files will be preserved</li>
                  <li>Rows with duplicate parameters will be labeled with source file names</li>
                  <li>A single plot will be created with all data</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside space-y-0.5">
                  <li>All parameters from all files will be stacked on a common time axis</li>
                  <li>Only time points that exist in ALL files will be included</li>
                  <li>Each parameter will be labeled with its source file name</li>
                  <li>A single plot with {expectedParameters} parameters will be created</li>
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 flex-row justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(mergeMode)}
            disabled={!validation.isValid}
          >
            Confirm & Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
