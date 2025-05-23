
// This file was previously /src/app/ea-explorer/shared.ts
// It now specifically holds types and schemas for Open-Meteo Marine data.
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils'; // Assuming this utility exists

export interface MarineDataPoint {
  time: string;
  seaLevel?: number;
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
}

export const FetchMarineDataInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, {
    message: "Invalid start date format or value. Ensure YYYY-MM-DD format.",
  }),
  endDate: z.string().refine(isValidDateString, {
    message: "Invalid end date format or value. Ensure YYYY-MM-DD format.",
  }),
});
export type FetchMarineDataInput = z.infer<typeof FetchMarineDataInputSchema>;

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  details?: string;
}
