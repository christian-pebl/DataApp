import { useState, useEffect } from 'react';

export interface MapView {
  center: { lat: number; lng: number };
  zoom: number;
}

export const useMapView = (userId: string) => {
  const [view, setViewState] = useState<MapView | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`map-view-${userId}`);
        if (stored) {
          setViewState(JSON.parse(stored));
        } else {
          // Default view
          setViewState({
            center: { lat: 51.7128, lng: -5.0341 }, // Milford Haven
            zoom: 9
          });
        }
      } catch (e) {
        console.error('Error loading map view:', e);
        setViewState({
          center: { lat: 51.7128, lng: -5.0341 },
          zoom: 9
        });
      }
    }
  }, [userId]);

  const setView = (newView: MapView) => {
    setViewState(newView);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`map-view-${userId}`, JSON.stringify(newView));
      } catch (e) {
        console.error('Error saving map view:', e);
      }
    }
  };

  return { view, setView };
};