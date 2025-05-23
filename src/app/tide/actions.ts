
'use server';

import { z } from 'zod';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
import type { MarineDataPoint, FetchMarineDataInput } from './shared';
import { FetchMarineDataInputSchema } from './shared';

interface EAStationReading {
  '@id': string;
  dateTime: string;
  measure: string;
  value: number;
}

interface EAStationResponse {
  items: EAStationReading[];
}

// Fetches tide data from Environment Agency (DEFRA)
async function fetchTideDataFromEA(
  stationId: string,
  startDate: string,
  endDate: string
): Promise<{ data: MarineDataPoint[]; stationName?: string; error?: string } | null> {
  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  // EA API can be slow or restrictive for very long date ranges.
  // Let's limit to a reasonable period for this example, e.g., 30 days.
  if (differenceInDays(parseISO(endDate), parseISO(startDate)) > 30) {
    console.warn(`EA API request for station ${stationId} exceeds 30 day limit, returning null.`);
    return { data: [], error: "Date range too large for EA API (max 30 days). Try a shorter period." };
  }

  const eaApiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}/readings?_sorted&parameter=TidalLevel&startdate=${formattedStartDate}&enddate=${formattedEndDate}&_limit=2000`;
  // Added _limit to fetch more data points if available within the date range.

  try {
    console.log(`Fetching EA tide data for station ${stationId} from: ${eaApiUrl}`);
    const response = await fetch(eaApiUrl, { cache: 'no-store' });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`EA API request failed for station ${stationId} with status ${response.status}: ${errorBody}`);
      return { data: [], error: `EA API request failed (status ${response.status}).` };
    }

    const data: EAStationResponse = await response.json();

    if (!data.items || data.items.length === 0) {
      console.warn(`No EA tide data returned for station ${stationId} for the period.`);
      return { data: [], error: "No tide data found for this station/period from EA." };
    }

    const transformedData: MarineDataPoint[] = data.items
      .filter(item => item.dateTime && typeof item.value === 'number')
      .map(item => ({
        time: item.dateTime,
        tideHeight: item.value,
      }));
    
    // Attempt to get station name - this requires another call or a predefined mapping
    // For now, we'll just use the stationId or a generic name.
    // A more robust solution would fetch station details: `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}`
    // For simplicity, we'll imply the station name from the context or use a generic one.
    const stationDetailsResponse = await fetch(`https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}`);
    let stationName = `EA Station ${stationId}`;
    if (stationDetailsResponse.ok) {
        const stationDetails = await stationDetailsResponse.json();
        stationName = stationDetails?.items?.label || stationName;
    }

    return { data: transformedData, stationName };

  } catch (error) {
    console.error(`Error fetching or processing data from EA API for station ${stationId}:`, error);
    if (error instanceof Error) {
        return { data: [], error: `EA API Error: ${error.message}` };
    }
    return { data: [], error: "Unknown error fetching tide data from EA." };
  }
}


// Fetches sea level data from Open-Meteo Marine API
async function fetchMarineDataFromOpenMeteo(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<{ data: MarineDataPoint[]; error?: string }> {
  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  
  const hourlyVariables = "sea_level"; // Only sea_level for tide height
  const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${hourlyVariables}&timezone=auto`;

  try {
    console.log(`Fetching Open-Meteo sea level data from: ${marineApiUrl}`);
    const response = await fetch(marineApiUrl);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Open-Meteo Marine API request failed with status ${response.status}: ${errorBody}`);
      return { data: [], error: `Open-Meteo API request failed (status ${response.status}).`};
    }
    const data = await response.json();

    if (data.error) {
      console.error(`Open-Meteo Marine API Error: ${data.reason}`);
      return { data: [], error: `Open-Meteo API Error: ${data.reason}`};
    }

    if (!data.hourly || !Array.isArray(data.hourly.time) || data.hourly.time.length === 0) {
      console.warn("Open-Meteo Marine API returned incomplete or empty hourly time data.");
      return { data: [] }; // No error message here, just no data
    }
    
    const numTimestamps = data.hourly.time.length;
    if (!data.hourly.sea_level || !Array.isArray(data.hourly.sea_level) || data.hourly.sea_level.length !== numTimestamps) {
        console.warn(`Open-Meteo Marine API returned mismatched or missing array for sea_level.`);
        return { data: [] };
    }

    const times = data.hourly.time as string[];
    const seaLevels = data.hourly.sea_level as (number | null)[];

    const transformedData: MarineDataPoint[] = times.map((time, index) => ({
      time: time,
      tideHeight: seaLevels[index] === null || seaLevels[index] === undefined ? undefined : seaLevels[index],
    }));
    
    return { data: transformedData };

  } catch (error) {
    console.error("Error fetching or processing data from Open-Meteo Marine API:", error);
    if (error instanceof Error) {
      return { data: [], error: `Failed to fetch marine data from Open-Meteo: ${error.message}` };
    }
    return { data: [], error: "Unknown error fetching marine data from Open-Meteo." };
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
    
    const { latitude, longitude, startDate, endDate, eaStationId } = validatedInput.data;

    if (parseISO(startDate) > parseISO(endDate)) {
        return { success: false, error: "Start date cannot be after end date." };
    }

    let marineData: MarineDataPoint[] = [];
    let dataLocationContext: string = "Tide data at selected location";
    let sourceMessage: string | undefined;
    let fetchError: string | undefined;

    if (eaStationId) {
      console.log(`Attempting to fetch from EA for station: ${eaStationId}`);
      const eaResult = await fetchTideDataFromEA(eaStationId, startDate, endDate);
      if (eaResult && eaResult.data.length > 0 && !eaResult.error) {
        marineData = eaResult.data;
        dataLocationContext = `Tide from ${eaResult.stationName || `EA Station ${eaStationId}`}`;
        sourceMessage = `Data sourced from Environment Agency (${eaResult.stationName || eaStationId}).`;
      } else {
        sourceMessage = `Could not fetch data from Environment Agency for station ${eaStationId}${eaResult?.error ? ` (${eaResult.error})` : ''}. Falling back to Open-Meteo.`;
        console.warn(sourceMessage);
        // Fallback to Open-Meteo
        const omResult = await fetchMarineDataFromOpenMeteo(latitude, longitude, startDate, endDate);
        marineData = omResult.data;
        dataLocationContext = "Tide from Open-Meteo (fallback)";
        fetchError = omResult.error; // Capture Open-Meteo error if fallback also fails
      }
    } else {
      console.log(`Fetching from Open-Meteo for lat: ${latitude}, lon: ${longitude}`);
      const omResult = await fetchMarineDataFromOpenMeteo(latitude, longitude, startDate, endDate);
      marineData = omResult.data;
      dataLocationContext = "Tide from Open-Meteo";
      sourceMessage = "Data sourced from Open-Meteo.";
      fetchError = omResult.error;
    }
    
    if (fetchError) {
        return { success: false, error: fetchError, message: sourceMessage };
    }

    if (marineData.length === 0) { 
        return { success: true, data: [], dataLocationContext, message: sourceMessage || "No marine data found for the selected location and date range." };
    }

    return { success: true, data: marineData, dataLocationContext, message: sourceMessage };
  } catch (e) {
    console.error("Error in fetchMarineDataAction:", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching marine data.";
    return { success: false, error: errorMessage };
  }
}
