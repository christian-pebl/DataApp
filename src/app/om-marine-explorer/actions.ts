
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
  // Add other potential parameters if needed
}

interface OpenMeteoMarineApiResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  hourly_units?: Record<string, string>; // e.g., { time: "iso8601", sea_level: "m" }
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

  const validationResult = FetchMarineDataInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    log.push({ message: `Input validation failed: ${errorMessages}`, status: 'error' });
    return { success: false, error: `Invalid input: ${errorMessages}`, log };
  }

  const { latitude, longitude, startDate, endDate, parameters: selectedParamKeys } = validationResult.data;

  log.push({ message: `Initiating Open-Meteo Marine data fetch for Lat: ${latitude}, Lon: ${longitude}`, status: 'info' });
  log.push({ message: `Date range: ${startDate} to ${endDate}`, status: 'info' });
  log.push({ message: `Selected parameters: ${selectedParamKeys.join(', ')}`, status: 'info' });


  if (parseISO(startDate) > parseISO(endDate)) {
    log.push({ message: "Start date cannot be after end date.", status: "error"});
    return { success: false, error: "Start date cannot be after end date.", log };
  }

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  
  // Convert selectedParamKeys (like 'seaLevel') to API parameter names (like 'sea_level')
  const apiParametersString = selectedParamKeys
    .map(key => MARINE_PARAMETER_CONFIG[key as MarineParameterKey]?.apiParam)
    .filter(Boolean) // Remove undefined if a key is invalid
    .join(',');

  if (!apiParametersString) {
    log.push({ message: "No valid API parameters derived from selection.", status: 'error' });
    return { success: false, error: "No valid marine parameters selected for API request.", log };
  }
  log.push({ message: `Requesting API parameters: ${apiParametersString}`, status: 'info' });

  const apiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${apiParametersString}&timezone=auto`;

  log.push({ message: `Constructed API URL: ${apiUrl}`, status: 'info' });
  log.push({ message: "Attempting to fetch data from Open-Meteo Marine API...", status: 'pending' });

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    log.push({ message: `API Response Status: ${response.status}`, status: response.ok ? 'success' : 'error' });

    if (!response.ok) {
      const errorBody = await response.text();
      log.push({ message: `API Error: ${response.statusText}`, status: 'error', details: errorBody.substring(0, 200) });
      return { success: false, error: `Failed to fetch marine data. Status: ${response.status}. ${errorBody.substring(0,100)}`, log };
    }

    const apiData: OpenMeteoMarineApiResponse = await response.json();

    if (apiData.error) {
      log.push({ message: `Open-Meteo API returned an error: ${apiData.reason}`, status: 'error' });
      return { success: false, error: `Open-Meteo API Error: ${apiData.reason}`, log };
    }

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
    }

    log.push({ message: `Successfully processed ${marineData.length} marine data points from Open-Meteo.`, status: 'success' });
    return { success: true, data: marineData, log, dataLocationContext: `Marine data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)` };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Error during Open-Meteo fetch or processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    return { success: false, error: `Error fetching Open-Meteo marine data: ${errorMessage}`, log };
  }
}
