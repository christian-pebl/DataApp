
"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import L, { LatLngExpression, Map as LeafletMap } from 'leaflet'; // Renamed Map to LeafletMap to avoid conflict

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
  // Fix for default Leaflet icon paths in Next.js - MOVED INSIDE THE COMPONENT
  useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  const mapRef = useRef<LeafletMap | null>(null);
  const [markerPosition, setMarkerPosition] = useState<LatLngExpression | null>(null);
  const [renderMap, setRenderMap] = useState(false);

  useEffect(() => {
    setRenderMap(true); // Enable map rendering only on the client-side
  }, []);

  const initialCenter = React.useMemo(() => {
    return selectedCoords ? [selectedCoords.lat, selectedCoords.lng] : initialCenterProp;
  }, [selectedCoords, initialCenterProp]);

  useEffect(() => {
    if (mapRef.current && selectedCoords) {
      const currentCenter = mapRef.current.getCenter();
      const currentZoom = mapRef.current.getZoom();
      // Only call setView if the coordinates actually changed significantly
      // to avoid potential loops with parent component updates
      if (currentCenter.lat.toFixed(5) !== selectedCoords.lat.toFixed(5) || 
          currentCenter.lng.toFixed(5) !== selectedCoords.lng.toFixed(5)) {
        mapRef.current.setView([selectedCoords.lat, selectedCoords.lng], currentZoom);
      }
      setMarkerPosition([selectedCoords.lat, selectedCoords.lng]);
    } else if (!selectedCoords) {
        setMarkerPosition(null);
    }
  }, [selectedCoords]);
  
  const handleWhenCreated = useCallback((mapInstance: LeafletMap) => {
    mapRef.current = mapInstance;
    if (selectedCoords) {
      mapInstance.setView([selectedCoords.lat, selectedCoords.lng], initialZoom);
    } else {
      mapInstance.setView(initialCenterProp, initialZoom);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialZoom, selectedCoords, initialCenterProp]); // Added initialCenterProp

  // Cleanup map instance on component unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!renderMap) {
    return <p className="text-center p-4">Initializing map...</p>; // Or some placeholder
  }

  return (
    <MapContainer
        center={initialCenter} // Use the memoized initialCenter
        zoom={initialZoom} // Use prop initialZoom
        scrollWheelZoom={true} // Enabled scroll wheel zoom as it's common
        style={{ height: '100%', width: '100%' }}
        whenCreated={handleWhenCreated}
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
