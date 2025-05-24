
'use server';

import type { CombinedDataPoint, FetchCombinedDataInput, LogStep, CombinedParameterKey } from './shared';
import { FetchCombinedDataInputSchema, PARAMETER_CONFIG } from './shared';
import { format, parseISO } from 'date-fns';

interface OpenMeteoHourlyResponse {
  time: string[];
  // Marine
  wave_height?: (number | null)[];
  wave_direction?: (number | null)[];
  wave_period?: (number | null)[];
  sea_surface_temperature?: (number | null)[];
  sea_level_height_msl?: (number | null)[];
  // Weather
  temperature_2m?: (number | null)[];
  windspeed_10m?: (number | null)[];
  winddirection_10m?: (number | null)[];
  shortwave_radiation?: (number | null)[]; // For GHI
}

interface OpenMeteoApiResponse {
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
}


async function fetchFromOpenMeteo(
  apiUrl: string,
  apiName: 'Marine' | 'Weather Archive',
  log: LogStep[]
): Promise<OpenMeteoApiResponse | null> {
  log.push({ message: `Attempting to fetch data from Open-Meteo ${apiName} API...`, status: 'pending' });
  log.push({ message: `Constructed ${apiName} API URL: ${apiUrl}`, status: 'info', details: apiUrl });

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    log.push({ message: `${apiName} API Response Status: ${response.status}`, status: response.ok ? 'success' : 'error' });

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
      log.push({ message: `Open-Meteo ${apiName} API reported an error: ${apiData.reason}`, status: 'error' });
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

  if (parseISO(startDate) > parseISO(endDate)) {
    log.push({ message: "Start date cannot be after end date.", status: "error" });
    return { success: false, error: "Start date cannot be after end date.", log };
  }
  log.push({ message: `Date range validated: ${startDate} to ${endDate}.`, status: 'success' });

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
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
  log.push({ message: `Selected parameters: ${selectedParamKeys.join(', ')}`, status: 'info' });


  let marineApiData: OpenMeteoApiResponse | null = null;
  let weatherApiData: OpenMeteoApiResponse | null = null;
  const apiPromises = [];

  if (marineParamsToFetch.length > 0) {
    const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${marineParamsToFetch.join(',')}`;
    apiPromises.push(
      fetchFromOpenMeteo(marineApiUrl, 'Marine', log).then(data => {
        marineApiData = data as OpenMeteoApiResponse | null;
      })
    );
    log.push({ message: `Requesting Marine API hourly parameters: '${marineParamsToFetch.join(',')}'`, status: 'info' });
  } else {
    log.push({ message: 'No marine parameters selected for fetching.', status: 'info' });
  }

  if (weatherParamsToFetch.length > 0) {
    const weatherApiUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${weatherParamsToFetch.join(',')}`;
    apiPromises.push(
      fetchFromOpenMeteo(weatherApiUrl, 'Weather Archive', log).then(data => {
        weatherApiData = data as OpenMeteoApiResponse | null;
      })
    );
     log.push({ message: `Requesting Weather Archive API hourly parameters: '${weatherParamsToFetch.join(',')}'`, status: 'info' });
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
    log.push({ message: 'Marine API did not return usable data or had an error.', status: marineApiData?.error ? 'warning' : 'info'});
  }

  if (weatherApiData && !weatherApiData.error && weatherApiData.hourly && weatherApiData.hourly.time && weatherApiData.hourly.time.length > 0) {
    atLeastOneApiSuccess = true;
     log.push({ message: 'Weather Archive API returned data.', status: 'info'});
  } else if (weatherParamsToFetch.length > 0) {
    log.push({ message: 'Weather Archive API did not return usable data or had an error.', status: weatherApiData?.error ? 'warning' : 'info'});
  }


  if (!atLeastOneApiSuccess && selectedParamKeys.length > 0) {
     const finalErrorLog = log.slice().reverse().find(l => l.status === 'error' && l.message.includes('API Error:'));
     const finalError = finalErrorLog ? finalErrorLog.message : "Failed to fetch data from all sources or no data available for the selection.";
     log.push({ message: `Failed to fetch any usable data. Last critical error or issue: ${finalError}`, status: 'error' });
     return { success: false, error: finalError, log };
  }


  const combinedDataMap = new Map<string, Partial<CombinedDataPoint>>();

  const processApiHourlyData = (
    apiData: OpenMeteoApiResponse | null,
    paramKeys: CombinedParameterKey[],
    apiSource: 'marine' | 'weather'
  ) => {
    if (!apiData || !apiData.hourly || !apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: `No hourly timestamps from ${apiSource} API, skipping its data processing.`, status: 'warning' });
      return;
    }
    const times = apiData.hourly.time;
    let processedCount = 0;
    times.forEach((time, index) => {
      const entry = combinedDataMap.get(time) || { time };
      let dataPointHasValue = false;
      paramKeys.forEach(key => {
        const config = PARAMETER_CONFIG[key];
        if (config.apiSource === apiSource) {
          const apiHourly = apiData.hourly as any; 
          if (apiHourly[config.apiParam] && Array.isArray(apiHourly[config.apiParam]) && index < apiHourly[config.apiParam].length && apiHourly[config.apiParam][index] !== null) {
            (entry as any)[key] = apiHourly[config.apiParam][index];
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

  if (marineApiData) {
    processApiHourlyData(marineApiData, selectedParamKeys.filter(k => PARAMETER_CONFIG[k].apiSource === 'marine') as CombinedParameterKey[], 'marine');
  }
  if (weatherApiData) {
    processApiHourlyData(weatherApiData, selectedParamKeys.filter(k => PARAMETER_CONFIG[k].apiSource === 'weather') as CombinedParameterKey[], 'weather');
  }

  const finalCombinedData: CombinedDataPoint[] = Array.from(combinedDataMap.values()) as CombinedDataPoint[];
  finalCombinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());


  if (finalCombinedData.length === 0 && selectedParamKeys.length > 0) {
    log.push({ message: "No data points constructed after merging API responses. All requested parameters might have been null or APIs returned no data.", status: 'warning' });
    return { 
      success: true, 
      data: [], 
      log, 
      dataLocationContext: `No data found for selected period at Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`, 
      error: "No data found for the selected parameters, location, and date range." 
    };
  } else if (finalCombinedData.length === 0) {
     log.push({ message: "No data points to return.", status: 'info' });
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
