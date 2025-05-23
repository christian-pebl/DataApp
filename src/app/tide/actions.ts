
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

const FALLBACK_EA_STATION_ID = "0001"; // Newlyn as a general fallback
const FALLBACK_EA_STATION_NAME = "Newlyn";

// Fetches tide data from Environment Agency (EA)
async function fetchTideDataFromEA(
  stationId: string,
  startDate: string,
  endDate: string,
  log: LogEntry[]
): Promise<{ data: MarineDataPoint[]; stationName?: string; error?: string; success: boolean }> {
  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  log.push({ message: `Attempting to fetch from Environment Agency for station ID: ${stationId}.`, status: 'info' });
  log.push({ message: `Date range: ${formattedStartDate} to ${formattedEndDate}.`, status: 'info'});

  // EA API might have a limit on the number of days, e.g., 30 days.
  if (differenceInDays(parseISO(endDate), parseISO(startDate)) > 30) {
    const errorMsg = "Date range too large for EA API (max 30 days). Try a shorter period.";
    log.push({ message: `EA API request for station ${stationId} exceeds 30 day limit. ${errorMsg}`, status: 'error' });
    return { data: [], error: errorMsg, success: false };
  }

  const eaApiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}/readings?_sorted&parameter=TidalLevel&startdate=${formattedStartDate}&enddate=${formattedEndDate}&_limit=2000`;
  log.push({ message: `Constructed EA API URL: ${eaApiUrl}`, status: 'info' });

  try {
    const response = await fetch(eaApiUrl, { cache: 'no-store' });
    log.push({ message: `EA API response status for station ${stationId}: ${response.status} ${response.statusText}`, status: response.ok ? 'info' : 'error' });

    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `EA API request failed for station ${stationId} (status ${response.status}). Details: ${errorBody.substring(0, 100)}${errorBody.length > 100 ? '...' : ''}`;
      log.push({ message: errorMsg, status: 'error' });
      return { data: [], error: errorMsg, success: false };
    }

    const data: EAStationResponse = await response.json();
    

    if (!data.items || data.items.length === 0) {
      const noDataMsg = `No tide data items returned from EA for station ${stationId} for the period.`;
      log.push({ message: noDataMsg, status: 'info' });
      // For fallback logic, we consider no data as a type of "failure" for the current station
      return { data: [], error: noDataMsg, success: false, stationName: `EA Station ${stationId}` }; 
    }
    
    log.push({ message: `Successfully fetched ${data.items.length} readings from EA API for station ${stationId}.`, status: 'success' });
    log.push({ message: `Transforming data for station ${stationId}...`, status: 'info' });
    const transformedData: MarineDataPoint[] = data.items
      .filter(item => item.dateTime && typeof item.value === 'number')
      .map(item => ({
        time: item.dateTime,
        tideHeight: item.value,
      }));
    
    let stationName = `EA Station ${stationId}`; // Default name
    try {
      log.push({ message: `Attempting to fetch EA station details for ID: ${stationId}...`, status: 'info' });
      const stationDetailsResponse = await fetch(`https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}`);
      if (stationDetailsResponse.ok) {
          const stationDetails = await stationDetailsResponse.json();
          // The actual name might be in stationDetails.items.label or similar
          stationName = stationDetails?.items?.label || stationName;
          log.push({ message: `Fetched EA station name: ${stationName}`, status: 'success' });
      } else {
          log.push({ message: `Could not fetch EA station details for ${stationId}, using default name. Status: ${stationDetailsResponse.status}`, status: 'info' });
      }
    } catch (detailsError) {
        log.push({ message: `Error fetching EA station details for ${stationId}: ${(detailsError as Error).message}`, status: 'error' });
    }
    log.push({ message: `EA data transformation complete for station ${stationId}. ${transformedData.length} points.`, status: 'success' });
    return { data: transformedData, stationName, success: true };

  } catch (error) {
    const errorMsg = `Error fetching or processing data from EA API for station ${stationId}: ${(error as Error).message}`;
    log.push({ message: errorMsg, status: 'error' });
    return { data: [], error: `EA API Error for ${stationId}: ${(error as Error).message}`, success: false };
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
    
    const { startDate, endDate, eaStationId } = validatedInput.data;

    if (parseISO(startDate) > parseISO(endDate)) {
        const errorMsg = "Start date cannot be after end date.";
        log.push({ message: errorMsg, status: 'error' });
        return { success: false, error: errorMsg, log };
    }

    let marineData: MarineDataPoint[] = [];
    let dataLocationContext: string = "Tide data";
    let sourceMessage: string | undefined;
    let fetchError: string | undefined;

    if (!eaStationId) {
      const noIdMsg = "No EA Station ID provided. Please select a predefined location with an EA Station ID.";
      log.push({ message: noIdMsg, status: 'error' });
      return { success: false, error: noIdMsg, log, message: noIdMsg };
    }

    log.push({ message: `Primary attempt for EA Station ID: ${eaStationId}.`, status: 'info' });
    let result = await fetchTideDataFromEA(eaStationId, startDate, endDate, log);

    if (result.success && result.data.length > 0) {
      marineData = result.data;
      dataLocationContext = `Tide from ${result.stationName || `EA Station ${eaStationId}`}`;
      sourceMessage = `Data successfully fetched from Environment Agency (${result.stationName || eaStationId}).`;
      log.push({ message: `Successfully fetched data from primary EA station ${eaStationId}: ${result.data.length} points.`, status: 'success' });
    } else {
      // Primary attempt failed or returned no data, try fallback
      const primaryFailReason = result.error ? result.error : "No data returned from primary EA station.";
      log.push({ message: `Primary EA station ${eaStationId} attempt failed or yielded no data: ${primaryFailReason}. Attempting fallback to EA Station ${FALLBACK_EA_STATION_ID} (${FALLBACK_EA_STATION_NAME}).`, status: 'info' });
      
      // Fetch station name for fallback station to use in messages.
      let actualFallbackStationName = FALLBACK_EA_STATION_NAME;
       try {
        const fallbackStationDetailsResponse = await fetch(`https://environment.data.gov.uk/flood-monitoring/id/stations/${FALLBACK_EA_STATION_ID}`);
        if (fallbackStationDetailsResponse.ok) {
            const stationDetails = await fallbackStationDetailsResponse.json();
            actualFallbackStationName = stationDetails?.items?.label || FALLBACK_EA_STATION_NAME;
        }
      } catch {}


      result = await fetchTideDataFromEA(FALLBACK_EA_STATION_ID, startDate, endDate, log);
      if (result.success && result.data.length > 0) {
        marineData = result.data;
        const fallbackContextName = result.stationName || actualFallbackStationName;
        dataLocationContext = `Tide from ${fallbackContextName}`;
        sourceMessage = `Primary EA station failed. Data fetched from fallback Environment Agency station (${fallbackContextName}).`;
        log.push({ message: `Successfully fetched data from fallback EA station ${FALLBACK_EA_STATION_ID}: ${result.data.length} points.`, status: 'success' });
      } else {
        fetchError = result.error || `No data found for primary station ${eaStationId} or fallback station ${FALLBACK_EA_STATION_ID} (${actualFallbackStationName}).`;
        log.push({ message: `Fallback EA station ${FALLBACK_EA_STATION_ID} also failed or yielded no data. Error: ${fetchError}`, status: 'error' });
        sourceMessage = `Could not fetch data from selected EA station (${eaStationId}) or fallback station (${actualFallbackStationName}). ${fetchError}`;
      }
    }
    
    if (fetchError) {
        log.push({ message: `Final fetch error: ${fetchError}.`, status: 'error' });
        return { success: false, error: fetchError, message: sourceMessage, log };
    }

    if (marineData.length === 0) { 
        const noDataMsg = sourceMessage || "No marine data found for the selected EA station(s) and date range.";
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
