'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataTimeline } from './DataTimeline';
import { type PinFile } from '@/lib/supabase/file-storage-service';
import { BarChart3, FileCode, Calendar, MapPin, ChevronDown, X } from 'lucide-react';

interface FileSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: (PinFile & { pinLabel: string })[];
  onFileSelected: (file: PinFile & { pinLabel: string }) => void;
  getFileDateRange: (file: PinFile) => Promise<{
    totalDays: number | null;
    startDate: string | null;
    endDate: string | null;
    uniqueDates?: string[];
    isCrop?: boolean;
    error?: string;
  }>;
  projectId?: string;
  excludeFileNames?: string[];
}

export function FileSelectionDialog({
  open,
  onOpenChange,
  files,
  onFileSelected,
  getFileDateRange,
  projectId,
  excludeFileNames = []
}: FileSelectionDialogProps) {
  // Filter state
  const [selectedPins, setSelectedPins] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSuffixes, setSelectedSuffixes] = useState<string[]>([]);
  const [selectedDateRanges, setSelectedDateRanges] = useState<string[]>([]);

  // Helper function to check if file matches a type
  const matchesType = (file: PinFile & { pinLabel: string }, type: string): boolean => {
    const fileName = file.fileName.toLowerCase();
    if (type === 'SubCam') return fileName.includes('subcam');
    if (type === 'GP') return fileName.includes('gp');
    if (type === 'FPOD') return fileName.includes('fpod');
    if (type === 'CROP') return fileName.includes('crop');
    if (type === 'CHEM') return fileName.includes('chem');
    if (type === 'WQ') return fileName.includes('wq');
    if (type === 'EDNA') return fileName.includes('edna');
    return false;
  };

  // Helper function to extract suffix from filename
  const extractSuffix = (fileName: string): string => {
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
    const parts = nameWithoutExt.split('_');
    return parts.length > 0 ? parts[parts.length - 1] : '';
  };

  // Helper function to extract date range from filename (format: YYMM_YYMM)
  const extractDateRange = (fileName: string): string | null => {
    const match = fileName.match(/(\d{4}_\d{4})/);
    return match ? match[1] : null;
  };

  // Filter out files that are already in use
  const availableFiles = useMemo(() => {
    return files.filter(file => !excludeFileNames.includes(file.fileName));
  }, [files, excludeFileNames]);

  // Apply filters
  const filteredFiles = useMemo(() => {
    return availableFiles.filter(file => {
      const pinMatch = selectedPins.length === 0 || selectedPins.includes(file.pinLabel);
      const typeMatch = selectedTypes.length === 0 || selectedTypes.some(type => matchesType(file, type));

      // Suffix filter
      const suffixMatch = selectedSuffixes.length === 0 || selectedSuffixes.some(suffix => {
        const fileSuffix = extractSuffix(file.fileName);
        return fileSuffix === suffix;
      });

      // Date range filter
      const dateRangeMatch = selectedDateRanges.length === 0 || selectedDateRanges.some(range => {
        const fileRange = extractDateRange(file.fileName);
        return fileRange === range;
      });

      return pinMatch && typeMatch && suffixMatch && dateRangeMatch;
    });
  }, [availableFiles, selectedPins, selectedTypes, selectedSuffixes, selectedDateRanges]);

  // Calculate unique filter options based on available files and other active filters
  const { uniquePins, uniqueTypes, uniqueSuffixes, uniqueDateRanges } = useMemo(() => {
    // For pins: show pins available after applying type, suffix, and dateRange filters
    const filesForPinOptions = availableFiles.filter(file => {
      const typeMatch = selectedTypes.length === 0 || selectedTypes.some(type => matchesType(file, type));
      const suffixMatch = selectedSuffixes.length === 0 || selectedSuffixes.some(suffix => {
        const fileSuffix = extractSuffix(file.fileName);
        return fileSuffix === suffix;
      });
      const dateRangeMatch = selectedDateRanges.length === 0 || selectedDateRanges.some(range => {
        const fileRange = extractDateRange(file.fileName);
        return fileRange === range;
      });
      return typeMatch && suffixMatch && dateRangeMatch;
    });
    const pins = Array.from(new Set(filesForPinOptions.map(file => file.pinLabel))).sort();

    // For types: show types available after applying pin, suffix, and dateRange filters
    const filesForTypeOptions = availableFiles.filter(file => {
      const pinMatch = selectedPins.length === 0 || selectedPins.includes(file.pinLabel);
      const suffixMatch = selectedSuffixes.length === 0 || selectedSuffixes.some(suffix => {
        const fileSuffix = extractSuffix(file.fileName);
        return fileSuffix === suffix;
      });
      const dateRangeMatch = selectedDateRanges.length === 0 || selectedDateRanges.some(range => {
        const fileRange = extractDateRange(file.fileName);
        return fileRange === range;
      });
      return pinMatch && suffixMatch && dateRangeMatch;
    });
    const typeMap = new Map<string, any[]>();
    filesForTypeOptions.forEach(file => {
      const fileName = file.fileName.toLowerCase();
      if (fileName.includes('subcam')) {
        if (!typeMap.has('SubCam')) typeMap.set('SubCam', []);
        typeMap.get('SubCam')!.push(file);
      }
      if (fileName.includes('gp')) {
        if (!typeMap.has('GP')) typeMap.set('GP', []);
        typeMap.get('GP')!.push(file);
      }
      if (fileName.includes('fpod')) {
        if (!typeMap.has('FPOD')) typeMap.set('FPOD', []);
        typeMap.get('FPOD')!.push(file);
      }
      if (fileName.includes('crop')) {
        if (!typeMap.has('CROP')) typeMap.set('CROP', []);
        typeMap.get('CROP')!.push(file);
      }
      if (fileName.includes('chem')) {
        if (!typeMap.has('CHEM')) typeMap.set('CHEM', []);
        typeMap.get('CHEM')!.push(file);
      }
      if (fileName.includes('wq')) {
        if (!typeMap.has('WQ')) typeMap.set('WQ', []);
        typeMap.get('WQ')!.push(file);
      }
    });
    const types = Array.from(typeMap.keys()).sort();

    // For suffixes: show suffixes available after applying pin, type, and dateRange filters
    const filesForSuffixOptions = availableFiles.filter(file => {
      const pinMatch = selectedPins.length === 0 || selectedPins.includes(file.pinLabel);
      const typeMatch = selectedTypes.length === 0 || selectedTypes.some(type => matchesType(file, type));
      const dateRangeMatch = selectedDateRanges.length === 0 || selectedDateRanges.some(range => {
        const fileRange = extractDateRange(file.fileName);
        return fileRange === range;
      });
      return pinMatch && typeMatch && dateRangeMatch;
    });
    const suffixes = Array.from(new Set(filesForSuffixOptions.map(file => {
      return extractSuffix(file.fileName);
    }).filter(suffix => suffix !== ''))).sort();

    // For date ranges: show date ranges available after applying pin, type, and suffix filters
    const filesForDateRangeOptions = availableFiles.filter(file => {
      const pinMatch = selectedPins.length === 0 || selectedPins.includes(file.pinLabel);
      const typeMatch = selectedTypes.length === 0 || selectedTypes.some(type => matchesType(file, type));
      const suffixMatch = selectedSuffixes.length === 0 || selectedSuffixes.some(suffix => {
        const fileSuffix = extractSuffix(file.fileName);
        return fileSuffix === suffix;
      });
      return pinMatch && typeMatch && suffixMatch;
    });
    const dateRanges = Array.from(new Set(filesForDateRangeOptions.map(file => {
      return extractDateRange(file.fileName);
    }).filter(range => range !== null))).sort() as string[];

    return {
      uniquePins: pins,
      uniqueTypes: types,
      uniqueSuffixes: suffixes,
      uniqueDateRanges: dateRanges
    };
  }, [availableFiles, selectedPins, selectedTypes, selectedSuffixes, selectedDateRanges]);

  const handleFileClick = (file: PinFile & { pinLabel: string }) => {
    onFileSelected(file);
    onOpenChange(false); // Close dialog after selection
  };

  const hasActiveFilters = selectedPins.length > 0 || selectedTypes.length > 0 || selectedSuffixes.length > 0 || selectedDateRanges.length > 0;

  const clearAllFilters = () => {
    setSelectedPins([]);
    setSelectedTypes([]);
    setSelectedSuffixes([]);
    setSelectedDateRanges([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle>Select File to Add to Plot</DialogTitle>
          <DialogDescription>
            Choose a file from your project to add as a new plot. Use filters below to narrow down your selection.
          </DialogDescription>
        </DialogHeader>

        {/* Filter Bar */}
        <div className="px-6 py-2 border-b bg-muted/10">
          <div className="flex items-center gap-3 flex-wrap text-[11px]">
            {/* File Count */}
            <div className="flex items-center gap-1">
              <span className="font-semibold">
                {hasActiveFilters ? `${filteredFiles.length}/${availableFiles.length}` : availableFiles.length}
              </span>
              <span className="text-muted-foreground">Files</span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="ml-1 text-primary hover:text-primary/80 flex items-center gap-0.5"
                  title="Clear all filters"
                >
                  <X className="h-3 w-3" />
                  <span className="text-[10px]">Clear</span>
                </button>
              )}
            </div>

            {/* Pins Filter */}
            {uniquePins.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors ${selectedPins.length > 0 ? 'bg-green-500/20 border border-green-500/50' : ''}`}>
                    <MapPin className="h-3 w-3 text-green-500" />
                    <span className="font-semibold">{selectedPins.length > 0 ? selectedPins.length : uniquePins.length}</span>
                    <span className="text-muted-foreground">Pins</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                      <span>Filter by Pin</span>
                      {selectedPins.length > 0 && (
                        <button
                          onClick={() => setSelectedPins([])}
                          className="text-primary hover:text-primary/80 text-[10px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {uniquePins.map(pin => (
                      <label key={pin} className="flex items-center gap-2 text-xs hover:bg-muted p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPins.includes(pin)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPins([...selectedPins, pin]);
                            } else {
                              setSelectedPins(selectedPins.filter(p => p !== pin));
                            }
                          }}
                          className="h-3 w-3"
                        />
                        <span>{pin}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* File Types Filter */}
            {uniqueTypes.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors ${selectedTypes.length > 0 ? 'bg-purple-500/20 border border-purple-500/50' : ''}`}>
                    <BarChart3 className="h-3 w-3 text-purple-500" />
                    <span className="font-semibold">{selectedTypes.length > 0 ? selectedTypes.length : uniqueTypes.length}</span>
                    <span className="text-muted-foreground">Types</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                      <span>Filter by Type</span>
                      {selectedTypes.length > 0 && (
                        <button
                          onClick={() => setSelectedTypes([])}
                          className="text-primary hover:text-primary/80 text-[10px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {uniqueTypes.map(type => (
                      <label key={type} className="flex items-center gap-2 text-xs hover:bg-muted p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTypes.includes(type)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTypes([...selectedTypes, type]);
                            } else {
                              setSelectedTypes(selectedTypes.filter(t => t !== type));
                            }
                          }}
                          className="h-3 w-3"
                        />
                        <span>{type}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Suffixes Filter */}
            {uniqueSuffixes.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors ${selectedSuffixes.length > 0 ? 'bg-amber-500/20 border border-amber-500/50' : ''}`}>
                    <FileCode className="h-3 w-3 text-amber-500" />
                    <span className="font-semibold">{selectedSuffixes.length > 0 ? selectedSuffixes.length : uniqueSuffixes.length}</span>
                    <span className="text-muted-foreground">Suffixes</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                      <span>Filter by Suffix</span>
                      {selectedSuffixes.length > 0 && (
                        <button
                          onClick={() => setSelectedSuffixes([])}
                          className="text-primary hover:text-primary/80 text-[10px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {uniqueSuffixes.map(suffix => (
                      <label key={suffix} className="flex items-center gap-2 text-xs hover:bg-muted p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSuffixes.includes(suffix)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSuffixes([...selectedSuffixes, suffix]);
                            } else {
                              setSelectedSuffixes(selectedSuffixes.filter(s => s !== suffix));
                            }
                          }}
                          className="h-3 w-3"
                        />
                        <span className="font-mono">{suffix}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Date Ranges Filter */}
            {uniqueDateRanges.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors ${selectedDateRanges.length > 0 ? 'bg-cyan-500/20 border border-cyan-500/50' : ''}`}>
                    <Calendar className="h-3 w-3 text-cyan-500" />
                    <span className="font-semibold">{selectedDateRanges.length > 0 ? selectedDateRanges.length : uniqueDateRanges.length}</span>
                    <span className="text-muted-foreground">Date Ranges</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold mb-2 flex items-center justify-between">
                      <span>Filter by Date Range</span>
                      {selectedDateRanges.length > 0 && (
                        <button
                          onClick={() => setSelectedDateRanges([])}
                          className="text-primary hover:text-primary/80 text-[10px]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {uniqueDateRanges.map(range => (
                      <label key={range} className="flex items-center gap-2 text-xs hover:bg-muted p-1 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedDateRanges.includes(range)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDateRanges([...selectedDateRanges, range]);
                            } else {
                              setSelectedDateRanges(selectedDateRanges.filter(r => r !== range));
                            }
                          }}
                          className="h-3 w-3"
                        />
                        <span className="font-mono">{range}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6">
          {filteredFiles.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">No files available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasActiveFilters
                    ? 'Try adjusting your filters or clear all filters to see more files.'
                    : 'All data files have been added to plots already.'}
                </p>
              </div>
            </div>
          ) : (
            <DataTimeline
              files={filteredFiles}
              getFileDateRange={getFileDateRange}
              onFileClick={handleFileClick}
              projectId={projectId}
              // Don't pass delete/rename handlers - this is selection mode only
              onDeleteFile={undefined}
              onRenameFile={undefined}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
