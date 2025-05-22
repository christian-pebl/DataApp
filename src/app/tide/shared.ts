
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

export const TideDataPointSchema = z.object({
  time: z.string().describe("ISO timestamp for the data point"),
  tideHeight: z.number().optional().describe("Tide height in meters relative to mean sea level"),
});
export type TideDataPoint = z.infer<typeof TideDataPointSchema>;

export const FetchTideInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, { message: "Invalid start date format or value. Ensure YYYY-MM-DD format." }),
  endDate: z.string().refine(isValidDateString, { message: "Invalid end date format or value. Ensure YYYY-MM-DD format." }),
});
export type FetchTideInput = z.infer<typeof FetchTideInputSchema>;
