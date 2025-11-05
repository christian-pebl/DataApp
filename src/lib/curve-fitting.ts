/**
 * Curve Fitting for Rarefaction Curves
 *
 * Implements:
 * 1. Michaelis-Menten: S = (Smax × n) / (K + n)
 * 2. Logarithmic: S = a × ln(n) + b
 */

import type { RarefactionDataPoint } from './rarefaction-utils';

export type CurveFitModel = 'none' | 'michaelis-menten' | 'logarithmic';

export interface CurveFitResult {
  model: CurveFitModel;
  parameters: Record<string, number>;  // Model-specific parameters
  fittedValues: number[];               // Y values for smooth curve
  r2: number;                            // Goodness of fit (0-1)
  equation: string;                      // Human-readable equation
  confidenceInterval?: {                 // Confidence intervals (±1 SE)
    upper: number[];                     // Upper bound
    lower: number[];                     // Lower bound
    standardError: number;               // Standard error of residuals
  };
}

/**
 * Fit a curve to rarefaction data points
 *
 * @param dataPoints - Rarefaction data points
 * @param model - Type of curve to fit
 * @returns Fitted curve result or null if fitting fails
 */
export function fitCurve(
  dataPoints: RarefactionDataPoint[],
  model: CurveFitModel
): CurveFitResult | null {
  if (model === 'none' || dataPoints.length < 3) {
    return null;
  }

  console.log(`[CURVE-FIT] Fitting ${model} model to ${dataPoints.length} points`);

  switch (model) {
    case 'michaelis-menten':
      return fitMichaelisMenten(dataPoints);
    case 'logarithmic':
      return fitLogarithmic(dataPoints);
    default:
      return null;
  }
}

/**
 * Michaelis-Menten: S = (Smax × n) / (K + n)
 *
 * Where:
 * - S = number of species
 * - n = number of samples
 * - Smax = asymptotic maximum species
 * - K = half-saturation constant (samples needed to reach Smax/2)
 *
 * Uses iterative non-linear least squares optimization
 */
function fitMichaelisMenten(dataPoints: RarefactionDataPoint[]): CurveFitResult | null {
  // Extract x (sample number) and y (cumulative species)
  const x = dataPoints.map((_, i) => i + 1); // 1, 2, 3, ...
  const y = dataPoints.map(p => p.cumulativeSpecies);

  const n = x.length;
  const yMax = Math.max(...y);
  const yFinal = y[y.length - 1];

  // Better initial parameter guesses based on data characteristics
  // For eDNA data, typically expect to find more species with more sampling

  // Smax: Start with a reasonable upper bound
  // If curve is still rising steeply at the end, assume much more to discover
  const slopeAtEnd = y[n - 1] - y[n - 2];
  const slopeAtStart = y[1] - y[0];
  const isStillRising = slopeAtEnd > slopeAtStart * 0.5;

  let Smax = isStillRising ? yFinal * 1.5 : yFinal * 1.1;

  // K: Estimate from the point where we've discovered ~50% of observed species
  // This gives a more stable starting point
  let K = x.length * 0.4; // Start with 40% of sample count

  // Iterative optimization with adaptive learning rate
  const maxIterations = 1000;
  const tolerance = 1e-8;
  let prevError = Infinity;
  let learningRate = 0.1; // Start with larger learning rate
  let noImprovementCount = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    let sumSquaredError = 0;
    let dSmax = 0;
    let dK = 0;

    // Calculate error and gradients
    for (let i = 0; i < x.length; i++) {
      const n = x[i];
      const observed = y[i];
      const predicted = (Smax * n) / (K + n);
      const error = observed - predicted;

      sumSquaredError += error * error;

      // Partial derivatives for gradient descent
      const denom = K + n;
      dSmax += -2 * error * (n / denom);
      dK += -2 * error * (Smax * n) / (denom * denom);
    }

    // Check for convergence
    if (Math.abs(prevError - sumSquaredError) < tolerance) {
      break;
    }

    // Adaptive learning rate: reduce if error increased
    if (sumSquaredError > prevError) {
      learningRate *= 0.5;
      noImprovementCount++;
      if (noImprovementCount > 10) break; // Stop if stuck
    } else {
      noImprovementCount = 0;
      if (learningRate < 0.1) learningRate *= 1.1; // Gradually increase if improving
    }

    prevError = sumSquaredError;

    // Update parameters with gradient descent
    Smax -= learningRate * dSmax;
    K -= learningRate * dK;

    // Constrain parameters to physically meaningful ranges
    Smax = Math.max(yFinal, Math.min(Smax, yMax * 5)); // Allow up to 5x observed max
    K = Math.max(0.5, Math.min(K, x.length * 3)); // K between 0.5 and 3x samples
  }

  // Generate fitted values
  const fittedValues = x.map(n => (Smax * n) / (K + n));

  // Calculate R² and standard error
  const r2 = calculateR2(y, fittedValues);
  const residuals = y.map((obs, i) => obs - fittedValues[i]);
  const sumSquaredResiduals = residuals.reduce((sum, r) => sum + r * r, 0);
  const standardError = Math.sqrt(sumSquaredResiduals / (n - 2)); // n-2 for 2 parameters

  // Calculate confidence intervals (±1 standard error)
  const upperBound = fittedValues.map(val => val + standardError);
  const lowerBound = fittedValues.map(val => Math.max(0, val - standardError));

  console.log('[CURVE-FIT] Michaelis-Menten fit:', { Smax: Smax.toFixed(2), K: K.toFixed(2), r2: r2.toFixed(3), SE: standardError.toFixed(2) });

  return {
    model: 'michaelis-menten',
    parameters: { Smax, K },
    fittedValues,
    r2,
    equation: `S = ${Smax.toFixed(1)} × n / (${K.toFixed(1)} + n)`,
    confidenceInterval: {
      upper: upperBound,
      lower: lowerBound,
      standardError
    }
  };
}

