
"use client";

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet'; // Import Leaflet library for icon customization

interface InteractiveMapProps {
  onLocationSelect: (coords: { lat: number; lon: number }) => void;
  selectedCoords?: { lat: number; lon: number } | null;
}

// Fix for default Leaflet icon issue with Webpack/Next.js
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MapEventsHandler = ({ onLocationSelect }: { onLocationSelect: InteractiveMapProps['onLocationSelect'] }) => {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
};

export function InteractiveMap({ onLocationSelect, selectedCoords }: InteractiveMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [position, setPosition] = React.useState<[number, number]>(
    selectedCoords ? [selectedCoords.lat, selectedCoords.lon] : [37.7749, -122.4194] // Default to SF or selected
  );

  useEffect(() => {
    if (selectedCoords) {
      const newPos: [number, number] = [selectedCoords.lat, selectedCoords.lon];
      setPosition(newPos);
      if (mapRef.current) {
        mapRef.current.setView(newPos, mapRef.current.getZoom());
      }
    }
  }, [selectedCoords]);


  return (
    <MapContainer 
        center={position} 
        zoom={10} 
        scrollWheelZoom={false} 
        style={{ height: '100%', width: '100%' }}
        whenCreated={mapInstance => { mapRef.current = mapInstance; }}
        className='rounded-md'
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEventsHandler onLocationSelect={onLocationSelect} />
      {selectedCoords && (
        <Marker position={[selectedCoords.lat, selectedCoords.lon]}>
          <Popup>
            Selected: <br /> Lat: {selectedCoords.lat.toFixed(4)}, Lon: {selectedCoords.lon.toFixed(4)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
