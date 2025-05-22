
'use server';

import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import type { TideDataPoint, FetchTideInput } from './shared';
import { FetchTideInputSchema } from './shared';

async function fetchTideDataFromOpenMeteo(input: FetchTideInput): Promise<{ data: TideDataPoint[]; dataLocationContext: string }> {
  const { latitude, longitude, startDate, endDate } = input;

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  
  const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=sea_level&timezone=auto`;

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

    if (!data.hourly || !Array.isArray(data.hourly.time) || !Array.isArray(data.hourly.sea_level) || data.hourly.time.length === 0) {
      console.warn("Open-Meteo Marine API returned incomplete or empty hourly data for sea_level.");
      return { data: [], dataLocationContext: "Tide data for selected location" };
    }
    
    if (data.hourly.time.length !== data.hourly.sea_level.length) {
        console.warn("Open-Meteo Marine API returned mismatched array lengths for hourly sea_level data.");
        return { data: [], dataLocationContext: "Tide data for selected location (length mismatch)" };
    }

    const times = data.hourly.time as string[];
    const seaLevels = data.hourly.sea_level as (number | null)[];

    const transformedData: TideDataPoint[] = times.map((time, index) => ({
      time: time,
      tideHeight: seaLevels[index] === null ? undefined : seaLevels[index],
    }));
    
    return { data: transformedData, dataLocationContext: "Tide at selected location" };

  } catch (error) {
    console.error("Error fetching or processing data from Open-Meteo Marine API:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to fetch tide data from Open-Meteo: ${error.message}`);
    }
    throw new Error("An unknown error occurred while fetching tide data from Open-Meteo.");
  }
}

export async function fetchTideDataAction(
  input: FetchTideInput
): Promise<{ success: boolean; data?: TideDataPoint[]; dataLocationContext?: string; error?: string; message?: string }> {
  try {
    const validatedInput = FetchTideInputSchema.safeParse(input);
    if (!validatedInput.success) {
      const errorMessages = validatedInput.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: `Invalid input: ${errorMessages}` };
    }
    
    if (parseISO(validatedInput.data.startDate) > parseISO(validatedInput.data.endDate)) {
        return { success: false, error: "Start date cannot be after end date." };
    }

    const { data: tideData, dataLocationContext } = await fetchTideDataFromOpenMeteo(validatedInput.data);
    
    if (tideData.length === 0) { 
        return { success: true, data: [], dataLocationContext, message: "No tide data found for the selected location and date range from Open-Meteo." };
    }

    return { success: true, data: tideData, dataLocationContext };
  } catch (e) {
    console.error("Error in fetchTideDataAction:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching tide data.";
    return { success: false, error: errorMessage };
  }
}
