/**
 * Statistical Utilities for Spot-Sample Data Analysis
 * Provides functions for calculating descriptive statistics and grouping data
 */

export interface SpotSampleGroup {
  date: string;           // ISO date string
  sampleId: string;       // Sample identifier - For _indiv files: Farm ID (e.g., "Farm-L")
  bladeId?: string;       // Station ID from the "station ID" column (e.g., "1-NE-3", "2-SW-1")
                          // Used as-is without any extraction
  xAxisLabel: string;     // Formatted label: "25/03/25 [Farm-L 1-NE-3]"
                          // Format: Date on first line, [Farm ID Station ID] on second line
  parameter: string;      // Parameter name
  values: number[];       // Raw values for this group
  count: number;          // Number of samples
  stats: {
    mean: number;
    sd: number;           // Standard deviation
    se: number;           // Standard error
    min: number;
    Q1: number;           // First quartile
    median: number;
    Q3: number;           // Third quartile
    max: number;
  };
}

/**
 * Calculate mean (average) of an array of numbers
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate sample standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;

  const mean = calculateMean(values);
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

/**
 * Calculate standard error (SD / sqrt(n))
 */
export function calculateStandardError(values: number[]): number {
  if (values.length <= 1) return 0;

  const sd = calculateStandardDeviation(values);
  return sd / Math.sqrt(values.length);
}

/**
 * Calculate quartiles and min/max for box plot
 */
export function calculateQuartiles(values: number[]): {
  min: number;
  Q1: number;
  median: number;
  Q3: number;
  max: number;
} {
  if (values.length === 0) {
    return { min: 0, Q1: 0, median: 0, Q3: 0, max: 0 };
  }

  // Sort values
  const sorted = [...values].sort((a, b) => a - b);

  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  // Calculate median (Q2)
  const median = calculatePercentile(sorted, 50);

  // Calculate Q1 and Q3
  const Q1 = calculatePercentile(sorted, 25);
  const Q3 = calculatePercentile(sorted, 75);

  return { min, Q1, median, Q3, max };
}

/**
 * Calculate a specific percentile from sorted array
 */
function calculatePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

/**
 * Format date for x-axis label: "12/04/25 [Sample-ID Blade-ID]"
 */
export function formatSpotSampleLabel(date: Date | string, sampleId: string, bladeId?: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Format as DD/MM/YY
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);

  // Include blade ID in label if provided
  const labelContent = bladeId ? `${sampleId} ${bladeId}` : sampleId;

  return `${day}/${month}/${year} [${labelContent}]`;
}

/**
 * Extract the part after the first underscore from a blade ID
 * Example: "1_1-NE-2" -> "1-NE-2"
 */
function extractBladeIdPart(bladeId: string): string {
  const parts = bladeId.split('_');
  if (parts.length > 1) {
    // Return everything after the first underscore
    return parts.slice(1).join('_');
  }
  // If no underscore found, return the original
  return bladeId;
}

/**
 * Group spot-sample data by date + sample ID + station ID combination
 *
 * For _indiv files: Groups by Date + Farm ID + Station ID
 *
 * @param data - Array of data points with time, sample ID, and parameter values
 * @param dateColumn - Name of the date/time column (Not used - kept for backwards compatibility, always uses 'time' field)
 * @param sampleIdColumn - Name of the sample ID column (For _indiv files: Farm ID column, e.g., "Farm-L")
 * @param parameterColumns - Array of parameter names to process
 * @param bladeIdColumn - Optional name of the station ID column (For _indiv files: "station ID" column containing values like "1-NE-3", used as-is)
 * @returns Array of grouped data with statistics
 */
