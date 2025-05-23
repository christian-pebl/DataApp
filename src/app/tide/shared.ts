
// 'use server'; // This directive should NOT be here for a shared types/schemas file.

import { z } from 'zod';
import { parseISO } from 'date-fns';

// Helper function for robust date string validation
const isValidDateString = (val: string): boolean => {
  try {
    const date = parseISO(val);
    return !isNaN(date.valueOf()) && date.toISOString().startsWith(val.substring(0,10));
  } catch (e) {
    return false;
  }
};

export const MarineDataPointSchema = z.object({
  time: z.string().describe("ISO timestamp for the data point"),
  tideHeight: z.number().optional().describe("Tide height in meters"),
  // Wave parameters removed as we focus solely on EA tide data for this page
});
export type MarineDataPoint = z.infer<typeof MarineDataPointSchema>;

export const FetchMarineDataInputSchema = z.object({
  latitude: z.number().min(-90).max(90).optional().describe("Latitude of the location (used for context, not direct EA station ID query)"),
  longitude: z.number().min(-180).max(180).optional().describe("Longitude of the location (used for context, not direct EA station ID query)"),
  startDate: z.string().refine(isValidDateString, { message: "Invalid start date format or value. Ensure YYYY-MM-DD format." }),
  endDate: z.string().refine(isValidDateString, { message: "Invalid end date format or value. Ensure YYYY-MM-DD format." }),
  eaStationId: z.string().optional().describe("Optional Environment Agency station ID to try first"),
});
export type FetchMarineDataInput = z.infer<typeof FetchMarineDataInputSchema>;
