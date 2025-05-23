
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';

export const FetchTideExplorerInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, {
    message: "Invalid start date format or value. Ensure YYYY-MM-DD format.",
  }),
  endDate: z.string().refine(isValidDateString, {
    message: "Invalid end date format or value. Ensure YYYY-MM-DD format.",
  }),
});
export type FetchTideExplorerInput = z.infer<typeof FetchTideExplorerInputSchema>;

export const TideExplorerDataPointSchema = z.object({
  time: z.string(),
  seaLevel: z.number().optional(),
});
export type TideExplorerDataPoint = z.infer<typeof TideExplorerDataPointSchema>;

// Shared LogStep interface for consistency
export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
}
