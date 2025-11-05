/**
 * eDNA Utility Functions
 *
 * Handles eDNA-specific data processing including:
 * - Date extraction from filenames
 * - Station label abbreviation
 * - Data parsing and formatting
 */

/**
 * Extract date from eDNA filename
 * Format: PROJECTNAME_EDNA_ALL_YYMM
 * Example: ALGA_EDNA_ALL_2507 → July 2025 → 2025-07-01
 *
 * @param fileName - The eDNA file name
 * @returns Date object or null if unable to parse
 */
export function extractEdnaDate(fileName: string): Date | null {
  try {
    const parts = fileName.split('_');

    // Look for YYMM pattern in the filename parts
    for (const part of parts) {
      // Match 4 digits that could be YYMM
      if (/^\d{4}$/.test(part)) {
        const yy = parseInt(part.substring(0, 2), 10);
        const mm = parseInt(part.substring(2, 4), 10);

        // Validate month
        if (mm < 1 || mm > 12) continue;

        // Convert 2-digit year to 4-digit (assume 20xx)
        const yyyy = 2000 + yy;

        // Create date object (first day of the month)
        return new Date(yyyy, mm - 1, 1);
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting eDNA date from filename:', fileName, error);
    return null;
  }
}

/**
 * Format eDNA date for display
 *
 * @param date - Date object
 * @returns Formatted date string (DD/MM/YYYY)
 */
export function formatEdnaDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Abbreviate station labels for eDNA data
 *
 * Rules:
 * 1. Remove project prefix (e.g., "ALGA_", "NORF_")
 * 2. Abbreviate using first letters of words separated by underscore
 *
 * Examples:
 * - "ALGA_Control_South" → "C_S"
 * - "ALGA_Farm_Longlines" → "F_L"
 * - "ALGA_Farm_ArcticSeaweed" → "F_AS"
 * - "HVS_EXT NEG 1" → "EXT NEG 1" (control sample, keep as-is after prefix removal)
 *
 * @param stationLabel - Full station label from CSV
 * @param projectPrefix - Optional project prefix to remove (e.g., "ALGA")
 * @returns Abbreviated label
 */
export function abbreviateStationLabel(stationLabel: string, projectPrefix?: string): string {
  try {
    let label = stationLabel.trim();

    // Remove project prefix if provided
    if (projectPrefix) {
      const prefixPattern = new RegExp(`^${projectPrefix}_`, 'i');
      label = label.replace(prefixPattern, '');
    }

    // Check if this is a control sample (contains "NEG", "Control", etc. as single words)
    // These should be returned as-is (without further abbreviation)
    if (label.match(/\b(NEG|NEGATIVE|CONTROL)\b/i) || !label.includes('_')) {
      return label;
    }

    // Split by underscore and abbreviate each part
    const parts = label.split('_');
    const abbreviated = parts.map(part => {
      // Keep short parts as-is (2 chars or less)
      if (part.length <= 2) return part;

      // For multi-word parts (camelCase or PascalCase), extract capitals
      const capitals = part.match(/[A-Z]/g);
      if (capitals && capitals.length > 1) {
        return capitals.join('');
      }

      // Otherwise, take first letter
      return part.charAt(0).toUpperCase();
    });

    return abbreviated.join('_');
  } catch (error) {
    console.error('Error abbreviating station label:', stationLabel, error);
    return stationLabel;
  }
}

/**
 * Check if filename is an eDNA Meta file
 *
 * @param fileName - File name to check
 * @returns true if this is an eDNA Meta file
 */
export function isEdnaMetaFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return lowerName.includes('edna') && (lowerName.includes('_meta') || lowerName.includes('_metadata'));
}

/**
 * Extract project prefix from eDNA filename
 *
 * Examples:
 * - "ALGA_EDNA_ALL_2507_Meta.csv" → "ALGA"
 * - "NORF_EDNA_ALL_2507_Meta.csv" → "NORF"
 *
 * @param fileName - eDNA file name
 * @returns Project prefix or empty string
 */
export function extractProjectPrefix(fileName: string): string {
  const parts = fileName.split('_');
  if (parts.length > 0 && parts[0]) {
    return parts[0].toUpperCase();
  }
  return '';
}

/**
 * Get concentration parameter columns for eDNA Meta files
 *
 * @returns Array of parameter column names
 */
export function getEdnaMetaConcentrationParams(): string[] {
  return [
    'eDNA Concentration (ng/µL)',
    '18SSSU Marker Concentration (ng/µL)',
    'COILB Marker Concentration (ng/µL)'
  ];
}

/**
 * Check if a sample name is a negative control
 * Negative controls contain keywords like "NEG", "NEGATIVE", "CONTROL" as whole words
 *
 * @param sampleName - Sample name to check
 * @returns true if this is a negative control sample
 */
export function isNegativeControl(sampleName: string): boolean {
  if (!sampleName || typeof sampleName !== 'string') return false;
  return /\b(NEG|NEGATIVE|CONTROL)\b/i.test(sampleName.trim());
}
