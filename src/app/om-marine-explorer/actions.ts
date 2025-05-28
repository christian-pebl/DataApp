
'use server';

import type { CombinedDataPoint, FetchCombinedDataInput, LogStep, CombinedParameterKey } from './shared';
import { FetchCombinedDataInputSchema, PARAMETER_CONFIG } from './shared';
import { format, parseISO, isPast } from 'date-fns';

interface OpenMeteoHourlyResponse {
  time: string[];
  // Marine
  sea_level_height_msl?: (number | null)[];
  wave_height?: (number | null)[];
  wave_direction?: (number | null)[];
  wave_period?: (number | null)[];
  sea_surface_temperature?: (number | null)[];
  // Weather (can come from either archive or forecast API)
  temperature_2m?: (number | null)[];
  windspeed_10m?: (number | null)[]; // Requested as m/s
  winddirection_10m?: (number | null)[];
  shortwave_radiation?: (number | null)[]; // For GHI
}

type OpenMeteoApiResponse = {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  hourly_units?: Record<string, string>;
  hourly?: OpenMeteoHourlyResponse;
  error?: boolean;
  reason?: string;
};

async function fetchFromOpenMeteo(
  apiUrl: string,
  apiName: 'Marine' | 'Weather',
  log: LogStep[]
): Promise<OpenMeteoApiResponse | null> {
  log.push({ message: `Attempting to fetch data from Open-Meteo ${apiName} API...`, status: 'pending' });
  log.push({ message: `Constructed ${apiName} API URL: ${apiUrl}`, status: 'info', details: apiUrl });

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    log.push({ message: `${apiName} API Response Status: ${response.status}`, status: response.ok ? 'success' : 'error', details: `Status: ${response.status}` });

    const rawResponseBody = await response.text();
    const logDetails = response.ok && rawResponseBody.length > 500 ? rawResponseBody.substring(0,500) + "..." : rawResponseBody;
    log.push({ message: `Raw ${apiName} API Response Body (first 500 chars): ${logDetails}`, status: response.ok ? 'info' : 'error', details: rawResponseBody });

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
      log.push({ message: `${apiName} API Error: ${reason}`, status: 'error', details: rawResponseBody });
      return null;
    }

    let apiData: OpenMeteoApiResponse;
    try {
      apiData = JSON.parse(rawResponseBody);
      log.push({ message: `Successfully parsed ${apiName} API JSON response.`, status: 'success' });
    } catch (jsonError) {
      log.push({ message: `Failed to parse ${apiName} API JSON response: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`, status: 'error', details: rawResponseBody });
      return null;
    }

    if (apiData.error) {
      log.push({ message: `Open-Meteo ${apiName} API reported an error: ${apiData.reason}`, status: 'error', details: rawResponseBody });
      return null;
    }
    log.push({ message: `${apiName} API response indicates no explicit error flag.`, status: 'success' });

    if (!apiData.hourly || !apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: `No hourly data or timestamps returned from Open-Meteo ${apiName} API.`, status: 'warning' });
      return apiData; 
    }
    log.push({ message: `Received ${apiData.hourly.time.length} timestamps from ${apiName} API.`, status: 'info' });
    return apiData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Critical error during ${apiName} API fetch or processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    return null;
  }
}

