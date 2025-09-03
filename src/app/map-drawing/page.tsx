'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Minus, Square, Home, RotateCcw, Save, Trash2, Navigation, Settings, Plus, Minus as MinusIcon, ZoomIn, ZoomOut, Map, Crosshair, FolderOpen, Bookmark, Eye, EyeOff, Target, Menu, ChevronDown, ChevronRight, Info, Edit3 } from 'lucide-react';

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
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  const [showDrawingToolsDropdown, setShowDrawingToolsDropdown] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState<string | null>(null);
  const [showProjectMenuInfo, setShowProjectMenuInfo] = useState<string | null>(null);
  const [mapScale, setMapScale] = useState<{ distance: number; unit: string; pixels: number } | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(320); // Default width in pixels
  const [isResizing, setIsResizing] = useState(false);
  const [showFloatingDrawingTools, setShowFloatingDrawingTools] = useState(false);
  const [isEditingObject, setIsEditingObject] = useState(false);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [editingColor, setEditingColor] = useState('#3b82f6');
  const [editingSize, setEditingSize] = useState(5);
  
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
    
    // Update scale bar
    updateMapScale(center, zoom);
  };

  // Calculate scale bar
  const updateMapScale = useCallback((center: LatLng, zoom: number) => {
    // Calculate meters per pixel at the current zoom level and latitude
    const earthRadius = 6378137; // Earth's radius in meters
    const latRad = (center.lat * Math.PI) / 180;
    const metersPerPixel = (2 * Math.PI * earthRadius * Math.cos(latRad)) / (256 * Math.pow(2, zoom));
    
    // Calculate appropriate scale bar length
    const targetPixels = 100; // Target width in pixels
    const targetMeters = metersPerPixel * targetPixels;
    
    // Round to nice numbers
    let distance: number;
    let unit: string;
    
    if (targetMeters >= 1000) {
      distance = Math.round(targetMeters / 1000);
      unit = 'km';
    } else if (targetMeters >= 100) {
      distance = Math.round(targetMeters / 100) * 100;
      unit = 'm';
    } else if (targetMeters >= 10) {
      distance = Math.round(targetMeters / 10) * 10;
      unit = 'm';
    } else {
      distance = Math.round(targetMeters);
      unit = 'm';
    }
    
    // Calculate actual pixel width for the rounded distance
    const actualMeters = unit === 'km' ? distance * 1000 : distance;
    const pixels = actualMeters / metersPerPixel;
    
    setMapScale({ distance, unit, pixels: Math.round(pixels) });
  }, []);
  
  // Initialize scale bar
  useEffect(() => {
    if (view) {
      updateMapScale({ lat: view.center.lat, lng: view.center.lng }, view.zoom);
    }
  }, [view, updateMapScale]);
  
  // Stable callback that calls the current handler
  const handleMapMove = useCallback((center: LatLng, zoom: number) => {
    mapMoveHandlerRef.current?.(center, zoom);
  }, []);

  const handleMapClick = useCallback((e: LeafletMouseEvent) => {
    // Pin dropping, line drawing, and area drawing are now handled by button clicks, not map click
  }, [drawingMode, isDrawingLine, lineStartPoint, isDrawingArea, pendingAreaPath]);

  // Add a custom click handler that checks if we clicked on an object
  const handleObjectClick = useCallback((objectId: string, objectType: 'pin' | 'line' | 'area') => {
    let clickedObject = null;
    
    if (objectType === 'pin') {
      clickedObject = pins.find(p => p.id === objectId);
    } else if (objectType === 'line') {
      clickedObject = lines.find(l => l.id === objectId);
    } else if (objectType === 'area') {
      clickedObject = areas.find(a => a.id === objectId);
    }
    
    if (clickedObject) {
      setItemToEdit(clickedObject);
      // Prevent default popup behavior
      return false;
    }
  }, [pins, lines, areas]);

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMainMenu) {
        const target = event.target as Element;
        const menuButton = document.querySelector('[data-menu-button]');
        const menuDropdown = document.querySelector('[data-menu-dropdown]');
        
        if (menuButton && !menuButton.contains(target) && menuDropdown && !menuDropdown.contains(target)) {
          setShowMainMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMainMenu]);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = Math.max(280, Math.min(600, e.clientX)); // Min 280px, max 600px
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  // Initialize editing state when itemToEdit changes
  useEffect(() => {
    if (itemToEdit && isEditingObject) {
      setEditingLabel(itemToEdit.label || '');
      setEditingNotes(itemToEdit.notes || '');
      // Set default colors based on object type
      if ('lat' in itemToEdit) {
        setEditingColor('#3b82f6'); // Blue for pins
      } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
        setEditingColor('#10b981'); // Green for lines
      } else {
        setEditingColor('#ef4444'); // Red for areas
      }
      setEditingSize(5); // Default size
    }
  }, [itemToEdit, isEditingObject]);

  const handleStartEdit = () => {
    if (itemToEdit) {
      setIsEditingObject(true);
      setEditingLabel(itemToEdit.label || '');
      setEditingNotes(itemToEdit.notes || '');
      // Set current colors based on object type
      if ('lat' in itemToEdit) {
        setEditingColor('#3b82f6');
      } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
        setEditingColor('#10b981');
      } else {
        setEditingColor('#ef4444');
      }
      setEditingSize(5);
    }
  };

  const handleSaveEdit = () => {
    if (itemToEdit) {
      const updatedObject = {
        ...itemToEdit,
        label: editingLabel.trim() || undefined,
        notes: editingNotes.trim() || undefined,
        color: editingColor,
        size: editingSize
      };

      if ('lat' in itemToEdit) {
        updatePin(itemToEdit.id, updatedObject);
      } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
        updateLine(itemToEdit.id, updatedObject);
      } else {
        updateArea(itemToEdit.id, updatedObject);
      }

      setIsEditingObject(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingObject(false);
    setEditingLabel('');
    setEditingNotes('');
    setEditingColor('#3b82f6');
    setEditingSize(5);
  };





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
            showPopups={false}
            useEditPanel={true}
            disableDefaultPopups={true}
            forceUseEditCallback={true}
            popupMode="none"
          />
          
          {/* Main Menu Button */}
          <div className="absolute top-8 left-4 z-[1000]">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={() => setShowMainMenu(!showMainMenu)}
                    className="h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                    data-menu-button
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Menu</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Top Right Controls */}
          <div className="absolute top-8 right-4 z-[1000] flex flex-col gap-2 items-end">
            {/* Object Details Panel */}
            {itemToEdit && (
              <div className="w-72 bg-background/95 border rounded-lg shadow-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {'lat' in itemToEdit ? (
                      <MapPin className="h-4 w-4 text-blue-500" />
                    ) : 'path' in itemToEdit && Array.isArray(itemToEdit.path) ? (
                      <Minus className="h-4 w-4 text-green-500" />
                    ) : (
                      <Square className="h-4 w-4 text-purple-500" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {itemToEdit.label || `Unnamed ${'lat' in itemToEdit ? 'Pin' : 'path' in itemToEdit && Array.isArray(itemToEdit.path) ? 'Line' : 'Area'}`}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setItemToEdit(null);
                      setIsEditingObject(false);
                    }}
                    className="h-6 w-6 p-0 hover:bg-muted"
                  >
                    <Plus className="h-3 w-3 rotate-45" />
                  </Button>
                </div>
                
                {!isEditingObject ? (
                  // View Mode
                  <>
                    {itemToEdit.notes && (
                      <div className="mb-3">
                        <div className="text-sm text-muted-foreground">{itemToEdit.notes}</div>
                      </div>
                    )}
                    
                    {'lat' in itemToEdit && (
                      <div className="mb-3">
                        <div className="text-xs font-mono text-muted-foreground">
                          {itemToEdit.lat.toFixed(6)}, {itemToEdit.lng.toFixed(6)}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartEdit}
                        className="flex-1 h-8"
                      >
                        <Edit3 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if ('lat' in itemToEdit) {
                            deletePin(itemToEdit.id);
                          } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
                            deleteLine(itemToEdit.id);
                          } else {
                            deleteArea(itemToEdit.id);
                          }
                          setItemToEdit(null);
                        }}
                        className="h-8 px-2 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  // Edit Mode
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Label:</label>
                        <Input
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          placeholder="Enter label..."
                          className="mt-1 h-8"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-muted-foreground">Notes:</label>
                        <Textarea
                          value={editingNotes}
                          onChange={(e) => setEditingNotes(e.target.value)}
                          placeholder="Enter notes..."
                          className="mt-1"
                          rows={2}
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-muted-foreground">Color:</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            value={editingColor}
                            onChange={(e) => setEditingColor(e.target.value)}
                            className="w-8 h-8 rounded border cursor-pointer"
                          />
                          <Input
                            value={editingColor}
                            onChange={(e) => setEditingColor(e.target.value)}
                            className="h-8 font-mono text-xs"
                            placeholder="#000000"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs text-muted-foreground">Size:</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={editingSize}
                            onChange={(e) => setEditingSize(Number(e.target.value))}
                            className="flex-1"
                          />
                          <span className="text-xs w-6 text-center">{editingSize}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        className="flex-1"
                      >
                        Save
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Floating Drawing Tools Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={() => setShowFloatingDrawingTools(!showFloatingDrawingTools)}
                    className={`h-10 w-10 rounded-full shadow-lg border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 ${
                      (drawingMode !== 'none' || isDrawingLine || isDrawingArea) 
                        ? 'bg-accent/90 hover:bg-accent text-accent-foreground' 
                        : 'bg-primary/90 hover:bg-primary text-primary-foreground'
                    }`}
                  >
                    <Edit3 className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Drawing Tools</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Floating Drawing Tools Dropdown */}
            {showFloatingDrawingTools && (
              <div className="w-48 bg-background border rounded-lg shadow-xl p-2 space-y-1">
                <div className="text-xs text-muted-foreground mb-2 px-2">
                  Create objects in active project
                </div>
                
                <Button 
                  variant="ghost"
                  size="sm" 
                  className={`w-full justify-start gap-3 h-10 text-sm ${
                    drawingMode === 'pin' ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => {
                    if (mapRef.current) {
                      const mapCenter = mapRef.current.getCenter();
                      setPendingPin(mapCenter);
                      setShowFloatingDrawingTools(false);
                    }
                  }}
                >
                  <MapPin className="h-4 w-4" />
                  Add Pin
                </Button>
                
                <Button 
                  variant="ghost"
                  size="sm" 
                  className={`w-full justify-start gap-3 h-10 text-sm ${
                    isDrawingLine ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => {
                    if (mapRef.current) {
                      if (isDrawingLine) {
                        handleLineCancelDrawing();
                      } else {
                        const mapCenter = mapRef.current.getCenter();
                        setLineStartPoint(mapCenter);
                        setCurrentMousePosition(mapCenter);
                        setIsDrawingLine(true);
                        setDrawingMode('line');
                      }
                      setShowFloatingDrawingTools(false);
                    }
                  }}
                >
                  <Minus className="h-4 w-4" />
                  {isDrawingLine ? 'Cancel Line' : 'Draw Line'}
                </Button>
                
                <Button 
                  variant="ghost"
                  size="sm" 
                  className={`w-full justify-start gap-3 h-10 text-sm ${
                    isDrawingArea ? 'bg-accent text-accent-foreground' : ''
                  }`}
                  onClick={() => {
                    if (isDrawingArea) {
                      handleAreaCancelDrawing();
                    } else {
                      handleAreaStart();
                    }
                    setShowFloatingDrawingTools(false);
                  }}
                >
                  <Square className="h-4 w-4" />
                  {isDrawingArea ? 'Cancel Area' : 'Draw Area'}
                </Button>

                {/* Current Drawing Status */}
                {(drawingMode !== 'none' || isDrawingLine || isDrawingArea) && (
                  <div className="mt-2 p-2 bg-accent/10 rounded text-xs">
                    <div className="font-medium text-accent mb-1">Currently Drawing:</div>
                    <div className="text-muted-foreground">
                      {isDrawingLine && "Line - Drag map to set endpoint"}
                      {isDrawingArea && `Area - ${pendingAreaPath.length} corners added`}
                      {drawingMode === 'pin' && "Pin mode active"}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Sidebar Menu - Always rendered for animation */}
          <>
            {/* Sidebar - always present but translated off-screen when closed */}
            <div 
              className={`fixed left-0 bg-background border-r shadow-xl z-[1600] transform transition-transform duration-300 ease-in-out ${
                showMainMenu ? 'translate-x-0' : '-translate-x-full'
              }`}
              style={{ 
                width: `${sidebarWidth}px`,
                top: '80px', // Start below the header bar 
                height: 'calc(100vh - 80px)' // Adjust height accordingly
              }}
              data-menu-dropdown
            >
              {/* Resize handle and collapse button - only show when sidebar is open */}
              {showMainMenu && (
                <>
                  {/* Resize Handle */}
                  <div 
                    className="absolute top-0 bottom-0 -right-1 w-2 cursor-col-resize z-20 flex items-center justify-center hover:bg-accent/10 transition-colors group"
                    onMouseDown={handleResizeStart}
                  >
                    {/* Double vertical line */}
                    <div className="flex gap-0.5">
                      <div className="w-px h-8 bg-border group-hover:bg-accent/40 transition-colors"></div>
                      <div className="w-px h-8 bg-border group-hover:bg-accent/40 transition-colors"></div>
                    </div>
                  </div>
                  
                  {/* Collapse button */}
                  <div className="absolute top-1/2 -translate-y-1/2 -right-3 z-10">
                    <Button
                      variant="ghost"
                      onClick={() => setShowMainMenu(false)}
                      className="h-8 w-3 rounded-r-md rounded-l-none bg-background/95 border border-l-0 hover:bg-muted/80 flex items-center justify-center shadow-sm"
                    >
                      <ChevronRight className="h-2.5 w-2.5 rotate-180 text-muted-foreground" />
                    </Button>
                  </div>
                </>
              )}
              
              <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold">Menu</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowMainMenu(false)}
                      className="h-8 w-8"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Active Project - First Item */}
                  <div className="space-y-2">
                    {(() => {
                      const activeProject = PROJECT_LOCATIONS[activeProjectId as keyof typeof PROJECT_LOCATIONS];
                      if (!activeProject) return null;
                      
                      const projectPins = pins.filter(p => p.projectId === activeProjectId);
                      const projectLines = lines.filter(l => l.projectId === activeProjectId);
                      const projectAreas = areas.filter(a => a.projectId === activeProjectId);
                      const totalObjects = projectPins.length + projectLines.length + projectAreas.length;
                      
                      return (
                        <div className="border-l-4 border-accent rounded-sm mb-4 pl-2">
                          {/* Clickable header with arrow */}
                          <Button 
                            variant="ghost"
                            size="sm" 
                            onClick={() => setShowProjectInfo(showProjectInfo === activeProjectId ? null : activeProjectId)}
                            className="w-full justify-between gap-3 h-auto p-3 text-left hover:bg-muted/30"
                          >
                            <div className="flex items-center gap-2">
                              <Target className="h-4 w-4 text-accent" />
                              <div>
                                <div className="text-sm font-medium text-foreground">
                                  {activeProject.name}
                                </div>
                                <div className="text-xs text-accent font-medium">
                                  Active Project
                                </div>
                                {totalObjects > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    {totalObjects} objects ({projectPins.length} pins, {projectLines.length} lines, {projectAreas.length} areas)
                                  </div>
                                )}
                              </div>
                            </div>
                            {showProjectInfo === activeProjectId ? (
                              <ChevronDown className="h-4 w-4 text-accent" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-accent" />
                            )}
                          </Button>
                          
                          
                          {/* Active Project Objects Dropdown */}
                          {showProjectInfo === activeProjectId && (
                            <div className="px-3 pb-3">
                              {/* Center on Project Button */}
                              <div className="mb-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    goToProjectLocation(activeProjectId);
                                  }}
                                  className="w-full justify-start gap-2 h-8"
                                >
                                  <Crosshair className="h-3 w-3" />
                                  Center on Project
                                </Button>
                              </div>
                              
                              {totalObjects === 0 ? (
                                <div className="text-xs text-muted-foreground text-center py-4">
                                  No objects in this project
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {/* All objects in one list */}
                                  {[
                                    ...projectPins.map(pin => ({ ...pin, type: 'pin' as const })),
                                    ...projectLines.map(line => ({ ...line, type: 'line' as const })),
                                    ...projectAreas.map(area => ({ ...area, type: 'area' as const }))
                                  ].map(object => (
                                    <Button
                                      key={object.id}
                                      variant="ghost"
                                      onClick={() => {
                                        // Set selected state for visual feedback
                                        setSelectedObjectId(selectedObjectId === object.id ? null : object.id);
                                        // Trigger the same behavior as clicking on the map object
                                        setItemToEdit(object);
                                      }}
                                      className={`w-full flex items-center gap-2 p-2 rounded text-xs transition-all ${
                                        selectedObjectId === object.id 
                                          ? 'bg-accent/20 border border-accent/40 text-accent-foreground' 
                                          : 'bg-muted/30 hover:bg-muted/50'
                                      }`}
                                    >
                                      {object.type === 'pin' && (
                                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                                      )}
                                      {object.type === 'line' && (
                                        <div className="w-4 h-0.5 bg-green-500 flex-shrink-0"></div>
                                      )}
                                      {object.type === 'area' && (
                                        <div className="w-3 h-3 bg-red-500/30 border border-red-500 flex-shrink-0"></div>
                                      )}
                                      <span className="truncate flex-1 text-left">{object.label || `Unnamed ${object.type.charAt(0).toUpperCase() + object.type.slice(1)}`}</span>
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Project Menu */}
                    <Button 
                      variant="ghost"
                      size="sm" 
                      onClick={() => setShowProjectsDropdown(!showProjectsDropdown)}
                      className="w-full justify-between gap-3 h-12 text-base"
                    >
                      <div className="flex items-center gap-3">
                        <FolderOpen className="h-5 w-5" />
                        Project Menu
                      </div>
                      {showProjectsDropdown ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {/* Projects Dropdown */}
                    {showProjectsDropdown && (
                      <div className="ml-4 space-y-1 border-l-2 border-muted pl-4">
                        <div className="text-xs text-muted-foreground mb-2">
                          <strong>Active:</strong> {PROJECT_LOCATIONS[activeProjectId as keyof typeof PROJECT_LOCATIONS]?.name || 'None'}
                        </div>
                        
                        {/* Sort projects with active project first */}
                        {Object.entries(PROJECT_LOCATIONS)
                          .sort(([keyA], [keyB]) => {
                            if (keyA === activeProjectId) return -1;
                            if (keyB === activeProjectId) return 1;
                            return 0;
                          })
                          .map(([key, location]) => {
                            // Get objects for this project
                            const projectPins = pins.filter(p => p.projectId === key);
                            const projectLines = lines.filter(l => l.projectId === key);
                            const projectAreas = areas.filter(a => a.projectId === key);
                            const totalObjects = projectPins.length + projectLines.length + projectAreas.length;
                            
                            return (
                              <div key={key} className="space-y-1">
                                <div className={`flex items-center justify-between p-2 rounded ${
                                  activeProjectId === key 
                                    ? 'bg-accent/20 border border-accent/40' 
                                    : 'bg-muted/30'
                                }`}>
                                  <div className="flex-1 min-w-0">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium text-sm truncate">{location.name}</div>
                                        {activeProjectId === key && (
                                          <Target className="h-3 w-3 text-accent flex-shrink-0" />
                                        )}
                                        {totalObjects > 0 && (
                                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                                            {totalObjects}
                                          </span>
                                        )}
                                      </div>
                                      {activeProjectId === key && (
                                        <div className="text-xs font-medium text-accent">
                                          Active Project
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex items-center gap-1 ml-2">
                                    {/* Expand/Collapse Arrow */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowProjectMenuInfo(showProjectMenuInfo === key ? null : key);
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      {showProjectMenuInfo === key ? (
                                        <ChevronDown className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                      ) : (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                      )}
                                    </Button>
                                    
                                    {/* Visibility Toggle */}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleProjectVisibility(key);
                                      }}
                                      className="h-6 w-6 p-0"
                                    >
                                      {projectVisibility[key] ? (
                                        <Eye className="h-3 w-3 text-primary" />
                                      ) : (
                                        <EyeOff className="h-3 w-3 text-muted-foreground" />
                                      )}
                                    </Button>
                                    
                                    {/* Activate/Visit Button */}
                                    {activeProjectId === key ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          goToProjectLocation(key);
                                        }}
                                        className="h-6 px-2 text-xs"
                                      >
                                        Visit
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setActiveProject(key)}
                                        className="h-6 px-2 text-xs"
                                      >
                                        Activate
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Project Info Dropdown */}
                                {showProjectMenuInfo === key && (
                                  <div className="ml-2 p-3 bg-muted/40 rounded text-xs space-y-2 border-l-2 border-primary/30">
                                    <div>
                                      <span className="font-medium text-muted-foreground">GPS Coordinates:</span>
                                      <div className="mt-1 font-mono text-foreground">
                                        {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-muted-foreground">Objects:</span>
                                      <div className="mt-1 text-foreground">
                                        {totalObjects === 0 ? (
                                          "No objects"
                                        ) : (
                                          `${totalObjects} total (${projectPins.length} pins, ${projectLines.length} lines, ${projectAreas.length} areas)`
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                              </div>
                            );
                          })}
                      </div>
                    )}
                    
                  </div>
                </div>
              </div>
          </>
          {/* End of Sidebar Menu */}







          {/* Control Tools - Bottom Right, Vertical Layout (Individual Buttons) */}
          <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              {/* Current Location - Top */}
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

              {/* Zoom In - Middle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={zoomIn}
                    className="h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Zoom In</p>
                </TooltipContent>
              </Tooltip>

              {/* Zoom Out - Bottom */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={zoomOut}
                    className="h-10 w-10 rounded-full shadow-lg bg-primary/90 hover:bg-primary text-primary-foreground border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  >
                    <MinusIcon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Zoom Out</p>
                </TooltipContent>
              </Tooltip>

            </TooltipProvider>
          </div>

          {/* Scale Bar - Bottom Right */}
          {mapScale && (
            <div className="absolute bottom-4 right-20 z-[1000]">
              <div className="bg-transparent px-2 py-1 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <div 
                    className="border-b-2 border-l-2 border-r-2 border-foreground h-2"
                    style={{ width: `${mapScale.pixels}px` }}
                  />
                  <span className="text-foreground drop-shadow-sm">
                    {mapScale.distance} {mapScale.unit}
                  </span>
                </div>
              </div>
            </div>
          )}

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
              Project Menu
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
              {/* Sort projects with active project first */}
              {Object.entries(PROJECT_LOCATIONS)
                .sort(([keyA], [keyB]) => {
                  if (keyA === activeProjectId) return -1;
                  if (keyB === activeProjectId) return 1;
                  return 0;
                })
                .map(([key, location]) => {
                  // Get objects for this project
                  const projectPins = pins.filter(p => p.projectId === key);
                  const projectLines = lines.filter(l => l.projectId === key);
                  const projectAreas = areas.filter(a => a.projectId === key);
                  const totalObjects = projectPins.length + projectLines.length + projectAreas.length;
                  
                  return (
                    <div key={key} className="border rounded-lg">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 flex-1">
                          {/* Project Name and Info */}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium">{location.name}</div>
                              {activeProjectId === key && (
                                <Target className="h-4 w-4 text-accent" />
                              )}
                              {totalObjects > 0 && (
                                <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                                  {totalObjects} objects
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
                            </div>
                          </div>
                          
                          {/* Show Objects Dropdown - Only for active project */}
                          {activeProjectId === key && totalObjects > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const element = document.getElementById(`project-objects-${key}`);
                                if (element) {
                                  element.style.display = element.style.display === 'none' ? 'block' : 'none';
                                }
                              }}
                              className="h-8 px-2 text-xs"
                            >
                              Show Objects ↓
                            </Button>
                          )}
                          
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
                      
                      {/* Objects List - Only for active project */}
                      {activeProjectId === key && totalObjects > 0 && (
                        <div id={`project-objects-${key}`} className="border-t bg-muted/30 p-3" style={{display: 'none'}}>
                          <div className="space-y-2 text-sm">
                            {projectPins.length > 0 && (
                              <div>
                                <div className="font-medium text-xs text-muted-foreground mb-1">PINS ({projectPins.length})</div>
                                {projectPins.map(pin => (
                                  <div key={pin.id} className="flex items-center gap-2 py-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span>{pin.label || 'Unnamed Pin'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {projectLines.length > 0 && (
                              <div>
                                <div className="font-medium text-xs text-muted-foreground mb-1">LINES ({projectLines.length})</div>
                                {projectLines.map(line => (
                                  <div key={line.id} className="flex items-center gap-2 py-1">
                                    <div className="w-4 h-0.5 bg-green-500"></div>
                                    <span>{line.label || 'Unnamed Line'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {projectAreas.length > 0 && (
                              <div>
                                <div className="font-medium text-xs text-muted-foreground mb-1">AREAS ({projectAreas.length})</div>
                                {projectAreas.map(area => (
                                  <div key={area.id} className="flex items-center gap-2 py-1">
                                    <div className="w-3 h-3 bg-red-500/30 border border-red-500"></div>
                                    <span>{area.label || 'Unnamed Area'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

    </>
  );
}