
'use server';

import { z } from 'zod';
import { format, parseISO, addHours, differenceInHours } from 'date-fns';
import type { WeatherDataPoint, FetchWeatherInput, WeatherAndTideDataPoint } from './shared';
import { FetchWeatherInputSchema } from './shared';

// Mock function to simulate fetching tide data
async function fetchMockTideData(startDate: string, endDate: string, latitude: number, longitude: number): Promise<{ stationName: string, data: { time: string; tideHeight: number }[] }> {
  // Simulate fetching data for a station near Saint David's
  const stationName = "St. Justinian's"; 
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const totalHours = differenceInHours(end, start);
  const tideData: { time: string; tideHeight: number }[] = [];

  // Simple sinusoidal pattern for tides (2 high, 2 low per ~24 hours)
  const periodHours = 12.42; // Average tidal period
  const phaseOffset = latitude + longitude; // Just to make it slightly different per location

  for (let i = 0; i <= totalHours; i++) {
    const currentTime = addHours(start, i);
    // Simulate tide height between -1.5m and 1.5m relative to mean sea level
    const tideHeight = 1.5 * Math.sin(( (i + phaseOffset) / periodHours) * 2 * Math.PI);
    tideData.push({
      time: currentTime.toISOString(),
      tideHeight: parseFloat(tideHeight.toFixed(2)),
    });
  }
  return { stationName, data: tideData };
}


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
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Open-Meteo API Error: ${data.reason}`);
    }
    
    if (!data.hourly || !data.hourly.time || !data.hourly.temperature_2m || !data.hourly.windspeed_10m || !data.hourly.cloudcover || !data.hourly.winddirection_10m) {
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
        temperature: temperatures[index] ?? undefined,
        windSpeed: windSpeedMs,
        cloudCover: cloudCovers[index] ?? undefined,
        windDirection: windDirections[index] ?? undefined,
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
): Promise<{ success: boolean; data?: WeatherAndTideDataPoint[]; error?: string; message?: string, tideStationName?: string }> {
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
    const { stationName: tideStationName, data: tideData } = await fetchMockTideData(
      validatedInput.data.startDate,
      validatedInput.data.endDate,
      validatedInput.data.latitude,
      validatedInput.data.longitude
    );

    // Merge weather and tide data
    // This is a simple merge assuming timestamps align. A more robust merge might be needed for real APIs.
    const combinedData: WeatherAndTideDataPoint[] = weatherData.map(wd => {
      const correspondingTidePoint = tideData.find(td => td.time === wd.time);
      return {
        ...wd,
        tideHeight: correspondingTidePoint?.tideHeight,
      };
    });
    
    if (combinedData.length === 0 && weatherData.length === 0) { // Check if OpenMeteo returned data specifically
        return { success: true, data: [], message: "No historical weather data found for the selected location and date range from Open-Meteo.", tideStationName };
    }
    return { success: true, data: combinedData, tideStationName };
  } catch (e) {
    console.error("Error in fetchWeatherDataAction:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching weather data.";
    return { success: false, error: errorMessage };
  }
}
