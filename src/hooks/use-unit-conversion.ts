import { useMemo } from 'react';
import { useSettings } from './use-settings';
import { 
  convertValue, 
  getUnitSymbol, 
  formatValueWithUnit,
  getParameterUnitType,
  parameterNeedsConversion,
  type UnitType,
  type UnitSystem 
} from '@/lib/units';

/**
 * Hook for unit conversion based on user settings
 */
export function useUnitConversion() {
  const { settings } = useSettings();
  const unitSystem = settings?.units || 'metric';

  /**
   * Convert a value for a specific parameter
   */
  const convertParameterValue = useMemo(() => 
    (value: number, parameterKey: string): number => {
      if (!parameterNeedsConversion(parameterKey)) return value;
      
      const unitType = getParameterUnitType(parameterKey);
      if (!unitType) return value;
      
      // API data is always in metric, convert to user's preferred system
      return convertValue(value, unitType, 'metric', unitSystem);
    }, [unitSystem]
  );

  /**
   * Get the display unit for a parameter
   */
  const getParameterUnit = useMemo(() =>
    (parameterKey: string): string => {
      if (!parameterNeedsConversion(parameterKey)) {
        // Return original units for non-convertible parameters
        switch (parameterKey) {
          case 'waveDirection':
          case 'windDirection10m':
            return '°';
          case 'wavePeriod':
            return 's';
          default:
            return '';
        }
      }
      
      const unitType = getParameterUnitType(parameterKey);
      if (!unitType) return '';
      
      return getUnitSymbol(unitType, unitSystem);
    }, [unitSystem]
  );

  /**
   * Format a value with its unit
   */
  const formatParameterValue = useMemo(() =>
    (value: number, parameterKey: string, precision: number = 1): string => {
      if (!parameterNeedsConversion(parameterKey)) {
        const unit = getParameterUnit(parameterKey);
        return `${value.toFixed(precision)}${unit}`;
      }
      
      const unitType = getParameterUnitType(parameterKey);
      if (!unitType) return value.toFixed(precision);
      
      return formatValueWithUnit(value, unitType, unitSystem, precision);
    }, [unitSystem, getParameterUnit]
  );

  /**
   * Transform function generator for use with data transformation
   */
  const createParameterTransform = useMemo(() =>
    (parameterKey: string) => {
      if (!parameterNeedsConversion(parameterKey)) {
        return undefined; // No transformation needed
      }
      
      return (value: number | null | undefined): number | null | undefined => {
        if (typeof value !== 'number' || isNaN(value)) return value;
        return convertParameterValue(value, parameterKey);
      };
    }, [convertParameterValue]
  );

  return {
    unitSystem,
    convertParameterValue,
    getParameterUnit,
    formatParameterValue,
    createParameterTransform,
    isMetric: unitSystem === 'metric',
    isImperial: unitSystem === 'imperial'
  };
}