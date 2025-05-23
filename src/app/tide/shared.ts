
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
  tideHeight: z.number().optional().describe("Tide height in meters relative to mean sea level"),
  waveHeight: z.number().optional().describe("Significant wave height in meters"),
  waveDirection: z.number().optional().describe("Mean wave direction in degrees"),
  wavePeriod: z.number().optional().describe("Mean wave period in seconds"),
});
export type MarineDataPoint = z.infer<typeof MarineDataPointSchema>;

export const FetchMarineDataInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, { message: "Invalid start date format or value. Ensure YYYY-MM-DD format." }),
  endDate: z.string().refine(isValidDateString, { message: "Invalid end date format or value. Ensure YYYY-MM-DD format." }),
});
export type FetchMarineDataInput = z.infer<typeof FetchMarineDataInputSchema>;
