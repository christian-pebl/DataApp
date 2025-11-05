/**
 * Rarefaction Curve Utilities
 *
 * Calculates species accumulation curves from haplotype data.
 * Used to visualize how many unique species are discovered as sampling effort increases.
 */

import type { HaplotypeParseResult } from '@/components/pin-data/csvParser';

export interface RarefactionDataPoint {
  sampleIndex: number;        // 0, 1, 2, ... (sample order)
  sampleName: string;          // Sample column name
  cumulativeSpecies: number;   // Total unique species found so far
  newSpecies: number;          // New species added at this sample
  speciesList: string[];       // List of all unique species found so far
}

export interface RarefactionCurve {
  dataPoints: RarefactionDataPoint[];
  totalSamples: number;
  totalSpecies: number;
  sampleOrder: string[];       // Order of samples used
}

/**
 * Calculate rarefaction curve from haplotype data
 *
 * Algorithm:
 * 1. Extract site columns (exclude metadata/taxonomy)
 * 2. For each site column in order:
 *    - Find all species with non-zero values
 *    - Identify NEW species not seen before
 *    - Track cumulative unique species count
 * 3. Return accumulation curve
 *
 * @param haplotypeData - Parsed haplotype CSV data
 * @returns Rarefaction curve with data points
 */
export function calculateRarefactionCurve(
  haplotypeData: HaplotypeParseResult
): RarefactionCurve {
  console.log('[RAREFACTION] ═══════════════════════════════════════');
  console.log('[RAREFACTION] Calculating rarefaction curve');
  console.log('[RAREFACTION] Total species (rows):', haplotypeData.species.length);
  console.log('[RAREFACTION] Total sites (columns):', haplotypeData.sites.length);

  const dataPoints: RarefactionDataPoint[] = [];
  const seenSpecies = new Set<string>(); // Track all species encountered so far

  // Iterate through each site column in order
  for (let siteIndex = 0; siteIndex < haplotypeData.sites.length; siteIndex++) {
    const siteName = haplotypeData.sites[siteIndex];
    const newSpeciesInThisSample: string[] = [];

    // Find all cells for this site with non-zero counts
    // NOTE: haplotypeData.data is a FLAT array of HaplotypeCellData objects
    const cellsForThisSite = haplotypeData.data.filter(cell =>
      cell.site === siteName && cell.count > 0
    );

    console.log(`[RAREFACTION] Sample ${siteIndex + 1} (${siteName}): Found ${cellsForThisSite.length} cells with non-zero counts`);

    // Check each cell to see if it's a new species
    for (const cell of cellsForThisSite) {
      const speciesName = cell.species;

      // If this species hasn't been seen before, it's new!
      if (!seenSpecies.has(speciesName)) {
        seenSpecies.add(speciesName);
        newSpeciesInThisSample.push(speciesName);
      }
    }

    // Create data point for this sample
    const dataPoint: RarefactionDataPoint = {
      sampleIndex: siteIndex,
      sampleName: siteName,
      cumulativeSpecies: seenSpecies.size,
      newSpecies: newSpeciesInThisSample.length,
      speciesList: Array.from(seenSpecies)
    };

    dataPoints.push(dataPoint);

    // Log details for all samples
    console.log(`[RAREFACTION] Sample ${siteIndex + 1} (${siteName}):`, {
      newSpecies: newSpeciesInThisSample.length,
      cumulative: seenSpecies.size,
      newSpeciesNames: newSpeciesInThisSample.slice(0, 5).join(', ') + (newSpeciesInThisSample.length > 5 ? '...' : '')
    });
  }

  const curve: RarefactionCurve = {
    dataPoints,
    totalSamples: haplotypeData.sites.length,
    totalSpecies: seenSpecies.size,
    sampleOrder: haplotypeData.sites
  };

  console.log('[RAREFACTION] ═══════════════════════════════════════');
  console.log('[RAREFACTION] Curve complete!');
  console.log('[RAREFACTION] Total samples:', curve.totalSamples);
  console.log('[RAREFACTION] Total unique species discovered:', curve.totalSpecies);
  console.log('[RAREFACTION] ═══════════════════════════════════════');

  return curve;
}

/**
 * Calculate percentage of total species discovered at each point
 */
export function calculateDiscoveryPercentages(curve: RarefactionCurve): number[] {
  const totalSpecies = curve.totalSpecies;
  if (totalSpecies === 0) return curve.dataPoints.map(() => 0);

  return curve.dataPoints.map(point =>
    (point.cumulativeSpecies / totalSpecies) * 100
  );
}

/**
 * Get summary statistics for rarefaction curve
 */
export interface RarefactionStats {
  totalSamples: number;
  totalSpecies: number;
  avgSpeciesPerSample: number;
  maxNewSpeciesInOneSample: number;
  sampleWithMostNewSpecies: string;
  percentageAtHalfway: number; // % of species discovered at 50% of samples
}

export function getRarefactionStats(curve: RarefactionCurve): RarefactionStats {
  if (curve.dataPoints.length === 0) {
    return {
      totalSamples: 0,
      totalSpecies: 0,
      avgSpeciesPerSample: 0,
      maxNewSpeciesInOneSample: 0,
      sampleWithMostNewSpecies: '',
      percentageAtHalfway: 0
    };
  }

  // Find sample with most new species
  let maxNewSpecies = 0;
  let sampleWithMax = '';
  for (const point of curve.dataPoints) {
    if (point.newSpecies > maxNewSpecies) {
      maxNewSpecies = point.newSpecies;
      sampleWithMax = point.sampleName;
    }
  }

  // Get species count at halfway point
  const halfwayIndex = Math.floor(curve.dataPoints.length / 2);
  const speciesAtHalfway = curve.dataPoints[halfwayIndex]?.cumulativeSpecies || 0;
  const percentageAtHalfway = curve.totalSpecies > 0
    ? (speciesAtHalfway / curve.totalSpecies) * 100
    : 0;

  return {
    totalSamples: curve.totalSamples,
    totalSpecies: curve.totalSpecies,
    avgSpeciesPerSample: curve.totalSpecies / curve.totalSamples,
    maxNewSpeciesInOneSample: maxNewSpecies,
    sampleWithMostNewSpecies: sampleWithMax,
    percentageAtHalfway
  };
}
