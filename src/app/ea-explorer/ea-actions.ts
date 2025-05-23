
'use server';

import type { 
  EAStationInfo, 
  EAMeasureInfo, 
  StationWithMeasureDetails, 
  EATimeSeriesDataPoint,
  FetchEAUniqueParametersInput,
  FetchEAStationsForParameterInput,
  FetchEATimeSeriesInput,
  LogStep 
} from './ea-shared';
import { 
  FetchEAUniqueParametersInputSchema,
  FetchEAStationsForParameterInputSchema,
  FetchEATimeSeriesInputSchema
} from './ea-shared';
import { format, parseISO, isValid } from 'date-fns';

const EA_API_BASE_URL = "https://environment.data.gov.uk/flood-monitoring";

// Helper to fetch and parse JSON with logging
async function fetchJsonEA(url: string, log: LogStep[], stepName: string): Promise<any> {
  log.push({ message: `Attempting to fetch ${stepName} from: ${url}`, status: 'pending' });
  try {
    const response = await fetch(url, { cache: 'no-store' });
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
    // Fetch a list of stations (e.g., first 100 active stations)
    const stationsUrl = `${EA_API_BASE_URL}/id/stations?status=Active&_limit=50`; // Limit for performance
    const stationsData = await fetchJsonEA(stationsUrl, log, "active stations list");
    
    if (!stationsData || !stationsData.items || stationsData.items.length === 0) {
      log.push({ message: "No active stations found to determine parameters.", status: 'warning' });
      return { success: true, uniqueParameters: [], log };
    }

    const uniqueParamsSet = new Set<string>();
    let stationsProcessed = 0;

    for (const station of stationsData.items as EAStationInfo[]) {
      if (!station.stationReference) continue; // stationReference is typically the ID needed for measures
      log.push({ message: `Fetching measures for station: ${station.label} (ID: ${station.stationReference})`, status: 'pending' });
      const measuresUrl = `${EA_API_BASE_URL}/id/stations/${station.stationReference}/measures`;
      try {
        const measuresData = await fetchJsonEA(measuresUrl, log, `measures for ${station.label}`);
        if (measuresData && measuresData.items) {
          (measuresData.items as EAMeasureInfo[]).forEach(measure => {
            if (measure.parameterName) {
              uniqueParamsSet.add(measure.parameterName);
            }
          });
        }
        log.push({ message: `Successfully processed measures for ${station.label}`, status: 'success' });
      } catch (measureError) {
        log.push({ message: `Skipping measures for station ${station.label} due to error.`, status: 'warning' });
      }
      stationsProcessed++;
      if (stationsProcessed >= 30) { // Limit actual measure fetches to avoid too many API calls
        log.push({ message: `Reached processing limit of ${stationsProcessed} stations for parameter discovery.`, status: 'info' });
        break;
      }
    }

    const uniqueParameters = Array.from(uniqueParamsSet).sort();
    log.push({ message: `Found ${uniqueParameters.length} unique parameters.`, status: 'success' });
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
    // ... error handling ...
    return { success: false, error: "Invalid input", log };
  }
  const { selectedParameter } = validationResult.data;
  log.push({ message: `Fetching EA stations measuring '${selectedParameter}'.`, status: 'info' });

  try {
    const stationsUrl = `${EA_API_BASE_URL}/id/stations?status=Active&parameter=${selectedParameter}&_limit=100`; // API might support parameter filtering
    const stationsData = await fetchJsonEA(stationsUrl, log, `stations for parameter ${selectedParameter}`);

    if (!stationsData || !stationsData.items || stationsData.items.length === 0) {
      log.push({ message: `No stations found measuring '${selectedParameter}'.`, status: 'warning' });
      return { success: true, stations: [], log };
    }

    const stationsWithMeasure: StationWithMeasureDetails[] = [];
    for (const station of stationsData.items as EAStationInfo[]) {
      if (!station.stationReference) continue;
      // We need to fetch measures again to get the specific measureId for the *selectedParameter*
      const measuresUrl = `${EA_API_BASE_URL}/id/stations/${station.stationReference}/measures?parameter=${selectedParameter}`;
      try {
        const measuresData = await fetchJsonEA(measuresUrl, log, `specific measure for ${station.label}`);
        const relevantMeasure = (measuresData.items as EAMeasureInfo[])?.find(m => m.parameterName === selectedParameter);
        if (relevantMeasure) {
          stationsWithMeasure.push({
            ...station,
            measureIdForSelectedParam: relevantMeasure['@id'],
            unitNameForSelectedParam: relevantMeasure.unitName,
            qualifierForSelectedParam: relevantMeasure.qualifier,
          });
        }
      } catch (e) {
         log.push({ message: `Could not confirm measure for ${station.label}, skipping.`, status: 'warning' });
      }
    }
    
    log.push({ message: `Found ${stationsWithMeasure.length} stations measuring '${selectedParameter}'.`, status: 'success' });
    return { success: true, stations: stationsWithMeasure, log };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Failed to fetch EA stations for parameter: ${errorMessage}`, status: 'error' });
    return { success: false, error: errorMessage, log };
  }
}

// Action to fetch time series data for a specific EA measure
export async function fetchEATimeSeriesDataAction(
  input: FetchEATimeSeriesInput
): Promise<{
  success: boolean;
  data?: EATimeSeriesDataPoint[];
  parameterName?: string; // From measure details if possible
  unitName?: string;      // From measure details if possible
  error?: string;
  log: LogStep[];
}> {
  const log: LogStep[] = [];
  const validationResult = FetchEATimeSeriesInputSchema.safeParse(input);
  if (!validationResult.success) {
    // ... error handling ...
    return { success: false, error: "Invalid input for time series fetch.", log };
  }
  const { measureId, startDate, endDate } = validationResult.data;
  log.push({ message: `Fetching EA time series data for measure ID: ${measureId}.`, status: 'info' });
  log.push({ message: `Date range: ${startDate} to ${endDate}`, status: 'info' });

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');

  // The measureId is the full URL to the readings endpoint for that measure
  const readingsUrl = `${measureId}/readings?_sorted&startdate=${formattedStartDate}&enddate=${formattedEndDate}&_limit=5000`; // Add limit

  try {
    const readingsData = await fetchJsonEA(readingsUrl, log, `readings for ${measureId}`);

    if (!readingsData || !readingsData.items || readingsData.items.length === 0) {
      log.push({ message: "No time series data found for the selected measure and date range.", status: 'warning' });
      return { success: true, data: [], log };
    }

    const timeSeries: EATimeSeriesDataPoint[] = readingsData.items.map((item: any) => ({
      time: item.dateTime,
      value: item.value,
    }));

    // Attempt to get parameter name and unit from the measure details (parent URL of readings)
    let pName, uName;
    try {
        const measureDetailsUrl = measureId; // measureId is already the URL to the measure itself
        const measureDetailsData = await fetchJsonEA(measureDetailsUrl, log, `measure details from ${measureDetailsUrl}`);
        pName = measureDetailsData.items?.parameterName || measureDetailsData.items?.[0]?.parameterName; // Handle both single and array items responses
        uName = measureDetailsData.items?.unitName || measureDetailsData.items?.[0]?.unitName;
    } catch (e) {
        log.push({ message: "Could not fetch measure details for parameter/unit name.", status: 'warning' });
    }


    log.push({ message: `Successfully fetched ${timeSeries.length} data points.`, status: 'success' });
    return { success: true, data: timeSeries, parameterName: pName, unitName: uName, log };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Failed to fetch EA time series data: ${errorMessage}`, status: 'error' });
    return { success: false, error: errorMessage, log };
  }
}
