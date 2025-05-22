
'use server';

import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import type { WeatherDataPoint, FetchWeatherInput } from './shared';
import { FetchWeatherInputSchema } from './shared';

async function fetchWeatherDataFromOpenMeteo(input: FetchWeatherInput): Promise<WeatherDataPoint[]> {
  const { latitude, longitude, startDate, endDate } = input;

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  const hourlyVariables = "temperature_2m,windspeed_10m,cloudcover,winddirection_10m";
  const apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${hourlyVariables}&timezone=auto`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Weather API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Open-Meteo Weather API Error: ${data.reason}`);
    }
    
    if (
      !data.hourly ||
      !Array.isArray(data.hourly.time) ||
      !Array.isArray(data.hourly.temperature_2m) ||
      !Array.isArray(data.hourly.windspeed_10m) ||
      !Array.isArray(data.hourly.cloudcover) ||
      !Array.isArray(data.hourly.winddirection_10m) ||
      data.hourly.time.length === 0
    ) {
      console.warn("Open-Meteo Weather API returned incomplete or empty hourly data for some variables for the location/period.");
      return []; 
    }

    const numTimestamps = data.hourly.time.length;
    if (
        data.hourly.temperature_2m.length !== numTimestamps ||
        data.hourly.windspeed_10m.length !== numTimestamps ||
        data.hourly.cloudcover.length !== numTimestamps ||
        data.hourly.winddirection_10m.length !== numTimestamps
    ) {
        console.warn("Open-Meteo Weather API returned mismatched array lengths for hourly data.");
        return [];
    }
    
    const times = data.hourly.time as string[];
    const temperatures = data.hourly.temperature_2m as (number | null)[];
    const windSpeedsKmh = data.hourly.windspeed_10m as (number | null)[];
    const cloudCovers = data.hourly.cloudcover as (number | null)[];
    const windDirections = data.hourly.winddirection_10m as (number | null)[];

    const transformedData: WeatherDataPoint[] = times.map((time, index) => {
      const windSpeedMs = windSpeedsKmh[index] !== null && windSpeedsKmh[index] !== undefined 
                          ? parseFloat((windSpeedsKmh[index]! * (5 / 18)).toFixed(1)) 
                          : undefined;
      
      return {
        time: time,
        temperature: temperatures[index] === null ? undefined : temperatures[index],
        windSpeed: windSpeedMs,
        cloudCover: cloudCovers[index] === null ? undefined : cloudCovers[index],
        windDirection: windDirections[index] === null ? undefined : windDirections[index],
      };
    });

    return transformedData;

  } catch (error) {
    console.error("Error fetching or processing data from Open-Meteo Weather API:", error);
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
