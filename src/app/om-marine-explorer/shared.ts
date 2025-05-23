
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';

export interface MarineDataPoint {
  time: string; // ISO timestamp
  seaLevel?: number;
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
}
export const MarineDataPointSchema = z.object({
  time: z.string(),
  seaLevel: z.number().optional(),
  waveHeight: z.number().optional(),
  waveDirection: z.number().optional(),
  wavePeriod: z.number().optional(),
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

// Shared LogStep interface for consistency
export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
  isLastAttempt?: boolean; // For retry logic if implemented
}

// Used by the page to manage visibility of plots and parameter selection
export type MarineParameterKey = 'seaLevel' | 'waveHeight' | 'waveDirection' | 'wavePeriod';

export const ALL_MARINE_PARAMETERS: MarineParameterKey[] = ['seaLevel', 'waveHeight', 'waveDirection', 'wavePeriod'];

export const MARINE_PARAMETER_CONFIG: Record<MarineParameterKey, { name: string; apiParam: string; unit: string; icon?: React.ElementType }> = {
  seaLevel: { name: "Sea Level (Tide)", apiParam: "sea_level", unit: "m" },
  waveHeight: { name: "Wave Height", apiParam: "wave_height", unit: "m" },
  waveDirection: { name: "Wave Direction", apiParam: "wave_direction", unit: "°" },
  wavePeriod: { name: "Wave Period", apiParam: "wave_period", unit: "s" },
};
