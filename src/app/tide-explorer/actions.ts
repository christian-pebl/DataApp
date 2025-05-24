
'use server';

import type { FetchTideExplorerInput, TideExplorerDataPoint, LogStep } from './shared';
import { FetchTideExplorerInputSchema } from './shared';
import { format, parseISO } from 'date-fns';

interface OpenMeteoMarineHourlyResponse {
  time?: string[];
  sea_level_height?: (number | null)[]; // Corrected parameter based on documentation
}

interface OpenMeteoMarineApiResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  hourly_units?: {
    time?: string;
    sea_level_height?: string; // Corrected parameter
  };
  hourly?: OpenMeteoMarineHourlyResponse;
  error?: boolean;
  reason?: string;
}

export async function fetchTideExplorerDataAction(
  input: FetchTideExplorerInput
): Promise<{
  success: boolean;
  data?: TideExplorerDataPoint[];
  error?: string;
  log: LogStep[];
  dataLocationContext?: string;
}> {
  const log: LogStep[] = [];
  log.push({ message: 'Tide data fetch initiated.', status: 'info' });
  log.push({ message: `Input received: Lat: ${input.latitude}, Lon: ${input.longitude}, Start: ${input.startDate}, End: ${input.endDate}`, status: 'info' });

  const validationResult = FetchTideExplorerInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    log.push({ message: `Input validation failed: ${errorMessages}`, status: 'error' });
    return { success: false, error: `Invalid input: ${errorMessages}`, log };
  }
  log.push({ message: 'Input validation successful.', status: 'success' });

  const { latitude, longitude, startDate, endDate } = validationResult.data;

  if (parseISO(startDate) > parseISO(endDate)) {
    log.push({ message: "Start date cannot be after end date.", status: "error"});
    return { success: false, error: "Start date cannot be after end date.", log };
  }
  log.push({ message: `Date range validated: Start: ${startDate}, End: ${endDate}.`, status: 'success' });

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  log.push({ message: `Dates formatted for API: Start: ${formattedStartDate}, End: ${formattedEndDate}`, status: 'info' });
  
  const apiParametersString = "sea_level_height"; // Confirmed correct parameter as per documentation
  log.push({ message: `Requesting Open-Meteo Marine API hourly parameter: '${apiParametersString}'`, status: 'info' });
  log.push({ message: `Parameters for API: latitude=${latitude}, longitude=${longitude}, start_date=${formattedStartDate}, end_date=${formattedEndDate}, hourly=${apiParametersString}`, status: 'info'});

  const baseUrl = "https://marine-api.open-meteo.com/v1/marine"; // Explicit base URL
  const apiUrl = `${baseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${apiParametersString}`;
  log.push({ message: `Constructed API URL: ${apiUrl}`, status: 'info', details: apiUrl });

  log.push({ message: "Attempting to fetch data from Open-Meteo Marine API...", status: 'pending' });

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    // Get raw body early for logging in all cases
    const rawResponseBody = await response.text(); 

    log.push({ message: `API Response Status: ${response.status}`, status: response.ok ? 'success' : 'error' });
    log.push({ message: `Raw API Response Body (first 500 chars): ${rawResponseBody.substring(0,500)}`, status: response.ok ? 'info' : 'error', details: rawResponseBody });

    if (!response.ok) {
      let reason = `Status: ${response.status}.`;
      try {
        const errorJson = JSON.parse(rawResponseBody); 
        if (errorJson && errorJson.reason) {
          reason = errorJson.reason;
        } else {
            reason += ` Response: ${rawResponseBody.substring(0,200)}`; 
        }
      } catch (e) {
         reason += ` Non-JSON Response: ${rawResponseBody.substring(0,200)}`;
      }
      log.push({ message: `API Error: ${reason}`, status: 'error', details: rawResponseBody });
      return { success: false, error: `Failed to fetch tide data. ${reason}`, log };
    }

    let apiData: OpenMeteoMarineApiResponse;
    try {
      apiData = JSON.parse(rawResponseBody); 
      log.push({ message: "Successfully parsed API JSON response.", status: 'success' });
    } catch (jsonError) {
      const errorDetails = jsonError instanceof Error ? jsonError.message : String(jsonError);
      log.push({ message: `Failed to parse API JSON response: ${errorDetails}`, status: 'error', details: rawResponseBody });
      return { success: false, error: "Failed to parse API response.", log };
    }

    if (apiData.error) {
      log.push({ message: `Open-Meteo API reported an error: ${apiData.reason || 'Unknown error from API'}`, status: 'error', details: JSON.stringify(apiData) });
      return { success: false, error: `Open-Meteo API Error: ${apiData.reason || 'Unknown error'}`, log };
    }
    log.push({ message: "API response indicates no explicit error flag.", status: 'success' });

    if (!apiData.hourly) {
      log.push({ message: "API response missing 'hourly' data object.", status: 'error', details: JSON.stringify(apiData) });
      return { success: false, error: "Incomplete data from API: missing 'hourly' object.", log };
    }
    log.push({ message: "'hourly' object present in API response.", status: 'info' });

    if (!apiData.hourly.time || !Array.isArray(apiData.hourly.time)) {
      log.push({ message: "API response 'hourly.time' is missing or not an array.", status: 'error', details: JSON.stringify(apiData.hourly) });
      return { success: false, error: "Incomplete data from API: missing 'hourly.time' array.", log };
    }
    log.push({ message: `'hourly.time' array present with ${apiData.hourly.time.length} entries.`, status: 'info' });
    
    if (apiData.hourly.time.length === 0) {
        log.push({ message: "No hourly timestamps returned from Open-Meteo Marine API.", status: 'warning' });
        return { success: true, data: [], log, dataLocationContext: `No tide data found for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)`, error: "No tide data found for the selected location and date range at Open-Meteo." };
    }

    const seaLevelsKey: keyof OpenMeteoMarineHourlyResponse = 'sea_level_height';
    if (!apiData.hourly[seaLevelsKey] || !Array.isArray(apiData.hourly[seaLevelsKey])) {
      log.push({ message: `API response 'hourly.${seaLevelsKey}' is missing or not an array.`, status: 'error', details: JSON.stringify(apiData.hourly) });
      return { success: false, error: `Incomplete data from API: missing 'hourly.${seaLevelsKey}' array.`, log };
    }
    log.push({ message: `'hourly.${seaLevelsKey}' array present with ${apiData.hourly[seaLevelsKey]!.length} entries.`, status: 'info' });


    const times = apiData.hourly.time;
    const seaLevels = apiData.hourly[seaLevelsKey]!; // Assert not null as we checked above

    if (seaLevels.length !== times.length) {
      log.push({ message: `Sea level height data array length (${seaLevels.length}) does not match time array length (${times.length}).`, status: 'error', details: JSON.stringify(apiData.hourly) });
      return { success: false, error: "Inconsistent data from API: time and sea level data lengths differ.", log };
    }
    log.push({ message: "Time and sea level height data array lengths match.", status: 'success' });

    const tideData: TideExplorerDataPoint[] = [];
    for (let i = 0; i < times.length; i++) {
      const point: TideExplorerDataPoint = { time: times[i] };
      if (seaLevels[i] !== null && seaLevels[i] !== undefined) {
        point.seaLevel = seaLevels[i] as number;
      }
      // Only add if seaLevel has a valid value
      if (point.seaLevel !== undefined) {
          tideData.push(point);
      }
    }
    
    if (tideData.length === 0 && times.length > 0) {
        log.push({ message: "Timestamps were received, but no valid sea level height data points could be constructed (all values might be null or undefined).", status: 'warning' });
    } else if (tideData.length === 0) {
        log.push({ message: "No sea level height data points constructed.", status: 'info' });
    } else {
        log.push({ message: `Successfully processed ${tideData.length} sea level height data points.`, status: 'success' });
    }

    return { success: true, data: tideData, log, dataLocationContext: `Tide Data (Sea Level Height) for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)` };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during fetch.";
    log.push({ message: `Critical error during Open-Meteo fetch or processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    return { success: false, error: `Error fetching Open-Meteo tide data: ${errorMessage}`, log };
  }
}

    