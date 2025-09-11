'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, differenceInDays, parseISO, isValid, getYear } from 'date-fns';
import { Info, Calendar, BarChart3 } from 'lucide-react';
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
    <div className="col-span-5 flex items-center">
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
    <div className="col-span-1 flex items-center">
      <Shimmer className="h-4 w-4" />
    </div>
  </div>
);

// Helper function to parse various date formats to proper Date
const parseCustomDate = (dateString: string): Date | null => {
  if (!dateString) return null;
  
  // Handle dd/mm/yy format (from CSV files)
  const slashParts = dateString.split('/');
  if (slashParts.length === 3) {
    const [day, month, year] = slashParts;
    // Convert 2-digit year to 4-digit year (assume 20xx for years 00-99)
    const fullYear = year.length === 2 ? `20${year}` : year;
    const standardFormat = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
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

export function DataTimeline({ files, getFileDateRange, onFileClick }: DataTimelineProps) {
  const [filesWithDates, setFilesWithDates] = useState<FileWithDateRange[]>([]);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Create pin-based color mapping
  const pinColorMap = useMemo(() => {
    const uniquePins = Array.from(new Set(files.map(f => f.pinLabel)));
    const colorMap = new Map<string, string>();
    uniquePins.forEach((pinLabel, index) => {
      colorMap.set(pinLabel, COLORS[index % COLORS.length]);
    });
    return colorMap;
  }, [files]);

  // Load date ranges for all files with smooth progress tracking
  useEffect(() => {
    if (files.length === 0) {
      setFilesWithDates([]);
      setIsInitialLoad(false);
      return;
    }

    // Initialize all files with loading state immediately
    const initialFiles = files.map(file => ({
      file,
      dateRange: {
        totalDays: null,
        startDate: null,
        endDate: null,
        loading: true
      }
    }));
    setFilesWithDates(initialFiles);
    setIsInitialLoad(true);
    setLoadingProgress(0);

    const loadDateRanges = async () => {
      const results: FileWithDateRange[] = [];
      let completedCount = 0;

      // Process files sequentially for smooth progress updates
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
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
        setLoadingProgress(progress);
        
        // Update files with current progress - replace the loading file with completed
        setFilesWithDates(prevFiles => {
          const updated = [...prevFiles];
          updated[i] = results[i];
          return updated;
        });
        
        // Small delay to make progress visible
        if (completedCount < files.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      setIsInitialLoad(false);
    };

    loadDateRanges();
  }, [files, getFileDateRange]);

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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Data Timeline</h3>
        
        {/* View Mode Toggle */}
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
          {filesWithDates.length > 0 && (
            <div className="bg-muted/20 rounded p-3 transition-all duration-300">
              {/* Loading Progress Bar */}
              {isInitialLoad && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Analyzing date ranges...
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(loadingProgress)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted/30 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-300 ease-out"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 pb-2 mb-2 border-b border-border/30 text-xs font-medium text-muted-foreground">
                <div className="col-span-1">Pin</div>
                <div className="col-span-5">File Name</div>
                {/* Grouped Date/Duration Section */}
                <div className="col-span-5 grid grid-cols-3 gap-1 bg-muted/10 px-2 py-1 rounded-sm border border-border/20">
                  <div className="text-center">Start Date</div>
                  <div className="text-center">End Date</div>
                  <div className="text-center">Duration</div>
                </div>
                <div className="col-span-1">Info</div>
              </div>
              
              {/* Table Content */}
              <div className="space-y-0.5">
                {isInitialLoad ? (
                  // Show skeleton rows during initial load
                  Array.from({ length: Math.min(files.length, 5) }, (_, index) => (
                    <SkeletonTableRow key={`skeleton-${index}`} index={index} />
                  ))
                ) : (
                  // Show actual data rows with fade-in
                  filesWithDates.map((fileWithDate, index) => {
                    const { file, dateRange } = fileWithDate;
                    const color = pinColorMap.get(file.pinLabel) || COLORS[0];
                    
                    return (
                      <div 
                        key={`table-${file.id}-${index}`} 
                        className="grid grid-cols-12 gap-2 py-1.5 text-xs hover:bg-muted/30 rounded opacity-0 animate-[fadeIn_0.4s_ease-in-out_forwards] transition-colors"
                        style={{ animationDelay: `${index * 30}ms` }}
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
                        <div className="col-span-5 flex items-center">
                          <button 
                            className="font-mono truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                            title={`Click to open ${file.fileName}`}
                            onClick={() => onFileClick(fileWithDate.file)}
                          >
                            {file.fileName.replace(/^FPOD_/, '')}
                          </button>
                        </div>
                        
                        {/* Grouped Date/Duration Section */}
                        <div className="col-span-5 grid grid-cols-3 gap-1 bg-muted/5 px-2 py-1 rounded-sm">
                          {/* Start Date */}
                          <div className="flex items-center justify-center">
                            {dateRange.loading ? (
                              <div className="relative">
                                <Shimmer className="h-3 w-16" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-pulse" />
                                </div>
                              </div>
                            ) : dateRange.error ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <span className="font-mono text-center">{dateRange.startDate || '-'}</span>
                            )}
                          </div>
                          
                          {/* End Date */}
                          <div className="flex items-center justify-center">
                            {dateRange.loading ? (
                              <div className="relative">
                                <Shimmer className="h-3 w-16" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                </div>
                              </div>
                            ) : dateRange.error ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <span className="font-mono text-center">{dateRange.endDate || '-'}</span>
                            )}
                          </div>
                          
                          {/* Duration */}
                          <div className="flex items-center justify-center">
                            {dateRange.loading ? (
                              <div className="relative">
                                <Shimmer className="h-4 w-12 rounded" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="h-1.5 w-1.5 bg-primary/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                                </div>
                              </div>
                            ) : (() => {
                              const correctedDays = getCorrectDuration(dateRange.startDate, dateRange.endDate);
                              return correctedDays !== null ? (
                                <span className="bg-primary/10 px-1.5 py-0.5 rounded text-xs font-medium text-center animate-[fadeIn_0.3s_ease-in-out]">
                                  {correctedDays} days
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              );
                            })()}
                          </div>
                        </div>
                        
                        {/* Info button */}
                        <div className="col-span-1 flex items-center">
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
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TIMELINE VIEW: Two-Section Layout */}
      {viewMode === 'timeline' && timelineData.months.length > 0 && (
        <div className="relative bg-muted/20 rounded p-3">
          <div className="flex gap-4">
            {/* LEFT SECTION (35%): File Names + Info Buttons */}
            <div className="w-[35%] flex-shrink-0 space-y-1">
              <div className="h-7 flex items-center border-b border-border/30 mb-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Data Files
                </h4>
              </div>
              {filesWithDates.map((fileWithDate, index) => {
                const { file, dateRange } = fileWithDate;
                const color = pinColorMap.get(file.pinLabel) || COLORS[0];

                return (
                  <div key={`file-${file.id}-${index}`} className="flex items-center gap-2 h-6 py-0.5">
                    {/* Pin color indicator */}
                    <div 
                      className="w-2 h-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: color }}
                      title={`Pin: ${file.pinLabel}`}
                    />
                    
                    {/* File name - Clickable */}
                    <button
                      className="text-xs font-mono flex-1 truncate text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                      title={`Click to open ${file.fileName}`}
                      onClick={() => onFileClick(fileWithDate.file)}
                    >
                      {file.fileName.replace(/^FPOD_/, '')}
                    </button>
                    
                    {/* Duration badge */}
                    {(() => {
                      const correctedDays = getCorrectDuration(dateRange.startDate, dateRange.endDate);
                      return correctedDays && (
                        <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                          {correctedDays}d
                        </span>
                      );
                    })()}
                    
                    {/* Info button */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-muted">
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
                  </div>
                );
              })}
            </div>

            {/* RIGHT SECTION (65%): Professional Timeline */}
            <div className="flex-1 min-w-0">
              {/* Timeline Header */}
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

                        // Show abbreviated month name if there's enough space
                        const showText = width > 6;
                        const monthLabel = showText ? format(month, 'MMM') : format(month, 'M');

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
                              <span className="text-muted-foreground font-medium">
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

              {/* Timeline Bars */}
              <div className="space-y-1.5">
                {filesWithDates.map((fileWithDate, index) => {
                  const { file, dateRange } = fileWithDate;
                  const barMetrics = calculateBarMetrics(fileWithDate);
                  const color = pinColorMap.get(file.pinLabel) || COLORS[0];

                  return (
                    <div key={`timeline-${file.id}-${index}`} className="relative">
                      <div className="relative h-4 bg-muted/30 rounded">
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
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Loading state with file count */}
      {filesWithDates.some(({ dateRange }) => dateRange.loading) && !isInitialLoad && (
        <div className="text-center py-3 text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              <div className="absolute inset-0 h-4 w-4 animate-pulse rounded-full border border-primary/20" />
            </div>
            <div className="text-sm">
              <span className="font-medium">Processing files...</span>
              <br />
              <span className="text-xs text-muted-foreground/80">
                {(() => {
                  const totalFiles = filesWithDates.length;
                  const loadingFiles = filesWithDates.filter(({ dateRange }) => dateRange.loading).length;
                  const completedFiles = totalFiles - loadingFiles;
                  return `${completedFiles} of ${totalFiles} files completed`;
                })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}