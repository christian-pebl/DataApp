
import type { LucideIcon } from "lucide-react";
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils'; // Ensure this path is correct and lib/utils.ts is fine

// Conversion Factor - 1 m/s to knots
export const KNOTS_CONVERSION_FACTOR = 1.94384; 

// Main data point structure for combined weather and marine data
export interface CombinedDataPoint {
  time: string;
  // Marine
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
  seaSurfaceTemperature?: number;
  seaLevelHeightMsl?: number; // Tide Height
  // Weather
  temperature2m?: number;
  windSpeed10m?: number; // This will be in m/s from API, converted to knots in grid for display
  windDirection10m?: number;
  ghi?: number; // Global Horizontal Irradiance from weather API
}

export const CombinedDataPointSchema = z.object({
  time: z.string(),
  // Marine
  waveHeight: z.number().optional().nullable(),
  waveDirection: z.number().optional().nullable(),
  wavePeriod: z.number().optional().nullable(),
  seaSurfaceTemperature: z.number().optional().nullable(),
  seaLevelHeightMsl: z.number().optional().nullable(),
  // Weather
  temperature2m: z.number().optional().nullable(),
  windSpeed10m: z.number().optional().nullable(),
  windDirection10m: z.number().optional().nullable(),
  ghi: z.number().optional().nullable(),
});

export type CombinedParameterKey =
  | 'seaLevelHeightMsl'
  | 'waveHeight'
  | 'waveDirection'
  | 'wavePeriod'
  | 'seaSurfaceTemperature'
  | 'temperature2m'
  | 'windSpeed10m'
  | 'windDirection10m'
  | 'ghi';

export const ALL_PARAMETERS: CombinedParameterKey[] = [
  'waveHeight',           // Top 4 defaults for plot stack
  'windSpeed10m',
  'windDirection10m',
  'seaLevelHeightMsl',
  'wavePeriod',           // Rest optional
  'waveDirection',
  'temperature2m',
  'seaSurfaceTemperature',
  'ghi',
];

export interface ParameterConfigItem {
  name: string;
  apiParam: string;
  unit: string;
  apiSource: 'marine' | 'weather';
  icon?: LucideIcon; // Made icon optional here, will be assigned in page.tsx
  color: string;
}

export const PARAMETER_CONFIG: Record<CombinedParameterKey, ParameterConfigItem> = {
  // Weather Parameters
  windSpeed10m: { name: "Wind Speed (10m)", apiParam: "windspeed_10m", unit: "knots", apiSource: 'weather', color: '--chart-7' }, // Cyan - for wind/air movement
  windDirection10m: { name: "Wind Direction (10m)", apiParam: "winddirection_10m", unit: "°", apiSource: 'weather', color: '--chart-8' }, // Forest Green - for wind direction
  waveHeight: { name: "Wave Height", apiParam: "wave_height", unit: "m", apiSource: 'marine', color: '--chart-1' }, // Vibrant Blue - for ocean waves
  wavePeriod: { name: "Wave Period", apiParam: "wave_period", unit: "s", apiSource: 'marine', color: '--chart-3' }, // Emerald Green - for wave timing
  waveDirection: { name: "Wave Direction", apiParam: "wave_direction", unit: "°", apiSource: 'marine', color: '--chart-5' }, // Rose Pink - for wave direction
  temperature2m: { name: "Air Temperature (2m)", apiParam: "temperature_2m", unit: "°C", apiSource: 'weather', color: '--chart-2' }, // Orange - for air temperature/warmth
  seaSurfaceTemperature: { name: "Sea Surface Temp (0m)", apiParam: "sea_surface_temperature", unit: "°C", apiSource: 'marine', color: '--chart-9' }, // Red - for sea temperature (distinct from air temp)
  ghi: { name: "Global Horizontal Irradiance (GHI)", apiParam: "shortwave_radiation", unit: "W/m²", apiSource: 'weather', color: '--chart-6' }, // Amber - for solar radiation/sunshine
  // Marine Parameters
  seaLevelHeightMsl: { name: "Sea Level (MSL)", apiParam: "sea_level_height_msl", unit: "m", apiSource: 'marine', color: '--chart-4' }, // Purple - for sea level/tides
};

export const FetchCombinedDataInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, { message: "Invalid start date format or value. Ensure YYYY-MM-DD format." }),
  endDate: z.string().refine(isValidDateString, { message: "Invalid end date format or value. Ensure YYYY-MM-DD format." }),
  parameters: z.array(z.string()).min(1, "At least one parameter must be selected"),
});
export type FetchCombinedDataInput = z.infer<typeof FetchCombinedDataInputSchema>;

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
}

// Type for the raw 'hourly' object from Open-Meteo API responses
export interface OpenMeteoHourlyResponse {
  time: string[];
  // Weather params
  temperature_2m?: (number | null)[];
  windspeed_10m?: (number | null)[];
  winddirection_10m?: (number | null)[];
  shortwave_radiation?: (number | null)[]; // GHI for weather API
  // Marine params
  sea_level_height_msl?: (number | null)[];
  wave_height?: (number | null)[];
  wave_direction?: (number | null)[];
  wave_period?: (number | null)[];
  sea_surface_temperature?: (number | null)[];
}

export interface OpenMeteoApiResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  hourly: OpenMeteoHourlyResponse;
  hourly_units?: Record<string, string>; // Make units optional as they might not always be present
  error?: boolean;
  reason?: string;
}
