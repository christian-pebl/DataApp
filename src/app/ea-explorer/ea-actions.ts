
'use server';

import type {
  EAStationInfo,
  EAMeasureInfo,
  StationWithMeasureDetails,
  EATimeSeriesDataPoint,
  LogStep,
  FetchEAUniqueParametersInput,
  FetchEAStationsForParameterInput,
  FetchEATimeSeriesInput
} from './ea-shared';
import {
  FetchEAStationsForParameterInputSchema,
  FetchEATimeSeriesInputSchema
} from './ea-shared';
import { format, parseISO } from 'date-fns';

const EA_API_BASE_URL = "https://environment.data.gov.uk/flood-monitoring";

// Helper to fetch and parse JSON with logging
async function fetchJsonEA(url: string, log: LogStep[], stepName: string): Promise<any> {
  log.push({ message: `Attempting to fetch ${stepName} from: ${url}`, status: 'pending' });
  try {
    const response = await fetch(url, { cache: 'no-store' }); // No cache to get latest
    log.push({ message: `${stepName} API Response Status: ${response.status} for ${url}`, status: response.ok ? 'success' : 'error' });
    if (!response.ok) {
      const errorBody = await response.text();
      log.push({ message: `${stepName} API Error: ${response.statusText}`, status: 'error', details: errorBody.substring(0, 200) });
      throw new Error(`Failed to fetch ${stepName}. Status: ${response.status}.`);
    }
    const data = await response.json();
    log.push({ message: `Successfully parsed JSON for ${stepName} from ${url}`, status: 'success' });
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : `Unknown error fetching ${stepName}`;
    log.push({ message: `Error during ${stepName} fetch/parse from ${url}: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    throw error; // Re-throw to be caught by calling action
  }
}

// Action to fetch all unique parameters from a sample of EA stations
export async function fetchAllUniqueEAParametersAction(
  input: FetchEAUniqueParametersInput
): Promise<{
  success: boolean;
  uniqueParameters?: string[];
  error?: string;
  log: LogStep[];
}> {
  const log: LogStep[] = [];
  log.push({ message: "Initiating fetch for all unique EA parameters.", status: 'info' });

  try {
    const stationsUrl = `${EA_API_BASE_URL}/id/stations?status=Active&_limit=50`; // Limit for performance
    log.push({ message: `Fetching initial list of active stations (limit 50). URL: ${stationsUrl}`, status: 'info' });
    const stationsData = await fetchJsonEA(stationsUrl, log, "active stations list");

    if (!stationsData || !stationsData.items || stationsData.items.length === 0) {
      log.push({ message: "No active stations found in the initial sample to determine parameters.", status: 'warning' });
      return { success: true, uniqueParameters: [], log };
    }
    log.push({ message: `Found ${stationsData.items.length} active stations in the sample.`, status: 'info' });

    const uniqueParamsSet = new Set<string>();
    let stationsProcessedForMeasures = 0;

    for (const station of stationsData.items as EAStationInfo[]) {
      if (!station.stationReference) {
        log.push({ message: `Skipping station ${station.label || station['@id']} due to missing stationReference.`, status: 'warning' });
        continue;
      }
      log.push({ message: `Fetching measures for station: ${station.label} (ID: ${station.stationReference})`, status: 'pending' });
      const measuresUrl = `${EA_API_BASE_URL}/id/stations/${station.stationReference}/measures`;
      try {
        const measuresData = await fetchJsonEA(measuresUrl, log, `measures for ${station.label}`);
        if (measuresData && measuresData.items && measuresData.items.length > 0) {
          log.push({ message: `Found ${measuresData.items.length} measures for station ${station.label}.`, status: 'info' });
          (measuresData.items as EAMeasureInfo[]).forEach(measure => {
            if (measure.parameterName) {
              uniqueParamsSet.add(measure.parameterName);
            }
          });
        } else {
          log.push({ message: `No measures found for station ${station.label}.`, status: 'info' });
        }
        log.push({ message: `Successfully processed measures for ${station.label}`, status: 'success' });
      } catch (measureError) {
        log.push({ message: `Skipping measures for station ${station.label} due to error: ${(measureError as Error).message}.`, status: 'warning' });
      }
      stationsProcessedForMeasures++;
      if (stationsProcessedForMeasures >= 30) { // Limit actual measure fetches
        log.push({ message: `Reached processing limit of ${stationsProcessedForMeasures} stations for parameter discovery.`, status: 'info' });
        break;
      }
    }

    const uniqueParameters = Array.from(uniqueParamsSet).sort();
    log.push({ message: `Discovered ${uniqueParameters.length} unique parameters from processed stations.`, status: 'success' });
    return { success: true, uniqueParameters, log };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Failed to fetch unique EA parameters: ${errorMessage}`, status: 'error' });
    return { success: false, error: errorMessage, log };
  }
}

