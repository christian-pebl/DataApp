/**
 * Outlier Detection Utility
 *
 * Provides various methods for detecting and handling outliers in numerical data.
 */

export interface OutlierDetectionResult {
  value: number;
  index: number;
  isOutlier: boolean;
}

export interface ColumnOutlierStats {
  columnName: string;
  totalCount: number;
  outlierCount: number;
  outlierPercentage: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  iqr: number;
  lowerBound: number;
  upperBound: number;
  outlierIndices: number[];
}

export type DetectionMethod = 'iqr' | 'stddev' | 'zscore' | 'modified-zscore';
export type HandlingStrategy = 'remove' | 'flag' | 'median' | 'mean' | 'cap';

/**
 * Calculate quartiles for a sorted array
 */
function calculateQuartiles(sortedData: number[]): { q1: number; q2: number; q3: number } {
  const n = sortedData.length;

  const q2Index = Math.floor(n / 2);
  const q2 = n % 2 === 0
    ? (sortedData[q2Index - 1] + sortedData[q2Index]) / 2
    : sortedData[q2Index];

  const lowerHalf = sortedData.slice(0, q2Index);
  const upperHalf = sortedData.slice(n % 2 === 0 ? q2Index : q2Index + 1);

  const q1Index = Math.floor(lowerHalf.length / 2);
  const q1 = lowerHalf.length % 2 === 0
    ? (lowerHalf[q1Index - 1] + lowerHalf[q1Index]) / 2
    : lowerHalf[q1Index];

  const q3Index = Math.floor(upperHalf.length / 2);
  const q3 = upperHalf.length % 2 === 0
    ? (upperHalf[q3Index - 1] + upperHalf[q3Index]) / 2
    : upperHalf[q3Index];

  return { q1, q2, q3 };
}

/**
 * Detect outliers using IQR (Interquartile Range) method
 * @param data Array of numerical values
 * @param sensitivity Multiplier for IQR (default: 1.5, higher = less sensitive)
 */
export function detectOutliersIQR(
  data: number[],
  sensitivity: number = 1.5
): OutlierDetectionResult[] {
  if (data.length === 0) return [];

  const sortedData = [...data].sort((a, b) => a - b);
  const { q1, q3 } = calculateQuartiles(sortedData);
  const iqr = q3 - q1;
  const lowerBound = q1 - sensitivity * iqr;
  const upperBound = q3 + sensitivity * iqr;

  return data.map((value, index) => ({
    value,
    index,
    isOutlier: value < lowerBound || value > upperBound
  }));
}

/**
 * Detect outliers using Standard Deviation method
 * @param data Array of numerical values
 * @param threshold Number of standard deviations (default: 2)
 */
export function detectOutliersStdDev(
  data: number[],
  threshold: number = 2
): OutlierDetectionResult[] {
  if (data.length === 0) return [];

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);
  const lowerBound = mean - threshold * stdDev;
  const upperBound = mean + threshold * stdDev;

  return data.map((value, index) => ({
    value,
    index,
    isOutlier: value < lowerBound || value > upperBound
  }));
}

/**
 * Detect outliers using Z-score method
 * @param data Array of numerical values
 * @param threshold Z-score threshold (default: 3)
 */
export function detectOutliersZScore(
  data: number[],
  threshold: number = 3
): OutlierDetectionResult[] {
  if (data.length === 0) return [];

  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) {
    return data.map((value, index) => ({ value, index, isOutlier: false }));
  }

  return data.map((value, index) => {
    const zScore = Math.abs((value - mean) / stdDev);
    return {
      value,
      index,
      isOutlier: zScore > threshold
    };
  });
}

/**
 * Detect outliers using Modified Z-score (more robust)
 * @param data Array of numerical values
 * @param threshold Modified Z-score threshold (default: 3.5)
 */
export function detectOutliersModifiedZScore(
  data: number[],
  threshold: number = 3.5
): OutlierDetectionResult[] {
  if (data.length === 0) return [];

  const sortedData = [...data].sort((a, b) => a - b);
  const median = sortedData[Math.floor(sortedData.length / 2)];

  const absoluteDeviations = data.map(val => Math.abs(val - median));
  const sortedAbsDeviations = [...absoluteDeviations].sort((a, b) => a - b);
  const mad = sortedAbsDeviations[Math.floor(sortedAbsDeviations.length / 2)];

  if (mad === 0) {
    return data.map((value, index) => ({ value, index, isOutlier: false }));
  }

  return data.map((value, index) => {
    const modifiedZScore = 0.6745 * (value - median) / mad;
    return {
      value,
      index,
      isOutlier: Math.abs(modifiedZScore) > threshold
    };
  });
}

/**
 * Get statistics about outliers in a column
 */
