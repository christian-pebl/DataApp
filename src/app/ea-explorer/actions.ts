
'use server';

import type { EAStationInfo, EAMeasureInfo, EATimeSeriesDataPoint, FetchEATimeSeriesInput } from './shared';
import { formatISO, parseISO, isValid, subDays, format } from 'date-fns';

interface EARawStationItem {
  '@id': string; // Full URL, e.g., "http://environment.data.gov.uk/flood-monitoring/id/stations/0401"
  label: string; // Station name
  lat?: number;
  long?: number; // Note: API uses 'long'
  notation?: string; // e.g. "0401"
  status?: string;
  stationReference?: string;
  type?: string[];
  measures?: EARawMeasureItem[]; // Sometimes measures are nested in station details
}

interface EARawStationsResponse {
  items: EARawStationItem[];
}

interface EARawMeasureItem {
  '@id': string;
  parameter: string; // Internal parameter code, e.g., "level"
  parameterName: string; // Human-readable name, e.g., "Water Level"
  qualifier: string;
  station: string; // URL of the station
  stationReference: string; // Station ID
  unit: string; // URL for the unit definition
  unitName: string; // e.g., "m", "mAOD"
  value?: number; // Latest reading, optional
  period?: number;
  type?: string[];
  valueType?: string;
}

interface EARawMeasuresResponse {
  items: EARawMeasureItem[];
}

interface EARawReadingItem {
  dateTime: string; // ISO8601 timestamp
  value: number;
}

interface EARawReadingsResponse {
  items: EARawReadingItem[];
}

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  details?: string;
}


function extractStationIdFromUrl(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

export async function fetchMonitoringStationsAction(): Promise<{
  success: boolean;
  stations?: EAStationInfo[];
  error?: string;
}> {
  const apiUrl = "https://environment.data.gov.uk/flood-monitoring/id/stations?status=Active&_limit=100";

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`EA API Error (Stations): Status ${response.status}`, errorBody);
      return { success: false, error: `Failed to fetch stations. Status: ${response.status}. ${errorBody.substring(0, 100)}` };
    }

    const rawData: EARawStationsResponse = await response.json();

    if (!rawData.items || rawData.items.length === 0) {
      return { success: true, stations: [], error: "No active monitoring stations found." };
    }

    const stations: EAStationInfo[] = rawData.items
      .map(item => ({
        id: item.stationReference || item.notation || extractStationIdFromUrl(item['@id']),
        name: item.label,
        lat: item.lat,
        lon: item.long,
        notation: item.notation,
        fullUrl: item['@id'],
      }));

    return { success: true, stations };

  } catch (error) {
    console.error("Error in fetchMonitoringStationsAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: `Error fetching stations: ${errorMessage}` };
  }
}

export async function fetchStationMeasuresAction(stationId: string, stationFullName: string): Promise<{
  success: boolean;
  measures?: EAMeasureInfo[];
  stationName?: string;
  error?: string;
  log: LogStep[];
}> {
  const log: LogStep[] = [];

  if (!stationId) {
    log.push({ message: "Station ID is required.", status: "error" });
    return { success: false, error: "Station ID is required.", log };
  }

  log.push({ message: `Fetching measures for station: ${stationFullName} (ID: ${stationId})`, status: "info" });

  const measuresApiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}/measures`;
  const stationApiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}`;
  
  log.push({ message: `Attempting to fetch station details from: ${stationApiUrl}`, status: "info" });
  let currentStationName = stationFullName; // Use passed name as initial, then try to confirm/update

  try {
    const stationResponse = await fetch(stationApiUrl, { cache: 'no-store' });
    if (stationResponse.ok) {
      const stationData: { items: EARawStationItem } = await stationResponse.json();
      if (stationData.items && stationData.items.label) {
        currentStationName = stationData.items.label;
        log.push({ message: `Successfully fetched station details. Confirmed station name: ${currentStationName}`, status: "success" });
      } else {
        log.push({ message: `Station details fetched, but no label found. Using provided name: ${currentStationName}`, status: "info" });
      }
    } else {
      const errorBody = await stationResponse.text();
      log.push({ message: `Could not fetch station details. Status: ${stationResponse.status}. Using provided name: ${currentStationName}`, status: "error", details: errorBody.substring(0,200) });
      console.warn(`Could not fetch station name for ${stationId}. Status: ${stationResponse.status}`);
    }

    log.push({ message: `Attempting to fetch measures from: ${measuresApiUrl}`, status: "info" });
    const measuresResponse = await fetch(measuresApiUrl, { cache: 'no-store' });

    if (!measuresResponse.ok) {
      const errorBody = await measuresResponse.text();
      log.push({ message: `Failed to fetch measures for station ${stationId}. Status: ${measuresResponse.status}.`, status: "error", details: errorBody.substring(0, 200) });
      console.error(`EA API Error (Measures for ${stationId}): Status ${measuresResponse.status}`, errorBody);
      return { success: false, error: `Failed to fetch measures for station ${stationId}. Status: ${measuresResponse.status}. ${errorBody.substring(0, 100)}`, stationName: currentStationName, log };
    }
    log.push({ message: `Measures API request successful (Status: ${measuresResponse.status}). Parsing response...`, status: "success" });

    const rawMeasuresData: EARawMeasuresResponse = await measuresResponse.json(); // Corrected line

    if (!rawMeasuresData.items || rawMeasuresData.items.length === 0) {
      log.push({ message: `No measures found for station ${currentStationName}.`, status: "info" });
      return { success: true, measures: [], stationName: currentStationName, error: `No measures found for station ${currentStationName}.`, log };
    }
    log.push({ message: `Found ${rawMeasuresData.items.length} measures for station ${currentStationName}. Transforming data...`, status: "success" });

    const measures: EAMeasureInfo[] = rawMeasuresData.items.map(item => ({
      id: item['@id'], // This is the full URL for the measure
      parameterName: item.parameterName,
      unitName: item.unitName,
      qualifier: item.qualifier,
      stationId: item.stationReference,
    }));

    log.push({ message: "Measures data successfully transformed.", status: "success" });
    return { success: true, measures, stationName: currentStationName, log };

  } catch (error) {
    console.error(`Error in fetchStationMeasuresAction for station ${stationId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Error fetching measures: ${errorMessage}`, status: "error", details: error instanceof Error ? error.stack : undefined });
    return { success: false, error: `Error fetching measures for station ${stationId}: ${errorMessage}`, stationName: currentStationName, log };
  }
}

