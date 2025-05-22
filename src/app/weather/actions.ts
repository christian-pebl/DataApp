
'use server';

import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import type { WeatherDataPoint, FetchWeatherInput } from './shared';
import { FetchWeatherInputSchema } from './shared';

// Function to fetch tide data from Open-Meteo Marine API
async function fetchTideDataFromOpenMeteo(startDate: string, endDate: string, latitude: number, longitude: number): Promise<{ stationName: string, data: { time: string; tideHeight: number }[] }> {
  const stationName = "Tide at selected location";
  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  const apiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=sea_level&timezone=auto`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Open-Meteo Marine API request failed: ${response.status}`, errorBody);
      throw new Error(`Tide API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();

    if (data.error) {
      console.error(`Open-Meteo Marine API Error: ${data.reason}`);
      throw new Error(`Open-Meteo Marine API Error: ${data.reason}`);
    }

    if (
      !data.hourly ||
      !Array.isArray(data.hourly.time) ||
      !Array.isArray(data.hourly.sea_level) ||
      data.hourly.time.length === 0
    ) {
      console.warn("Open-Meteo Marine API returned incomplete or empty hourly sea_level data for the location/period.");
      return { stationName, data: [] };
    }
    
    if (data.hourly.sea_level.length !== data.hourly.time.length) {
        console.warn("Open-Meteo Marine API returned mismatched array lengths for hourly data.");
        return { stationName, data: [] };
    }

    const times = data.hourly.time as string[];
    const seaLevels = data.hourly.sea_level as (number | null)[];

    const tideData: { time: string; tideHeight: number }[] = times.map((time, index) => ({
      time: time,
      tideHeight: seaLevels[index] !== null && seaLevels[index] !== undefined ? parseFloat(seaLevels[index]!.toFixed(2)) : undefined,
    })).filter(p => p.tideHeight !== undefined) as { time: string; tideHeight: number }[];

    return { stationName, data: tideData };

  } catch (error) {
    console.error("Error fetching or processing tide data from Open-Meteo Marine API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to fetch tide data from Open-Meteo: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching tide data from Open-Meteo.");
  }
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
): Promise<{ success: boolean; data?: WeatherDataPoint[]; error?: string; message?: string, tideStationName?: string }> {
  try {
    const validatedInput = FetchWeatherInputSchema.safeParse(input);
    if (!validatedInput.success) {
      const errorMessages = validatedInput.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    
    if (parseISO(validatedInput.data.startDate) > parseISO(validatedInput.data.endDate)) {
        return { success: false, error: "Start date cannot be after end date." };
    }

    const weatherDataPromise = fetchWeatherDataFromOpenMeteo(validatedInput.data);
    const tideDataPromise = fetchTideDataFromOpenMeteo(
      validatedInput.data.startDate,
      validatedInput.data.endDate,
      validatedInput.data.latitude,
      validatedInput.data.longitude
    );

    const [weatherData, { stationName: tideStationName, data: tideData }] = await Promise.all([
      weatherDataPromise,
      tideDataPromise
    ]);

    const combinedData: WeatherDataPoint[] = weatherData.map(wd => {
      const correspondingTidePoint = tideData.find(td => td.time === wd.time);
      return {
        ...wd,
        tideHeight: correspondingTidePoint?.tideHeight,
      };
    });
    
    if (weatherData.length === 0 && tideData.length === 0) { 
        return { success: true, data: [], message: "No historical weather or tide data found for the selected location and date range from Open-Meteo.", tideStationName };
    }
    if (combinedData.length === 0 && weatherData.length > 0 && tideData.length === 0) { // Weather data but no tide data
      return { success: true, data: weatherData, message: "Weather data found, but no tide data for this location/period. Displaying available weather data.", tideStationName };
    }
     if (combinedData.length === 0 && weatherData.length === 0 && tideData.length > 0) { // Tide data but no weather data
        // Create WeatherDataPoint entries from tideData if weatherData is empty
        const tideOnlyData: WeatherDataPoint[] = tideData.map(td => ({
            time: td.time,
            tideHeight: td.tideHeight,
            // Other weather fields will be undefined
        }));
      return { success: true, data: tideOnlyData, message: "Tide data found, but no weather data for this location/period. Displaying available tide data.", tideStationName };
    }


    return { success: true, data: combinedData, tideStationName };
  } catch (e) {
    console.error("Error in fetchWeatherDataAction:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching weather data.";
    return { success: false, error: errorMessage };
  }
}
