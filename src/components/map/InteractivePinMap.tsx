
"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';

interface InteractiveMapProps {
  initialCenter?: LatLngExpression;
  initialZoom?: number;
  onLocationSelect: (coords: { lat: number; lng: number }) => void;
  selectedCoords?: { lat: number; lng: number } | null;
}

const MapClickHandler = ({ onLocationSelect }: { onLocationSelect: (coords: { lat: number; lng: number }) => void }) => {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

export function InteractivePinMap({
  initialCenter: initialCenterProp = [54.5, -3.5], // Default to approx UK center
  initialZoom = 6,
  onLocationSelect,
  selectedCoords,
}: InteractiveMapProps) {
  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const [map, setMap] = useState<LeafletMap | null>(null); // State to hold the map instance
  const [markerPosition, setMarkerPosition] = useState<LatLngExpression | null>(null);
  const [renderMap, setRenderMap] = useState(false);

  useEffect(() => {
    setRenderMap(true); // Enable map rendering only on the client-side
  }, []);

  // Effect for view and marker updates based on selectedCoords
  useEffect(() => {
    if (map) { // Only proceed if map instance exists
      if (selectedCoords) {
        const currentMapCenter = map.getCenter();
        // Only call setView if coords have meaningfully changed
        if (
          Math.abs(currentMapCenter.lat - selectedCoords.lat) > 0.00001 ||
          Math.abs(currentMapCenter.lng - selectedCoords.lng) > 0.00001
        ) {
          map.setView([selectedCoords.lat, selectedCoords.lng], map.getZoom()); // Preserve current zoom
        }
        setMarkerPosition([selectedCoords.lat, selectedCoords.lng]);
      } else {
        setMarkerPosition(null);
        // Optional: if selectedCoords are cleared, reset map to initialCenterProp
        // map.setView(initialCenterProp, initialZoom);
      }
    }
  }, [map, selectedCoords, initialCenterProp, initialZoom]); // initialCenterProp/initialZoom for potential reset logic

  // Cleanup map instance when component unmounts or map state changes
  useEffect(() => {
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [map]); // This effect runs if the `map` state variable itself changes (e.g., on unmount)

  const mapContainerRef = useCallback((node: HTMLDivElement | null) => {
    // This callback ref is not strictly necessary with whenCreated, but can be useful for direct DOM access if needed.
    // For now, we'll rely on whenCreated.
  }, []);


  if (!renderMap) {
    return <p className="text-center p-4">Loading map...</p>;
  }

  return (
    <MapContainer
        center={initialCenterProp} // Stable initial center for MapContainer
        zoom={initialZoom}         // Stable initial zoom for MapContainer
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        whenCreated={setMap} // Set the map instance to state when it's created
        // The 'ref' prop on MapContainer can also be used with a callback for the map instance,
        // but whenCreated is specific to react-leaflet for this purpose.
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onLocationSelect={onLocationSelect} />
      {markerPosition && (
        <Marker position={markerPosition}>
          <Popup>
            Lat: {Array.isArray(markerPosition) ? markerPosition[0].toFixed(5) : markerPosition.lat.toFixed(5)}, Lng: {Array.isArray(markerPosition) ? markerPosition[1].toFixed(5) : markerPosition.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
