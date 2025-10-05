/**
 * CSV Parser Utilities for GP, FPOD, and Subcam data files
 * Handles different file formats and data structures
 */

export interface ParsedDataPoint {
  time: string;
  [key: string]: string | number | undefined | null;
}

export interface ParseResult {
  data: ParsedDataPoint[];
  headers: string[];
  errors: string[];
  summary: {
    totalRows: number;
    validRows: number;
    columns: number;
    timeColumn: string | null;
  };
  // Optional metadata for parameters (used in merged plots to track source)
  parameterMetadata?: Record<string, {
    source: 'GP' | 'FPOD' | 'Subcam' | 'marine';
    sourceLabel?: string; // e.g., "OM", "GP", "FPOD"
  }>;
}

export type FileType = 'GP' | 'FPOD' | 'Subcam';

/**
 * Detect date format (DD/MM/YYYY vs MM/DD/YYYY) by analyzing date values
 * Examines first several rows to determine which format is being used
 */
function detectDateFormat(lines: string[], timeColumnIndex: number): 'DD/MM/YYYY' | 'MM/DD/YYYY' {
  const sampleSize = Math.min(20, lines.length - 1); // Check up to 20 data rows
  const dateValues: string[] = [];

  console.log('[DATE DETECTION] Starting date format detection...');
  console.log('[DATE DETECTION] Time column index:', timeColumnIndex);
  console.log('[DATE DETECTION] Sample size:', sampleSize);

  // Extract date values from sample rows
  for (let i = 1; i <= sampleSize && i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values[timeColumnIndex]) {
      const timeValue = values[timeColumnIndex].trim();
      // Extract just the date part if it has time component
      const datePart = timeValue.split(' ')[0];
      if (datePart.includes('/')) {
        dateValues.push(datePart);
      }
    }
  }

  console.log('[DATE DETECTION] Sample dates extracted:', dateValues.slice(0, 5));

  if (dateValues.length === 0) {
    console.log('[DATE DETECTION] No date values found, defaulting to DD/MM/YYYY');
    return 'DD/MM/YYYY'; // Default to European format
  }

  let hasFirstComponentOver12 = false;
  let hasSecondComponentOver12 = false;
  const firstComponents: number[] = [];
  const secondComponents: number[] = [];

  // Analyze each date value
  for (const dateStr of dateValues) {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const first = parseInt(parts[0], 10);
      const second = parseInt(parts[1], 10);

      if (!isNaN(first) && !isNaN(second)) {
        firstComponents.push(first);
        secondComponents.push(second);

        if (first > 12) hasFirstComponentOver12 = true;
        if (second > 12) hasSecondComponentOver12 = true;
      }
    }
  }

  console.log('[DATE DETECTION] First components:', firstComponents);
  console.log('[DATE DETECTION] Second components:', secondComponents);
  console.log('[DATE DETECTION] Has first > 12:', hasFirstComponentOver12);
  console.log('[DATE DETECTION] Has second > 12:', hasSecondComponentOver12);

  // Rule 1: If first component > 12, must be DD/MM/YYYY
  if (hasFirstComponentOver12 && !hasSecondComponentOver12) {
    console.log('[DATE DETECTION] ✓ Detected format: DD/MM/YYYY (Rule 1: first > 12)');
    return 'DD/MM/YYYY';
  }

  // Rule 2: If second component > 12, must be MM/DD/YYYY
  if (hasSecondComponentOver12 && !hasFirstComponentOver12) {
    console.log('[DATE DETECTION] ✓ Detected format: MM/DD/YYYY (Rule 2: second > 12)');
    return 'MM/DD/YYYY';
  }

  // Rule 3: Both ambiguous (all values ≤12), look for sequential patterns
  if (!hasFirstComponentOver12 && !hasSecondComponentOver12 && firstComponents.length > 3) {
    // Check if first components show day-like progression (1-30 range with variety)
    const firstRange = Math.max(...firstComponents) - Math.min(...firstComponents);
    const firstUnique = new Set(firstComponents).size;

    // Check if second components show day-like progression
    const secondRange = Math.max(...secondComponents) - Math.min(...secondComponents);
    const secondUnique = new Set(secondComponents).size;

    console.log('[DATE DETECTION] Pattern analysis - First range:', firstRange, 'unique:', firstUnique);
    console.log('[DATE DETECTION] Pattern analysis - Second range:', secondRange, 'unique:', secondUnique);

    // If first component has wider range and more variety, likely to be days
    if (firstRange > secondRange && firstUnique > secondUnique) {
      console.log('[DATE DETECTION] ✓ Detected format: DD/MM/YYYY (Rule 3: first has more variety)');
      return 'DD/MM/YYYY';
    }

    // If second component has wider range and more variety, likely to be days
    if (secondRange > firstRange && secondUnique > firstUnique) {
      console.log('[DATE DETECTION] ✓ Detected format: MM/DD/YYYY (Rule 3: second has more variety)');
      return 'MM/DD/YYYY';
    }
  }

  // Default to European format (DD/MM/YYYY) if still ambiguous
  console.log('[DATE DETECTION] ✓ Using default format: DD/MM/YYYY (ambiguous case)');
  return 'DD/MM/YYYY';
}

