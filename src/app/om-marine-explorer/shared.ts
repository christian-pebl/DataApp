
import type { LucideIcon } from "lucide-react";
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';

// Combined Data Point for both Weather and Marine data
export interface CombinedDataPoint {
  time: string; // ISO timestamp

  // Marine Parameters
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
  seaSurfaceTemperature?: number;
  seaLevelHeightMsl?: number; // For tide data

  // Weather Parameters
  temperature2m?: number;
  windSpeed10m?: number; 
  windDirection10m?: number;
  // cloudCover is removed
  ghi?: number; // Global Horizontal Irradiance
}

export const CombinedDataPointSchema = z.object({
  time: z.string(),
  // Marine
  waveHeight: z.number().optional(),
  waveDirection: z.number().optional(),
  wavePeriod: z.number().optional(),
  seaSurfaceTemperature: z.number().optional(),
  seaLevelHeightMsl: z.number().optional(),
  // Weather
  temperature2m: z.number().optional(),
  windSpeed10m: z.number().optional(),
  windDirection10m: z.number().optional(),
  ghi: z.number().optional(),
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
  'seaLevelHeightMsl',
  'waveHeight',
  'waveDirection',
  'wavePeriod',
  'seaSurfaceTemperature',
  'temperature2m',
  'windSpeed10m',
  'windDirection10m',
  'ghi',
];

export interface ParameterConfigItem {
  name: string; 
  apiParam: string; 
  unit: string;
  apiSource: 'marine' | 'weather'; 
  icon?: LucideIcon; 
  color: string; 
}

export const PARAMETER_CONFIG: Record<CombinedParameterKey, ParameterConfigItem> = {
  // Marine Parameters
  seaLevelHeightMsl: { name: "Sea Level (MSL)", apiParam: "sea_level_height_msl", unit: "m", apiSource: 'marine', color: '--chart-1' },
  waveHeight: { name: "Wave Height", apiParam: "wave_height", unit: "m", apiSource: 'marine', color: '--chart-2' },
  waveDirection: { name: "Wave Direction", apiParam: "wave_direction", unit: "°", apiSource: 'marine', color: '--chart-3' },
  wavePeriod: { name: "Wave Period", apiParam: "wave_period", unit: "s", apiSource: 'marine', color: '--chart-4' },
  seaSurfaceTemperature: { name: "Sea Surface Temp", apiParam: "sea_surface_temperature", unit: "°C", apiSource: 'marine', color: '--chart-5'},
  // Weather Parameters (now merged)
  temperature2m: { name: "Temperature (2m)", apiParam: "temperature_2m", unit: "°C", apiSource: 'weather', color: '--chart-1' },
  windSpeed10m: { name: "Wind Speed (10m)", apiParam: "windspeed_10m", unit: "m/s", apiSource: 'weather', color: '--chart-2' }, // Assuming m/s for consistency, conversion done in action if API gives km/h
  windDirection10m: { name: "Wind Direction (10m)", apiParam: "winddirection_10m", unit: "°", apiSource: 'weather', color: '--chart-3' },
  ghi: { name: "Global Horizontal Irradiance (GHI)", apiParam: "shortwave_radiation", unit: "W/m²", apiSource: 'weather', color: '--chart-4' },
};
