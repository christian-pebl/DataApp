
export interface MarineDataPoint {
  time: string;
  seaLevel?: number;
  waveHeight?: number;
  waveDirection?: number;
  wavePeriod?: number;
}

export interface FetchMarineDataInput {
  latitude: number;
  longitude: number;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
}

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  details?: string;
}

// This type is for the plot visibility state on the page
export type MarinePlotVisibilityKeys = 'seaLevel' | 'waveHeight' | 'waveDirection' | 'wavePeriod';
