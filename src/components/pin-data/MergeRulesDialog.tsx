"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GitMerge, Layers, CheckCircle2, AlertCircle, FileText, Table2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ParsedFileData, FileValidationResult, MergeMode, MergedData } from "@/lib/multiFileValidator";
import { validateFilesCompatibility, mergeFiles } from "@/lib/multiFileValidator";

// Define merge rule properties
export interface MergeRuleProperties {
  mergeMode: MergeMode;
  timeRoundingInterval?: string;
  description: string;
}

// Define merge rule structure
export interface MergeRule {
  suffix: string;
  ruleName: string;
  description: string;
  enabled: boolean;
  properties: MergeRuleProperties;
}

// Default merge rules for common file patterns
export const DEFAULT_MERGE_RULES: MergeRule[] = [
  {
    suffix: "_24hr.csv",
    ruleName: "24hr_merge",
    description: "24-hour aggregated data - Stack parameters on common time axis (applies 24hr_style on plot)",
    enabled: true,
    properties: {
      mergeMode: "stack-parameters",
      timeRoundingInterval: "1hr",
      description: "Stacks parameters from multiple 24hr files using time values from the first file. If no time overlap exists, maps parameters by position to force 100% alignment. Automatically applies 24hr_style when plotted."
    }
  },
  {
    suffix: "_std.csv",
    ruleName: "std_stack",
    description: "Standard interval data - Stack parameters on common time axis",
    enabled: true,
    properties: {
      mergeMode: "stack-parameters",
      timeRoundingInterval: "10min",
      description: "Stacks all parameters from standard interval files on matching timestamps"
    }
  },
  {
    suffix: "_nmax.csv",
    ruleName: "nmax_merge",
    description: "Maximum values data - Sequential merge",
    enabled: true,
    properties: {
      mergeMode: "sequential",
      description: "Combines maximum value files sequentially"
    }
  },
];

interface MergeRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedFiles: ParsedFileData[];
  mergeRules: MergeRule[];
  onMergeRuleToggle: (suffix: string, enabled: boolean) => void;
  onConfirm: (mode: MergeMode) => void;
  onCancel: () => void;
}

