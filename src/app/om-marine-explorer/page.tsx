
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo, useId } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label"; // Renamed to avoid conflict
import { Input } from "@/components/ui/input";
import { Loader2, SunMoon, LayoutGrid, Waves, Search, Info, CheckCircle2, XCircle, ListChecks, MapPin, CalendarDays, Thermometer, Compass as CompassIcon, Timer, Wind as WindIcon, CloudSun, Sailboat, Copy, Anchor, Sun as SunIcon, Droplets } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { MarinePlotsGrid } from "@/components/marine/MarinePlotsGrid"; // Updated import
import { useToast } from "@/hooks/use-toast";
import { format, formatISO, parseISO, subDays, addDays } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

import type { CombinedDataPoint, LogStep, CombinedParameterKey } from './shared';
import { ALL_PARAMETERS, PARAMETER_CONFIG } from './shared';
import { fetchCombinedDataAction } from './actions';

const OpenLayersMapWithNoSSR = dynamic(
  () => import('@/components/map/OpenLayersMap').then(mod => mod.OpenLayersMap),
  {
    ssr: false,
    loading: () => <p className="text-center p-4 text-muted-foreground">Loading map...</p>
  }
);

type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle' | 'warning';

// Default coordinates and known locations
const DEFAULT_LATITUDE = 51.7128; // Milford Haven
const DEFAULT_LONGITUDE = -5.0341;
const DEFAULT_MAP_ZOOM = 9;

const defaultLocationKey = "milfordhaven"; // Default to Milford Haven
const knownLocations: Record<string, { name: string; lat: number; lon: number }> = {
  milfordhaven: { name: "Milford Haven", lat: 51.7128, lon: -5.0341 },
  newlyn: { name: "Newlyn", lat: 50.102, lon: -5.549 },
  dover: { name: "Dover", lat: 51.123, lon: 1.317 },
  liverpool: { name: "Liverpool", lat: 53.408, lon: -2.992 },
  portsmouth: { name: "Portsmouth", lat: 50.819, lon: -1.088 },
  aberdeen: { name: "Aberdeen", lat: 57.149, lon: -2.094 },
  "stDavidsHead": { name: "St David's Head", lat: 52.0, lon: -5.3 },
};


