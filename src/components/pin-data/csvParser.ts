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
}

export type FileType = 'GP' | 'FPOD' | 'Subcam';

/**
 * Enhanced CSV parsing with robust error handling
 */
export async function parseCSVFile(file: File, fileType: FileType): Promise<ParseResult> {
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

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      try {
        const rowData = parseDataRow(lines[i], rawHeaders, timeColumnIndex, fileType);
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
  fileType: FileType
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
      const processedTime = processTimeValue(rawValue, fileType);
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
 */
function processTimeValue(value: string, fileType: FileType): string {
  if (!value || value === '') return '';
  
  // Common time format patterns
  const timeFormats = [
    // ISO formats
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
    // Date only
    /^\d{4}-\d{2}-\d{2}$/,
    // Other common formats
    /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/,
    /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}/,
  ];

  // Try to parse as-is first
  const directDate = new Date(value);
  if (!isNaN(directDate.getTime())) {
    return directDate.toISOString();
  }

  // Try different format interpretations
  for (const format of timeFormats) {
    if (format.test(value)) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  // If all else fails, return the original value and let the chart handle it
  return value;
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
export async function parseMultipleCSVFiles(files: File[], fileType: FileType): Promise<ParseResult> {
  if (files.length === 0) {
    return {
      data: [],
      headers: [],
      errors: ['No files provided'],
      summary: { totalRows: 0, validRows: 0, columns: 0, timeColumn: null }
    };
  }

  if (files.length === 1) {
    return parseCSVFile(files[0], fileType);
  }

  // Parse all files
  const results = await Promise.all(files.map(file => parseCSVFile(file, fileType)));
  
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