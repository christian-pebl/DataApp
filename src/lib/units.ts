/**
 * Unit conversion utilities for metric/imperial system
 */

export type UnitSystem = 'metric' | 'imperial';

export interface UnitConfig {
  metric: {
    symbol: string;
    label: string;
  };
  imperial: {
    symbol: string;
    label: string;
  };
  convert: {
    toImperial: (value: number) => number;
    toMetric: (value: number) => number;
  };
}

// Unit conversion configurations
export const UNIT_CONFIGS = {
  // Temperature
  temperature: {
    metric: { symbol: '°C', label: 'Celsius' },
    imperial: { symbol: '°F', label: 'Fahrenheit' },
    convert: {
      toImperial: (c: number) => (c * 9/5) + 32,
      toMetric: (f: number) => (f - 32) * 5/9
    }
  },
  
  // Distance/Height (for wave height, sea level)
  distance: {
    metric: { symbol: 'm', label: 'meters' },
    imperial: { symbol: 'ft', label: 'feet' },
    convert: {
      toImperial: (m: number) => m * 3.28084,
      toMetric: (ft: number) => ft / 3.28084
    }
  },
  
  // Wind speed
  windSpeed: {
    metric: { symbol: 'knots', label: 'knots' }, // Keep knots as "metric" standard for marine
    imperial: { symbol: 'mph', label: 'miles per hour' },
    convert: {
      toImperial: (knots: number) => knots * 1.15078, // knots to mph
      toMetric: (mph: number) => mph / 1.15078 // mph to knots
    }
  },
  
  // Solar irradiance (no conversion needed - W/m² is universal)
  irradiance: {
    metric: { symbol: 'W/m²', label: 'watts per square meter' },
    imperial: { symbol: 'W/m²', label: 'watts per square meter' },
    convert: {
      toImperial: (value: number) => value, // No conversion
      toMetric: (value: number) => value
    }
  }
} as const;

export type UnitType = keyof typeof UNIT_CONFIGS;

/**
 * Convert a value from one unit system to another
 */
export function convertValue(
  value: number, 
  unitType: UnitType, 
  fromSystem: UnitSystem, 
  toSystem: UnitSystem
): number {
  if (fromSystem === toSystem) return value;
  
  const config = UNIT_CONFIGS[unitType];
  if (fromSystem === 'metric' && toSystem === 'imperial') {
    return config.convert.toImperial(value);
  } else if (fromSystem === 'imperial' && toSystem === 'metric') {
    return config.convert.toMetric(value);
  }
  
  return value;
}

/**
 * Get the appropriate unit symbol for a given unit type and system
 */
export function getUnitSymbol(unitType: UnitType, system: UnitSystem): string {
  return UNIT_CONFIGS[unitType][system].symbol;
}

/**
 * Get the appropriate unit label for a given unit type and system
 */
export function getUnitLabel(unitType: UnitType, system: UnitSystem): string {
  return UNIT_CONFIGS[unitType][system].label;
}

/**
 * Convert value and format with appropriate unit
 */
export function formatValueWithUnit(
  value: number,
  unitType: UnitType,
  targetSystem: UnitSystem,
  precision: number = 1
): string {
  // For display purposes, we assume the source is always metric (from API)
  const convertedValue = convertValue(value, unitType, 'metric', targetSystem);
  const unit = getUnitSymbol(unitType, targetSystem);
  
  return `${convertedValue.toFixed(precision)}${unit}`;
}

/**
 * Parameter type to unit type mapping
 * Maps the parameter keys to their corresponding unit types
 */
export const PARAMETER_TO_UNIT_TYPE: Record<string, UnitType> = {
  // Temperature parameters
  'seaSurfaceTemperature': 'temperature',
  'temperature2m': 'temperature',
  
  // Distance parameters
  'waveHeight': 'distance',
  'seaLevelHeightMsl': 'distance',
  
  // Wind speed
  'windSpeed10m': 'windSpeed',
  
  // Solar irradiance
  'ghi': 'irradiance',
  
  // No conversion needed for these:
  // 'waveDirection': direction (degrees)
  // 'windDirection10m': direction (degrees) 
  // 'wavePeriod': time (seconds)
};

/**
 * Check if a parameter needs unit conversion
 */
export function parameterNeedsConversion(parameterKey: string): boolean {
  return parameterKey in PARAMETER_TO_UNIT_TYPE;
}

/**
 * Get the unit type for a parameter
 */
export function getParameterUnitType(parameterKey: string): UnitType | null {
  return PARAMETER_TO_UNIT_TYPE[parameterKey] || null;
}