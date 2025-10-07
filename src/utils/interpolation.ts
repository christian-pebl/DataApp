/**
 * Cubic Spline Interpolation Utility
 *
 * Generates smooth curves through sparse data points by creating
 * interpolated values at target timestamps using cubic splines.
 */

export interface DataPoint {
  time: string; // ISO timestamp
  value: number;
}

/**
 * Performs cubic spline interpolation on sparse data
 *
 * @param sparseData - Array of {time, value} points (sorted by time)
 * @param targetTimestamps - Array of ISO timestamps where we want interpolated values
 * @returns Array of interpolated values corresponding to targetTimestamps
 */
export function cubicSplineInterpolation(
  sparseData: DataPoint[],
  targetTimestamps: string[]
): (number | null)[] {
  // Handle edge cases
  if (sparseData.length === 0) {
    return targetTimestamps.map(() => null);
  }

  if (sparseData.length === 1) {
    // Can't interpolate with single point
    const singleValue = sparseData[0].value;
    return targetTimestamps.map(() => singleValue);
  }

  // Convert time strings to numeric values (milliseconds since epoch)
  const sparseX = sparseData.map(d => new Date(d.time).getTime());
  const sparseY = sparseData.map(d => d.value);
  const targetX = targetTimestamps.map(t => new Date(t).getTime());

  // Filter to only include target points within the time range of sparse data
  const minX = Math.min(...sparseX);
  const maxX = Math.max(...sparseX);

  // Calculate spline coefficients
  const n = sparseData.length;
  const h = new Array(n - 1);
  const alpha = new Array(n - 1);
  const l = new Array(n);
  const mu = new Array(n);
  const z = new Array(n);
  const c = new Array(n);
  const b = new Array(n - 1);
  const d = new Array(n - 1);

  // Step 1: Calculate h values (differences between x values)
  for (let i = 0; i < n - 1; i++) {
    h[i] = sparseX[i + 1] - sparseX[i];
  }

  // Step 2: Calculate alpha values
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (sparseY[i + 1] - sparseY[i]) -
               (3 / h[i - 1]) * (sparseY[i] - sparseY[i - 1]);
  }

  // Step 3: Solve tridiagonal system (Thomas algorithm)
  l[0] = 1;
  mu[0] = 0;
  z[0] = 0;

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (sparseX[i + 1] - sparseX[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  l[n - 1] = 1;
  z[n - 1] = 0;
  c[n - 1] = 0;

  // Step 4: Back substitution
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (sparseY[j + 1] - sparseY[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }

  // Step 5: Interpolate values at target timestamps
  return targetX.map(x => {
    // Check if x is within bounds
    if (x < minX || x > maxX) {
      return null; // Don't extrapolate beyond data range
    }

    // Find the interval containing x
    let i = 0;
    for (i = 0; i < n - 1; i++) {
      if (x <= sparseX[i + 1]) {
        break;
      }
    }

    // Ensure we don't go out of bounds
    if (i >= n - 1) {
      i = n - 2;
    }

    // Calculate interpolated value using cubic polynomial
    const dx = x - sparseX[i];
    const value = sparseY[i] +
                  b[i] * dx +
                  c[i] * dx * dx +
                  d[i] * dx * dx * dx;

    return value;
  });
}

/**
 * Helper function to smooth sparse parameter data using denser timestamps
 *
 * @param sparseData - The sparse data points
 * @param denseTimestamps - Target timestamps (from denser dataset)
 * @param sparseTimeRange - Time range of sparse data (to avoid extrapolation)
 * @returns Smoothed data points
 */
export function smoothSparseData(
  sparseData: { time: string; value: number | null }[],
  denseTimestamps: string[],
  sparseTimeRange: { min: string; max: string }
): { time: string; value: number | null }[] {
  // Filter out null values and convert to DataPoint format
  const validSparsePoints: DataPoint[] = sparseData
    .filter(d => d.value !== null && !isNaN(d.value))
    .map(d => ({ time: d.time, value: d.value as number }));

  if (validSparsePoints.length === 0) {
    return denseTimestamps.map(time => ({ time, value: null }));
  }

  // Filter dense timestamps to only those within sparse data range
  const minTime = new Date(sparseTimeRange.min).getTime();
  const maxTime = new Date(sparseTimeRange.max).getTime();

  const filteredTimestamps = denseTimestamps.filter(time => {
    const t = new Date(time).getTime();
    return t >= minTime && t <= maxTime;
  });

  // Perform interpolation
  const interpolatedValues = cubicSplineInterpolation(
    validSparsePoints,
    filteredTimestamps
  );

  // Return smoothed data
  return filteredTimestamps.map((time, idx) => ({
    time,
    value: interpolatedValues[idx]
  }));
}