/**
 * Logarithmic: S = a × ln(n) + b
 *
 * Where:
 * - S = number of species
 * - n = number of samples
 * - a = slope coefficient
 * - b = intercept
 *
 * Uses linear regression on ln-transformed x values
 */
function fitLogarithmic(dataPoints: RarefactionDataPoint[]): CurveFitResult | null {
  // Extract x (sample number) and y (cumulative species)
  const x = dataPoints.map((_, i) => i + 1); // 1, 2, 3, ...
  const y = dataPoints.map(p => p.cumulativeSpecies);

  // Transform x to ln(x)
  const lnX = x.map(n => Math.log(n));

  // Linear regression: y = a × ln(x) + b
  const n = x.length;
  const sumLnX = lnX.reduce((sum, val) => sum + val, 0);
  const sumY = y.reduce((sum, val) => sum + val, 0);
  const sumLnXY = lnX.reduce((sum, val, i) => sum + val * y[i], 0);
  const sumLnX2 = lnX.reduce((sum, val) => sum + val * val, 0);

  // Calculate slope (a) and intercept (b)
  const a = (n * sumLnXY - sumLnX * sumY) / (n * sumLnX2 - sumLnX * sumLnX);
  const b = (sumY - a * sumLnX) / n;

  // Generate fitted values
  const fittedValues = lnX.map(lnN => a * lnN + b);

  // Calculate R²
  const r2 = calculateR2(y, fittedValues);

  console.log('[CURVE-FIT] Logarithmic fit:', { a, b, r2 });

  return {
    model: 'logarithmic',
    parameters: { a, b },
    fittedValues,
    r2,
    equation: `S = ${a.toFixed(2)} × ln(n) + ${b.toFixed(2)}`
  };
}

/**
 * Calculate coefficient of determination (R²)
 *
 * R² measures goodness of fit (0 = poor, 1 = perfect)
 */
function calculateR2(observed: number[], predicted: number[]): number {
  if (observed.length !== predicted.length || observed.length === 0) {
    return 0;
  }

  // Calculate mean of observed values
  const meanObserved = observed.reduce((sum, val) => sum + val, 0) / observed.length;

  // Total sum of squares (TSS)
  const tss = observed.reduce((sum, val) => sum + Math.pow(val - meanObserved, 2), 0);

  // Residual sum of squares (RSS)
  const rss = observed.reduce((sum, val, i) =>
    sum + Math.pow(val - predicted[i], 2), 0
  );

  // R² = 1 - (RSS / TSS)
  const r2 = 1 - (rss / tss);

  return Math.max(0, Math.min(1, r2)); // Clamp to [0, 1]
}

/**
 * Generate smooth curve points for visualization
 *
 * Creates more points than the original data for a smooth line
 */
export function generateSmoothCurve(
  fitResult: CurveFitResult,
  numPoints: number = 100
): Array<{ x: number; y: number }> {
  const maxX = fitResult.fittedValues.length;
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const x = 1 + (maxX * i) / numPoints; // Start from 1, not 0

    let y: number;
    if (fitResult.model === 'michaelis-menten') {
      const { Smax, K } = fitResult.parameters;
      y = (Smax * x) / (K + x);
    } else if (fitResult.model === 'logarithmic') {
      const { a, b } = fitResult.parameters;
      y = a * Math.log(x) + b;
    } else {
      continue;
    }

    points.push({ x, y });
  }

  return points;
}

/**
 * Generate smooth curve points within a specific x-range
 *
 * Used for creating interpolation (within observed data) and extrapolation (beyond observed data)
 */
export function generateSmoothCurveInRange(
  fitResult: CurveFitResult,
  minX: number,
  maxX: number,
  numPoints: number = 50
): Array<{ x: number; y: number; yUpper?: number; yLower?: number }> {
  const points: Array<{ x: number; y: number; yUpper?: number; yLower?: number }> = [];

  for (let i = 0; i <= numPoints; i++) {
    const x = minX + ((maxX - minX) * i) / numPoints;

    let y: number;
    if (fitResult.model === 'michaelis-menten') {
      const { Smax, K } = fitResult.parameters;
      y = (Smax * x) / (K + x);
    } else if (fitResult.model === 'logarithmic') {
      const { a, b } = fitResult.parameters;
      y = a * Math.log(x) + b;
    } else {
      continue;
    }

    // Add confidence intervals if available
    const point: { x: number; y: number; yUpper?: number; yLower?: number } = { x, y };

    if (fitResult.confidenceInterval) {
      const se = fitResult.confidenceInterval.standardError;
      point.yUpper = y + se;
      point.yLower = Math.max(0, y - se);
    }

    points.push(point);
  }

  return points;
}
