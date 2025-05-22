
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react'; // Added useCallback
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
  const [renderMap, setRenderMap] = useState(false);

  const initialCenter: [number, number] = React.useMemo(() => {
    return selectedCoords
      ? [selectedCoords.lat, selectedCoords.lon]
      : [37.7749, -122.4194]; // Default to SF
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    setRenderMap(true);
  }, []);

  useEffect(() => {
    if (renderMap && selectedCoords && mapRef.current) {
      const newPos: [number, number] = [selectedCoords.lat, selectedCoords.lon];
      const currentMapCenter = mapRef.current.getCenter();

      if (currentMapCenter.lat.toFixed(5) !== newPos[0].toFixed(5) ||
          currentMapCenter.lng.toFixed(5) !== newPos[1].toFixed(5)) {
        mapRef.current.setView(newPos, mapRef.current.getZoom());
      }
    }
  }, [selectedCoords, renderMap]);

  const handleWhenCreated = useCallback((mapInstance: L.Map) => {
    mapRef.current = mapInstance;
  }, []); // Empty dependency array, so this function identity is stable.

  if (!renderMap) {
    return <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground"><p>Initializing map...</p></div>;
  }

  return (
    <MapContainer
        center={initialCenter}
        zoom={10}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        whenCreated={handleWhenCreated} // Use memoized callback
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
