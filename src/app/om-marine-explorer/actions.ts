
'use server';

import { format, parseISO, isPast, isValid, differenceInDays } from 'date-fns';
import type { CombinedDataPoint, FetchCombinedDataInput, LogStep, CombinedParameterKey, OpenMeteoHourlyResponse, OpenMeteoApiResponse } from './shared';
import { FetchCombinedDataInputSchema, PARAMETER_CONFIG, ALL_PARAMETERS } from './shared';

// Helper to check if a string is a valid date string (YYYY-MM-DD)
const isValidDateString = (val: string | undefined | null): boolean => {
  if (!val || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return false;
  }
  try {
    const date = parseISO(val);
    return isValid(date) && date.toISOString().startsWith(val);
  } catch (e) {
    return false;
  }
};

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
    const logDetails = rawResponseBody.length > 500 ? rawResponseBody.substring(0, 500) + "..." : rawResponseBody;
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
        log.push({ message: `[${apiName} API] 'hourly' field missing in API response. No data to process.`, status: 'warning', details: rawResponseBody });
        return null;
    }
    if (!apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: `[${apiName} API] No hourly timestamps ('hourly.time' is missing or empty) in API response. Cannot process data.`, status: 'warning', details: rawResponseBody});
      return null;
    }
    log.push({ message: `[${apiName} API] Received ${apiData.hourly.time.length} timestamps.`, status: 'info' });

    const timeLength = apiData.hourly.time.length;
    let allArraysMatchLength = true;
    for (const key in apiData.hourly) {
        if (key !== 'time' && Array.isArray(apiData.hourly[key as keyof OpenMeteoHourlyResponse])) {
            const dataArray = apiData.hourly[key as keyof OpenMeteoHourlyResponse] as any[];
            if (dataArray.length !== timeLength) {
                log.push({ message: `[${apiName} API] Mismatch in data length for parameter '${key}'. Time array has ${timeLength} entries, but '${key}' has ${dataArray.length}.`, status: 'error', details: `Time array length: ${timeLength}, ${key} array length: ${dataArray.length}`});
                allArraysMatchLength = false; // Mark as error but continue to see if other data is okay or if this is the only issue
            }
        }
    }
    if (!allArraysMatchLength) {
        log.push({ message: `[${apiName} API] One or more hourly data arrays had inconsistent lengths with the time array. Data may be incomplete or unreliable.`, status: 'error'});
        // Depending on strictness, you might return null here, or proceed with caution
        // For now, let's proceed but with an error logged.
    } else {
        log.push({ message: `[${apiName} API] All hourly data arrays validated for consistent length with time array.`, status: 'success'});
    }

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
  if (!apiRespData.hourly || !apiRespData.hourly.time) {
    log.push({ message: `[${apiSource} Processing] No hourly data or time array found in API response. Skipping processing.`, status: 'warning' });
    return;
  }
  const times = apiRespData.hourly.time;
  const timeLength = times.length;
  log.push({ message: `[${apiSource} Processing] Starting to process ${timeLength} timestamps.`, status: 'info' });

  times.forEach((time, index) => {
    const entry = combinedDataMap.get(time) || { time };
    let dataPointHasNewValue = false;

    paramConfigsForThisSource.forEach(config => {
      const appKey = config.dataKey;
      const apiParamName = config.apiParam;
      const apiHourly = apiRespData.hourly as OpenMeteoHourlyResponse;
      
      log.push({ message: `[${apiSource} Processing] Timestamp: ${time}, Param: '${appKey}' (API: '${apiParamName}')`, status: 'info' });

      if (!(apiParamName in apiHourly)) {
        log.push({ message: `  └─ Param '${apiParamName}' not found in API's hourly response for this source. Setting to null.`, status: 'warning' });
        (entry as any)[appKey] = null;
        return;
      }
      
      const apiParamArray = (apiHourly as any)[apiParamName];

      if (!apiParamArray || !Array.isArray(apiParamArray)) {
        log.push({ message: `  └─ Data for '${apiParamName}' is missing or not an array. Setting to null.`, status: 'error' });
        (entry as any)[appKey] = null;
        return;
      }
      
      if (apiParamArray.length !== timeLength) {
        log.push({ message: `  └─ Data array for '${apiParamName}' (length: ${apiParamArray.length}) does not match time array length (${timeLength}). Setting to null.`, status: 'error' });
        (entry as any)[appKey] = null;
        return;
      }

      const rawValue = apiParamArray[index];
      log.push({ message: `  └─ Raw value: ${rawValue === null ? 'null' : rawValue === undefined ? 'undefined' : String(rawValue).substring(0,20)}`, status: 'info'});

      if (rawValue !== null && rawValue !== undefined) {
        const numericValue = Number(rawValue);
        if (!isNaN(numericValue)) {
          (entry as any)[appKey] = numericValue;
          dataPointHasNewValue = true;
          log.push({ message: `    └─ Validated. Parsed: ${numericValue}.`, status: 'success' });
        } else {
          log.push({ message: `    └─ Invalid. Raw value '${rawValue}' is not a parsable number. Setting to null.`, status: 'warning' });
          (entry as any)[appKey] = null; 
        }
      } else {
        log.push({ message: `    └─ Missing. Raw value is null or undefined. Setting to null.`, status: 'info' });
        (entry as any)[appKey] = null; 
      }
    });

    if (dataPointHasNewValue || combinedDataMap.has(time) || Object.keys(entry).length > 1) {
      combinedDataMap.set(time, entry);
      // Log the entry object after processing all parameters for this timestamp
      // log.push({ message: `[${apiSource} Processing] Timestamp: ${time}, Processed Entry: ${JSON.stringify(entry)}`, status: 'info', details: JSON.stringify(entry) });
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
  log.push({ message: `Input received: Lat: ${input.latitude}, Lon: ${input.longitude}, Start: ${input.startDate}, End: ${input.endDate}, Params: ${input.parameters.join(', ') || 'None'}`, status: 'info', details: JSON.stringify(input) });

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

  // Check if date range exceeds 92 days for historical data, common limit for Open-Meteo archive
  if (differenceInDays(parsedEndDate, parsedStartDate) > 92 && isPast(parsedEndDate)) {
    const dateRangeError = "Date range for historical data exceeds 92 days, which might be too long for the Open-Meteo archive API. Please select a shorter range.";
    log.push({ message: dateRangeError, status: 'error' });
    return { success: false, error: dateRangeError, log };
  }


  const formattedStartDate = format(parsedStartDate, 'yyyy-MM-dd');
  const formattedEndDate = format(parsedEndDate, 'yyyy-MM-dd');
  log.push({ message: `Dates formatted for API: Start: ${formattedStartDate}, End: ${formattedEndDate}`, status: 'info' });

  const marineParamsToFetchConfig = selectedParamKeys
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey])
    .filter(config => config && config.apiSource === 'marine');
  const marineApiParamsString = marineParamsToFetchConfig.map(config => config.apiParam).join(',');
  log.push({ message: `Marine params for API: ${marineApiParamsString || 'None'}`, status: 'info'});

  const weatherParamsToFetchConfig = selectedParamKeys
    .map(key => PARAMETER_CONFIG[key as CombinedParameterKey])
    .filter(config => config && config.apiSource === 'weather');
  const weatherApiParamsString = weatherParamsToFetchConfig.map(config => config.apiParam).join(',');
  log.push({ message: `Weather params for API: ${weatherApiParamsString || 'None'}`, status: 'info'});

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
  if (isPast(parsedEndDate)) { // If end date is in the past, use archive API
    weatherApiBaseUrl = 'https://archive-api.open-meteo.com/v1/archive';
    log.push({ message: `Using Weather Archive API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is in the past.`, status: 'info' });
  } else {
    log.push({ message: `Using Weather Forecast API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is not in the past.`, status: 'info' });
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
    const marineError = `Marine API fetch failed or returned no usable data. Check preceding log steps for details.`;
    log.push({ message: marineError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = marineError;
  } else if (marineApiData) {
    log.push({ message: 'Marine API returned data.', status: 'success'});
  }

  if (weatherApiParamsString && !weatherApiData) {
    const weatherError = `Weather API fetch failed or returned no usable data. Check preceding log steps for details.`;
    log.push({ message: weatherError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = weatherError;
  } else if (weatherApiData) {
     log.push({ message: 'Weather API returned data.', status: 'success'});
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
        ALL_PARAMETERS.forEach(key => { // Ensure all possible keys are considered
            const paramKey = key as CombinedParameterKey;
            if (point[paramKey] !== undefined) {
                (completePoint as any)[paramKey] = point[paramKey];
            } else {
                // If a parameter was requested but no API provided it for this timestamp, ensure it's null
                if (selectedParamKeys.includes(paramKey)) {
                    (completePoint as any)[paramKey] = null;
                }
            }
        });
        return completePoint as CombinedDataPoint;
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  log.push({ message: `[INTERNAL] Final combined data processing. Total points before return: ${finalCombinedData.length}`, status: 'info' });
  if (finalCombinedData.length > 0) {
    log.push({ message: `[INTERNAL] Sample of first combined data point: ${JSON.stringify(finalCombinedData[0])}`, status: 'info', details: JSON.stringify(finalCombinedData.slice(0, Math.min(finalCombinedData.length, 3))) });
  }


  if (finalCombinedData.length === 0 && selectedParamKeys.length > 0) {
    const noDataError = primaryErrorFromApi || "No data points found for the selected parameters, location, and date range after processing API responses. Both APIs might have returned empty or unusable data. Check API specific logs above.";
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
    

    