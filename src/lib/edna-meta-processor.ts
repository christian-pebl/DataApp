/**
 * eDNA Meta File Processor
 *
 * Handles eDNA Meta files which have WIDE FORMAT:
 * - ONE row per sample
 * - MULTIPLE parameter columns (eDNA Concentration, 18SSSU Marker, COILB Marker)
 *
 * Each sample has values for all three concentration parameters in the same row.
 */

import type { ParsedDataPoint } from '@/components/pin-data/csvParser';
import type { SpotSampleGroup } from './statistical-utils';
import { formatSpotSampleLabel } from './statistical-utils';
import { abbreviateStationLabel, extractProjectPrefix } from './edna-utils';

/**
 * Check if filename is an eDNA Meta file
 */
export function isEdnaMetaFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return lowerName.includes('edna') && (lowerName.includes('_meta') || lowerName.includes('_metadata'));
}

/**
 * Process eDNA Meta file into groups for plotting
 *
 * Meta files have one row per sample with multiple concentration columns.
 * All samples should appear in all three charts (eDNA, 18SSSU, COILB).
 *
 * @param data - Parsed data points
 * @param sampleIdColumn - Name of the sample ID column (e.g., "Sample Name", "Station")
 * @param fileName - File name for project prefix extraction
 * @returns Array of groups, one per sample per parameter
 */
export function processEdnaMetaFile(
  data: ParsedDataPoint[],
  sampleIdColumn: string,
  fileName: string
): SpotSampleGroup[] {
  console.log('[EDNA-META-PROCESSOR] ═══════════════════════════════════════');
  console.log('[EDNA-META-PROCESSOR] Processing eDNA Meta file');
  console.log('[EDNA-META-PROCESSOR] Sample ID column:', sampleIdColumn);
  console.log('[EDNA-META-PROCESSOR] Data rows:', data.length);

  // Define the three concentration parameters
  const concentrationParams = [
    'eDNA Concentration (ng/µL)',
    '18SSSU Marker Concentration (ng/µL)',
    'COILB Marker Concentration (ng/µL)'
  ];

  // Step 1: Extract valid samples (excluding NEG controls and empty rows)
  const validSamples: Array<{
    date: string;
    sampleId: string;
    values: {
      'eDNA Concentration (ng/µL)': number | null;
      '18SSSU Marker Concentration (ng/µL)': number | null;
      'COILB Marker Concentration (ng/µL)': number | null;
    };
  }> = [];

  for (const row of data) {
    const sampleId = row[sampleIdColumn];
    const dateValue = row['time'];

    // Skip if no sample ID or no date
    if (!sampleId || !dateValue) {
      continue;
    }

    const sampleIdStr = String(sampleId);

    // Skip negative controls
    if (/\b(NEG|NEGATIVE|CONTROL)\b/i.test(sampleIdStr)) {
      console.log('[EDNA-META-PROCESSOR] Skipping negative control:', sampleIdStr);
      continue;
    }

    // Extract date
    const dateObj = new Date(dateValue);
    const isoDate = dateObj.toISOString().split('T')[0];

    // Extract concentration values
    const values = {
      'eDNA Concentration (ng/µL)': extractNumber(row['eDNA Concentration (ng/µL)']),
      '18SSSU Marker Concentration (ng/µL)': extractNumber(row['18SSSU Marker Concentration (ng/µL)']),
      'COILB Marker Concentration (ng/µL)': extractNumber(row['COILB Marker Concentration (ng/µL)'])
    };

    // Check if at least one concentration value exists
    const hasAnyValue = Object.values(values).some(v => v !== null);
    if (!hasAnyValue) {
      continue;
    }

    validSamples.push({
      date: isoDate,
      sampleId: sampleIdStr,
      values
    });

    console.log('[EDNA-META-PROCESSOR] Valid sample:', {
      sample: sampleIdStr,
      date: isoDate,
      eDNA: values['eDNA Concentration (ng/µL)'],
      '18SSSU': values['18SSSU Marker Concentration (ng/µL)'],
      COILB: values['COILB Marker Concentration (ng/µL)']
    });
  }

  console.log('[EDNA-META-PROCESSOR] Found', validSamples.length, 'valid samples');

  // Step 2: Create groups - ONE group per sample per parameter
  // This ensures all samples appear in all three charts
  const groups: SpotSampleGroup[] = [];
  const projectPrefix = extractProjectPrefix(fileName);

  for (const sample of validSamples) {
    for (const param of concentrationParams) {
      const value = sample.values[param as keyof typeof sample.values];

      // Create abbreviated station label for x-axis
      const abbreviatedSample = abbreviateStationLabel(sample.sampleId, projectPrefix);
      const xAxisLabel = formatSpotSampleLabel(sample.date, abbreviatedSample);

      // Create group even if value is null (ensures consistent x-axes)
      // If value is null, we'll create an empty group with no values
      const groupValues = value !== null ? [value] : [];
      const count = groupValues.length;

      groups.push({
        date: sample.date,
        sampleId: sample.sampleId,
        xAxisLabel: xAxisLabel,
        parameter: param,
        values: groupValues,
        count: count,
        stats: {
          mean: value !== null ? value : 0,
          sd: 0,
          se: 0,
          min: value !== null ? value : 0,
          Q1: value !== null ? value : 0,
          median: value !== null ? value : 0,
          Q3: value !== null ? value : 0,
          max: value !== null ? value : 0
        }
      });
    }
  }

  // Step 3: Sort by parameter, then by date, then by sample ID
  groups.sort((a, b) => {
    // First by parameter (to group eDNA, 18SSSU, COILB together)
    const paramCompare = a.parameter.localeCompare(b.parameter);
    if (paramCompare !== 0) return paramCompare;

    // Then by date
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;

    // Finally by sample ID
    return a.sampleId.localeCompare(b.sampleId);
  });

  // Log summary
  const groupsByParam = groups.reduce((acc, group) => {
    acc[group.parameter] = (acc[group.parameter] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('[EDNA-META-PROCESSOR] ═══════════════════════════════════════');
  console.log('[EDNA-META-PROCESSOR] Created', groups.length, 'groups');
  console.log('[EDNA-META-PROCESSOR] Groups by parameter:', groupsByParam);
  console.log('[EDNA-META-PROCESSOR] Sample first 3 groups:', groups.slice(0, 3));
  console.log('[EDNA-META-PROCESSOR] ═══════════════════════════════════════');

  return groups;
}

/**
 * Extract a number from a value, returning null if not a valid number
 */
function extractNumber(value: any): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}
