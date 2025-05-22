
'use server';

import { z } from 'zod';
import { subDays, addHours, formatISO, parseISO } from 'date-fns';

// Define a schema for the weather data points
export const WeatherDataPointSchema = z.object({
  time: z.string().describe("ISO timestamp for the data point"),
  temperature: z.number().optional().describe("Temperature in Celsius"),
  windSpeed: z.number().optional().describe("Wind speed in m/s"),
  // windDirection: z.number().optional().describe("Wind direction in degrees"), // Add later if simple plotting is desired
  cloudCover: z.number().optional().describe("Cloud cover percentage"),
});
export type WeatherDataPoint = z.infer<typeof WeatherDataPointSchema>;

// Define input schema for the server action
export const FetchWeatherInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  startDate: z.string().refine((val) => !isNaN(parseISO(val).valueOf()), { message: "Invalid start date" }),
  endDate: z.string().refine((val) => !isNaN(parseISO(val).valueOf()), { message: "Invalid end date" }),
});
export type FetchWeatherInput = z.infer<typeof FetchWeatherInputSchema>;

// Mock function to simulate fetching data from a local API
async function fetchWeatherDataFromLocalAPI(input: FetchWeatherInput): Promise<WeatherDataPoint[]> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay

  const { startDate, endDate } = input;
  const data: WeatherDataPoint[] = [];
  let currentDate = parseISO(startDate);
  const finalDate = parseISO(endDate);

  if (currentDate > finalDate) {
    return [];
  }

  // Generate some dummy data (e.g., hourly for up to 7 days)
  let count = 0;
  const maxPoints = 24 * 7; 
  while (currentDate <= finalDate && count < maxPoints) {
    data.push({
      time: formatISO(currentDate),
      temperature: Number((10 + Math.random() * 15 + Math.sin(count / 12) * 5).toFixed(1)), // 10-25 C with some sinusodial variation
      windSpeed: Number((Math.random() * 10).toFixed(1)),
      cloudCover: Number((Math.random() * 80 + 10).toFixed(0)), // 10-90 %
    });
    currentDate = addHours(currentDate, 1); // Hourly data
    count++;
  }
  return data;
}

// Server Action
export async function fetchWeatherDataAction(
  input: FetchWeatherInput
): Promise<{ success: boolean; data?: WeatherDataPoint[]; error?: string; message?: string }> {
  try {
    const validatedInput = FetchWeatherInputSchema.safeParse(input);
    if (!validatedInput.success) {
      // Flatten Zod errors for a more readable message
      const errorMessages = validatedInput.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    
    if (parseISO(validatedInput.data.startDate) > parseISO(validatedInput.data.endDate)) {
        return { success: false, error: "Start date cannot be after end date." };
    }

    const weatherData = await fetchWeatherDataFromLocalAPI(validatedInput.data);
    if (weatherData.length === 0) {
        return { success: true, data: [], message: "No data found for the selected criteria, or date range too large (max 7 days of hourly data for demo)." };
    }
    return { success: true, data: weatherData };
  } catch (e) {
    console.error("Error fetching weather data:", e);
    return { success: false, error: e instanceof Error ? e.message : "An unknown error occurred while fetching weather data." };
  }
}
