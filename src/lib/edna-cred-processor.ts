/**
 * eDNA Credibility Score Data Processor
 *
 * Processes _Cred.csv files containing species credibility scores and GBIF validation status.
 * Aggregates data for visualization as stacked column charts.
 */

export interface CredibilityRow {
  speciesName: string;
  gbifStatus: boolean;
  credibilityScore: 'Low' | 'Moderate' | 'High';
}

export interface AggregatedCredData {
  low_gbif_true: number;
  low_gbif_false: number;
  moderate_gbif_true: number;
  moderate_gbif_false: number;
  high_gbif_true: number;
  high_gbif_false: number;
  totalUniqueSpecies: number;
}

/**
 * Normalizes credibility score values to standard format
 * Handles variations like "low", "LOW", "moderate", "MODERATE", etc.
 */
function normalizeCredibilityScore(value: any): 'Low' | 'Moderate' | 'High' | null {
  if (!value || value === '') return null;

  // Convert to string if not already
  const stringValue = typeof value === 'string' ? value : String(value);
  const normalized = stringValue.trim().toLowerCase();

  if (['low', 'l'].includes(normalized)) return 'Low';
  if (['moderate', 'medium', 'mod', 'm'].includes(normalized)) return 'Moderate';
  if (['high', 'h'].includes(normalized)) return 'High';

  console.warn(`[eDNA Cred] Invalid credibility score: "${value}"`);
  return null;
}

/**
 * Normalizes GBIF status to boolean
 * Handles TRUE/FALSE, true/false, YES/NO, 1/0, etc.
 */
function normalizeGBIFStatus(value: any): boolean {
  if (value === null || value === undefined) return false;

  if (typeof value === 'boolean') return value;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', 'yes', '1', 't', 'y'].includes(normalized);
  }

  if (typeof value === 'number') return value === 1;

  return false; // Default to false for missing/invalid values
}

/**
 * Finds the GBIF column index by searching for column name containing "gbif"
 */
function findGBIFColumnIndex(headers: string[]): number {
  return headers.findIndex(h => h.toLowerCase().includes('gbif'));
}

/**
 * Extracts species name from row (assumes column named "species" or similar)
 */
function extractSpeciesName(row: any, headers: string[]): string | null {
  // Try to find species column
  const speciesColIndex = headers.findIndex(h =>
    h.toLowerCase().includes('species') ||
    h.toLowerCase().includes('name')
  );

  if (speciesColIndex >= 0 && row[headers[speciesColIndex]]) {
    return String(row[headers[speciesColIndex]]).trim();
  }

  return null;
}

/**
 * Parses _Cred CSV data into structured format
 *
 * @param data - Parsed CSV data (array of row objects)
 * @param headers - Column headers
 * @returns Array of credibility rows with validation
 */
export function parseCredData(
  data: any[],
  headers: string[]
): { rows: CredibilityRow[]; skippedCount: number } {
  const credibilityRows: CredibilityRow[] = [];
  let skippedCount = 0;

  // Find GBIF column
  const gbifColIndex = findGBIFColumnIndex(headers);
  if (gbifColIndex === -1) {
    console.error('[eDNA Cred] GBIF column not found in headers:', headers);
    return { rows: [], skippedCount: data.length };
  }

  const gbifColName = headers[gbifColIndex];

  // Find score column - could be "score", "credibility", or similar
  const scoreColIndex = headers.findIndex(h =>
    h.toLowerCase().includes('score') ||
    h.toLowerCase().includes('credibility') ||
    h.toLowerCase() === 'low' ||
    h.toLowerCase() === 'moderate' ||
    h.toLowerCase() === 'high'
  );

  // Fallback to last column if no score column found
  const scoreColName = scoreColIndex >= 0 ? headers[scoreColIndex] : headers[headers.length - 1];

  console.log(`[eDNA Cred] All headers:`, headers);
  console.log(`[eDNA Cred] Using columns - GBIF: "${gbifColName}" (index: ${gbifColIndex}), Score: "${scoreColName}" (index: ${scoreColIndex >= 0 ? scoreColIndex : headers.length - 1})`);
  console.log(`[eDNA Cred] Processing ${data.length} rows`);
  console.log(`[eDNA Cred] First row sample:`, data[0]);
  if (data.length > 0) {
    console.log(`[eDNA Cred] First row GBIF value:`, data[0][gbifColName]);
    console.log(`[eDNA Cred] First row Score value:`, data[0][scoreColName]);
  }

  for (const row of data) {
    // Skip empty rows
    if (!row || Object.keys(row).length === 0) {
      continue;
    }

    // Extract species name
    const speciesName = extractSpeciesName(row, headers);
    if (!speciesName) {
      skippedCount++;
      continue;
    }

    // Extract and normalize credibility score (last column)
    const scoreValue = row[scoreColName];
    const credibilityScore = normalizeCredibilityScore(scoreValue);
    if (!credibilityScore) {
      console.warn(`[eDNA Cred] Skipping row - invalid credibility score: "${scoreValue}" (type: ${typeof scoreValue}) for species: ${speciesName}`);
      skippedCount++;
      continue;
    }

    // Extract and normalize GBIF status
    const gbifValue = row[gbifColName];
    const gbifStatus = normalizeGBIFStatus(gbifValue);

    credibilityRows.push({
      speciesName,
      gbifStatus,
      credibilityScore
    });
  }

  console.log(`[eDNA Cred] Parsed ${credibilityRows.length} valid rows, skipped ${skippedCount} rows`);

  return { rows: credibilityRows, skippedCount };
}

/**
 * Aggregates credibility data by score category and GBIF status
 * Counts unique species (deduplicated by name)
 *
 * @param rows - Parsed credibility rows
 * @returns Aggregated counts for visualization
 */
export function aggregateCredibilityData(rows: CredibilityRow[]): AggregatedCredData {
  const aggregated: AggregatedCredData = {
    low_gbif_true: 0,
    low_gbif_false: 0,
    moderate_gbif_true: 0,
    moderate_gbif_false: 0,
    high_gbif_true: 0,
    high_gbif_false: 0,
    totalUniqueSpecies: 0
  };

  // Count by category
  for (const row of rows) {
    const key = `${row.credibilityScore.toLowerCase()}_gbif_${row.gbifStatus ? 'true' : 'false'}` as keyof Omit<AggregatedCredData, 'totalUniqueSpecies'>;
    aggregated[key]++;
  }

  // Calculate total unique species (deduplicate by name, case-insensitive)
  const uniqueSpeciesSet = new Set(
    rows.map(r => r.speciesName.toLowerCase().trim())
  );
  aggregated.totalUniqueSpecies = uniqueSpeciesSet.size;

  console.log('[eDNA Cred] Aggregated data:', aggregated);

  return aggregated;
}

/**
 * Main processing function - combines parsing and aggregation
 *
 * @param data - Raw CSV data
 * @param headers - Column headers
 * @returns Aggregated data ready for charting
 */
export function processCredibilityFile(
  data: any[],
  headers: string[]
): { aggregated: AggregatedCredData; skippedCount: number } {
  const { rows, skippedCount } = parseCredData(data, headers);
  const aggregated = aggregateCredibilityData(rows);

  return { aggregated, skippedCount };
}

/**
 * Utility function to check if a file is a _Cred file
 */
export function isCredFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('_cred.csv');
}