/**
 * Enhanced CSV parsing with robust error handling
 */
export async function parseCSVFile(
  file: File,
  fileType: FileType,
  dateFormatOverride?: 'DD/MM/YYYY' | 'MM/DD/YYYY'
): Promise<ParseResult> {
  const result: ParseResult = {
    data: [],
    headers: [],
    errors: [],
    summary: {
      totalRows: 0,
      validRows: 0,
      columns: 0,
      timeColumn: null,
    }
  };

  try {
    const text = await file.text();
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) {
      result.errors.push('File is empty');
      return result;
    }

    // Parse headers with cleaning
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    result.headers = rawHeaders;
    result.summary.columns = rawHeaders.length;
    result.summary.totalRows = lines.length - 1;

    // Detect time column with multiple strategies
    const timeColumnIndex = detectTimeColumn(rawHeaders, fileType);
    if (timeColumnIndex >= 0) {
      result.summary.timeColumn = rawHeaders[timeColumnIndex];
    } else {
      result.errors.push(`No time column detected for ${fileType} data`);
    }

    // Use override if provided, otherwise detect date format by analyzing sample data
    const dateFormat = dateFormatOverride || detectDateFormat(lines, timeColumnIndex);
    console.log('[CSV PARSER] Using date format:', dateFormat, dateFormatOverride ? '(override)' : '(detected)');

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const rowData = parseDataRow(lines[i], rawHeaders, timeColumnIndex, fileType, dateFormat);
        if (rowData) {
          result.data.push(rowData);
          result.summary.validRows++;
        }
      } catch (rowError) {
        result.errors.push(`Row ${i}: ${rowError instanceof Error ? rowError.message : 'Parse error'}`);
      }
    }

    // Validate and sort by time if possible
    if (result.data.length > 0 && result.summary.timeColumn) {
      try {
        result.data.sort((a, b) => {
          const timeA = new Date(a.time).getTime();
          const timeB = new Date(b.time).getTime();
          return timeA - timeB;
        });
      } catch (sortError) {
        result.errors.push('Warning: Could not sort data by time');
      }
    }

  } catch (fileError) {
    result.errors.push(`File reading error: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Detect time column based on file type and common patterns
 */
function detectTimeColumn(headers: string[], fileType: FileType): number {
  const timePatterns = {
    GP: ['time', 'timestamp', 'datetime', 'date_time', 'utc_time'],
    FPOD: ['timestamp', 'time', 'datetime', 'date', 'utc'],
    Subcam: ['time', 'datetime', 'timestamp', 'capture_time', 'image_time']
  };

  const patterns = timePatterns[fileType] || timePatterns.GP;
  
  // First, try exact matches (case insensitive)
  for (const pattern of patterns) {
    const index = headers.findIndex(h => h.toLowerCase() === pattern.toLowerCase());
    if (index >= 0) return index;
  }

  // Then, try partial matches
  for (const pattern of patterns) {
    const index = headers.findIndex(h => h.toLowerCase().includes(pattern.toLowerCase()));
    if (index >= 0) return index;
  }

  // Fallback: look for any column containing 'time' or 'date'
  const fallbackIndex = headers.findIndex(h => 
    h.toLowerCase().includes('time') || h.toLowerCase().includes('date')
  );
  
  return fallbackIndex >= 0 ? fallbackIndex : 0; // Default to first column if nothing found
}

/**
 * Parse individual data row with type conversion and validation
 */
function parseDataRow(
  line: string,
  headers: string[],
  timeColumnIndex: number,
  fileType: FileType,
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY'
): ParsedDataPoint | null {
  // Handle CSV with potential quoted values and commas within quotes
  const values = parseCSVLine(line);
  
  if (values.length !== headers.length) {
    // Try to handle mismatched columns gracefully
    if (values.length < headers.length) {
      // Pad with empty values
      while (values.length < headers.length) {
        values.push('');
      }
    } else {
      // Truncate excess values
      values.splice(headers.length);
    }
  }

  const dataPoint: ParsedDataPoint = { time: '' };
  let hasValidTime = false;

  headers.forEach((header, index) => {
    const rawValue = values[index]?.trim() || '';

    if (index === timeColumnIndex) {
      // Handle time column
      const processedTime = processTimeValue(rawValue, fileType, dateFormat);
      dataPoint.time = processedTime;
      hasValidTime = processedTime !== '';
    } else {
      // Handle data columns
      const processedValue = processDataValue(rawValue, header, fileType);
      dataPoint[header] = processedValue;
    }
  });

  // Return null if we don't have a valid time value
  return hasValidTime ? dataPoint : null;
}

/**
 * Parse CSV line handling quoted values and embedded commas
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current); // Don't forget the last value
  return values.map(v => v.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
}

/**
 * Process time values with format detection and conversion
 * Handles various formats and ensures ISO 8601 output
 */
function processTimeValue(value: string, fileType: FileType, dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY'): string {
  if (!value || value === '') return '';

  // Clean up the value
  const cleanValue = value.trim();

  // Handle case where time might have only HH:MM format (missing date)
  // This would be invalid - skip these rows
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(cleanValue)) {
    return ''; // Time-only format without date is invalid
  }

  // Check for common date-time formats
  const formats = [
    // ISO 8601 formats (already standard)
    { regex: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, handler: (v: string) => v.endsWith('Z') ? v : v + 'Z' },
    { regex: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{3})?$/, handler: (v: string) => v.replace(' ', 'T') + 'Z' },

    // Date with slash separators: DD/MM/YYYY HH:MM:SS or MM/DD/YYYY HH:MM:SS
    { regex: /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/, handler: (v: string) => {
      const [, d1, d2, year, hour, min, sec] = v.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/)!;
      let result: string;
      let day: string, month: string;

      // Use detected date format
      if (dateFormat === 'DD/MM/YYYY') {
        // Format is DD/MM/YYYY: d1 = day, d2 = month
        day = d1;
        month = d2;
        result = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
      } else {
        // Format is MM/DD/YYYY: d1 = month, d2 = day
        month = d1;
        day = d2;
        result = `${year}-${month}-${day}T${hour}:${min}:${sec}Z`;
      }
      console.log(`[TIME CONVERSION] Input: "${v}" | Format: ${dateFormat} | d1=${d1}, d2=${d2} | Interpreted as: day=${day}, month=${month} | Output: ${result}`);
      return result;
    }},

    // Date only formats - add midnight time
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, handler: (v: string) => v + 'T00:00:00Z' },
    { regex: /^(\d{2}\/\d{2}\/\d{4})$/, handler: (v: string) => {
      const [, d1, d2, year] = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)!;
      let result: string;
      // Use detected date format
      if (dateFormat === 'DD/MM/YYYY') {
        // d1 = day, d2 = month -> ISO format YYYY-MM-DD
        result = `${year}-${d2}-${d1}T00:00:00Z`;
      } else {
        // MM/DD/YYYY format: d1 = month, d2 = day -> ISO format YYYY-MM-DD
        result = `${year}-${d1}-${d2}T00:00:00Z`;
      }
      console.log(`[TIME CONVERSION] Input: "${v}" | Format: ${dateFormat} | d1=${d1}, d2=${d2} | Output: ${result}`);
      return result;
    }},

    // Excel serial date number (days since 1900-01-01)
    { regex: /^\d{5,6}(\.\d+)?$/, handler: (v: string) => {
      const serial = parseFloat(v);
      // Excel epoch: 1900-01-01 (but Excel incorrectly treats 1900 as leap year)
      const epoch = new Date(1899, 11, 30); // 30 Dec 1899
      const date = new Date(epoch.getTime() + serial * 86400000);
      return date.toISOString();
    }},
  ];

  // Try each format handler
  for (const format of formats) {
    if (format.regex.test(cleanValue)) {
      try {
        const converted = format.handler(cleanValue);
        const testDate = new Date(converted);
        if (!isNaN(testDate.getTime()) && testDate.getFullYear() >= 1970 && testDate.getFullYear() <= 2100) {
          return converted;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // Try native Date parsing as last resort
  try {
    const directDate = new Date(cleanValue);
    if (!isNaN(directDate.getTime()) && directDate.getFullYear() >= 1970 && directDate.getFullYear() <= 2100) {
      return directDate.toISOString();
    }
  } catch (e) {
    // Parsing failed
  }

  // If all parsing fails, return empty string to filter out this row
  return '';
}

/**
 * Process data values with type conversion
 */
function processDataValue(value: string, header: string, fileType: FileType): string | number | null {
  if (!value || value === '' || value.toLowerCase() === 'null' || value.toLowerCase() === 'na') {
    return null;
  }

  // Try to convert to number if it looks like a number
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && isFinite(numValue)) {
    return numValue;
  }

  // Return as string for non-numeric values
  return value;
}

/**
 * Merge multiple CSV files of the same type
 */
export async function parseMultipleCSVFiles(
  files: File[],
  fileType: FileType,
  dateFormatOverride?: 'DD/MM/YYYY' | 'MM/DD/YYYY'
): Promise<ParseResult> {
  if (files.length === 0) {
    return {
      data: [],
      headers: [],
      errors: ['No files provided'],
      summary: { totalRows: 0, validRows: 0, columns: 0, timeColumn: null }
    };
  }

  if (files.length === 1) {
    return parseCSVFile(files[0], fileType, dateFormatOverride);
  }

  // Parse all files
  const results = await Promise.all(files.map(file => parseCSVFile(file, fileType, dateFormatOverride)));
  
  // Merge results
  const mergedResult: ParseResult = {
    data: [],
    headers: results[0]?.headers || [],
    errors: [],
    summary: {
      totalRows: 0,
      validRows: 0,
      columns: results[0]?.headers.length || 0,
      timeColumn: results[0]?.summary.timeColumn || null,
    }
  };

  results.forEach((result, index) => {
    mergedResult.data.push(...result.data);
    mergedResult.errors.push(...result.errors.map(err => `File ${index + 1}: ${err}`));
    mergedResult.summary.totalRows += result.summary.totalRows;
    mergedResult.summary.validRows += result.summary.validRows;
  });

  // Sort merged data by time
  if (mergedResult.data.length > 0 && mergedResult.summary.timeColumn) {
    try {
      mergedResult.data.sort((a, b) => {
        const timeA = new Date(a.time).getTime();
        const timeB = new Date(b.time).getTime();
        return timeA - timeB;
      });
    } catch (sortError) {
      mergedResult.errors.push('Warning: Could not sort merged data by time');
    }
  }

  return mergedResult;
}

/**
 * Extract time range from parsed data for Open Meteo API requests
 * Returns { start, end } in ISO format, or null if no valid times found
 */
export function extractTimeRange(data: ParsedDataPoint[]): { start: string; end: string } | null {
  if (data.length === 0) return null;

  const validTimes = data
    .map(point => {
      try {
        const date = new Date(point.time);
        return !isNaN(date.getTime()) ? date : null;
      } catch {
        return null;
      }
    })
    .filter((d): d is Date => d !== null);

  if (validTimes.length === 0) return null;

  const sortedTimes = validTimes.sort((a, b) => a.getTime() - b.getTime());
  const start = sortedTimes[0];
  const end = sortedTimes[sortedTimes.length - 1];

  return {
    start: start.toISOString().split('T')[0], // YYYY-MM-DD format for Open Meteo
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Validate if a time string is in proper ISO 8601 format
 */
export function isValidTimeFormat(timeStr: string): boolean {
  if (!timeStr) return false;
  try {
    const date = new Date(timeStr);
    return !isNaN(date.getTime()) && date.getFullYear() >= 1970 && date.getFullYear() <= 2100;
  } catch {
    return false;
  }
}
