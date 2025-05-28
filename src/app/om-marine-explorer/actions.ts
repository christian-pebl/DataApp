
'use server';

import { format, parseISO, isPast, isValid } from 'date-fns';
import type { CombinedDataPoint, FetchCombinedDataInput, LogStep, CombinedParameterKey, OpenMeteoHourlyResponse, OpenMeteoApiResponse } from './shared';
import { FetchCombinedDataInputSchema, PARAMETER_CONFIG, ALL_PARAMETERS } from './shared';

async function fetchFromOpenMeteo(
  apiUrl: string,
  apiName: 'Marine' | 'Weather',
  log: LogStep[]
): Promise<OpenMeteoApiResponse | null> {
  const currentStepIndex = log.length;
  log.push({ message: `[${apiName} API] Attempting to fetch data...`, status: 'pending' });
  log.push({ message: `[${apiName} API] Constructed URL: ${apiUrl}`, status: 'info', details: apiUrl });

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    log.push({ message: `[${apiName} API] Response Status: ${response.status}`, status: response.ok ? 'success' : 'error', details: `Status: ${response.status}` });

    const rawResponseBody = await response.text();
    const logDetails = response.ok && rawResponseBody.length > 500 ? rawResponseBody.substring(0, 500) + "..." : rawResponseBody;
    log.push({ message: `[${apiName} API] Raw Response Body (first 500 chars): ${logDetails}`, status: response.ok ? 'info' : 'error', details: rawResponseBody });

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
      log[currentStepIndex] = { message: `[${apiName} API] Fetch Error: ${reason}`, status: 'error', details: rawResponseBody };
      return null;
    }

    let apiData: OpenMeteoApiResponse;
    try {
      apiData = JSON.parse(rawResponseBody);
      log.push({ message: `[${apiName} API] Successfully parsed JSON response.`, status: 'success' });
    } catch (jsonError) {
      const errorMsg = jsonError instanceof Error ? jsonError.message : String(jsonError);
      log[currentStepIndex] = { message: `[${apiName} API] Failed to parse JSON response: ${errorMsg}`, status: 'error', details: rawResponseBody };
      return null;
    }

    if (apiData.error) {
      log[currentStepIndex] = { message: `[${apiName} API] API reported an error: ${apiData.reason}`, status: 'error', details: rawResponseBody };
      return null;
    }
    
    if (!apiData.hourly) {
        log.push({ message: `[${apiName} API] 'hourly' field missing in API response. No data to process.`, status: 'error', details: rawResponseBody });
        return null;
    }
    if (!apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: `[${apiName} API] No hourly timestamps ('hourly.time' is missing or empty) in API response. Cannot process data.`, status: 'error', details: rawResponseBody});
      return null;
    }
    log.push({ message: `[${apiName} API] Received ${apiData.hourly.time.length} timestamps.`, status: 'info' });

    // Validate that all requested hourly data arrays match the length of the time array
    const timeLength = apiData.hourly.time.length;
    for (const key in apiData.hourly) {
        if (key !== 'time' && Array.isArray(apiData.hourly[key as keyof OpenMeteoHourlyResponse])) {
            const dataArray = apiData.hourly[key as keyof OpenMeteoHourlyResponse] as any[];
            if (dataArray.length !== timeLength) {
                log.push({ message: `[${apiName} API] Mismatch in data length for parameter '${key}'. Time array has ${timeLength} entries, but '${key}' has ${dataArray.length}.`, status: 'error', details: `Time array length: ${timeLength}, ${key} array length: ${dataArray.length}`});
                return null; // Data inconsistency
            }
        }
    }
    log.push({ message: `[${apiName} API] All hourly data arrays validated for consistent length with time array.`, status: 'success'});


    log[currentStepIndex] = { message: `[${apiName} API] Successfully fetched and validated data structure.`, status: 'success' };
    return apiData;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log[currentStepIndex] = { message: `[${apiName} API] Critical error during fetch or initial processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined };
    return null;
  }
}

function processApiHourlyData(
  apiRespData: OpenMeteoApiResponse,
  paramConfigsForThisSource: Array<typeof PARAMETER_CONFIG[CombinedParameterKey] & { dataKey: CombinedParameterKey }>,
  apiSource: 'Marine' | 'Weather',
  combinedDataMap: Map<string, Partial<CombinedDataPoint>>,
  log: LogStep[]
) {
  // This function assumes apiRespData.hourly and apiRespData.hourly.time are valid and populated,
  // as these checks are now done in fetchFromOpenMeteo
  const times = apiRespData.hourly.time;
  log.push({ message: `[${apiSource} Processing] Starting to process ${times.length} timestamps.`, status: 'info' });

  times.forEach((time, index) => {
    const entry = combinedDataMap.get(time) || { time };
    let dataPointHasNewValue = false; // Tracks if any new valid numeric data was added for this timestamp
    // log.push({ message: `[${apiSource} Processing] Timestamp: ${time} (Index: ${index})`, status: 'info' }); // Can be too verbose

    paramConfigsForThisSource.forEach(config => {
      const appKey = config.dataKey;
      const apiParamName = config.apiParam;
      const apiHourly = apiRespData.hourly as OpenMeteoHourlyResponse;

      // log.push({ message: `[${apiSource} Processing] Checking for parameter '${appKey}' (API: '${apiParamName}') for timestamp ${time}`, status: 'info' }); // Can be too verbose

      if (!(apiParamName in apiHourly)) {
        log.push({ message: `[${apiSource} Processing] Parameter '${appKey}' (API: '${apiParamName}') not found in API's hourly response. Setting to null.`, status: 'warning' });
        (entry as any)[appKey] = null;
        return;
      }
      
      const apiParamArray = (apiHourly as any)[apiParamName];

      // This check for array and index bounds should be guaranteed by fetchFromOpenMeteo's length validation,
      // but it's good for defense if this function were called directly with unvalidated data.
      if (apiParamArray && Array.isArray(apiParamArray) && index < apiParamArray.length) {
        const rawValue = apiParamArray[index];
        // log.push({ message: `[${apiSource} Processing] Raw value for '${appKey}' (API: '${apiParamName}') at index ${index}: ${rawValue === null ? 'null' : rawValue === undefined ? 'undefined' : String(rawValue).substring(0,20)}`, status: 'info'}); // Can be very verbose

        if (rawValue !== null && rawValue !== undefined) {
          const numericValue = Number(rawValue);
          if (!isNaN(numericValue)) {
            (entry as any)[appKey] = numericValue;
            dataPointHasNewValue = true;
            log.push({ message: `[${apiSource} Processing] Param '${appKey}': Validated. Raw: '${rawValue}', Parsed: ${numericValue}.`, status: 'success' });
          } else {
            log.push({ message: `[${apiSource} Processing] Param '${appKey}': Invalid. Raw value '${rawValue}' is not a parsable number. Setting to null.`, status: 'warning' });
            (entry as any)[appKey] = null; 
          }
        } else {
          log.push({ message: `[${apiSource} Processing] Param '${appKey}': Missing. Raw value is null or undefined. Setting to null.`, status: 'info' });
          (entry as any)[appKey] = null; 
        }
      } else {
        // This case should ideally not be reached if fetchFromOpenMeteo validates array lengths
        log.push({ message: `[${apiSource} Processing] Param '${appKey}': Error. Data array for '${apiParamName}' is missing, not an array, or index ${index} is out of bounds. Array length: ${apiParamArray?.length}. Setting to null.`, status: 'error' });
        (entry as any)[appKey] = null;
      }
    });

    if (dataPointHasNewValue || combinedDataMap.has(time) || Object.keys(entry).length > 1) {
      combinedDataMap.set(time, entry);
    }
  });
  log.push({ message: `[${apiSource} Processing] Finished processing ${times.length} timestamps.`, status: 'success' });
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
  log.push({ message: `Input received: Lat: ${input.latitude}, Lon: ${input.longitude}, Start: ${input.startDate}, End: ${input.endDate}, Params: ${input.parameters.join(', ') || 'None'}`, status: 'info' });

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

  // Filter selected parameters for Marine API
  const marineParamsToFetchConfig = selectedParamKeys
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey])
    .filter(config => config && config.apiSource === 'marine');
  const marineApiParamsString = marineParamsToFetchConfig.map(config => config.apiParam).join(',');
  log.push({ message: `Selected marine params for API: ${marineApiParamsString || 'None'}`, status: 'info'});

  // Filter selected parameters for Weather API
  const weatherParamsToFetchConfig = selectedParamKeys
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey])
    .filter(config => config && config.apiSource === 'weather');
  const weatherApiParamsString = weatherParamsToFetchConfig.map(config => config.apiParam).join(',');
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
    const marineError = `Marine API fetch failed or returned no usable data. Check log for details.`;
    log.push({ message: marineError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = marineError;
  } else if (marineApiData) {
    log.push({ message: 'Marine API returned usable data.', status: 'success'});
  }

  if (weatherApiParamsString && !weatherApiData) {
    const weatherError = `Weather API fetch failed or returned no usable data. Check log for details.`;
    log.push({ message: weatherError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = weatherError;
  } else if (weatherApiData) {
     log.push({ message: 'Weather API returned usable data.', status: 'success'});
  }

  const combinedDataMap = new Map<string, Partial<CombinedDataPoint>>();

  if (marineApiData) {
    processApiHourlyData(marineApiData, marineParamsToFetchConfig as any, 'Marine', combinedDataMap, log);
  }
  if (weatherApiData) {
    processApiHourlyData(weatherApiData, weatherParamsToFetchConfig as any, 'Weather', combinedDataMap, log);
  }

  const finalCombinedData: CombinedDataPoint[] = Array.from(combinedDataMap.values())
    .map(point => {
        const completePoint: Partial<CombinedDataPoint> = { time: point.time };
        selectedParamKeys.forEach(key => {
            const paramKey = key as CombinedParameterKey;
            if (point[paramKey] !== undefined) { // This will include nulls set by processApiHourlyData
                (completePoint as any)[paramKey] = point[paramKey];
            } else {
                // This case might happen if a parameter was selected but no API provided it for this timestamp,
                // or if the parameter was not requested from any API (e.g. only marine params selected, but checking a weather param here).
                // However, processApiHourlyData should have already set nulls for requested params that were missing/invalid from specific APIs.
                // So this primarily catches parameters that were *never* found in any response map for a given time.
                // log.push({ message: `Parameter '${paramKey}' was not found in any API response for timestamp ${point.time}. Setting to null.`, status: 'info'});
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
    success: !primaryErrorFromApi,
    data: finalCombinedData,
    log,
    dataLocationContext: `Data for Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)`
  };
}

    