export default function OMMarineExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  const instanceId = useId(); // For unique checkbox IDs

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: new Date("2025-05-17"),
    to: new Date("2025-05-20"),
  }));

  const [mapSelectedCoords, setMapSelectedCoords] = useState<{ lat: number; lon: number } | null>(
    knownLocations[defaultLocationKey]
      ? { lat: knownLocations[defaultLocationKey].lat, lon: knownLocations[defaultLocationKey].lon }
      : { lat: DEFAULT_LATITUDE, lon: DEFAULT_LONGITUDE }
  );
  const [currentLocationName, setCurrentLocationName] = useState<string>(
    knownLocations[defaultLocationKey]?.name || "Selected Location"
  );
  const [searchTerm, setSearchTerm] = useState<string>(knownLocations[defaultLocationKey]?.name || "");
  const [suggestions, setSuggestions] = useState<Array<{ key: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);


  const [combinedData, setCombinedData] = useState<CombinedDataPoint[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [dataLocationContext, setDataLocationContext] = useState<string | null>(null);

  const initialVisibility = useMemo(() => {
    return Object.fromEntries(
      ALL_PARAMETERS.map((key, index) => [key, index < 2]) // Default to first 2 parameters visible
    ) as Record<CombinedParameterKey, boolean>;
  }, []); // ALL_PARAMETERS is stable

  const [plotVisibility, setPlotVisibility] = useState<Record<CombinedParameterKey, boolean>>(initialVisibility);


  const [fetchLogSteps, setFetchLogSteps] = useState<LogStep[]>([]);
  const [showFetchLogAccordion, setShowFetchLogAccordion] = useState<string>("");
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [logOverallStatus, setLogOverallStatus] = useState<LogOverallStatus>('idle');

  const initialFetchDone = React.useRef(false);
  const lastErrorRef = useRef<string | null>(null);

  // Assign icons to PARAMETER_CONFIG entries
  useEffect(() => {
    // Marine Parameters
    if (PARAMETER_CONFIG.seaLevelHeightMsl) (PARAMETER_CONFIG.seaLevelHeightMsl as any).icon = Waves;
    if (PARAMETER_CONFIG.waveHeight) (PARAMETER_CONFIG.waveHeight as any).icon = Sailboat;
    if (PARAMETER_CONFIG.waveDirection) (PARAMETER_CONFIG.waveDirection as any).icon = CompassIcon;
    if (PARAMETER_CONFIG.wavePeriod) (PARAMETER_CONFIG.wavePeriod as any).icon = Timer;
    if (PARAMETER_CONFIG.seaSurfaceTemperature) (PARAMETER_CONFIG.seaSurfaceTemperature as any).icon = Thermometer;
    // Weather Parameters
    if (PARAMETER_CONFIG.temperature2m) (PARAMETER_CONFIG.temperature2m as any).icon = Thermometer;
    if (PARAMETER_CONFIG.windSpeed10m) (PARAMETER_CONFIG.windSpeed10m as any).icon = WindIcon;
    if (PARAMETER_CONFIG.windDirection10m) (PARAMETER_CONFIG.windDirection10m as any).icon = CompassIcon;
    if (PARAMETER_CONFIG.cloudCover) (PARAMETER_CONFIG.cloudCover as any).icon = CloudSun;
    if (PARAMETER_CONFIG.ghi) (PARAMETER_CONFIG.ghi as any).icon = SunIcon;

  }, []);

  const handleMapLocationSelect = useCallback((coords: { lat: number; lon: number }) => {
    setMapSelectedCoords(coords);
    let foundName = "Custom Location";
    for (const key in knownLocations) {
        if (knownLocations[key].lat.toFixed(3) === coords.lat.toFixed(3) && knownLocations[key].lon.toFixed(3) === coords.lon.toFixed(3)) {
            foundName = knownLocations[key].name;
            break;
        }
    }
    setCurrentLocationName(foundName);
    setSearchTerm(foundName); // Update search term as well
    toast({ title: "Location Selected on Map", description: `${foundName} (Lat: ${coords.lat.toFixed(3)}, Lon: ${coords.lon.toFixed(3)})` });
    setShowSuggestions(false);
  }, [toast]);


  const handleFetchCombinedData = useCallback(async (forceFetch: boolean = false) => {
    if (!mapSelectedCoords) {
        toast({ variant: "destructive", title: "Missing Location", description: "Please select a location on the map."});
        return;
    }
    if (!dateRange || !dateRange.from || !dateRange.to) {
        toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range."});
        return;
    }
    if (dateRange.from > dateRange.to) {
        toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
        return;
    }

    const selectedParams = ALL_PARAMETERS.filter(key => plotVisibility[key as CombinedParameterKey]);
    if (selectedParams.length === 0) {
        toast({ variant: "destructive", title: "No Parameters Selected", description: "Please select at least one parameter to fetch." });
        return;
    }

    setIsLoadingData(true); setErrorData(null); setCombinedData(null); setDataLocationContext(null);
    setFetchLogSteps([{message: `Fetching data for ${currentLocationName}...`, status: 'pending'}]);
    lastErrorRef.current = null;
    setIsLogLoading(true); setLogOverallStatus('pending'); setShowFetchLogAccordion("om-combined-fetch-log-item");

    let loadingToastId: string | undefined;
    if (forceFetch) { // Only show loading toast on manual fetch
      loadingToastId = toast({ title: "Fetching Data", description: `Fetching ${selectedParams.length} parameter(s) for ${currentLocationName}...`}).id;
    }

    try {
        const result = await fetchCombinedDataAction({
          latitude: mapSelectedCoords.lat,
          longitude: mapSelectedCoords.lon,
          startDate: formatISO(dateRange.from, { representation: 'date' }),
          endDate: formatISO(dateRange.to, { representation: 'date' }),
          parameters: selectedParams,
        });

        if(loadingToastId) dismiss(loadingToastId);
        setFetchLogSteps(result.log || []);
        setIsLogLoading(false); setIsLoadingData(false);

        if (result.success && result.data) {
            setCombinedData(result.data);
            setDataLocationContext(result.dataLocationContext || `Data for ${currentLocationName}`);
            
            // If it's an initial load, `initialFetchDone.current` would be false.
            // The plotVisibility is already set by initialVisibility or user interaction.
            // No need to reset plotVisibility here unless specifically required to revert to defaults.

            if (result.data.length === 0 && !result.error) {
                toast({ variant: "default", title: "No Data", description: "No data points found for the selected criteria.", duration: 4000 });
                setLogOverallStatus('warning');
                setShowFetchLogAccordion("om-combined-fetch-log-item");
            } else if (result.data.length === 0 && result.error) {
                toast({ variant: "default", title: "No Data", description: result.error, duration: 4000 });
                setErrorData(result.error);
                lastErrorRef.current = result.error;
                setLogOverallStatus('warning'); // Could be 'error' if API error is severe
                setShowFetchLogAccordion("om-combined-fetch-log-item");
            } else {
                if (forceFetch) { // Only show success toast on manual fetch
                  toast({ title: "Data Loaded", description: `Loaded ${result.data.length} data points for ${currentLocationName}.` });
                }
                setLogOverallStatus('success');
                if (result.data.length > 0 && !result.error && result.log.every(l => l.status !== 'error' && l.status !== 'warning')) {
                  setShowFetchLogAccordion(""); // Close log if truly all good
                } else {
                  setShowFetchLogAccordion("om-combined-fetch-log-item"); // Keep open if any warnings/errors in log
                }
            }
        } else {
            setErrorData(result.error || `Failed to load data.`);
            lastErrorRef.current = result.error || `Failed to load data.`;
            toast({ variant: "destructive", title: "Error Loading Data", description: result.error || `Failed to load data.` });
            setLogOverallStatus('error');
        }
    } catch (e) {
        if(loadingToastId) dismiss(loadingToastId);
        setIsLoadingData(false); setIsLogLoading(false);
        const errorMsg = e instanceof Error ? e.message : "An unknown error occurred during fetch.";
        setErrorData(errorMsg);
        lastErrorRef.current = errorMsg;
        setFetchLogSteps(prev => [...prev, {message: `Critical error in fetch operation: ${errorMsg}`, status: 'error'}]);
        toast({ variant: "destructive", title: "Critical Fetch Error", description: errorMsg });
        setLogOverallStatus('error');
    }
  // Removed mapSelectedCoords from dependency array to avoid re-triggering if it changes WHILE dateRange also changes.
  // The button click is the main trigger.
  }, [currentLocationName, dateRange, plotVisibility, toast, dismiss, mapSelectedCoords]);


  useEffect(() => {
    if (searchTerm === "") {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = Object.entries(knownLocations)
      .filter(([key, loc]) => key.toLowerCase().includes(lowerSearchTerm) || loc.name.toLowerCase().includes(lowerSearchTerm))
      .map(([key, loc]) => ({ key, name: loc.name }))
      .slice(0, 5); // Limit to 5 suggestions
    
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);

  }, [searchTerm]);

  // Effect for initial data load
  useEffect(() => {
    const defaultLocDetails = knownLocations[defaultLocationKey];
    if (defaultLocDetails && !initialFetchDone.current && mapSelectedCoords && dateRange?.from && dateRange?.to) {
        if (mapSelectedCoords.lat === defaultLocDetails.lat && mapSelectedCoords.lon === defaultLocDetails.lon) {
            if (dateRange.from <= dateRange.to) {
                initialFetchDone.current = true; // Set before async call
                handleFetchCombinedData(false); // Pass false for initial load
            }
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVisibility]); // Depends on initialVisibility to ensure it runs after plotVisibility is set

  const handleSuggestionClick = useCallback((locationKey: string) => {
    const selectedLoc = knownLocations[locationKey];
    if (selectedLoc) {
      setMapSelectedCoords({ lat: selectedLoc.lat, lon: selectedLoc.lon });
      setCurrentLocationName(selectedLoc.name);
      setSearchTerm(selectedLoc.name);
      setShowSuggestions(false);
      toast({ title: "Location Selected", description: `Selected ${selectedLoc.name}. Click 'Fetch Marine Data' to update.` });
    }
  }, [toast]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const getLogTriggerContent = useCallback((status: LogOverallStatus, isLoading: boolean, defaultTitle: string) => {
    if (isLoading) return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Fetching log...</>;
    
    const finalErrorMsg = lastErrorRef.current;

    if (status === 'success') return <><CheckCircle2 className="mr-2 h-3 w-3 text-green-500" />{defaultTitle}: Success</>;
    if (status === 'error') return <><XCircle className="mr-2 h-3 w-3 text-destructive" />{defaultTitle}: Failed {finalErrorMsg ? `(${finalErrorMsg.substring(0,30)}...)` : ''}</>;
    if (status === 'pending') return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />{defaultTitle}: In Progress</>;
    if (status === 'warning') return <><Info className="mr-2 h-3 w-3 text-yellow-500" />{defaultTitle}: Warning {finalErrorMsg ? `(${finalErrorMsg.substring(0,30)}...)` : ''}</>;
    return <><Info className="mr-2 h-3 w-3 text-muted-foreground" />{defaultTitle}</>;
  }, []);

  const getLogAccordionItemClass = useCallback((status: LogOverallStatus) => {
    if (status === 'pending') return "bg-blue-500/5 dark:bg-blue-500/10";
    if (status === 'success') return "bg-green-500/5 dark:bg-green-500/10";
    if (status === 'error') return "bg-destructive/10 dark:bg-destructive/20";
    if (status === 'warning') return "bg-yellow-500/5 dark:bg-yellow-500/10";
    return "";
  }, []);

  const handleCopyLog = useCallback(() => {
    if (fetchLogSteps.length === 0) {
      toast({ title: "Log Empty", description: "There are no log messages to copy.", duration: 3000 });
      return;
    }
    const logText = fetchLogSteps
      .map(step => `[${step.status.toUpperCase()}] ${step.message}${step.details ? `\n  Details: ${step.details}` : ''}`)
      .join('\n\n');

    navigator.clipboard.writeText(logText)
      .then(() => {
        toast({ title: "Log Copied", description: "Fetch log copied to clipboard.", duration: 3000 });
      })
      .catch(err => {
        console.error('Failed to copy log: ', err);
        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy log to clipboard.", duration: 3000 });
      });
  }, [fetchLogSteps, toast]);

  const renderLogAccordion = useCallback((
    logSteps: LogStep[],
    accordionValue: string,
    onValueChange: (value: string) => void,
    isLoading: boolean,
    overallStatus: LogOverallStatus,
    title: string
  ) => (
    (isLoading || logSteps.length > 0 || overallStatus === 'error' || overallStatus === 'warning') && (
      <CardFooter className="p-0 pt-2 flex flex-col items-stretch">
        <Accordion type="single" collapsible value={accordionValue} onValueChange={onValueChange} className="w-full">
          <AccordionItem value={title.toLowerCase().replace(/\s+/g, '-') + "-log-item"} className={cn("border rounded-md", getLogAccordionItemClass(overallStatus))}>
            <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline [&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3">
              {getLogTriggerContent(overallStatus, isLoading, title)}
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
                {logSteps.length === 0 && !isLoading && <p className="text-center text-muted-foreground text-[0.65rem] py-2">No log details for this operation.</p>}
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {logSteps.length > 0 && !isLoading && (
          <div className="w-full flex justify-end mt-2">
            <Button variant="outline" size="sm" onClick={handleCopyLog} className="h-7 text-xs">
              <Copy className="mr-1.5 h-3 w-3" /> Copy Log
            </Button>
          </div>
        )}
      </CardFooter>
    )
  ), [getLogAccordionItemClass, getLogTriggerContent, handleCopyLog]);
  
  const handlePlotVisibilityChange = useCallback((key: CombinedParameterKey, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/om-marine-explorer" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Link href="/data-explorer" passHref><Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer (CSV)"><LayoutGrid className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Data Explorer (CSV)</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/om-marine-explorer" passHref><Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="Weather & Marine Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Weather &amp; Marine Explorer</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-2 md:p-3">
        <Card className="mb-3">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Waves className="h-5 w-5 text-primary" />Weather &amp; Marine Data Explorer
            </CardTitle>
             <CardDescription className="text-xs">
                Select location and date range, choose parameters, then click &quot;Fetch Data&quot;.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 lg:col-span-3 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-base flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary"/>Location & Date</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3">
                <div className="relative" ref={suggestionsRef}>
                  <UiLabel htmlFor="om-combined-location-search" className="text-xs font-medium mb-0.5 block">Search Location</UiLabel>
                  <div className="flex gap-1">
                    <Input
                      id="om-combined-location-search"
                      type="text"
                      placeholder="e.g., London or SW1A"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true);}}
                      className="h-9 text-xs flex-grow"
                      disabled={isLoadingData}
                    />
                  </div>
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 border bg-card shadow-lg rounded-md max-h-60 overflow-y-auto">
                      {suggestions.map(loc => (
                        <button
                          key={loc.key}
                          onClick={() => handleSuggestionClick(loc.key)}
                          className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <UiLabel htmlFor="om-map-container" className="text-xs font-medium mb-0.5 block pt-1">Click Map to Select Location</UiLabel>
                <div id="om-map-container" className="h-[180px] w-full rounded-md overflow-hidden border">
                  <OpenLayersMapWithNoSSR
                    initialCenter={mapSelectedCoords ? [mapSelectedCoords.lon, mapSelectedCoords.lat] : [DEFAULT_LONGITUDE, DEFAULT_LATITUDE]}
                    initialZoom={DEFAULT_MAP_ZOOM}
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
                  <UiLabel htmlFor="om-combined-date-range" className="text-xs font-medium mb-0.5 block pt-1">Date Range</UiLabel>
                  <DatePickerWithRange id="om-combined-date-range" date={dateRange} onDateChange={setDateRange} disabled={isLoadingData} />
                  {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                </div>
                 <Button onClick={() => handleFetchCombinedData(true)} disabled={isLoadingData || !mapSelectedCoords || !dateRange?.from || !dateRange?.to || ALL_PARAMETERS.filter(key => plotVisibility[key as CombinedParameterKey]).length === 0} className="w-full h-9 text-xs mt-2">
                  {isLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                  {isLoadingData ? "Fetching..." : "Fetch Data"}
                </Button>
                 {renderLogAccordion(fetchLogSteps, showFetchLogAccordion, setShowFetchLogAccordion, isLogLoading, logOverallStatus, "Fetch Log")}
              </CardContent>
            </Card>
            
            <Card>
                <CardHeader className="pb-2 pt-3"><CardTitle className="text-base flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" />Select Parameters</CardTitle></CardHeader>
                <CardContent className="space-y-0.5 max-h-60 overflow-y-auto p-2">
                    {ALL_PARAMETERS.map((key) => {
                        const paramConfig = PARAMETER_CONFIG[key as CombinedParameterKey];
                        if (!paramConfig) return null; 
                        const IconComp = (paramConfig as { icon?: LucideIcon }).icon || Info;
                        const uniqueCheckboxId = `visibility-${key}-${instanceId}`;
                        return (
                            <div key={key} className="flex items-center space-x-1.5 py-0.5">
                                <Checkbox
                                    id={uniqueCheckboxId} 
                                    checked={plotVisibility[key as CombinedParameterKey]}
                                    onCheckedChange={(checked) => handlePlotVisibilityChange(key as CombinedParameterKey, !!checked)}
                                    className="h-3.5 w-3.5"
                                    disabled={isLoadingData}
                                />
                                <UiLabel htmlFor={uniqueCheckboxId} className="text-xs font-medium flex items-center gap-1 cursor-pointer">
                                    <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
                                    {paramConfig.name}
                                </UiLabel>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-sm h-full">
              <CardHeader className="p-2 pt-3"><CardTitle className="text-base">{dataLocationContext || "Weather & Marine Data Plots"}</CardTitle></CardHeader>
              <CardContent className="p-1.5 h-[calc(100%-2.5rem)]">
                <MarinePlotsGrid
                    marineData={combinedData}
                    isLoading={isLoadingData}
                    error={errorData}
                    plotVisibility={plotVisibility}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="py-2 md:px-3 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-1 md:h-10 md:flex-row">
          <p className="text-balance text-center text-[0.7rem] leading-loose text-muted-foreground">
            Weather &amp; Marine data from Open-Meteo.
          </p>
        </div>
      </footer>
    </div>
  );
}

