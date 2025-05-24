
"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import L, { LatLngExpression, Map as LeafletMap } from 'leaflet';

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

  // Effect for updating map view and marker when selectedCoords prop changes
  useEffect(() => {
    if (mapRef.current && selectedCoords) {
      const currentMapCenter = mapRef.current.getCenter();
      // Check if map needs to be moved significantly, to avoid re-centering on minor float differences
      // or if the marker is not yet at the selectedCoords
      if (
        Math.abs(currentMapCenter.lat - selectedCoords.lat) > 0.00001 ||
        Math.abs(currentMapCenter.lng - selectedCoords.lng) > 0.00001 ||
        !markerPosition || // If no marker, definitely update
        (markerPosition && (Array.isArray(markerPosition) ? markerPosition[0] : markerPosition.lat) !== selectedCoords.lat) ||
        (markerPosition && (Array.isArray(markerPosition) ? markerPosition[1] : markerPosition.lng) !== selectedCoords.lng)
      ) {
        mapRef.current.setView([selectedCoords.lat, selectedCoords.lng], mapRef.current.getZoom());
      }
      setMarkerPosition([selectedCoords.lat, selectedCoords.lng]);
    } else if (mapRef.current && !selectedCoords) {
      // If selectedCoords is cleared, remove the marker
      setMarkerPosition(null);
    }
  }, [selectedCoords, markerPosition]); // Added markerPosition to dependency to ensure marker updates correctly with coords

  // Callback for when the map instance is created
  const handleWhenCreated = useCallback((mapInstance: LeafletMap) => {
    mapRef.current = mapInstance;
    // Set the initial view of the map based on props
    // If selectedCoords are provided, they take precedence for the initial view.
    // Otherwise, use initialCenterProp and initialZoom.
    if (selectedCoords) {
      mapInstance.setView([selectedCoords.lat, selectedCoords.lng], initialZoom);
      setMarkerPosition([selectedCoords.lat, selectedCoords.lng]); // Also set initial marker
    } else {
      mapInstance.setView(initialCenterProp, initialZoom);
    }
  }, [initialCenterProp, initialZoom, selectedCoords]);

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
    return <p className="text-center p-4">Initializing map...</p>;
  }

  return (
    <MapContainer
        // Pass STABLE initial center and zoom to MapContainer.
        // These props should not change due to component's internal state or other props
        // and cause re-initialization.
        center={initialCenterProp}
        zoom={initialZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        whenCreated={handleWhenCreated} // This callback sets the actual initial view
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
