
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';

// Information about a single EA monitoring station
export interface EAStationInfo {
  '@id': string; // Full URL to the station
  label: string; // Name of the station
  lat?: number;
  long?: number;
  notation?: string; 
  stationReference: string; // Crucial ID for fetching measures
  type?: string[];
}

// Information about a specific measure at an EA station
export interface EAMeasureInfo {
  '@id': string; // Full URL to fetch readings for this specific measure
  parameter: string; 
  parameterName: string; 
  unitName: string; 
  qualifier: string; 
  station: string; // URL of the parent station
  stationReference: string; // Station ID
}

// Represents a station that has the selected parameter, including the specific measure ID for it
export interface StationWithMeasureDetails extends EAStationInfo {
  measureIdForSelectedParam: string; // The '@id' from EAMeasureInfo for the chosen parameter
  unitNameForSelectedParam?: string;
  qualifierForSelectedParam?: string;
}

// Generic data point for EA time series data
export interface EATimeSeriesDataPoint {
  time: string; // ISO timestamp
  value: number;
}

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending' | 'warning';
  details?: string;
  isLastAttempt?: boolean;
}

// --- Schemas for Server Action inputs ---

// No specific input for fetching unique parameters, but we can define an empty schema for consistency
export const FetchEAUniqueParametersInputSchema = z.object({});
export type FetchEAUniqueParametersInput = z.infer<typeof FetchEAUniqueParametersInputSchema>;

export const FetchEAStationsForParameterInputSchema = z.object({
  selectedParameter: z.string().min(1, "Parameter name cannot be empty."),
});
export type FetchEAStationsForParameterInput = z.infer<typeof FetchEAStationsForParameterInputSchema>;

export const FetchEATimeSeriesInputSchema = z.object({
  measureId: z.string().url("Invalid measure URL."), // Full URL to the measure's readings
  startDate: z.string().refine(isValidDateString, {
    message: "Invalid start date format or value. Ensure YYYY-MM-DD format.",
  }),
  endDate: z.string().refine(isValidDateString, {
    message: "Invalid end date format or value. Ensure YYYY-MM-DD format.",
  }),
});
export type FetchEATimeSeriesInput = z.infer<typeof FetchEATimeSeriesInputSchema>;
