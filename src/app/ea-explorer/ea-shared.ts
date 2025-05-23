
import { z } from 'zod';
import { isValidDateString } from '@/lib/utils';

// Information about a single EA monitoring station
export interface EAStationInfo {
  '@id': string; // Full URL to the station
  label: string; // Name of the station
  lat?: number;
  long?: number;
  notation?: string; // Often the station ID like "E72534"
  stationReference?: string; // Another form of ID
  type?: string[];
  measures?: EAMeasureInfo[]; // Optional: if we fetch measures along with station details
}

// Information about a specific measure at an EA station
export interface EAMeasureInfo {
  '@id': string; // Full URL to fetch readings for this specific measure
  parameter: string; // Short code for the parameter e.g., "TIDE"
  parameterName: string; // Human-readable name e.g., "Water Level"
  unitName: string; // e.g., "mAOD", "m"
  qualifier: string; // e.g., "Stage", "Tidal Level"
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

export const FetchEAUniqueParametersInputSchema = z.object({}); // No specific input for now
export type FetchEAUniqueParametersInput = z.infer<typeof FetchEAUniqueParametersInputSchema>;

export const FetchEAStationsForParameterInputSchema = z.object({
  selectedParameter: z.string().min(1, "Parameter name cannot be empty."),
});
export type FetchEAStationsForParameterInput = z.infer<typeof FetchEAStationsForParameterInputSchema>;

export const FetchEATimeSeriesInputSchema = z.object({
  measureId: z.string().url("Invalid measure URL."), // Full URL for the measure's readings
  startDate: z.string().refine(isValidDateString, {
    message: "Invalid start date format or value. Ensure YYYY-MM-DD format.",
  }),
  endDate: z.string().refine(isValidDateString, {
    message: "Invalid end date format or value. Ensure YYYY-MM-DD format.",
  }),
});
export type FetchEATimeSeriesInput = z.infer<typeof FetchEATimeSeriesInputSchema>;

export interface LogStep {
  message: string;
  status: 'info' | 'success' | 'error' | 'pending';
  details?: string;
}