export function groupBySampleAndDate(
  data: Array<Record<string, any>>,
  dateColumn: string, // Not used - kept for backwards compatibility
  sampleIdColumn: string,
  parameterColumns: string[],
  bladeIdColumn?: string
): SpotSampleGroup[] {
  const groups: Map<string, SpotSampleGroup> = new Map();

  // console.log('[STATISTICAL-UTILS] ═══════════════════════════════════════');
  // console.log('[STATISTICAL-UTILS] Grouping data...');
  // console.log('[STATISTICAL-UTILS] Date column (ignored, using "time" field):', dateColumn);
  // console.log('[STATISTICAL-UTILS] Sample ID column:', sampleIdColumn);
  // console.log('[STATISTICAL-UTILS] Blade ID column:', bladeIdColumn || 'none');
  // console.log('[STATISTICAL-UTILS] Parameters:', parameterColumns);
  // console.log('[STATISTICAL-UTILS] Data points:', data.length);

  let skippedRows = 0;
  let processedRows = 0;
  let skippedReasons: Record<string, number> = {};

  // Process each data point
  // NOTE: ParsedDataPoint always uses 'time' field regardless of original column name
  for (const row of data) {
    const dateValue = row['time']; // Always use 'time' field from ParsedDataPoint
    const sampleId = row[sampleIdColumn];

    // Get station ID from the column
    // For _indiv files, the "station ID" column contains the full identifier (e.g., "1-NE-3")
    // We use it as-is without any extraction
    const rawStationId = bladeIdColumn ? row[bladeIdColumn] : undefined;
    const bladeId = rawStationId ? String(rawStationId) : undefined;

    // Log first few extractions for debugging
    if (processedRows <= 3 && bladeIdColumn) {
      console.log('[STATISTICAL-UTILS] Row', processedRows, '- Station ID from column:', rawStationId, '-> Used as:', bladeId);
    }

    if (!dateValue) {
      skippedRows++;
      skippedReasons['missing_date'] = (skippedReasons['missing_date'] || 0) + 1;
      continue;
    }

    // Allow empty strings as valid sample IDs (for unnamed columns)
    if (sampleId === null || sampleId === undefined) {
      skippedRows++;
      skippedReasons['missing_sample_id'] = (skippedReasons['missing_sample_id'] || 0) + 1;
      continue;
    }

    processedRows++;

    // Convert date to ISO string (just date part)
    const dateObj = new Date(dateValue);
    const isoDate = dateObj.toISOString().split('T')[0];

    // Process each parameter
    for (const param of parameterColumns) {
      const value = row[param];

      // Skip if value is null, undefined, or not a number
      if (value == null || typeof value !== 'number' || isNaN(value)) {
        if (value != null) {
          skippedReasons[`invalid_${param}_type_${typeof value}`] = (skippedReasons[`invalid_${param}_type_${typeof value}`] || 0) + 1;
        }
        continue;
      }

      // Create unique key: date + sampleId + bladeId + parameter
      const bladeIdKey = bladeId ? `|${bladeId}` : '';
      const key = `${isoDate}|${sampleId}${bladeIdKey}|${param}`;

      if (!groups.has(key)) {
        // Create new group
        groups.set(key, {
          date: isoDate,
          sampleId: String(sampleId),
          bladeId: bladeId ? String(bladeId) : undefined,
          xAxisLabel: formatSpotSampleLabel(isoDate, String(sampleId), bladeId ? String(bladeId) : undefined),
          parameter: param,
          values: [value],
          count: 1,
          stats: {
            mean: 0,
            sd: 0,
            se: 0,
            min: 0,
            Q1: 0,
            median: 0,
            Q3: 0,
            max: 0
          }
        });
      } else {
        // Add to existing group
        const group = groups.get(key)!;
        group.values.push(value);
        group.count++;
      }
    }
  }

  // Calculate statistics for each group
  const result: SpotSampleGroup[] = [];

  for (const group of groups.values()) {
    // Calculate stats
    group.stats.mean = calculateMean(group.values);
    group.stats.sd = calculateStandardDeviation(group.values);
    group.stats.se = calculateStandardError(group.values);

    const quartiles = calculateQuartiles(group.values);
    group.stats.min = quartiles.min;
    group.stats.Q1 = quartiles.Q1;
    group.stats.median = quartiles.median;
    group.stats.Q3 = quartiles.Q3;
    group.stats.max = quartiles.max;

    result.push(group);
  }

  // Sort by date, then by sample ID
  result.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.sampleId.localeCompare(b.sampleId);
  });

  // console.log('[STATISTICAL-UTILS] ═══════════════════════════════════════');
  // console.log('[STATISTICAL-UTILS] Grouping Summary:');
  // console.log('[STATISTICAL-UTILS] Processed rows:', processedRows);
  // console.log('[STATISTICAL-UTILS] Skipped rows:', skippedRows);
  // console.log('[STATISTICAL-UTILS] Skip reasons:', skippedReasons);
  // console.log('[STATISTICAL-UTILS] Created groups:', result.length);
  // console.log('[STATISTICAL-UTILS] Sample first 3 groups:', result.slice(0, 3));
  // console.log('[STATISTICAL-UTILS] ═══════════════════════════════════════');

  return result;
}

/**
 * Detect potential sample ID column from headers
 * Priority: "Sample ID" > "Sample" > "sample" > second column
 */
export function detectSampleIdColumn(headers: string[]): string | null {
  if (headers.length === 0) return null;

  console.log('[STATISTICAL-UTILS] Detecting sample ID column from headers:', headers);

  // Priority 1: Exact match "Sample ID" (case-insensitive)
  const sampleIdMatch = headers.find(h => h.toLowerCase() === 'sample id');
  if (sampleIdMatch) {
    console.log('[STATISTICAL-UTILS] Found "Sample ID" column:', sampleIdMatch);
    return sampleIdMatch;
  }

  // Priority 2: Exact match "Sample" (case-insensitive)
  const sampleMatch = headers.find(h => h.toLowerCase() === 'sample');
  if (sampleMatch) {
    console.log('[STATISTICAL-UTILS] Found "Sample" column:', sampleMatch);
    return sampleMatch;
  }

  // Priority 3: Exact match "Station" (case-insensitive) - for eDNA files
  const stationMatch = headers.find(h => h.toLowerCase() === 'station');
  if (stationMatch) {
    console.log('[STATISTICAL-UTILS] Found "Station" column:', stationMatch);
    return stationMatch;
  }

  // Priority 4: Contains "sample" (case-insensitive)
  const containsSample = headers.find(h => h.toLowerCase().includes('sample'));
  if (containsSample) {
    console.log('[STATISTICAL-UTILS] Found column containing "sample":', containsSample);
    return containsSample;
  }

  // Priority 5: Use second column as fallback (index 1)
  if (headers.length >= 2) {
    console.log('[STATISTICAL-UTILS] Using second column as fallback:', headers[1]);
    return headers[1];
  }

  console.log('[STATISTICAL-UTILS] No suitable sample ID column found');
  return null;
}
