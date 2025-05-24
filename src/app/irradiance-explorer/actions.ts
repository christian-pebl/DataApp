
'use server';

import type { IrradianceDataPoint, FetchIrradianceInput, LogStep } from './shared';
import { FetchIrradianceInputSchema, IRRADIANCE_PARAMETER_CONFIG } from './shared';
import { format, parseISO } from 'date-fns';

interface OpenMeteoWeatherApiResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  hourly_units?: Record<string, string>;
  hourly?: {
    time: string[];
    shortwave_radiation?: (number | null)[]; // GHI
    // diffuse_radiation?: (number | null)[]; // DHI - Removed
  };
  error?: boolean;
  reason?: string;
}

export async function fetchIrradianceDataAction(
  input: FetchIrradianceInput
): Promise<{
  success: boolean;
  data?: IrradianceDataPoint[];
  error?: string;
  log: LogStep[];
  dataLocationContext?: string;
}> {
  const log: LogStep[] = [];
  log.push({ message: 'Irradiance data fetch initiated.', status: 'info' });
  log.push({ message: `Input received: Lat: ${input.latitude}, Lon: ${input.longitude}, Start: ${input.startDate}, End: ${input.endDate}, Params: ${input.parameters.join(', ')}`, status: 'info' });

  const validationResult = FetchIrradianceInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    log.push({ message: `Input validation failed: ${errorMessages}`, status: 'error' });
    return { success: false, error: `Invalid input: ${errorMessages}`, log };
  }
  log.push({ message: 'Input validation successful.', status: 'success' });

  const { latitude, longitude, startDate, endDate, parameters: selectedParamKeys } = validationResult.data;

  if (parseISO(startDate) > parseISO(endDate)) {
    log.push({ message: "Start date cannot be after end date.", status: "error" });
    return { success: false, error: "Start date cannot be after end date.", log };
  }
  log.push({ message: `Date range validated: ${startDate} to ${endDate}.`, status: 'success' });

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  log.push({ message: `Dates formatted for API: Start: ${formattedStartDate}, End: ${formattedEndDate}`, status: 'info' });

  const hourlyParamsToFetch = selectedParamKeys
    .map(key => IRRADIANCE_PARAMETER_CONFIG[key as keyof typeof IRRADIANCE_PARAMETER_CONFIG]?.apiParam)
    .filter(Boolean)
    .join(',');
    
  log.push({ message: `Requesting Open-Meteo Weather API hourly parameters: '${hourlyParamsToFetch}'`, status: 'info' });

  const apiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${hourlyParamsToFetch}`;
  log.push({ message: `Constructed Weather API URL: ${apiUrl}`, status: 'info', details: apiUrl });

  let apiData: OpenMeteoWeatherApiResponse;

  try {
    log.push({ message: 'Attempting to fetch data from Open-Meteo Weather API...', status: 'pending' });
    const response = await fetch(apiUrl, { cache: 'no-store' });
    log.push({ message: `Weather API Response Status: ${response.status}`, status: response.ok ? 'success' : 'error' });
    
    const rawResponseBody = await response.text();
    const logDetails = response.ok && rawResponseBody.length > 500 ? rawResponseBody.substring(0, 500) + "..." : rawResponseBody;
    log.push({ message: `Raw Weather API Response Body (first 500 chars): ${logDetails}`, status: response.ok ? 'info' : 'error', details: rawResponseBody });

    if (!response.ok) {
      let reason = `Status: ${response.status}.`;
      try {
        const errorJson = JSON.parse(rawResponseBody);
        if (errorJson && errorJson.reason) {
          reason = errorJson.reason;
        } else {
          reason += ` Response: ${rawResponseBody.substring(0, 200)}`;
        }
      } catch (e) {
        reason += ` Non-JSON Response: ${rawResponseBody.substring(0, 200)}`;
      }
      log.push({ message: `Weather API Error: ${reason}`, status: 'error', details: rawResponseBody });
      return { success: false, error: `Weather API Error: ${reason}`, log };
    }
    
    apiData = JSON.parse(rawResponseBody);
    log.push({ message: 'Successfully parsed Weather API JSON response.', status: 'success' });

    if (apiData.error) {
      log.push({ message: `Open-Meteo Weather API reported an error: ${apiData.reason}`, status: 'error' });
      return { success: false, error: `Open-Meteo API Error: ${apiData.reason}`, log };
    }
    log.push({ message: 'Weather API response indicates no explicit error flag.', status: 'success' });

    if (!apiData.hourly || !apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: 'No hourly data or timestamps returned from Open-Meteo Weather API.', status: 'warning' });
      return { success: false, error: "No hourly data found for the selected criteria.", log };
    }
    log.push({ message: `Received ${apiData.hourly.time.length} timestamps from Weather API.`, status: 'info' });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Critical error during Weather API fetch or processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    return { success: false, error: `Fetch error: ${errorMessage}`, log };
  }

  const irradianceData: IrradianceDataPoint[] = [];
  const times = apiData.hourly.time;
  const ghiValues = apiData.hourly.shortwave_radiation; 
  // const dhiValues = apiData.hourly.diffuse_radiation; // Removed DHI

  let dataPointsProcessed = 0;
  for (let i = 0; i < times.length; i++) {
    const point: IrradianceDataPoint = { time: times[i] };
    let hasValue = false;

    if (selectedParamKeys.includes('ghi') && ghiValues && ghiValues[i] !== null) {
      point.ghi = ghiValues[i] as number;
      hasValue = true;
    }
    // DHI processing removed
    
    if (hasValue) {
      irradianceData.push(point);
      dataPointsProcessed++;
    }
  }
  
  log.push({ message: `Processed ${dataPointsProcessed} irradiance data points.`, status: 'success' });

  if (irradianceData.length === 0 && dataPointsProcessed === 0) {
      const noDataMsg = "No irradiance data points constructed. This could be due to the API not returning data for the selected parameters and date range, or all values being null.";
      log.push({ message: noDataMsg, status: 'warning' });
      return { 
        success: true, // Action succeeded, but no data found
        data: [], 
        log, 
        dataLocationContext: `No irradiance data found for selected period at Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`,
        error: "No data available for the selected parameters and time range." // User-facing error
      };
  }

  return {
    success: true,
    data: irradianceData,
    log,
    dataLocationContext: `Irradiance data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)`
  };
}
