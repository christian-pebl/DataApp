
"use client";

import type { CSSProperties } from "react";
import React, { useState, useEffect, useCallback, useRef, useMemo, useId } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { DateRange } from "react-day-picker";
import { format, formatISO, subDays, addDays, subMonths } from 'date-fns';

import { Button } from "@/components/ui/button";
import { PlotInstance } from "@/components/dataflow/PlotInstance";
import {
  PlusCircle, SunMoon, LayoutGrid, Waves, MapPin, CalendarDays, Search,
  Loader2, Info, CheckCircle2, XCircle, Copy, CloudSun, Anchor,
  Thermometer, Wind as WindIcon, Compass as CompassIcon, Sailboat, Timer as TimerIcon, ListChecks, FilePenLine,
  ChevronsLeft, ChevronsRight
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Label as UiLabel } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CombinedDataPoint, LogStep as ApiLogStep, CombinedParameterKey } from '../om-marine-explorer/shared';
import { ALL_PARAMETERS, PARAMETER_CONFIG } from '../om-marine-explorer/shared';
import { fetchCombinedDataAction } from '../om-marine-explorer/actions';
import { MarinePlotsGrid } from '@/components/marine/MarinePlotsGrid';

interface PlotConfig {
  id: string;
  title: string;
}

type ApiLogOverallStatus = 'pending' | 'success' | 'error' | 'idle' | 'warning';

const OpenLayersMapWithNoSSR = dynamic(
  () => import('@/components/map/OpenLayersMap').then(mod => mod.OpenLayersMap),
  {
    ssr: false,
    loading: () => <p className="text-center p-4 text-muted-foreground">Loading map...</p>
  }
);

const DEFAULT_OM_LATITUDE = 51.7128; // Milford Haven
const DEFAULT_OM_LONGITUDE = -5.0341;
const DEFAULT_OM_MAP_ZOOM = 9;

const knownOmLocations: Record<string, { name: string; lat: number; lon: number }> = {
  milfordhaven: { name: "Milford Haven", lat: 51.7128, lon: -5.0341 },
  ramseysound: { name: "Ramsey Sound", lat: 51.871645, lon: -5.313960 },
  bidefordbay: { name: "Bideford Bay", lat: 51.052156, lon: -4.405961 },
  blakeneyoverfalls: { name: "Blakeney Overfalls", lat: 53.028671, lon: 0.939562 },
  pabayinnersound: { name: "Pabay Inner Sound", lat: 57.264780, lon: -5.853793 },
  lochbay: { name: "Loch Bay", lat: 57.506498, lon: -6.620397 },
  lochsunart: { name: "Loch Sunart", lat: 56.666195, lon: -5.917401 },
};
const defaultOmLocationKey = "milfordhaven";


