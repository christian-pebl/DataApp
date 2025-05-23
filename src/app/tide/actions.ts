
'use server';

import { z } from 'zod';
import { format, parseISO, differenceInDays } from 'date-fns';
import type { MarineDataPoint, FetchMarineDataInput } from './shared';
import { FetchMarineDataInputSchema } from './shared';

interface LogEntry {
  message: string;
  status: 'info' | 'success' | 'error';
}

interface EAStationReading {
  '@id': string;
  dateTime: string;
  measure: string;
  value: number;
}

interface EAStationResponse {
  items: EAStationReading[];
}

// Fetches tide data from Environment Agency (EA)
async function fetchTideDataFromEA(
  stationId: string,
  startDate: string,
  endDate: string,
  log: LogEntry[]
): Promise<{ data: MarineDataPoint[]; stationName?: string; error?: string } | null> {
  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  log.push({ message: `Attempting to fetch from Environment Agency for station ID: ${stationId}.`, status: 'info' });
  log.push({ message: `Date range: ${formattedStartDate} to ${formattedEndDate}.`, status: 'info'});

  if (differenceInDays(parseISO(endDate), parseISO(startDate)) > 30) {
    const errorMsg = "Date range too large for EA API (max 30 days). Try a shorter period.";
    log.push({ message: `EA API request for station ${stationId} exceeds 30 day limit. ${errorMsg}`, status: 'error' });
    return { data: [], error: errorMsg };
  }

  const eaApiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}/readings?_sorted&parameter=TidalLevel&startdate=${formattedStartDate}&enddate=${formattedEndDate}&_limit=2000`;
  log.push({ message: `Constructed EA API URL: ${eaApiUrl}`, status: 'info' });

  try {
    const response = await fetch(eaApiUrl, { cache: 'no-store' });
    log.push({ message: `EA API response status: ${response.status} ${response.statusText}`, status: response.ok ? 'info' : 'error' });

    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `EA API request failed (status ${response.status}). Details: ${errorBody.substring(0, 100)}${errorBody.length > 100 ? '...' : ''}`;
      log.push({ message: errorMsg, status: 'error' });
      return { data: [], error: errorMsg };
    }

    const data: EAStationResponse = await response.json();
    log.push({ message: `Successfully fetched data from EA API.`, status: 'success' });

    if (!data.items || data.items.length === 0) {
      log.push({ message: `No tide data items returned from EA for station ${stationId} for the period.`, status: 'info' });
      return { data: [], error: "No tide data found for this station/period from EA." };
    }

    log.push({ message: `Found ${data.items.length} readings from EA. Transforming data...`, status: 'info' });
    const transformedData: MarineDataPoint[] = data.items
      .filter(item => item.dateTime && typeof item.value === 'number')
      .map(item => ({
        time: item.dateTime,
        tideHeight: item.value,
      }));
    
    let stationName = `EA Station ${stationId}`;
    try {
      const stationDetailsResponse = await fetch(`https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}`);
      if (stationDetailsResponse.ok) {
          const stationDetails = await stationDetailsResponse.json();
          stationName = stationDetails?.items?.label || stationName;
          log.push({ message: `Fetched EA station name: ${stationName}`, status: 'info' });
      } else {
          log.push({ message: `Could not fetch EA station details, using default name. Status: ${stationDetailsResponse.status}`, status: 'info' });
      }
    } catch (detailsError) {
        log.push({ message: `Error fetching EA station details: ${(detailsError as Error).message}`, status: 'error' });
    }
    log.push({ message: `EA data transformation complete. ${transformedData.length} points.`, status: 'success' });
    return { data: transformedData, stationName };

  } catch (error) {
    const errorMsg = `Error fetching or processing data from EA API for station ${stationId}: ${(error as Error).message}`;
    log.push({ message: errorMsg, status: 'error' });
    return { data: [], error: `EA API Error: ${(error as Error).message}` };
  }
}


// Fetches sea level data from Open-Meteo Marine API
async function fetchMarineDataFromOpenMeteo(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string,
  log: LogEntry[]
): Promise<{ data: MarineDataPoint[]; error?: string }> {
  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  
  log.push({ message: `Attempting to fetch from Open-Meteo Marine API.`, status: 'info' });
  log.push({ message: `Coords: Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}. Date range: ${formattedStartDate} to ${formattedEndDate}.`, status: 'info'});
  
  const hourlyVariables = "sea_level";
  const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${hourlyVariables}&timezone=auto`;
  log.push({ message: `Constructed Open-Meteo API URL: ${marineApiUrl}`, status: 'info' });

  try {
    const response = await fetch(marineApiUrl);
    log.push({ message: `Open-Meteo API response status: ${response.status} ${response.statusText}`, status: response.ok ? 'info' : 'error' });

    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `Open-Meteo Marine API request failed (status ${response.status}). Details: ${errorBody.substring(0,100)}${errorBody.length > 100 ? '...' : ''}`;
      log.push({ message: errorMsg, status: 'error' });
      return { data: [], error: errorMsg };
    }
    const data = await response.json();
    log.push({ message: `Successfully fetched data from Open-Meteo API.`, status: 'success' });


    if (data.error) {
      const errorMsg = `Open-Meteo Marine API Error: ${data.reason}`;
      log.push({ message: errorMsg, status: 'error' });
      return { data: [], error: errorMsg};
    }

    if (!data.hourly || !Array.isArray(data.hourly.time) || data.hourly.time.length === 0) {
      log.push({ message: "Open-Meteo Marine API returned incomplete or empty hourly time data.", status: 'info' });
      return { data: [] };
    }
    
    const numTimestamps = data.hourly.time.length;
    if (!data.hourly.sea_level || !Array.isArray(data.hourly.sea_level) || data.hourly.sea_level.length !== numTimestamps) {
        log.push({ message: `Open-Meteo Marine API returned mismatched or missing array for sea_level. Time points: ${numTimestamps}, Sea level points: ${data.hourly.sea_level?.length || 0}.`, status: 'error' });
        return { data: [], error: "Mismatched data arrays from Open-Meteo." };
    }

    log.push({ message: `Found ${numTimestamps} readings from Open-Meteo. Transforming data...`, status: 'info' });
    const times = data.hourly.time as string[];
    const seaLevels = data.hourly.sea_level as (number | null)[];

    const transformedData: MarineDataPoint[] = times.map((time, index) => ({
      time: time,
      tideHeight: seaLevels[index] === null || seaLevels[index] === undefined ? undefined : seaLevels[index],
    }));
    
    log.push({ message: `Open-Meteo data transformation complete. ${transformedData.length} points.`, status: 'success' });
    return { data: transformedData };

  } catch (error) {
    const errorMsg = `Error fetching or processing data from Open-Meteo Marine API: ${(error as Error).message}`;
    log.push({ message: errorMsg, status: 'error' });
    return { data: [], error: errorMsg };
  }
}

