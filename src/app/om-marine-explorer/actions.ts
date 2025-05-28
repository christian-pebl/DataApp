
'use server';

import { format, parseISO, isPast, isValid } from 'date-fns';
import type { CombinedDataPoint, FetchCombinedDataInput, LogStep, CombinedParameterKey, OpenMeteoHourlyResponse, OpenMeteoApiResponse } from './shared';
import { FetchCombinedDataInputSchema, PARAMETER_CONFIG } from './shared';

async function fetchFromOpenMeteo(
  apiUrl: string,
  apiName: 'Marine' | 'Weather',
  log: LogStep[]
): Promise<OpenMeteoApiResponse | null> {
  const currentStepIndex = log.length;
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
      log[currentStepIndex] = { message: `${apiName} API Error: ${reason}`, status: 'error', details: rawResponseBody };
      return null;
    }

    let apiData: OpenMeteoApiResponse;
    try {
      apiData = JSON.parse(rawResponseBody);
    } catch (jsonError) {
      const errorMsg = jsonError instanceof Error ? jsonError.message : String(jsonError);
      log[currentStepIndex] = { message: `Failed to parse ${apiName} API JSON response: ${errorMsg}`, status: 'error', details: rawResponseBody };
      return null;
    }

    if (apiData.error) {
      log[currentStepIndex] = { message: `Open-Meteo ${apiName} API reported an error: ${apiData.reason}`, status: 'error', details: rawResponseBody };
      return null;
    }

    if (!apiData.hourly || !apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: `No hourly timestamps from ${apiName} API for processing, or API data was null/empty. Skipping processing for this source.`, status: 'warning' });
      log[currentStepIndex] = { message: `${apiName} API did not return hourly time data.`, status: 'warning', details: rawResponseBody };
      return null; // Critical: cannot process without time data
    }
    log.push({ message: `Received ${apiData.hourly.time.length} timestamps from ${apiName} API.`, status: 'info' });

    log[currentStepIndex] = { message: `Successfully fetched and initiated parsing for ${apiName} API.`, status: 'success' };
    return apiData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log[currentStepIndex] = { message: `Critical error during ${apiName} API fetch or processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined };
    return null;
  }
}

function processApiHourlyData(
  apiRespData: OpenMeteoApiResponse, // Assumed to be valid and checked before calling
  paramConfigsForThisSource: Array<typeof PARAMETER_CONFIG[CombinedParameterKey] & { dataKey: CombinedParameterKey }>,
  apiSource: 'marine' | 'weather',
  combinedDataMap: Map<string, Partial<CombinedDataPoint>>,
  log: LogStep[]
) {
  if (!apiRespData.hourly || !apiRespData.hourly.time || apiRespData.hourly.time.length === 0) {
    log.push({ message: `Skipping processing for ${apiSource}: No hourly time data found.`, status: 'warning' });
    return;
  }

  const times = apiRespData.hourly.time;
  let processedCount = 0;
  log.push({ message: `Processing ${times.length} timestamps from ${apiSource} API.`, status: 'info' });

  times.forEach((time, index) => {
    const entry = combinedDataMap.get(time) || { time };
    let dataPointHasNewValue = false;

    paramConfigsForThisSource.forEach(config => {
      const appKey = config.dataKey;
      const apiParamName = config.apiParam;
      const apiHourly = apiRespData.hourly as OpenMeteoHourlyResponse;

      if (!(apiParamName in apiHourly)) {
        log.push({ message: `[${apiSource} processing] API parameter '${apiParamName}' for '${appKey}' not found in hourly response.`, status: 'warning' });
        return; 
      }
      
      const apiParamArray = (apiHourly as any)[apiParamName];

      if (apiParamArray && Array.isArray(apiParamArray) && index < apiParamArray.length && apiParamArray[index] !== null && apiParamArray[index] !== undefined) {
        let value = apiParamArray[index];
        (entry as any)[appKey] = Number(value);
        dataPointHasNewValue = true;
      } else {
        // Log only if we expected this parameter based on paramConfigsForThisSource
        // log.push({ message: `[${apiSource} processing] No valid value for ${appKey} (${apiParamName}) at index ${index}. Array length: ${apiParamArray?.length}`, status: 'info' });
      }
    });

    if (dataPointHasNewValue || combinedDataMap.has(time)) {
      combinedDataMap.set(time, entry);
      if (dataPointHasNewValue) processedCount++;
    }
  });
  log.push({ message: `Updated ${processedCount} data values from ${apiSource} API across ${times.length} total timestamps.`, status: 'success' });
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
    apiPromises.push(
      fetchFromOpenMeteo(marineApiUrl, 'Marine', log).then(data => {
        marineApiData = data;
      })
    );
  } else {
    log.push({ message: 'No marine parameters selected; Marine API call skipped.', status: 'info' });
  }

  let weatherApiBaseUrl = 'https://api.open-meteo.com/v1/forecast';
  if (isPast(parsedEndDate)) {
    weatherApiBaseUrl = 'https://archive-api.open-meteo.com/v1/archive';
    log.push({ message: `Targeting Weather Archive API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is in the past.`, status: 'info' });
  } else {
    log.push({ message: `Targeting Weather Forecast API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is not in the past.`, status: 'info' });
  }

  if (weatherApiParamsString) {
    const weatherApiUrl = `${weatherApiBaseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${weatherApiParamsString}&wind_speed_unit=ms`;
    apiPromises.push(
      fetchFromOpenMeteo(weatherApiUrl, 'Weather', log).then(data => {
        weatherApiData = data;
      })
    );
  } else {
     log.push({ message: 'No weather parameters selected; Weather API call skipped.', status: 'info' });
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

  if (marineApiData) {
    processApiHourlyData(marineApiData, marineParamsToFetchConfig, 'marine', combinedDataMap, log);
  }
  if (weatherApiData) {
    processApiHourlyData(weatherApiData, weatherParamsToFetchConfig, 'weather', combinedDataMap, log);
  }

  const finalCombinedData: CombinedDataPoint[] = Array.from(combinedDataMap.values())
    .map(point => { // Ensure all defined parameters in PARAMETER_CONFIG have at least a null entry if not present
        const completePoint: Partial<CombinedDataPoint> = { time: point.time };
        selectedParamKeys.forEach(key => {
            const paramKey = key as CombinedParameterKey;
            if (point[paramKey] !== undefined) {
                (completePoint as any)[paramKey] = point[paramKey];
            } else {
                 // Only add null if it was an expected parameter based on selection,
                 // and it wasn't found in any API response after processing.
                (completePoint as any)[paramKey] = null;
            }
        });
        return completePoint as CombinedDataPoint;
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());


  if (finalCombinedData.length === 0 && selectedParamKeys.length > 0) {
    const noDataError = primaryErrorFromApi || "No data points found for the selected parameters, location, and date range after processing API responses.";
    log.push({ message: noDataError, status: primaryErrorFromApi ? 'error' : 'warning' });
    return {
      success: !primaryErrorFromApi, 
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
    success: !primaryErrorFromApi, // Success is true if no API hard error occurred
    data: finalCombinedData,
    log,
    dataLocationContext: `Data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)`
  };
}

    