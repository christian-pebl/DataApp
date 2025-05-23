
'use server';

import type { MarineDataPoint, FetchMarineDataInput, LogStep, MarineParameterKey } from './shared';
import { FetchMarineDataInputSchema, MARINE_PARAMETER_CONFIG } from './shared';
import { format, parseISO } from 'date-fns';

interface OpenMeteoMarineHourlyResponse {
  time: string[];
  sea_level?: (number | null)[];
  wave_height?: (number | null)[];
  wave_direction?: (number | null)[];
  wave_period?: (number | null)[];
  sea_surface_temperature?: (number | null)[];
  wind_speed_10m?: (number | null)[];
}

interface OpenMeteoMarineApiResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  hourly_units?: Record<string, string>;
  hourly?: OpenMeteoMarineHourlyResponse;
  error?: boolean;
  reason?: string;
}

export async function fetchOpenMeteoMarineDataAction(
  input: FetchMarineDataInput
): Promise<{
  success: boolean;
  data?: MarineDataPoint[];
  error?: string;
  log: LogStep[];
  dataLocationContext?: string;
}> {
  const log: LogStep[] = [];
  log.push({ message: 'Marine data fetch initiated.', status: 'info' });
  log.push({ message: `Input received: Lat: ${input.latitude}, Lon: ${input.longitude}, Start: ${input.startDate}, End: ${input.endDate}, Params: ${input.parameters.join(', ')}`, status: 'info' });

  const validationResult = FetchMarineDataInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    log.push({ message: `Input validation failed: ${errorMessages}`, status: 'error' });
    return { success: false, error: `Invalid input: ${errorMessages}`, log };
  }
  log.push({ message: 'Input validation successful.', status: 'success' });

  const { latitude, longitude, startDate, endDate, parameters: selectedParamKeys } = validationResult.data;

  if (parseISO(startDate) > parseISO(endDate)) {
    log.push({ message: "Start date cannot be after end date.", status: "error"});
    return { success: false, error: "Start date cannot be after end date.", log };
  }
  log.push({ message: `Date range validated: ${startDate} to ${endDate}.`, status: 'success' });

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  log.push({ message: `Dates formatted for API: Start: ${formattedStartDate}, End: ${formattedEndDate}`, status: 'info' });
  
  const apiParametersString = selectedParamKeys
    .map(key => MARINE_PARAMETER_CONFIG[key as MarineParameterKey]?.apiParam)
    .filter(Boolean)
    .join(',');

  if (!apiParametersString) {
    log.push({ message: "No valid API parameters derived from selection.", status: 'error' });
    return { success: false, error: "No valid marine parameters selected for API request.", log };
  }
  log.push({ message: `Requesting API hourly parameters: '${apiParametersString}'`, status: 'info' });

  const apiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${apiParametersString}`;
  log.push({ message: `Constructed API URL: ${apiUrl}`, status: 'info' });

  log.push({ message: "Attempting to fetch data from Open-Meteo Marine API...", status: 'pending' });

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    log.push({ message: `API Response Status: ${response.status}`, status: response.ok ? 'success' : 'error' });

    const rawResponseBody = await response.text();
    log.push({ message: `Raw API Response Body (first 500 chars): ${rawResponseBody.substring(0,500)}`, status: response.ok ? 'info' : 'error' });


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
      return { success: false, error: `Failed to fetch marine data. ${reason}`, log };
    }

    let apiData: OpenMeteoMarineApiResponse;
    try {
      apiData = JSON.parse(rawResponseBody);
      log.push({ message: "Successfully parsed API JSON response.", status: 'success' });
    } catch (jsonError) {
      log.push({ message: `Failed to parse API JSON response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`, status: 'error', details: rawResponseBody });
      return { success: false, error: "Failed to parse API response.", log };
    }


    if (apiData.error) {
      log.push({ message: `Open-Meteo API reported an error: ${apiData.reason}`, status: 'error' });
      return { success: false, error: `Open-Meteo API Error: ${apiData.reason}`, log };
    }
    log.push({ message: "API response indicates no explicit error.", status: 'success' });

    if (!apiData.hourly || !apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: "No hourly data or timestamps returned from Open-Meteo Marine API.", status: 'warning' });
      return { success: true, data: [], log, dataLocationContext: "No marine data found for selected period at Open-Meteo.", error: "No marine data found for the selected location and date range at Open-Meteo." };
    }
    log.push({ message: `Received ${apiData.hourly.time.length} timestamps. Processing data...`, status: 'info' });

    const times = apiData.hourly.time;
    const numTimestamps = times.length;
    
    const marineData: MarineDataPoint[] = [];
    for (let i = 0; i < numTimestamps; i++) {
      const point: MarineDataPoint = { time: times[i] };
      
      if (selectedParamKeys.includes('seaLevel') && apiData.hourly.sea_level && apiData.hourly.sea_level[i] !== null) {
        point.seaLevel = apiData.hourly.sea_level[i];
      }
      if (selectedParamKeys.includes('waveHeight') && apiData.hourly.wave_height && apiData.hourly.wave_height[i] !== null) {
        point.waveHeight = apiData.hourly.wave_height[i];
      }
      if (selectedParamKeys.includes('waveDirection') && apiData.hourly.wave_direction && apiData.hourly.wave_direction[i] !== null) {
        point.waveDirection = apiData.hourly.wave_direction[i];
      }
      if (selectedParamKeys.includes('wavePeriod') && apiData.hourly.wave_period && apiData.hourly.wave_period[i] !== null) {
        point.wavePeriod = apiData.hourly.wave_period[i];
      }
      if (selectedParamKeys.includes('seaSurfaceTemperature') && apiData.hourly.sea_surface_temperature && apiData.hourly.sea_surface_temperature[i] !== null) {
        point.seaSurfaceTemperature = apiData.hourly.sea_surface_temperature[i];
      }
      if (selectedParamKeys.includes('windSpeed10m') && apiData.hourly.wind_speed_10m && apiData.hourly.wind_speed_10m[i] !== null) {
        point.windSpeed10m = apiData.hourly.wind_speed_10m[i];
      }
      marineData.push(point);
    }
    
    if (marineData.length === 0 && numTimestamps > 0) {
        log.push({ message: "Timestamps were received, but no valid marine data points could be constructed (all values might be null for selected parameters).", status: 'warning' });
    } else if (marineData.length === 0) {
        log.push({ message: "No marine data points constructed.", status: 'info' });
    } else {
        log.push({ message: `Successfully processed ${marineData.length} marine data points.`, status: 'success' });
    }


    return { success: true, data: marineData, log, dataLocationContext: `Marine data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)` };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Critical error during Open-Meteo fetch or processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    return { success: false, error: `Error fetching Open-Meteo marine data: ${errorMessage}`, log };
  }
}

    