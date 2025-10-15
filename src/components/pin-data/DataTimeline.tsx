'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, differenceInDays, parseISO, isValid, getYear } from 'date-fns';
import { Info, Calendar, BarChart3, Trash2, Check, X, PlayCircle, ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, FileText, Pencil, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { type PinFile } from '@/lib/supabase/file-storage-service';
import { useToast } from '@/hooks/use-toast';

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
  onRenameFile?: (file: PinFile & { pinLabel: string }, newName: string) => Promise<boolean>;
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
    const standardFormat = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = parseISO(standardFormat);
    return isValid(parsed) ? parsed : null;
  }

  // Handle ISO format yyyy-mm-dd (standard ISO date format)
  const dashParts = dateString.split('-');
  if (dashParts.length === 3) {
    const [year, month, day] = dashParts;
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

export function DataTimeline({ files, getFileDateRange, onFileClick, onDeleteFile, onRenameFile }: DataTimelineProps) {
  const { toast } = useToast();
  const [filesWithDates, setFilesWithDates] = useState<FileWithDateRange[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [hasAnalyzed, setHasAnalyzed] = useState(true); // Always true since dates are from database
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<{ id: string; name: string } | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>('asc'); // Start with alphabetical (asc)
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');
  const [fetchingTimesFor, setFetchingTimesFor] = useState<string | null>(null);
  const [openMenuFileId, setOpenMenuFileId] = useState<string | null>(null);

  // Delete file handler - just call parent's onDeleteFile
  const handleDeleteFile = async (file: PinFile & { pinLabel: string }) => {
    if (onDeleteFile) {
      onDeleteFile(file);
    }
  };

  // Rename file handler
  const handleRenameFile = async (file: PinFile & { pinLabel: string }) => {
    if (!onRenameFile || !renameValue.trim()) {
      setRenamingFileId(null);
      return;
    }

    const success = await onRenameFile(file, renameValue.trim());
    if (success) {
      // Update local state to reflect the name change
      setFilesWithDates(prev =>
        prev.map(f =>
          f.file.id === file.id
            ? { ...f, file: { ...f.file, fileName: renameValue.trim() } }
            : f
        )
      );
    }
    setRenamingFileId(null);
    setRenameValue('');
  };

  // Start renaming a file
  const startRename = (file: PinFile & { pinLabel: string }) => {
    setRenamingFileId(file.id);
    setRenameValue(file.fileName);
  };

  // Fetch times for a file
  const handleFetchTimes = async (file: PinFile & { pinLabel: string }) => {
    setFetchingTimesFor(file.id);
    setOpenMenuFileId(null); // Close menu

    try {
      toast({ title: "Fetching dates...", description: `Analyzing ${file.fileName}` });

      // Get date range from CSV
      const result = await getFileDateRange(file);

      if (result.error) {
        throw new Error(result.error);
      }

      if (!result.startDate || !result.endDate) {
        throw new Error('No dates found in file');
      }

      // Convert dates from DD/MM/YYYY to YYYY-MM-DD format for database
      const convertToDbFormat = (dateStr: string): string => {
        // Handle DD/MM/YYYY format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // If already in YYYY-MM-DD format, return as is
        return dateStr;
      };

      const startDateDb = convertToDbFormat(result.startDate);
      const endDateDb = convertToDbFormat(result.endDate);

      // Update database with dates
      const { updateFileDatesAction } = await import('@/app/data-explorer/actions');
      const updateResult = await updateFileDatesAction(file.id, startDateDb, endDateDb);

      if (!updateResult.success) {
        throw new Error(updateResult.error || 'Failed to update dates');
      }

      // Update local state
      setFilesWithDates(prev =>
        prev.map(f =>
          f.file.id === file.id
            ? {
                ...f,
                file: {
                  ...f.file,
                  startDate: new Date(startDateDb),
                  endDate: new Date(endDateDb)
                },
                dateRange: {
                  startDate: startDateDb,  // Use YYYY-MM-DD format for display
                  endDate: endDateDb,      // Use YYYY-MM-DD format for display
                  totalDays: result.totalDays,
                  loading: false
                }
              }
            : f
        )
      );

      toast({
        title: "Dates Updated",
        description: `${file.fileName}: ${result.startDate} to ${result.endDate}`
      });

      // Reload the page to fetch updated data from database
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error fetching times:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to fetch dates'
      });
    } finally {
      setFetchingTimesFor(null);
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

  // Initialize files with dates from database
  useEffect(() => {
    if (files.length === 0) {
      setFilesWithDates([]);
      return;
    }

    // Sort files alphabetically by fileName
    const sortedFiles = [...files].sort((a, b) =>
      a.fileName.localeCompare(b.fileName)
    );

    // Initialize files with date range data from database
    const initialFiles = sortedFiles.map(file => {
      let startDate: string | null = null;
      let endDate: string | null = null;
      let totalDays: number | null = null;

      // Get dates from file if available (from database)
      if (file.startDate && file.endDate) {
        const start = new Date(file.startDate);
        const end = new Date(file.endDate);

        // Format dates as YYYY-MM-DD
        startDate = format(start, 'yyyy-MM-dd');
        endDate = format(end, 'yyyy-MM-dd');

        // Calculate duration
        totalDays = differenceInDays(end, start) + 1;
      }

      return {
        file,
        dateRange: {
          totalDays,
          startDate,
          endDate,
          loading: false
        }
      };
    });

    setFilesWithDates(initialFiles);
    setHasAnalyzed(true); // Mark as analyzed since dates are from database
  }, [files]);

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

        {/* View Mode Toggle - Always visible */}
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
      </div>

        {/* TABLE VIEW: Detailed Start/End Dates */}
        {viewMode === 'table' && (
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

                        {/* File name - Clickable with menu */}
                        <td className="pr-2 align-middle">
                          <Popover open={openMenuFileId === file.id} onOpenChange={(open) => setOpenMenuFileId(open ? file.id : null)}>
                            <PopoverTrigger asChild>
                              <button
                                className="font-mono truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer w-full text-left"
                                title={`Click for actions on ${file.fileName}`}
                              >
                                {file.fileName.replace(/^FPOD_/, '')}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="min-w-[400px] p-0" align="start">
                              <div className="flex flex-col">
                                {/* Open option */}
                                <button
                                  onClick={() => {
                                    setOpenMenuFileId(null);
                                    onFileClick(fileWithDate.file);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                                >
                                  <FileText className="h-4 w-4" />
                                  <div>
                                    <div className="font-medium">Open</div>
                                    <div className="text-xs text-muted-foreground">View data plots</div>
                                  </div>
                                </button>

                                <Separator />

                                {/* Info option */}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left">
                                      <Info className="h-4 w-4" />
                                      <div>
                                        <div className="font-medium">Info</div>
                                        <div className="text-xs text-muted-foreground">File details</div>
                                      </div>
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

                                {/* Rename option */}
                                {onRenameFile && (
                                  renamingFileId === file.id ? (
                                    <div className="flex items-center gap-1 px-3 py-2.5">
                                      <Input
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleRenameFile(fileWithDate.file);
                                          } else if (e.key === 'Escape') {
                                            setRenamingFileId(null);
                                          }
                                        }}
                                        className="h-7 text-xs min-w-[320px]"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRenameFile(fileWithDate.file);
                                        }}
                                      >
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRenamingFileId(null);
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setOpenMenuFileId(null);
                                        startRename(fileWithDate.file);
                                      }}
                                      className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      <div>
                                        <div className="font-medium">Rename</div>
                                        <div className="text-xs text-muted-foreground">Change file name</div>
                                      </div>
                                    </button>
                                  )
                                )}

                                <Separator />

                                {/* Fetch Times option - only if dates not present */}
                                {!dateRange.startDate && !dateRange.endDate && (
                                  <button
                                    onClick={() => handleFetchTimes(fileWithDate.file)}
                                    disabled={fetchingTimesFor === file.id}
                                    className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {fetchingTimesFor === file.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <div>
                                      <div className="font-medium">Fetch Times</div>
                                      <div className="text-xs text-muted-foreground">
                                        {fetchingTimesFor === file.id ? 'Analyzing...' : 'Get start/end dates'}
                                      </div>
                                    </div>
                                  </button>
                                )}

                                <Separator />

                                {/* Delete option */}
                                {onDeleteFile && (
                                  deleteConfirmFile?.id === file.id ? (
                                    <div className="flex items-center gap-2 px-3 py-2.5 text-sm">
                                      <span className="text-xs flex-1">Delete?</span>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-7 px-3"
                                        onClick={async () => {
                                          setDeleteConfirmFile(null);
                                          setOpenMenuFileId(null);
                                          await handleDeleteFile(fileWithDate.file);
                                        }}
                                      >
                                        Yes
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-3"
                                        onClick={() => setDeleteConfirmFile(null)}
                                      >
                                        No
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmFile({ id: file.id, name: file.fileName })}
                                      className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <div>
                                        <div className="font-medium">Delete</div>
                                        <div className="text-xs text-muted-foreground">Remove file permanently</div>
                                      </div>
                                    </button>
                                  )
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
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
        {viewMode === 'timeline' && timelineData.months.length > 0 && (
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
                          <PopoverContent className="min-w-[400px] p-0" align="start">
                            <div className="flex flex-col">
                              {/* Open option */}
                              <button
                                onClick={() => onFileClick(fileWithDate.file)}
                                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                              >
                                <FileText className="h-4 w-4" />
                                <span>Open</span>
                              </button>

                              {/* Rename option */}
                              {onRenameFile && (
                                renamingFileId === fileWithDate.file.id ? (
                                  <div className="flex items-center gap-1 px-3 py-2 border-b">
                                    <Input
                                      value={renameValue}
                                      onChange={(e) => setRenameValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleRenameFile(fileWithDate.file);
                                        } else if (e.key === 'Escape') {
                                          setRenamingFileId(null);
                                        }
                                      }}
                                      className="h-6 text-xs min-w-[320px]"
                                      autoFocus
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRenameFile(fileWithDate.file);
                                      }}
                                    >
                                      <Check className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRenamingFileId(null);
                                      }}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startRename(fileWithDate.file);
                                    }}
                                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    <span>Rename</span>
                                  </button>
                                )
                              )}

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
                                      <span className="text-sm font-medium">{fileWithDate.file.pinLabel}</span>
                                    </div>
                                    <div className="space-y-2 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">File:</span>
                                        <span className="font-mono">{fileWithDate.file.fileName}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Size:</span>
                                        <span>{fileWithDate.file.fileSize ? `${(fileWithDate.file.fileSize / 1024).toFixed(1)} KB` : 'Unknown'}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Uploaded:</span>
                                        <span>{format(new Date(fileWithDate.file.uploadedAt), 'MMM d, yyyy')}</span>
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

                              {/* Fetch Times option - only if dates not present */}
                              {!dateRange.startDate && !dateRange.endDate && (
                                <>
                                  <Separator />
                                  <button
                                    onClick={() => handleFetchTimes(fileWithDate.file)}
                                    disabled={fetchingTimesFor === fileWithDate.file.id}
                                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {fetchingTimesFor === fileWithDate.file.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Clock className="h-4 w-4" />
                                    )}
                                    <div>
                                      <div className="font-medium">Fetch Times</div>
                                      <div className="text-xs text-muted-foreground">
                                        {fetchingTimesFor === fileWithDate.file.id ? 'Analyzing...' : 'Get start/end dates'}
                                      </div>
                                    </div>
                                  </button>
                                </>
                              )}

                              <Separator />

                              {/* Delete option */}
                              {onDeleteFile && (
                                deleteConfirmFile?.id === fileWithDate.file.id ? (
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
                                      setDeleteConfirmFile({ id: fileWithDate.file.id, name: fileWithDate.file.fileName });
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
                            title={`${fileWithDate.file.pinLabel}: ${dateRange.startDate} - ${dateRange.endDate} (${getCorrectDuration(dateRange.startDate, dateRange.endDate) || 0} days)`}
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