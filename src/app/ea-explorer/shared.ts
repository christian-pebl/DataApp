
export interface EAStationInfo {
  id: string; // Extracted ID, e.g., "0401" or "E71524"
  name: string;
  lat?: number; // Optional latitude
  lon?: number; // Optional longitude
  notation?: string; // Original station notation if different from ID
  fullUrl?: string; // The full @id URL of the station
}

export interface EAMeasureInfo {
  id: string; // The @id URL of the measure
  parameterName: string; // e.g., "Water Level"
  unitName: string; // e.g., "mAOD" or "m"
  qualifier: string; // e.g., "Stage", "Downstream Stage"
  stationId: string; // The ID of the station this measure belongs to
}
