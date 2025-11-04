/**
 * eDNA Taxonomy Data Processor
 *
 * Processes _taxo.csv files containing phylum-level community composition data.
 * Aggregates presence/absence data for visualization as stacked percentage bar charts.
 */

export interface TaxonomyRow {
  phylum: string;
  sampleValues: { [sampleName: string]: number }; // 0 or 1
}

export interface AggregatedTaxonomyData {
  samples: string[]; // Ordered list of sample column names
  phylumCounts: {
    [phylum: string]: {
      [sampleName: string]: number; // Raw count
    };
  };
  phylumPercentages: {
    [phylum: string]: {
      [sampleName: string]: number; // Percentage (0-100)
    };
  };
  totalTaxaPerSample: { [sampleName: string]: number }; // Total taxa count per sample
  allPhyla: string[]; // Sorted list of all unique phyla
}

/**
 * Identifies sample columns (non-taxonomy columns and non-metadata columns)
 * Taxonomy columns: kingdom, phylum, class, order, family, genus, species
 * Metadata columns: date, time, sample, replicate, etc.
 *
 * Intelligently handles various naming conventions:
 * - ALGA style: ALGA_C_S, ALGA_F_L (short abbreviations)
 * - NORF style: NORF_Control_1, NORF_Farm_1 (full keywords)
 * - Other patterns with Control/Farm or _C_/_F_ identifiers
 */
function identifySampleColumns(headers: string[]): string[] {
  const taxonomyColumns = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];
  const metadataColumns = ['date', 'time', 'sample', 'replicate', 'subset'];

  const sampleColumns = headers.filter(h => {
    const normalized = h.toLowerCase().trim();

    // Exclude exact matches to taxonomy and metadata columns
    if (taxonomyColumns.includes(normalized) || metadataColumns.includes(normalized)) {
      return false;
    }

    // Include columns that look like sample identifiers
    // Patterns: PROJECT_Category_ID, PROJECT_C_ID, PROJECT_F_ID, etc.
    const hasSamplePattern = /^[A-Z]+_/.test(h); // Starts with capital letters and underscore

    if (hasSamplePattern) {
      console.log('[eDNA Taxonomy] Sample column detected:', h);
      return true;
    }

    // Fallback: include if not explicitly excluded
    return true;
  });

  console.log('[eDNA Taxonomy] Identified sample columns:', sampleColumns);
  console.log('[eDNA Taxonomy] Total sample columns:', sampleColumns.length);

  // Validation: warn if no sample columns found
  if (sampleColumns.length === 0) {
    console.warn('[eDNA Taxonomy] ⚠️  No sample columns found! Headers:', headers);
  }

  return sampleColumns;
}

/**
 * Finds the phylum column index
 */
function findPhylumColumnIndex(headers: string[]): number {
  return headers.findIndex(h => h.toLowerCase().trim() === 'phylum');
}

/**
 * Normalizes phylum name (handles NA, empty, whitespace)
 */
function normalizePhylum(value: any): string | null {
  if (!value) return null;

  const normalized = String(value).trim();

  // Filter out invalid phyla
  if (normalized === '' || normalized.toLowerCase() === 'na') {
    return null;
  }

  return normalized;
}

/**
 * Parses taxonomy CSV data into structured format
 *
 * @param data - Parsed CSV data (array of row objects)
 * @param headers - Column headers
 * @returns Array of taxonomy rows with validation
 */
export function parseTaxonomyData(
  data: any[],
  headers: string[]
): { rows: TaxonomyRow[]; sampleColumns: string[]; skippedCount: number } {
  const taxonomyRows: TaxonomyRow[] = [];
  let skippedCount = 0;

  // Find sample columns and phylum column
  const sampleColumns = identifySampleColumns(headers);
  const phylumColIndex = findPhylumColumnIndex(headers);

  if (phylumColIndex === -1) {
    console.error('[eDNA Taxonomy] Phylum column not found in headers:', headers);
    return { rows: [], sampleColumns: [], skippedCount: data.length };
  }

  if (sampleColumns.length === 0) {
    console.error('[eDNA Taxonomy] No sample columns found in headers:', headers);
    return { rows: [], sampleColumns: [], skippedCount: data.length };
  }

  const phylumColName = headers[phylumColIndex];
  console.log(`[eDNA Taxonomy] Using phylum column: "${phylumColName}"`);
  console.log(`[eDNA Taxonomy] Sample columns (${sampleColumns.length}):`, sampleColumns);

  // Validate sample column naming conventions
  const namingPatterns = {
    algaStyle: sampleColumns.filter(s => /_C_|_F_/.test(s)).length,
    norfStyle: sampleColumns.filter(s => /Control|Farm/i.test(s)).length,
    other: sampleColumns.filter(s => !/_C_|_F_/.test(s) && !/Control|Farm/i.test(s)).length
  };
  console.log(`[eDNA Taxonomy] Naming pattern analysis:`, namingPatterns);

  for (const row of data) {
    // Skip empty rows
    if (!row || Object.keys(row).length === 0) {
      continue;
    }

    // Extract and normalize phylum
    const phylumValue = row[phylumColName];
    const phylum = normalizePhylum(phylumValue);

    if (!phylum) {
      skippedCount++;
      continue;
    }

    // Extract sample values (0 or 1)
    const sampleValues: { [key: string]: number } = {};
    let hasValidData = false;

    for (const sampleCol of sampleColumns) {
      const value = row[sampleCol];

      // Convert to number (handle "0", "1", 0, 1, true, false, etc.)
      let numValue = 0;
      if (value === 1 || value === '1' || value === true || value === 'TRUE') {
        numValue = 1;
        hasValidData = true;
      }

      sampleValues[sampleCol] = numValue;
    }

    // Skip rows with no detections across all samples
    if (!hasValidData) {
      skippedCount++;
      continue;
    }

    taxonomyRows.push({
      phylum,
      sampleValues
    });
  }

  console.log(`[eDNA Taxonomy] Parsed ${taxonomyRows.length} valid rows, skipped ${skippedCount} rows`);

  return { rows: taxonomyRows, sampleColumns, skippedCount };
}

