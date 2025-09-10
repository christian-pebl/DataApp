'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Minus, Square, Home, RotateCcw, Save, Trash2, Navigation, Settings, Plus, Minus as MinusIcon, ZoomIn, ZoomOut, Map, Crosshair, FolderOpen, Bookmark, Eye, EyeOff, Target, Menu, ChevronDown, ChevronRight, Info, Edit3, Check, Database, BarChart3, Upload, Cloud, Calendar, RotateCw, Share, Share2, Users, Lock, Globe, X, Search, CheckCircle2, XCircle, ChevronUp, Thermometer, Wind as WindIcon, CloudSun, Compass as CompassIcon, Waves, Sailboat, Timer as TimerIcon, Sun as SunIcon, AlertCircle } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line as RechartsLine, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, Brush, LabelList, ReferenceLine } from 'recharts';
import type { LucideIcon } from "lucide-react";
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { format, parseISO, isValid, startOfDay, formatISO, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMapView } from '@/hooks/use-map-view';
import { useSettings } from '@/hooks/use-settings';
import { useMapData } from '@/hooks/use-map-data';
import { getTimeWindowSummary } from '@/lib/dateParser';
import { fileStorageService, type PinFile } from '@/lib/supabase/file-storage-service';
import { mapDataService } from '@/lib/supabase/map-data-service';
import { ShareDialogSimplified } from '@/components/sharing/ShareDialogSimplified';
import { DataRestoreDialog } from '@/components/auth/DataRestoreDialog';
import { createClient } from '@/lib/supabase/client';
import type { DateRange } from "react-day-picker";
import type { CombinedDataPoint, LogStep as ApiLogStep, CombinedParameterKey } from '../om-marine-explorer/shared';
import { ALL_PARAMETERS, PARAMETER_CONFIG } from '../om-marine-explorer/shared';
import { fetchCombinedDataAction } from '../om-marine-explorer/actions';
import { MarinePlotsGrid } from '@/components/marine/MarinePlotsGrid';
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range';
import { 
  parseCoordinateInput, 
  getCoordinateFormats, 
  validateCoordinate, 
  CoordinateFormat, 
  COORDINATE_FORMAT_LABELS, 
  COORDINATE_FORMAT_EXAMPLES 
} from '@/lib/coordinate-utils';
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

import { Project, Tag, Pin, Line as LineType, Area } from '@/lib/supabase/types';
import { PinMarineDeviceData } from '@/components/pin-data/PinMarineDeviceData';

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

// Helper components for pin meteo data display (matching MarinePlotsGrid style)
const formatDateTickBrush = (timeValue: string | number): string => {
  try {
    const dateObj = typeof timeValue === 'string' ? parseISO(timeValue) : new Date(timeValue);
    if (!isValid(dateObj)) return String(timeValue);
    return format(dateObj, 'EEE, dd/MM');
  } catch (e) {
    return String(timeValue);
  }
};

type SeriesAvailabilityStatus = 'pending' | 'available' | 'unavailable';

type PlotConfigInternal = {
  dataKey: CombinedParameterKey; 
  name: string;
  unit: string;
  color: string;
  Icon: LucideIcon; 
  isDirectional?: boolean;
};

// A simple arrow shape for the data labels
const DirectionArrow = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="14" height="14" viewBox="0 0 24 24" 
    fill="currentColor" stroke="hsl(var(--background))" 
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" 
    className={cn("lucide lucide-navigation", className)}
    {...props}
  >
    <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
  </svg>
);

// Custom Label for Directional Plots
const DirectionLabel = (props: any) => {
  const { x, y, value, index } = props;

  // Only render for every 10th item to prevent clutter
  if (index % 10 !== 0 || value === null || value === undefined) {
    return null;
  }

  return (
    <foreignObject x={x - 7} y={y - 7} width="14" height="14">
      <DirectionArrow
        style={{ transform: `rotate(${value + 180}deg)`, transformOrigin: 'center center' }} 
        className="text-foreground/80"
      />
    </foreignObject>
  );
};

