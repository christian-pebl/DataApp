
'use server';

import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import type { WeatherDataPoint, FetchWeatherInput } from './shared'; // Import types
import { FetchWeatherInputSchema } from './shared'; // Import schema

async function fetchWeatherDataFromOpenMeteo(input: FetchWeatherInput): Promise<WeatherDataPoint[]> {
  const { latitude, longitude, startDate, endDate } = input;

  // Format dates for Open-Meteo API (YYYY-MM-DD)
  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  // Construct the API URL
  // We'll request temperature, wind speed, and cloud cover hourly.
  // Open-Meteo's windspeed_10m is in km/h. Temperature is in °C. Cloudcover in %.
  const hourlyVariables = "temperature_2m,windspeed_10m,cloudcover";
  const apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${hourlyVariables}&timezone=auto`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Open-Meteo API Error: ${data.reason}`);
    }

    if (!data.hourly || !data.hourly.time || !data.hourly.temperature_2m || !data.hourly.windspeed_10m || !data.hourly.cloudcover) {
      // This can happen if the date range is too far in the past or future for historical data, or no data exists.
      return []; 
    }
    
    const times = data.hourly.time as string[];
    const temperatures = data.hourly.temperature_2m as (number | null)[];
    const windSpeedsKmh = data.hourly.windspeed_10m as (number | null)[];
    const cloudCovers = data.hourly.cloudcover as (number | null)[];

    const transformedData: WeatherDataPoint[] = times.map((time, index) => {
      // Convert km/h to m/s for wind speed: 1 km/h = 5/18 m/s
      const windSpeedMs = windSpeedsKmh[index] !== null && windSpeedsKmh[index] !== undefined 
                          ? parseFloat((windSpeedsKmh[index]! * (5 / 18)).toFixed(1)) 
                          : undefined;
      
      return {
        time: time, // Open-Meteo provides ISO 8601 timestamps
        temperature: temperatures[index] ?? undefined,
        windSpeed: windSpeedMs,
        cloudCover: cloudCovers[index] ?? undefined,
      };
    });

    return transformedData;

  } catch (error) {
    console.error("Error fetching or processing data from Open-Meteo:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to fetch weather data from Open-Meteo: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching weather data from Open-Meteo.");
  }
}

// Server Action
export async function fetchWeatherDataAction(
  input: FetchWeatherInput
): Promise<{ success: boolean; data?: WeatherDataPoint[]; error?: string; message?: string }> {
  try {
    const validatedInput = FetchWeatherInputSchema.safeParse(input);
    if (!validatedInput.success) {
      const errorMessages = validatedInput.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    
    if (parseISO(validatedInput.data.startDate) > parseISO(validatedInput.data.endDate)) {
        return { success: false, error: "Start date cannot be after end date." };
    }

    const weatherData = await fetchWeatherDataFromOpenMeteo(validatedInput.data);
    
    if (weatherData.length === 0) {
        return { success: true, data: [], message: "No historical weather data found for the selected location and date range from Open-Meteo." };
    }
    return { success: true, data: weatherData };
  } catch (e) {
    console.error("Error in fetchWeatherDataAction:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching weather data.";
    return { success: false, error: errorMessage };
  }
}