// Action to fetch stations that measure a specific parameter
export async function fetchEAStationsForParameterAction(
  input: FetchEAStationsForParameterInput
): Promise<{
  success: boolean;
  stations?: StationWithMeasureDetails[];
  error?: string;
  log: LogStep[];
}> {
  const log: LogStep[] = [];
  const validationResult = FetchEAStationsForParameterInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    log.push({ message: `Input validation failed: ${errorMessages}`, status: 'error' });
    return { success: false, error: `Invalid input: ${errorMessages}`, log };
  }
  const { selectedParameter } = validationResult.data;
  log.push({ message: `Fetching EA stations measuring '${selectedParameter}'.`, status: 'info' });

  try {
    // The EA API supports filtering stations by parameterName directly
    const stationsUrl = `${EA_API_BASE_URL}/id/stations?status=Active&parameterName=${encodeURIComponent(selectedParameter)}&_limit=100`;
    log.push({ message: `Fetching stations measuring '${selectedParameter}'. URL: ${stationsUrl}`, status: 'info' });
    const stationsData = await fetchJsonEA(stationsUrl, log, `stations for parameter ${selectedParameter}`);

    if (!stationsData || !stationsData.items || stationsData.items.length === 0) {
      log.push({ message: `No active stations found directly measuring '${selectedParameter}'.`, status: 'warning' });
      return { success: true, stations: [], log };
    }
    log.push({ message: `Found ${stationsData.items.length} stations potentially measuring '${selectedParameter}'. Verifying specific measures...`, status: 'info' });

    const stationsWithMeasure: StationWithMeasureDetails[] = [];
    for (const station of stationsData.items as EAStationInfo[]) {
      if (!station.stationReference) {
        log.push({ message: `Skipping station ${station.label || station['@id']} due to missing stationReference.`, status: 'warning' });
        continue;
      }
      // We need to fetch measures again to get the specific measureId for the *selectedParameter*
      const measuresUrl = `${EA_API_BASE_URL}/id/stations/${station.stationReference}/measures?parameterName=${encodeURIComponent(selectedParameter)}`;
      try {
        const measuresData = await fetchJsonEA(measuresUrl, log, `specific measures for ${station.label} matching parameter '${selectedParameter}'`);
        const relevantMeasure = (measuresData.items as EAMeasureInfo[])?.find(m => m.parameterName === selectedParameter); // Find first match
        
        if (relevantMeasure && relevantMeasure['@id']) {
          stationsWithMeasure.push({
            ...station,
            measureIdForSelectedParam: relevantMeasure['@id'], // This is the full URL to the measure
            unitNameForSelectedParam: relevantMeasure.unitName,
            qualifierForSelectedParam: relevantMeasure.qualifier,
          });
          log.push({ message: `Confirmed station ${station.label} measures '${selectedParameter}' with measure ID ${relevantMeasure['@id']}. Unit: ${relevantMeasure.unitName}.`, status: 'success' });
        } else {
          log.push({ message: `Station ${station.label} listed for parameter '${selectedParameter}', but specific measure not found or missing ID.`, status: 'warning' });
        }
      } catch (e) {
         log.push({ message: `Could not verify/fetch specific measure for ${station.label}, skipping. Error: ${(e as Error).message}`, status: 'warning' });
      }
    }

    log.push({ message: `Found ${stationsWithMeasure.length} stations definitively measuring '${selectedParameter}'.`, status: 'success' });
    return { success: true, stations: stationsWithMeasure, log };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Failed to fetch EA stations for parameter '${selectedParameter}': ${errorMessage}`, status: 'error' });
    return { success: false, error: errorMessage, log };
  }
}

// Action to fetch time series data for a specific EA measure
export async function fetchEATimeSeriesDataAction(
  input: FetchEATimeSeriesInput
): Promise<{
  success: boolean;
  data?: EATimeSeriesDataPoint[];
  parameterName?: string;
  unitName?: string;
  error?: string;
  log: LogStep[];
}> {
  const log: LogStep[] = [];
  const validationResult = FetchEATimeSeriesInputSchema.safeParse(input);
  if (!validationResult.success) {
    const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    log.push({ message: `Input validation failed: ${errorMessages}`, status: 'error' });
    return { success: false, error: `Invalid input for time series fetch: ${errorMessages}`, log };
  }
  const { measureId, startDate, endDate } = validationResult.data; // measureId is the full URL to the measure
  log.push({ message: `Fetching EA time series data for measure ID: ${measureId}.`, status: 'info' });
  log.push({ message: `Date range: ${startDate} to ${endDate}`, status: 'info' });

  if (parseISO(startDate) > parseISO(endDate)) {
    log.push({ message: "Start date cannot be after end date.", status: 'error' });
    return { success: false, error: "Start date cannot be after end date.", log };
  }

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  // The measureId is already the full URL to the measure. Readings are at {measureId}/readings
  const readingsUrl = `${measureId}/readings?_sorted&startdate=${formattedStartDate}&enddate=${formattedEndDate}&_limit=5000`; // Add limit
  log.push({ message: `Fetching readings from URL: ${readingsUrl}`, status: 'info' });

  try {
    // First, fetch measure details to get parameter name and unit
    let pName: string | undefined, uName: string | undefined;
    try {
        const measureDetailsUrl = measureId; // measureId is the full URL to the measure object itself
        log.push({ message: `Fetching measure details from: ${measureDetailsUrl}`, status: 'pending' });
        const measureDetailsData = await fetchJsonEA(measureDetailsUrl, log, `measure details`);
        // Direct properties, not nested under 'items' for a specific measure URL
        pName = measureDetailsData.parameterName; 
        uName = measureDetailsData.unitName;
        if (!pName || !uName) {
            // Fallback if the structure is unexpectedly different (e.g. wrapped in items)
            if (measureDetailsData.items && Array.isArray(measureDetailsData.items) && measureDetailsData.items.length > 0) {
                pName = measureDetailsData.items[0].parameterName;
                uName = measureDetailsData.items[0].unitName;
                 log.push({ message: `Extracted measure details via items array: Param='${pName}', Unit='${uName}'`, status: 'info' });
            } else {
                 log.push({ message: `Could not extract parameterName/unitName directly from ${measureDetailsUrl}. Response: ${JSON.stringify(measureDetailsData).substring(0,100)}`, status: 'warning' });
            }
        } else {
          log.push({ message: `Successfully extracted measure details: Param='${pName}', Unit='${uName}' from ${measureDetailsUrl}`, status: 'success' });
        }
    } catch (e) {
        log.push({ message: `Could not fetch/parse measure details from ${measureId}. Error: ${(e as Error).message}. Parameter/unit names might be missing.`, status: 'warning' });
    }

    const readingsData = await fetchJsonEA(readingsUrl, log, `readings for ${measureId}`);

    if (!readingsData || !readingsData.items || readingsData.items.length === 0) {
      log.push({ message: "No time series data found for the selected measure and date range.", status: 'warning' });
      return { success: true, data: [], parameterName: pName, unitName: uName, log }; // Success true, but no data
    }
    log.push({ message: `Received ${readingsData.items.length} reading items. Processing...`, status: 'info' });

    const timeSeries: EATimeSeriesDataPoint[] = readingsData.items.map((item: any) => ({
      time: item.dateTime, // Assuming dateTime is the timestamp field
      value: item.value,   // Assuming value is the data field
    }));

    log.push({ message: `Successfully processed ${timeSeries.length} time series data points.`, status: 'success' });
    return { success: true, data: timeSeries, parameterName: pName, unitName: uName, log };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Failed to fetch or process EA time series data: ${errorMessage}`, status: 'error' });
    return { success: false, error: errorMessage, log };
  }
}
