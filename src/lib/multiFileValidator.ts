/**
 * Multi-file validation and merging utility
 * Validates that multiple CSV files are compatible for merging and combines them
 */

/**
 * Helper function to extract date portion from filename (e.g., ALGA_FPOD_C_S_2406_2407_24hr.csv -> 2406_2407)
 */
function extractDateFromFilename(filename: string): string {
  // Match pattern like 2406_2407 or 2410_2412, etc.
  const match = filename.match(/(\d{4}_\d{4})/);
  return match ? match[1] : filename.replace(/\.[^/.]+$/, ''); // fallback to filename without extension
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type MergeMode = 'sequential' | 'stack-parameters';

export interface ParsedFileData {
  fileName: string;
  headers: string[];
  data: Record<string, any>[];
  timeColumn: string;
}

export interface MergedData {
  headers: string[];
  data: Record<string, any>[];
  timeColumn: string;
  sourceFiles: string[];
}

/**
 * Parse a CSV file and extract headers and data
 */
export async function parseFile(file: File): Promise<ParsedFileData> {
  const Papa = await import('papaparse');
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`Parse error in ${file.name}: ${results.errors[0].message}`));
          return;
        }

        const headers = results.meta.fields || [];
        if (headers.length === 0) {
          reject(new Error(`No headers found in ${file.name}`));
          return;
        }

        // Assume first column is time/x-axis
        const timeColumn = headers[0];

        resolve({
          fileName: file.name,
          headers,
          data: results.data as Record<string, any>[],
          timeColumn,
        });
      },
      error: (error) => {
        reject(new Error(`Failed to parse ${file.name}: ${error.message}`));
      },
    });
  });
}

/**
 * Validate that multiple files are compatible for merging
 */
