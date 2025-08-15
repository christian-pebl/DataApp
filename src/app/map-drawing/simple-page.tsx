'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin } from 'lucide-react';

const SimpleLeafletMap = dynamic(() => import('@/components/map/SimpleLeafletMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

type Pin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  timestamp: string;
};

export default function SimpleMapDrawingPage() {
  const { toast } = useToast();
  
  // Simple state
  const [pins, setPins] = useState<Pin[]>([]);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [mapCenter] = useState<[number, number]>([51.7128, -5.0341]);
  const [mapZoom] = useState(9);
  


  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isAddingPin) {
      const newPin: Pin = {
        id: `pin-${Date.now()}`,
        lat,
        lng,
        label: `Pin ${pins.length + 1}`,
        timestamp: new Date().toLocaleString()
      };
      
      setPins(prev => [...prev, newPin]);
      setIsAddingPin(false);
      
      toast({
        title: "Pin Added",
        description: `Pin added at ${lat.toFixed(4)}, ${lng.toFixed(4)}`
      });
    }
  }, [isAddingPin, pins.length, toast]);

  const togglePinMode = useCallback(() => {
    setIsAddingPin(prev => !prev);
    toast({
      title: isAddingPin ? "Pin Mode Disabled" : "Pin Mode Enabled",
      description: isAddingPin ? "Click mode disabled" : "Click on the map to add pins"
    });
  }, [isAddingPin, toast]);

  const clearPins = useCallback(() => {
    setPins([]);
    toast({
      title: "Pins Cleared",
      description: "All pins have been removed"
    });
  }, [toast]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">


      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        <SimpleLeafletMap
          center={mapCenter}
          zoom={mapZoom}
          onMapClick={handleMapClick}
        />
        
        {/* Control Panel */}
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 bg-card border rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold text-sm">Map Drawing Tools</h3>
          <Button
            variant={isAddingPin ? "default" : "outline"}
            size="sm"
            onClick={togglePinMode}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {isAddingPin ? "Cancel Pin" : "Add Pin"}
          </Button>
          <Button variant="outline" size="sm" onClick={clearPins} disabled={pins.length === 0}>
            Clear All ({pins.length})
          </Button>
        </div>

        {/* Instructions */}
        {isAddingPin && (
          <div className="absolute top-4 right-4 z-[1000] bg-card border rounded-lg p-4 shadow-lg max-w-xs">
            <h3 className="font-semibold mb-2">Add Pin Mode</h3>
            <p className="text-sm text-muted-foreground">
              Click anywhere on the map to place a pin. Click "Cancel Pin" to exit this mode.
            </p>
          </div>
        )}

        {/* Pin List */}
        {pins.length > 0 && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-card border rounded-lg p-4 shadow-lg max-w-xs max-h-64 overflow-y-auto">
            <h3 className="font-semibold mb-2">Pins ({pins.length})</h3>
            <div className="space-y-2">
              {pins.map((pin) => (
                <div key={pin.id} className="text-xs border-b pb-2">
                  <div className="font-medium">{pin.label}</div>
                  <div className="text-muted-foreground">
                    {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
                  </div>
                  <div className="text-muted-foreground">{pin.timestamp}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}