/**
 * Aggregates taxonomy data by phylum across all samples
 * Calculates both raw counts and percentages
 *
 * @param rows - Parsed taxonomy rows
 * @param sampleColumns - List of sample column names
 * @returns Aggregated data for visualization
 */
export function aggregateTaxonomyData(
  rows: TaxonomyRow[],
  sampleColumns: string[]
): AggregatedTaxonomyData {
  const phylumCounts: { [phylum: string]: { [sample: string]: number } } = {};
  const totalTaxaPerSample: { [sample: string]: number } = {};

  // Initialize totals
  for (const sample of sampleColumns) {
    totalTaxaPerSample[sample] = 0;
  }

  // Count occurrences per phylum per sample
  for (const row of rows) {
    const phylum = row.phylum;

    if (!phylumCounts[phylum]) {
      phylumCounts[phylum] = {};
      for (const sample of sampleColumns) {
        phylumCounts[phylum][sample] = 0;
      }
    }

    for (const sample of sampleColumns) {
      const value = row.sampleValues[sample] || 0;
      phylumCounts[phylum][sample] += value;
      totalTaxaPerSample[sample] += value;
    }
  }

  // Calculate percentages
  const phylumPercentages: { [phylum: string]: { [sample: string]: number } } = {};

  for (const phylum of Object.keys(phylumCounts)) {
    phylumPercentages[phylum] = {};

    for (const sample of sampleColumns) {
      const count = phylumCounts[phylum][sample];
      const total = totalTaxaPerSample[sample];
      phylumPercentages[phylum][sample] = total > 0 ? (count / total) * 100 : 0;
    }
  }

  // Get sorted list of all phyla (by total count, descending)
  const allPhyla = Object.keys(phylumCounts).sort((a, b) => {
    const totalA = sampleColumns.reduce((sum, s) => sum + phylumCounts[a][s], 0);
    const totalB = sampleColumns.reduce((sum, s) => sum + phylumCounts[b][s], 0);
    return totalB - totalA; // Descending order
  });

  console.log('[eDNA Taxonomy] Aggregation complete:', {
    totalPhyla: allPhyla.length,
    phyla: allPhyla,
    totalTaxaPerSample
  });

  // Validate percentages sum to ~100% per sample
  for (const sample of sampleColumns) {
    const sum = allPhyla.reduce((acc, phylum) => acc + phylumPercentages[phylum][sample], 0);
    if (Math.abs(sum - 100) > 0.1 && totalTaxaPerSample[sample] > 0) {
      console.warn(`[eDNA Taxonomy] ⚠️  Percentages for ${sample} sum to ${sum.toFixed(2)}% (expected ~100%)`);
    }
  }

  return {
    samples: sampleColumns,
    phylumCounts,
    phylumPercentages,
    totalTaxaPerSample,
    allPhyla
  };
}

/**
 * Main processing function - combines parsing and aggregation
 *
 * @param data - Raw CSV data
 * @param headers - Column headers
 * @returns Aggregated taxonomy data ready for charting
 */
export function processTaxonomyFile(
  data: any[],
  headers: string[]
): { aggregated: AggregatedTaxonomyData; skippedCount: number } {
  const { rows, sampleColumns, skippedCount } = parseTaxonomyData(data, headers);
  const aggregated = aggregateTaxonomyData(rows, sampleColumns);

  return { aggregated, skippedCount };
}

/**
 * Utility function to check if a file is a taxonomy file
 */
export function isTaxonomyFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('_taxo.csv');
}

/**
 * Categorize a sample as Control or Farm based on naming convention
 * Handles multiple patterns:
 * - ALGA style: contains _C_ or _F_
 * - NORF style: contains "Control" or "Farm" keywords
 *
 * @param sampleName - Sample column name
 * @returns 'control', 'farm', or 'unknown'
 */
export function categorizeSample(sampleName: string): 'control' | 'farm' | 'unknown' {
  const lower = sampleName.toLowerCase();

  // Check for control patterns
  if (lower.includes('_c_') || lower.includes('control')) {
    return 'control';
  }

  // Check for farm patterns
  if (lower.includes('_f_') || lower.includes('farm')) {
    return 'farm';
  }

  return 'unknown';
}

/**
 * Group samples by category (control vs farm)
 *
 * @param samples - Array of sample names
 * @returns Object with control and farm sample arrays
 */
export function groupSamplesByCategory(samples: string[]): {
  control: string[];
  farm: string[];
  unknown: string[];
} {
  const grouped = {
    control: [] as string[],
    farm: [] as string[],
    unknown: [] as string[]
  };

  for (const sample of samples) {
    const category = categorizeSample(sample);
    grouped[category].push(sample);
  }

  return grouped;
}