export async function fetchEATimeSeriesDataAction(input: FetchEATimeSeriesInput): Promise<{
  success: boolean;
  data?: EATimeSeriesDataPoint[];
  error?: string;
  log: LogStep[];
}> {
  const { measureId, startDate, endDate, measureParameterName, stationName } = input;
  const log: LogStep[] = [];

  log.push({ message: `Fetching time series for measure: '${measureParameterName}' at station: '${stationName}'`, status: 'info' });
  log.push({ message: `Date range: ${startDate} to ${endDate}`, status: 'info' });
  log.push({ message: `Measure ID (URL): ${measureId}`, status: 'info' });


  if (!measureId) {
    log.push({ message: "Measure ID is required.", status: "error" });
    return { success: false, error: "Measure ID is required.", log };
  }
  if (!startDate || !endDate) {
    log.push({ message: "Start and end dates are required.", status: "error" });
    return { success: false, error: "Start and end dates are required.", log };
  }

  try {
    const parsedStartDate = parseISO(startDate);
    const parsedEndDate = parseISO(endDate);

    if (!isValid(parsedStartDate) || !isValid(parsedEndDate)) {
      log.push({ message: "Invalid date format.", status: "error" });
      return { success: false, error: "Invalid date format.", log };
    }
    if (parsedStartDate > parsedEndDate) {
      log.push({ message: "Start date cannot be after end date.", status: "error" });
      return { success: false, error: "Start date cannot be after end date.", log };
    }

    const formattedStartDate = format(parsedStartDate, 'yyyy-MM-dd');
    const formattedEndDate = format(parsedEndDate, 'yyyy-MM-dd');
    
    const apiUrl = `${measureId}/readings?_sorted&startdate=${formattedStartDate}&enddate=${formattedEndDate}`;
    log.push({ message: `Constructed API URL for readings: ${apiUrl}`, status: 'info' });

    log.push({ message: `Attempting to fetch time series data from EA API...`, status: 'pending' });
    const response = await fetch(apiUrl, { cache: 'no-store' });

    if (!response.ok) {
      const errorBody = await response.text();
      log.push({ message: `EA API Error (Time Series): Status ${response.status}`, status: 'error', details: errorBody.substring(0, 200) });
      console.error(`EA API Error (Time Series for ${measureId}): Status ${response.status}`, errorBody);
      return { success: false, error: `Failed to fetch time series data. Status: ${response.status}. ${errorBody.substring(0, 150)}`, log };
    }
    log.push({ message: `Time series API request successful (Status: ${response.status}). Parsing response...`, status: 'success' });

    const rawData: EARawReadingsResponse = await response.json();

    if (!rawData.items || rawData.items.length === 0) {
      log.push({ message: `No time series data found for the selected measure and date range. Items array was ${rawData.items ? 'empty' : 'missing'}.`, status: 'info' });
      return { success: true, data: [], error: "No time series data found for the selected measure and date range.", log };
    }
    log.push({ message: `Found ${rawData.items.length} reading items. Transforming data...`, status: 'success' });

    const timeSeriesData: EATimeSeriesDataPoint[] = rawData.items.map(item => ({
      time: item.dateTime, 
      value: item.value,
    }));
    
    const filteredData = timeSeriesData.filter(point => {
        const pointDate = parseISO(point.time);
        return isValid(pointDate) && pointDate >= parsedStartDate && pointDate <= new Date(parsedEndDate.getTime() + (24*60*60*1000 -1)); // include full end day
    });
    log.push({ message: `Data transformed. ${filteredData.length} points after date filtering.`, status: 'success' });


    return { success: true, data: filteredData, log };

  } catch (error) {
    console.error(`Error in fetchEATimeSeriesDataAction for measure ${measureId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Error fetching time series data: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    return { success: false, error: `Error fetching time series data: ${errorMessage}`, log };
  }
}

    