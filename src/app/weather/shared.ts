
import { z } from 'zod';
import { parseISO } from 'date-fns';

// Helper function for robust date string validation (can be kept here or in a utils file if used more broadly)
const isValidDateString = (val: string): boolean => {
  try {
    // Check if parseISO results in a valid date and valueOf returns a number
    return !isNaN(parseISO(val).valueOf());
  } catch (e) {
    // If parseISO throws (e.g., for a completely malformed string), it's not valid
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
});
export type WeatherDataPoint = z.infer<typeof WeatherDataPointSchema>;

// Define input schema for the server action
export const FetchWeatherInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine(isValidDateString, { message: "Invalid start date format or value." }),
  endDate: z.string().refine(isValidDateString, { message: "Invalid end date format or value." }),
});
export type FetchWeatherInput = z.infer<typeof FetchWeatherInputSchema>;

