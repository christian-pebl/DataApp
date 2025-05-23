
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';

export interface MarineDataPoint {
  time: string;
  seaLevel?: number;
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
}

export const FetchMarineDataInputSchema = z.object({
  latitude: z.number().min(-90, "Latitude must be >= -90").max(90, "Latitude must be <= 90"),
  longitude: z.number().min(-180, "Longitude must be >= -180").max(180, "Longitude must be <= 180"),
  startDate: z.string().refine(isValidDateString, {
    message: "Invalid start date format or value. Ensure YYYY-MM-DD format.",
  }),
  endDate: z.string().refine(isValidDateString, {
    message: "Invalid end date format or value. Ensure YYYY-MM-DD format.",
  }),
});
export type FetchMarineDataInput = z.infer<typeof FetchMarineDataInputSchema>;

// Shared LogStep interface for consistency
export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
}

// Used by the page to manage visibility of plots
export type MarinePlotVisibilityKeys = 'seaLevel' | 'waveHeight' | 'waveDirection' | 'wavePeriod';
