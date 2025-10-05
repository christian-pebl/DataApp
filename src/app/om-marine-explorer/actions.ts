
'use server';

import { format, parseISO, isPast, isValid } from 'date-fns';
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
      log.push({ message: `[${apiName} API] Parsed JSON hourly data sample: ${JSON.stringify(apiData.hourly, null, 2).substring(0, 300)}...`, status: 'info' });
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
    if (!apiData.hourly.time || !Array.isArray(apiData.hourly.time) || apiData.hourly.time.length === 0) {
      log.push({ message: `[${apiName} API] No hourly timestamps ('hourly.time' is missing, not an array, or empty) in API response. Cannot process data.`, status: 'error', details: rawResponseBody});
      return null;
    }
    log.push({ message: `[${apiName} API] Received ${apiData.hourly.time.length} timestamps.`, status: 'info' });

    const timeLength = apiData.hourly.time.length;
    let allArraysMatchLength = true;
    for (const key in apiData.hourly) {
        if (key !== 'time' && Array.isArray(apiData.hourly[key as keyof OpenMeteoHourlyResponse])) {
            const dataArray = apiData.hourly[key as keyof OpenMeteoHourlyResponse] as any[];
            if (dataArray.length !== timeLength) {
                log.push({ message: `[${apiName} API] Mismatch in data length for parameter '${key}'. Time array has ${timeLength} entries, but '${key}' has ${dataArray.length}. This parameter will be skipped.`, status: 'warning', details: `Time array length: ${timeLength}, ${key} array length: ${dataArray.length}`});
                // Potentially remove this problematic key from apiData.hourly or handle it in processApiHourlyData
            }
        } else if (key !== 'time' && apiData.hourly[key as keyof OpenMeteoHourlyResponse] !== null && !Array.isArray(apiData.hourly[key as keyof OpenMeteoHourlyResponse])) {
            log.push({ message: `[${apiName} API] Hourly parameter '${key}' is not an array. This parameter will be skipped. Type: ${typeof apiData.hourly[key as keyof OpenMeteoHourlyResponse]}`, status: 'warning'});
        }
    }

    if (!allArraysMatchLength) { // This flag might not be strictly needed if individual params are handled.
        log.push({ message: `[${apiName} API] One or more hourly data arrays had inconsistent lengths with the time array or were not arrays. Data may be incomplete or unreliable.`, status: 'warning'});
    } else {
        log.push({ message: `[${apiName} API] All hourly data arrays validated for consistent length with time array (or type check passed).`, status: 'success'});
    }

    log[currentStepIndex] = { message: `[${apiName} API] Successfully fetched and performed initial validation on data structure.`, status: 'success' };
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
  if (!apiRespData.hourly || !apiRespData.hourly.time || !Array.isArray(apiRespData.hourly.time) || apiRespData.hourly.time.length === 0) {
    log.push({ message: `[${apiSource} Processing] No hourly data or valid time array found in API response. Skipping processing for this source.`, status: 'warning' });
    return;
  }
  const times = apiRespData.hourly.time;
  const timeLength = times.length;
  log.push({ message: `[${apiSource} Processing] Starting to process ${timeLength} timestamps.`, status: 'info' });

  times.forEach((time, index) => {
    const entry = combinedDataMap.get(time) || { time };
    let dataPointHasNewValue = false;

    paramConfigsForThisSource.forEach(config => {
      const appKey = config.dataKey; // e.g., temperature2m
      const apiParamName = config.apiParam; // e.g., temperature_2m
      const apiHourly = apiRespData.hourly as OpenMeteoHourlyResponse;
      
      log.push({ message: `[${apiSource} Processing] Timestamp: ${time}, Param: '${appKey}' (API: '${apiParamName}')`, status: 'info' });

      if (!(apiParamName in apiHourly) || apiHourly[apiParamName as keyof OpenMeteoHourlyResponse] === undefined || apiHourly[apiParamName as keyof OpenMeteoHourlyResponse] === null) {
        log.push({ message: `  └─ Param '${apiParamName}' not found or is null/undefined in API's hourly response for this source. Setting '${appKey}' to null.`, status: 'info' });
        (entry as any)[appKey] = null;
        return;
      }
      
      const apiParamArray = (apiHourly as any)[apiParamName] as any[];

      if (!Array.isArray(apiParamArray)) {
        log.push({ message: `  └─ Data for '${apiParamName}' is not an array (Type: ${typeof apiParamArray}). Setting '${appKey}' to null.`, status: 'warning' });
        (entry as any)[appKey] = null;
        return;
      }
      
      if (apiParamArray.length !== timeLength) {
        log.push({ message: `  └─ Data array for '${apiParamName}' (length: ${apiParamArray.length}) does not match time array length (${timeLength}). Setting '${appKey}' to null.`, status: 'error' });
        (entry as any)[appKey] = null;
        return;
      }

      const rawValue = apiParamArray[index];
      log.push({ message: `    └─ Raw value: ${rawValue === null ? 'null' : rawValue === undefined ? 'undefined' : String(rawValue).substring(0,20)}`, status: 'info'});

      if (rawValue !== null && rawValue !== undefined) {
        const numericValue = Number(rawValue);
        if (!isNaN(numericValue)) {
          (entry as any)[appKey] = numericValue;
          dataPointHasNewValue = true;
          log.push({ message: `      └─ Validated. Parsed as ${numericValue}. Assigned to '${appKey}'.`, status: 'success' });
        } else {
          log.push({ message: `      └─ Invalid. Raw value '${rawValue}' is not a parsable number. Setting '${appKey}' to null.`, status: 'warning' });
          (entry as any)[appKey] = null; 
        }
      } else {
        log.push({ message: `    └─ Missing. Raw value is null or undefined. Setting '${appKey}' to null.`, status: 'info' });
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

  // Intelligent date adjustment for far-future or problematic dates
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const durationDays = Math.floor((parsedEndDate.getTime() - parsedStartDate.getTime()) / (1000 * 60 * 60 * 24));

  let adjustedStartDate = parsedStartDate;
  let adjustedEndDate = parsedEndDate;
  let dateAdjustmentNote = '';

  // Case 1: Dates are far in the future (>5 days), use 7 days ago to avoid API range errors
  if (daysSinceStart < -5) {
    adjustedEndDate = new Date(now);
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 7); // 7 days ago (safely in the past)
    adjustedStartDate = new Date(adjustedEndDate);
    const cappedDuration = Math.min(durationDays, 90); // Cap duration at 90 days
    adjustedStartDate.setDate(adjustedStartDate.getDate() - cappedDuration);

    dateAdjustmentNote = `Dates were in far future (${startDate} to ${endDate}). Adjusted to recent past (${format(adjustedStartDate, 'yyyy-MM-dd')} to ${format(adjustedEndDate, 'yyyy-MM-dd')}) with ${cappedDuration}-day duration (capped at 90 days).`;
    log.push({ message: dateAdjustmentNote, status: 'warning' });
  }
  // Case 2: End date is slightly in future (1-5 days), use 3 days ago to avoid API range errors
  else if (daysSinceStart < 0) {
    adjustedEndDate = new Date(now);
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 3); // 3 days ago (safely in the past)

    // If start date is also in future, move it back proportionally
    if (parsedStartDate > now) {
      const cappedDuration = Math.min(durationDays, 90); // Cap duration at 90 days
      adjustedStartDate = new Date(adjustedEndDate);
      adjustedStartDate.setDate(adjustedStartDate.getDate() - cappedDuration);
      dateAdjustmentNote = `Both dates were in future. Adjusted to recent past ending 3 days ago (${format(adjustedStartDate, 'yyyy-MM-dd')} to ${format(adjustedEndDate, 'yyyy-MM-dd')}) with ${cappedDuration}-day duration (capped at 90 days).`;
    } else {
      dateAdjustmentNote = `End date was in future. Adjusted to 3 days ago (${format(adjustedEndDate, 'yyyy-MM-dd')}).`;
    }
    log.push({ message: dateAdjustmentNote, status: 'warning' });
  }
  // Case 3: Dates are very old (>5 years), might be malformed - use 7 days ago for reliability
  else if (daysSinceStart > 1825) { // More than 5 years ago
    adjustedEndDate = new Date(now);
    adjustedEndDate.setDate(adjustedEndDate.getDate() - 7); // 7 days ago (safely in the past)
    adjustedStartDate = new Date(adjustedEndDate);
    const cappedDuration = Math.min(durationDays, 90); // Cap duration at 90 days
    adjustedStartDate.setDate(adjustedStartDate.getDate() - cappedDuration);

    dateAdjustmentNote = `Dates were very old (>${Math.floor(daysSinceStart/365)} years ago). Adjusted to recent past (${format(adjustedStartDate, 'yyyy-MM-dd')} to ${format(adjustedEndDate, 'yyyy-MM-dd')}) with ${cappedDuration}-day duration (capped at 90 days) for better data availability.`;
    log.push({ message: dateAdjustmentNote, status: 'warning' });
  }

  const formattedStartDate = format(adjustedStartDate, 'yyyy-MM-dd');
  const formattedEndDate = format(adjustedEndDate, 'yyyy-MM-dd');
  log.push({ message: `Dates formatted for API: Start: ${formattedStartDate}, End: ${formattedEndDate}`, status: 'info' });

  const paramsBySource: { marine: string[], weather: string[] } = { marine: [], weather: [] };
  const paramConfigsForSource: { marine: any[], weather: any[] } = { marine: [], weather: [] };

  selectedParamKeys.forEach(key => {
    const config = PARAMETER_CONFIG[key as CombinedParameterKey];
    if (config) {
      if (config.apiSource === 'marine') {
        paramsBySource.marine.push(config.apiParam);
        paramConfigsForSource.marine.push({ ...config, dataKey: key });
      } else if (config.apiSource === 'weather') {
        paramsBySource.weather.push(config.apiParam);
        paramConfigsForSource.weather.push({ ...config, dataKey: key });
      }
    }
  });

  const marineApiParamsString = paramsBySource.marine.join(',');
  log.push({ message: `Marine params for API: ${marineApiParamsString || 'None'}`, status: 'info'});

  const weatherApiParamsString = paramsBySource.weather.join(',');
  log.push({ message: `Weather params for API: ${weatherApiParamsString || 'None'}`, status: 'info'});


  let marineApiData: OpenMeteoApiResponse | null = null;
  let weatherApiData: OpenMeteoApiResponse | null = null;
  const apiPromises = [];

  if (marineApiParamsString) {
    const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${marineApiParamsString}`;
    log.push({ message: `[Marine API] Will attempt fetch. URL being constructed: ${marineApiUrl}`, status: 'info' });
    apiPromises.push(
      fetchFromOpenMeteo(marineApiUrl, 'Marine', log).then(data => {
        marineApiData = data;
      })
    );
  } else {
    log.push({ message: '[Marine API] No marine parameters selected; Marine API call skipped.', status: 'info' });
  }

  let weatherApiBaseUrl = 'https://api.open-meteo.com/v1/forecast';
  if (isPast(adjustedEndDate)) {
    weatherApiBaseUrl = 'https://archive-api.open-meteo.com/v1/archive';
    log.push({ message: `Using Weather Archive API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is in the past.`, status: 'info' });
  } else {
    log.push({ message: `Using Weather Forecast API (${weatherApiBaseUrl}) as end date (${formattedEndDate}) is not in the past.`, status: 'info' });
  }

  if (weatherApiParamsString) {
    const weatherApiUrl = `${weatherApiBaseUrl}?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${weatherApiParamsString}&wind_speed_unit=ms`;
    log.push({ message: `[Weather API] Will attempt fetch. URL being constructed: ${weatherApiUrl}`, status: 'info' });
    apiPromises.push(
      fetchFromOpenMeteo(weatherApiUrl, 'Weather', log).then(data => {
        weatherApiData = data;
      })
    );
  } else {
     log.push({ message: '[Weather API] No weather parameters selected; Weather API call skipped.', status: 'info' });
  }

  await Promise.all(apiPromises);
  log.push({ message: 'All API fetch attempts completed.', status: 'info' });

  let primaryErrorFromApi: string | undefined = undefined;
  let weatherFetchFailed = false;
  let marineFetchFailed = false;

  if (weatherApiParamsString && !weatherApiData) {
    const weatherError = `Weather API fetch failed or returned no usable data. Check preceding log steps for details.`;
    log.push({ message: weatherError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = weatherError;
    weatherFetchFailed = true;
  } else if (weatherApiData) {
    log.push({ message: '[Weather API] Returned data.', status: 'success'});
  }

  if (marineApiParamsString && !marineApiData) {
    const marineError = `Marine API fetch failed or returned no usable data. Check preceding log steps for details.`;
    log.push({ message: marineError, status: 'error' });
    if (!primaryErrorFromApi) primaryErrorFromApi = marineError;
    marineFetchFailed = true;
  } else if (marineApiData) {
    log.push({ message: '[Marine API] Returned data.', status: 'success'});
  }

  const combinedDataMap = new Map<string, Partial<CombinedDataPoint>>();

  if (weatherApiData) {
    processApiHourlyData(weatherApiData, paramConfigsForSource.weather, 'Weather', combinedDataMap, log);
  }
  if (marineApiData) {
    processApiHourlyData(marineApiData, paramConfigsForSource.marine, 'Marine', combinedDataMap, log);
  }

  // Ensure all selected parameters are present in each point, even if null
  const finalCombinedData: CombinedDataPoint[] = Array.from(combinedDataMap.values())
    .map(point => {
        const completePoint: Partial<CombinedDataPoint> = { time: point.time };
        ALL_PARAMETERS.forEach(key => { // Iterate over ALL possible parameters defined in shared.ts
            const paramKey = key as CombinedParameterKey;
            if (selectedParamKeys.includes(paramKey)) { // Only care about keys the user actually selected
                if (point[paramKey] !== undefined) {
                    (completePoint as any)[paramKey] = point[paramKey];
                } else {
                    // If a parameter was selected by user but no API provided it (or it was null/invalid)
                    // ensure it's explicitly null in the final data point.
                    (completePoint as any)[paramKey] = null;
                }
            }
        });
        return completePoint as CombinedDataPoint;
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  log.push({ message: `[INTERNAL] Final combined data processing. Total points after merge: ${finalCombinedData.length}`, status: 'info' });
  if (finalCombinedData.length > 0) {
    log.push({ message: `[INTERNAL] Sample of first 3 combined data points: ${JSON.stringify(finalCombinedData.slice(0, Math.min(finalCombinedData.length, 3)), null, 2)}`, status: 'info', details: JSON.stringify(finalCombinedData.slice(0, Math.min(finalCombinedData.length, 3)), null, 2) });
  } else if (selectedParamKeys.length > 0) {
    log.push({ message: `[INTERNAL] No data points in finalCombinedData, although parameters were selected.`, status: 'warning' });
  }

  const overallSuccess = !primaryErrorFromApi; // Success if no API explicitly failed at fetch/parse stage.
                                                // Empty data is not a "failure" of the action itself if APIs responded ok.

  if (!overallSuccess) {
    log.push({ message: `Overall fetch failed. Primary error: ${primaryErrorFromApi}`, status: 'error' });
  } else if (finalCombinedData.length === 0 && selectedParamKeys.length > 0) {
    log.push({ message: "APIs responded successfully but no data points were generated for the selected criteria.", status: 'warning' });
  } else if (overallSuccess) {
    log.push({ message: `Successfully processed and merged ${finalCombinedData.length} data points.`, status: 'success' });
  }

  return {
    success: overallSuccess,
    data: finalCombinedData,
    log,
    error: primaryErrorFromApi || (finalCombinedData.length === 0 && selectedParamKeys.length > 0 ? "No data points found for the selected criteria after processing API responses." : undefined),
    dataLocationContext: `Lat: ${latitude.toFixed(2)}, Lon: ${longitude.toFixed(2)} (Open-Meteo)`
  };
}
    
