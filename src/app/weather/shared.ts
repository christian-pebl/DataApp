
import { z } from 'zod';
import { parseISO } from 'date-fns';

// Helper function for robust date string validation
const isValidDateString = (val: string): boolean => {
  try {
    return !isNaN(parseISO(val).valueOf());
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
  startDate: z.string().refine(isValidDateString, { message: "Invalid start date format or value." }),
  endDate: z.string().refine(isValidDateString, { message: "Invalid end date format or value." }),
});
export type FetchWeatherInput = z.infer<typeof FetchWeatherInputSchema>;

// Define a type for the combined weather and tide data action response
export interface WeatherAndTideDataPoint extends WeatherDataPoint {
  tideStationName?: string; // To be passed along with the data if available
}