export async function fetchCombinedDataAction(
  input: FetchCombinedDataInput
): Promise<{
  success: boolean;
  data?: CombinedDataPoint[];
  error?: string;
  log: LogStep[];
  dataLocationContext?: string;
}> {
  const log: LogStep[] = [];
  log.push({ message: 'Combined data fetch initiated.', status: 'info' });
  log.push({ message: `Input received: Lat: ${input.latitude}, Lon: ${input.longitude}, Start: ${input.startDate}, End: ${input.endDate}, Params: ${input.parameters.join(', ')}`, status: 'info' });

  const validationResult = FetchCombinedDataInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    log.push({ message: `Input validation failed: ${errorMessages}`, status: 'error' });
    return { success: false, error: `Invalid input: ${errorMessages}`, log };
  }
  log.push({ message: 'Input validation successful.', status: 'success' });

  const { latitude, longitude, startDate, endDate, parameters: selectedParamKeys } = validationResult.data;

  const parsedStartDate = parseISO(startDate);
  const parsedEndDate = parseISO(endDate);

  if (parsedStartDate > parsedEndDate) {
    log.push({ message: "Start date cannot be after end date.", status: "error" });
    return { success: false, error: "Start date cannot be after end date.", log };
  }
  log.push({ message: `Date range validated: ${startDate} to ${endDate}.`, status: 'success' });

  const formattedStartDate = format(parsedStartDate, 'yyyy-MM-dd');
  const formattedEndDate = format(parsedEndDate, 'yyyy-MM-dd');
  log.push({ message: `Dates formatted for API: Start: ${formattedStartDate}, End: ${formattedEndDate}`, status: 'info' });

  const marineParamsToFetch = selectedParamKeys
    .filter(key => PARAMETER_CONFIG[key as CombinedParameterKey]?.apiSource === 'marine')
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey]?.apiParam)
    .filter(Boolean); 

  const weatherParamsToFetch = selectedParamKeys
    .filter(key => PARAMETER_CONFIG[key as CombinedParameterKey]?.apiSource === 'weather')
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey]?.apiParam)
    .filter(Boolean);

  log.push({ message: `Selected marine params for API: ${marineParamsToFetch.join(',') || 'None'}`, status: 'info'});
  log.push({ message: `Selected weather params for API: ${weatherParamsToFetch.join(',') || 'None'}`, status: 'info'});
  
  let marineApiData: OpenMeteoApiResponse | null = null;
  let weatherApiData: OpenMeteoApiResponse | null = null;
  const apiPromises = [];

  if (marineParamsToFetch.length > 0) {
    const finalMarineParamsString = marineParamsToFetch.join(',');
    const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${finalMarineParamsString}`;
    apiPromises.push(
      fetchFromOpenMeteo(marineApiUrl, 'Marine', log).then(data => {
        marineApiData = data as OpenMeteoApiResponse | null;
      })
    );
    log.push({ message: `Requesting Marine API hourly parameters: '${finalMarineParamsString}'`, status: 'info' });
  } else {
    log.push({ message: 'No marine parameters selected for fetching.', status: 'info' });
  }

  // Determine which weather API endpoint to use
  let weatherApiBaseUrl = 'https://api.open-meteo.com/v1/forecast'; // Default to forecast
  if (isPast(parsedEndDate)) { // Check if the end date is in the past
    weatherApiBaseUrl = 'https://archive-api.open-meteo.com/v1/archive';
    log.push({ message: `Using Weather Archive API as end date (${formattedEndDate}) is in the past.`, status: 'info' });
  } else {
    log.push({ message: `Using Weather Forecast API as end date (${formattedEndDate}) is not in the past.`, status: 'info' });
  }

  if (weatherParamsToFetch.length > 0) {
    const finalWeatherParamsString = weatherParamsToFetch.join(',');
    const weatherApiUrl = `${weatherApiBaseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${finalWeatherParamsString}&wind_speed_unit=ms`;
    apiPromises.push(
      fetchFromOpenMeteo(weatherApiUrl, 'Weather', log).then(data => {
        weatherApiData = data as OpenMeteoApiResponse | null;
      })
    );
     log.push({ message: `Requesting Weather API hourly parameters: '${finalWeatherParamsString}' with wind_speed_unit=ms from ${weatherApiBaseUrl}`, status: 'info' });
  } else {
    log.push({ message: 'No weather parameters selected for fetching.', status: 'info' });
  }

  await Promise.all(apiPromises);
  log.push({ message: 'All API fetch attempts completed.', status: 'info' });

  let atLeastOneApiSuccess = false;
  if (marineApiData && !marineApiData.error && marineApiData.hourly && marineApiData.hourly.time && marineApiData.hourly.time.length > 0) {
    atLeastOneApiSuccess = true;
    log.push({ message: 'Marine API returned data.', status: 'info'});
  } else if (marineParamsToFetch.length > 0) {
    log.push({ message: `Marine API did not return usable data or had an error. API error flag: ${marineApiData?.error}, reason: ${marineApiData?.reason}`, status: 'warning'});
  }

  if (weatherApiData && !weatherApiData.error && weatherApiData.hourly && weatherApiData.hourly.time && weatherApiData.hourly.time.length > 0) {
    atLeastOneApiSuccess = true;
     log.push({ message: 'Weather API returned data.', status: 'info'});
  } else if (weatherParamsToFetch.length > 0) {
    log.push({ message: `Weather API did not return usable data or had an error. API error flag: ${weatherApiData?.error}, reason: ${weatherApiData?.reason}`, status: 'warning'});
  }

  if (!atLeastOneApiSuccess && selectedParamKeys.length > 0) {
     const finalErrorLog = log.slice().reverse().find(l => l.status === 'error' && l.message.includes('API Error:'));
     const finalError = finalErrorLog ? finalErrorLog.message : "Failed to fetch data from all sources or no data available for the selection.";
     log.push({ message: `Failed to fetch any usable data. Last critical error or issue: ${finalError}`, status: 'error' });
     return { success: false, error: finalError, log };
  }

  const combinedDataMap = new Map<string, Partial<CombinedDataPoint>>();

  const processApiHourlyData = (
    apiRespData: OpenMeteoApiResponse | null,
    paramKeysForThisSource: CombinedParameterKey[], 
    apiSource: 'marine' | 'weather'
  ) => {
    if (!apiRespData || !apiRespData.hourly || !apiRespData.hourly.time || apiRespData.hourly.time.length === 0) {
      log.push({ message: `No hourly timestamps from ${apiSource} API for processing.`, status: 'warning' });
      return;
    }
    const times = apiRespData.hourly.time;
    let processedCount = 0;
    
    times.forEach((time, index) => {
      const entry = combinedDataMap.get(time) || { time }; 
      let dataPointHasValue = false;

      paramKeysForThisSource.forEach(appKey => {
        const config = PARAMETER_CONFIG[appKey];
        if (config && config.apiSource === apiSource) {
          const apiHourly = apiRespData.hourly as OpenMeteoHourlyResponse; // Type assertion
          const apiParamArray = (apiHourly as any)[config.apiParam];
          
          if (apiParamArray && Array.isArray(apiParamArray) && index < apiParamArray.length && apiParamArray[index] !== null && apiParamArray[index] !== undefined) {
            let value = apiParamArray[index];
            // Wind speed is already requested in m/s, so no conversion needed.
            (entry as any)[appKey] = Number(value); 
            dataPointHasValue = true;
          }
        }
      });

      if(dataPointHasValue) { 
        combinedDataMap.set(time, entry);
        processedCount++;
      }
    });
     log.push({ message: `Processed ${processedCount} timestamps with data from ${apiSource} API out of ${times.length} total timestamps.`, status: 'success' });
  };
  
  const marineAppKeys = selectedParamKeys.filter(k => PARAMETER_CONFIG[k].apiSource === 'marine') as CombinedParameterKey[];
  const weatherAppKeys = selectedParamKeys.filter(k => PARAMETER_CONFIG[k].apiSource === 'weather') as CombinedParameterKey[];

  if (marineApiData) {
    processApiHourlyData(marineApiData, marineAppKeys, 'marine');
  }
  if (weatherApiData) {
    processApiHourlyData(weatherApiData, weatherAppKeys, 'weather');
  }

  const finalCombinedData: CombinedDataPoint[] = Array.from(combinedDataMap.values()) as CombinedDataPoint[];
  finalCombinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (finalCombinedData.length === 0 && selectedParamKeys.length > 0) {
    log.push({ message: "No data points constructed after merging API responses. All requested parameters might have been null or APIs returned no data for the selected period.", status: 'warning' });
    return { 
      success: true, 
      data: [], 
      log, 
      dataLocationContext: `No data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`, 
      error: "No data found for the selected parameters, location, and date range." 
    };
  } else if (finalCombinedData.length === 0) {
     log.push({ message: "No data points to return as no parameters were requested or no data was processed.", status: 'info' });
  } else {
    log.push({ message: `Successfully processed and merged ${finalCombinedData.length} data points.`, status: 'success' });
  }

  return {
    success: true,
    data: finalCombinedData,
    log,
    dataLocationContext: `Data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)`
  };
}

