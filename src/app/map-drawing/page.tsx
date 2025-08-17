'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Minus, Square, Home, RotateCcw, Save, Trash2, Navigation, Settings, Plus, Minus as MinusIcon, ZoomIn, ZoomOut, Map, Crosshair, FolderOpen, Bookmark, Eye, EyeOff, Target } from 'lucide-react';

import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMapView } from '@/hooks/use-map-view';
import { useSettings } from '@/hooks/use-settings';
import { useMapData } from '@/hooks/use-map-data';
// Define types locally to avoid SSR issues with Leaflet
interface LatLng {
  lat: number;
  lng: number;
}

interface LeafletMouseEvent {
  latlng: LatLng;
  originalEvent: MouseEvent;
}

interface LeafletMap {
  setView: (center: [number, number], zoom: number, options?: any) => void;
  getCenter: () => LatLng;
  getZoom: () => number;
  zoomIn: () => void;
  zoomOut: () => void;
  invalidateSize: () => void;
  closePopup: () => void;
  eachLayer: (fn: (layer: any) => void) => void;
}

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap').then(mod => ({ default: mod.default })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted flex items-center justify-center min-h-[500px]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    </div>
  ),
});

import { Project, Tag, Pin, Line, Area } from '@/lib/supabase/types';

type DrawingMode = 'none' | 'pin' | 'line' | 'area';

// Predefined project locations from DataApp
const PROJECT_LOCATIONS = {
  milfordhaven: { name: "Milford Haven", lat: 51.7128, lon: -5.0341 },
  ramseysound: { name: "Ramsey Sound", lat: 51.871645, lon: -5.313960 },
  bidefordbay: { name: "Bideford Bay", lat: 51.052156, lon: -4.405961 },
  blakeneyoverfalls: { name: "Blakeney Overfalls", lat: 53.028671, lon: 0.939562 },
  pabayinnersound: { name: "Pabay Inner Sound", lat: 57.264780, lon: -5.853793 },
  lochbay: { name: "Loch Bay", lat: 57.506498, lon: -6.620397 },
  lochsunart: { name: "Loch Sunart", lat: 56.666195, lon: -5.917401 },
};

