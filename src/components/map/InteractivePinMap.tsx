
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import L, { LatLngExpression, Map } from 'leaflet';

// Fix for default Leaflet icon paths in Next.js
useEffect(() => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
}, []);


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
  initialCenter = [51.505, -0.09], // Default to London
  initialZoom = 6,
  onLocationSelect,
  selectedCoords,
}: InteractiveMapProps) {
  const mapRef = useRef<Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState<LatLngExpression | null>(null);

  useEffect(() => {
    if (selectedCoords) {
      const newPos: LatLngExpression = [selectedCoords.lat, selectedCoords.lng];
      setMarkerPosition(newPos);
      if (mapRef.current) {
        mapRef.current.setView(newPos, mapRef.current.getZoom());
      }
    } else {
      setMarkerPosition(null);
    }
  }, [selectedCoords]);

  const handleMapCreated = (mapInstance: Map) => {
    mapRef.current = mapInstance;
     if (selectedCoords) {
        mapInstance.setView([selectedCoords.lat, selectedCoords.lng], initialZoom);
     } else if (initialCenter) {
        mapInstance.setView(initialCenter, initialZoom);
     }
  };


  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
      whenCreated={handleMapCreated}
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
