
'use server';

import type { EAStationInfo, EAMeasureInfo } from './shared';

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

function extractStationIdFromUrl(url: string): string {
  const parts = url.split('/');
  return parts[parts.length - 1];
}

export async function fetchMonitoringStationsAction(): Promise<{
  success: boolean;
  stations?: EAStationInfo[];
  error?: string;
}> {
  // Fetching active gauging stations, limit to a reasonable number
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

    // Removed aggressive pre-filtering to show a broader range of stations
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
    // Fetch station details to get the name
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

    // Fetch measures
    const measuresResponse = await fetch(measuresApiUrl, { cache: 'no-store' });

    if (!measuresResponse.ok) {
      const errorBody = await measuresResponse.text();
      console.error(`EA API Error (Measures for ${stationId}): Status ${measuresResponse.status}`, errorBody);
      return { success: false, error: `Failed to fetch measures for station ${stationId}. Status: ${measuresResponse.status}. ${errorBody.substring(0, 100)}`, stationName };
    }

    const rawMeasuresData: EARawMeasuresResponse = await measuresResponse.json();

    if (!rawMeasuresData.items || rawMeasuresData.items.length === 0) {
      return { success: true, measures: [], stationName, error: `No measures found for station ${stationId}.` };
    }

    const measures: EAMeasureInfo[] = rawMeasuresData.items.map(item => ({
      id: item['@id'],
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
