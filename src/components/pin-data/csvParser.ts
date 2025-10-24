/**
 * CSV Parser Utilities for GP, FPOD, and Subcam data files
 * Handles different file formats and data structures
 */

import { detectSampleIdColumn } from '@/lib/statistical-utils';

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
  // Optional: Auto-detected sample ID column (for spot-sample data)
  detectedSampleIdColumn?: string | null;
  // Diagnostic logs for debugging (shown in error UI)
  diagnosticLogs?: string[];
}

export type FileType = 'GP' | 'FPOD' | 'Subcam';

/**
 * Detect date format (DD/MM/YYYY vs MM/DD/YYYY) by analyzing date values
 * Examines first several rows to determine which format is being used
 */
function detectDateFormat(lines: string[], timeColumnIndex: number, startRow: number = 1): 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' {
  const sampleSize = Math.min(20, lines.length - startRow); // Check up to 20 data rows
  const dateValues: string[] = [];
  const isoDateValues: string[] = [];

  console.log('═══════════════════════════════════════════════════════');
  console.log('[DATE DETECTION] Starting date format detection...');
  console.log('[DATE DETECTION] Time column index:', timeColumnIndex);
  console.log('[DATE DETECTION] Start row:', startRow);
  console.log('[DATE DETECTION] Sample size:', sampleSize);
  console.log('═══════════════════════════════════════════════════════');

  // Extract date values from sample rows (starting from the first data row)
  for (let i = startRow; i < startRow + sampleSize && i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values[timeColumnIndex]) {
      const timeValue = values[timeColumnIndex].trim();
      // Extract just the date part if it has time component
      const datePart = timeValue.split(' ')[0];

      // Check for ISO format (YYYY-MM-DD with dashes)
      if (datePart.includes('-')) {
        const parts = datePart.split('-');
        // ISO format has year first (4 digits) followed by month and day
        if (parts.length === 3 && parts[0].length === 4) {
          isoDateValues.push(datePart);
        }
      }
      // Check for slash-separated dates (DD/MM/YYYY or MM/DD/YYYY)
      else if (datePart.includes('/')) {
        dateValues.push(datePart);
      }
    }
  }

  console.log('[DATE DETECTION] Slash-separated dates found:', dateValues.length);
  console.log('[DATE DETECTION] Sample slash dates:', dateValues.slice(0, 5));
  console.log('[DATE DETECTION] ISO format dates found:', isoDateValues.length);
  console.log('[DATE DETECTION] Sample ISO dates:', isoDateValues.slice(0, 5));

  // Priority 1: If we found ISO format dates, use that
  if (isoDateValues.length > 0) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[DATE DETECTION] ✓ Detected format: YYYY-MM-DD (ISO format)');
    console.log('═══════════════════════════════════════════════════════');
    return 'YYYY-MM-DD';
  }

  // Priority 2: Process slash-separated dates
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
    console.log('═══════════════════════════════════════════════════════');
    console.log('[DATE DETECTION] ✓ Detected format: DD/MM/YYYY (Rule 1: first > 12)');
    console.log('═══════════════════════════════════════════════════════');
    return 'DD/MM/YYYY';
  }

  // Rule 2: If second component > 12, must be MM/DD/YYYY
  if (hasSecondComponentOver12 && !hasFirstComponentOver12) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[DATE DETECTION] ✓ Detected format: MM/DD/YYYY (Rule 2: second > 12)');
    console.log('═══════════════════════════════════════════════════════');
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
      console.log('═══════════════════════════════════════════════════════');
      console.log('[DATE DETECTION] ✓ Detected format: DD/MM/YYYY (Rule 3: first has more variety)');
      console.log('═══════════════════════════════════════════════════════');
      return 'DD/MM/YYYY';
    }

    // If second component has wider range and more variety, likely to be days
    if (secondRange > firstRange && secondUnique > firstUnique) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('[DATE DETECTION] ✓ Detected format: MM/DD/YYYY (Rule 3: second has more variety)');
      console.log('═══════════════════════════════════════════════════════');
      return 'MM/DD/YYYY';
    }
  }

  // Default to European format (DD/MM/YYYY) if still ambiguous
  console.log('═══════════════════════════════════════════════════════');
  console.log('[DATE DETECTION] ✓ Using default format: DD/MM/YYYY (ambiguous case)');
  console.log('═══════════════════════════════════════════════════════');
  return 'DD/MM/YYYY';
}