export function MergeRulesDialog({
  open,
  onOpenChange,
  parsedFiles,
  mergeRules,
  onMergeRuleToggle,
  onConfirm,
  onCancel,
}: MergeRulesDialogProps) {
  // Detect which rule applies to these files
  const detectedRule = mergeRules.find(rule =>
    parsedFiles.some(file => file.fileName.endsWith(rule.suffix))
  );

  const [selectedMode, setSelectedMode] = useState<MergeMode>(
    detectedRule?.properties.mergeMode || 'sequential'
  );
  const [validation, setValidation] = useState<FileValidationResult>({
    isValid: true,
    errors: [],
    warnings: []
  });
  const [mergedPreview, setMergedPreview] = useState<MergedData | null>(null);

  // Re-validate and compute merge preview when mode changes
  useEffect(() => {
    const newValidation = validateFilesCompatibility(parsedFiles, selectedMode);
    setValidation(newValidation);

    // Compute merged preview (generate preview even with warnings, only skip on errors)
    if (parsedFiles.length > 0) {
      try {
        const merged = mergeFiles(parsedFiles, selectedMode);
        setMergedPreview(merged);
      } catch (error) {
        console.error('Failed to generate merge preview:', error);
        setMergedPreview(null);
      }
    } else {
      setMergedPreview(null);
    }
  }, [selectedMode, parsedFiles]);

  // Calculate expected output stats
  const totalRows = parsedFiles.reduce((sum, file) => sum + file.data.length, 0);
  const allHeaders = new Set<string>();
  parsedFiles.forEach(file => {
    file.headers.slice(1).forEach(header => allHeaders.add(header));
  });

  const expectedOutputRows = selectedMode === 'stack-parameters'
    ? (() => {
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

        const commonTimes = Array.from(fileMaps[0]).filter(time =>
          fileMaps.every(map => map.has(time))
        );

        return commonTimes.length;
      })()
    : totalRows;

  const expectedParameters = selectedMode === 'stack-parameters'
    ? parsedFiles.reduce((sum, file) => sum + (file.headers.length - 1), 0)
    : allHeaders.size;

  // Get applicable merge rules based on file names
  const applicableRules = mergeRules.filter(rule =>
    parsedFiles.some(file => file.fileName.endsWith(rule.suffix))
  );

  // Helper function to format cell values for display
  const formatCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Helper function to extract date portion from filename (e.g., ALGA_FPOD_C_S_2406_2407_24hr.csv -> 2406_2407)
  const extractDateFromFilename = (filename: string): string => {
    // Match pattern like 2406_2407 or 2410_2412, etc.
    const match = filename.match(/(\d{4}_\d{4})/);
    return match ? match[1] : filename.replace(/\.[^/.]+$/, ''); // fallback to filename without extension
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary" />
            <DialogTitle>Merge Rules</DialogTitle>
          </div>
          <DialogDescription>
            Configure merge rules for {parsedFiles.length} selected files. Rules are automatically detected based on file suffixes.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-4 pr-4">
            {/* Detected Rule Section */}
            {detectedRule && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Detected Rule: <Badge variant="secondary" className="ml-1">{detectedRule.ruleName}</Badge>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      {detectedRule.properties.description}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Merge Rules Table */}
            {applicableRules.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Applicable Merge Rules</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">File Suffix</TableHead>
                      <TableHead className="w-[120px]">Rule Name</TableHead>
                      <TableHead className="w-[80px] text-center">Enabled</TableHead>
                      <TableHead>Configuration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applicableRules.map((rule) => (
                      <TableRow key={rule.suffix}>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="font-mono text-xs">
                            {rule.suffix}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {rule.ruleName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center align-top">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(enabled) => {
                              onMergeRuleToggle(rule.suffix, enabled);
                              if (enabled && rule.properties.mergeMode) {
                                setSelectedMode(rule.properties.mergeMode);
                              }
                            }}
                            aria-label={`Toggle ${rule.ruleName}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-xs text-foreground">{rule.description}</p>
                            <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/30 p-2 rounded border">
                              <div className="flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                <span>
                                  <strong>Mode:</strong> {rule.properties.mergeMode === 'stack-parameters' ? 'Stack Parameters' : 'Sequential Merge'}
                                </span>
                              </div>
                              {rule.properties.timeRoundingInterval && (
                                <div className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>
                                    <strong>Time Rounding:</strong> {rule.properties.timeRoundingInterval}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* File Data Preview */}
            <div>
              <h3 className="text-xs font-semibold mb-1.5 flex items-center gap-2">
                <FileText className="h-3.5 w-3.5" />
                File Data Preview
              </h3>
              <div className="space-y-2">
                {parsedFiles.map((file, fileIndex) => {
                  const previewRows = file.data;
                  const displayHeaders = file.headers;

                  return (
                    <div key={fileIndex} className="border rounded overflow-hidden">
                      <div className="bg-muted/50 px-2 py-0.5 border-b">
                        <p className="text-[11px] font-medium font-mono">{file.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {file.data.length} rows × {file.headers.length} cols
                        </p>
                      </div>
                      <div className="w-full h-24 overflow-x-auto overflow-y-auto border-t">
                        <table className="border-collapse min-w-full">
                          <thead>
                            <tr className="border-b">
                              {displayHeaders.map((header, idx) => (
                                <th key={idx} className="text-[10px] font-mono px-1.5 py-1 max-w-[80px] break-words text-left sticky top-0 bg-muted z-10 border-r">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, rowIdx) => (
                              <tr key={rowIdx} className="border-b">
                                {displayHeaders.map((header, colIdx) => (
                                  <td key={colIdx} className="text-[10px] font-mono px-1.5 py-1 max-w-[80px] break-words border-r">
                                    {formatCellValue(row[header])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Merged Data Preview */}
            {mergedPreview && (
              <div>
                <h3 className="text-xs font-semibold mb-1.5 flex items-center gap-2">
                  <Table2 className="h-3.5 w-3.5" />
                  Merged Output Preview
                </h3>
                <div className="border rounded overflow-hidden">
                  <div className="bg-blue-50 dark:bg-blue-950/20 px-2 py-0.5 border-b border-blue-200 dark:border-blue-800">
                    <p className="text-[11px] font-medium">
                      Result: {mergedPreview.data.length} rows × {mergedPreview.headers.length} columns
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {selectedMode === 'sequential'
                        ? 'Blue line shows where files join'
                        : 'Blue line shows where new parameters begin'
                      }
                    </p>
                  </div>
                  <div className="w-full h-32 overflow-x-auto overflow-y-auto border-t">
                    <table className="border-collapse min-w-full">
                      <thead>
                        <tr>
                          {selectedMode === 'sequential' ? (
                            // Sequential mode: show all headers normally
                            mergedPreview.headers.map((header, idx) => {
                              // Extract date from header if it has square brackets
                              const displayHeader = header.includes('[')
                                ? header.replace(/\[([^\]]+)\]/, (match, filename) => `[${extractDateFromFilename(filename)}]`)
                                : header;
                              return (
                                <th key={idx} className="text-[10px] font-mono px-1.5 py-1 max-w-[80px] break-words text-left sticky top-0 bg-muted z-10 border-r">
                                  {displayHeader}
                                </th>
                              );
                            })
                          ) : (
                            // Stack mode: add visual separator after first file's columns
                            <>
                              {mergedPreview.headers.map((header, idx) => {
                                const firstFileParamCount = parsedFiles[0].headers.length - 1;
                                const isAfterFirstFile = idx > firstFileParamCount;
                                const isFirstOfSecondFile = idx === firstFileParamCount + 1;

                                // Extract date from header if it has square brackets
                                const displayHeader = header.includes('[')
                                  ? header.replace(/\[([^\]]+)\]/, (match, filename) => `[${extractDateFromFilename(filename)}]`)
                                  : header;

                                return (
                                  <th
                                    key={idx}
                                    className={`text-[10px] font-mono px-1.5 py-1 max-w-[80px] break-words text-left sticky top-0 z-10 border-r ${
                                      isFirstOfSecondFile ? 'border-l-2 border-l-blue-500 border-dashed' : ''
                                    } ${isAfterFirstFile ? 'bg-blue-50/50 dark:bg-blue-950/10' : 'bg-muted'}`}
                                  >
                                    {displayHeader}
                                  </th>
                                );
                              })}
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMode === 'sequential' ? (
                          // Sequential mode: highlight transition between files
                          <>
                            {mergedPreview.data.map((row, rowIdx) => {
                              // Calculate merge point (where first file ends)
                              const firstFileRowCount = parsedFiles[0].data.length;
                              const isTransitionRow = rowIdx === firstFileRowCount - 1;

                              return (
                                <React.Fragment key={rowIdx}>
                                  <tr className="border-b">
                                    {mergedPreview.headers.map((header, colIdx) => (
                                      <td key={colIdx} className="text-[10px] font-mono px-1.5 py-1 max-w-[80px] break-words border-r">
                                        {formatCellValue(row[header])}
                                      </td>
                                    ))}
                                  </tr>
                                  {isTransitionRow && (
                                    <tr>
                                      <td
                                        colSpan={mergedPreview.headers.length}
                                        className="p-0 border-t-2 border-t-blue-500 border-dashed"
                                      >
                                        <div className="bg-blue-100 dark:bg-blue-950/30 text-center py-0.5">
                                          <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                                            ↓ Files merged here ↓
                                          </p>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </>
                        ) : (
                          // Stack mode: highlight new parameter columns
                          mergedPreview.data.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b">
                              {mergedPreview.headers.map((header, colIdx) => {
                                const firstFileParamCount = parsedFiles[0].headers.length - 1;
                                const isAfterFirstFile = colIdx > firstFileParamCount;
                                const isFirstOfSecondFile = colIdx === firstFileParamCount + 1;

                                return (
                                  <td
                                    key={colIdx}
                                    className={`text-[10px] font-mono px-1.5 py-1 max-w-[80px] break-words border-r ${
                                      isFirstOfSecondFile ? 'border-l-2 border-l-blue-500 border-dashed' : ''
                                    } ${isAfterFirstFile ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}
                                  >
                                    {formatCellValue(row[header])}
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

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

          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 flex-row justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedMode)}
            disabled={!validation.isValid}
          >
            Confirm & Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