export default function MapDrawingPage() {
  const { view, setView } = useMapView('dev-user');
  const { settings, setSettings } = useSettings();
  const { toast } = useToast();

  
  // Use the integrated map data hook
  const {
    projects,
    tags,
    pins,
    lines,
    areas,
    isLoading: isDataLoading,
    isOnline,
    isAuthenticated,
    lastSyncTime,
    createPin: createPinData,
    updatePin: updatePinData,
    deletePin: deletePinData,
    createLine: createLineData,
    updateLine: updateLineData,
    deleteLine: deleteLineData,
    createArea: createAreaData,
    updateArea: updateAreaData,
    deleteArea: deleteAreaData,
    clearAll: clearAllData,
    forceSync,
    migrateToDatabase
  } = useMapData({ projectId: 'default', enableSync: false });
  
  // Map state
  const mapRef = useRef<LeafletMap | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);
  
  // Project management state
  const [projectVisibility, setProjectVisibility] = useState<Record<string, boolean>>(() => {
    // Initialize all projects as visible
    return Object.keys(PROJECT_LOCATIONS).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
  });
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    // Set the first project (milfordhaven) as default active
    return Object.keys(PROJECT_LOCATIONS)[0] || 'milfordhaven';
  });
  
  // Drawing state
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [isDrawingLine, setIsDrawingLine] = useState(false);
  const [lineStartPoint, setLineStartPoint] = useState<LatLng | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<LatLng | null>(null);
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [pendingAreaPath, setPendingAreaPath] = useState<LatLng[]>([]);
  const [areaStartPoint, setAreaStartPoint] = useState<LatLng | null>(null);
  const [currentAreaEndPoint, setCurrentAreaEndPoint] = useState<LatLng | null>(null);
  
  // Pending items (waiting for user input)
  const [pendingPin, setPendingPin] = useState<LatLng | null>(null);
  const [pendingLine, setPendingLine] = useState<{ path: LatLng[] } | null>(null);
  const [pendingArea, setPendingArea] = useState<{ path: LatLng[] } | null>(null);
  
  // Refs to prevent duplicate operations
  const lineConfirmInProgressRef = useRef<boolean>(false);

  // Check GPS permission status on mount
  useEffect(() => {
    const checkLocationPermission = async () => {
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPermission(permission.state);
          
          // Listen for permission changes
          permission.addEventListener('change', () => {
            setLocationPermission(permission.state);
          });
        } catch (error) {
          console.log('Permissions API not supported, will use geolocation directly');
          setLocationPermission('unknown');
        }
      } else {
        setLocationPermission('unknown');
      }
    };

    checkLocationPermission();
  }, []);
  
  const [itemToEdit, setItemToEdit] = useState<Pin | Line | Area | null>(null);
  const [editingGeometry, setEditingGeometry] = useState<Line | Area | null>(null);
  
  

  
  
  // Show migration prompt for existing localStorage data
  const [showMigrationPrompt, setShowMigrationPrompt] = useState(false);
  
  // Check for existing localStorage data on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && isAuthenticated) {
      const hasLocalData = 
        localStorage.getItem('map-drawing-pins') ||
        localStorage.getItem('map-drawing-lines') ||
        localStorage.getItem('map-drawing-areas');
      
      if (hasLocalData && pins.length === 0 && lines.length === 0 && areas.length === 0) {
        setShowMigrationPrompt(true);
      }
    }
  }, [isAuthenticated, pins.length, lines.length, areas.length]);
  
  const handleMigration = async () => {
    const success = await migrateToDatabase();
    if (success) {
      setShowMigrationPrompt(false);
    }
  };



  const handleLocationFound = useCallback((latlng: LatLng) => {
    setCurrentLocation(latlng);
  }, []);

  const handleLocationError = useCallback((error: any) => {
    console.error('Location error:', error);
    toast({
      variant: "destructive",
      title: "Location Error",
      description: "Could not get your current location."
    });
  }, [toast]);

  // Map move handler for line and area drawing - use ref to avoid stale closures
  const mapMoveHandlerRef = useRef<(center: LatLng, zoom: number) => void>();
  
  // Update the handler ref whenever dependencies change
  mapMoveHandlerRef.current = (center: LatLng, zoom: number) => {
    // Update view in useMapView hook
    setView({ center, zoom });
    
    // Update crosshair position for line drawing
    if (isDrawingLine && lineStartPoint) {
      setCurrentMousePosition(center);
    }
    
    // Update crosshair position for area drawing
    if (isDrawingArea && areaStartPoint) {
      setCurrentAreaEndPoint(center);
    }
  };
  
  // Stable callback that calls the current handler
  const handleMapMove = useCallback((center: LatLng, zoom: number) => {
    mapMoveHandlerRef.current?.(center, zoom);
  }, []);

  const handleMapClick = useCallback((e: LeafletMouseEvent) => {
    // Pin dropping, line drawing, and area drawing are now handled by button clicks, not map click
  }, [drawingMode, isDrawingLine, lineStartPoint, isDrawingArea, pendingAreaPath]);

  const handleMapMouseMove = useCallback((e: LeafletMouseEvent) => {
    // Mouse move disabled for line drawing - we only want drag/pan to update the line
    // Line updates are handled by handleMapMove when the map center changes
  }, []);

  const handlePinSave = useCallback(async (id: string, label: string, lat: number, lng: number, notes: string, tagId?: string) => {
    const pinData = {
      lat,
      lng,
      label,
      notes,
      projectId: activeProjectId,
      tagIds: tagId ? [tagId] : [],
      labelVisible: true
    };
    
    try {
      await createPinData(pinData);
      setPendingPin(null);
      toast({
        title: "Pin Created",
        description: `Pin "${label}" has been added to the map.`
      });
    } catch (error) {
      console.error('Error creating pin:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create pin. Please try again."
      });
    }
  }, [createPinData, activeProjectId, toast]);

  const handlePinCancel = useCallback(() => {
    setPendingPin(null);
  }, []);

  const handleLineSave = useCallback(async (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => {
    console.log('🎯 STEP 7: handleLineSave called', {
      id,
      label,
      pathLength: path.length,
      timestamp: Date.now(),
      callStack: new Error().stack?.split('\n')[1]?.trim()
    });
    
    const lineData = {
      label,
      path: path.map(p => ({ lat: p.lat, lng: p.lng })),
      notes,
      projectId: activeProjectId,
      tagIds: tagId ? [tagId] : [],
      labelVisible: true
    };
    
    try {
      console.log('🎯 STEP 8: Calling createLineData');
      await createLineData(lineData);
      console.log('🎯 STEP 9: Line created successfully, clearing pendingLine');
      setPendingLine(null);
      lineConfirmInProgressRef.current = false; // Reset the flag
    } catch (error) {
      console.error('Error creating line:', error);
      lineConfirmInProgressRef.current = false; // Reset the flag on error too
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create line. Please try again."
      });
    }
  }, [createLineData, activeProjectId, toast]);

  const handleLineCancel = useCallback(() => {
    setPendingLine(null);
    lineConfirmInProgressRef.current = false; // Reset the flag
  }, []);

  const handleAreaSave = useCallback(async (id: string, label: string, path: LatLng[], notes: string, tagId?: string) => {
    const areaData = {
      label,
      path: path.map(p => ({ lat: p.lat, lng: p.lng })),
      notes,
      projectId: activeProjectId,
      tagIds: tagId ? [tagId] : [],
      labelVisible: true,
      fillVisible: true
    };
    
    try {
      await createAreaData(areaData);
      setPendingArea(null);
    } catch (error) {
      console.error('Error creating area:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create area. Please try again."
      });
    }
  }, [createAreaData, activeProjectId, toast]);

  const handleAreaCancel = useCallback(() => {
    setPendingArea(null);
  }, []);

  // Line drawing helpers
  const handleLineConfirm = useCallback(() => {
    console.log('🎯 STEP 1: handleLineConfirm called', {
      lineStartPoint: !!lineStartPoint,
      currentMousePosition: !!currentMousePosition,
      pendingLine: !!pendingLine,
      lineConfirmInProgress: lineConfirmInProgressRef.current,
      timestamp: Date.now(),
      callStack: new Error().stack?.split('\n')[1]?.trim()
    });
    
    // Prevent duplicate calls
    if (lineConfirmInProgressRef.current) {
      console.log('❌ handleLineConfirm blocked - already in progress');
      return;
    }
    
    if (lineStartPoint && currentMousePosition && !pendingLine) {
      console.log('🎯 STEP 2: Setting pendingLine');
      lineConfirmInProgressRef.current = true;
      setPendingLine({ path: [lineStartPoint, currentMousePosition] });
      setIsDrawingLine(false);
      setLineStartPoint(null);
      setCurrentMousePosition(null);
      setDrawingMode('none');
      
      // Reset the flag after a short delay to allow the popup to be created
      setTimeout(() => {
        lineConfirmInProgressRef.current = false;
      }, 1000);
    } else {
      console.log('❌ handleLineConfirm blocked - conditions not met', {
        hasLineStartPoint: !!lineStartPoint,
        hasCurrentMousePosition: !!currentMousePosition,
        hasPendingLine: !!pendingLine
      });
    }
  }, [lineStartPoint, currentMousePosition, pendingLine]);

  const handleLineCancelDrawing = useCallback(() => {
    setIsDrawingLine(false);
    setLineStartPoint(null);
    setCurrentMousePosition(null);
    setDrawingMode('none');
  }, []);

  // Area drawing helpers
  const handleAreaStart = useCallback(() => {
    if (mapRef.current) {
      const mapCenter = mapRef.current.getCenter();
      setAreaStartPoint(mapCenter);
      setCurrentAreaEndPoint(mapCenter);
      setPendingAreaPath([mapCenter]);
      setIsDrawingArea(true);
      setDrawingMode('area');
    }
  }, []);

  const handleAreaAddCorner = useCallback(() => {
    if (currentAreaEndPoint && areaStartPoint) {
      const newPath = [...pendingAreaPath, currentAreaEndPoint];
      setPendingAreaPath(newPath);
      setAreaStartPoint(currentAreaEndPoint);
      setCurrentAreaEndPoint(currentAreaEndPoint);
    }
  }, [currentAreaEndPoint, areaStartPoint, pendingAreaPath]);

  const handleAreaFinish = useCallback(() => {
    if (pendingAreaPath.length >= 3) {
      setPendingArea({ path: pendingAreaPath });
      setIsDrawingArea(false);
      setAreaStartPoint(null);
      setCurrentAreaEndPoint(null);
      setPendingAreaPath([]);
      setDrawingMode('none');
    }
  }, [pendingAreaPath]);

  const handleAreaCancelDrawing = useCallback(() => {
    setIsDrawingArea(false);
    setAreaStartPoint(null);
    setCurrentAreaEndPoint(null);
    setPendingAreaPath([]);
    setDrawingMode('none');
  }, []);

  // Update/Delete handlers
  const handleUpdatePin = useCallback(async (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => {
    try {
      await updatePinData(id, { label, notes, projectId, tagIds });
      toast({ title: "Pin Updated", description: "Pin has been updated successfully." });
    } catch (error) {
      console.error('Error updating pin:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to update pin. Please try again." 
      });
    }
  }, [updatePinData, toast]);

  const handleDeletePin = useCallback(async (id: string) => {
    try {
      await deletePinData(id);
      toast({ title: "Pin Deleted", description: "Pin has been deleted from the map." });
    } catch (error) {
      console.error('Error deleting pin:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to delete pin. Please try again." 
      });
    }
  }, [deletePinData, toast]);

  const handleUpdateLine = async (id: string, label: string, notes: string, projectId?: string, tagIds?: string[]) => {
    try {
      await updateLineData(id, { label, notes, projectId, tagIds });
      toast({ title: "Line Updated", description: "Line has been updated successfully." });
    } catch (error) {
      console.error('Error updating line:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to update line. Please try again." 
      });
    }
  };

  const handleDeleteLine = async (id: string) => {
    try {
      await deleteLineData(id);
      toast({ title: "Line Deleted", description: "Line has been deleted from the map." });
    } catch (error) {
      console.error('Error deleting line:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to delete line. Please try again." 
      });
    }
  };

  const handleUpdateArea = async (id: string, label: string, notes: string, path: {lat: number, lng: number}[], projectId?: string, tagIds?: string[]) => {
    try {
      await updateAreaData(id, { label, notes, path, projectId, tagIds });
      toast({ title: "Area Updated", description: "Area has been updated successfully." });
    } catch (error) {
      console.error('Error updating area:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to update area. Please try again." 
      });
    }
  };

  const handleDeleteArea = async (id: string) => {
    try {
      await deleteAreaData(id);
      toast({ title: "Area Deleted", description: "Area has been deleted from the map." });
    } catch (error) {
      console.error('Error deleting area:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to delete area. Please try again." 
      });
    }
  };

  const handleToggleLabel = async (id: string, type: 'pin' | 'line' | 'area') => {
    try {
      if (type === 'pin') {
        const pin = pins.find(p => p.id === id);
        if (pin) {
          await updatePinData(id, { labelVisible: !pin.labelVisible });
        }
      } else if (type === 'line') {
        const line = lines.find(l => l.id === id);
        if (line) {
          await updateLineData(id, { labelVisible: !line.labelVisible });
        }
      } else if (type === 'area') {
        const area = areas.find(a => a.id === id);
        if (area) {
          await updateAreaData(id, { labelVisible: !area.labelVisible });
        }
      }
    } catch (error) {
      console.error('Error toggling label:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to toggle label visibility." 
      });
    }
  };

  const handleToggleFill = async (id: string) => {
    try {
      const area = areas.find(a => a.id === id);
      if (area) {
        await updateAreaData(id, { fillVisible: !area.fillVisible });
      }
    } catch (error) {
      console.error('Error toggling fill:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to toggle fill visibility." 
      });
    }
  };

  const clearAll = async () => {
    try {
      await clearAllData();
    } catch (error) {
      console.error('Error clearing data:', error);
      toast({ 
        variant: "destructive",
        title: "Error", 
        description: "Failed to clear all data." 
      });
    }
  };

  const centerOnCurrentLocation = useCallback(async () => {
    if (!mapRef.current) {
      toast({
        variant: "destructive",
        title: "Map Not Ready",
        description: "Map is not yet initialized."
      });
      return;
    }

    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "GPS Not Supported",
        description: "Your browser doesn't support GPS location."
      });
      return;
    }

    console.log('🗺️ GPS Request:', {
      currentPermission: locationPermission,
      timestamp: new Date().toISOString()
    });

    setIsGettingLocation(true);

    // First, explicitly check if we need to request permission
    if (locationPermission === 'denied') {
      setIsGettingLocation(false);
      toast({
        variant: "destructive",
        title: "Location Permission Denied",
        description: "Please enable location access in your browser settings and refresh the page."
      });
      return;
    }

    // Request location with detailed logging
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        
        console.log('📍 GPS Success:', {
          latitude,
          longitude,
          accuracy,
          timestamp: new Date().toISOString()
        });

        const newLocation = { lat: latitude, lng: longitude } as LatLng;
        setCurrentLocation(newLocation);
        
        if (mapRef.current) {
          // Center on actual GPS location with higher zoom
          mapRef.current.setView([latitude, longitude], 16);
          toast({
            title: "Location Found",
            description: `Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`,
            duration: 3000
          });
        }
        setIsGettingLocation(false);
        
        // Update permission state after successful location
        setLocationPermission('granted');
      },
      (error) => {
        setIsGettingLocation(false);
        
        console.error('🚫 GPS Error:', {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });

        let errorMessage = "Could not get your location.";
        let titleMessage = "Location Error";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationPermission('denied');
            titleMessage = "Permission Denied";
            errorMessage = "Location access was denied. Please enable location permissions in your browser and try again.";
            break;
          case error.POSITION_UNAVAILABLE:
            titleMessage = "Location Unavailable";
            errorMessage = "Your location information is unavailable. Make sure GPS is enabled on your device.";
            break;
          case error.TIMEOUT:
            titleMessage = "Location Timeout";
            errorMessage = "Location request timed out. Please try again.";
            break;
        }
        
        toast({
          variant: "destructive",
          title: titleMessage,
          description: errorMessage,
          duration: 5000
        });

        // Show instructions for enabling location
        if (error.code === error.PERMISSION_DENIED) {
          setTimeout(() => {
            toast({
              title: "How to Enable Location",
              description: "Click the location icon in your browser's address bar, or check browser settings > Privacy & Security > Location.",
              duration: 8000
            });
          }, 2000);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000 // Shorter cache to get fresher location
      }
    );
  }, [toast, locationPermission]);

  const zoomIn = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  }, []);

  const zoomOut = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  }, []);

  const goToProjectLocation = useCallback((locationKey: string) => {
    const location = PROJECT_LOCATIONS[locationKey as keyof typeof PROJECT_LOCATIONS];
    if (location && mapRef.current) {
      mapRef.current.setView([location.lat, location.lon], 12);
      setShowProjectsDialog(false);
      toast({
        title: `Navigated to ${location.name}`,
        description: `Lat: ${location.lat.toFixed(6)}, Lng: ${location.lon.toFixed(6)}`,
        duration: 3000
      });
    }
  }, [toast]);

  // Project management handlers
  const toggleProjectVisibility = useCallback((projectKey: string) => {
    setProjectVisibility(prev => ({
      ...prev,
      [projectKey]: !prev[projectKey]
    }));
  }, []);

  const setActiveProject = useCallback((projectKey: string) => {
    setActiveProjectId(projectKey);
    toast({
      title: "Active Project Changed",
      description: `${PROJECT_LOCATIONS[projectKey as keyof typeof PROJECT_LOCATIONS]?.name} is now the active project`,
      duration: 3000
    });
  }, [toast]);





  if (!view || !settings) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading app...</p>
        </div>
      </div>
    );
  }
  
  if (isDataLoading) {
    return (
      <div className="w-full h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading map data...</p>
          {!isOnline && (
            <p className="text-xs text-amber-600 mt-1">Offline - Using local data</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>










                    


      {/* Map Container - Account for top navigation height (h-14 = 3.5rem) */}
      <main className="relative overflow-hidden bg-background text-foreground" style={{ height: 'calc(100vh - 3.5rem)' }}>
        <div className="h-full w-full relative" style={{ minHeight: '500px', cursor: drawingMode === 'none' ? 'default' : 'crosshair' }}>
          
          {/* Always-visible smaller crosshairs */}
          <div className="absolute inset-0 pointer-events-none z-[999]">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                {/* Horizontal lines with gap */}
                <div className="absolute top-1/2 left-1/2 w-2 h-px bg-blue-500 transform -translate-x-full -translate-y-1/2" style={{ marginLeft: '-3px' }}></div>
                <div className="absolute top-1/2 left-1/2 w-2 h-px bg-blue-500 transform -translate-y-1/2" style={{ marginLeft: '3px' }}></div>
                {/* Vertical lines with gap */}
                <div className="absolute top-1/2 left-1/2 w-px h-2 bg-blue-500 transform -translate-x-1/2 -translate-y-full" style={{ marginTop: '-3px' }}></div>
                <div className="absolute top-1/2 left-1/2 w-px h-2 bg-blue-500 transform -translate-x-1/2" style={{ marginTop: '3px' }}></div>
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 border border-blue-500 rounded-full bg-transparent transform -translate-x-1/2 -translate-y-1/2"></div>
              </div>
            </div>
          </div>
          
          <LeafletMap
            mapRef={mapRef}
            center={[view.center.lat, view.center.lng]}
            zoom={view.zoom}
            pins={pins}
            lines={lines}
            areas={areas}
            projects={projects}
            tags={tags}
            settings={settings}
            currentLocation={null}
            onLocationFound={() => {}}
            onLocationError={() => {}}
            onMove={handleMapMove}
            isDrawingLine={isDrawingLine}
            lineStartPoint={lineStartPoint}
            currentMousePosition={currentMousePosition}
            isDrawingArea={isDrawingArea}
            onMapClick={handleMapClick}
            onMapMouseMove={handleMapMouseMove}
            pendingAreaPath={pendingAreaPath}
            areaStartPoint={areaStartPoint}
            currentAreaEndPoint={currentAreaEndPoint}
            pendingPin={pendingPin}
            onPinSave={handlePinSave}
            onPinCancel={handlePinCancel}
            pendingLine={pendingLine}
            onLineSave={handleLineSave}
            onLineCancel={handleLineCancel}
            pendingArea={pendingArea}
            onAreaSave={handleAreaSave}
            onAreaCancel={handleAreaCancel}
            onUpdatePin={handleUpdatePin}
            onDeletePin={handleDeletePin}
            onUpdateLine={handleUpdateLine}
            onDeleteLine={handleDeleteLine}
            onUpdateArea={handleUpdateArea}
            onDeleteArea={handleDeleteArea}
            onToggleLabel={handleToggleLabel}
            onToggleFill={handleToggleFill}
            itemToEdit={itemToEdit}
            onEditItem={setItemToEdit}
            activeProjectId={activeProjectId}
            projectVisibility={projectVisibility}
            editingGeometry={editingGeometry}
            onEditGeometry={setEditingGeometry}
            onUpdateGeometry={(itemId, newPath) => {}}
          />
          
          {/* Drawing Tools */}
          <div className="absolute top-8 left-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              {/* Projects Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={() => setShowProjectsDialog(true)}
                    className="h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  >
                    <FolderOpen className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Project Locations</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    className={`h-10 w-10 rounded-full shadow-lg text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
                      drawingMode === 'pin' ? 'bg-accent/90 hover:bg-accent' : 'bg-primary/90 hover:bg-primary'
                    }`}
                    onClick={() => {
                      if (mapRef.current) {
                        // Get the center of the map (where crosshairs are)
                        const mapCenter = mapRef.current.getCenter();
                        console.log('📍 Pin button clicked, dropping pin at center:', mapCenter);
                        
                        // Drop pin immediately at crosshair location
                        setPendingPin(mapCenter);
                      }
                    }}
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Add Pin</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    className={`h-10 w-10 rounded-full shadow-lg text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
                      isDrawingLine ? 'bg-accent/90 hover:bg-accent' : 'bg-primary/90 hover:bg-primary'
                    }`}
                    onClick={() => {
                      if (mapRef.current) {
                        if (isDrawingLine) {
                          // Cancel current line
                          handleLineCancelDrawing();
                        } else {
                          // Start line at crosshair center
                          const mapCenter = mapRef.current.getCenter();
                          setLineStartPoint(mapCenter);
                          setCurrentMousePosition(mapCenter);
                          setIsDrawingLine(true);
                          setDrawingMode('line');
                        }
                      }
                    }}
                  >
                    <Minus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{isDrawingLine ? 'Cancel Line' : 'Draw Line'}</p></TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    className={`h-10 w-10 rounded-full shadow-lg text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
                      isDrawingArea ? 'bg-accent/90 hover:bg-accent' : 'bg-primary/90 hover:bg-primary'
                    }`}
                    onClick={() => {
                      if (isDrawingArea) {
                        handleAreaCancelDrawing();
                      } else {
                        handleAreaStart();
                      }
                    }}
                  >
                    <Square className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>{isDrawingArea ? 'Cancel Area' : 'Draw Area'}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>






          {/* Zoom Controls - Top Right */}
          <div className="absolute top-8 right-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={zoomIn}
                    className="h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  >
                    <ZoomIn className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Zoom In</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={zoomOut}
                    className="h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  >
                    <ZoomOut className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Zoom Out</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Control Tools - Bottom Right */}
          <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={centerOnCurrentLocation}
                    disabled={isGettingLocation}
                    className={`h-10 w-10 rounded-full shadow-lg text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                      locationPermission === 'denied' 
                        ? 'bg-destructive/90 hover:bg-destructive' 
                        : locationPermission === 'granted'
                        ? 'bg-accent/90 hover:bg-accent'
                        : 'bg-primary/90 hover:bg-primary'
                    }`}
                  >
                    {isGettingLocation ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Crosshair className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>
                    {isGettingLocation 
                      ? 'Getting Location...' 
                      : locationPermission === 'denied'
                      ? 'Location Denied - Click to Enable'
                      : locationPermission === 'granted'
                      ? 'Center on Current Location'
                      : 'Get Current Location'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>


            </TooltipProvider>
          </div>

          {/* Line Drawing Controls */}
          {isDrawingLine && (
            <div className="absolute top-16 right-4 z-[1000] flex flex-col gap-2">
              <div className="bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium text-center backdrop-blur-sm shadow-lg">
                Drag map to set end point
              </div>
              <Button 
                onClick={handleLineConfirm} 
                className="h-10 px-4 bg-accent/90 hover:bg-accent text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
              >
                ✓ Confirm Line
              </Button>
              <Button 
                onClick={handleLineCancelDrawing} 
                className="h-10 px-4 bg-destructive/90 hover:bg-destructive text-destructive-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
              >
                ✗ Cancel Line
              </Button>
            </div>
          )}

          {/* Area Drawing Controls */}
          {isDrawingArea && (
            <div className="absolute top-16 right-4 z-[1000] flex flex-col gap-2">
              <div className="bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium text-center backdrop-blur-sm shadow-lg">
                {pendingAreaPath.length === 1 ? 'Drag map to set corner' : `${pendingAreaPath.length} corners added`}
              </div>
              <Button 
                onClick={handleAreaAddCorner} 
                className="h-10 px-4 bg-primary/90 hover:bg-primary text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
              >
                + Add Corner
              </Button>
              {pendingAreaPath.length >= 3 && (
                <Button 
                  onClick={handleAreaFinish} 
                  className="h-10 px-4 bg-accent/90 hover:bg-accent text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
                >
                  ✓ Finish Area
                </Button>
              )}
              <Button 
                onClick={handleAreaCancelDrawing} 
                className="h-10 px-4 bg-destructive/90 hover:bg-destructive text-destructive-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
              >
                ✗ Cancel Area
              </Button>
            </div>
          )}
        </div>
      </main>
      
      {/* Projects Dialog */}
      <Dialog open={showProjectsDialog} onOpenChange={setShowProjectsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Project Management
            </DialogTitle>
            <DialogDescription>
              Manage project locations, visibility, and set the active project for drawing operations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2"><strong>Active Project:</strong> {PROJECT_LOCATIONS[activeProjectId as keyof typeof PROJECT_LOCATIONS]?.name || 'None'}</p>
              <p className="text-xs">All new objects will be assigned to the active project.</p>
            </div>
            
            <div className="space-y-3">
              {Object.entries(PROJECT_LOCATIONS).map(([key, location]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3 flex-1">
                    {/* Project Name and Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium">{location.name}</div>
                        {activeProjectId === key && (
                          <Target className="h-4 w-4 text-accent" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                      </div>
                    </div>
                    
                    {/* Visibility Toggle */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleProjectVisibility(key)}
                      className="h-8 w-8"
                      title={projectVisibility[key] ? "Hide project" : "Show project"}
                    >
                      {projectVisibility[key] ? (
                        <Eye className="h-4 w-4 text-primary" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    
                    {/* Activate Button */}
                    <Button
                      variant={activeProjectId === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveProject(key)}
                      disabled={activeProjectId === key}
                      className="h-8 px-2"
                    >
                      {activeProjectId === key ? "Active" : "Activate"}
                    </Button>
                    
                    {/* Visit Button - Only show for active project */}
                    {activeProjectId === key && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToProjectLocation(key)}
                        className="h-8 px-2"
                      >
                        Visit →
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog open={showMigrationPrompt} onOpenChange={setShowMigrationPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Migrate Local Data</DialogTitle>
            <DialogDescription>
              We found existing map data stored locally. Would you like to migrate it to your account for backup and sync across devices?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <div className="text-sm text-muted-foreground">
              <p>Local data found:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {localStorage.getItem('map-drawing-pins') && (
                  <li>{JSON.parse(localStorage.getItem('map-drawing-pins') || '[]').length} pins</li>
                )}
                {localStorage.getItem('map-drawing-lines') && (
                  <li>{JSON.parse(localStorage.getItem('map-drawing-lines') || '[]').length} lines</li>
                )}
                {localStorage.getItem('map-drawing-areas') && (
                  <li>{JSON.parse(localStorage.getItem('map-drawing-areas') || '[]').length} areas</li>
                )}
              </ul>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowMigrationPrompt(false)}>
                Keep Local Only
              </Button>
              <Button onClick={handleMigration}>
                Migrate to Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={!!itemToEdit} onOpenChange={() => setItemToEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {itemToEdit?.id.includes('pin') ? 'Pin' : itemToEdit?.id.includes('line') ? 'Line' : 'Area'}</DialogTitle>
            <DialogDescription>
              Update the label and notes for this {itemToEdit?.id.includes('pin') ? 'pin' : itemToEdit?.id.includes('line') ? 'line' : 'area'}.
            </DialogDescription>
          </DialogHeader>
          {itemToEdit && (
            <div className="space-y-4 py-4">
              <div>
                <label htmlFor="edit-label" className="block text-sm font-medium mb-2">
                  Label
                </label>
                <input
                  id="edit-label"
                  type="text"
                  defaultValue={itemToEdit.label}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter label"
                />
              </div>
              <div>
                <label htmlFor="edit-notes" className="block text-sm font-medium mb-2">
                  Notes
                </label>
                <textarea
                  id="edit-notes"
                  defaultValue={itemToEdit.notes || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter notes"
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setItemToEdit(null)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  const label = (document.getElementById('edit-label') as HTMLInputElement)?.value || '';
                  const notes = (document.getElementById('edit-notes') as HTMLTextAreaElement)?.value || '';
                  
                  if (itemToEdit.id.includes('pin')) {
                    handleUpdatePin(itemToEdit.id, label, notes, itemToEdit.projectId, itemToEdit.tagIds);
                  } else if (itemToEdit.id.includes('line')) {
                    handleUpdateLine(itemToEdit.id, label, notes, itemToEdit.projectId, itemToEdit.tagIds);
                  } else if (itemToEdit.id.includes('area')) {
                    handleUpdateArea(itemToEdit.id, label, notes, (itemToEdit as any).path, itemToEdit.projectId, itemToEdit.tagIds);
                  }
                  
                  setItemToEdit(null);
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}