/**
 * Detect the correct header row for eDNA _Meta files
 * These files have a special structure with metadata rows before the actual headers
 */
function detectEdnaMetaHeaderRow(lines: string[], fileName: string): { rowIndex: number; logs: string[] } {
  const logs: string[] = [];

  // Check if this is an eDNA _Meta file
  if (!fileName.toLowerCase().includes('edna') ||
      !(fileName.toLowerCase().includes('_meta') || fileName.toLowerCase().includes('_metadata'))) {
    logs.push('📄 Not an eDNA _Meta file, using first row as header');
    return { rowIndex: 0, logs }; // Not an eDNA _Meta file, use first row
  }

  logs.push('🔍 eDNA _Meta file detected, scanning for actual header row...');

  // Expected eDNA concentration parameter names to look for
  const expectedParams = [
    'edna concentration',
    'dna concentration',
    '18sssu marker concentration',
    'coilb marker concentration',
    'marker concentration'
  ];

  // Scan first 10 rows to find the row containing these parameter names
  const scanLimit = Math.min(10, lines.length);
  logs.push(`📊 Scanning first ${scanLimit} rows for concentration parameter names...`);

  for (let i = 0; i < scanLimit; i++) {
    const lineText = lines[i].toLowerCase();

    // Check if this line contains at least 2 of the expected parameter names
    const matchCount = expectedParams.filter(param => lineText.includes(param)).length;

    if (matchCount > 0) {
      logs.push(`  Row ${i}: Found ${matchCount} parameter match(es)`);
    }

    if (matchCount >= 2) {
      logs.push(`✅ Found eDNA header row at line ${i}`);
      logs.push(`📋 Header preview: ${lines[i].substring(0, 150)}...`);
      console.log(`[CSV PARSER] ✅ Found eDNA header row at line ${i}`);
      console.log(`[CSV PARSER] Header row preview: ${lines[i].substring(0, 200)}...`);
      return { rowIndex: i, logs };
    }
  }

  logs.push('⚠️ Could not find eDNA concentration parameters, using first row as header');
  console.log('[CSV PARSER] ⚠️ Could not find eDNA concentration parameters, using first row as header');
  return { rowIndex: 0, logs };
}

/**
 * Enhanced CSV parsing with robust error handling
 */
