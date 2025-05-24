
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface MarineDataPoint {
  time: string; // ISO timestamp
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
  seaSurfaceTemperature?: number;
  seaLevelHeightMsl?: number; // Added for sea level/tide
}
export const MarineDataPointSchema = z.object({
  time: z.string(),
  waveHeight: z.number().optional(),
  waveDirection: z.number().optional(),
  wavePeriod: z.number().optional(),
  seaSurfaceTemperature: z.number().optional(),
  seaLevelHeightMsl: z.number().optional(), // Added
});


export const FetchMarineDataInputSchema = z.object({
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
export type FetchMarineDataInput = z.infer<typeof FetchMarineDataInputSchema>;

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
  isLastAttempt?: boolean;
}

export type MarineParameterKey = 
  | 'waveHeight' 
  | 'waveDirection' 
  | 'wavePeriod'
  | 'seaSurfaceTemperature'
  | 'seaLevelHeightMsl'; // Added

export const ALL_MARINE_PARAMETERS: MarineParameterKey[] = [
  'waveHeight', 
  'waveDirection', 
  'wavePeriod',
  'seaSurfaceTemperature',
  'seaLevelHeightMsl', // Added
];

export const MARINE_PARAMETER_CONFIG: Record<MarineParameterKey, { name: string; apiParam: string; unit: string; icon?: LucideIcon }> = {
  waveHeight: { name: "Wave Height", apiParam: "wave_height", unit: "m" },
  waveDirection: { name: "Wave Direction", apiParam: "wave_direction", unit: "°" },
  wavePeriod: { name: "Wave Period", apiParam: "wave_period", unit: "s" },
  seaSurfaceTemperature: { name: "Sea Surface Temp", apiParam: "sea_surface_temperature", unit: "°C"},
  seaLevelHeightMsl: { name: "Sea Level (MSL)", apiParam: "sea_level_height_msl", unit: "m" }, // Added
};
