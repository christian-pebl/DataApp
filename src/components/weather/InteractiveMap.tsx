
"use client";

import React from 'react';
import { MapPin } from 'lucide-react';

interface InteractiveMapProps {
  onLocationSelect: (coords: { lat: number; lon: number }) => void;
}

// Sample coordinates (e.g., San Francisco, CA)
const sampleCoordinates = { lat: 37.7749, lon: -122.4194 };

export function InteractiveMap({ onLocationSelect }: InteractiveMapProps) {
  const handleClick = () => {
    onLocationSelect(sampleCoordinates);
  };

  return (
    <div
      onClick={handleClick}
      className="w-full h-full bg-muted/50 border border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? handleClick() : null}
      aria-label="Click to select a sample location on the map"
    >
      <MapPin className="h-12 w-12 text-primary/70 mb-2" />
      <p className="text-sm text-foreground/80">Click to Set Sample Location</p>
      <p className="text-xs text-muted-foreground mt-1">(Interactive map placeholder)</p>
    </div>
  );
}
