
import { z } from 'zod';
import { parseISO } from 'date-fns';

// Helper function for robust date string validation
const isValidDateString = (val: string): boolean => {
  try {
    // Check if parsing results in a valid date and the original string is not just 'Invalid Date' or similar
    const date = parseISO(val);
    return !isNaN(date.valueOf()) && date.toISOString().startsWith(val.substring(0,10)); // Basic check if date part matches
  } catch (e) {
    return false;
  }
};

// Define a schema for the weather data points
export const WeatherDataPointSchema = z.object({
  time: z.string().describe("ISO timestamp for the data point"),
  temperature: z.number().optional().describe("Temperature in Celsius"),
  windSpeed: z.number().optional().describe("Wind speed in m/s"),
  cloudCover: z.number().optional().describe("Cloud cover percentage"),
  windDirection: z.number().optional().describe("Wind direction in degrees (0-360)"),
  tideHeight: z.number().optional().describe("Tide height in meters"),
});
export type WeatherDataPoint = z.infer<typeof WeatherDataPointSchema>;

// Define input schema for the server action
export const FetchWeatherInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, { message: "Invalid start date format or value. Ensure YYYY-MM-DD format." }),
  endDate: z.string().refine(isValidDateString, { message: "Invalid end date format or value. Ensure YYYY-MM-DD format." }),
});
export type FetchWeatherInput = z.infer<typeof FetchWeatherInputSchema>;

// This type was slightly redundant as tideStationName is part of the overall response, not each point.
// WeatherDataPoint already includes tideHeight.
// export interface WeatherAndTideDataPoint extends WeatherDataPoint {
//   tideStationName?: string; 
// }
// We will use WeatherDataPoint directly for the array of data.

