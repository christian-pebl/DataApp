"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table as TableIcon, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchSpeciesAcrossFiles, mapCorrectionsToFiles } from "@/lib/species-validation-service";
import type { SpeciesMatch, SpeciesCorrection } from "@/lib/species-validation-service";
import type { HaplotypeParseResult } from "./csvParser";

// Types
export interface PresenceAbsenceRow {
  species: string;
  presence: Record<string, {
    status: 'present' | 'absent';
    isUnique?: boolean; // Only for 'present' status
    color: 'light-blue' | 'dark-blue' | 'white';
  }>;
}

export interface PresenceAbsenceResult {
  matrix: PresenceAbsenceRow[];
  corrections: SpeciesCorrection[];
  matches: SpeciesMatch[];
  totalSpecies: number;
  fileCount: number;
  selectedFiles: string[]; // Track which files were selected
}

interface FileWithData {
  fileName: string;
  parsedData: HaplotypeParseResult;
  selected: boolean; // Whether this file is selected for comparison
}

interface PresenceAbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableFiles: FileWithData[];
  onConfirm: (result: PresenceAbsenceResult) => void;
  onCancel: () => void;
}

export function PresenceAbsenceDialog({
  open,
  onOpenChange,
  availableFiles,
  onConfirm,
  onCancel
}: PresenceAbsenceDialogProps) {
  // State
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    matches: SpeciesMatch[];
    corrections: SpeciesCorrection[];
    uniqueSpecies: string[];
  } | null>(null);
  const [expandedLog, setExpandedLog] = useState(true);
  const [forceAiValidation, setForceAiValidation] = useState(false);

  // Initialize with all files selected by default
  useEffect(() => {
    if (open && availableFiles.length > 0) {
      const initialSelection = new Set(availableFiles.map(f => f.fileName));
      setSelectedFiles(initialSelection);
    }
  }, [open, availableFiles]);

  // Generate presence-absence data
  const presenceAbsenceData = useMemo(() => {
    if (!validationResult) return null;

    const matrix: PresenceAbsenceRow[] = [];
    const selectedFileNames = Array.from(selectedFiles);

    for (const species of validationResult.uniqueSpecies) {
      const row: PresenceAbsenceRow = {
        species: species,
        presence: {}
      };

      // Find the match for this species
      const match = validationResult.matches.find(m => m.standardizedName === species);

      for (const fileName of selectedFileNames) {
        if (match && match.filesWithMatch.includes(fileName)) {
          const isUnique = match.filesWithMatch.length === 1;
          row.presence[fileName] = {
            status: 'present',
            isUnique: isUnique,
            color: isUnique ? 'light-blue' : 'dark-blue'
          };
        } else {
          row.presence[fileName] = {
            status: 'absent',
            color: 'white'
          };
        }
      }

      matrix.push(row);
    }

    return matrix;
  }, [validationResult, selectedFiles]);

  // Run validation when files change
  useEffect(() => {
    if (selectedFiles.size >= 2 && open) {
      performValidation();
    } else {
      setValidationResult(null);
    }
  }, [selectedFiles, open, forceAiValidation]);

  const performValidation = async () => {
    setIsProcessing(true);

    try {
      const filesToValidate = availableFiles
        .filter(f => selectedFiles.has(f.fileName))
        .map(f => ({
          fileName: f.fileName,
          species: f.parsedData.species
        }));

      const result = await matchSpeciesAcrossFiles(filesToValidate, forceAiValidation);

      // Map corrections to specific files
      const mappedCorrections = mapCorrectionsToFiles(result.corrections, filesToValidate);

      setValidationResult({
        matches: result.matches,
        corrections: mappedCorrections,
        uniqueSpecies: result.uniqueSpecies
      });
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileToggle = (fileName: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileName)) {
      newSelection.delete(fileName);
    } else {
      newSelection.add(fileName);
    }
    setSelectedFiles(newSelection);
  };

  const handleConfirm = () => {
    if (!validationResult || !presenceAbsenceData) return;

    const result: PresenceAbsenceResult = {
      matrix: presenceAbsenceData,
      corrections: validationResult.corrections,
      matches: validationResult.matches,
      totalSpecies: validationResult.uniqueSpecies.length,
      fileCount: selectedFiles.size,
      selectedFiles: Array.from(selectedFiles)
    };

    onConfirm(result);
  };

  const handleCancel = () => {
    setValidationResult(null);
    setSelectedFiles(new Set());
    onCancel();
  };

  // Statistics
  const stats = useMemo(() => {
    if (!validationResult) return null;

    const uniqueToFiles: Record<string, number> = {};
    for (const fileName of Array.from(selectedFiles)) {
      uniqueToFiles[fileName] = 0;
    }

    let sharedSpecies = 0;

    for (const match of validationResult.matches) {
      const relevantFiles = match.filesWithMatch.filter(f => selectedFiles.has(f));
      if (relevantFiles.length === 1) {
        uniqueToFiles[relevantFiles[0]]++;
      } else if (relevantFiles.length > 1) {
        sharedSpecies++;
      }
    }

    return { uniqueToFiles, sharedSpecies };
  }, [validationResult, selectedFiles]);

  const canConfirm = selectedFiles.size >= 2 && validationResult && !isProcessing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - Non-scrollable */}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-purple-500" />
            Presence-Absence Table Preview
          </DialogTitle>
          <DialogDescription>
            Select files to compare and review species matching before creating the table
          </DialogDescription>
        </DialogHeader>

        {/* Status Banner */}
        {isProcessing && (
          <div className="flex-shrink-0 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Analyzing {selectedFiles.size} files and validating species names...
            </span>
          </div>
        )}

        {/* Main Content - Scrollable */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-4 pr-4">
            {/* File Selection Section */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-3">Select Files to Compare (minimum 2)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {availableFiles.map(file => (
                  <div
                    key={file.fileName}
                    className={cn(
                      "flex items-start gap-2 p-3 rounded-md border-2 transition-colors cursor-pointer",
                      selectedFiles.has(file.fileName)
                        ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    )}
                    onClick={() => handleFileToggle(file.fileName)}
                  >
                    <Checkbox
                      checked={selectedFiles.has(file.fileName)}
                      onCheckedChange={() => handleFileToggle(file.fileName)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label className="text-xs font-medium cursor-pointer break-words">
                        {file.fileName}
                      </Label>
                      <p className="text-[0.65rem] text-muted-foreground mt-1">
                        {file.parsedData.species.length} species
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedFiles.size < 2 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Please select at least 2 files to create a presence-absence table
                </p>
              )}
            </div>

            {/* Input Files Preview */}
            {selectedFiles.size >= 2 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">Input Files ({selectedFiles.size} files)</h3>
                <div className="space-y-3">
                  {availableFiles
                    .filter(f => selectedFiles.has(f.fileName))
                    .map(file => (
                      <div key={file.fileName} className="border rounded-md p-3 bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-medium">{file.fileName}</h4>
                          <span className="text-xs text-muted-foreground">
                            {file.parsedData.species.length} species × {file.parsedData.sites.length} sites
                          </span>
                        </div>
                        <div className="w-full h-24 border-t bg-background overflow-auto">
                          <table className="border-collapse text-[0.65rem]">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left px-2 py-1 font-medium sticky top-0 bg-muted whitespace-nowrap min-w-[120px] max-w-[180px]">Species</th>
                                {file.parsedData.sites.map((site, idx) => (
                                  <th key={idx} className="text-left px-2 py-1 font-medium sticky top-0 bg-muted whitespace-nowrap min-w-[80px] max-w-[120px]">
                                    {site}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {file.parsedData.species.slice(0, 10).map((species, idx) => (
                                <tr key={idx} className="border-b">
                                  <td className="px-2 py-1 font-mono whitespace-nowrap min-w-[120px] max-w-[180px] overflow-hidden text-ellipsis">{species}</td>
                                  {file.parsedData.sites.map((site, siteIdx) => {
                                    const cell = file.parsedData.data.find(
                                      d => d.species === species && d.site === site
                                    );
                                    return (
                                      <td key={siteIdx} className="px-2 py-1 text-center whitespace-nowrap min-w-[80px] max-w-[120px]">
                                        {cell?.count || 0}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              {file.parsedData.species.length > 10 && (
                                <tr>
                                  <td colSpan={file.parsedData.sites.length + 1} className="px-2 py-1 text-center text-muted-foreground">
                                    ... {file.parsedData.species.length - 10} more species
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Validation Log */}
            {validationResult && selectedFiles.size >= 2 && (
              <div className="border rounded-lg p-4">
                <button
                  onClick={() => setExpandedLog(!expandedLog)}
                  className="w-full flex items-center justify-between mb-2 hover:opacity-70"
                >
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {expandedLog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    Validation & Matching Log
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {validationResult.corrections.length} corrections, {stats?.sharedSpecies} shared species
                  </span>
                </button>

                {expandedLog && (
                  <div className="space-y-3 mt-3">
                    {/* Corrections */}
                    {validationResult.corrections.length > 0 ? (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                        <h4 className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Corrections Applied ({validationResult.corrections.length})
                        </h4>
                        <ul className="space-y-1 text-[0.7rem] text-green-600 dark:text-green-400">
                          {validationResult.corrections.slice(0, 10).map((correction, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span>•</span>
                              <span>
                                "{correction.original}" → "{correction.corrected}"
                                <span className="text-muted-foreground ml-1">
                                  ({correction.reason}, {correction.fileName})
                                </span>
                              </span>
                            </li>
                          ))}
                          {validationResult.corrections.length > 10 && (
                            <li className="text-muted-foreground">
                              ... and {validationResult.corrections.length - 10} more corrections
                            </li>
                          )}
                        </ul>
                      </div>
                    ) : (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                        <p className="text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          No corrections needed - all species names are valid
                        </p>
                      </div>
                    )}

                    {/* Species Statistics */}
                    {stats && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                          Species Distribution
                        </h4>
                        <ul className="space-y-1 text-[0.7rem] text-blue-600 dark:text-blue-400">
                          <li>• Shared across files: {stats.sharedSpecies} species</li>
                          {Object.entries(stats.uniqueToFiles).map(([fileName, count]) => (
                            <li key={fileName}>
                              • Unique to {fileName}: {count} species
                            </li>
                          ))}
                          <li className="font-medium mt-1 pt-1 border-t border-blue-200 dark:border-blue-800">
                            • Total unique species: {validationResult.uniqueSpecies.length}
                          </li>
                        </ul>
                      </div>
                    )}

                    {/* AI Validation Toggle */}
                    <div className="bg-muted/50 border rounded-md p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="force-ai"
                          checked={forceAiValidation}
                          onCheckedChange={(checked) => setForceAiValidation(checked as boolean)}
                        />
                        <Label htmlFor="force-ai" className="text-xs cursor-pointer">
                          Force AI validation for all species names (recommended for unfamiliar datasets)
                        </Label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Output Preview */}
            {presenceAbsenceData && selectedFiles.size >= 2 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-3">
                  Output Preview ({validationResult?.uniqueSpecies.length} species × {selectedFiles.size} files)
                </h3>
                <div className="w-full h-64 border rounded-md bg-background overflow-auto">
                  <table className="border-collapse text-[0.65rem]">
                    <thead>
                      <tr className="border-b sticky top-0 bg-muted z-10">
                        <th className="text-left px-2 py-2 font-medium border-r whitespace-nowrap min-w-[120px] max-w-[180px]">Species</th>
                        {Array.from(selectedFiles).map((fileName, idx) => {
                          // Parse filename: PROJECT_DATATYPE_STATION_DATERANGE_type.csv
                          // E.g., "ALGA_SUBCAM_F_I_2503_2504_nmax.csv"
                          const parts = fileName.replace(/\.(csv|CSV)$/, '').split('_');
                          let line1 = '';
                          let line2 = '';

                          if (parts.length >= 6) {
                            // Format: PROJECT_DATATYPE_STATION_DATERANGE
                            line1 = `${parts[0]}_${parts[1]}`;
                            line2 = parts.slice(2, -1).join('_');
                          } else if (parts.length >= 4) {
                            // Fallback: split in half
                            const midpoint = Math.ceil(parts.length / 2);
                            line1 = parts.slice(0, midpoint).join('_');
                            line2 = parts.slice(midpoint).join('_');
                          } else {
                            // Too short, just use filename
                            line1 = fileName;
                          }

                          return (
                            <th key={idx} className="text-center px-2 py-2 font-medium border-r min-w-[100px] max-w-[150px]" title={fileName}>
                              <div className="flex flex-col leading-tight">
                                <span className="font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{line1}</span>
                                {line2 && <span className="text-[0.6rem] whitespace-nowrap overflow-hidden text-ellipsis">{line2}</span>}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {presenceAbsenceData.slice(0, 20).map((row, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="px-2 py-1.5 font-mono border-r whitespace-nowrap min-w-[120px] max-w-[180px] overflow-hidden text-ellipsis" title={row.species}>{row.species}</td>
                          {Array.from(selectedFiles).map((fileName, fileIdx) => {
                            const presence = row.presence[fileName];
                            return (
                              <td
                                key={fileIdx}
                                className={cn(
                                  "px-2 py-1.5 text-center border-r whitespace-nowrap min-w-[100px] max-w-[150px]",
                                  presence.status === 'absent' && "bg-white dark:bg-background",
                                  presence.status === 'present' && presence.isUnique && "bg-blue-300 dark:bg-blue-800",
                                  presence.status === 'present' && !presence.isUnique && "bg-blue-600 dark:bg-blue-500"
                                )}
                                title={
                                  presence.status === 'present'
                                    ? presence.isUnique
                                      ? `${row.species} (unique to this file)`
                                      : `${row.species} (shared with other files)`
                                    : `${row.species} (not present)`
                                }
                              >
                                {presence.status === 'present' && (
                                  <CheckCircle2 className="w-3 h-3 mx-auto text-white" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {presenceAbsenceData.length > 20 && (
                        <tr>
                          <td colSpan={selectedFiles.size + 1} className="px-2 py-2 text-center text-muted-foreground">
                            ... {presenceAbsenceData.length - 20} more species
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="mt-3 flex items-center gap-4 text-[0.7rem] flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-blue-600 dark:bg-blue-500 rounded border"></div>
                    <span>Present in multiple files (shared)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-blue-300 dark:bg-blue-800 rounded border"></div>
                    <span>Present only in this file (unique)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 bg-white dark:bg-background rounded border"></div>
                    <span>Not present</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer - Non-scrollable */}
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          {validationResult && selectedFiles.size >= 2 && (
            <Button
              variant="outline"
              onClick={performValidation}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Re-validate'
              )}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <TableIcon className="w-4 h-4 mr-2" />
            Create Table
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
