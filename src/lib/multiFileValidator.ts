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

/**
 * Helper function to extract station name from filename (e.g., ALGA_FPOD_C_S_2406_2407_24hr.csv -> C_S)
 * Expected format: PROJECTNAME_DATATYPE_STATION1_STATION2_DATE1_DATE2_SUFFIX
 * Station name is positions 2 and 3 combined with underscore
 */
function extractStationFromFilename(filename: string): string {
  const parts = filename.replace(/\.(csv|txt)$/i, '').split('_');
  // Station is at positions 2 and 3 in the expected format
  return parts.length >= 7 ? `${parts[2]}_${parts[3]}` : '';
}

/**
 * Determine the best identifier for each file in a merge operation
 * For 24hr merges with:
 *   - Same dates + different stations → use station names only
 *   - Different dates + different stations → use both date and station (merge_merge)
 *   - Otherwise → use date ranges only
 */
function getFileIdentifiers(filenames: string[]): Map<string, string> {
  const identifiers = new Map<string, string>();

  // Check if all files are 24hr files
  const is24hrMerge = filenames.every(name =>
    name.replace(/\.(csv|txt)$/i, '').endsWith('_24hr')
  );

  if (is24hrMerge && filenames.length > 1) {
    // Extract stations and date ranges
    const fileInfo = filenames.map(name => ({
      filename: name,
      station: extractStationFromFilename(name),
      dateRange: extractDateFromFilename(name)
    }));

    // Check if all files have the same date range
    const sameDates = fileInfo.every(info => info.dateRange === fileInfo[0].dateRange);

    // Check if files have different stations
    const stations = fileInfo.map(info => info.station);
    const differentStations = !stations.every(station => station === stations[0]);

    // Check if files have different date ranges
    const dateRanges = fileInfo.map(info => info.dateRange);
    const differentDates = !dateRanges.every(range => range === dateRanges[0]);

    if (differentDates && differentStations) {
      // MERGE_MERGE case: Use both date and station as identifiers
      console.log('🏷️ Using BOTH date and station identifiers for merge_merge case:', {
        stations,
        dateRanges
      });

      fileInfo.forEach(info => {
        identifiers.set(info.filename, `${info.dateRange}_${info.station}`);
      });

      return identifiers;
    } else if (sameDates && differentStations) {
      // Use station names as identifiers only
      console.log('🏷️ Using station names as identifiers for same-date 24hr merge:', {
        stations,
        dateRange: fileInfo[0].dateRange
      });

      fileInfo.forEach(info => {
        identifiers.set(info.filename, info.station);
      });

      return identifiers;
    }
  }

  // Default: use date ranges as identifiers
  filenames.forEach(name => {
    identifiers.set(name, extractDateFromFilename(name));
  });

  return identifiers;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export type MergeMode = 'sequential' | 'stack-parameters' | 'std-merge';

export interface ParsedFileData {
  fileName: string;
  headers: string[];
  data: Record<string, any>[];
  timeColumn: string;
  fileId?: string; // Optional file ID for tracking source files
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

  // Get file identifiers (station names for same-date 24hr merges, date ranges otherwise)
  const fileIdentifiers = getFileIdentifiers(parsedFiles.map(f => f.fileName));

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
          const sourceIdentifier = fileIdentifiers.get(file.fileName) || extractDateFromFilename(file.fileName);

          // Format the identifier - if it contains both date and station (merge_merge case), split them
          let formattedIdentifier: string;
          if (sourceIdentifier.includes('_') && /^\d{4}_\d{4}_/.test(sourceIdentifier)) {
            // merge_merge case: "2406_2407_C_S" -> "[2406_2407] [C_S]"
            const match = sourceIdentifier.match(/^(\d{4}_\d{4})_(.+)$/);
            if (match) {
              formattedIdentifier = `[${match[1]}] [${match[2]}]`;
            } else {
              formattedIdentifier = `[${sourceIdentifier}]`;
            }
          } else {
            // Normal case: just wrap in brackets
            formattedIdentifier = `[${sourceIdentifier}]`;
          }

          const paramKey = mergedRow[header] !== undefined
            ? `${header} ${formattedIdentifier}`
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

  // Get file identifiers (station names for same-date 24hr merges, date ranges otherwise)
  const fileIdentifiers = getFileIdentifiers(parsedFiles.map(f => f.fileName));

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
    const sourceIdentifier = fileIdentifiers.get(file.fileName) || extractDateFromFilename(file.fileName);
    const parameters = file.headers.filter(h => h !== timeColumn);

    // Format the identifier - if it contains both date and station (merge_merge case), split them
    let formattedIdentifier: string;
    if (sourceIdentifier.includes('_') && /^\d{4}_\d{4}_/.test(sourceIdentifier)) {
      // merge_merge case: "2406_2407_C_S" -> "[2406_2407] [C_S]"
      const match = sourceIdentifier.match(/^(\d{4}_\d{4})_(.+)$/);
      if (match) {
        formattedIdentifier = `[${match[1]}] [${match[2]}]`;
      } else {
        formattedIdentifier = `[${sourceIdentifier}]`;
      }
    } else {
      // Normal case: just wrap in brackets
      formattedIdentifier = `[${sourceIdentifier}]`;
    }

    for (const param of parameters) {
      allParameterHeaders.push(`${param} ${formattedIdentifier}`);
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
      const sourceIdentifier = fileIdentifiers.get(file.fileName) || extractDateFromFilename(file.fileName);

      // Format the identifier - if it contains both date and station (merge_merge case), split them
      let formattedIdentifier: string;
      if (sourceIdentifier.includes('_') && /^\d{4}_\d{4}_/.test(sourceIdentifier)) {
        // merge_merge case: "2406_2407_C_S" -> "[2406_2407] [C_S]"
        const match = sourceIdentifier.match(/^(\d{4}_\d{4})_(.+)$/);
        if (match) {
          formattedIdentifier = `[${match[1]}] [${match[2]}]`;
        } else {
          formattedIdentifier = `[${sourceIdentifier}]`;
        }
      } else {
        // Normal case: just wrap in brackets
        formattedIdentifier = `[${sourceIdentifier}]`;
      }

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
            const paramKey = `${header} ${formattedIdentifier}`;
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
 * Detect time interval in milliseconds from a dataset
 * Returns the most common interval between consecutive timestamps
 */
function detectTimeInterval(data: Record<string, any>[], timeColumn: string): number {
  if (data.length < 2) return 3600000; // Default to 1 hour if not enough data

  const intervals = new Map<number, number>();

  for (let i = 1; i < Math.min(data.length, 100); i++) {
    const time1 = new Date(data[i - 1][timeColumn]).getTime();
    const time2 = new Date(data[i][timeColumn]).getTime();
    const interval = time2 - time1;

    if (interval > 0) {
      intervals.set(interval, (intervals.get(interval) || 0) + 1);
    }
  }

  // Return the most common interval
  let maxCount = 0;
  let mostCommonInterval = 3600000; // Default 1 hour

  for (const [interval, count] of intervals.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonInterval = interval;
    }
  }

  console.log(`Detected time interval: ${mostCommonInterval}ms (${mostCommonInterval / 1000 / 60} minutes)`);
  return mostCommonInterval;
}

/**
 * Fill time gaps in a dataset with zero values
 * Generates timestamps between gaps using the detected interval
 */
function fillTimeGaps(
  data: Record<string, any>[],
  timeColumn: string,
  dataColumns: string[],
  interval: number
): Record<string, any>[] {
  if (data.length === 0) return data;

  const result: Record<string, any>[] = [];

  for (let i = 0; i < data.length; i++) {
    result.push(data[i]);

    // Check if there's a gap to the next row
    if (i < data.length - 1) {
      const currentTime = new Date(data[i][timeColumn]).getTime();
      const nextTime = new Date(data[i + 1][timeColumn]).getTime();
      const gap = nextTime - currentTime;

      // If gap is larger than 1.5x the interval, fill it
      if (gap > interval * 1.5) {
        console.log(`Filling gap: ${new Date(currentTime).toISOString()} → ${new Date(nextTime).toISOString()}`);

        let fillTime = currentTime + interval;
        while (fillTime < nextTime) {
          const fillRow: Record<string, any> = {
            [timeColumn]: new Date(fillTime).toISOString()
          };

          // Fill all data columns with 0
          for (const col of dataColumns) {
            fillRow[col] = 0;
          }

          result.push(fillRow);
          fillTime += interval;
        }
      }
    }
  }

  console.log(`Gap filling: ${data.length} rows → ${result.length} rows (added ${result.length - data.length} rows)`);
  return result;
}

/**
 * Merge files from the same station sequentially with gap filling
 */
function mergeSameStationFiles(
  files: ParsedFileData[],
  timeColumn: string
): Record<string, any>[] {
  if (files.length === 0) return [];
  if (files.length === 1) return files[0].data;

  // Sort files by earliest timestamp
  const sortedFiles = [...files].sort((a, b) => {
    const timeA = new Date(a.data[0][timeColumn]).getTime();
    const timeB = new Date(b.data[0][timeColumn]).getTime();
    return timeA - timeB;
  });

  // Detect time interval from first file
  const interval = detectTimeInterval(sortedFiles[0].data, timeColumn);

  // Get data columns (all columns except time)
  const dataColumns = sortedFiles[0].headers.filter(h => h !== timeColumn);

  // Combine all data from all files
  let combinedData: Record<string, any>[] = [];
  for (const file of sortedFiles) {
    combinedData = combinedData.concat(file.data);
  }

  // Sort by time
  combinedData.sort((a, b) => {
    const timeA = new Date(a[timeColumn]).getTime();
    const timeB = new Date(b[timeColumn]).getTime();
    return timeA - timeB;
  });

  // Fill gaps
  const filledData = fillTimeGaps(combinedData, timeColumn, dataColumns, interval);

  return filledData;
}

/**
 * Merge multiple parsed files using std_merge mode
 * - Same station files: merge sequentially with gap filling
 * - Different station files: stack parameters with [Station] identifiers
 */
function mergeFilesStdMerge(parsedFiles: ParsedFileData[]): MergedData {
  if (parsedFiles.length === 0) {
    throw new Error('No files to merge');
  }

  const timeColumn = parsedFiles[0].timeColumn;

  // Group files by station
  const stationGroups = new Map<string, ParsedFileData[]>();

  for (const file of parsedFiles) {
    const station = extractStationFromFilename(file.fileName);
    if (!stationGroups.has(station)) {
      stationGroups.set(station, []);
    }
    stationGroups.get(station)!.push(file);
  }

  console.log(`std_merge: Found ${stationGroups.size} station groups:`, Array.from(stationGroups.keys()));

  // If only one station, merge sequentially with gap filling (no station identifiers)
  if (stationGroups.size === 1) {
    const stationFiles = Array.from(stationGroups.values())[0];
    const mergedData = mergeSameStationFiles(stationFiles, timeColumn);

    return {
      headers: stationFiles[0].headers,
      data: mergedData,
      timeColumn,
      sourceFiles: parsedFiles.map(f => f.fileName),
    };
  }

  // Multiple stations: merge each station group, then stack as parameters
  const mergedStationData = new Map<string, {
    station: string;
    data: Record<string, any>[];
    headers: string[];
  }>();

  for (const [station, files] of stationGroups.entries()) {
    const mergedData = mergeSameStationFiles(files, timeColumn);
    mergedStationData.set(station, {
      station,
      data: mergedData,
      headers: files[0].headers,
    });
  }

  // Detect the least granular (largest) time interval across all stations
  let largestInterval = 0;
  for (const { data } of mergedStationData.values()) {
    const interval = detectTimeInterval(data, timeColumn);
    if (interval > largestInterval) {
      largestInterval = interval;
    }
  }

  console.log(`Using least granular interval: ${largestInterval}ms for all stations`);

  // Collect all unique timestamps across all stations, filtered to the largest interval
  const allTimestamps = new Set<number>();

  for (const { data } of mergedStationData.values()) {
    for (const row of data) {
      const timestamp = new Date(row[timeColumn]).getTime();
      allTimestamps.add(timestamp);
    }
  }

  // Filter timestamps to the least granular interval
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  const filteredTimestamps: number[] = [];

  if (sortedTimestamps.length > 0) {
    filteredTimestamps.push(sortedTimestamps[0]);

    for (let i = 1; i < sortedTimestamps.length; i++) {
      const lastFiltered = filteredTimestamps[filteredTimestamps.length - 1];
      const gap = sortedTimestamps[i] - lastFiltered;

      // Only include timestamps that are at least largestInterval apart
      if (gap >= largestInterval * 0.9) { // 90% tolerance for rounding
        filteredTimestamps.push(sortedTimestamps[i]);
      }
    }
  }

  console.log(`Filtered timestamps: ${sortedTimestamps.length} → ${filteredTimestamps.length}`);

  // Build stacked parameter data
  const stackedData: Record<string, any>[] = [];
  const allHeaders: string[] = [timeColumn];

  // Create time-indexed maps for each station
  const stationTimeMaps = new Map<string, Map<number, Record<string, any>>>();

  for (const [station, { data, headers }] of mergedStationData.entries()) {
    const timeMap = new Map<number, Record<string, any>>();

    for (const row of data) {
      const timestamp = new Date(row[timeColumn]).getTime();
      timeMap.set(timestamp, row);
    }

    stationTimeMaps.set(station, timeMap);

    // Add headers with station identifiers
    for (const header of headers) {
      if (header !== timeColumn) {
        allHeaders.push(`${header} [${station}]`);
      }
    }
  }

  // Build merged rows
  for (const timestamp of filteredTimestamps) {
    const mergedRow: Record<string, any> = {
      [timeColumn]: new Date(timestamp).toISOString()
    };

    // Add data from each station
    for (const [station, { headers }] of mergedStationData.entries()) {
      const timeMap = stationTimeMaps.get(station)!;
      const row = timeMap.get(timestamp);

      for (const header of headers) {
        if (header !== timeColumn) {
          const paramKey = `${header} [${station}]`;
          mergedRow[paramKey] = row ? (row[header] ?? null) : null;
        }
      }
    }

    stackedData.push(mergedRow);
  }

  console.log(`std_merge result: ${stackedData.length} rows, ${allHeaders.length} columns`);

  return {
    headers: allHeaders,
    data: stackedData,
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
  if (mode === 'std-merge') {
    return mergeFilesStdMerge(parsedFiles);
  }
  return mergeFilesSequential(parsedFiles);
}
