
import { z } from 'zod';
import type { LucideIcon } from "lucide-react";
import { isValidDateString } from '@/lib/utils';

// Combined Data Point for both Weather and Marine data
export interface CombinedDataPoint {
  time: string; // ISO timestamp

  // Marine Parameters
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
  seaSurfaceTemperature?: number;
  seaLevelHeightMsl?: number;

  // Weather Parameters
  temperature2m?: number;
  windSpeed10m?: number; // Storing as m/s from API
  windDirection10m?: number;
  cloudCover?: number;
}

export const CombinedDataPointSchema = z.object({
  time: z.string(),
  waveHeight: z.number().optional(),
  waveDirection: z.number().optional(),
  wavePeriod: z.number().optional(),
  seaSurfaceTemperature: z.number().optional(),
  seaLevelHeightMsl: z.number().optional(),
  temperature2m: z.number().optional(),
  windSpeed10m: z.number().optional(),
  windDirection10m: z.number().optional(),
  cloudCover: z.number().optional(),
});


export const FetchCombinedDataInputSchema = z.object({
  latitude: z.number().min(-90, "Latitude must be >= -90").max(90, "Latitude must be <= 90"),
  longitude: z.number().min(-180, "Longitude must be >= -180").max(180, "Longitude must be <= 180"),
  startDate: z.string().refine(isValidDateString, {
    message: "Invalid start date format or value. Ensure YYYY-MM-DD format.",
  }),
  endDate: z.string().refine(isValidDateString, {
    message: "Invalid end date format or value. Ensure YYYY-MM-DD format.",
  }),
  parameters: z.array(z.string()).min(1, "At least one parameter must be selected"),
});
export type FetchCombinedDataInput = z.infer<typeof FetchCombinedDataInputSchema>;

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
}

export type CombinedParameterKey =
  | 'waveHeight'
  | 'waveDirection'
  | 'wavePeriod'
  | 'seaSurfaceTemperature'
  | 'seaLevelHeightMsl'
  | 'temperature2m'
  | 'windSpeed10m'
  | 'windDirection10m'
  | 'cloudCover';

export const ALL_PARAMETERS: CombinedParameterKey[] = [
  'seaLevelHeightMsl',
  'waveHeight',
  'waveDirection',
  'wavePeriod',
  'seaSurfaceTemperature',
  'temperature2m',
  'windSpeed10m',
  'windDirection10m',
  'cloudCover',
];

export const PARAMETER_CONFIG: Record<CombinedParameterKey, { name: string; apiParam: string; unit: string; apiSource: 'marine' | 'weather'; icon?: LucideIcon }> = {
  // Marine Parameters
  seaLevelHeightMsl: { name: "Sea Level (MSL)", apiParam: "sea_level_height_msl", unit: "m", apiSource: 'marine' },
  waveHeight: { name: "Wave Height", apiParam: "wave_height", unit: "m", apiSource: 'marine' },
  waveDirection: { name: "Wave Direction", apiParam: "wave_direction", unit: "°", apiSource: 'marine' },
  wavePeriod: { name: "Wave Period", apiParam: "wave_period", unit: "s", apiSource: 'marine' },
  seaSurfaceTemperature: { name: "Sea Surface Temp", apiParam: "sea_surface_temperature", unit: "°C", apiSource: 'marine'},
  // Weather Parameters
  temperature2m: { name: "Temperature (2m)", apiParam: "temperature_2m", unit: "°C", apiSource: 'weather' },
  windSpeed10m: { name: "Wind Speed (10m)", apiParam: "windspeed_10m", unit: "km/h", apiSource: 'weather' }, // API provides km/h, will convert to mph in grid
  windDirection10m: { name: "Wind Direction (10m)", apiParam: "winddirection_10m", unit: "°", apiSource: 'weather' },
  cloudCover: { name: "Cloud Cover", apiParam: "cloudcover", unit: "%", apiSource: 'weather' },
};
