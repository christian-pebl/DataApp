
'use server';

import type { EAStationInfo } from './shared';

interface EARawStationItem {
  '@id': string; // Full URL, e.g., "http://environment.data.gov.uk/flood-monitoring/id/stations/0401"
  label: string; // Station name
  lat?: number;
  long?: number; // Note: API uses 'long'
  notation?: string; // e.g. "0401"
  status?: string;
  stationReference?: string;
  type?: string[];
}

interface EARawStationsResponse {
  items: EARawStationItem[];
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
  // Fetching active gauging stations, might include river levels, rainfall, etc.
  // We'll filter for tidal or coastal relevance on the client if needed, or refine the API query.
  const apiUrl = "https://environment.data.gov.uk/flood-monitoring/id/stations?status=Active&_limit=200"; // Limit to 200 active stations

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' }); // No cache for potentially dynamic station list

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`EA API Error: Status ${response.status}`, errorBody);
      return { success: false, error: `Failed to fetch stations from EA API. Status: ${response.status}. ${errorBody.substring(0, 100)}` };
    }

    const rawData: EARawStationsResponse = await response.json();

    if (!rawData.items || rawData.items.length === 0) {
      return { success: true, stations: [], error: "No active monitoring stations found from EA API." };
    }

    const stations: EAStationInfo[] = rawData.items
      // Example filter: only include stations that mention 'Tidal' in their type or have a simple numerical notation (often tide gauges)
      // This is a heuristic and might need refinement based on the actual types EA uses.
      .filter(item => 
        (item.type && item.type.some(t => t.toLowerCase().includes('tidal'))) || 
        (item.notation && /^\d+$/.test(item.notation)) || // Simple numeric IDs often are tide gauges
        item.label.toLowerCase().includes('tidal') || 
        item.label.toLowerCase().includes('port') ||
        item.label.toLowerCase().includes('harbour') ||
        item.label.toLowerCase().includes('pier')
      )
      .map(item => ({
        id: item.notation || extractStationIdFromUrl(item['@id']), // Prefer notation if available, else extract from URL
        name: item.label,
        lat: item.lat,
        lon: item.long, // Map 'long' to 'lon'
        notation: item.notation,
        fullUrl: item['@id'],
      }))
      .slice(0, 100); // Further limit to 100 after filtering for performance on client

    if (stations.length === 0) {
        return { success: true, stations: [], error: "No tidal-relevant stations found after filtering." };
    }

    return { success: true, stations };

  } catch (error) {
    console.error("Error in fetchMonitoringStationsAction:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return { success: false, error: `Error fetching or processing EA stations: ${errorMessage}` };
  }
}
