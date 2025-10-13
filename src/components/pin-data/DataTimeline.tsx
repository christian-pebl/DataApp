'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, differenceInDays, parseISO, isValid, getYear } from 'date-fns';
import { Info, Calendar, BarChart3, Trash2, Check, X, PlayCircle, ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type PinFile } from '@/lib/supabase/file-storage-service';

interface DataTimelineProps {
  files: (PinFile & { pinLabel: string })[];
  getFileDateRange: (file: PinFile) => Promise<{
    totalDays: number | null;
    startDate: string | null;
    endDate: string | null;
    error?: string;
  }>;
  onFileClick: (file: PinFile & { pinLabel: string }) => void;
  onDeleteFile?: (file: PinFile & { pinLabel: string }) => void;
}

interface FileWithDateRange {
  file: PinFile & { pinLabel: string };
  dateRange: {
    totalDays: number | null;
    startDate: string | null;
    endDate: string | null;
    error?: string;
    loading: boolean;
  };
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

// Shimmer loading component
const Shimmer = ({ className }: { className?: string }) => (
  <div className={`animate-shimmer bg-gradient-to-r from-muted/50 via-muted/80 to-muted/50 bg-[length:200%_100%] rounded ${className}`} />
);

// Skeleton row component for smooth loading
const SkeletonTableRow = ({ index }: { index: number }) => (
  <div 
    className="grid grid-cols-12 gap-2 py-1.5 text-xs opacity-0 animate-[fadeIn_0.3s_ease-in-out_forwards]"
    style={{ animationDelay: `${index * 50}ms` }}
  >
    {/* Pin indicator skeleton */}
    <div className="col-span-1 flex items-center">
      <Shimmer className="w-3 h-3" />
    </div>
    
    {/* File name skeleton */}
    <div className="col-span-4 flex items-center">
      <Shimmer className="h-4 w-full max-w-[200px]" />
    </div>
    
    {/* Date/Duration section skeleton */}
    <div className="col-span-5 grid grid-cols-3 gap-1 bg-muted/5 px-2 py-1 rounded-sm">
      <div className="flex items-center justify-center">
        <Shimmer className="h-3 w-16" />
      </div>
      <div className="flex items-center justify-center">
        <Shimmer className="h-3 w-16" />
      </div>
      <div className="flex items-center justify-center">
        <Shimmer className="h-4 w-12" />
      </div>
    </div>
    
    {/* Info button skeleton */}
    <div className="col-span-2 flex items-center justify-end">
      <Shimmer className="h-4 w-4" />
    </div>
  </div>
);

// Helper function to parse various date formats to proper Date
const parseCustomDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  
  // Handle DD/MM/YYYY format (from CSV files)
  const slashParts = dateString.split('/');
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    // Now using full 4-digit year format (DD/MM/YYYY)
    const standardFormat = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = parseISO(standardFormat);
    return isValid(parsed) ? parsed : null;
  }
  
  // Handle yyyy-dd-mm format by converting to yyyy-mm-dd
  const dashParts = dateString.split('-');
  if (dashParts.length === 3) {
    const [year, day, month] = dashParts;
    const standardFormat = `${year}-${month}-${day}`;
    const parsed = parseISO(standardFormat);
    return isValid(parsed) ? parsed : null;
  }
  
  // Try standard parsing as fallback
  const standardParsed = parseISO(dateString);
  return isValid(standardParsed) ? standardParsed : null;
};

// Helper function to calculate correct duration from corrected dates
const getCorrectDuration = (startDateString: string | null, endDateString: string | null): number | null => {
  if (!startDateString || !endDateString) return null;
  
  const startDate = parseCustomDate(startDateString);
  const endDate = parseCustomDate(endDateString);
  
  if (!startDate || !endDate) return null;
  
  return differenceInDays(endDate, startDate) + 1;
};