export async function parseCSVFile(
  file: File,
  fileType: FileType,
  dateFormatOverride?: 'DD/MM/YYYY' | 'MM/DD/YYYY'
): Promise<ParseResult> {
  const diagnosticLogs: string[] = [];

  const result: ParseResult = {
    data: [],
    headers: [],
    errors: [],
    summary: {
      totalRows: 0,
      validRows: 0,
      columns: 0,
      timeColumn: null,
    },
    diagnosticLogs: diagnosticLogs
  };

  try {
    const text = await file.text();
    const lines = text.trim().split('\n').filter(line => line.trim() !== '');

    if (lines.length === 0) {
      result.errors.push('File is empty');
      diagnosticLogs.push('❌ File is empty');
      return result;
    }

    diagnosticLogs.push(`📁 File: ${file.name}`);
    diagnosticLogs.push(`📊 Total lines in file: ${lines.length}`);

    // Detect the correct header row (important for eDNA _Meta files)
    const headerDetection = detectEdnaMetaHeaderRow(lines, file.name);
    diagnosticLogs.push(...headerDetection.logs);
    const headerRowIndex = headerDetection.rowIndex;

    // Parse headers with cleaning
    const rawHeaders = lines[headerRowIndex].split(',').map(h => h.trim().replace(/"/g, ''));
    result.headers = rawHeaders;
    result.summary.columns = rawHeaders.length;
    result.summary.totalRows = lines.length - headerRowIndex - 1;

    diagnosticLogs.push(`✅ Using row ${headerRowIndex} as header row`);
    diagnosticLogs.push(`📋 Detected ${rawHeaders.length} columns: ${rawHeaders.slice(0, 5).join(', ')}${rawHeaders.length > 5 ? '...' : ''}`);

    console.log(`[CSV PARSER] Using row ${headerRowIndex} as header row`);
    console.log(`[CSV PARSER] Headers detected:`, rawHeaders.slice(0, 10));

    // Detect time column with multiple strategies
    const timeColumnIndex = detectTimeColumn(rawHeaders, fileType);
    if (timeColumnIndex >= 0) {
      result.summary.timeColumn = rawHeaders[timeColumnIndex];
      diagnosticLogs.push(`🕒 Time column detected: "${rawHeaders[timeColumnIndex]}" (index ${timeColumnIndex})`);
    } else {
      result.errors.push(`No time column detected for ${fileType} data`);
      diagnosticLogs.push(`⚠️ No time column detected for ${fileType} data`);
    }

    // Detect sample ID column (for spot-sample data like CROP, CHEM, WQ, EDNA)
    result.detectedSampleIdColumn = detectSampleIdColumn(rawHeaders);
    if (result.detectedSampleIdColumn) {
      diagnosticLogs.push(`🏷️ Sample ID column detected: "${result.detectedSampleIdColumn}"`);
      console.log('[CSV PARSER] Detected sample ID column:', result.detectedSampleIdColumn);
    }

    // Parse data rows (start from the row after the header row)
    const dataStartRow = headerRowIndex + 1;
    diagnosticLogs.push(`📍 Data starts at row ${dataStartRow} (after header at row ${headerRowIndex})`);
    console.log(`[CSV PARSER] Data starts at row ${dataStartRow}`);

    // Use override if provided, otherwise detect date format by analyzing sample data
    const dateFormat = dateFormatOverride || detectDateFormat(lines, timeColumnIndex, dataStartRow);
    diagnosticLogs.push(`📅 Date format: ${dateFormat} ${dateFormatOverride ? '(override)' : '(auto-detected)'}`);
    console.log('[CSV PARSER] Using date format:', dateFormat, dateFormatOverride ? '(override)' : '(detected)');

    for (let i = dataStartRow; i < lines.length; i++) {
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

    diagnosticLogs.push(`✅ Parsing complete: ${result.summary.validRows} valid rows out of ${result.summary.totalRows} total rows`);

    if (result.summary.validRows === 0 && result.summary.totalRows > 0) {
      diagnosticLogs.push(`❌ No valid data rows were parsed! This may indicate:`);
      diagnosticLogs.push(`   • Data types don't match expected format`);
      diagnosticLogs.push(`   • Date values can't be parsed`);
      diagnosticLogs.push(`   • Wrong header row was selected`);
    }

    // Validate and sort by time if possible
    if (result.data.length > 0 && result.summary.timeColumn) {
      try {
        result.data.sort((a, b) => {
          const timeA = new Date(a.time).getTime();
          const timeB = new Date(b.time).getTime();
          return timeA - timeB;
        });
        diagnosticLogs.push(`🔄 Data sorted by time column`);
      } catch (sortError) {
        result.errors.push('Warning: Could not sort data by time');
        diagnosticLogs.push(`⚠️ Could not sort data by time`);
      }
    }

  } catch (fileError) {
    const errorMsg = `File reading error: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    diagnosticLogs.push(`❌ ${errorMsg}`);
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
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
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
function processTimeValue(value: string, fileType: FileType, dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'): string {
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

    // YYYY/MM/DD format with time (year-first with slashes) - handle before DD/MM/YYYY
    { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/, handler: (v: string) => {
      const match = v.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
      if (!match) return '';
      const [, year, month, day, hour, min, sec] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:${sec}Z`;
    }},

    // Date with slash separators: DD/MM/YYYY HH:MM (no seconds) - MUST come before HH:MM:SS
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/, handler: (v: string) => {
      const match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
      if (!match) return '';
      const [, d1, d2, year, hour, min] = match;
      const sec = '00'; // Default seconds to 00
      let result: string;
      let day: string, month: string;

      // Use detected date format
      if (dateFormat === 'DD/MM/YYYY') {
        // Format is DD/MM/YYYY: d1 = day, d2 = month
        day = d1.padStart(2, '0');
        month = d2.padStart(2, '0');
        result = `${year}-${month}-${day}T${hour.padStart(2, '0')}:${min}:${sec}Z`;
      } else {
        // Format is MM/DD/YYYY: d1 = month, d2 = day
        month = d1.padStart(2, '0');
        day = d2.padStart(2, '0');
        result = `${year}-${month}-${day}T${hour.padStart(2, '0')}:${min}:${sec}Z`;
      }
      console.log(`[TIME CONVERSION HH:MM] Input: "${v}" | Format: ${dateFormat} | d1=${d1}, d2=${d2} | Interpreted as: day=${day}, month=${month} | Output: ${result}`);
      return result;
    }},

    // Date with slash separators: DD/MM/YYYY HH:MM:SS or MM/DD/YYYY HH:MM:SS
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/, handler: (v: string) => {
      const match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
      if (!match) return '';
      const [, d1, d2, year, hour, min, sec] = match;
      let result: string;
      let day: string, month: string;

      // Use detected date format
      if (dateFormat === 'DD/MM/YYYY') {
        // Format is DD/MM/YYYY: d1 = day, d2 = month
        day = d1.padStart(2, '0');
        month = d2.padStart(2, '0');
        result = `${year}-${month}-${day}T${hour.padStart(2, '0')}:${min}:${sec}Z`;
      } else {
        // Format is MM/DD/YYYY: d1 = month, d2 = day
        month = d1.padStart(2, '0');
        day = d2.padStart(2, '0');
        result = `${year}-${month}-${day}T${hour.padStart(2, '0')}:${min}:${sec}Z`;
      }
      console.log(`[TIME CONVERSION HH:MM:SS] Input: "${v}" | Format: ${dateFormat} | d1=${d1}, d2=${d2} | Interpreted as: day=${day}, month=${month} | Output: ${result}`);
      return result;
    }},

    // Date only formats - add midnight time
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, handler: (v: string) => v + 'T00:00:00Z' },

    // Date only with 4-digit year: DD/MM/YYYY or MM/DD/YYYY
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, handler: (v: string) => {
      const match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!match) return '';
      const [, d1, d2, year] = match;
      let result: string;
      let day: string, month: string;

      // Use detected date format
      if (dateFormat === 'DD/MM/YYYY') {
        // d1 = day, d2 = month -> ISO format YYYY-MM-DD
        day = d1.padStart(2, '0');
        month = d2.padStart(2, '0');
        result = `${year}-${month}-${day}T00:00:00Z`;
      } else {
        // MM/DD/YYYY format: d1 = month, d2 = day -> ISO format YYYY-MM-DD
        month = d1.padStart(2, '0');
        day = d2.padStart(2, '0');
        result = `${year}-${month}-${day}T00:00:00Z`;
      }
      console.log(`[TIME CONVERSION DATE-ONLY 4Y] Input: "${v}" | Format: ${dateFormat} | d1=${d1}, d2=${d2} | Interpreted as: day=${day}, month=${month} | Output: ${result}`);
      return result;
    }},

    // Date only with 2-digit year: DD/MM/YY or MM/DD/YY (e.g., "10/04/25")
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/, handler: (v: string) => {
      const match = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (!match) return '';
      const [, d1, d2, yy] = match;
      let result: string;
      let day: string, month: string;

      // Convert 2-digit year to 4-digit year (e.g., 25 -> 2025)
      const yearNum = parseInt(yy, 10);
      const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;

      // Use detected date format
      if (dateFormat === 'DD/MM/YYYY') {
        // Format is DD/MM/YY: d1 = day, d2 = month
        day = d1.padStart(2, '0');
        month = d2.padStart(2, '0');
        result = `${fullYear}-${month}-${day}T00:00:00Z`;
      } else {
        // Format is MM/DD/YY: d1 = month, d2 = day
        month = d1.padStart(2, '0');
        day = d2.padStart(2, '0');
        result = `${fullYear}-${month}-${day}T00:00:00Z`;
      }
      console.log(`[TIME CONVERSION DATE-ONLY 2Y] Input: "${v}" | Format: ${dateFormat} | YY=${yy} -> ${fullYear} | d1=${d1}, d2=${d2} | Interpreted as: day=${day}, month=${month} | Output: ${result}`);
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

        // Validate date is valid and reasonable
        if (!isNaN(testDate.getTime()) && testDate.getFullYear() >= 1970 && testDate.getFullYear() <= 2100) {
          // Additional validation: check that the ISO string matches expected pattern
          // This catches cases like "2025-15-04" which get auto-corrected by Date
          const isoMatch = converted.match(/^(\d{4})-(\d{2})-(\d{2})T/);
          if (isoMatch) {
            const [, isoYear, isoMonth, isoDay] = isoMatch;
            const monthNum = parseInt(isoMonth, 10);
            const dayNum = parseInt(isoDay, 10);

            // Month must be 1-12, day must be 1-31
            if (monthNum < 1 || monthNum > 12) {
              console.warn(`[TIME VALIDATION] Invalid month detected: ${monthNum} in "${converted}" from "${cleanValue}"`);
              continue;
            }
            if (dayNum < 1 || dayNum > 31) {
              console.warn(`[TIME VALIDATION] Invalid day detected: ${dayNum} in "${converted}" from "${cleanValue}"`);
              continue;
            }

            // Verify that parsing back gives us the same month/day (catches auto-correction)
            if (testDate.getUTCMonth() + 1 !== monthNum || testDate.getUTCDate() !== dayNum) {
              console.warn(`[TIME VALIDATION] Date auto-corrected by JS Date: "${converted}" -> Month ${testDate.getUTCMonth()+1}, Day ${testDate.getUTCDate()}`);
              continue;
            }
          }

          return converted;
        }
      } catch (e) {
        continue;
      }
    }
  }

  // DON'T use native Date parsing - it assumes MM/DD/YYYY for ambiguous formats
  // This was causing DD/MM/YYYY dates to be parsed incorrectly
  // Instead, we explicitly require matching one of our known formats above

  // If all parsing fails, log and return empty string to filter out this row
  console.warn(`[TIME PARSING FAILED] Could not parse time value: "${cleanValue}" with format ${dateFormat}`);
  return '';
}

