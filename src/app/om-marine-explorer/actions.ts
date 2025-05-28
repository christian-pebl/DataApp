
'use server';

import type { CombinedDataPoint, FetchCombinedDataInput, LogStep, CombinedParameterKey } from './shared';
import { FetchCombinedDataInputSchema, PARAMETER_CONFIG, ALL_PARAMETERS } from './shared';
import { format, parseISO, isPast, isValid } from 'date-fns';

// Interface for the raw hourly data part of the OpenMeteo API response
interface OpenMeteoHourlyResponse {
  time: string[];
  // Marine specific
  sea_level_height_msl?: (number | null)[];
  wave_height?: (number | null)[];
  wave_direction?: (number | null)[];
  wave_period?: (number | null)[];
  sea_surface_temperature?: (number | null)[];
  // Weather specific
  temperature_2m?: (number | null)[];
  windspeed_10m?: (number | null)[]; // Requested as m/s
  winddirection_10m?: (number | null)[];
  cloudcover?: (number | null)[]; // cloud_cover in API
  shortwave_radiation?: (number | null)[]; // For GHI
}

// Interface for the overall API response from OpenMeteo (Weather or Marine)
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
    const logDetails = response.ok && rawResponseBody.length > 500 ? rawResponseBody.substring(0, 500) + "..." : rawResponseBody;
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
      log.push({ message: `No hourly data structure or time array returned from Open-Meteo ${apiName} API. Essential time data missing.`, status: 'warning' });
      return null; // Critical: cannot process without time data
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

  if (selectedParamKeys.length === 0) {
    log.push({ message: "No parameters selected for fetching.", status: "warning" });
    return { success: true, data: [], log, dataLocationContext: "No parameters selected" };
  }

  const parsedStartDate = parseISO(startDate);
  const parsedEndDate = parseISO(endDate);

  if (!isValid(parsedStartDate) || !isValid(parsedEndDate) || parsedStartDate > parsedEndDate) {
    const dateError = "Invalid date range. Start date must be before or same as end date, and dates must be valid.";
    log.push({ message: dateError, status: "error" });
    return { success: false, error: dateError, log };
  }
  log.push({ message: `Date range validated: ${startDate} to ${endDate}.`, status: 'success' });

  const formattedStartDate = format(parsedStartDate, 'yyyy-MM-dd');
  const formattedEndDate = format(parsedEndDate, 'yyyy-MM-dd');
  log.push({ message: `Dates formatted for API: Start: ${formattedStartDate}, End: ${formattedEndDate}`, status: 'info' });

  const marineParamsToFetchConfig = selectedParamKeys
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey])
    .filter(config => config && config.apiSource === 'marine');
  const marineApiParamsString = marineParamsToFetchConfig.map(config => config.apiParam).join(',');

  const weatherParamsToFetchConfig = selectedParamKeys
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey])
    .filter(config => config && config.apiSource === 'weather');
  const weatherApiParamsString = weatherParamsToFetchConfig.map(config => config.apiParam).join(',');

  log.push({ message: `Selected marine params for API: ${marineApiParamsString || 'None'}`, status: 'info'});
  log.push({ message: `Selected weather params for API: ${weatherApiParamsString || 'None'}`, status: 'info'});

  let marineApiData: OpenMeteoApiResponse | null = null;
  let weatherApiData: OpenMeteoApiResponse | null = null;
  const apiPromises = [];

  if (marineApiParamsString) {
    const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${marineApiParamsString}`;
    log.push({ message: `Requesting Marine API (${marineApiUrl}) with hourly parameters: '${marineApiParamsString}'`, status: 'info' });
    apiPromises.push(
      fetchFromOpenMeteo(marineApiUrl, 'Marine', log).then(data => {
        marineApiData = data;
      })
    );
  } else {
    log.push({ message: 'No marine parameters selected for fetching.', status: 'info' });
  }

  let weatherApiBaseUrl = 'https://api.open-meteo.com/v1/forecast';
  if (isPast(parsedEndDate)) {
    weatherApiBaseUrl = 'https://archive-api.open-meteo.com/v1/archive';
    log.push({ message: `Using Weather Archive API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is in the past.`, status: 'info' });
  } else {
    log.push({ message: `Using Weather Forecast API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is not in the past.`, status: 'info' });
  }

  if (weatherApiParamsString) {
    const weatherApiUrl = `${weatherApiBaseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${weatherApiParamsString}&wind_speed_unit=ms`;
    log.push({ message: `Requesting Weather API (${weatherApiUrl}) with hourly parameters: '${weatherApiParamsString}' and wind_speed_unit=ms`, status: 'info' });
    apiPromises.push(
      fetchFromOpenMeteo(weatherApiUrl, 'Weather', log).then(data => {
        weatherApiData = data;
      })
    );
  } else {
    log.push({ message: 'No weather parameters selected for fetching.', status: 'info' });
  }

  await Promise.all(apiPromises);
  log.push({ message: 'All API fetch attempts completed.', status: 'info' });

  let primaryErrorFromApi: string | undefined = undefined;

  if (marineApiParamsString && !marineApiData) {
    const marineError = `Marine API fetch failed or returned no usable data. Check previous log steps for details.`;
    log.push({ message: marineError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = marineError;
  } else if (marineApiData) {
    log.push({ message: 'Marine API returned usable data.', status: 'success'});
  }

  if (weatherApiParamsString && !weatherApiData) {
    const weatherError = `Weather API fetch failed or returned no usable data. Check previous log steps for details.`;
    log.push({ message: weatherError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = weatherError;
  } else if (weatherApiData) {
     log.push({ message: 'Weather API returned usable data.', status: 'success'});
  }

  const combinedDataMap = new Map<string, Partial<CombinedDataPoint>>();

  const processApiHourlyData = (
    apiRespData: OpenMeteoApiResponse | null,
    paramConfigsForThisSource: typeof marineParamsToFetchConfig, // Array of ParameterConfigItem
    apiSource: 'marine' | 'weather'
  ) => {
    if (!apiRespData || !apiRespData.hourly || !apiRespData.hourly.time || apiRespData.hourly.time.length === 0) {
      log.push({ message: `No hourly timestamps from ${apiSource} API for processing, or API data was null/empty. Skipping processing for this source.`, status: 'warning' });
      return;
    }
    const times = apiRespData.hourly.time;
    let processedCount = 0;
    log.push({ message: `Processing ${times.length} timestamps from ${apiSource} API.`, status: 'info' });

    times.forEach((time, index) => {
      const entry = combinedDataMap.get(time) || { time };
      let dataPointHasNewValue = false;

      paramConfigsForThisSource.forEach(config => {
        // config.dataKey is the application key (e.g. 'temperature2m')
        // config.apiParam is the API key (e.g. 'temperature_2m')
        const appKey = config.dataKey as CombinedParameterKey;
        const apiParamName = config.apiParam;
        const apiHourly = apiRespData.hourly as OpenMeteoHourlyResponse;
        
        log.push({ message: `[${apiSource} processing] Timestamp: ${time}, Index: ${index}, AppKey: ${appKey}, APIParam: ${apiParamName}`, status: 'info' });

        if (!(apiParamName in apiHourly)) {
          log.push({ message: `[${apiSource} processing] API parameter '${apiParamName}' not found in hourly data for ${appKey}.`, status: 'warning' });
          return; // Skip this parameter for this timestamp
        }
        
        const apiParamArray = (apiHourly as any)[apiParamName];

        if (apiParamArray && Array.isArray(apiParamArray) && index < apiParamArray.length && apiParamArray[index] !== null && apiParamArray[index] !== undefined) {
          let value = apiParamArray[index];
          log.push({ message: `[${apiSource} processing] Found value for ${appKey} (${apiParamName}): ${value}`, status: 'info' });
          (entry as any)[appKey] = Number(value);
          dataPointHasNewValue = true;
        } else {
           log.push({ message: `[${apiSource} processing] No valid value for ${appKey} (${apiParamName}) at index ${index}. Array length: ${apiParamArray?.length}`, status: 'info' });
        }
      });

      if(dataPointHasNewValue || combinedDataMap.has(time)) {
        combinedDataMap.set(time, entry);
        if(dataPointHasNewValue) processedCount++;
      }
    });
     log.push({ message: `Updated ${processedCount} data values from ${apiSource} API across ${times.length} total timestamps.`, status: 'success' });
  };

  if (marineApiData) {
    processApiHourlyData(marineApiData, marineParamsToFetchConfig, 'marine');
  }
  if (weatherApiData) {
    processApiHourlyData(weatherApiData, weatherParamsToFetchConfig, 'weather');
  }

  const finalCombinedData: CombinedDataPoint[] = Array.from(combinedDataMap.values()) as CombinedDataPoint[];
  finalCombinedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (finalCombinedData.length === 0 && selectedParamKeys.length > 0) {
    const noDataError = primaryErrorFromApi || "No data found for the selected parameters, location, and date range after processing API responses.";
    log.push({ message: noDataError, status: primaryErrorFromApi ? 'error' : 'warning' });
    return {
      success: !primaryErrorFromApi, // False if there was an API error, true if just no data
      data: [],
      log,
      dataLocationContext: `Data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)}`,
      error: noDataError
    };
  } else if (finalCombinedData.length === 0) {
     log.push({ message: "No data points to return (no parameters requested or no data processed).", status: 'info' });
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
