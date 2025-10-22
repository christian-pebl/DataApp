"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Database, FileText, MapPin, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinFile {
  id: string;
  pinId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Date;
  projectId: string;
}

interface FileOption {
  pinId: string;
  pinName: string;
  pinLocation?: { lat: number; lng: number };
  fileType: 'GP' | 'FPOD' | 'Subcam' | 'CROP' | 'CHEM' | 'CHEMSW' | 'CHEMWQ' | 'WQ' | 'MERGED';
  files: File[];
  fileName: string;
  metadata?: PinFile; // Include metadata for downloading
}

interface FileSelectorProps {
  availableFiles: FileOption[];
  onSelectFile: (option: FileOption) => void;
  onSelectMultipleFiles?: (options: FileOption[]) => void;
  onCancel: () => void;
  excludeFileNames?: string[]; // Files already in use
}

// Validation error types
interface ValidationError {
  type: 'suffix' | 'headers' | 'columns' | 'xaxis';
  message: string;
}

// Helper function to validate file compatibility
const validateFileCompatibility = (selectedFiles: FileOption[]): ValidationError | null => {
  if (selectedFiles.length < 2) return null;

  const firstFile = selectedFiles[0];

  // Check 1: Same suffix (file extension)
  const firstSuffix = firstFile.fileName.split('.').pop()?.toLowerCase();
  for (const file of selectedFiles) {
    const fileSuffix = file.fileName.split('.').pop()?.toLowerCase();
    if (fileSuffix !== firstSuffix) {
      return {
        type: 'suffix',
        message: `Files must have the same extension. Found: .${firstSuffix} and .${fileSuffix}`
      };
    }
  }

  // Additional validation would require parsing the actual file contents
  // For now, we'll do basic validation and leave detailed validation for when files are parsed

  return null; // Files are compatible
};