/**
 * Process data values with type conversion
 */
function processDataValue(value: string, header: string, fileType: FileType): string | number | null {
  if (!value || value === '' || value.toLowerCase() === 'null' || value.toLowerCase() === 'na') {
    return null;
  }

  // IMPORTANT: Keep identifier columns as strings (don't convert to numbers)
  // These are used as categorical identifiers in spot-sample plots and other contexts
  // Even if they start with numbers (e.g., "1-NE-3"), they must remain strings
  const headerLower = header.toLowerCase().replace(/[\s_-]/g, '');
  const stringIdentifiers = [
    'sample',
    'sampleid',
    'stationid',
    'station',
    'subsetid',
    'subset',
    'farmid',
    'farm',
    'imageid',
    'image',
    'site',
    'siteid',
    'location',
    'locationid'
  ];

  if (stringIdentifiers.some(id => headerLower.includes(id))) {
    return value.trim(); // Return as string, trimmed
  }

  // Try to convert to number ONLY if it's a pure numeric value
  // This prevents "1-NE-3" from being converted to 1
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && isFinite(numValue)) {
    // Additional check: ensure the stringified number matches the original value
    // This catches cases like "1-NE-3" where parseFloat returns 1
    const trimmedValue = value.trim();
    if (numValue.toString() === trimmedValue || parseFloat(trimmedValue).toString() === trimmedValue) {
      return numValue;
    }
  }

  // Return as string for non-numeric values or complex identifiers
  return value.trim();
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
      summary: { totalRows: 0, validRows: 0, columns: 0, timeColumn: null },
      detectedSampleIdColumn: null
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
    },
    detectedSampleIdColumn: results[0]?.detectedSampleIdColumn || null
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