export default function DataExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  const instanceId = useId();

  // Device Data Plot State
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const plotsInitialized = useRef(false);

  // API Data State (Weather & Marine)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const yesterday = subDays(new Date(), 1);
    return {
      from: yesterday,
      to: addDays(yesterday, 6), // 7-day window starting yesterday
    };
  });

  const [selectedLocationKey, setSelectedLocationKey] = useState<string>(defaultOmLocationKey);
  const [isApiPlotsExpanded, setIsApiPlotsExpanded] = useState(false);

  const [mapSelectedCoords, setMapSelectedCoords] = useState<{ lat: number; lon: number } | null>(
    knownOmLocations[defaultOmLocationKey]
      ? { lat: knownOmLocations[defaultOmLocationKey].lat, lon: knownOmLocations[defaultOmLocationKey].lon }
      : { lat: DEFAULT_OM_LATITUDE, lon: DEFAULT_OM_LONGITUDE }
  );
  const [currentLocationName, setCurrentLocationName] = useState<string>(
    knownOmLocations[defaultOmLocationKey]?.name || "Selected Location"
  );

  const initialApiPlotVisibility = useMemo(() => {
    return Object.fromEntries(
      ALL_PARAMETERS.map(key => [key, true])
    ) as Record<CombinedParameterKey, boolean>;
  }, []);
  const [apiPlotVisibility, setApiPlotVisibility] = useState<Record<CombinedParameterKey, boolean>>(initialApiPlotVisibility);

  const [apiData, setApiData] = useState<CombinedDataPoint[] | null>(null);
  const [isLoadingApiData, setIsLoadingApiData] = useState(false);
  const [errorApiData, setErrorApiData] = useState<string | null>(null);
  const [apiDataLocationContext, setApiDataLocationContext] = useState<string | null>(null);
  const [apiFetchLogSteps, setApiFetchLogSteps] = useState<ApiLogStep[]>([]);
  const [showApiFetchLogAccordion, setShowApiFetchLogAccordion] = useState<string>("");
  const [isApiLogLoading, setIsApiLogLoading] = useState(false);
  const [apiLogOverallStatus, setApiLogOverallStatus] = useState<ApiLogOverallStatus>('idle');
  const lastApiErrorRef = useRef<string | null>(null);
  const initialApiFetchDone = useRef(false);

  const plotConfigIcons: Record<CombinedParameterKey, LucideIcon | undefined> = useMemo(() => {
    const icons: Partial<Record<CombinedParameterKey, LucideIcon>> = {};
    ALL_PARAMETERS.forEach(key => {
      const config = PARAMETER_CONFIG[key as CombinedParameterKey];
      if (config && config.icon) {
        icons[key] = config.icon;
      } else {
        if (key === 'seaLevelHeightMsl') icons[key] = Waves;
        else if (key === 'waveHeight') icons[key] = Sailboat;
        else if (key === 'waveDirection') icons[key] = CompassIcon;
        else if (key === 'wavePeriod') icons[key] = TimerIcon;
        else if (key === 'seaSurfaceTemperature') icons[key] = Thermometer;
        else if (key === 'temperature2m') icons[key] = Thermometer;
        else if (key === 'windSpeed10m') icons[key] = WindIcon;
        else if (key === 'windDirection10m') icons[key] = CompassIcon;
        else if (key === 'ghi') icons[key] = CloudSun;
        else icons[key] = Info;
      }
    });
    return icons as Record<CombinedParameterKey, LucideIcon | undefined>;
  }, []);


  // Theme
  useEffect(() => {
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem("theme") : null;
    if (storedTheme) setTheme(storedTheme);
    else if (typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === "light" ? "dark" : "light"));
  }, []);

  // Device Data Plot Logic
  const addPlot = useCallback(() => {
    setPlots((prevPlots) => [
      ...prevPlots,
      { id: `plot-${Date.now()}-${prevPlots.length}`, title: `Device Data Plot ${prevPlots.length + 1}` },
    ]);
  }, []);

  const removePlot = useCallback((idToRemove: string) => {
    setPlots((prevPlots) => prevPlots.filter((plot) => plot.id !== idToRemove));
  }, []);

  useEffect(() => {
    if (!plotsInitialized.current && plots.length === 0) {
      addPlot();
      plotsInitialized.current = true;
    }
  }, [addPlot, plots.length]);

  // API Location & Parameter Logic
  const handleLocationChange = useCallback((newKey: string) => {
    if (newKey === "__custom__") return; // Ignore if "Custom Location" is somehow selected

    setSelectedLocationKey(newKey);
    const selectedLoc = knownOmLocations[newKey];
    if (selectedLoc) {
      setMapSelectedCoords({ lat: selectedLoc.lat, lon: selectedLoc.lon });
      setCurrentLocationName(selectedLoc.name);
      toast({ title: "Location Selected", description: `${selectedLoc.name} (Lat: ${selectedLoc.lat.toFixed(3)}, Lon: ${selectedLoc.lon.toFixed(3)})`, duration: 3000 });
    }
  }, [toast]);

  const handleMapLocationSelect = useCallback((coords: { lat: number; lon: number }) => {
    setMapSelectedCoords(coords);
    let matchedKey = "";
    for (const key in knownOmLocations) {
      if (knownOmLocations[key].lat.toFixed(3) === coords.lat.toFixed(3) && knownOmLocations[key].lon.toFixed(3) === coords.lon.toFixed(3)) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey) {
      setSelectedLocationKey(matchedKey);
      setCurrentLocationName(knownOmLocations[matchedKey].name);
      toast({ title: "Location Selected on Map", description: `${knownOmLocations[matchedKey].name} (Lat: ${coords.lat.toFixed(3)}, Lon: ${coords.lon.toFixed(3)})`, duration: 3000 });
    } else {
      setSelectedLocationKey("__custom__"); // Special key for custom map selection
      setCurrentLocationName("Custom Location");
      toast({ title: "Custom Location Selected on Map", description: `Lat: ${coords.lat.toFixed(3)}, Lon: ${coords.lon.toFixed(3)})`, duration: 3000 });
    }
  }, [toast]);


  const handleFetchApiData = useCallback(async (isInitialLoad = false) => {
    if (!mapSelectedCoords) {
      if (!isInitialLoad) toast({ variant: "destructive", title: "Missing Location", description: "Please select a location." });
      return;
    }
    if (!dateRange || !dateRange.from || !dateRange.to) {
      if (!isInitialLoad) toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range." });
      return;
    }
    if (dateRange.from > dateRange.to) {
      if (!isInitialLoad) toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
      return;
    }
    const selectedParams = ALL_PARAMETERS.filter(key => apiPlotVisibility[key as CombinedParameterKey]);
    if (selectedParams.length === 0) {
      if (!isInitialLoad) toast({ variant: "destructive", title: "No API Parameters Selected", description: "Please select at least one API parameter to fetch." });
      return;
    }

    setIsLoadingApiData(true); setErrorApiData(null); setApiData(null); setApiDataLocationContext(null);
    setApiFetchLogSteps([{ message: `Fetching ${selectedParams.length} parameter(s) for ${currentLocationName}...`, status: 'pending' }]);
    lastApiErrorRef.current = null;
    setIsApiLogLoading(true); setApiLogOverallStatus('pending'); setShowApiFetchLogAccordion("api-fetch-log-item");

    let loadingToastId: string | undefined;
    if (!isInitialLoad) {
      loadingToastId = toast({ title: "Fetching API Data", description: `Fetching for ${currentLocationName}...` }).id;
    }

    try {
      const result = await fetchCombinedDataAction({
        latitude: mapSelectedCoords.lat,
        longitude: mapSelectedCoords.lon,
        startDate: formatISO(dateRange.from, { representation: 'date' }),
        endDate: formatISO(dateRange.to, { representation: 'date' }),
        parameters: selectedParams,
      });

      if (loadingToastId) dismiss(loadingToastId);
      setApiFetchLogSteps(result.log || []);
      setIsApiLogLoading(false); 

      if (result.success && result.data) {
        setApiData(result.data);
        setApiDataLocationContext(result.dataLocationContext || `API Data for ${currentLocationName}`);
        if (result.data.length === 0 && !result.error) {
          toast({ variant: "default", title: "No API Data", description: "No data points found for the selected criteria.", duration: 4000 });
          setApiLogOverallStatus('warning');
          setShowApiFetchLogAccordion("api-fetch-log-item");
        } else if (result.data.length > 0) {
          if (!isInitialLoad) {
            toast({ title: "API Data Loaded", description: `Loaded ${result.data.length} API data points for ${currentLocationName}.` });
          }
          setApiLogOverallStatus('success');
          if (result.log && result.log.every(l => l.status !== 'error' && l.status !== 'warning')) {
            setShowApiFetchLogAccordion("");
          } else {
            setShowApiFetchLogAccordion("api-fetch-log-item");
          }
        } else { 
           setErrorApiData(result.error || "Failed to load API data.");
           lastApiErrorRef.current = result.error || "Failed to load API data.";
           toast({ variant: "destructive", title: "Error Loading API Data", description: result.error || "Failed to load API data." });
           setApiLogOverallStatus('error');
           setShowApiFetchLogAccordion("api-fetch-log-item");
        }
      } else {
        setErrorApiData(result.error || "Failed to load API data.");
        lastApiErrorRef.current = result.error || "Failed to load API data.";
        toast({ variant: "destructive", title: "Error Loading API Data", description: result.error || "Failed to load API data." });
        setApiLogOverallStatus('error');
        setShowApiFetchLogAccordion("api-fetch-log-item");
      }
    } catch (e) {
      if (loadingToastId) dismiss(loadingToastId);
      setIsLoadingApiData(false); setIsApiLogLoading(false);
      const errorMsg = e instanceof Error ? e.message : "An unknown error occurred during API fetch.";
      setErrorApiData(errorMsg);
      lastApiErrorRef.current = errorMsg;
      setApiFetchLogSteps(prev => [...prev, { message: `Critical error in API fetch operation: ${errorMsg}`, status: 'error' }]);
      toast({ variant: "destructive", title: "Critical API Fetch Error", description: errorMsg });
      setApiLogOverallStatus('error');
      setShowApiFetchLogAccordion("api-fetch-log-item");
    } finally {
       setIsLoadingApiData(false);
       setIsApiLogLoading(false);
    }
  }, [mapSelectedCoords, currentLocationName, dateRange, apiPlotVisibility, toast, dismiss]);

  useEffect(() => {
    if (!initialApiFetchDone.current) {
      if (mapSelectedCoords && currentLocationName && dateRange?.from && dateRange?.to) {
        const selectedParamsOnInit = ALL_PARAMETERS.filter(key => initialApiPlotVisibility[key as CombinedParameterKey]);
        if (selectedParamsOnInit.length > 0) {
          handleFetchApiData(true);
          initialApiFetchDone.current = true;
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapSelectedCoords, currentLocationName, dateRange, handleFetchApiData, initialApiPlotVisibility]);


  const handleApiPlotVisibilityChange = useCallback((key: CombinedParameterKey, checked: boolean) => {
    setApiPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  const allApiParamsSelected = useMemo(() => ALL_PARAMETERS.every(key => apiPlotVisibility[key as CombinedParameterKey]), [apiPlotVisibility]);

  const handleSelectAllApiParams = useCallback((checked: boolean) => {
    setApiPlotVisibility(Object.fromEntries(ALL_PARAMETERS.map(key => [key, checked])) as Record<CombinedParameterKey, boolean>);
  }, []);

  const getLogTriggerContent = useCallback((status: ApiLogOverallStatus, isLoading: boolean, defaultTitle: string, lastError?: string | null) => {
    if (isLoading) return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Fetching log...</>;
    if (status === 'success') return <><CheckCircle2 className="mr-2 h-3 w-3 text-green-500" />{defaultTitle}: Success</>;
    if (status === 'error') return <><XCircle className="mr-2 h-3 w-3 text-destructive" />{defaultTitle}: Failed {lastError ? `(${lastError.substring(0, 30)}...)` : ''}</>;
    if (status === 'pending') return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />{defaultTitle}: In Progress</>;
    if (status === 'warning') return <><Info className="mr-2 h-3 w-3 text-yellow-500" />{defaultTitle}: Warning {lastError ? `(${lastError.substring(0,30)}...)` : ''}</>;
    return <><Info className="mr-2 h-3 w-3 text-muted-foreground" />{defaultTitle}</>;
  }, []);

  const getLogAccordionItemClass = useCallback((status: ApiLogOverallStatus) => {
    if (status === 'pending') return "bg-blue-500/5 dark:bg-blue-500/10";
    if (status === 'success') return "bg-green-500/5 dark:bg-green-500/10";
    if (status === 'error') return "bg-destructive/10 dark:bg-destructive/20";
    if (status === 'warning') return "bg-yellow-500/5 dark:bg-yellow-500/10";
    return "";
  }, []);

  const handleCopyLog = useCallback((logSteps: ApiLogStep[]) => {
    if (logSteps.length === 0) {
      toast({ title: "Log Empty", description: "There are no log messages to copy.", duration: 3000 });
      return;
    }
    const logText = logSteps
      .map(step => `[${step.status.toUpperCase()}] ${step.message}${step.details ? `\n  Details: ${step.details}` : ''}`)
      .join('\n\n');
    navigator.clipboard.writeText(logText)
      .then(() => toast({ title: "Log Copied", description: "Fetch log copied to clipboard.", duration: 3000 }))
      .catch(err => {
        console.error('Failed to copy log: ', err);
        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy log to clipboard.", duration: 3000 });
      });
  }, [toast]);
  
  const renderLogAccordion = useCallback((
    logSteps: ApiLogStep[],
    accordionValue: string,
    onValueChange: (value: string) => void,
    isLoadingFlag: boolean,
    overallStatus: ApiLogOverallStatus,
    title: string,
    lastError?: string | null
  ) => {
    return (
      (isLoadingFlag || logSteps.length > 0 || overallStatus === 'error' || overallStatus === 'warning') && (
        <CardFooter className="p-0 pt-2 flex flex-col items-stretch">
          <Accordion type="single" collapsible value={accordionValue} onValueChange={onValueChange} className="w-full">
            <AccordionItem value={title.toLowerCase().replace(/\s+/g, '-') + "-log-item"} className={cn("border rounded-md", getLogAccordionItemClass(overallStatus))}>
              <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline [&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3">
                {getLogTriggerContent(overallStatus, isLoadingFlag, title, lastError)}
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-1 pt-0">
                <ScrollArea className="max-h-[35rem] h-auto w-full rounded-md border bg-muted/30 dark:bg-muted/10 p-1.5 mt-1">
                  <ul className="space-y-1 text-[0.7rem]">
                    {logSteps.map((step, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        {step.status === 'pending' && <Loader2 className="h-3 w-3 mt-0.5 text-blue-500 animate-spin flex-shrink-0" />}
                        {step.status === 'success' && <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />}
                        {step.status === 'error' && <XCircle className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" />}
                        {step.status === 'info' && <Info className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />}
                        {step.status === 'warning' && <Info className="h-3 w-3 mt-0.5 text-yellow-500 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className={cn("break-words", step.status === 'error' && "text-destructive font-semibold", step.status === 'warning' && "text-yellow-600 dark:text-yellow-400")}>{step.message}</p>
                          {step.details && <p className="text-muted-foreground text-[0.6rem] whitespace-pre-wrap break-all">{step.details}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {logSteps.length === 0 && !isLoadingFlag && <p className="text-center text-muted-foreground text-[0.65rem] py-2">No log details for this operation.</p>}
                </ScrollArea>
                {logSteps.length > 0 && !isLoadingFlag && (
                  <div className="w-full flex justify-end mt-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopyLog(logSteps)} className="h-7 text-xs">
                      <Copy className="mr-1.5 h-3 w-3" /> Copy Log
                    </Button>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardFooter>
      )
    );
  }, [getLogTriggerContent, getLogAccordionItemClass, handleCopyLog, toast]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/data-explorer" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Link href="/data-explorer" passHref><Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer"><LayoutGrid className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Data Explorer</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/annotation" passHref><Button variant={pathname === '/annotation' ? "secondary": "ghost"} size="icon" aria-label="Annotation Page"><FilePenLine className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Annotation Page</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-2 md:p-3 space-y-3">
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base flex items-center gap-1.5">
               Open Data
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-1 md:grid-cols-12 gap-3">
            {!isApiPlotsExpanded && (
              <div className="md:col-span-4 space-y-3">
                  <Card>
                      <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary"/>Location & Date</CardTitle></CardHeader>
                      <CardContent className="space-y-2 p-3">
                          <div>
                              <UiLabel htmlFor={`om-location-select-${instanceId}`} className="text-xs font-medium mb-0.5 block">Select Location</UiLabel>
                              <Select
                                  value={selectedLocationKey}
                                  onValueChange={handleLocationChange}
                                  disabled={isLoadingApiData}
                              >
                                  <SelectTrigger id={`om-location-select-${instanceId}`} className="h-9 text-xs">
                                      <SelectValue placeholder="Select a location" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {Object.entries(knownOmLocations).map(([key, loc]) => (
                                          <SelectItem key={key} value={key} className="text-xs">
                                              {loc.name}
                                          </SelectItem>
                                      ))}
                                      {selectedLocationKey === "__custom__" && (
                                          <SelectItem value="__custom__" disabled className="text-xs font-medium">
                                            {currentLocationName}
                                          </SelectItem>
                                      )}
                                  </SelectContent>
                              </Select>
                          </div>
                          
                          <UiLabel htmlFor={`om-map-container-${instanceId}`} className="text-xs font-medium mb-0.5 block pt-1">Click Map to Select Location</UiLabel>
                          <div id={`om-map-container-${instanceId}`} className="h-[180px] w-full rounded-md overflow-hidden border">
                          <OpenLayersMapWithNoSSR
                              initialCenter={mapSelectedCoords ? [mapSelectedCoords.lon, mapSelectedCoords.lat] : [DEFAULT_OM_LONGITUDE, DEFAULT_OM_LATITUDE]}
                              initialZoom={DEFAULT_OM_MAP_ZOOM}
                              selectedCoords={mapSelectedCoords}
                              onLocationSelect={handleMapLocationSelect}
                          />
                          </div>
                          {mapSelectedCoords && (
                          <p className="text-xs text-muted-foreground text-center">
                              {currentLocationName} (Lat: {mapSelectedCoords.lat.toFixed(3)}, Lon: {mapSelectedCoords.lon.toFixed(3)})
                          </p>
                          )}

                          <div>
                          <UiLabel htmlFor={`om-date-range-${instanceId}`} className="text-xs font-medium mb-0.5 block pt-1">Date Range</UiLabel>
                          <DatePickerWithRange id={`om-date-range-${instanceId}`} date={dateRange} onDateChange={setDateRange} disabled={isLoadingApiData} />
                          {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                          </div>
                      </CardContent>
                  </Card>
                   <Card>
                      <CardHeader className="pb-2 pt-3 flex flex-row items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" />Select API Parameters</CardTitle>
                          <div className="flex items-center space-x-1.5">
                              <Checkbox
                                  id={`select-all-api-params-${instanceId}`}
                                  checked={allApiParamsSelected}
                                  onCheckedChange={(checked) => handleSelectAllApiParams(!!checked)}
                                  className="h-3.5 w-3.5"
                                  disabled={isLoadingApiData}
                                  aria-label={allApiParamsSelected ? "Deselect all API parameters" : "Select all API parameters"}
                              />
                              <UiLabel htmlFor={`select-all-api-params-${instanceId}`} className="text-xs font-medium cursor-pointer">
                                  {allApiParamsSelected ? "Deselect All" : "Select All"}
                              </UiLabel>
                          </div>
                      </CardHeader>
                      <CardContent className="p-2">
                          <ScrollArea className="h-48 w-full rounded-md border p-1">
                              {ALL_PARAMETERS.map((key) => {
                              const paramConfig = PARAMETER_CONFIG[key as CombinedParameterKey];
                              if (!paramConfig) return null;
                              const IconComp = plotConfigIcons[key as CombinedParameterKey] || Info;
                              const uniqueCheckboxId = `api-visibility-${key}-${instanceId}`;
                              return (
                                  <div key={key} className="flex items-center space-x-1.5 py-0.5">
                                  <Checkbox
                                      id={uniqueCheckboxId}
                                      checked={apiPlotVisibility[key as CombinedParameterKey]}
                                      onCheckedChange={(checked) => handleApiPlotVisibilityChange(key as CombinedParameterKey, !!checked)}
                                      className="h-3.5 w-3.5"
                                      disabled={isLoadingApiData}
                                  />
                                  <UiLabel htmlFor={uniqueCheckboxId} className="text-xs font-medium flex items-center gap-1 cursor-pointer">
                                      <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
                                      {paramConfig.name}
                                  </UiLabel>
                                  </div>
                              );
                              })}
                          </ScrollArea>
                      </CardContent>
                      <CardFooter className="p-3 pt-1">
                          <Button 
                              onClick={() => handleFetchApiData(false)} 
                              disabled={isLoadingApiData || !mapSelectedCoords || !dateRange?.from || !dateRange?.to || ALL_PARAMETERS.filter(key => apiPlotVisibility[key as CombinedParameterKey]).length === 0} 
                              className="w-full h-9 text-xs"
                          >
                          {isLoadingApiData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                          {isLoadingApiData ? "Fetching API Data..." : "Fetch API Data"}
                          </Button>
                      </CardFooter>
                      {renderLogAccordion(apiFetchLogSteps, showApiFetchLogAccordion, setShowApiFetchLogAccordion, isApiLogLoading, apiLogOverallStatus, "API Fetch Log", lastApiErrorRef.current)}
                  </Card>
              </div>
            )}
            <div className={cn("transition-all duration-300", isApiPlotsExpanded ? "md:col-span-12" : "md:col-span-8")}>
                 <Card className="shadow-sm h-full">
                    <CardHeader className="p-2 pt-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">{apiDataLocationContext || "Weather & Marine API Data Plots"}</CardTitle>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setIsApiPlotsExpanded(!isApiPlotsExpanded)}
                              aria-label={isApiPlotsExpanded ? "Collapse plot view" : "Expand plot"}
                              className="h-7 w-7"
                            >
                              {isApiPlotsExpanded ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p>{isApiPlotsExpanded ? "Show Controls" : "Expand plot"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </CardHeader>
                    <CardContent className="p-1.5 h-[calc(100%-2.5rem)]"> 
                        <MarinePlotsGrid
                        marineData={apiData} 
                        isLoading={isLoadingApiData}
                        error={errorApiData}
                        plotVisibility={apiPlotVisibility} 
                        handlePlotVisibilityChange={handleApiPlotVisibilityChange}
                        />
                    </CardContent>
                </Card>
            </div>
          </CardContent>
        </Card>
        
        <Separator className="my-4" />

        <div className="flex justify-center mb-3">
          <Button onClick={addPlot} size="sm" className="h-8 text-xs">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Plot (Device Data)
          </Button>
        </div>

        {plots.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground h-40 p-2 border rounded-md bg-muted/20">
            <LayoutGrid className="w-8 h-8 mb-2 text-muted" />
            <p className="text-xs">No device data plots to display.</p>
            <p className="text-[0.7rem]">Click "Add New Plot (Device Data)" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plots.map((plot) => (
              <PlotInstance
                key={plot.id}
                instanceId={plot.id}
                initialPlotTitle={plot.title}
                onRemovePlot={removePlot}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="py-2 md:px-3 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-1 md:h-10 md:flex-row">
          <p className="text-balance text-center text-[0.7rem] leading-loose text-muted-foreground">
            PEBL data app - Data Explorer. API data from Open-Meteo.
          </p>
        </div>
      </footer>
    </div>
  );
}
