
"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  const mapRef = useRef<LeafletMap | null>(null);
  const [renderMap, setRenderMap] = useState(false);

  useEffect(() => {
    // Fix for default Leaflet icon paths in Next.js
    // This runs only on the client after mount
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
    setRenderMap(true); // Enable map rendering after icon fix
  }, []); // Empty dependency array: runs once after initial mount

  useEffect(() => {
    // Cleanup map instance when component unmounts
    return () => {
      if (mapRef.current) {
        // Ensure map instance is valid and has remove method
        if (typeof mapRef.current.remove === 'function') {
          mapRef.current.remove();
        }
        mapRef.current = null; // Clear the ref
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  const handleMapCreated = useCallback((mapInstance: LeafletMap) => {
    mapRef.current = mapInstance;
  }, []); // Empty dependency array because mapRef is stable

  if (!renderMap) {
    return <p className="text-center p-4">Loading map...</p>;
  }

  return (
    <MapContainer
        center={initialCenterProp} // Stable initial center for MapContainer
        zoom={initialZoom}         // Stable initial zoom for MapContainer
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        whenCreated={handleMapCreated}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
    </MapContainer>
  );
}