export function DataTimeline({ files, getFileDateRange, onFileClick, onDeleteFile }: DataTimelineProps) {
  const [filesWithDates, setFilesWithDates] = useState<FileWithDateRange[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<{ id: string; name: string } | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>('asc'); // Start with alphabetical (asc)

  // Delete file handler - just call parent's onDeleteFile
  const handleDeleteFile = async (file: PinFile & { pinLabel: string }) => {
    if (onDeleteFile) {
      onDeleteFile(file);
    }
  };

  // Toggle sort order handler
  const toggleSortOrder = () => {
    setSortOrder(current => {
      if (current === 'asc') return 'desc';
      if (current === 'desc') return null;
      return 'asc';
    });
  };

  // Apply sorting to filesWithDates
  const sortedFilesWithDates = useMemo(() => {
    if (!sortOrder) return filesWithDates;

    return [...filesWithDates].sort((a, b) => {
      const nameA = a.file.fileName;
      const nameB = b.file.fileName;

      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });
  }, [filesWithDates, sortOrder]);

  // Helper function to extract prefix from pin label
  const getPinPrefix = (pinLabel: string): string => {
    // Match patterns like "GP", "GP-Pel", "SubCam", etc.
    // Extract the first part before any underscore or dash followed by specific identifiers
    const match = pinLabel.match(/^([A-Za-z]+(?:-[A-Za-z]+)?)/);
    return match ? match[1] : pinLabel;
  };

  // Create pin-based color mapping grouped by prefix
  const pinColorMap = useMemo(() => {
    // First, group pins by their prefix
    const prefixGroups = new Map<string, string[]>();
    files.forEach(f => {
      const prefix = getPinPrefix(f.pinLabel);
      if (!prefixGroups.has(prefix)) {
        prefixGroups.set(prefix, []);
      }
      prefixGroups.get(prefix)!.push(f.pinLabel);
    });

    // Assign colors to prefixes
    const prefixColorMap = new Map<string, string>();
    Array.from(prefixGroups.keys()).forEach((prefix, index) => {
      prefixColorMap.set(prefix, COLORS[index % COLORS.length]);
    });

    // Map each pin label to its prefix color
    const colorMap = new Map<string, string>();
    files.forEach(f => {
      const prefix = getPinPrefix(f.pinLabel);
      const color = prefixColorMap.get(prefix) || COLORS[0];
      colorMap.set(f.pinLabel, color);
    });

    return colorMap;
  }, [files]);

  // Initialize files without date analysis
  useEffect(() => {
    if (files.length === 0) {
      setFilesWithDates([]);
      return;
    }

    // Sort files alphabetically by fileName
    const sortedFiles = [...files].sort((a, b) =>
      a.fileName.localeCompare(b.fileName)
    );

    // Initialize all files without date range data
    const initialFiles = sortedFiles.map(file => ({
      file,
      dateRange: {
        totalDays: null,
        startDate: null,
        endDate: null,
        loading: false
      }
    }));
    setFilesWithDates(initialFiles);
    setHasAnalyzed(false);
    setAnalysisLog([]);
  }, [files]);

  // Function to start date analysis
  const startDateAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisLog([]);

    const results: FileWithDateRange[] = [];
    let completedCount = 0;

    // Process files sequentially for smooth progress updates
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Add log entry for current file
      setAnalysisLog(prev => [...prev, `${completedCount + 1}/${files.length} files read`]);
      
      try {
        const result = await getFileDateRange(file);
        results.push({
          file,
          dateRange: { ...result, loading: false }
        });
      } catch (error) {
        results.push({
          file,
          dateRange: {
            totalDays: null,
            startDate: null,
            endDate: null,
            error: error instanceof Error ? error.message : 'Analysis failed',
            loading: false
          }
        });
      }
      
      completedCount++;
      const progress = (completedCount / files.length) * 100;
      setAnalysisProgress(progress);
      
      // Update files with current progress
      setFilesWithDates(prevFiles => {
        const updated = [...prevFiles];
        updated[i] = results[i];
        return updated;
      });
      
      // Small delay to make progress visible
      if (completedCount < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    setIsAnalyzing(false);
    setHasAnalyzed(true);
    setAnalysisLog(prev => [...prev, `Analysis complete - ${completedCount}/${files.length} files processed`]);
  };

  // Calculate timeline bounds and headers
  const timelineData = useMemo(() => {
    const validFiles = filesWithDates.filter(
      ({ dateRange }) => 
        !dateRange.loading && 
        !dateRange.error && 
        dateRange.startDate && 
        dateRange.endDate
    );

    if (validFiles.length === 0) {
      return { months: [], years: [], minDate: null, maxDate: null, totalDays: 0 };
    }

    // Find the earliest and latest dates using custom parser
    const startDates = validFiles.map(({ dateRange }) => parseCustomDate(dateRange.startDate!)).filter(date => date !== null) as Date[];
    const endDates = validFiles.map(({ dateRange }) => parseCustomDate(dateRange.endDate!)).filter(date => date !== null) as Date[];

    if (startDates.length === 0 || endDates.length === 0) {
      return { months: [], years: [], minDate: null, maxDate: null, totalDays: 0 };
    }

    const minDate = new Date(Math.min(...startDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...endDates.map(d => d.getTime())));

    // Find all unique months that contain data
    const dataMonthsSet = new Set<string>();
    validFiles.forEach(({ dateRange }) => {
      const start = parseCustomDate(dateRange.startDate!);
      const end = parseCustomDate(dateRange.endDate!);
      if (start && end) {
        // Add all months between start and end for this file
        const fileMonths = eachMonthOfInterval({ start: startOfMonth(start), end: endOfMonth(end) });
        fileMonths.forEach(month => {
          dataMonthsSet.add(format(month, 'yyyy-MM'));
        });
      }
    });

    // Convert back to Date objects and sort
    const months = Array.from(dataMonthsSet)
      .sort()
      .map(monthStr => parseISO(monthStr + '-01'));

    // Generate year headers based on actual data months
    const years: Array<{year: number, startMonth: number, monthCount: number}> = [];
    if (months.length > 0) {
      let currentYear = getYear(months[0]);
      let startMonth = 0;
      let monthCount = 0;

      months.forEach((month, index) => {
        const monthYear = getYear(month);
        if (monthYear === currentYear) {
          monthCount++;
        } else {
          years.push({ year: currentYear, startMonth, monthCount });
          currentYear = monthYear;
          startMonth = index;
          monthCount = 1;
        }
      });
      // Add the last year
      if (monthCount > 0) {
        years.push({ year: currentYear, startMonth, monthCount });
      }
    }

    const totalDays = differenceInDays(maxDate, minDate) + 1;

    return { months, years, minDate, maxDate, totalDays };
  }, [filesWithDates]);

  // Calculate bar positions and widths
  const calculateBarMetrics = (file: FileWithDateRange) => {
    if (!timelineData.minDate || !timelineData.totalDays || 
        !file.dateRange.startDate || !file.dateRange.endDate) {
      return { left: 0, width: 0 };
    }

    const startDate = parseCustomDate(file.dateRange.startDate);
    const endDate = parseCustomDate(file.dateRange.endDate);

    if (!startDate || !endDate) {
      console.warn(`Invalid dates for ${file.file.fileName}:`, {
        startDate: file.dateRange.startDate,
        endDate: file.dateRange.endDate
      });
      return { left: 0, width: 0 };
    }

    const daysFromStart = differenceInDays(startDate, timelineData.minDate);
    const barDuration = differenceInDays(endDate, startDate) + 1;

    const left = Math.max(0, (daysFromStart / timelineData.totalDays) * 100);
    const width = Math.max(0.1, (barDuration / timelineData.totalDays) * 100);

    return { left, width };
  };

  if (filesWithDates.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        No data files to display
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Project Data Files</h3>
        
        {/* Fetch Button - Top Right */}
        {!hasAnalyzed && !isAnalyzing && (
          <Button 
            onClick={startDateAnalysis}
            className="gap-2"
            size="sm"
          >
            <PlayCircle className="h-3 w-3" />
            Fetch Start and End Dates
          </Button>
        )}
        
        {/* View Mode Toggle - Only show when analysis is complete */}
        {hasAnalyzed && (
          <div className="flex items-center gap-1 bg-muted/50 rounded p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2"
              onClick={() => setViewMode('table')}
            >
              <Calendar className="h-3 w-3 mr-1" />
              <span className="text-xs">Table</span>
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              className="h-6 px-2"
              onClick={() => setViewMode('timeline')}
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              <span className="text-xs">Timeline</span>
            </Button>
          </div>
        )}
      </div>

      {/* File List Section - Only visible before analysis */}
      {!hasAnalyzed && (
        <div className="space-y-1">
          {sortedFilesWithDates.length > 0 && (
          <div className="bg-muted/20 rounded p-3">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b border-border/30 text-xs font-medium text-muted-foreground">
              <div className="col-span-1">Pin</div>
              <div className="col-span-6">File Name</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-3">Actions</div>
            </div>
            
            {/* File List */}
            <div className="space-y-0.5">
              {sortedFilesWithDates.map((fileWithDate, index) => {
                const { file } = fileWithDate;
                const color = pinColorMap.get(file.pinLabel) || COLORS[0];
                
                return (
                  <div 
                    key={`file-${file.id}-${index}`} 
                    className="grid grid-cols-12 gap-2 py-1.5 text-xs hover:bg-muted/30 rounded transition-colors"
                  >
                    {/* Pin indicator */}
                    <div className="col-span-1 flex items-center">
                      <div 
                        className="w-3 h-3 rounded-sm transition-transform hover:scale-110"
                        style={{ backgroundColor: color }}
                        title={file.pinLabel}
                      />
                    </div>
                    
                    {/* File name - Clickable */}
                    <div className="col-span-6 flex items-center">
                      <button 
                        className="font-mono truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                        title={`Click to open ${file.fileName}`}
                        onClick={() => onFileClick(fileWithDate.file)}
                      >
                        {file.fileName.replace(/^FPOD_/, '')}
                      </button>
                    </div>
                    
                    {/* File size */}
                    <div className="col-span-2 flex items-center">
                      <span className="text-muted-foreground">
                        {file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : 'Unknown'}
                      </span>
                    </div>
                    
                    {/* Actions */}
                    <div className="col-span-3 flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-muted transition-colors">
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-sm"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm font-medium">{file.pinLabel}</span>
                            </div>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">File:</span>
                                <span className="font-mono">{file.fileName}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Size:</span>
                                <span>{file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : 'Unknown'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Uploaded:</span>
                                <span>{format(new Date(file.uploadedAt), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                      
                      {/* Delete confirmation or delete button */}
                      {onDeleteFile && deleteConfirmFile?.id === file.id ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="whitespace-nowrap">Delete?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-5 w-5 p-0"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setDeleteConfirmFile(null);
                              await handleDeleteFile(fileWithDate.file);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmFile(null);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        onDeleteFile && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-4 w-4 p-0 hover:bg-muted transition-colors text-destructive hover:text-destructive" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmFile({ id: file.id, name: file.fileName });
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      )}

      {/* Analysis Progress - Show when analyzing */}
      {isAnalyzing && (
        <div className="space-y-3">
          <div className="bg-muted/20 rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Analyzing CSV files...</span>
              <span className="text-sm text-muted-foreground">{Math.round(analysisProgress)}%</span>
            </div>
            <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden mb-3">
              <div 
                className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-300 ease-out"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
            
            {/* Analysis Log */}
            <div className="bg-background/50 rounded p-2 max-h-24 overflow-y-auto">
              <div className="space-y-1">
                {analysisLog.map((log, index) => (
                  <div key={index} className="text-xs font-mono text-muted-foreground">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* TABLE VIEW: Detailed Start/End Dates - Default after analysis */}
        {hasAnalyzed && viewMode === 'table' && (
        <div className="space-y-1">
          {sortedFilesWithDates.length > 0 && (
            <div className="bg-muted/20 rounded p-3 transition-all duration-300">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border/30 text-xs font-medium text-muted-foreground">
                    <th className="text-left pb-2 pr-2">Pin</th>
                    <th className="text-left pb-2 pr-2">File Name</th>
                    <th className="text-center pb-2 px-2 bg-muted/10 rounded-tl-sm">Start Date</th>
                    <th className="text-center pb-2 px-2 bg-muted/10">End Date</th>
                    <th className="text-center pb-2 px-2 bg-muted/10 rounded-tr-sm">Duration</th>
                    <th className="text-right pb-2 pl-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                {sortedFilesWithDates.map((fileWithDate, index) => {
                    const { file, dateRange } = fileWithDate;
                    const color = pinColorMap.get(file.pinLabel) || COLORS[0];
                    
                    return (
                      <tr
                        key={`table-${file.id}-${index}`}
                        className="h-[22px] text-xs hover:bg-muted/30 transition-colors opacity-0 animate-[fadeIn_0.4s_ease-in-out_forwards]"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        {/* Pin indicator */}
                        <td className="pr-2 align-middle">
                          <div
                            className="w-3 h-3 rounded-sm transition-transform hover:scale-110"
                            style={{ backgroundColor: color }}
                            title={file.pinLabel}
                          />
                        </td>

                        {/* File name - Clickable */}
                        <td className="pr-2 align-middle">
                          <button
                            className="font-mono truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer w-full text-left"
                            title={`Click to open ${file.fileName}`}
                            onClick={() => onFileClick(fileWithDate.file)}
                          >
                            {file.fileName.replace(/^FPOD_/, '')}
                          </button>
                        </td>

                        {/* Start Date */}
                        <td className="px-2 text-center bg-muted/5 align-middle">
                          {dateRange.loading ? (
                            <div className="relative inline-block">
                              <Shimmer className="h-3 w-16" />
                            </div>
                          ) : dateRange.error ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="font-mono">{dateRange.startDate || '-'}</span>
                          )}
                        </td>

                        {/* End Date */}
                        <td className="px-2 text-center bg-muted/5 align-middle">
                          {dateRange.loading ? (
                            <div className="relative inline-block">
                              <Shimmer className="h-3 w-16" />
                            </div>
                          ) : dateRange.error ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <span className="font-mono">{dateRange.endDate || '-'}</span>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="px-2 text-center bg-muted/5 align-middle">
                          {dateRange.loading ? (
                            <div className="relative inline-block">
                              <Shimmer className="h-4 w-12 rounded" />
                            </div>
                          ) : (() => {
                            const correctedDays = getCorrectDuration(dateRange.startDate, dateRange.endDate);
                            return correctedDays !== null ? (
                              <span className="bg-primary/10 px-1.5 py-0.5 rounded text-xs font-medium">
                                {correctedDays} days
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            );
                          })()}
                        </td>

                        {/* Info button and Delete button */}
                        <td className="pl-2 text-right align-middle">
                          <div className="flex items-center justify-end gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-muted transition-colors">
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 data-timeline-popover">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-sm"
                                    style={{ backgroundColor: color }}
                                  />
                                  <span className="text-sm font-medium">{file.pinLabel}</span>
                                </div>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">File:</span>
                                    <span className="font-mono">{file.fileName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Size:</span>
                                    <span>{file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : 'Unknown'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Uploaded:</span>
                                    <span>{format(new Date(file.uploadedAt), 'MMM d, yyyy')}</span>
                                  </div>
                                  {(() => {
                                    const correctedDays = getCorrectDuration(dateRange.startDate, dateRange.endDate);
                                    return correctedDays !== null && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Period:</span>
                                          <span>{dateRange.startDate} to {dateRange.endDate}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Duration:</span>
                                          <span>{correctedDays} days</span>
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          
                          {/* Delete confirmation or delete button */}
                          {onDeleteFile && deleteConfirmFile?.id === file.id ? (
                            // Show inline confirmation - positioned to the left
                            <div className="flex items-center gap-1 text-xs">
                              <span className="whitespace-nowrap">Delete?</span>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-5 w-5 p-0"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmFile(null);
                                  await handleDeleteFile(fileWithDate.file);
                                }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmFile(null);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            // Show normal buttons when not confirming
                            onDeleteFile && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-4 w-4 p-0 hover:bg-muted transition-colors text-destructive hover:text-destructive" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmFile({ id: file.id, name: file.fileName });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )
                          )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
                </tbody>
              </table>
            </div>
          )}
        </div>
        )}

        {/* TIMELINE VIEW: Table-Based Layout */}
        {hasAnalyzed && viewMode === 'timeline' && timelineData.months.length > 0 && (
        <div className="relative bg-muted/20 rounded p-3">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {/* LEFT HEADER (35%): Data Files with Sort */}
                <th className="w-[35%] align-top">
                  <div className="h-7 flex items-center border-b border-border/30 mb-2">
                    <button
                      onClick={toggleSortOrder}
                      className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors cursor-pointer group"
                      title="Click to sort files alphabetically"
                    >
                      <span>Data Files</span>
                      {sortOrder === 'asc' && <ArrowUp className="h-3 w-3 group-hover:text-primary" />}
                      {sortOrder === 'desc' && <ArrowDown className="h-3 w-3 group-hover:text-primary" />}
                      {!sortOrder && <ArrowUpDown className="h-3 w-3 opacity-50 group-hover:opacity-100 group-hover:text-primary" />}
                    </button>
                  </div>
                </th>

                {/* RIGHT HEADER (65%): Timeline */}
                <th className="w-[65%] align-top">
                  <div className="relative mb-3">
                    <div className="h-7 flex items-center border-b border-border/30 mb-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Timeline ({format(timelineData.minDate!, 'MMM yyyy')} - {format(timelineData.maxDate!, 'MMM yyyy')})
                      </h4>
                    </div>

                    {/* Two-row header: Years and Months */}
                    <div className="relative">
                      {/* Year row */}
                      <div className="relative h-5 border-b border-border/30">
                        <div className="absolute inset-0 flex">
                          {timelineData.years.map((yearData, index) => {
                            const totalMonthsWidth = timelineData.months.length;
                            const left = (yearData.startMonth / totalMonthsWidth) * 100;
                            const width = (yearData.monthCount / totalMonthsWidth) * 100;

                            return (
                              <div
                                key={index}
                                className="absolute text-xs font-semibold text-foreground/90 flex items-center justify-center border-r border-border/30"
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  height: '100%'
                                }}
                              >
                                {yearData.year}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Month row */}
                      <div className="relative h-4 bg-muted/10">
                        <div className="absolute inset-0 flex">
                          {timelineData.months.map((month, index) => {
                            const monthStart = startOfMonth(month);
                            const monthEnd = endOfMonth(month);
                            const monthDuration = differenceInDays(monthEnd, monthStart) + 1;

                            const daysFromTimelineStart = differenceInDays(monthStart, timelineData.minDate!);
                            const left = (daysFromTimelineStart / timelineData.totalDays) * 100;
                            const width = (monthDuration / timelineData.totalDays) * 100;

                            const showText = width > 3;
                            const monthLabel = format(month, 'MM'); // Always use 2-digit format (01, 02, etc.)

                            return (
                              <div
                                key={index}
                                className="absolute border-r border-border/30 flex items-center justify-center text-xs"
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                  height: '100%'
                                }}
                                title={format(month, 'MMMM yyyy')}
                              >
                                {showText ? (
                                  <span className="text-muted-foreground font-medium text-[10px]">
                                    {monthLabel}
                                  </span>
                                ) : (
                                  <div className="w-px h-3 bg-border/50" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFilesWithDates.map((fileWithDate, index) => {
                const { file, dateRange } = fileWithDate;
                const color = pinColorMap.get(file.pinLabel) || COLORS[0];

                const barMetrics = calculateBarMetrics(fileWithDate);

                return (
                  <tr key={`timeline-${file.id}-${index}`} className="h-[22px]">
                    {/* LEFT CELL: File Info */}
                    <td className="pr-4 align-middle">
                      <div className="flex items-center gap-2">
                        {/* Pin color indicator */}
                        <div
                          className="w-2 h-2 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: color }}
                          title={`Pin: ${file.pinLabel}`}
                        />

                        {/* File name with popover menu */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-xs font-mono flex-1 truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer">
                              {file.fileName.replace(/^FPOD_/, '')}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-48 p-0" align="start">
                            <div className="flex flex-col">
                              {/* Open option */}
                              <button
                                onClick={() => onFileClick(fileWithDate.file)}
                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                              >
                                <FileText className="h-4 w-4" />
                                <span>Open</span>
                              </button>

                              {/* Info option */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left">
                                    <Info className="h-4 w-4" />
                                    <span>Info</span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72" side="right">
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-3 h-3 rounded-sm"
                                        style={{ backgroundColor: color }}
                                      />
                                      <span className="text-sm font-medium">{file.pinLabel}</span>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">File:</span>
                                        <span className="font-mono">{file.fileName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Size:</span>
                                        <span>{file.fileSize ? `${(file.fileSize / 1024).toFixed(1)} KB` : 'Unknown'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Uploaded:</span>
                                        <span>{format(new Date(file.uploadedAt), 'MMM d, yyyy')}</span>
                                      </div>
                                      {dateRange.startDate && dateRange.endDate && (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Period:</span>
                                            <span>{dateRange.startDate} to {dateRange.endDate}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Duration:</span>
                                            <span>{dateRange.totalDays} days</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>

                              {/* Delete option */}
                              {onDeleteFile && (
                                deleteConfirmFile?.id === file.id ? (
                                  <div className="flex items-center gap-2 px-3 py-2 text-sm border-t">
                                    <span className="text-xs">Delete?</span>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-6 px-2"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmFile(null);
                                        await handleDeleteFile(fileWithDate.file);
                                      }}
                                    >
                                      Yes
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 px-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmFile(null);
                                      }}
                                    >
                                      No
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmFile({ id: file.id, name: file.fileName });
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left text-destructive border-t"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Delete</span>
                                  </button>
                                )
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Duration badge */}
                        {(() => {
                          const correctedDays = getCorrectDuration(dateRange.startDate, dateRange.endDate);
                          return correctedDays && (
                            <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                              {correctedDays}d
                            </span>
                          );
                        })()}
                      </div>
                    </td>

                    {/* RIGHT CELL: Timeline Bar */}
                    <td className="align-middle">
                      <div className="relative h-4 w-full bg-muted/30 rounded">
                        {dateRange.loading ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Shimmer className="h-2 w-8" />
                          </div>
                        ) : dateRange.error ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">-</span>
                          </div>
                        ) : barMetrics.width > 0 ? (
                          <div
                            className="absolute h-full rounded flex items-center text-white font-medium shadow-sm transition-all hover:shadow-md"
                            style={{
                              left: `${barMetrics.left}%`,
                              width: `${barMetrics.width}%`,
                              backgroundColor: color,
                              minWidth: '2px'
                            }}
                            title={`${file.pinLabel}: ${dateRange.startDate} - ${dateRange.endDate} (${getCorrectDuration(dateRange.startDate, dateRange.endDate) || 0} days)`}
                          >
                            {barMetrics.width > 12 && (() => {
                              const correctedDays = getCorrectDuration(dateRange.startDate, dateRange.endDate);
                              return correctedDays && (
                                <div className="flex items-center justify-center w-full">
                                  <span className="text-xs font-medium">
                                    {correctedDays}d
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">No data</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}