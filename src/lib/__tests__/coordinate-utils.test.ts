import { describe, it, expect } from 'vitest';
import {
  decimalToDegreeMinutes,
  decimalToDegreeMinutesSeconds,
  degreeMinutesToDecimal,
  degreeMinutesSecondsToDecimal,
  parseCoordinateInput,
  getCoordinateFormats,
  validateCoordinate,
  type CoordinateFormats
} from '../coordinate-utils';

describe('coordinate-utils', () => {
  describe('decimalToDegreeMinutes', () => {
    it('should convert positive decimal degrees to degree minutes format', () => {
      expect(decimalToDegreeMinutes(51.68498)).toBe("51°41.099'");
    });

    it('should convert negative decimal degrees to degree minutes format', () => {
      expect(decimalToDegreeMinutes(-0.10100)).toBe("-0°6.060'");
    });

    it('should handle zero', () => {
      expect(decimalToDegreeMinutes(0)).toBe("0°0.000'");
    });

    it('should handle whole degrees', () => {
      expect(decimalToDegreeMinutes(45)).toBe("45°0.000'");
    });

    it('should format minutes to 3 decimal places', () => {
      const result = decimalToDegreeMinutes(51.1234567);
      expect(result).toMatch(/^\d+°\d+\.\d{3}'$/);
    });
  });

  describe('decimalToDegreeMinutesSeconds', () => {
    it('should convert positive decimal degrees to degree minutes seconds format', () => {
      expect(decimalToDegreeMinutesSeconds(51.68498)).toBe("51°41'5.9\"");
    });

    it('should convert negative decimal degrees to degree minutes seconds format', () => {
      expect(decimalToDegreeMinutesSeconds(-0.10100)).toBe("-0°6'3.6\"");
    });

    it('should handle zero', () => {
      expect(decimalToDegreeMinutesSeconds(0)).toBe("0°0'0.0\"");
    });

    it('should handle whole degrees', () => {
      expect(decimalToDegreeMinutesSeconds(90)).toBe("90°0'0.0\"");
    });

    it('should format seconds to 1 decimal place', () => {
      const result = decimalToDegreeMinutesSeconds(51.1234567);
      expect(result).toMatch(/^\d+°\d+'\d+\.\d{1}"$/);
    });
  });

  describe('degreeMinutesToDecimal', () => {
    it('should parse degree symbol format', () => {
      expect(degreeMinutesToDecimal("51°41.099'")).toBeCloseTo(51.68498, 4);
    });

    it('should parse degree symbol format without trailing apostrophe', () => {
      expect(degreeMinutesToDecimal("51°41.099")).toBeCloseTo(51.68498, 4);
    });

    it('should parse deg format', () => {
      expect(degreeMinutesToDecimal("51deg41.099")).toBeCloseTo(51.68498, 4);
    });

    it('should parse d/m format', () => {
      expect(degreeMinutesToDecimal("51d41.099m")).toBeCloseTo(51.68498, 4);
    });

    it('should handle negative coordinates', () => {
      expect(degreeMinutesToDecimal("-0°6.060'")).toBeCloseTo(-0.10100, 4);
    });

    it('should return null for invalid format', () => {
      expect(degreeMinutesToDecimal("invalid")).toBeNull();
    });

    it('should return null for minutes >= 60', () => {
      expect(degreeMinutesToDecimal("51°60.0'")).toBeNull();
    });

    it('should handle whole degrees with zero minutes', () => {
      expect(degreeMinutesToDecimal("45°0'")).toBe(45);
    });

    it('should trim whitespace', () => {
      expect(degreeMinutesToDecimal("  51°41.099'  ")).toBeCloseTo(51.68498, 4);
    });
  });

  describe('degreeMinutesSecondsToDecimal', () => {
    it('should parse degree symbol format', () => {
      expect(degreeMinutesSecondsToDecimal("51°41'5.9\"")).toBeCloseTo(51.68497, 4);
    });

    it('should parse degree symbol format without trailing quote', () => {
      expect(degreeMinutesSecondsToDecimal("51°41'5.9")).toBeCloseTo(51.68497, 4);
    });

    it('should parse deg format', () => {
      expect(degreeMinutesSecondsToDecimal("51deg41'5.9\"")).toBeCloseTo(51.68497, 4);
    });

    it('should parse d/m/s format', () => {
      expect(degreeMinutesSecondsToDecimal("51d41m5.9s")).toBeCloseTo(51.68497, 4);
    });

    it('should handle negative coordinates', () => {
      expect(degreeMinutesSecondsToDecimal("-0°6'3.6\"")).toBeCloseTo(-0.10100, 4);
    });

    it('should return null for invalid format', () => {
      expect(degreeMinutesSecondsToDecimal("invalid")).toBeNull();
    });

    it('should return null for minutes >= 60', () => {
      expect(degreeMinutesSecondsToDecimal("51°60'0\"")).toBeNull();
    });

    it('should return null for seconds >= 60', () => {
      expect(degreeMinutesSecondsToDecimal("51°41'60\"")).toBeNull();
    });

    it('should handle whole degrees', () => {
      expect(degreeMinutesSecondsToDecimal("90°0'0\"")).toBe(90);
    });
  });

  describe('parseCoordinateInput', () => {
    it('should parse decimal format', () => {
      expect(parseCoordinateInput("51.68498")).toBeCloseTo(51.68498, 4);
    });

    it('should parse negative decimal format', () => {
      expect(parseCoordinateInput("-0.10100")).toBeCloseTo(-0.10100, 4);
    });

    it('should parse degree minutes format', () => {
      expect(parseCoordinateInput("51°41.099'")).toBeCloseTo(51.68498, 4);
    });

    it('should parse degree minutes seconds format', () => {
      expect(parseCoordinateInput("51°41'5.9\"")).toBeCloseTo(51.68497, 4);
    });

    it('should prioritize degree/minute parsing over decimal', () => {
      // This ensures "51°41.099" is parsed as degree/minute, not as "51"
      expect(parseCoordinateInput("51°41.099")).toBeCloseTo(51.68498, 4);
    });

    it('should return null for empty string', () => {
      expect(parseCoordinateInput("")).toBeNull();
    });

    it('should return null for whitespace only', () => {
      expect(parseCoordinateInput("   ")).toBeNull();
    });

    it('should return null for null input', () => {
      expect(parseCoordinateInput(null as any)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseCoordinateInput(undefined as any)).toBeNull();
    });

    it('should return null for invalid format', () => {
      expect(parseCoordinateInput("not a coordinate")).toBeNull();
    });

    it('should trim input before parsing', () => {
      expect(parseCoordinateInput("  51.68498  ")).toBeCloseTo(51.68498, 4);
    });
  });

  describe('getCoordinateFormats', () => {
    it('should return all three coordinate formats', () => {
      const formats = getCoordinateFormats(51.68498);

      expect(formats).toHaveProperty('decimal');
      expect(formats).toHaveProperty('degreeMinutes');
      expect(formats).toHaveProperty('degreeMinutesSeconds');
    });

    it('should return correct decimal format', () => {
      const formats = getCoordinateFormats(51.68498);
      expect(formats.decimal).toBe('51.68498');
    });

    it('should return correct degree minutes format', () => {
      const formats = getCoordinateFormats(51.68498);
      expect(formats.degreeMinutes).toBe("51°41.099'");
    });

    it('should return correct degree minutes seconds format', () => {
      const formats = getCoordinateFormats(51.68498);
      expect(formats.degreeMinutesSeconds).toBe("51°41'5.9\"");
    });

    it('should handle negative coordinates', () => {
      const formats = getCoordinateFormats(-0.10100);

      expect(formats.decimal).toBe('-0.101');
      expect(formats.degreeMinutes).toBe("-0°6.060'");
      expect(formats.degreeMinutesSeconds).toBe("-0°6'3.6\"");
    });

    it('should handle zero', () => {
      const formats = getCoordinateFormats(0);

      expect(formats.decimal).toBe('0');
      expect(formats.degreeMinutes).toBe("0°0.000'");
      expect(formats.degreeMinutesSeconds).toBe("0°0'0.0\"");
    });
  });

  describe('validateCoordinate', () => {
    describe('latitude validation', () => {
      it('should accept valid latitude within bounds', () => {
        expect(validateCoordinate(0, 'latitude')).toBe(true);
        expect(validateCoordinate(45.5, 'latitude')).toBe(true);
        expect(validateCoordinate(-45.5, 'latitude')).toBe(true);
      });

      it('should accept boundary values', () => {
        expect(validateCoordinate(90, 'latitude')).toBe(true);
        expect(validateCoordinate(-90, 'latitude')).toBe(true);
      });

      it('should reject latitude > 90', () => {
        expect(validateCoordinate(90.1, 'latitude')).toBe(false);
        expect(validateCoordinate(180, 'latitude')).toBe(false);
      });

      it('should reject latitude < -90', () => {
        expect(validateCoordinate(-90.1, 'latitude')).toBe(false);
        expect(validateCoordinate(-180, 'latitude')).toBe(false);
      });

      it('should reject NaN', () => {
        expect(validateCoordinate(NaN, 'latitude')).toBe(false);
      });
    });

    describe('longitude validation', () => {
      it('should accept valid longitude within bounds', () => {
        expect(validateCoordinate(0, 'longitude')).toBe(true);
        expect(validateCoordinate(100, 'longitude')).toBe(true);
        expect(validateCoordinate(-100, 'longitude')).toBe(true);
      });

      it('should accept boundary values', () => {
        expect(validateCoordinate(180, 'longitude')).toBe(true);
        expect(validateCoordinate(-180, 'longitude')).toBe(true);
      });

      it('should reject longitude > 180', () => {
        expect(validateCoordinate(180.1, 'longitude')).toBe(false);
        expect(validateCoordinate(200, 'longitude')).toBe(false);
      });

      it('should reject longitude < -180', () => {
        expect(validateCoordinate(-180.1, 'longitude')).toBe(false);
        expect(validateCoordinate(-200, 'longitude')).toBe(false);
      });

      it('should reject NaN', () => {
        expect(validateCoordinate(NaN, 'longitude')).toBe(false);
      });
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain precision through decimal -> degreeMinutes -> decimal', () => {
      const original = 51.68498;
      const degMin = decimalToDegreeMinutes(original);
      const backToDecimal = degreeMinutesToDecimal(degMin);

      expect(backToDecimal).toBeCloseTo(original, 4);
    });

    it('should maintain precision through decimal -> degreeMinutesSeconds -> decimal', () => {
      const original = 51.68498;
      const degMinSec = decimalToDegreeMinutesSeconds(original);
      const backToDecimal = degreeMinutesSecondsToDecimal(degMinSec);

      expect(backToDecimal).toBeCloseTo(original, 4);
    });

    it('should handle negative coordinates in round-trip', () => {
      const original = -0.10100;
      const degMin = decimalToDegreeMinutes(original);
      const backToDecimal = degreeMinutesToDecimal(degMin);

      expect(backToDecimal).toBeCloseTo(original, 4);
    });
  });

  describe('edge cases', () => {
    it('should handle very small coordinates', () => {
      const small = 0.00001;
      expect(validateCoordinate(small, 'latitude')).toBe(true);
      expect(decimalToDegreeMinutes(small)).toBeTruthy();
    });

    it('should handle coordinates at equator/prime meridian', () => {
      expect(validateCoordinate(0, 'latitude')).toBe(true);
      expect(validateCoordinate(0, 'longitude')).toBe(true);
    });

    it('should handle coordinates at poles', () => {
      expect(validateCoordinate(90, 'latitude')).toBe(true);
      expect(validateCoordinate(-90, 'latitude')).toBe(true);
    });

    it('should handle coordinates at date line', () => {
      expect(validateCoordinate(180, 'longitude')).toBe(true);
      expect(validateCoordinate(-180, 'longitude')).toBe(true);
    });
  });
});
