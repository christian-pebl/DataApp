
"use client";

import React, { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import 'ol/ol.css'; // Import OpenLayers CSS

interface OpenLayersMapProps {
  initialCenter: [number, number]; // [longitude, latitude]
  initialZoom: number;
}

export function OpenLayersMap({ initialCenter, initialZoom }: OpenLayersMapProps) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (mapElementRef.current && !mapRef.current) {
      const map = new Map({
        target: mapElementRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: fromLonLat(initialCenter), // Convert lon/lat to map's projection
          zoom: initialZoom,
        }),
      });
      mapRef.current = map;
    }

    // Cleanup function to dispose of the map when the component unmounts
    return () => {
      if (mapRef.current) {
        mapRef.current.setTarget(undefined);
        mapRef.current = null;
      }
    };
  }, [initialCenter, initialZoom]); // Re-run effect if initialCenter or initialZoom change

  return <div ref={mapElementRef} style={{ width: '100%', height: '100%' }} />;
}

export default OpenLayersMap;
