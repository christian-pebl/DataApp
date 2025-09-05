/**
 * Coordinate format conversion utilities
 * Supports multiple coordinate formats for easier input
 */

export interface CoordinateFormats {
  decimal: string;
  degreeMinutes: string;
  degreeMinutesSeconds: string;
}

/**
 * Convert decimal degrees to degrees and decimal minutes
 * Example: 51.68498 → "51°41.099'"
 */
export function decimalToDegreeMinutes(decimal: number): string {
  const isNegative = decimal < 0;
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutes = (abs - degrees) * 60;
  
  const sign = isNegative ? '-' : '';
  return `${sign}${degrees}°${minutes.toFixed(3)}'`;
}

/**
 * Convert decimal degrees to degrees, minutes, and seconds
 * Example: 51.68498 → "51°41'5.9""
 */
export function decimalToDegreeMinutesSeconds(decimal: number): string {
  const isNegative = decimal < 0;
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  
  const sign = isNegative ? '-' : '';
  return `${sign}${degrees}°${minutes}'${seconds.toFixed(1)}"`;
}

/**
 * Parse degrees and decimal minutes to decimal degrees
 * Supports formats: "51°41.099'", "51°41.099", "51deg41.099'", "51d41.099m"
 */
export function degreeMinutesToDecimal(input: string): number | null {
  // Remove spaces and normalize
  const normalized = input.trim().replace(/\s+/g, '');
  
  // Match various degree/minute formats - prioritize degree symbol first
  const patterns = [
    /^(-?\d+)°(\d+\.?\d*)'?$/,              // 51°41.099' or 51°41.099 (PREFERRED)
    /^(-?\d+)deg(\d+\.?\d*)'?$/i,           // 51deg41.099' or 51deg41.099
    /^(-?\d+)d(\d+\.?\d*)m?$/i,             // 51d41.099m or 51d41.099
    /^(-?\d+)\s*°\s*(\d+\.?\d*)\s*'?$/,     // 51 ° 41.099 '
    /^(-?\d+)\s*deg\s*(\d+\.?\d*)\s*'?$/i   // 51 deg 41.099 '
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const degrees = parseInt(match[1], 10);
      const minutes = parseFloat(match[2]);
      
      if (isNaN(degrees) || isNaN(minutes) || minutes >= 60) {
        return null;
      }
      
      const decimal = Math.abs(degrees) + minutes / 60;
      return degrees < 0 ? -decimal : decimal;
    }
  }
  
  return null;
}

/**
 * Parse degrees, minutes, and seconds to decimal degrees
 * Supports formats: "51°41'5.9"", "51deg41'5.9"", "51d41m5.9s"
 */
export function degreeMinutesSecondsToDecimal(input: string): number | null {
  const normalized = input.trim().replace(/\s+/g, '');
  
  const patterns = [
    /^(-?\d+)°(\d+)'(\d+\.?\d*)"?$/,         // 51°41'5.9" (PREFERRED)
    /^(-?\d+)deg(\d+)'(\d+\.?\d*)"?$/i,      // 51deg41'5.9"
    /^(-?\d+)d(\d+)m(\d+\.?\d*)s?$/i,        // 51d41m5.9s
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const degrees = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseFloat(match[3]);
      
      if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds) || 
          minutes >= 60 || seconds >= 60) {
        return null;
      }
      
      const decimal = Math.abs(degrees) + minutes / 60 + seconds / 3600;
      return degrees < 0 ? -decimal : decimal;
    }
  }
  
  return null;
}

/**
 * Parse any coordinate format to decimal degrees
 */
export function parseCoordinateInput(input: string): number | null {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  if (!trimmed) return null;
  
  // Try degree/minutes format first (before decimal parsing)
  const degMin = degreeMinutesToDecimal(trimmed);
  if (degMin !== null) {
    return degMin;
  }
  
  // Try degree/minutes/seconds format
  const degMinSec = degreeMinutesSecondsToDecimal(trimmed);
  if (degMinSec !== null) {
    return degMinSec;
  }
  
  // Try parsing as decimal last (only for pure numbers)
  const decimal = parseFloat(trimmed);
  if (!isNaN(decimal) && trimmed === decimal.toString()) {
    return decimal;
  }
  
  return null;
}

/**
 * Get all coordinate formats for a decimal value
 */
export function getCoordinateFormats(decimal: number): CoordinateFormats {
  return {
    decimal: decimal.toString(),
    degreeMinutes: decimalToDegreeMinutes(decimal),
    degreeMinutesSeconds: decimalToDegreeMinutesSeconds(decimal)
  };
}

/**
 * Validate coordinate bounds
 */
export function validateCoordinate(value: number, type: 'latitude' | 'longitude'): boolean {
  if (isNaN(value)) return false;
  
  if (type === 'latitude') {
    return value >= -90 && value <= 90;
  } else {
    return value >= -180 && value <= 180;
  }
}

export type CoordinateFormat = 'decimal' | 'degreeMinutes' | 'degreeMinutesSeconds';

export const COORDINATE_FORMAT_LABELS = {
  decimal: 'Decimal Degrees',
  degreeMinutes: 'Degrees Minutes',
  degreeMinutesSeconds: 'Degrees Minutes Seconds'
} as const;

export const COORDINATE_FORMAT_EXAMPLES = {
  decimal: 'e.g., 51.68498',
  degreeMinutes: 'e.g., 51°41.099\'',
  degreeMinutesSeconds: 'e.g., 51°41\'5.9"'
} as const;