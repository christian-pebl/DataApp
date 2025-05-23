
'use server';

import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import type { MarineDataPoint, FetchMarineDataInput } from './shared';
import { FetchMarineDataInputSchema } from './shared';

async function fetchMarineDataFromOpenMeteo(input: FetchMarineDataInput): Promise<{ data: MarineDataPoint[]; dataLocationContext: string }> {
  const { latitude, longitude, startDate, endDate } = input;

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  
  const hourlyVariables = "sea_level,wave_height,wave_direction,wave_period";
  const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${hourlyVariables}&timezone=auto`;

  try {
    const response = await fetch(marineApiUrl);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Open-Meteo Marine API request failed with status ${response.status}: ${errorBody}`);
    }
    const data = await response.json();

    if (data.error) {
      throw new Error(`Open-Meteo Marine API Error: ${data.reason}`);
    }

    if (!data.hourly || !Array.isArray(data.hourly.time) || data.hourly.time.length === 0) {
      console.warn("Open-Meteo Marine API returned incomplete or empty hourly time data.");
      return { data: [], dataLocationContext: "Marine data for selected location" };
    }
    
    const numTimestamps = data.hourly.time.length;
    const requiredKeys = ['sea_level', 'wave_height', 'wave_direction', 'wave_period'];
    for (const key of requiredKeys) {
      if (!data.hourly[key] || !Array.isArray(data.hourly[key]) || data.hourly[key].length !== numTimestamps) {
        console.warn(`Open-Meteo Marine API returned mismatched or missing array for ${key}. Length: ${data.hourly[key]?.length}, Expected: ${numTimestamps}`);
        // Continue, but this series might be empty or partial
      }
    }

    const times = data.hourly.time as string[];
    const seaLevels = data.hourly.sea_level as (number | null)[] || [];
    const waveHeights = data.hourly.wave_height as (number | null)[] || [];
    const waveDirections = data.hourly.wave_direction as (number | null)[] || [];
    const wavePeriods = data.hourly.wave_period as (number | null)[] || [];

    const transformedData: MarineDataPoint[] = times.map((time, index) => ({
      time: time,
      tideHeight: seaLevels[index] === null || seaLevels[index] === undefined ? undefined : seaLevels[index],
      waveHeight: waveHeights[index] === null || waveHeights[index] === undefined ? undefined : waveHeights[index],
      waveDirection: waveDirections[index] === null || waveDirections[index] === undefined ? undefined : waveDirections[index],
      wavePeriod: wavePeriods[index] === null || wavePeriods[index] === undefined ? undefined : wavePeriods[index],
    }));
    
    return { data: transformedData, dataLocationContext: "Marine data at selected location" };

  } catch (error) {
    console.error("Error fetching or processing data from Open-Meteo Marine API:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch marine data from Open-Meteo: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching marine data from Open-Meteo.");
  }
}

export async function fetchMarineDataAction(
  input: FetchMarineDataInput
): Promise<{ success: boolean; data?: MarineDataPoint[]; dataLocationContext?: string; error?: string; message?: string }> {
  try {
    const validatedInput = FetchMarineDataInputSchema.safeParse(input);
    if (!validatedInput.success) {
      const errorMessages = validatedInput.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    
    if (parseISO(validatedInput.data.startDate) > parseISO(validatedInput.data.endDate)) {
        return { success: false, error: "Start date cannot be after end date." };
    }

    const { data: marineData, dataLocationContext } = await fetchMarineDataFromOpenMeteo(validatedInput.data);
    
    if (marineData.length === 0) { 
        return { success: true, data: [], dataLocationContext, message: "No marine data found for the selected location and date range from Open-Meteo." };
    }

    return { success: true, data: marineData, dataLocationContext };
  } catch (e) {
    console.error("Error in fetchMarineDataAction:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching marine data.";
    return { success: false, error: errorMessage };
  }
}