const PinMeteoPlotRow = React.memo(({
  config,
  index,
  plotCount,
  displayData,
  isPlotVisible,
  availabilityStatus,
  dailyReferenceLines,
  onVisibilityChange,
  onMove
}: {
  config: PlotConfigInternal;
  index: number;
  plotCount: number;
  displayData: CombinedDataPoint[];
  isPlotVisible: boolean;
  availabilityStatus: SeriesAvailabilityStatus;
  dailyReferenceLines: string[];
  onVisibilityChange: (key: CombinedParameterKey, checked: boolean) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
}) => {

  const isDirectional = config.isDirectional;

  const transformedDisplayData = React.useMemo(() => displayData.map(point => {
    const value = point[config.dataKey as keyof CombinedDataPoint];
    if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
      return { ...point, [config.dataKey]: null };
    }
    return point;
  }), [displayData, config.dataKey]);

  const hasValidDataForSeriesInView = React.useMemo(() => transformedDisplayData.some(p => {
    const val = p[config.dataKey as keyof CombinedDataPoint];
    return val !== null && !isNaN(Number(val));
  }), [transformedDisplayData, config.dataKey]);

  const lastDataPointWithValidValue = React.useMemo(() => [...transformedDisplayData].reverse().find(p => {
    const val = p[config.dataKey as keyof CombinedDataPoint];
    return val !== null && !isNaN(Number(val));
  }), [transformedDisplayData, config.dataKey]);
  
  const currentValue = lastDataPointWithValidValue ? lastDataPointWithValidValue[config.dataKey as keyof CombinedDataPoint] as number | undefined : undefined;
  
  let displayValue = "";
  if (isPlotVisible && availabilityStatus === 'available' && typeof currentValue === 'number' && !isNaN(currentValue)) {
    displayValue = `${currentValue.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits: 1})}${isDirectional ? '' : config.unit || ''}`;
  }

  const IconComponent = config.Icon;

  return (
    <div key={config.dataKey as string} className="border rounded-md p-1.5 shadow-sm bg-card flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between px-1 pt-0.5 text-lg">
        <div className="flex flex-1 items-center gap-1.5 min-w-0">
          <Checkbox
            id={`visibility-${config.dataKey}-${index}`}
            checked={isPlotVisible}
            onCheckedChange={(checked) => onVisibilityChange(config.dataKey, !!checked)}
            className="h-3.5 w-3.5 flex-shrink-0 border-muted-foreground/50"
          />
          <Label htmlFor={`visibility-${config.dataKey}-${index}`} className="flex items-center gap-1 cursor-pointer min-w-0 text-muted-foreground">
            <IconComponent className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={config.name}>
              {config.name}
            </span>
          </Label>
          <div className="flex-shrink-0 flex items-center ml-1">
            {availabilityStatus === 'pending' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />}
            {availabilityStatus === 'available' && isPlotVisible && hasValidDataForSeriesInView && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
            {availabilityStatus !== 'pending' && isPlotVisible && (!hasValidDataForSeriesInView || availabilityStatus === 'unavailable') && <XCircle className="h-3.5 w-3.5 text-red-500" />}
          </div>
        </div>
        <div className="flex items-center flex-shrink-0">
          {displayValue && (
            <span className={cn("text-muted-foreground text-lg font-semibold ml-auto pl-2 whitespace-nowrap")}>{displayValue}
             {isDirectional && typeof currentValue === 'number' && <DirectionArrow style={{ display: 'inline-block', transform: `rotate(${currentValue + 180}deg)`, height: '1em', width: '1em', marginLeft: '0.25em', verticalAlign: 'middle' }} />}
            </span>
          )}
          <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => onMove(index, 'up')} disabled={index === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => onMove(index, 'down')} disabled={index === plotCount - 1}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isPlotVisible && (
        <div className="flex-grow h-[100px] sm:h-[90px] mt-1">
          {(availabilityStatus === 'available' && hasValidDataForSeriesInView) ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={transformedDisplayData} margin={{ top: 5, right: 12, left: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="hsl(var(--border))" vertical={false} />
                {dailyReferenceLines.map(time => (
                  <ReferenceLine key={time} yAxisId={config.dataKey} x={time} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                ))}
                <YAxis
                  yAxisId={config.dataKey}
                  domain={isDirectional ? [0, 360] : ['auto', 'auto']}
                  ticks={isDirectional ? [0, 90, 180, 270, 360] : undefined}
                  tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:1}) : String(value)}
                  tick={{ fontSize: '0.75rem', fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                  width={60} 
                />
                <XAxis dataKey="time" hide />
                <RechartsTooltip
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))', 
                    fontSize: '0.75rem',
                    padding: '8px',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number | null | undefined, name: string, props) => { 
                    const formattedValue = (value !== null && value !== undefined && typeof value === 'number' && !isNaN(value)) 
                      ? value.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) 
                      : 'N/A';
                    return [
                       <div key="val" style={{ display: 'flex', alignItems: 'center' }}>
                         {`${formattedValue}${isDirectional ? '' : (config.unit || '')}`}
                         {isDirectional && typeof value === 'number' && <DirectionArrow style={{ transform: `rotate(${value + 180}deg)`, height: '1em', width: '1em', marginLeft: '0.5em' }} />}
                       </div>,
                       name
                    ];
                  }}
                  labelFormatter={(label) => {
                    try {
                      const date = parseISO(String(label));
                      return isValid(date) ? format(date, 'EEE, MMM dd, HH:mm') : String(label);
                    } catch {
                      return String(label);
                    }
                  }}
                  isAnimationActive={false}
                />
                 <RechartsLine
                    yAxisId={config.dataKey}
                    type="monotone"
                    dataKey={config.dataKey as string}
                    stroke={`hsl(var(${config.color || '--chart-1'}))`}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={true}
                    name={config.name} 
                    isAnimationActive={false}
                  >
                    {isDirectional && <LabelList dataKey={config.dataKey as string} content={<DirectionLabel />} />}
                  </RechartsLine>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground italic">
              {availabilityStatus === 'pending' ? "Loading plot data..." : 
               availabilityStatus === 'unavailable' ? "Data unavailable for this parameter." : 
               availabilityStatus === 'available' && !hasValidDataForSeriesInView ? "No data points in selected range." :
               "Checking data..."
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PinMeteoPlotRow.displayName = 'PinMeteoPlotRow';

export default function MapDrawingPage() {
  const { view, setView } = useMapView('dev-user');
  const { settings, setSettings } = useSettings();
  const { toast, dismiss } = useToast();
  const searchParams = useSearchParams();

  
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
  } = useMapData({ projectId: 'default', enableSync: true });
  
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
  const [originalSidebarWidth, setOriginalSidebarWidth] = useState(320); // Store original width
  const [isResizing, setIsResizing] = useState(false);
  const [showFloatingDrawingTools, setShowFloatingDrawingTools] = useState(false);
  const [isEditingObject, setIsEditingObject] = useState(false);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [editingColor, setEditingColor] = useState('#3b82f6');
  const [editingSize, setEditingSize] = useState(6);
  const [editingLat, setEditingLat] = useState('');
  const [editingLng, setEditingLng] = useState('');
  const [coordinateFormat, setCoordinateFormat] = useState<CoordinateFormat>('decimal');
  const [showNotesSection, setShowNotesSection] = useState(false);
  const [showCoordinateFormatPopover, setShowCoordinateFormatPopover] = useState(false);
  const [showDataDropdown, setShowDataDropdown] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedPinForShare, setSelectedPinForShare] = useState<{ id: string; label: string } | null>(null);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [sharePrivacyLevel, setSharePrivacyLevel] = useState<'private' | 'public' | 'specific'>('private');
  const [shareEmails, setShareEmails] = useState('');
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [pinFiles, setPinFiles] = useState<Record<string, File[]>>({});
  const [pinFileMetadata, setPinFileMetadata] = useState<Record<string, PinFile[]>>({});
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [showExploreDropdown, setShowExploreDropdown] = useState(false);
  const [selectedPinForExplore, setSelectedPinForExplore] = useState<string | null>(null);
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<{ id: string; name: string } | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; type: 'pin' | 'line' | 'area'; hasData?: boolean } | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  
  // Data restoration state
  const [showDataRestore, setShowDataRestore] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  
  // Pin Meteo Data State (copied from data explorer)
  const [pinMeteoDateRange, setPinMeteoDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const from = subDays(today, 7); // 7 days ago
    const to = subDays(today, 1);   // yesterday
    return { from, to };
  });
  const [pinMeteoData, setPinMeteoData] = useState<CombinedDataPoint[] | null>(null);
  const [isLoadingPinMeteoData, setIsLoadingPinMeteoData] = useState(false);
  const [errorPinMeteoData, setErrorPinMeteoData] = useState<string | null>(null);
  const [pinMeteoLocationContext, setPinMeteoLocationContext] = useState<string | null>(null);
  const [pinMeteoFetchLogSteps, setPinMeteoFetchLogSteps] = useState<ApiLogStep[]>([]);
  const [pinMeteoPlotVisibility, setPinMeteoPlotVisibility] = useState(() => {
    return Object.fromEntries(
      ALL_PARAMETERS.map(key => [key, true])
    );
  });
  const [showMeteoDataSection, setShowMeteoDataSection] = useState(false);
  
  // Pin Meteo Grid state (matching MarinePlotsGrid)
  const [pinMeteoBrushStartIndex, setPinMeteoBrushStartIndex] = useState<number | undefined>(0);
  const [pinMeteoBrushEndIndex, setPinMeteoBrushEndIndex] = useState<number | undefined>(undefined);
  const [pinMeteoPlotConfigsInternal, setPinMeteoPlotConfigsInternal] = useState<PlotConfigInternal[]>([]);
  const [pinMeteoSeriesDataAvailability, setPinMeteoSeriesDataAvailability] = useState<Record<CombinedParameterKey, SeriesAvailabilityStatus>>({});
  const [pinMeteoExpanded, setPinMeteoExpanded] = useState(false);
  
  // Marine Device Modal State
  const [showMarineDeviceModal, setShowMarineDeviceModal] = useState(false);
  const [selectedFileType, setSelectedFileType] = useState<'GP' | 'FPOD' | 'Subcam' | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
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
  
  // New state for enhanced features
  const [editingAreaCoords, setEditingAreaCoords] = useState<string[][]>([]);
  const [editingTransparency, setEditingTransparency] = useState(20);
  
  // Refs to prevent duplicate operations
  const lineConfirmInProgressRef = useRef<boolean>(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand sidebar when pin marine meteo data section is opened
  useEffect(() => {
    if (showDataDropdown && showMeteoDataSection) {
      // Store the current width if not already stored
      if (sidebarWidth <= 800) {
        setOriginalSidebarWidth(sidebarWidth);
        setSidebarWidth(800); // Much wider for better data visibility
      }
    } else if (!showDataDropdown) {
      // Restore original width when closing the data dropdown
      setSidebarWidth(originalSidebarWidth);
    }
  }, [showDataDropdown, showMeteoDataSection, sidebarWidth, originalSidebarWidth]);

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
  
  // Handle URL parameters for centering on pin
  useEffect(() => {
    const centerPinId = searchParams.get('centerPin');
    if (centerPinId && pins.length > 0 && mapRef.current) {
      // Find the pin to center on
      const targetPin = pins.find(pin => pin.id === centerPinId);
      if (targetPin) {
        // Center the map on the pin
        mapRef.current.setView([targetPin.lat, targetPin.lng], 16);
        
        // Set the pin as the item to edit (opens properties dialog)
        setItemToEdit(targetPin);
        
        // Show notification
        toast({
          title: "Centered on pin",
          description: `Map centered on "${targetPin.label || 'New pin'}"`,
        });
        
        // Remove URL parameters to clean up the URL
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.delete('centerPin');
          url.searchParams.delete('notification');
          window.history.replaceState({}, '', url.toString());
        }
      } else {
        // Pin not found, show error
        toast({
          title: "Pin not found",
          description: "The requested pin could not be found on the map.",
          variant: "destructive"
        });
      }
    }
  }, [searchParams, pins, mapRef, toast]);
  
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

  // Check for authentication and show restore dialog on login
  useEffect(() => {
    const checkAuthAndRestore = async () => {
      if (!hasCheckedAuth && isAuthenticated) {
        setHasCheckedAuth(true);
        
        // Check if this is a fresh login (no data in state but user is authenticated)
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Check if we need to restore data
          const lastSync = localStorage.getItem('map-drawing-last-sync');
          const timeSinceSync = lastSync ? Date.now() - new Date(lastSync).getTime() : Infinity;
          
          // Show restore dialog if it's been more than 5 minutes since last sync
          // or if there's no sync time recorded
          if (timeSinceSync > 5 * 60 * 1000 || !lastSync) {
            setShowDataRestore(true);
          }
        }
      }
    };
    
    checkAuthAndRestore();
  }, [isAuthenticated, hasCheckedAuth]);
  
  const handleMigration = async () => {
    const success = await migrateToDatabase();
    if (success) {
      setShowMigrationPrompt(false);
    }
  };

  // Load pin files from Supabase when pins change
  useEffect(() => {
    const loadPinFiles = async () => {
      if (pins.length === 0) {
        console.log('🔍 No pins to load files for');
        return;
      }
      
      console.log(`🔍 Loading files for ${pins.length} pins...`);
      const fileMetadata: Record<string, PinFile[]> = {};
      
      // Load files for each pin
      for (const pin of pins) {
        try {
          console.log(`  📍 Checking files for pin: ${pin.label || 'Unnamed'} (${pin.id})`);
          const files = await fileStorageService.getPinFiles(pin.id);
          
          if (files.length > 0) {
            console.log(`    ✅ Found ${files.length} file(s) for pin ${pin.id}`);
            files.forEach(file => {
              console.log(`      - ${file.fileName} (${(file.fileSize / 1024).toFixed(2)} KB)`);
            });
            fileMetadata[pin.id] = files;
          } else {
            console.log(`    📭 No files found for pin ${pin.id}`);
          }
        } catch (error) {
          console.error(`    ❌ Error loading files for pin ${pin.id}:`, error);
        }
      }
      
      console.log(`📦 Total file metadata loaded:`, Object.keys(fileMetadata).length, 'pins with files');
      setPinFileMetadata(fileMetadata);
    };

    loadPinFiles();
  }, [pins]);



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

  // Pin Meteo Grid: Initialize plot configurations
  useEffect(() => {
    const configs: PlotConfigInternal[] = ALL_PARAMETERS.map(key => {
      const baseConfig = PARAMETER_CONFIG[key as CombinedParameterKey];
      let iconComp: LucideIcon = Info; // Default icon
      const isDirectional = key === 'waveDirection' || key === 'windDirection10m';

      // Fallbacks if no icon is in PARAMETER_CONFIG
      if (key === 'seaLevelHeightMsl') iconComp = Waves;
      else if (key === 'waveHeight') iconComp = Sailboat;
      else if (key === 'waveDirection') iconComp = CompassIcon;
      else if (key === 'wavePeriod') iconComp = TimerIcon;
      else if (key === 'seaSurfaceTemperature') iconComp = Thermometer;
      else if (key === 'temperature2m') iconComp = Thermometer;
      else if (key === 'windSpeed10m') iconComp = WindIcon;
      else if (key === 'windDirection10m') iconComp = CompassIcon;
      else if (key === 'ghi') iconComp = SunIcon;
      
      return {
        dataKey: key as CombinedParameterKey,
        name: baseConfig.name,
        unit: baseConfig.unit || '',
        color: baseConfig.color || '--chart-1',
        Icon: iconComp,
        isDirectional,
      };
    });
    setPinMeteoPlotConfigsInternal(configs);
  }, []);

  // Pin Meteo Grid: Manage data availability status
  useEffect(() => {
    if (isLoadingPinMeteoData) {
      const pendingAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
      ALL_PARAMETERS.forEach(key => {
        pendingAvailability[key as CombinedParameterKey] = 'pending';
      });
      setPinMeteoSeriesDataAvailability(pendingAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
      return;
    }
    
    const newAvailability: Partial<Record<CombinedParameterKey, SeriesAvailabilityStatus>> = {};
    if (!pinMeteoData || pinMeteoData.length === 0) {
      ALL_PARAMETERS.forEach(key => {
        newAvailability[key as CombinedParameterKey] = 'unavailable';
      });
    } else {
      ALL_PARAMETERS.forEach(key => {
        const hasData = pinMeteoData.some(
          point => {
            const val = point[key as keyof CombinedDataPoint];
            return val !== undefined && val !== null && !isNaN(Number(val));
          }
        );
        newAvailability[key as CombinedParameterKey] = hasData ? 'available' : 'unavailable';
      });
    }
    setPinMeteoSeriesDataAvailability(newAvailability as Record<CombinedParameterKey, SeriesAvailabilityStatus>);
  }, [pinMeteoData, isLoadingPinMeteoData]);

  // Pin Meteo Grid: Manage brush range
  useEffect(() => {
    if (pinMeteoData && pinMeteoData.length > 0 && pinMeteoBrushEndIndex === undefined) {
      setPinMeteoBrushStartIndex(0);
      setPinMeteoBrushEndIndex(pinMeteoData.length - 1);
    } else if ((!pinMeteoData || pinMeteoData.length === 0)) {
      setPinMeteoBrushStartIndex(0);
      setPinMeteoBrushEndIndex(undefined);
    }
  }, [pinMeteoData, pinMeteoBrushEndIndex]);
  
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
      labelVisible: true,
      size: 2 // Default to thinner lines
    };
    
    try {
      console.log('🎯 STEP 8: Calling createLineData');
      const newLine = await createLineData(lineData);
      console.log('🎯 STEP 9: Line created successfully, clearing pendingLine');
      setPendingLine(null);
      lineConfirmInProgressRef.current = false; // Reset the flag
      
      // Immediately select this line and enter edit mode
      setItemToEdit(newLine);
      setIsEditingObject(true);
      
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
      fillVisible: true,
      color: '#3b82f6', // Default to blue instead of red
      size: 2, // Default to thinner lines
      transparency: 20 // Default to 20% transparency
    };
    
    try {
      const newArea = await createAreaData(areaData);
      setPendingArea(null);
      
      // Immediately select this area and enter edit mode
      setItemToEdit(newArea);
      setIsEditingObject(true);
      
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
      console.log('handleUpdatePin called with:', { id, label, notes, projectId, tagIds });
      
      // Ensure label is not empty string but can be undefined
      const sanitizedLabel = label?.trim() || undefined;
      
      console.log('Updating pin with sanitized label:', sanitizedLabel);
      await updatePinData(id, { 
        label: sanitizedLabel, 
        notes: notes?.trim() || undefined, 
        projectId, 
        tagIds 
      });
      
      console.log('Pin update successful');
      toast({ 
        title: "Pin Updated", 
        description: `Pin "${sanitizedLabel || 'Unnamed'}" has been updated successfully.`,
        duration: 3000 
      });
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
      // Get all objects for this project
      const projectPins = pins.filter(pin => pin.project === locationKey);
      const projectLines = lines.filter(line => line.project === locationKey);
      const projectAreas = areas.filter(area => area.project === locationKey);
      const totalObjects = projectPins.length + projectLines.length + projectAreas.length;
      
      if (totalObjects > 0) {
        // Calculate bounds that include all project objects
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        
        // Process pins
        projectPins.forEach(pin => {
          minLat = Math.min(minLat, pin.lat);
          maxLat = Math.max(maxLat, pin.lat);
          minLng = Math.min(minLng, pin.lng);
          maxLng = Math.max(maxLng, pin.lng);
        });
        
        // Process lines
        projectLines.forEach(line => {
          if (line.points) {
            line.points.forEach(point => {
              minLat = Math.min(minLat, point.lat);
              maxLat = Math.max(maxLat, point.lat);
              minLng = Math.min(minLng, point.lng);
              maxLng = Math.max(maxLng, point.lng);
            });
          }
        });
        
        // Process areas
        projectAreas.forEach(area => {
          if (area.points) {
            area.points.forEach(point => {
              minLat = Math.min(minLat, point.lat);
              maxLat = Math.max(maxLat, point.lat);
              minLng = Math.min(minLng, point.lng);
              maxLng = Math.max(maxLng, point.lng);
            });
          }
        });
        
        // Add some padding around the bounds
        const latPadding = (maxLat - minLat) * 0.1 || 0.01;
        const lngPadding = (maxLng - minLng) * 0.1 || 0.01;
        
        // Fit bounds to show all objects
        mapRef.current.fitBounds([
          [minLat - latPadding, minLng - lngPadding],
          [maxLat + latPadding, maxLng + lngPadding]
        ], { padding: [20, 20] });
        
        toast({
          title: `Viewing ${location.name}`,
          description: `Showing all ${totalObjects} project objects`,
          duration: 3000
        });
      } else {
        // Fallback to project location if no objects
        mapRef.current.setView([location.lat, location.lon], 12);
        toast({
          title: `Navigated to ${location.name}`,
          description: `No objects found - showing project location`,
          duration: 3000
        });
      }
      
      setShowProjectsDialog(false);
    }
  }, [toast, pins, lines, areas]);

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
      
      // Close data dropdown when clicking outside
      if (showDataDropdown) {
        const target = event.target as Element;
        const dataDropdown = document.querySelector('[data-data-dropdown]');
        
        if (dataDropdown && !dataDropdown.contains(target)) {
          setShowDataDropdown(false);
        }
      }
      
          // Close explore dropdown when clicking outside
      if (showExploreDropdown) {
        const target = event.target as Element;
        const exploreDropdown = document.querySelector('[data-explore-dropdown]');
        
        if (exploreDropdown && !exploreDropdown.contains(target)) {
          setShowExploreDropdown(false);
        }
      }
      
      // Close marine device modal when clicking outside
      if (showMarineDeviceModal) {
        const target = event.target as Element;
        const modalContent = document.querySelector('[data-marine-modal]');
        
        if (modalContent && !modalContent.contains(target)) {
          // Let the Dialog component handle backdrop clicks
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMainMenu, showDataDropdown, showExploreDropdown]);

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
      // Initialize coordinates and colors based on object type
      if ('lat' in itemToEdit && 'lng' in itemToEdit) {
        console.log('Initializing coordinates:', itemToEdit.lat, itemToEdit.lng, 'format:', coordinateFormat);
        
        const formats = getCoordinateFormats(itemToEdit.lat);
        const lngFormats = getCoordinateFormats(itemToEdit.lng);
        
        console.log('Generated formats:', formats, lngFormats);
        
        // Set coordinates based on current format
        switch (coordinateFormat) {
          case 'degreeMinutes':
            setEditingLat(formats.degreeMinutes);
            setEditingLng(lngFormats.degreeMinutes);
            break;
          case 'degreeMinutesSeconds':
            setEditingLat(formats.degreeMinutesSeconds);
            setEditingLng(lngFormats.degreeMinutesSeconds);
            break;
          default:
            setEditingLat(itemToEdit.lat.toString());
            setEditingLng(itemToEdit.lng.toString());
            break;
        }
        setEditingColor(itemToEdit.color || '#3b82f6'); // Use stored color or blue for pins
      } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
        if ('fillVisible' in itemToEdit) {
          // This is an area - initialize area-specific state
          setEditingColor(itemToEdit.color || '#3b82f6'); // Use stored color or blue for areas
          setEditingTransparency(itemToEdit.transparency || 20); // Use stored transparency or default
          
          // Initialize area coordinates for editing
          const areaCoords = itemToEdit.path.map(point => {
            const latFormats = getCoordinateFormats(point.lat);
            const lngFormats = getCoordinateFormats(point.lng);
            
            switch (coordinateFormat) {
              case 'degreeMinutes':
                return [latFormats.degreeMinutes, lngFormats.degreeMinutes];
              case 'degreeMinutesSeconds':
                return [latFormats.degreeMinutesSeconds, lngFormats.degreeMinutesSeconds];
              default:
                return [point.lat.toString(), point.lng.toString()];
            }
          });
          setEditingAreaCoords(areaCoords);
        } else {
          setEditingColor(itemToEdit.color || '#10b981'); // Use stored color or green for lines
        }
      }
      setEditingSize(itemToEdit.size || 2); // Use stored size or default to thinner
      
      // Auto-expand notes if there are existing notes
      setShowNotesSection(Boolean(itemToEdit.notes && itemToEdit.notes.trim()));
      
      // Focus the label input field after a brief delay
      setTimeout(() => {
        if (labelInputRef.current) {
          labelInputRef.current.focus();
          labelInputRef.current.select(); // Select all text for easy editing
        }
      }, 100);
    }
  }, [itemToEdit, isEditingObject, coordinateFormat]);

  // Keep itemToEdit in sync with pins/lines/areas arrays
  useEffect(() => {
    if (itemToEdit) {
      // Check if it's a pin
      if ('lat' in itemToEdit && 'lng' in itemToEdit) {
        const updatedPin = pins.find(p => p.id === itemToEdit.id);
        if (updatedPin) {
          // Only update if the data has actually changed (comparing relevant fields)
          if (updatedPin.label !== itemToEdit.label || 
              updatedPin.notes !== itemToEdit.notes ||
              updatedPin.lat !== itemToEdit.lat ||
              updatedPin.lng !== itemToEdit.lng ||
              updatedPin.labelVisible !== itemToEdit.labelVisible) {
            console.log('Updating itemToEdit with updated pin data:', updatedPin);
            setItemToEdit(updatedPin);
          }
        }
      } 
      // Check if it's a line
      else if ('path' in itemToEdit && !('fillVisible' in itemToEdit)) {
        const updatedLine = lines.find(l => l.id === itemToEdit.id);
        if (updatedLine) {
          if (updatedLine.label !== itemToEdit.label || 
              updatedLine.notes !== itemToEdit.notes) {
            console.log('Updating itemToEdit with updated line data:', updatedLine);
            setItemToEdit(updatedLine);
          }
        }
      }
      // Check if it's an area
      else if ('path' in itemToEdit && 'fillVisible' in itemToEdit) {
        const updatedArea = areas.find(a => a.id === itemToEdit.id);
        if (updatedArea) {
          if (updatedArea.label !== itemToEdit.label || 
              updatedArea.notes !== itemToEdit.notes) {
            console.log('Updating itemToEdit with updated area data:', updatedArea);
            setItemToEdit(updatedArea);
          }
        }
      }
    }
  }, [pins, lines, areas]); // Removed itemToEdit from dependencies to avoid infinite loop

  // Handle coordinate format change
  const handleCoordinateFormatChange = (newFormat: CoordinateFormat) => {
    console.log('Format change requested:', newFormat, 'current values:', editingLat, editingLng);
    
    if (itemToEdit && 'lat' in itemToEdit) {
      // Convert current coordinates to new format
      const currentLat = parseCoordinateInput(editingLat);
      const currentLng = parseCoordinateInput(editingLng);
      
      console.log('Parsed current coordinates:', currentLat, currentLng);
      
      if (currentLat !== null && currentLng !== null) {
        const latFormats = getCoordinateFormats(currentLat);
        const lngFormats = getCoordinateFormats(currentLng);
        
        console.log('Generated new formats:', latFormats, lngFormats);
        
        switch (newFormat) {
          case 'degreeMinutes':
            setEditingLat(latFormats.degreeMinutes);
            setEditingLng(lngFormats.degreeMinutes);
            break;
          case 'degreeMinutesSeconds':
            setEditingLat(latFormats.degreeMinutesSeconds);
            setEditingLng(lngFormats.degreeMinutesSeconds);
            break;
          default:
            setEditingLat(currentLat.toString());
            setEditingLng(currentLng.toString());
            break;
        }
      } else {
        console.log('Failed to parse coordinates, falling back to original values');
        // Fall back to using the original coordinates from itemToEdit
        const latFormats = getCoordinateFormats(itemToEdit.lat);
        const lngFormats = getCoordinateFormats(itemToEdit.lng);
        
        switch (newFormat) {
          case 'degreeMinutes':
            setEditingLat(latFormats.degreeMinutes);
            setEditingLng(lngFormats.degreeMinutes);
            break;
          case 'degreeMinutesSeconds':
            setEditingLat(latFormats.degreeMinutesSeconds);
            setEditingLng(lngFormats.degreeMinutesSeconds);
            break;
          default:
            setEditingLat(itemToEdit.lat.toString());
            setEditingLng(itemToEdit.lng.toString());
            break;
        }
      }
    }
    setCoordinateFormat(newFormat);
  };

  const handleStartEdit = () => {
    if (itemToEdit) {
      console.log('DEBUG: handleStartEdit - itemToEdit:', itemToEdit);
      setIsEditingObject(true);
      setEditingLabel(itemToEdit.label || '');
      setEditingNotes(itemToEdit.notes || '');
      // Set current coordinates and colors based on object type
      if ('lat' in itemToEdit && 'lng' in itemToEdit) {
        console.log('DEBUG: handleStartEdit - Setting coordinates from itemToEdit - lat:', itemToEdit.lat, 'lng:', itemToEdit.lng);
        setEditingLat(itemToEdit.lat.toString());
        setEditingLng(itemToEdit.lng.toString());
        console.log('DEBUG: handleStartEdit - Coordinate format is:', coordinateFormat);
        setEditingColor('#3b82f6');
      } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
        if ('fillVisible' in itemToEdit) {
          setEditingColor('#ef4444');
        } else {
          setEditingColor('#10b981');
        }
      }
      setEditingSize(6);
    }
  };

  const handleSaveEdit = () => {
    if (itemToEdit) {
      // Validate coordinates for pins
      if ('lat' in itemToEdit) {
        console.log('DEBUG: Saving coordinates - editingLat:', editingLat, 'editingLng:', editingLng);
        const lat = parseCoordinateInput(editingLat);
        const lng = parseCoordinateInput(editingLng);
        console.log('DEBUG: Parsed coordinates - lat:', lat, 'lng:', lng);
        
        // Validate coordinate values
        if (lat === null || lng === null) {
          toast({
            variant: "destructive",
            title: "Invalid Coordinates",
            description: "Please enter valid coordinates in the selected format."
          });
          return;
        }
        
        if (!validateCoordinate(lat, 'latitude')) {
          toast({
            variant: "destructive", 
            title: "Invalid Latitude",
            description: "Latitude must be between -90 and 90 degrees."
          });
          return;
        }
        
        if (!validateCoordinate(lng, 'longitude')) {
          toast({
            variant: "destructive",
            title: "Invalid Longitude", 
            description: "Longitude must be between -180 and 180 degrees."
          });
          return;
        }

        const updatedObject = {
          ...itemToEdit,
          lat,
          lng,
          label: editingLabel.trim() || undefined,
          notes: editingNotes.trim() || undefined,
          color: editingColor,
          size: editingSize
        };

        console.log('DEBUG: Original itemToEdit:', itemToEdit);
        console.log('DEBUG: updatedObject before save:', updatedObject);
        console.log('DEBUG: Coordinates in updatedObject - lat:', updatedObject.lat, 'lng:', updatedObject.lng);
        
        updatePinData(itemToEdit.id, updatedObject);
        
        toast({
          title: "Pin Updated",
          description: `Coordinates updated to ${lat.toFixed(6)}, ${lng.toFixed(6)}`
        });
        
      } else {
        // For lines and areas, handle coordinate editing and updates
        const updatedObject = {
          ...itemToEdit,
          label: editingLabel.trim() || undefined,
          notes: editingNotes.trim() || undefined,
          color: editingColor,
          size: editingSize
        };

        // Handle area coordinate editing
        if ('path' in itemToEdit && Array.isArray(itemToEdit.path) && 'fillVisible' in itemToEdit) {
          // This is an area - add coordinate editing support
          if (editingAreaCoords.length > 0) {
            // Parse coordinate strings and update path
            const newPath = editingAreaCoords.map(coordPair => {
              const lat = parseCoordinateInput(coordPair[0]);
              const lng = parseCoordinateInput(coordPair[1]);
              return { lat: lat || 0, lng: lng || 0 };
            }).filter(coord => coord.lat !== 0 || coord.lng !== 0);
            
            if (newPath.length >= 3) {
              updatedObject.path = newPath;
            }
          }
          
          // Add transparency support for areas
          updatedObject.transparency = editingTransparency;
          
          updateAreaData(itemToEdit.id, updatedObject);
        } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
          // This is a line - no coordinate editing for now
          updateLineData(itemToEdit.id, updatedObject);
        }
      }

      setIsEditingObject(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingObject(false);
    setEditingLabel('');
    setEditingNotes('');
    setEditingColor('#3b82f6');
    setEditingSize(2); // Updated default to thinner
    setEditingAreaCoords([]); // Clear area coordinates
    setEditingTransparency(20); // Reset transparency
  };

  // Move pin to current map center (crosshair position)
  const handleMovePinToCenter = async () => {
    if (itemToEdit && 'lat' in itemToEdit && mapRef.current) {
      const mapCenter = mapRef.current.getCenter();
      console.log('DEBUG: Moving pin to map center (crosshair position):', mapCenter.lat, mapCenter.lng);
      console.log('DEBUG: Map center coordinates should match exactly where crosshairs are positioned');
      
      // Update the editing coordinates to the map center
      setEditingLat(mapCenter.lat.toString());
      setEditingLng(mapCenter.lng.toString());
      
      // Immediately update the pin in the database/state
      const updatedObject = {
        ...itemToEdit,
        lat: mapCenter.lat,
        lng: mapCenter.lng,
      };

      console.log('DEBUG: Updating pin with new coordinates:', updatedObject);
      try {
        await updatePinData(itemToEdit.id, updatedObject);
        console.log('DEBUG: Pin update successful');
      } catch (error) {
        console.error('DEBUG: Pin update failed:', error);
        toast({
          variant: "destructive",
          title: "Error Moving Pin",
          description: "Failed to move pin. Check console for details."
        });
        return;
      }
      
      toast({
        title: "Pin Moved",
        description: `Pin moved to map center: ${mapCenter.lat.toFixed(6)}, ${mapCenter.lng.toFixed(6)}`
      });
    }
  };

  // Handle sharing pin privacy settings
  const handleUpdatePrivacy = async () => {
    if (!itemToEdit || !('lat' in itemToEdit)) return;
    
    setIsUpdatingPrivacy(true);
    try {
      const sharedEmails = sharePrivacyLevel === 'specific' && shareEmails 
        ? shareEmails.split(',').map(email => email.trim()).filter(email => email.length > 0)
        : [];
      
      // Update pin privacy in database
      await mapDataService.updatePinPrivacy(itemToEdit.id, sharePrivacyLevel, sharedEmails);
      
      // Update local state
      const updatedPin = { ...itemToEdit, privacyLevel: sharePrivacyLevel };
      setItemToEdit(updatedPin);
      
      // Update the pins array
      setPins(prevPins => 
        prevPins.map(pin => 
          pin.id === itemToEdit.id 
            ? { ...pin, privacyLevel: sharePrivacyLevel }
            : pin
        )
      );
      
      toast({
        title: "Privacy Updated",
        description: `Pin privacy set to ${sharePrivacyLevel}${sharePrivacyLevel === 'specific' && sharedEmails.length > 0 ? ` and shared with: ${sharedEmails.join(', ')}` : ''}`
      });
      
      setShowSharePopover(false);
      setShareEmails('');
    } catch (error) {
      console.error('Error updating privacy:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update privacy settings"
      });
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  // Initialize sharing state when item is selected
  const handleOpenShare = () => {
    if (itemToEdit && 'lat' in itemToEdit) {
      setSelectedPinForShare({
        id: itemToEdit.id,
        label: itemToEdit.label || 'Unnamed Pin'
      });
      setShowShareDialog(true);
    }
  };

  // Handle fetching pin meteo data (copied from data explorer)
  const handleFetchPinMeteoData = useCallback(async () => {
    if (!itemToEdit || !('lat' in itemToEdit)) {
      toast({ variant: "destructive", title: "No Pin Selected", description: "Please select a pin first." });
      return;
    }
    
    if (!pinMeteoDateRange?.from || !pinMeteoDateRange?.to) {
      toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a date range." });
      return;
    }
    
    const selectedParams = ALL_PARAMETERS;

    const locationName = itemToEdit.label || `Pin at ${itemToEdit.lat.toFixed(3)}, ${itemToEdit.lng.toFixed(3)}`;
    
    setIsLoadingPinMeteoData(true);
    setErrorPinMeteoData(null);
    setPinMeteoData(null);
    setPinMeteoLocationContext(null);
    setPinMeteoFetchLogSteps([{ message: `Fetching ${selectedParams.length} parameter(s) for ${locationName}...`, status: 'pending' }]);

    const loadingToastId = toast({ 
      title: "Fetching Meteo Data", 
      description: `Fetching data for ${locationName}...` 
    }).id;

    try {
      const result = await fetchCombinedDataAction({
        latitude: itemToEdit.lat,
        longitude: itemToEdit.lng,
        startDate: formatISO(pinMeteoDateRange.from, { representation: 'date' }),
        endDate: formatISO(pinMeteoDateRange.to, { representation: 'date' }),
        parameters: selectedParams
      });

      if (loadingToastId) dismiss(loadingToastId);
      setPinMeteoFetchLogSteps(result.log || []);

      if (result.success && result.data) {
        setPinMeteoData(result.data);
        setPinMeteoLocationContext(locationName);
        
        if (result.data.length === 0 && !result.error) {
          toast({ variant: "default", title: "No Meteo Data", description: "No data points found for the selected criteria.", duration: 4000 });
        } else if (result.data.length > 0) {
          const successToast = toast({ title: "Meteo Data Loaded", description: `Loaded ${result.data.length} data points for ${locationName}.` });
          setTimeout(() => {
            successToast.dismiss();
          }, 3000);
        } else { 
          setErrorPinMeteoData(result.error || "Failed to load meteo data.");
          toast({ variant: "destructive", title: "Error Loading Meteo Data", description: result.error || "Failed to load meteo data." });
        }
      } else {
        setErrorPinMeteoData(result.error || "Failed to load meteo data.");
        toast({ variant: "destructive", title: "Error Loading Meteo Data", description: result.error || "Failed to load meteo data." });
      }
    } catch (e) {
      if (loadingToastId) dismiss(loadingToastId);
      const errorMsg = e instanceof Error ? e.message : "An unknown error occurred during meteo data fetch.";
      setErrorPinMeteoData(errorMsg);
      setPinMeteoFetchLogSteps(prev => [...prev, { message: `Critical error in meteo fetch operation: ${errorMsg}`, status: 'error' }]);
      toast({ variant: "destructive", title: "Critical Meteo Fetch Error", description: errorMsg });
    } finally {
      setIsLoadingPinMeteoData(false);
    }
  }, [itemToEdit, pinMeteoDateRange, pinMeteoPlotVisibility, toast, dismiss]);

  // Handle meteo plot visibility changes
  const handlePinMeteoPlotVisibilityChange = useCallback((key: CombinedParameterKey, checked: boolean) => {
    setPinMeteoPlotVisibility(prev => ({
      ...prev,
      [key]: checked
    }));
  }, []);

  // Pin Meteo Grid: Handle brush change
  const handlePinMeteoBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    setPinMeteoBrushStartIndex(newIndex.startIndex);
    setPinMeteoBrushEndIndex(newIndex.endIndex);
  }, []);

  // Pin Meteo Grid: Handle plot reordering
  const handlePinMeteoMovePlot = useCallback((index: number, direction: 'up' | 'down') => {
    setPinMeteoPlotConfigsInternal(prevConfigs => {
      const newConfigs = [...prevConfigs];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex >= 0 && targetIndex < newConfigs.length) {
        [newConfigs[index], newConfigs[targetIndex]] = [newConfigs[targetIndex], newConfigs[index]];
      }
      return newConfigs;
    });
  }, []);

  // Pin Meteo Grid: Calculate display data based on brush range
  const pinMeteoDisplayData = React.useMemo(() => {
    if (!pinMeteoData || pinMeteoData.length === 0 || pinMeteoBrushStartIndex === undefined || pinMeteoBrushEndIndex === undefined) {
      return [];
    }
    const start = Math.max(0, pinMeteoBrushStartIndex);
    const end = Math.min(pinMeteoData.length - 1, pinMeteoBrushEndIndex);
    const slicedData = pinMeteoData.slice(start, end + 1);
    return slicedData;
  }, [pinMeteoData, pinMeteoBrushStartIndex, pinMeteoBrushEndIndex]);

  // Pin Meteo Grid: Calculate daily reference lines
  const pinMeteoDailyReferenceLines = React.useMemo(() => {
    if (!pinMeteoData || pinMeteoData.length === 0) return [];
    const dailyTimestamps = new Set<string>();

    pinMeteoData.forEach(point => {
      try {
        const date = parseISO(point.time);
        if (isValid(date)) {
          // Get the ISO string for the start of the day
          const dayStartISO = startOfDay(date).toISOString();
          dailyTimestamps.add(dayStartISO);
        }
      } catch (e) {
        // ignore invalid time format
      }
    });

    // The reference lines need to match exact timestamps in the data.
    // We find the first timestamp for each day.
    return Array.from(dailyTimestamps).map(dayStartISO => {
      return pinMeteoData.find(p => p.time.startsWith(dayStartISO.substring(0, 10)))?.time;
    }).filter((t): t is string => !!t);
  }, [pinMeteoData]);

  // Helper function to categorize files by type
  const categorizeFiles = (files: File[]) => {
    const categories = {
      GP: [] as File[],
      FPOD: [] as File[],
      Subcam: [] as File[]
    };
    
    files.forEach(file => {
      const fileName = file.name.toLowerCase();
      if (fileName.startsWith('gp')) {
        categories.GP.push(file);
      } else if (fileName.startsWith('fpod')) {
        categories.FPOD.push(file);
      } else if (fileName.startsWith('subcam')) {
        categories.Subcam.push(file);
      }
    });
    
    return categories;
  };

  // Handle file upload for pins
  const handleFileUpload = async (pinId: string) => {
    // First check if user is authenticated
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication check failed:', authError);
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please log in to upload files."
      });
      return;
    }
    
    console.log('User authenticated for upload:', user.id);
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const csvFiles = files.filter(file => file.name.toLowerCase().endsWith('.csv'));
      
      if (csvFiles.length !== files.length) {
        toast({
          variant: "destructive",
          title: "Invalid File Type",
          description: "Please select only CSV files."
        });
        return;
      }
      
      if (csvFiles.length > 0) {
        setIsUploadingFiles(true);
        
        try {
          const uploadResults: PinFile[] = [];
          const failedUploads: string[] = [];
          
          // Upload each file to Supabase
          console.log(`📤 Starting upload of ${csvFiles.length} file(s) to pin ${pinId}`);
          console.log('Active project ID:', activeProjectId);
          
          for (const file of csvFiles) {
            console.log(`  📎 Uploading: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
            
            try {
              const result = await fileStorageService.uploadPinFile(pinId, file, activeProjectId);
              
              if (result) {
                console.log(`    ✅ Successfully uploaded: ${file.name}`);
                console.log(`    📍 File path: ${result.filePath}`);
                uploadResults.push(result);
              } else {
                console.error(`    ❌ Failed to upload: ${file.name} - check console for details`);
                failedUploads.push(file.name);
              }
            } catch (uploadError) {
              console.error(`    ❌ Exception during upload of ${file.name}:`, uploadError);
              failedUploads.push(file.name);
            }
          }
          
          if (uploadResults.length > 0) {
            // Update local file metadata state
            setPinFileMetadata(prev => ({
              ...prev,
              [pinId]: [...(prev[pinId] || []), ...uploadResults]
            }));
          }
          
          // Show success/failure toast
          if (failedUploads.length === 0) {
            toast({
              title: "Files Uploaded Successfully",
              description: `${uploadResults.length} CSV file${uploadResults.length > 1 ? 's' : ''} uploaded to Supabase.`
            });
            
            // Keep the explore dropdown open to show the newly uploaded files
            setShowExploreDropdown(true);
            setSelectedPinForExplore(pinId);
          } else {
            toast({
              variant: failedUploads.length === csvFiles.length ? "destructive" : "default",
              title: failedUploads.length === csvFiles.length ? "Upload Failed" : "Partial Upload Success",
              description: failedUploads.length === csvFiles.length 
                ? `Failed to upload ${failedUploads.length} files`
                : `${uploadResults.length} uploaded, ${failedUploads.length} failed: ${failedUploads.join(', ')}`
            });
            
            // If at least some files uploaded successfully, keep dropdown open
            if (uploadResults.length > 0) {
              setShowExploreDropdown(true);
              setSelectedPinForExplore(pinId);
            }
          }
          
        } catch (error) {
          console.error('File upload error:', error);
          toast({
            variant: "destructive",
            title: "Upload Error",
            description: "An error occurred while uploading files. Please try again."
          });
        } finally {
          setIsUploadingFiles(false);
        }
      }
    };
    
    input.click();
  };

  // Handle explore data with file type selection
  const handleExploreData = (pinId: string) => {
    const dbFiles = pinFileMetadata[pinId] || [];
    const totalFiles = dbFiles.length;
    
    if (totalFiles === 0) {
      toast({
        title: "No Data Available",
        description: "No files uploaded for this pin yet."
      });
      return;
    }
    
    setSelectedPinForExplore(pinId);
    setShowExploreDropdown(true);
  };

  // Marine Device Modal Handlers
  const openMarineDeviceModal = useCallback((fileType: 'GP' | 'FPOD' | 'Subcam', files: File[]) => {
    setSelectedFileType(fileType);
    setSelectedFiles(files);
    setShowMarineDeviceModal(true);
    
    // Keep all UI elements open - don't close anything
    // The modal will overlay on top of the existing UI
  }, []);

  const closeMarineDeviceModal = useCallback(() => {
    setShowMarineDeviceModal(false);
    setSelectedFileType(null);
    setSelectedFiles([]);
    // UI state is already preserved, no need to reopen anything
  }, []);

  // Handle request to return to file selection from Add New Plot button
  const handleRequestFileSelection = useCallback(() => {
    // Close the marine device modal
    setShowMarineDeviceModal(false);
    setSelectedFileType(null);
    setSelectedFiles([]);
    
    // UI state is already preserved, no need to reopen anything
    // The explore dropdown and object properties should still be open
    
    // Reopen the object properties with the file selector
    // We need to find the original pin that was being edited
    const pinForReselection = selectedPinForExplore || 
      (pinFiles && Object.keys(pinFiles).find(pinId => pinFiles[pinId]?.length > 0));
    
    if (pinForReselection) {
      // Find the pin object
      const pin = pins.find(p => p.id === pinForReselection);
      if (pin) {
        setItemToEdit(pin);
        setShowDataDropdown(true);
        setShowExploreDropdown(true);
        setSelectedPinForExplore(pinForReselection);
      }
    }
  }, [selectedPinForExplore, pinFiles, pins]);

  // Handle file type selection
  const handleFileTypeSelection = async (fileType: 'GP' | 'FPOD' | 'Subcam') => {
    if (!selectedPinForExplore) return;
    
    // Get local files
    const localFiles = pinFiles[selectedPinForExplore] || [];
    
    // Get database files and convert them to File objects if needed
    const dbFileMetadata = pinFileMetadata[selectedPinForExplore] || [];
    const dbFiles: File[] = [];
    
    // For database files, we need to download them first
    for (const meta of dbFileMetadata) {
      try {
        // Check if file matches the selected type based on filename prefix
        if (meta.fileName.startsWith(fileType)) {
          // Create a File-like object for now (you may want to actually download the file)
          const file = new File([new Blob()], meta.fileName, { type: meta.fileType || 'text/csv' });
          Object.defineProperty(file, 'size', { value: meta.fileSize });
          dbFiles.push(file);
        }
      } catch (error) {
        console.error('Error processing database file:', error);
      }
    }
    
    // Combine all files
    const allFiles = [...localFiles, ...dbFiles];
    const categorizedFiles = categorizeFiles(allFiles);
    const selectedFiles = categorizedFiles[fileType];
    
    // Don't close any dropdowns - keep the UI state
    // The modal will overlay on top
    
    if (selectedFiles.length > 0) {
      // Open the Marine Device Modal instead of showing toast
      openMarineDeviceModal(fileType, selectedFiles);
    } else {
      toast({
        variant: "destructive",
        title: "No Files Found",
        description: `No ${fileType} files found for this pin.`
      });
    }
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

          {/* Center Crosshairs */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[500]">
            {/* Horizontal line */}
            <div className="absolute w-8 h-px bg-red-500 shadow-lg shadow-black/50 -translate-x-1/2 -translate-y-1/2"></div>
            {/* Vertical line */}
            <div className="absolute h-8 w-px bg-red-500 shadow-lg shadow-black/50 -translate-x-1/2 -translate-y-1/2"></div>
            {/* Center dot for perfect accuracy */}
            <div className="absolute w-1 h-1 bg-red-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-black/50"></div>
          </div>
          
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
                      'fillVisible' in itemToEdit ? (
                        <Square className="h-4 w-4 text-purple-500" />
                      ) : (
                        <Minus className="h-4 w-4 text-green-500" />
                      )
                    ) : (
                      <Square className="h-4 w-4 text-purple-500" />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {itemToEdit.label || `Unnamed ${'lat' in itemToEdit ? 'Pin' : 'path' in itemToEdit && Array.isArray(itemToEdit.path) ? ('fillVisible' in itemToEdit ? 'Area' : 'Line') : 'Unknown'}`}
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
                    
                    <div className="space-y-2">
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
                        
                        {/* Share button - only for pins */}
                        {itemToEdit && 'lat' in itemToEdit && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleOpenShare}
                                  className="h-8 px-2"
                                >
                                  <Share2 className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Share Pin</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {/* Delete button with confirmation */}
                        <Popover 
                          open={deleteConfirmItem?.id === itemToEdit.id}
                          onOpenChange={(open) => {
                            if (!open) setDeleteConfirmItem(null);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                // Check if pin has data
                                let hasData = false;
                                if ('lat' in itemToEdit) {
                                  const pinFiles = pinFileMetadata[itemToEdit.id];
                                  hasData = pinFiles && pinFiles.length > 0;
                                }
                                setDeleteConfirmItem({ 
                                  id: itemToEdit.id, 
                                  type: 'lat' in itemToEdit ? 'pin' : 'fillVisible' in itemToEdit ? 'area' : 'line',
                                  hasData 
                                });
                              }}
                              className="h-8 px-2 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent 
                            className="w-auto p-2 z-[9999]" 
                            align="start"
                            side="bottom"
                          >
                            <div className="flex flex-col gap-2">
                              <p className="text-xs font-medium">
                                Delete {deleteConfirmItem?.type}?
                              </p>
                              {deleteConfirmItem?.hasData && (
                                <p className="text-xs text-amber-600">
                                  ⚠️ Data files attached will be deleted
                                </p>
                              )}
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 text-xs px-2"
                                  onClick={() => {
                                    if ('lat' in itemToEdit) {
                                      handleDeletePin(itemToEdit.id);
                                    } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
                                      if ('fillVisible' in itemToEdit) {
                                        handleDeleteArea(itemToEdit.id);
                                      } else {
                                        handleDeleteLine(itemToEdit.id);
                                      }
                                    }
                                    setItemToEdit(null);
                                    setDeleteConfirmItem(null);
                                  }}
                                >
                                  Yes, delete
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2"
                                  onClick={() => setDeleteConfirmItem(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      {/* Share Popover - Only for Pins */}
                      {itemToEdit && 'lat' in itemToEdit && (
                        <Popover open={showSharePopover} onOpenChange={setShowSharePopover}>
                          <PopoverTrigger />
                          <PopoverContent className="w-80 p-4 z-[9999]" align="start">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-medium text-sm mb-2">Pin Privacy Settings</h4>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Control who can see this pin
                                </p>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="privacy"
                                    value="private"
                                    checked={sharePrivacyLevel === 'private'}
                                    onChange={(e) => setSharePrivacyLevel(e.target.value as 'private' | 'public' | 'specific')}
                                    className="text-primary"
                                  />
                                  <Lock className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="text-sm font-medium">Private</div>
                                    <div className="text-xs text-muted-foreground">Only you can see this pin</div>
                                  </div>
                                </label>
                                
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="privacy"
                                    value="public"
                                    checked={sharePrivacyLevel === 'public'}
                                    onChange={(e) => setSharePrivacyLevel(e.target.value as 'private' | 'public' | 'specific')}
                                    className="text-primary"
                                  />
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="text-sm font-medium">Public</div>
                                    <div className="text-xs text-muted-foreground">Anyone can see this pin</div>
                                  </div>
                                </label>
                                
                                <label className="flex items-center space-x-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="privacy"
                                    value="specific"
                                    checked={sharePrivacyLevel === 'specific'}
                                    onChange={(e) => setSharePrivacyLevel(e.target.value as 'private' | 'public' | 'specific')}
                                    className="text-primary"
                                  />
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="text-sm font-medium">Specific Users</div>
                                    <div className="text-xs text-muted-foreground">Share with specific people</div>
                                  </div>
                                </label>
                                
                                {sharePrivacyLevel === 'specific' && (
                                  <div className="ml-6 mt-2">
                                    <Input
                                      placeholder="Enter email addresses separated by commas"
                                      value={shareEmails}
                                      onChange={(e) => setShareEmails(e.target.value)}
                                      className="text-xs"
                                    />
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Users will receive a notification when you share
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex justify-end space-x-2 pt-2 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowSharePopover(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={handleUpdatePrivacy}
                                  disabled={isUpdatingPrivacy}
                                >
                                  {isUpdatingPrivacy && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                  Update Privacy
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                      
                      {/* Data Dropdown Button - Only for Pins */}
                      {'lat' in itemToEdit && (
                        <div className="relative" data-data-dropdown>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDataDropdown(!showDataDropdown)}
                            className="w-full h-8 flex items-center gap-2"
                          >
                            <Database className="h-3 w-3" />
                            Data
                            <ChevronDown className={`h-3 w-3 transition-transform ${showDataDropdown ? 'rotate-180' : ''}`} />
                          </Button>
                          
                          {/* Data Dropdown Menu */}
                          {showDataDropdown && (
                            <div className={`absolute top-full mt-1 bg-background border rounded-lg shadow-lg z-[1200] p-1 ${showMeteoDataSection ? 'w-[800px] right-0' : 'w-72 left-0'}`}>
                              {/* Explore Data Dropdown */}
                              <div className="relative" data-explore-dropdown>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const fileCount = (pinFileMetadata[itemToEdit.id]?.length || 0) + (pinFiles[itemToEdit.id]?.length || 0);
                                    if (fileCount === 0) {
                                      toast({
                                        title: "No Data Available",
                                        description: "No files uploaded for this pin yet."
                                      });
                                      return;
                                    }
                                    setSelectedPinForExplore(itemToEdit.id);
                                    setShowExploreDropdown(!showExploreDropdown);
                                  }}
                                  className="w-full justify-between gap-2 h-8 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <BarChart3 className="h-3 w-3" />
                                    <span>
                                      Explore data 
                                      <span className={`ml-1 font-semibold ${((pinFileMetadata[itemToEdit.id]?.length || 0) + (pinFiles[itemToEdit.id]?.length || 0)) > 0 ? 'text-green-600' : ''}`}>
                                        ({(pinFileMetadata[itemToEdit.id]?.length || 0) + (pinFiles[itemToEdit.id]?.length || 0)} {((pinFileMetadata[itemToEdit.id]?.length || 0) + (pinFiles[itemToEdit.id]?.length || 0)) === 1 ? 'file' : 'files'})
                                      </span>
                                    </span>
                                  </div>
                                  <ChevronDown className={`h-3 w-3 transition-transform ${showExploreDropdown ? 'rotate-180' : ''}`} />
                                </Button>
                                
                                {/* File Type Dropdown */}
                                {showExploreDropdown && selectedPinForExplore === itemToEdit.id && (
                                  <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-background border rounded-lg shadow-lg z-[1300] p-1">
                                    {(() => {
                                      // Use files from database only (no more local files duplication)
                                      const dbFiles = pinFileMetadata[selectedPinForExplore] || [];
                                      
                                      // Convert database files to File-like objects for categorization
                                      const dbFilesAsFileObjects = dbFiles.map(f => ({
                                        name: f.fileName,
                                        size: f.fileSize,
                                        type: f.fileType || 'text/csv'
                                      }));
                                      
                                      // Use database files only
                                      const allFiles = dbFilesAsFileObjects;
                                      const categorizedFiles = categorizeFiles(allFiles);
                                      const availableTypes = Object.entries(categorizedFiles).filter(([_, files]) => files.length > 0);
                                      
                                      if (availableTypes.length === 0) {
                                        return (
                                          <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                                            No files with recognized prefixes found
                                          </div>
                                        );
                                      }
                                      
                                      return availableTypes.map(([fileType, files]) => {
                                        const timeWindow = getTimeWindowSummary(files);
                                        
                                        // Extract shortened name showing date range and suffix
                                        // e.g., "FPOD_Alga_Control_W_2406-2407_24_hours_v3.csv" -> "2406-2407_24_hours_v3"
                                        const getDateFromFileName = (fileName: string) => {
                                          // Look for pattern YYMM-YYMM and everything after it
                                          const match = fileName.match(/(\d{4}-\d{4}.*)\.csv$/i);
                                          if (match) {
                                            return match[1]; // Return the date range and everything after it
                                          }
                                          
                                          // Fallback: try to find any 4-digit pattern that might be a date
                                          const fallbackMatch = fileName.match(/(\d{4}.*)\.csv$/i);
                                          if (fallbackMatch) {
                                            return fallbackMatch[1];
                                          }
                                          
                                          // If no pattern found, return filename without extension
                                          return fileName.replace(/\.csv$/i, '');
                                        };
                                        
                                        return (
                                          <div key={fileType} className="space-y-1">
                                            <div className="flex items-center gap-2 px-2 py-1">
                                              <span className="font-medium text-xs">{fileType}</span>
                                              <span className="text-muted-foreground text-xs">({files.length} files)</span>
                                            </div>
                                            
                                            {/* Show individual files */}
                                            <div className="ml-4 space-y-0.5">
                                              {files.map((file, idx) => {
                                                // Check if this file has metadata (is from database)
                                                const dbMetadata = pinFileMetadata[selectedPinForExplore]?.find(
                                                  meta => meta.fileName === file.name
                                                );
                                                
                                                return (
                                                  <div key={`${fileType}-${idx}`} className="flex items-center gap-1 group max-w-full">
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={async () => {
                                                        // Download file from Supabase if it's a database file
                                                        if (dbMetadata) {
                                                          setDownloadingFileId(dbMetadata.id);
                                                          try {
                                                            const fileContent = await fileStorageService.downloadPinFile(dbMetadata.filePath);
                                                            if (fileContent) {
                                                              // Convert blob to File object
                                                              const actualFile = new File([fileContent], dbMetadata.fileName, {
                                                                type: dbMetadata.fileType || 'text/csv'
                                                              });
                                                              
                                                              // Open modal with the downloaded file
                                                              // Don't close anything - keep the UI state
                                                              openMarineDeviceModal(fileType as 'GP' | 'FPOD' | 'Subcam', [actualFile]);
                                                            } else {
                                                              toast({
                                                                variant: "destructive",
                                                                title: "Download Failed",
                                                                description: "Could not download file from storage."
                                                              });
                                                            }
                                                          } catch (error) {
                                                            console.error('Error downloading file:', error);
                                                            toast({
                                                              variant: "destructive",
                                                              title: "Download Error",
                                                              description: "Failed to download file. Please try again."
                                                            });
                                                          } finally {
                                                            setDownloadingFileId(null);
                                                          }
                                                        }
                                                      }}
                                                      disabled={downloadingFileId === dbMetadata?.id}
                                                      className="flex-1 min-w-0 justify-start gap-1 h-7 text-xs hover:bg-accent/50 px-2"
                                                    >
                                                      {downloadingFileId === dbMetadata?.id ? (
                                                        <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                                                      ) : (
                                                        <Calendar className="h-3 w-3 flex-shrink-0" />
                                                      )}
                                                      <span className="truncate max-w-[150px]" title={file.name}>
                                                        {getDateFromFileName(file.name)}
                                                      </span>
                                                      <span className="text-muted-foreground ml-auto flex-shrink-0 text-[10px]">
                                                        {downloadingFileId === dbMetadata?.id ? 'Loading...' : `${(file.size / 1024).toFixed(0)}KB`}
                                                      </span>
                                                    </Button>
                                                    
                                                    {/* Delete button - only show for database files */}
                                                    {dbMetadata && (
                                                      deleteConfirmFile?.id === dbMetadata.id ? (
                                                        // Show inline confirmation
                                                        <div className="flex items-center gap-1">
                                                          <span className="text-xs mr-1">Delete?</span>
                                                          <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-5 text-[10px] px-1"
                                                            onClick={async (e) => {
                                                              e.stopPropagation();
                                                              console.log('Delete YES clicked for file:', dbMetadata.id, file.name);
                                                              
                                                              // Close the confirmation
                                                              setDeleteConfirmFile(null);
                                                              
                                                              try {
                                                                console.log('Calling deleteFileSimple with ID:', dbMetadata.id);
                                                                const success = await fileStorageService.deleteFileSimple(dbMetadata.id);
                                                                console.log('Delete result from service:', success);
                                                                
                                                                if (success) {
                                                                  console.log('Delete successful, updating UI...');
                                                                  // Update the state immediately to remove the file from UI
                                                                  setPinFileMetadata(prev => ({
                                                                    ...prev,
                                                                    [selectedPinForExplore]: prev[selectedPinForExplore]?.filter(f => f.id !== dbMetadata.id) || []
                                                                  }));
                                                                  
                                                                  toast({
                                                                    title: "File Deleted",
                                                                    description: `${file.name} has been deleted.`
                                                                  });
                                                                  
                                                                  // Keep the explore dropdown open
                                                                  setShowExploreDropdown(true);
                                                                } else {
                                                                  toast({
                                                                    variant: "destructive",
                                                                    title: "Delete Failed",
                                                                    description: `Failed to delete ${file.name}. Please try again.`
                                                                  });
                                                                }
                                                              } catch (error) {
                                                                console.error('Error during file deletion:', error);
                                                                toast({
                                                                  variant: "destructive",
                                                                  title: "Delete Error",
                                                                  description: "An error occurred while deleting the file."
                                                                });
                                                              }
                                                            }}
                                                          >
                                                            Yes
                                                          </Button>
                                                          <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-5 text-[10px] px-1"
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              console.log('Delete NO clicked');
                                                              setDeleteConfirmFile(null);
                                                            }}
                                                          >
                                                            No
                                                          </Button>
                                                        </div>
                                                      ) : (
                                                        // Show delete button
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            console.log('Delete button clicked for file:', dbMetadata.id, file.name);
                                                            setDeleteConfirmFile({ id: dbMetadata.id, name: file.name });
                                                          }}
                                                          className="h-6 w-6 p-0 flex-shrink-0"
                                                          title={`Delete ${file.name}`}
                                                        >
                                                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                                        </Button>
                                                      )
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Don't close the dropdown, just trigger file upload
                                  handleFileUpload(itemToEdit.id);
                                }}
                                disabled={isUploadingFiles}
                                className="w-full justify-start gap-2 h-8 text-xs"
                              >
                                {isUploadingFiles ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                                {isUploadingFiles ? 'Uploading...' : 'Upload data'}
                              </Button>
                              {/* Marine & Meteorological Data Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowMeteoDataSection(!showMeteoDataSection)}
                                className="w-full justify-start gap-2 h-8 text-xs"
                              >
                                <BarChart3 className="h-3 w-3" />
                                Marine & meteo data
                                {showMeteoDataSection ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
                              </Button>
                              
                              {/* Marine & Meteo Data Expanded Section */}
                              {showMeteoDataSection && (
                                <div className="px-2 pb-2 space-y-3 border-l-2 border-accent/20 ml-2 w-[750px]">
                                  {/* Date Range and Fetch Button Row */}
                                  <div className="flex gap-2 items-end">
                                    {/* Date Range Selection */}
                                    <div className="flex-1">
                                      <div className="text-sm font-medium mb-1">Date Range</div>
                                      <DatePickerWithRange 
                                        date={pinMeteoDateRange} 
                                        onDateChange={setPinMeteoDateRange} 
                                        disabled={isLoadingPinMeteoData}
                                        className="h-7 text-sm w-full"
                                      />
                                      {pinMeteoDateRange?.from && pinMeteoDateRange?.to && pinMeteoDateRange.from > pinMeteoDateRange.to && (
                                        <p className="text-xs text-destructive mt-1">Start date must be before end date.</p>
                                      )}
                                    </div>
                                    
                                    {/* Fetch Button */}
                                    <Button 
                                      onClick={() => {
                                        handleFetchPinMeteoData();
                                        // Keep the dropdown open - remove setShowDataDropdown(false)
                                      }} 
                                      disabled={isLoadingPinMeteoData || !pinMeteoDateRange?.from || !pinMeteoDateRange?.to} 
                                      className="h-7 text-sm px-3 flex-shrink-0"
                                      size="sm"
                                    >
                                      {isLoadingPinMeteoData ? <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" /> : <Search className="mr-1 h-2.5 w-2.5"/>}
                                      {isLoadingPinMeteoData ? "Fetching..." : "Fetch Data"}
                                    </Button>
                                  </div>

                                  {/* Meteo Data Display - MarinePlotsGrid Style with Double Width and Expandable Panel */}
                                  {pinMeteoData && pinMeteoData.length > 0 && (
                                    <div className="w-full">
                                      {/* Header */}
                                      <div className="mb-2 flex items-center justify-between">
                                        <div className="text-base font-semibold text-foreground">
                                          {pinMeteoLocationContext} - {pinMeteoData.length} points
                                        </div>
                                        {/* Expand/Collapse Toggle */}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setPinMeteoExpanded(!pinMeteoExpanded)}
                                          className="h-6 w-6 p-0"
                                        >
                                          <ChevronDown 
                                            className={`h-4 w-4 transition-transform duration-200 ${
                                              pinMeteoExpanded ? 'transform rotate-180' : ''
                                            }`} 
                                          />
                                        </Button>
                                      </div>
                                      
                                      {/* Marine Data Container */}
                                      <div 
                                        className={`w-full border rounded-md bg-card/20 transition-all duration-300 ${
                                          pinMeteoExpanded ? 'max-h-[800px]' : 'max-h-[400px]'
                                        }`}
                                      >
                                        <div 
                                          className={`flex-grow flex flex-col space-y-1 overflow-y-auto pr-1 p-2 ${
                                            pinMeteoExpanded ? 'max-h-[700px]' : 'max-h-[300px]'
                                          }`}
                                        >
                                          {pinMeteoPlotConfigsInternal.map((config, index) => (
                                            <PinMeteoPlotRow
                                              key={config.dataKey}
                                              config={config}
                                              index={index}
                                              plotCount={pinMeteoPlotConfigsInternal.length}
                                              displayData={pinMeteoDisplayData}
                                              isPlotVisible={pinMeteoPlotVisibility[config.dataKey] ?? false}
                                              availabilityStatus={pinMeteoSeriesDataAvailability[config.dataKey] || 'pending'}
                                              dailyReferenceLines={pinMeteoDailyReferenceLines}
                                              onVisibilityChange={handlePinMeteoPlotVisibilityChange}
                                              onMove={handlePinMeteoMovePlot}
                                            />
                                          ))}
                                        </div>

                                        {/* Time Brush Selector */}
                                        {pinMeteoData && pinMeteoData.length > 0 && (
                                          <div className="h-[104px] sm:h-[96px] w-full border rounded-md p-2 shadow-sm bg-card mt-4 flex-shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                              <LineChart data={pinMeteoData} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
                                                <XAxis
                                                  dataKey="time"
                                                  tickFormatter={formatDateTickBrush}
                                                  stroke="hsl(var(--muted-foreground))"
                                                  tick={{ fontSize: '0.65rem' }}
                                                  height={30}
                                                  interval="preserveStartEnd"
                                                />
                                                <Brush
                                                  dataKey="time"
                                                  height={44}
                                                  stroke="hsl(var(--primary))"
                                                  fill="transparent"
                                                  tickFormatter={() => ""} // Hide labels on brush itself
                                                  travellerWidth={24} // Larger for easier touch interaction
                                                  startIndex={pinMeteoBrushStartIndex}
                                                  endIndex={pinMeteoBrushEndIndex}
                                                  onChange={handlePinMeteoBrushChange}
                                                  y={36} 
                                                />
                                              </LineChart>
                                            </ResponsiveContainer>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Error Display */}
                                  {errorPinMeteoData && (
                                    <div className="mt-2 p-2 border rounded-md bg-destructive/10 border-destructive/20">
                                      <div className="text-sm text-destructive font-medium">
                                        {errorPinMeteoData}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  // Edit Mode
                  <>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Label:</label>
                        <Input
                          ref={labelInputRef}
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          placeholder="Enter label..."
                          className="mt-1 h-8"
                        />
                      </div>
                      
                      {/* Notes section - collapsible */}
                      <div>
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowNotesSection(!showNotesSection)}
                            className="h-6 px-0 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {showNotesSection ? (
                              <ChevronDown className="h-3 w-3 mr-1" />
                            ) : (
                              <ChevronRight className="h-3 w-3 mr-1" />
                            )}
                            Notes {editingNotes.trim() && !showNotesSection ? '●' : ''}
                          </Button>
                        </div>
                        
                        {showNotesSection && (
                          <div className="mt-2">
                            <Textarea
                              value={editingNotes}
                              onChange={(e) => setEditingNotes(e.target.value)}
                              placeholder="Enter notes..."
                              className="text-xs"
                              rows={2}
                            />
                          </div>
                        )}
                      </div>

                      {/* Coordinate editing - only show for pins */}
                      {itemToEdit && 'lat' in itemToEdit && (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs text-muted-foreground">Coordinates:</label>
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                                        onClick={handleMovePinToCenter}
                                      >
                                        <Target className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                      <p>Move pin to current position</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                <Popover open={showCoordinateFormatPopover} onOpenChange={setShowCoordinateFormatPopover}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                                    >
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                  </PopoverTrigger>
                                <PopoverContent className="w-60 p-2 z-[9999]" align="end">
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium">Coordinate Format</div>
                                    <div className="space-y-1">
                                      {(Object.keys(COORDINATE_FORMAT_LABELS) as CoordinateFormat[]).map((format) => (
                                        <button
                                          key={format}
                                          onClick={() => {
                                            handleCoordinateFormatChange(format);
                                            setShowCoordinateFormatPopover(false);
                                          }}
                                          className={`w-full text-left p-2 text-xs rounded hover:bg-accent ${coordinateFormat === format ? 'bg-accent' : ''}`}
                                        >
                                          <div className="font-medium">{COORDINATE_FORMAT_LABELS[format]}</div>
                                          <div className="text-muted-foreground">{COORDINATE_FORMAT_EXAMPLES[format]}</div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Input
                                  value={editingLat}
                                  onChange={(e) => setEditingLat(e.target.value)}
                                  placeholder={coordinateFormat === 'decimal' ? 'e.g., 51.68498' : coordinateFormat === 'degreeMinutes' ? 'e.g., 51°41.099\'' : 'e.g., 51°41\'5.9"'}
                                  className="h-8 font-mono text-xs"
                                  type={coordinateFormat === 'decimal' ? 'number' : 'text'}
                                  step={coordinateFormat === 'decimal' ? 'any' : undefined}
                                />
                                <span className="text-xs text-muted-foreground">Latitude</span>
                              </div>
                              <div>
                                <Input
                                  value={editingLng}
                                  onChange={(e) => setEditingLng(e.target.value)}
                                  placeholder={coordinateFormat === 'decimal' ? 'e.g., 5.16133' : coordinateFormat === 'degreeMinutes' ? 'e.g., 5°9.680\'' : 'e.g., 5°9\'40.8"'}
                                  className="h-8 font-mono text-xs"
                                  type={coordinateFormat === 'decimal' ? 'number' : 'text'}
                                  step={coordinateFormat === 'decimal' ? 'any' : undefined}
                                />
                                <span className="text-xs text-muted-foreground">Longitude</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {/* Area coordinate editing */}
                      {itemToEdit && 'path' in itemToEdit && 'fillVisible' in itemToEdit && Array.isArray(itemToEdit.path) && (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs text-muted-foreground">Area Coordinates:</label>
                              <div className="flex items-center gap-1">
                                <Popover open={showCoordinateFormatPopover} onOpenChange={setShowCoordinateFormatPopover}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                                    >
                                      <Settings className="h-3 w-3" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-60 p-2 z-[9999]" align="end">
                                    <div className="space-y-2">
                                      <div className="text-xs font-medium">Coordinate Format</div>
                                      <div className="space-y-1">
                                        {(Object.keys(COORDINATE_FORMAT_LABELS) as CoordinateFormat[]).map((format) => (
                                          <button
                                            key={format}
                                            onClick={() => {
                                              handleCoordinateFormatChange(format);
                                              setShowCoordinateFormatPopover(false);
                                            }}
                                            className={cn(
                                              "w-full text-left px-2 py-1 rounded text-xs",
                                              coordinateFormat === format
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-muted"
                                            )}
                                          >
                                            <div className="font-medium">{COORDINATE_FORMAT_LABELS[format]}</div>
                                            <div className="text-xs opacity-75">{COORDINATE_FORMAT_EXAMPLES[format]}</div>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {itemToEdit.path.map((point, index) => {
                                const latFormats = getCoordinateFormats(point.lat);
                                const lngFormats = getCoordinateFormats(point.lng);
                                
                                return (
                                  <div key={index} className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-muted-foreground">
                                        Corner {index + 1} Lat:
                                      </label>
                                      <Input
                                        value={editingAreaCoords[index]?.[0] || latFormats[coordinateFormat]}
                                        onChange={(e) => {
                                          const newCoords = [...editingAreaCoords];
                                          while (newCoords.length <= index) {
                                            newCoords.push(['', '']);
                                          }
                                          newCoords[index][0] = e.target.value;
                                          setEditingAreaCoords(newCoords);
                                        }}
                                        placeholder={COORDINATE_FORMAT_EXAMPLES[coordinateFormat]}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-muted-foreground">
                                        Corner {index + 1} Lng:
                                      </label>
                                      <Input
                                        value={editingAreaCoords[index]?.[1] || lngFormats[coordinateFormat]}
                                        onChange={(e) => {
                                          const newCoords = [...editingAreaCoords];
                                          while (newCoords.length <= index) {
                                            newCoords.push(['', '']);
                                          }
                                          newCoords[index][1] = e.target.value;
                                          setEditingAreaCoords(newCoords);
                                        }}
                                        placeholder={COORDINATE_FORMAT_EXAMPLES[coordinateFormat]}
                                        className="h-7 text-xs"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                      
                      <div>
                        <label className="text-xs text-muted-foreground">Color & Size:</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-10 h-8 p-0 rounded border"
                                style={{ backgroundColor: editingColor }}
                              >
                                <span className="sr-only">Pick color</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-72 p-3 z-[1100]" 
                              side="right" 
                              align="start"
                              sideOffset={8}
                            >
                              <div className="space-y-3">
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Preset Colors</label>
                                  <div className="grid grid-cols-6 gap-1.5">
                                    {[
                                      '#ef4444', // Red
                                      '#f97316', // Orange  
                                      '#eab308', // Yellow
                                      '#22c55e', // Green
                                      '#3b82f6', // Blue
                                      '#6366f1', // Indigo
                                      '#8b5cf6', // Violet
                                      '#ec4899', // Pink
                                      '#06b6d4', // Cyan
                                      '#10b981', // Emerald
                                      '#84cc16', // Lime
                                      '#64748b', // Slate
                                    ].map((color) => (
                                      <button
                                        key={color}
                                        onClick={() => {
                                          setEditingColor(color);
                                          // Auto-apply color change
                                          if (itemToEdit) {
                                            if ('lat' in itemToEdit) {
                                              updatePinData(itemToEdit.id, { color: color, size: editingSize });
                                            } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
                                              if ('fillVisible' in itemToEdit) {
                                                updateAreaData(itemToEdit.id, { color: color, size: editingSize });
                                              } else {
                                                updateLineData(itemToEdit.id, { color: color, size: editingSize });
                                              }
                                            }
                                          }
                                        }}
                                        className={cn(
                                          "w-8 h-8 rounded border-2 transition-all hover:scale-110",
                                          editingColor === color ? "border-white ring-2 ring-primary" : "border-gray-200"
                                        )}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium mb-2 block">Custom Color</label>
                                  <input
                                    type="color"
                                    value={editingColor}
                                    onChange={(e) => {
                                      setEditingColor(e.target.value);
                                      // Auto-apply color change
                                      if (itemToEdit) {
                                        if ('lat' in itemToEdit) {
                                          updatePinData(itemToEdit.id, { color: e.target.value, size: editingSize });
                                        } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
                                          if ('fillVisible' in itemToEdit) {
                                            updateAreaData(itemToEdit.id, { color: e.target.value, size: editingSize });
                                          } else {
                                            updateLineData(itemToEdit.id, { color: e.target.value, size: editingSize });
                                          }
                                        }
                                      }
                                    }}
                                    className="w-full h-8 rounded border cursor-pointer"
                                  />
                                  <div className="text-xs text-muted-foreground mt-1 text-center">
                                    {editingColor.toUpperCase()}
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Select 
                            value={editingSize.toString()} 
                            onValueChange={(value) => {
                              const newSize = parseInt(value);
                              setEditingSize(newSize);
                              // Auto-apply size change
                              if (itemToEdit) {
                                if ('lat' in itemToEdit) {
                                  updatePinData(itemToEdit.id, { color: editingColor, size: newSize });
                                } else if ('path' in itemToEdit && Array.isArray(itemToEdit.path)) {
                                  if ('fillVisible' in itemToEdit) {
                                    updateAreaData(itemToEdit.id, { color: editingColor, size: newSize });
                                  } else {
                                    updateLineData(itemToEdit.id, { color: editingColor, size: newSize });
                                  }
                                }
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue>
                                {editingSize === 2 ? 'Size: Small' : 
                                 editingSize === 4 ? 'Size: Medium' : 
                                 editingSize === 8 ? 'Size: Large' : 'Size: Small'}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="z-[1200]">
                              <SelectItem value="2">Small</SelectItem>
                              <SelectItem value="4">Medium</SelectItem>
                              <SelectItem value="8">Large</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Fill Transparency - only show for areas */}
                      {itemToEdit && 'path' in itemToEdit && 'fillVisible' in itemToEdit && (
                        <div>
                          <label className="text-xs text-muted-foreground">Fill Transparency:</label>
                          <div className="mt-1">
                            <Select 
                              value={editingTransparency.toString()} 
                              onValueChange={(value) => {
                                const newTransparency = parseInt(value);
                                setEditingTransparency(newTransparency);
                                // Auto-apply transparency change
                                if (itemToEdit) {
                                  updateAreaData(itemToEdit.id, { transparency: newTransparency });
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue>
                                  {editingTransparency}% opacity
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="z-[1200]">
                                <SelectItem value="0">0% (Transparent)</SelectItem>
                                <SelectItem value="20">20%</SelectItem>
                                <SelectItem value="50">50%</SelectItem>
                                <SelectItem value="75">75%</SelectItem>
                                <SelectItem value="100">100% (Opaque)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                      
                      {/* Label visibility toggle - show for all object types */}
                      {itemToEdit && (
                        <div>
                          <label className="text-xs text-muted-foreground">Display Options:</label>
                          <div className="mt-1 space-y-2">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="show-label"
                                checked={itemToEdit.labelVisible !== false}
                                onCheckedChange={(checked) => {
                                  const objectType = 'lat' in itemToEdit ? 'pin' : 
                                                   'fillVisible' in itemToEdit ? 'area' : 'line';
                                  handleToggleLabel(itemToEdit.id, objectType);
                                }}
                              />
                              <Label htmlFor="show-label" className="text-xs">Show label on map</Label>
                            </div>
                            {/* Fill visibility toggle - only show for areas */}
                            {itemToEdit && 'path' in itemToEdit && 'fillVisible' in itemToEdit && (
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="show-fill"
                                  checked={itemToEdit.fillVisible !== false}
                                  onCheckedChange={() => {
                                    handleToggleFill(itemToEdit.id);
                                  }}
                                />
                                <Label htmlFor="show-fill" className="text-xs">Show area fill</Label>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
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
                  onClick={async () => {
                    if (mapRef.current) {
                      const mapCenter = mapRef.current.getCenter();
                      
                      // Create pin directly with default label
                      const pinData = {
                        lat: mapCenter.lat,
                        lng: mapCenter.lng,
                        label: 'New Pin',
                        notes: '',
                        projectId: activeProjectId,
                        tagIds: [],
                        labelVisible: true
                      };
                      
                      try {
                        const newPin = await createPinData(pinData);
                        
                        // Immediately select this pin and enter edit mode
                        setItemToEdit(newPin);
                        setIsEditingObject(true);
                        setShowFloatingDrawingTools(false);
                        
                        toast({
                          title: "Pin Created",
                          description: "Pin added and ready for editing."
                        });
                      } catch (error) {
                        console.error('Error creating pin:', error);
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: "Failed to create pin. Please try again."
                        });
                      }
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
                          {/* Clickable header with arrow and separate center button */}
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost"
                              size="sm" 
                              onClick={() => setShowProjectInfo(showProjectInfo === activeProjectId ? null : activeProjectId)}
                              className="flex-1 justify-between gap-3 h-auto p-3 text-left hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-2">
                                <Crosshair className="h-4 w-4 text-accent" />
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
                            
                          </div>
                          
                          
                          {/* Active Project Objects Dropdown */}
                          {showProjectInfo === activeProjectId && (
                            <div className="px-3 pb-3">
                              
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
                                      
                                      {/* Data indicator for pins with uploaded files */}
                                      {object.type === 'pin' && (pinFiles[object.id]?.length > 0 || pinFileMetadata[object.id]?.length > 0) && (
                                        <div className="flex items-center gap-1 ml-auto">
                                          <Database className="h-3 w-3 text-accent" />
                                          <span className="text-xs text-accent font-medium">
                                            {pinFileMetadata[object.id]?.length || pinFiles[object.id]?.length || 0}
                                          </span>
                                        </div>
                                      )}
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
                                          <Crosshair className="h-3 w-3 text-accent flex-shrink-0" />
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
                                <Crosshair className="h-4 w-4 text-accent" />
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
                                    <span className="flex-1">{pin.label || 'Unnamed Pin'}</span>
                                    
                                    {/* Data indicator for pins with uploaded files */}
                                    {(pinFiles[pin.id]?.length > 0 || pinFileMetadata[pin.id]?.length > 0) && (
                                      <div className="flex items-center gap-1 ml-auto">
                                        <Database className="h-3 w-3 text-accent" />
                                        <span className="text-xs text-accent font-medium">
                                          {pinFileMetadata[pin.id]?.length || pinFiles[pin.id]?.length || 0}
                                        </span>
                                      </div>
                                    )}
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

      {/* Marine Device Data Modal */}
      <Dialog 
        open={showMarineDeviceModal} 
        onOpenChange={(open) => {
          setShowMarineDeviceModal(open);
          if (!open) {
            // Clear the selected files when closing
            setSelectedFileType(null);
            setSelectedFiles([]);
            // UI state is preserved - all panels stay as they were
          }
        }}
      >
        <DialogContent className="max-w-6xl h-[80vh] marine-device-modal" data-marine-modal>
          <DialogHeader className="sr-only">
            <DialogTitle>
              {selectedFileType ? `${selectedFileType} Data Analysis` : 'Data Viewer'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {selectedFileType && selectedFiles.length > 0 ? (
              <PinMarineDeviceData 
                fileType={selectedFileType}
                files={selectedFiles}
                onRequestFileSelection={handleRequestFileSelection}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-center">
                <div className="text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No files selected</p>
                  <p className="text-sm">Select a file type to begin analysis</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      {selectedPinForShare && (
        <ShareDialogSimplified
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          pinId={selectedPinForShare.id}
          pinName={selectedPinForShare.label}
        />
      )}

      {/* Data Restore Dialog */}
      <DataRestoreDialog 
        isOpen={showDataRestore}
        onComplete={() => {
          setShowDataRestore(false);
          // Force refresh of data after restore
          forceSync();
        }}
      />

    </>
  );
}