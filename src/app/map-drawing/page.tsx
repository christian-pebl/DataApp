'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Minus, Square, Home, RotateCcw, Save, Trash2, Navigation, Settings, Plus, Minus as MinusIcon, ZoomIn, ZoomOut, Map } from 'lucide-react';

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
import { LatLng, LeafletMouseEvent } from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), {
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
  
  const [activeProjectId] = useState<string>('default');
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

  const centerOnLocation = useCallback(() => {
    if (mapRef.current) {
      // Center on default location (Milford Haven)
      const defaultLocation: [number, number] = [51.7128, -5.0341];
      mapRef.current.setView(defaultLocation, 12);
      toast({
        title: "Map Centered",
        description: "Centered on Milford Haven"
      });
    } else {
      toast({
        variant: "destructive",
        title: "Map Not Ready",
        description: "Map is not yet initialized."
      });
    }
  }, [toast]);

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
    <div className="flex flex-col min-h-screen bg-background text-foreground">










                    


      {/* Map Container - Account for top navigation height (h-14 = 3.5rem) */}
      <main className="flex-1 relative overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
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
            editingGeometry={editingGeometry}
            onEditGeometry={setEditingGeometry}
            onUpdateGeometry={(itemId, newPath) => {}}
          />
          
          {/* Drawing Tools */}
          <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    className="h-10 w-10 rounded-full shadow-lg text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: drawingMode === 'pin' ? '#059669' : '#374151' }}
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
                    className="h-10 w-10 rounded-full shadow-lg text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: isDrawingLine ? '#dc2626' : '#374151' }}
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
                    className="h-10 w-10 rounded-full shadow-lg text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                    style={{ backgroundColor: isDrawingArea ? '#dc2626' : '#374151' }}
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
          <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={zoomIn}
                    className="h-10 w-10 rounded-full shadow-lg bg-black/80 hover:bg-black text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
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
                    className="h-10 w-10 rounded-full shadow-lg bg-black/80 hover:bg-black text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
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
                    onClick={centerOnLocation}
                    className="h-10 w-10 rounded-full shadow-lg bg-black/80 hover:bg-black text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  >
                    <Navigation className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Center on Location</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost"
                    size="icon" 
                    onClick={clearAll}
                    className="h-10 w-10 rounded-full shadow-lg bg-red-600/90 hover:bg-red-600 text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Clear All</p>
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
                className="h-10 px-4 bg-green-600/90 hover:bg-green-600 text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
              >
                ✓ Confirm Line
              </Button>
              <Button 
                onClick={handleLineCancelDrawing} 
                className="h-10 px-4 bg-red-600/90 hover:bg-red-600 text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
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
                className="h-10 px-4 bg-blue-600/90 hover:bg-blue-600 text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
              >
                + Add Corner
              </Button>
              {pendingAreaPath.length >= 3 && (
                <Button 
                  onClick={handleAreaFinish} 
                  className="h-10 px-4 bg-green-600/90 hover:bg-green-600 text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
                >
                  ✓ Finish Area
                </Button>
              )}
              <Button 
                onClick={handleAreaCancelDrawing} 
                className="h-10 px-4 bg-red-600/90 hover:bg-red-600 text-white border-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 shadow-lg rounded-lg text-sm"
              >
                ✗ Cancel Area
              </Button>
            </div>
          )}
        </div>
      </main>
      
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
    </div>
  );
}