export async function fetchMarineDataAction(
  input: FetchMarineDataInput
): Promise<{ 
  success: boolean; 
  data?: MarineDataPoint[]; 
  dataLocationContext?: string; 
  error?: string; 
  message?: string;
  log?: LogEntry[]; 
}> {
  const log: LogEntry[] = [];
  try {
    log.push({ message: `Validating input: ${JSON.stringify(input)}`, status: 'info' });
    const validatedInput = FetchMarineDataInputSchema.safeParse(input);
    if (!validatedInput.success) {
      const errorMessages = validatedInput.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      const errorMsg = `Invalid input: ${errorMessages}`;
      log.push({ message: errorMsg, status: 'error' });
      return { success: false, error: errorMsg, log };
    }
    log.push({ message: "Input validation successful.", status: 'success' });
    
    const { latitude, longitude, startDate, endDate, eaStationId } = validatedInput.data;

    if (parseISO(startDate) > parseISO(endDate)) {
        const errorMsg = "Start date cannot be after end date.";
        log.push({ message: errorMsg, status: 'error' });
        return { success: false, error: errorMsg, log };
    }

    let marineData: MarineDataPoint[] = [];
    let dataLocationContext: string = "Tide data at selected location";
    let sourceMessage: string | undefined;
    let fetchError: string | undefined;

    if (eaStationId) {
      log.push({ message: `EA Station ID provided: ${eaStationId}. Attempting to fetch from EA first.`, status: 'info' });
      const eaResult = await fetchTideDataFromEA(eaStationId, startDate, endDate, log);
      if (eaResult && eaResult.data.length > 0 && !eaResult.error) {
        marineData = eaResult.data;
        dataLocationContext = `Tide from ${eaResult.stationName || `EA Station ${eaStationId}`}`;
        sourceMessage = `Data sourced from Environment Agency (${eaResult.stationName || eaStationId}).`;
        log.push({ message: `Successfully fetched data from EA: ${eaResult.data.length} points. Station: ${eaResult.stationName || eaStationId}`, status: 'success' });
      } else {
        const fallbackReason = eaResult?.error ? ` (${eaResult.error})` : (eaResult?.data.length === 0 ? ' (No data returned)' : ' (Unknown EA issue)');
        sourceMessage = `Could not fetch data from Environment Agency for station ${eaStationId}${fallbackReason}. Falling back to Open-Meteo.`;
        log.push({ message: sourceMessage, status: 'info' });
        const omResult = await fetchMarineDataFromOpenMeteo(latitude, longitude, startDate, endDate, log);
        marineData = omResult.data;
        dataLocationContext = "Tide from Open-Meteo (fallback)";
        fetchError = omResult.error;
        if (!fetchError && marineData.length > 0) {
            log.push({ message: `Successfully fetched data from Open-Meteo (fallback): ${marineData.length} points.`, status: 'success' });
        } else if (fetchError) {
            log.push({ message: `Open-Meteo (fallback) fetch failed. Error: ${fetchError}`, status: 'error' });
        } else {
            log.push({ message: `Open-Meteo (fallback) fetch succeeded but returned no data.`, status: 'info' });
        }
      }
    } else {
      log.push({ message: `No EA Station ID. Fetching from Open-Meteo for lat: ${latitude}, lon: ${longitude}`, status: 'info' });
      const omResult = await fetchMarineDataFromOpenMeteo(latitude, longitude, startDate, endDate, log);
      marineData = omResult.data;
      dataLocationContext = "Tide from Open-Meteo";
      sourceMessage = "Data sourced from Open-Meteo.";
      fetchError = omResult.error;
      if (!fetchError && marineData.length > 0) {
        log.push({ message: `Successfully fetched data from Open-Meteo: ${marineData.length} points.`, status: 'success' });
      } else if (fetchError) {
        log.push({ message: `Open-Meteo fetch failed. Error: ${fetchError}`, status: 'error' });
      } else {
        log.push({ message: `Open-Meteo fetch succeeded but returned no data.`, status: 'info' });
      }
    }
    
    if (fetchError) {
        log.push({ message: `Final fetch error: ${fetchError}.`, status: 'error' });
        return { success: false, error: fetchError, message: sourceMessage, log };
    }

    if (marineData.length === 0) { 
        const noDataMsg = sourceMessage || "No marine data found for the selected location and date range.";
        log.push({ message: noDataMsg, status: 'info' });
        return { success: true, data: [], dataLocationContext, message: noDataMsg, log };
    }
    log.push({ message: `Data fetch process complete. Returning ${marineData.length} data points.`, status: 'success' });
    return { success: true, data: marineData, dataLocationContext, message: sourceMessage, log };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred while fetching marine data.";
    log.push({ message: `Unhandled error in fetchMarineDataAction: ${errorMessage}`, status: 'error' });
    return { success: false, error: errorMessage, log };
  }
}

    