
'use server';

import type { MarineDataPoint, FetchMarineDataInput, LogStep } from './shared';
import { format, parseISO, isValid } from 'date-fns';

interface OpenMeteoMarineHourlyResponse {
  time: string[];
  sea_level?: (number | null)[];
  wave_height?: (number | null)[];
  wave_direction?: (number | null)[];
  wave_period?: (number | null)[];
}

interface OpenMeteoMarineApiResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  hourly_units: {
    time: string;
    sea_level?: string;
    wave_height?: string;
    wave_direction?: string;
    wave_period?: string;
  };
  hourly: OpenMeteoMarineHourlyResponse;
  error?: boolean;
  reason?: string;
}

export async function fetchOpenMeteoMarineDataAction(
  input: FetchMarineDataInput
): Promise<{
  success: boolean;
  data?: MarineDataPoint[];
  error?: string;
  log: LogStep[];
  dataLocationContext?: string;
}> {
  const { latitude, longitude, startDate, endDate } = input;
  const log: LogStep[] = [];

  log.push({ message: `Initiating Open-Meteo Marine data fetch for Lat: ${latitude}, Lon: ${longitude}`, status: 'info' });
  log.push({ message: `Date range: ${startDate} to ${endDate}`, status: 'info' });

  if (!isValid(parseISO(startDate)) || !isValid(parseISO(endDate))) {
    log.push({ message: "Invalid date format provided.", status: 'error' });
    return { success: false, error: "Invalid date format.", log };
  }
  if (parseISO(startDate) > parseISO(endDate)) {
    log.push({ message: "Start date cannot be after end date.", status: "error"});
    return { success: false, error: "Start date cannot be after end date.", log };
  }

  const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
  const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
  const parameters = "sea_level,wave_height,wave_direction,wave_period";
  const apiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${latitude}&longitude=${longitude}&start_date=${formattedStartDate}&end_date=${formattedEndDate}&hourly=${parameters}&timezone=auto`;

  log.push({ message: `Constructed API URL: ${apiUrl}`, status: 'info' });
  log.push({ message: "Attempting to fetch data from Open-Meteo Marine API...", status: 'pending' });

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    log.push({ message: `API Response Status: ${response.status}`, status: response.ok ? 'success' : 'error' });

    if (!response.ok) {
      const errorBody = await response.text();
      log.push({ message: `API Error: ${response.statusText}`, status: 'error', details: errorBody.substring(0, 200) });
      return { success: false, error: `Failed to fetch marine data. Status: ${response.status}. ${errorBody.substring(0,100)}`, log };
    }

    const apiData: OpenMeteoMarineApiResponse = await response.json();

    if (apiData.error) {
      log.push({ message: `Open-Meteo API returned an error: ${apiData.reason}`, status: 'error' });
      return { success: false, error: `Open-Meteo API Error: ${apiData.reason}`, log };
    }

    if (!apiData.hourly || !apiData.hourly.time || apiData.hourly.time.length === 0) {
      log.push({ message: "No hourly data or timestamps returned from API.", status: 'error' });
      return { success: false, error: "No hourly data returned from Open-Meteo Marine API.", log };
    }
    log.push({ message: `Received ${apiData.hourly.time.length} timestamps. Processing data...`, status: 'info' });

    const times = apiData.hourly.time;
    const seaLevels = apiData.hourly.sea_level;
    const waveHeights = apiData.hourly.wave_height;
    const waveDirections = apiData.hourly.wave_direction;
    const wavePeriods = apiData.hourly.wave_period;
    const numTimestamps = times.length;

    const marineData: MarineDataPoint[] = [];

    for (let i = 0; i < numTimestamps; i++) {
      const point: MarineDataPoint = { time: times[i] };
      if (seaLevels && seaLevels[i] !== null) point.seaLevel = seaLevels[i];
      if (waveHeights && waveHeights[i] !== null) point.waveHeight = waveHeights[i];
      if (waveDirections && waveDirections[i] !== null) point.waveDirection = waveDirections[i];
      if (wavePeriods && wavePeriods[i] !== null) point.wavePeriod = wavePeriods[i];
      marineData.push(point);
    }
    
    if (marineData.length === 0) {
        log.push({ message: "No valid marine data points could be constructed.", status: 'info' });
         return { success: true, data: [], log, dataLocationContext: "No marine data for selected period.", error: "No marine data found for the selected location and date range." };
    }

    log.push({ message: "Successfully processed marine data.", status: 'success' });
    return { success: true, data: marineData, log, dataLocationContext: "Marine data for selected location" };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    log.push({ message: `Error during fetch or processing: ${errorMessage}`, status: 'error', details: error instanceof Error ? error.stack : undefined });
    return { success: false, error: `Error fetching marine data: ${errorMessage}`, log };
  }
}
