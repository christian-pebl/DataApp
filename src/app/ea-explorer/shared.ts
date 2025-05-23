
export interface EAStationInfo {
  id: string; // Extracted ID, e.g., "0401" or "E71524"
  name: string;
  lat?: number; // Optional latitude
  lon?: number; // Optional longitude
  notation?: string; // Original station notation if different from ID
  fullUrl?: string; // The full @id URL of the station
}

export interface EAMeasureInfo {
  id: string; // The @id URL of the measure, e.g., "http://environment.data.gov.uk/flood-monitoring/id/measures/0401-level-stage-i-15_min-mASD"
  parameterName: string; // e.g., "Water Level"
  unitName: string; // e.g., "mAOD" or "m"
  qualifier: string; // e.g., "Stage", "Downstream Stage"
  stationId: string; // The ID of the station this measure belongs to
}

export interface EATimeSeriesDataPoint {
  time: string; // ISO timestamp
  value: number;
}

// Input for fetching time series data
export interface FetchEATimeSeriesInput {
  measureId: string; // The full @id URL of the measure
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
}