export function validateFilesCompatibility(parsedFiles: ParsedFileData[], mode: MergeMode = 'sequential'): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (parsedFiles.length < 2) {
    errors.push('At least 2 files are required for merging');
    return { isValid: false, errors, warnings };
  }

  const firstFile = parsedFiles[0];

  // Check 1: Same file extension
  const firstExtension = firstFile.fileName.split('.').pop()?.toLowerCase();
  for (const file of parsedFiles.slice(1)) {
    const extension = file.fileName.split('.').pop()?.toLowerCase();
    if (extension !== firstExtension) {
      errors.push(`File extension mismatch: ${firstFile.fileName} (${firstExtension}) vs ${file.fileName} (${extension})`);
    }
  }

  // Check 2: Same time/x-axis column (first column should match)
  const firstTimeColumn = firstFile.timeColumn;
  for (const file of parsedFiles.slice(1)) {
    if (file.timeColumn !== firstTimeColumn) {
      errors.push(`Time column mismatch: ${firstFile.fileName} uses "${firstTimeColumn}", ${file.fileName} uses "${file.timeColumn}"`);
    }
  }

  // Mode-specific validation
  if (mode === 'sequential') {
    // Check 3: Same number of columns (for sequential merge)
    const firstColumnCount = firstFile.headers.length;
    for (const file of parsedFiles.slice(1)) {
      if (file.headers.length !== firstColumnCount) {
        errors.push(`Column count mismatch: ${firstFile.fileName} has ${firstColumnCount} columns, ${file.fileName} has ${file.headers.length} columns`);
      }
    }

    // Check 4: Same header structure (excluding time column)
    const firstDataHeaders = firstFile.headers.slice(1).sort();
    for (const file of parsedFiles.slice(1)) {
      const dataHeaders = file.headers.slice(1).sort();
      if (JSON.stringify(firstDataHeaders) !== JSON.stringify(dataHeaders)) {
        errors.push(`Header mismatch: ${firstFile.fileName} and ${file.fileName} have different parameter names`);
        warnings.push(`Expected headers: ${firstDataHeaders.join(', ')}`);
        warnings.push(`Found headers in ${file.fileName}: ${dataHeaders.join(', ')}`);
      }
    }

    // Check 5: Warn if files have overlapping time ranges
    const timeRanges = parsedFiles.map(file => {
      const times = file.data.map(row => new Date(row[file.timeColumn]).getTime()).filter(t => !isNaN(t));
      return {
        fileName: file.fileName,
        min: Math.min(...times),
        max: Math.max(...times),
      };
    });

    for (let i = 0; i < timeRanges.length; i++) {
      for (let j = i + 1; j < timeRanges.length; j++) {
        const range1 = timeRanges[i];
        const range2 = timeRanges[j];

        // Check for overlap
        if (
          (range1.min <= range2.max && range1.max >= range2.min) ||
          (range2.min <= range1.max && range2.max >= range1.min)
        ) {
          warnings.push(`Time range overlap detected between ${range1.fileName} and ${range2.fileName} - data may be duplicated`);
        }
      }
    }
  } else if (mode === 'stack-parameters') {
    // For stacked parameters, check that files have overlapping time ranges
    const timeRanges = parsedFiles.map(file => {
      const times = file.data.map(row => new Date(row[file.timeColumn]).getTime()).filter(t => !isNaN(t));
      return {
        fileName: file.fileName,
        min: Math.min(...times),
        max: Math.max(...times),
        times: new Set(times),
      };
    });

    // Find common time points
    const commonTimes = Array.from(timeRanges[0].times).filter(time =>
      timeRanges.every(range => range.times.has(time))
    );

    // Check if this is a 24hr merge (all files end with _24hr.csv)
    const is24hrMerge = parsedFiles.every(file => file.fileName.endsWith('_24hr.csv'));

    if (commonTimes.length === 0) {
      if (is24hrMerge) {
        // Special case for 24hr files: allow no overlap and use index mapping
        warnings.push('No time overlap found. Will use time values from first file and map parameters by position (24hr rule).');
      } else {
        errors.push('No common time points found across all files. Files must have matching timestamps for parameter stacking.');
      }
    } else if (commonTimes.length < 10 && !is24hrMerge) {
      warnings.push(`Only ${commonTimes.length} common time points found. Consider using Sequential Merge if files cover different time periods.`);
    }

    // Check for sufficient overlap (skip for 24hr files with no overlap)
    if (commonTimes.length > 0 || !is24hrMerge) {
      const overlapPercentages = timeRanges.map((range, idx) => {
        const overlap = (commonTimes.length / range.times.size) * 100;
        return {
          fileName: parsedFiles[idx].fileName,
          overlap: overlap.toFixed(1),
        };
      });

      for (const { fileName, overlap } of overlapPercentages) {
        if (parseFloat(overlap) < 50 && !is24hrMerge) {
          warnings.push(`${fileName} has only ${overlap}% time overlap with other files`);
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Merge multiple parsed files into a single dataset (Sequential Mode)
 * Combines data from all files, preserving all time points
 */
function mergeFilesSequential(parsedFiles: ParsedFileData[]): MergedData {
  if (parsedFiles.length === 0) {
    throw new Error('No files to merge');
  }

  const firstFile = parsedFiles[0];
  const timeColumn = firstFile.timeColumn;

  // Create a map of time -> combined data row
  const mergedDataMap = new Map<string, Record<string, any>>();

  // Collect all data from all files
  for (const file of parsedFiles) {
    for (const row of file.data) {
      const timeValue = row[timeColumn];
      if (!timeValue) continue;

      const timeKey = new Date(timeValue).toISOString();

      if (!mergedDataMap.has(timeKey)) {
        mergedDataMap.set(timeKey, {
          [timeColumn]: timeKey,
        });
      }

      const mergedRow = mergedDataMap.get(timeKey)!;

      // Copy all parameter values from this row
      for (const header of file.headers) {
        if (header !== timeColumn) {
          // Add source file suffix if value already exists (to differentiate duplicate parameters)
          const sourceIdentifier = extractDateFromFilename(file.fileName);
          const paramKey = mergedRow[header] !== undefined
            ? `${header} [${sourceIdentifier}]`
            : header;

          mergedRow[paramKey] = row[header];
        }
      }
    }
  }

  // Convert map to sorted array
  const mergedDataArray = Array.from(mergedDataMap.values()).sort((a, b) => {
    const timeA = new Date(a[timeColumn]).getTime();
    const timeB = new Date(b[timeColumn]).getTime();
    return timeA - timeB;
  });

  // Get all unique headers (excluding time column)
  const allHeaders = new Set<string>();
  for (const row of mergedDataArray) {
    for (const key of Object.keys(row)) {
      if (key !== timeColumn) {
        allHeaders.add(key);
      }
    }
  }

  const headers = [timeColumn, ...Array.from(allHeaders).sort()];

  return {
    headers,
    data: mergedDataArray,
    timeColumn,
    sourceFiles: parsedFiles.map(f => f.fileName),
  };
}

/**
 * Merge multiple parsed files by stacking parameters (Stack Parameters Mode)
 * Combines all parameters from all files on a common time axis
 * Only includes time points that exist in ALL files
 * Special case: For 24hr files with no overlap, uses first file's times and maps second file's values
 */
function mergeFilesStackParameters(parsedFiles: ParsedFileData[]): MergedData {
  if (parsedFiles.length === 0) {
    throw new Error('No files to merge');
  }

  const firstFile = parsedFiles[0];
  const timeColumn = firstFile.timeColumn;

  // Check if this is a 24hr merge (all files end with _24hr.csv)
  const is24hrMerge = parsedFiles.every(file => file.fileName.endsWith('_24hr.csv'));

  // Build time maps for each file
  const fileMaps = parsedFiles.map(file => {
    const map = new Map<string, Record<string, any>>();
    for (const row of file.data) {
      const timeValue = row[timeColumn];
      if (!timeValue) continue;
      const timeKey = new Date(timeValue).toISOString();
      map.set(timeKey, row);
    }
    return { file, map };
  });

  // Find common time points (intersection)
  const firstFileTimeKeys = Array.from(fileMaps[0].map.keys());
  const commonTimeKeys = firstFileTimeKeys.filter(timeKey =>
    fileMaps.every(({ map }) => map.has(timeKey))
  );

  console.log(`Stack Parameters Merge: ${commonTimeKeys.length} common time points found from ${firstFileTimeKeys.length} total`);

  // Special handling for 24hr files with no overlap: use first file's times and map by index
  let timeKeysToUse = commonTimeKeys;
  let useIndexMapping = false;

  if (is24hrMerge && commonTimeKeys.length === 0) {
    console.log('24hr merge with no time overlap detected - using first file times and index mapping');
    timeKeysToUse = firstFileTimeKeys;
    useIndexMapping = true;
  }

  // Build merged data with stacked parameters
  const mergedDataArray: Record<string, any>[] = [];
  const allParameterHeaders: string[] = [];

  // Collect all parameter headers with source labels
  for (const { file } of fileMaps) {
    const sourceIdentifier = extractDateFromFilename(file.fileName);
    const parameters = file.headers.filter(h => h !== timeColumn);

    for (const param of parameters) {
      allParameterHeaders.push(`${param} [${sourceIdentifier}]`);
    }
  }

  // Create merged rows
  for (let i = 0; i < timeKeysToUse.length; i++) {
    const timeKey = timeKeysToUse[i];
    const mergedRow: Record<string, any> = {
      [timeColumn]: timeKey,
    };

    // Add parameters from each file
    for (let fileIdx = 0; fileIdx < fileMaps.length; fileIdx++) {
      const { file, map } = fileMaps[fileIdx];
      const sourceIdentifier = extractDateFromFilename(file.fileName);

      let row;
      if (useIndexMapping && fileIdx > 0) {
        // For 24hr files with no overlap, map by index instead of time
        const fileTimeKeys = Array.from(map.keys());
        const mappedTimeKey = fileTimeKeys[i];
        row = mappedTimeKey ? map.get(mappedTimeKey) : undefined;
      } else {
        // Normal time-based mapping
        row = map.get(timeKey);
      }

      if (row) {
        for (const header of file.headers) {
          if (header !== timeColumn) {
            const paramKey = `${header} [${sourceIdentifier}]`;
            mergedRow[paramKey] = row[header];
          }
        }
      }
    }

    mergedDataArray.push(mergedRow);
  }

  // Sort by time
  mergedDataArray.sort((a, b) => {
    const timeA = new Date(a[timeColumn]).getTime();
    const timeB = new Date(b[timeColumn]).getTime();
    return timeA - timeB;
  });

  const headers = [timeColumn, ...allParameterHeaders];

  console.log(`Stack Parameters Merge Result: ${mergedDataArray.length} rows, ${allParameterHeaders.length} parameters`);

  return {
    headers,
    data: mergedDataArray,
    timeColumn,
    sourceFiles: parsedFiles.map(f => f.fileName),
  };
}

/**
 * Merge multiple parsed files into a single dataset
 * Supports multiple merge modes
 */
export function mergeFiles(parsedFiles: ParsedFileData[], mode: MergeMode = 'sequential'): MergedData {
  if (mode === 'stack-parameters') {
    return mergeFilesStackParameters(parsedFiles);
  }
  return mergeFilesSequential(parsedFiles);
}
