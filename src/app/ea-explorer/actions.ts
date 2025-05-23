
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

export async function fetchStationMeasuresAction(stationId: string): Promise<{
  success: boolean;
  measures?: EAMeasureInfo[];
  stationName?: string;
  error?: string;
}> {
  if (!stationId) {
    return { success: false, error: "Station ID is required." };
  }

  const measuresApiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}/measures`;
  const stationApiUrl = `https://environment.data.gov.uk/flood-monitoring/id/stations/${stationId}`;

  try {
    let stationName = "Unknown Station";
    const stationResponse = await fetch(stationApiUrl, { cache: 'no-store' });
    if (stationResponse.ok) {
      const stationData: { items: EARawStationItem } = await stationResponse.json();
      if (stationData.items && stationData.items.label) {
        stationName = stationData.items.label;
      }
    } else {
      console.warn(`Could not fetch station name for ${stationId}. Status: ${stationResponse.status}`);
    }

    const measuresResponse = await fetch(measuresApiUrl, { cache: 'no-store' });

    if (!measuresResponse.ok) {
      const errorBody = await measuresResponse.text();
      console.error(`EA API Error (Measures for ${stationId}): Status ${measuresResponse.status}`, errorBody);
      return { success: false, error: `Failed to fetch measures for station ${stationId}. Status: ${measuresResponse.status}. ${errorBody.substring(0, 100)}`, stationName };
    }

    const rawMeasuresData: EARawMeasuresResponse = await response.json();

    if (!rawMeasuresData.items || rawMeasuresData.items.length === 0) {
      return { success: true, measures: [], stationName, error: `No measures found for station ${stationId}.` };
    }

    const measures: EAMeasureInfo[] = rawMeasuresData.items.map(item => ({
      id: item['@id'], // This is the full URL for the measure
      parameterName: item.parameterName,
      unitName: item.unitName,
      qualifier: item.qualifier,
      stationId: item.stationReference,
    }));

    return { success: true, measures, stationName };

  } catch (error) {
    console.error(`Error in fetchStationMeasuresAction for station ${stationId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: `Error fetching measures for station ${stationId}: ${errorMessage}` };
  }
}

export async function fetchEATimeSeriesDataAction(input: FetchEATimeSeriesInput): Promise<{
  success: boolean;
  data?: EATimeSeriesDataPoint[];
  error?: string;
}> {
  const { measureId, startDate, endDate } = input;

  if (!measureId) return { success: false, error: "Measure ID is required." };
  if (!startDate || !endDate) return { success: false, error: "Start and end dates are required." };

  try {
    const parsedStartDate = parseISO(startDate);
    const parsedEndDate = parseISO(endDate);

    if (!isValid(parsedStartDate) || !isValid(parsedEndDate)) {
      return { success: false, error: "Invalid date format." };
    }
    if (parsedStartDate > parsedEndDate) {
      return { success: false, error: "Start date cannot be after end date." };
    }

    // The EA API often uses 'since' and 'before' or 'date' for specific days.
    // For a range, we can try fetching day by day if direct range isn't well supported for all measures,
    // or use a parameter like `_sorted&_limit=large_number` and filter client-side.
    // For now, let's try a common pattern: {measureId}/readings?_sorted&since={YYYY-MM-DD}&before={YYYY-MM-DD}
    // The API might also support ?date=YYYY-MM-DD for specific days, or startdate/enddate
    // A more robust way might be to fetch for a slightly wider range if the API uses `date` and filter.
    // For this example, we'll try to construct a range query if possible or just fetch recent data.

    // Use the full measureId URL to get readings.
    // Example of readings URL for a date range: {measureId}/readings?_sorted&since=YYYY-MM-DD&before=YYYY-MM-DD
    // Or for the last N days: {measureId}/readings?_sorted&_limit=N (N can be large like 1000 for ~7 days of 15-min data)
    // Let's try fetching data for the given range.
    const formattedStartDate = format(parsedStartDate, 'yyyy-MM-dd');
    const formattedEndDate = format(parsedEndDate, 'yyyy-MM-dd');

    // The EA readings endpoint typically provides data up to the current time.
    // So, for a historical range, `startdate` and `enddate` might be more suitable if the API supports it.
    // An alternative is `{measureId}/archive?startdate={YYYY-MM-DD}&enddate={YYYY-MM-DD}` but this is less common for general measures.
    // Let's use `since` and hope it respects it; otherwise, we might need to adjust or fetch more and filter.
    // The readings endpoint often is implicitly "up to now".
    // We'll use `_sorted` and then filter if needed, though a server-side date filter is best.
    // The documentation suggests `{measureId}/readings?startdate=YYYY-MM-DD&enddate=YYYY-MM-DD` for some cases.
    // Let's try:
    const apiUrl = `${measureId}/readings?_sorted&startdate=${formattedStartDate}&enddate=${formattedEndDate}`;
    // If the above doesn't work well for ranges, an alternative for recent data is:
    // const apiUrl = `${measureId}/readings?_sorted&_limit=1000`; // Fetch last 1000 readings

    console.log(`Fetching EA Time Series Data from: ${apiUrl}`);

    const response = await fetch(apiUrl, { cache: 'no-store' });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`EA API Error (Time Series for ${measureId}): Status ${response.status}`, errorBody);
      return { success: false, error: `Failed to fetch time series data. Status: ${response.status}. ${errorBody.substring(0, 150)}` };
    }

    const rawData: EARawReadingsResponse = await response.json();

    if (!rawData.items || rawData.items.length === 0) {
      return { success: true, data: [], error: "No time series data found for the selected measure and date range." };
    }

    const timeSeriesData: EATimeSeriesDataPoint[] = rawData.items.map(item => ({
      time: item.dateTime, // Assuming dateTime is ISO8601
      value: item.value,
    }));
    
    // Optional: Further filter by date range client-side if API doesn't strictly adhere
    // This is a fallback if the API returns more data than requested.
    const filteredData = timeSeriesData.filter(point => {
        const pointDate = parseISO(point.time);
        return isValid(pointDate) && pointDate >= parsedStartDate && pointDate <= new Date(parsedEndDate.getTime() + (24*60*60*1000 -1)); // include full end day
    });


    return { success: true, data: filteredData };

  } catch (error) {
    console.error(`Error in fetchEATimeSeriesDataAction for measure ${measureId}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: `Error fetching time series data: ${errorMessage}` };
  }
}
