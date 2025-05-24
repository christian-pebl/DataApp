
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngExpression, Map as LeafletMap } from 'leaflet';
import L from 'leaflet';

interface InteractiveMapProps {
  initialCenter?: LatLngExpression;
  initialZoom?: number;
}

export function InteractivePinMap({
  initialCenter: initialCenterProp = [54.5, -3.5], // Default to approx UK center
  initialZoom = 6,
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

  const [map, setMap] = useState<LeafletMap | null>(null);
  const [renderMap, setRenderMap] = useState(false);

  useEffect(() => {
    setRenderMap(true); // Enable map rendering only on the client-side
  }, []);

  // Cleanup map instance when component unmounts or map state changes
  useEffect(() => {
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, [map]);

  const mapContainerRef = useCallback((node: HTMLDivElement | null) => {
    // This callback ref is not strictly necessary with whenCreated, but can be useful for direct DOM access if needed.
  }, []);


  if (!renderMap) {
    return <p className="text-center p-4">Loading map...</p>;
  }

  return (
    <MapContainer
        center={initialCenterProp}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        whenCreated={setMap}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}
