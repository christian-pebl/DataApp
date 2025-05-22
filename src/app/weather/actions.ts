
'use server';

import { z } from 'zod';
import { subDays, addHours, formatISO, parseISO } from 'date-fns';
import type { WeatherDataPoint, FetchWeatherInput } from './shared'; // Import types
import { FetchWeatherInputSchema } from './shared'; // Import schema

// Mock function to simulate fetching data from a local API
async function fetchWeatherDataFromLocalAPI(input: FetchWeatherInput): Promise<WeatherDataPoint[]> {
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay

  const { startDate, endDate } = input;
  const data: WeatherDataPoint[] = [];
  let currentDate = parseISO(startDate); // Assume startDate is valid by this point due to schema validation
  const finalDate = parseISO(endDate);   // Assume endDate is valid by this point

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
    
    // Additional check, although refine should catch individual invalid dates.
    // This ensures that valid dates are also logically ordered.
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
    // Ensure a proper error message is returned
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching weather data.";
    // It's good practice to log the actual error object for server-side debugging
    // if (e instanceof Error) console.error(e.stack); 
    return { success: false, error: errorMessage };
  }
}
