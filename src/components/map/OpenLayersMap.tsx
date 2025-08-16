
"use client";

import React, { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Icon } from 'ol/style';
import 'ol/ol.css'; // Import OpenLayers CSS
import OSM from 'ol/source/OSM'; // Import OSM source

// Default OpenLayers marker icon (often needs a publicly accessible path or to be bundled)
// For simplicity, we'll use a basic style or ensure the default icon has a chance to load.
// If default icons don't work, one might need to host an icon or use a data URL.
// This placeholder is for a common blue marker icon.
const BLUE_MARKER_SVG_DATA_URL = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20width%3D%2232%22%20height%3D%2232%22%3E%3Cpath%20fill%3D%22%23007bff%22%20stroke%3D%22%23ffffff%22%20stroke-width%3D%221%22%20d%3D%22M12%202C8.13%202%205%205.13%205%209c0%205.25%207%2013%207%2013s7-7.75%207-13C19%205.13%2015.87%202%2012%202zm0%209.5c-1.38%200-2.5-1.12-2.5-2.5s1.12-2.5%202.5-2.5%202.5%201.12%202.5%202.5-1.12%202.5-2.5%202.5z%22%2F%3E%3C%2Fsvg%3E";

interface OpenLayersMapProps {
  initialCenter: [number, number]; // [longitude, latitude]
  initialZoom: number;
  selectedCoords?: { lat: number; lon: number } | null;
  onLocationSelect?: (coords: { lat: number; lon: number }) => void;
}

export function OpenLayersMap({
  initialCenter,
  initialZoom,
  selectedCoords,
  onLocationSelect,
}: OpenLayersMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);

  // Initialize map
  useEffect(() => {
    if (mapElementRef.current && !mapRef.current) {
      const source = new VectorSource();
      vectorSourceRef.current = source;

      const vectorLayer = new VectorLayer({
        source: source,
        style: new Style({
          image: new Icon({
            anchor: [0.5, 1], // Anchor at the bottom center of the icon
            src: BLUE_MARKER_SVG_DATA_URL, // Using a data URL for a simple blue marker
            scale: 1,
          }),
        }),
      });

      const olMap = new Map({
        target: mapElementRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
          vectorLayer,
        ],
        view: new View({
          center: fromLonLat(initialCenter),
          zoom: initialZoom,
          // Mobile-friendly constraints
          maxZoom: 18,
          minZoom: 3,
        }),
        // Improve mobile interactions
        controls: [],
        interactions: undefined, // Use default interactions but we'll modify below
      });

      // Enhanced click/touch handling for mobile
      let touchStartTime = 0;
      let isDragging = false;
      
      olMap.on('pointerdown' as any, () => {
        touchStartTime = Date.now();
        isDragging = false;
      });
      
      olMap.on('pointerdrag' as any, () => {
        isDragging = true;
      });
      
      olMap.on('click', (evt) => {
        const touchDuration = Date.now() - touchStartTime;
        // Only trigger location select if it's a quick tap (not a drag) and under 300ms
        if (onLocationSelect && !isDragging && touchDuration < 300) {
          const [lon, lat] = toLonLat(evt.coordinate);
          onLocationSelect({ lat, lon });
        }
      });
      
      mapRef.current = olMap;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined); // Essential for cleanup
        mapRef.current.dispose(); // Dispose of the map instance
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // Update marker when selectedCoords prop changes
  useEffect(() => {
    if (vectorSourceRef.current) {
      vectorSourceRef.current.clear(); // Clear previous markers
      if (selectedCoords) {
        const mapCoords = fromLonLat([selectedCoords.lon, selectedCoords.lat]);
        const marker = new Feature({
          geometry: new Point(mapCoords),
        });
        vectorSourceRef.current.addFeature(marker);
        if (mapRef.current) {
            mapRef.current.getView().animate({ center: mapCoords, duration: 300 });
        }
      }
    }
  }, [selectedCoords]);

  return (
    <div 
      ref={mapElementRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        cursor: 'pointer',
        touchAction: 'none', // Prevent default touch behaviors that might interfere
        userSelect: 'none',   // Prevent text selection on touch
      }} 
      className="relative"
    />
  );
}

export default OpenLayersMap;
