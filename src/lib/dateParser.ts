/**
 * Utility functions for parsing date ranges from file names
 * Handles formats like "2408-2409" meaning Aug 2024 to Sep 2024
 */

export interface DateRange {
  startMonth: string;
  endMonth: string;
  startYear: string;
  endYear: string;
  displayFormat: string;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Parse date range from filename patterns like "2408-2409"
 * Format: YYMM-YYMM where YY is year (20XX) and MM is month (01-12)
 */
export function parseDateRangeFromFilename(filename: string): DateRange | null {
  // Look for patterns like "2408-2409" or similar date ranges
  const dateRangePattern = /(\d{4})-(\d{4})/;
  const match = filename.match(dateRangePattern);
  
  if (!match) {
    return null;
  }
  
  const [, startDate, endDate] = match;
  
  // Parse start date (YYMM format)
  const startYearShort = startDate.substring(0, 2);
  const startMonthNum = parseInt(startDate.substring(2, 4), 10);
  
  // Parse end date (YYMM format)
  const endYearShort = endDate.substring(0, 2);
  const endMonthNum = parseInt(endDate.substring(2, 4), 10);
  
  // Convert to full year (assuming 20XX)
  const startYear = `20${startYearShort}`;
  const endYear = `20${endYearShort}`;
  
  // Validate month numbers
  if (startMonthNum < 1 || startMonthNum > 12 || endMonthNum < 1 || endMonthNum > 12) {
    return null;
  }
  
  const startMonth = MONTH_NAMES[startMonthNum - 1];
  const endMonth = MONTH_NAMES[endMonthNum - 1];
  
  // Create display format
  let displayFormat: string;
  if (startYear === endYear) {
    if (startMonth === endMonth) {
      displayFormat = `${startMonth} ${startYear}`;
    } else {
      displayFormat = `${startMonth} - ${endMonth} ${startYear}`;
    }
  } else {
    displayFormat = `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
  }
  
  return {
    startMonth,
    endMonth,
    startYear,
    endYear,
    displayFormat
  };
}

/**
 * Extract time windows from multiple files
 */
export function extractTimeWindowsFromFiles(files: File[]): DateRange[] {
  const dateRanges: DateRange[] = [];
  
  for (const file of files) {
    const dateRange = parseDateRangeFromFilename(file.name);
    if (dateRange) {
      // Check if we already have this range
      const exists = dateRanges.some(range => 
        range.displayFormat === dateRange.displayFormat
      );
      
      if (!exists) {
        dateRanges.push(dateRange);
      }
    }
  }
  
  // Sort by year and month
  return dateRanges.sort((a, b) => {
    const aStart = parseInt(a.startYear) * 100 + MONTH_NAMES.indexOf(a.startMonth) + 1;
    const bStart = parseInt(b.startYear) * 100 + MONTH_NAMES.indexOf(b.startMonth) + 1;
    return aStart - bStart;
  });
}

/**
 * Get a summary of all time periods covered by files
 */
export function getTimeWindowSummary(files: File[]): string | null {
  const dateRanges = extractTimeWindowsFromFiles(files);
  
  if (dateRanges.length === 0) {
    return null;
  }
  
  if (dateRanges.length === 1) {
    return dateRanges[0].displayFormat;
  }
  
  // Find overall range
  const earliest = dateRanges[0];
  const latest = dateRanges[dateRanges.length - 1];
  
  return `${earliest.startMonth} ${earliest.startYear} - ${latest.endMonth} ${latest.endYear}`;
}