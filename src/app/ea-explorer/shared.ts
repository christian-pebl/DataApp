
export interface EAStationInfo {
  id: string; // Extracted ID, e.g., "0401" or "E71524"
  name: string;
  lat?: number; // Optional latitude
  lon?: number; // Optional longitude
  notation?: string; // Original station notation if different from ID
  fullUrl?: string; // The full @id URL of the station
}