export function getColumnOutlierStats(
  columnName: string,
  data: number[],
  method: DetectionMethod = 'iqr',
  sensitivity: number = 1.5
): ColumnOutlierStats {
  let results: OutlierDetectionResult[];

  switch (method) {
    case 'iqr':
      results = detectOutliersIQR(data, sensitivity);
      break;
    case 'stddev':
      results = detectOutliersStdDev(data, sensitivity);
      break;
    case 'zscore':
      results = detectOutliersZScore(data, sensitivity);
      break;
    case 'modified-zscore':
      results = detectOutliersModifiedZScore(data, sensitivity);
      break;
    default:
      results = detectOutliersIQR(data, sensitivity);
  }

  const outliers = results.filter(r => r.isOutlier);
  const sortedData = [...data].sort((a, b) => a - b);
  const { q1, q3 } = calculateQuartiles(sortedData);
  const iqr = q3 - q1;

  return {
    columnName,
    totalCount: data.length,
    outlierCount: outliers.length,
    outlierPercentage: (outliers.length / data.length) * 100,
    min: Math.min(...data),
    max: Math.max(...data),
    q1,
    q3,
    iqr,
    lowerBound: q1 - sensitivity * iqr,
    upperBound: q3 + sensitivity * iqr,
    outlierIndices: outliers.map(o => o.index)
  };
}

/**
 * Clean data by removing or handling outliers
 */
export function cleanOutliers(
  data: Array<Record<string, any>>,
  columns: string[],
  strategy: HandlingStrategy,
  method: DetectionMethod = 'iqr',
  sensitivity: number = 1.5
): {
  cleanedData: Array<Record<string, any>>;
  removedRowIndices: Set<number>;
  stats: ColumnOutlierStats[];
} {
  const stats: ColumnOutlierStats[] = [];
  const removedRowIndices = new Set<number>();
  let cleanedData = [...data];

  // Collect outlier information for each column
  const columnOutliers = new Map<string, Set<number>>();

  for (const column of columns) {
    const numericData = data.map(row => {
      const val = row[column];
      return typeof val === 'number' ? val : parseFloat(val);
    }).filter(val => !isNaN(val));

    if (numericData.length === 0) continue;

    const columnStats = getColumnOutlierStats(column, numericData, method, sensitivity);
    stats.push(columnStats);
    columnOutliers.set(column, new Set(columnStats.outlierIndices));
  }

  // Apply handling strategy
  if (strategy === 'remove') {
    // Remove rows that have outliers in any selected column
    columnOutliers.forEach(outlierIndices => {
      outlierIndices.forEach(idx => removedRowIndices.add(idx));
    });
    cleanedData = data.filter((_, index) => !removedRowIndices.has(index));
  } else if (strategy === 'flag') {
    // Add is_outlier flag
    cleanedData = data.map((row, index) => {
      const hasOutlier = Array.from(columnOutliers.values()).some(
        outlierSet => outlierSet.has(index)
      );
      return { ...row, is_outlier: hasOutlier };
    });
  } else {
    // Replace strategies: median, mean, cap
    cleanedData = data.map((row, index) => {
      const newRow = { ...row };

      for (const column of columns) {
        const outlierSet = columnOutliers.get(column);
        if (!outlierSet || !outlierSet.has(index)) continue;

        const numericData = data.map(r => {
          const val = r[column];
          return typeof val === 'number' ? val : parseFloat(val);
        }).filter(val => !isNaN(val));

        const columnStat = stats.find(s => s.columnName === column);
        if (!columnStat) continue;

        if (strategy === 'median') {
          const sortedData = [...numericData].sort((a, b) => a - b);
          const median = sortedData[Math.floor(sortedData.length / 2)];
          newRow[column] = median;
        } else if (strategy === 'mean') {
          const mean = numericData.reduce((sum, val) => sum + val, 0) / numericData.length;
          newRow[column] = mean;
        } else if (strategy === 'cap') {
          const currentValue = parseFloat(row[column]);
          if (currentValue < columnStat.lowerBound) {
            newRow[column] = columnStat.lowerBound;
          } else if (currentValue > columnStat.upperBound) {
            newRow[column] = columnStat.upperBound;
          }
        }
      }

      return newRow;
    });
  }

  return { cleanedData, removedRowIndices, stats };
}

/**
 * Detect all numerical columns in a dataset
 */
export function detectNumericalColumns(data: Array<Record<string, any>>): string[] {
  if (data.length === 0) return [];

  const firstRow = data[0];
  const numericalColumns: string[] = [];

  for (const [key, value] of Object.entries(firstRow)) {
    // Skip common non-measurement columns
    if (['id', 'date', 'time', 'datetime', 'timestamp', 'is_outlier'].includes(key.toLowerCase())) {
      continue;
    }

    // Check if the column contains numerical data
    const isNumeric = data.slice(0, Math.min(100, data.length)).every(row => {
      const val = row[key];
      return val === null || val === undefined || val === '' ||
             typeof val === 'number' || !isNaN(parseFloat(val));
    });

    if (isNumeric) {
      numericalColumns.push(key);
    }
  }

  return numericalColumns;
}
