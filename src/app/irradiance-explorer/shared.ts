
import type { LucideIcon } from 'lucide-react';
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';

// Define the structure for a single irradiance data point
export interface IrradianceDataPoint {
  time: string;
  ghi?: number;
  dhi?: number;
}

export const IrradianceDataPointSchema = z.object({
  time: z.string(),
  ghi: z.number().optional(),
  dhi: z.number().optional(),
});

// Input schema for fetching irradiance data
export const FetchIrradianceInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, {
    message: "Invalid start date format or value. Ensure YYYY-MM-DD format.",
  }),
  endDate: z.string().refine(isValidDateString, {
    message: "Invalid end date format or value. Ensure YYYY-MM-DD format.",
  }),
  parameters: z.array(z.string()).min(1, "At least one parameter must be selected"),
});
export type FetchIrradianceInput = z.infer<typeof FetchIrradianceInputSchema>;

// Log step interface (can be shared if it's identical across explorers)
export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
}

// Parameter keys for irradiance data
export type IrradianceParameterKey = 'ghi' | 'dhi';

export const ALL_IRRADIANCE_PARAMETERS: IrradianceParameterKey[] = [
  'ghi',
  'dhi',
];

// Configuration for each irradiance parameter
export const IRRADIANCE_PARAMETER_CONFIG: Record<IrradianceParameterKey, { name: string; apiParam: string; unit: string; apiSource: 'weather'; icon?: LucideIcon; color: string }> = {
  ghi: { name: "Global Horizontal Irradiance", apiParam: "ghi", unit: "W/m²", apiSource: 'weather', color: '--chart-1' },
  dhi: { name: "Diffuse Horizontal Irradiance", apiParam: "dhi", unit: "W/m²", apiSource: 'weather', color: '--chart-2' },
};