export function FileSelector({ availableFiles, onSelectFile, onSelectMultipleFiles, onCancel, excludeFileNames = [] }: FileSelectorProps) {
  const [mounted, setMounted] = React.useState(false);
  const [multiFileMode, setMultiFileMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  React.useEffect(() => {
    console.log('FileSelector mounting...', { availableFiles, excludeFileNames });
    setMounted(true);
    return () => {
      console.log('FileSelector unmounting...');
      setMounted(false);
    };
  }, []);

  // Reset selection when mode changes
  React.useEffect(() => {
    if (!multiFileMode) {
      setSelectedFiles(new Set());
      setValidationError(null);
    }
  }, [multiFileMode]);

  // Toggle file selection
  const toggleFileSelection = (fileName: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileName)) {
        newSet.delete(fileName);
      } else {
        newSet.add(fileName);
      }

      // Validate after selection changes
      if (newSet.size >= 2) {
        const selectedFileOptions = availableFiles.filter(f => newSet.has(f.fileName));
        const error = validateFileCompatibility(selectedFileOptions);
        setValidationError(error);
      } else {
        setValidationError(null);
      }

      return newSet;
    });
  };

  // Handle multi-file open
  const handleOpenMultiFile = () => {
    if (!onSelectMultipleFiles || selectedFiles.size < 2) return;

    const selectedFileOptions = availableFiles.filter(f => selectedFiles.has(f.fileName));
    const error = validateFileCompatibility(selectedFileOptions);

    if (error) {
      setValidationError(error);
      return;
    }

    onSelectMultipleFiles(selectedFileOptions);
  };

  // Group files by pin
  const groupedByPin = availableFiles.reduce((acc, option) => {
    const key = option.pinId;
    if (!acc[key]) {
      acc[key] = {
        pinId: option.pinId,
        pinName: option.pinName,
        pinLocation: option.pinLocation,
        files: []
      };
    }
    acc[key].files.push(option);
    return acc;
  }, {} as Record<string, { pinId: string; pinName: string; pinLocation?: { lat: number; lng: number }; files: FileOption[] }>);

  const pins = Object.values(groupedByPin);

  // Filter out already used files
  const availableOptions = availableFiles.filter(
    option => !excludeFileNames.includes(option.fileName)
  );

  if (!mounted) {
    console.log('FileSelector not mounted yet, returning null');
    return null;
  }

  console.log('FileSelector rendering portal content', {
    availableOptionsCount: availableOptions.length,
    availableOptions: availableOptions.map(o => ({ fileName: o.fileName, hasFiles: o.files.length > 0 })),
    excludeFileNames,
    documentBody: typeof document !== 'undefined' ? !!document.body : 'no document'
  });

  const modalContent = (
    <>
      {availableOptions.length === 0 ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto" onClick={onCancel}>
        <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No More Files Available</h3>
            <p className="text-sm text-muted-foreground mb-4">
              All data files have been added to plots already.
            </p>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Close
            </Button>
          </div>
        </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto" onClick={onCancel}>
      <div className="bg-background p-4 rounded-lg shadow-lg max-w-2xl w-full max-h-[70vh] flex flex-col pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold mb-1">Select Data File</h3>
              <p className="text-sm text-muted-foreground">
                {multiFileMode ? 'Select multiple files to merge into one plot' : 'Choose a file to add as a new plot'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="multi-file-toggle" className="text-sm font-medium cursor-pointer">
                Multi-file
              </Label>
              <Switch
                id="multi-file-toggle"
                checked={multiFileMode}
                onCheckedChange={setMultiFileMode}
              />
            </div>
          </div>

          {/* Validation Error Display */}
          {validationError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-2 text-xs text-destructive flex items-start gap-2 mb-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Validation Error:</strong> {validationError.message}
              </div>
            </div>
          )}

          {availableOptions.some(o => o.files.length === 0) && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-2 text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2">
              <Download className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <strong>Auto-download enabled:</strong> Files marked "Download & plot" will be automatically downloaded when you select them.
              </div>
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {pins.map((pin) => {
              const availablePinFiles = pin.files.filter(
                f => !excludeFileNames.includes(f.fileName)
              );

              if (availablePinFiles.length === 0) return null;

              return (
                <div key={pin.pinId} className="border rounded-lg p-3">
                  {/* Pin Header */}
                  <div className="flex items-start gap-2 mb-3 pb-2 border-b">
                    <MapPin className="h-4 w-4 mt-0.5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate">{pin.pinName}</h4>
                      {pin.pinLocation && (
                        <p className="text-xs text-muted-foreground">
                          {pin.pinLocation.lat.toFixed(4)}, {pin.pinLocation.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {availablePinFiles.length} file{availablePinFiles.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Files List */}
                  <div className="space-y-1">
                    {availablePinFiles.map((fileOption, idx) => {
                      const isCurrentlyShowing = excludeFileNames.includes(fileOption.fileName);
                      const hasFileLoaded = fileOption.files.length > 0;
                      const needsDownload = !hasFileLoaded && fileOption.metadata;
                      const isSelected = selectedFiles.has(fileOption.fileName);

                      if (multiFileMode) {
                        // Multi-file mode: show checkbox
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-md border transition-all",
                              isCurrentlyShowing
                                ? "bg-muted/50 opacity-60 cursor-not-allowed"
                                : isSelected
                                  ? "border-primary bg-primary/5"
                                  : "border-transparent hover:bg-accent/50"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => !isCurrentlyShowing && toggleFileSelection(fileOption.fileName)}
                              disabled={isCurrentlyShowing}
                              className="flex-shrink-0"
                            />
                            {needsDownload ? (
                              <Download className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium truncate", isCurrentlyShowing && "line-through")}>
                                {fileOption.fileName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {fileOption.fileType} • {hasFileLoaded ? `${fileOption.files.length} file${fileOption.files.length !== 1 ? 's' : ''}` : 'Download & plot'}
                                {isCurrentlyShowing && " • Currently showing"}
                              </p>
                            </div>
                            <span className={cn(
                              "text-xs font-semibold px-2 py-1 rounded flex-shrink-0",
                              fileOption.fileType === 'GP' && "bg-blue-500/10 text-blue-600",
                              fileOption.fileType === 'FPOD' && "bg-green-500/10 text-green-600",
                              fileOption.fileType === 'Subcam' && "bg-purple-500/10 text-purple-600",
                              fileOption.fileType === 'CROP' && "bg-emerald-500/10 text-emerald-600",
                              fileOption.fileType === 'CHEM' && "bg-orange-500/10 text-orange-600",
                              fileOption.fileType === 'CHEMSW' && "bg-amber-500/10 text-amber-600",
                              fileOption.fileType === 'CHEMWQ' && "bg-yellow-500/10 text-yellow-600",
                              fileOption.fileType === 'WQ' && "bg-cyan-500/10 text-cyan-600",
                              fileOption.fileType === 'MERGED' && "bg-pink-500/10 text-pink-600"
                            )}>
                              {fileOption.fileType}
                            </span>
                          </div>
                        );
                      }

                      // Single file mode: original button behavior
                      return (
                        <button
                          key={idx}
                          onClick={() => onSelectFile(fileOption)}
                          disabled={isCurrentlyShowing}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-md transition-all duration-200 text-left",
                            isCurrentlyShowing
                              ? "bg-muted/50 opacity-60 cursor-not-allowed border border-muted"
                              : "hover:bg-accent/80 hover:shadow-md hover:scale-[1.02] border border-transparent hover:border-primary/30 cursor-pointer active:scale-[0.98]"
                          )}
                          title={
                            isCurrentlyShowing
                              ? "This file is currently displayed"
                              : needsDownload
                                ? "Click to download and add this file as a new plot"
                                : "Click to add this file as a new plot"
                          }
                        >
                          {needsDownload ? (
                            <Download className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium truncate", isCurrentlyShowing && "line-through")}>
                              {fileOption.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {fileOption.fileType} • {hasFileLoaded ? `${fileOption.files.length} file${fileOption.files.length !== 1 ? 's' : ''}` : 'Download & plot'}
                              {isCurrentlyShowing && " • Currently showing"}
                            </p>
                          </div>
                          <span className={cn(
                            "text-xs font-semibold px-2 py-1 rounded",
                            fileOption.fileType === 'GP' && "bg-blue-500/10 text-blue-600",
                            fileOption.fileType === 'FPOD' && "bg-green-500/10 text-green-600",
                            fileOption.fileType === 'Subcam' && "bg-purple-500/10 text-purple-600",
                            fileOption.fileType === 'CROP' && "bg-emerald-500/10 text-emerald-600",
                            fileOption.fileType === 'CHEM' && "bg-orange-500/10 text-orange-600",
                            fileOption.fileType === 'CHEMSW' && "bg-amber-500/10 text-amber-600",
                            fileOption.fileType === 'CHEMWQ' && "bg-yellow-500/10 text-yellow-600",
                            fileOption.fileType === 'WQ' && "bg-cyan-500/10 text-cyan-600",
                            fileOption.fileType === 'MERGED' && "bg-pink-500/10 text-pink-600"
                          )}>
                            {fileOption.fileType}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center gap-2 mt-4 pt-4 border-t">
          {multiFileMode && (
            <div className="text-sm text-muted-foreground">
              {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
            </div>
          )}
          {!multiFileMode && <div />}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            {multiFileMode && (
              <Button
                size="sm"
                onClick={handleOpenMultiFile}
                disabled={selectedFiles.size < 2 || validationError !== null || !onSelectMultipleFiles}
              >
                Open Multi-file
              </Button>
            )}
          </div>
        </div>
      </div>
        </div>
      )}
    </>
  );

  return createPortal(modalContent, document.body);
}
