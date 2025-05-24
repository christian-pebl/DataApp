
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label"; // Renamed to avoid conflict
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, Search, Info, CheckCircle2, XCircle, MapPin, CalendarDays, Copy, Anchor } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay"; 
import { useToast } from "@/hooks/use-toast";
import { formatISO, subDays } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

import type { TideExplorerDataPoint, LogStep, FetchTideExplorerInput } from './shared';
import { fetchTideExplorerDataAction } from './actions';

type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle' | 'warning';

const knownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "newlyn": { lat: 50.10, lon: -5.55, name: "Newlyn" }, // Primary tidal observatory
  "stdavidshead": { lat: 52.0, lon: -5.3, name: "St David's Head" },
  "milfordhaven": { lat: 51.71, lon: -5.04, name: "Milford Haven" },
  "dover": { lat: 51.12, lon: 1.32, name: "Dover" },
  "liverpool": { lat: 53.40, lon: -2.99, name: "Liverpool" },
  "portsmouth": { lat: 50.81, lon: -1.08, name: "Portsmouth" },
};
const defaultLocationKey = "newlyn"; // Changed default to Newlyn

export default function TideExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  
  // Default to a historical date range
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 37), 
    to: subDays(new Date(), 30),
  }));

  const [searchTerm, setSearchTerm] = useState("");
  const [initialCoords, setInitialCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ key: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);
  const [currentLocationKey, setCurrentLocationKey] = useState<string | null>(defaultLocationKey);


  const [tideData, setTideData] = useState<TideExplorerDataPoint[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [dataLocationContext, setDataLocationContext] = useState<string | null>(null);
  
  const [fetchLogSteps, setFetchLogSteps] = useState<LogStep[]>([]);
  const [showFetchLogAccordion, setShowFetchLogAccordion] = useState<string>("");
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [logOverallStatus, setLogOverallStatus] = useState<LogOverallStatus>('idle');
  
  const initialFetchDone = React.useRef(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const getLogTriggerContent = (status: LogOverallStatus, isLoading: boolean, defaultTitle: string, lastError?: string) => {
    if (isLoading) return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Fetching log...</>;
    if (status === 'success') return <><CheckCircle2 className="mr-2 h-3 w-3 text-green-500" />{defaultTitle}: Success</>;
    if (status === 'error') return <><XCircle className="mr-2 h-3 w-3 text-destructive" />{defaultTitle}: Failed {lastError ? `(${lastError.substring(0,30)}...)` : ''}</>;
    if (status === 'pending') return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />{defaultTitle}: In Progress</>;
    if (status === 'warning') return <><Info className="mr-2 h-3 w-3 text-yellow-500" />{defaultTitle}: Warning</>;
    return <><Info className="mr-2 h-3 w-3 text-muted-foreground" />{defaultTitle}</>;
  };
  
  const getLogAccordionItemClass = (status: LogOverallStatus) => {
    if (status === 'pending') return "bg-blue-500/5 dark:bg-blue-500/10";
    if (status === 'success') return "bg-green-500/5 dark:bg-green-500/10";
    if (status === 'error') return "bg-destructive/10 dark:bg-destructive/20";
    if (status === 'warning') return "bg-yellow-500/5 dark:bg-yellow-500/10";
    return "";
  };

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

  const renderLogAccordion = (
    logSteps: LogStep[], 
    accordionValue: string, 
    onValueChange: (value: string) => void, 
    isLoading: boolean, 
    overallStatus: LogOverallStatus, 
    title: string, 
    errorDetails?: string | null
  ) => (
    (isLoading || logSteps.length > 0 || overallStatus === 'error' || overallStatus === 'warning') && (
      <CardFooter className="p-0 pt-2 flex flex-col items-stretch">
        <Accordion type="single" collapsible value={accordionValue} onValueChange={onValueChange} className="w-full">
          <AccordionItem value={title.toLowerCase().replace(/\s+/g, '-') + "-log-item"} className={cn("border rounded-md", getLogAccordionItemClass(overallStatus))}>
            <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline [&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3">
              {getLogTriggerContent(overallStatus, isLoading, title, errorDetails || undefined)}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-1 pt-0 max-h-[35rem]">
              <ScrollArea className="h-full w-full rounded-md border bg-muted/30 dark:bg-muted/10 p-1.5 mt-1">
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
          <Button variant="outline" size="sm" onClick={handleCopyLog} className="mt-2 h-7 text-xs self-end">
            <Copy className="mr-1.5 h-3 w-3" /> Copy Log
          </Button>
        )}
      </CardFooter>
    )
  );

  const handleLocationSearchAndFetch = useCallback(async (
    coordsOverride?: { latitude: number; longitude: number },
    nameOverride?: string,
    isAutoFetch: boolean = false
  ) => {
    const term = searchTerm.trim().toLowerCase();
    setShowSuggestions(false);
    
    let coordsToUse: { latitude: number; longitude: number } | null = coordsOverride || initialCoords;
    let locationNameToUse: string | null = nameOverride || currentLocationName;

    if (!isAutoFetch && !coordsOverride) { 
      if (!term) {
        toast({ variant: "destructive", title: "Search Error", description: "Please enter a location." });
        return;
      }
      const locationKeyFound = Object.keys(knownLocations).find(
        key => key.toLowerCase() === term || knownLocations[key].name.toLowerCase() === term
      );

      if (locationKeyFound) {
        const location = knownLocations[locationKeyFound];
        coordsToUse = { latitude: location.lat, longitude: location.lon };
        locationNameToUse = location.name;
        setCurrentLocationKey(locationKeyFound);
        setInitialCoords(coordsToUse); 
        setCurrentLocationName(locationNameToUse);
        if (location.name !== searchTerm) setSearchTerm(location.name);
      } else {
         toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known coastal location." });
         return;
      }
    }

    if (!coordsToUse || !locationNameToUse) {
      if(!isAutoFetch) toast({ variant: "destructive", title: "Missing Location", description: "Could not determine coordinates for fetching."});
      return;
    }
    if (!dateRange || !dateRange.from || !dateRange.to) {
      if(!isAutoFetch) toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range."});
      return;
    }
    if (dateRange.from > dateRange.to) {
      if(!isAutoFetch) toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
      return;
    }

    setIsLoadingData(true); setErrorData(null); setTideData(null); setDataLocationContext(null);
    setFetchLogSteps([{message: `Fetching tide data for ${locationNameToUse}...`, status: 'pending'}]); 
    setIsLogLoading(true); setLogOverallStatus('pending'); setShowFetchLogAccordion("tide-fetch-log-item");
    
    const loadingToastId = !isAutoFetch ? toast({ title: "Fetching Tide Data", description: `Fetching tide data for ${locationNameToUse}...`}).id : undefined;
    
    const result = await fetchTideExplorerDataAction({
      latitude: coordsToUse.latitude,
      longitude: coordsToUse.longitude,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
    });
    
    if(loadingToastId) dismiss(loadingToastId);
    setFetchLogSteps(result.log || []);
    setIsLoadingData(false); setIsLogLoading(false);

    if (result.success && result.data) {
      setTideData(result.data);
      setDataLocationContext(result.dataLocationContext || `Tide data for ${locationNameToUse}`);
      if (result.data.length === 0 && !result.error) { 
        if(!isAutoFetch) toast({ variant: "default", title: "No Data", description: "No tide data points found for the selected criteria.", duration: 4000 });
        setLogOverallStatus('warning');
      } else if (result.data.length === 0 && result.error) {
         if(!isAutoFetch) toast({ variant: "default", title: "No Data", description: result.error, duration: 4000 });
         setLogOverallStatus('warning');
      } else {
        if(!isAutoFetch) toast({ title: "Tide Data Loaded", description: `Loaded ${result.data.length} tide data points for ${locationNameToUse}.` });
        setLogOverallStatus('success'); setShowFetchLogAccordion("");
      }
    } else {
      setErrorData(result.error || `Failed to load tide data for ${locationNameToUse}.`);
      if(!isAutoFetch) toast({ variant: "destructive", title: "Error Loading Tide Data", description: result.error || `Failed to load data for ${locationNameToUse}.` });
      setLogOverallStatus('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, initialCoords, currentLocationName, dateRange, toast, dismiss]);

  useEffect(() => {
    const defaultLoc = knownLocations[defaultLocationKey];
    if (defaultLoc) {
      setSearchTerm(defaultLoc.name);
      setCurrentLocationKey(defaultLocationKey);
      const coords = { latitude: defaultLoc.lat, longitude: defaultLoc.lon };
      setInitialCoords(coords);
      setCurrentLocationName(defaultLoc.name);
      if (!initialFetchDone.current && coords && dateRange?.from && dateRange?.to) {
        handleLocationSearchAndFetch(coords, defaultLoc.name, true);
        initialFetchDone.current = true;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Auto-fetch on mount for default location

  useEffect(() => {
    const currentSearchTermVal = searchTerm.trim();
    const inputElement = document.activeElement as HTMLInputElement;
    const isFocused = inputElement && inputElement.id === "tide-location-search";


    if (currentSearchTermVal === "" && isFocused) {
       setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
       setShowSuggestions(true); return;
    }
    if (currentSearchTermVal === "") { setSuggestions([]); setShowSuggestions(false); return; }

    const termLower = currentSearchTermVal.toLowerCase();
    const filtered = Object.entries(knownLocations)
      .filter(([key, locObj]) => key.toLowerCase().includes(termLower) || locObj.name.toLowerCase().includes(termLower))
      .map(([key, locObj]) => ({ key, name: locObj.name }));
    setSuggestions(filtered.slice(0, 5));
    setShowSuggestions(filtered.length > 0 && isFocused);
  }, [searchTerm]);

  const handleSuggestionClick = useCallback((suggestionKey: string) => {
    const location = knownLocations[suggestionKey];
    if (location) {
      setSearchTerm(location.name); 
      setCurrentLocationKey(suggestionKey);
      const newCoords = { latitude: location.lat, longitude: location.lon };
      setInitialCoords(newCoords); 
      setCurrentLocationName(location.name);
      setShowSuggestions(false);
      // Auto-fetch on suggestion click if date range is valid
      if (dateRange?.from && dateRange?.to) {
        handleLocationSearchAndFetch(newCoords, location.name, false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, handleLocationSearchAndFetch]); 

  const yAxisConfigs: YAxisConfig[] = [
    { id: 'seaLevel', orientation: 'left', label: 'Sea Level (m)', color: '--chart-1', dataKey: 'seaLevel', unit: 'm' }
  ];


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
              <Tooltip><TooltipTrigger asChild><Link href="/weather" passHref><Button variant={pathname === '/weather' ? "secondary": "ghost"} size="icon" aria-label="Weather Page"><CloudSun className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Weather Page</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/om-marine-explorer" passHref><Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="OM Marine Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>OM Marine Explorer</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/tide-explorer" passHref><Button variant={pathname === '/tide-explorer' ? "secondary": "ghost"} size="icon" aria-label="Tide Explorer"><Anchor className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Tide Explorer</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-3 md:p-4">
        <Card className="mb-4">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Anchor className="h-5 w-5 text-primary" />Open-Meteo Tide Explorer
            </CardTitle>
             <CardDescription className="text-xs">
                Select a coastal location and date range to fetch and visualize tide data (sea level height).
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 lg:col-span-3 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary"/>Location & Date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="relative">
                  <UiLabel htmlFor="tide-location-search" className="text-xs font-medium mb-0.5 block">Location Search</UiLabel>
                  <Input 
                    id="tide-location-search"
                    type="text" 
                    placeholder="Search UK coastal location..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} 
                    onKeyDown={(e) => { if (e.key === 'Enter') { handleLocationSearchAndFetch(undefined, undefined, false); setShowSuggestions(false); } }}
                    className="h-9 text-xs" />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-0 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {suggestions.map((s) => <button key={s.key} type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted focus:bg-muted focus:outline-none" onClick={() => handleSuggestionClick(s.key)} onMouseDown={(e) => e.preventDefault() }>{s.name}</button>)}
                    </div>
                  )}
                </div>
                {initialCoords && <p className="text-xs text-muted-foreground text-center">Lat: {initialCoords.latitude.toFixed(3)}, Lon: {initialCoords.longitude.toFixed(3)}</p>}
                <div>
                  <UiLabel htmlFor="tide-date-range" className="text-xs font-medium mb-0.5 block">Date Range</UiLabel>
                  <DatePickerWithRange id="tide-date-range" date={dateRange} onDateChange={setDateRange} disabled={isLoadingData} />
                  {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                </div>
                <Button onClick={() => handleLocationSearchAndFetch(undefined, undefined, false)} disabled={isLoadingData || !searchTerm || !dateRange?.from || !dateRange?.to} className="w-full h-9 text-xs">
                  {isLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                  {isLoadingData ? "Fetching Tide Data..." : "Fetch Tide Data"}
                </Button>
                 {renderLogAccordion(fetchLogSteps, showFetchLogAccordion, setShowFetchLogAccordion, isLogLoading, logOverallStatus, "Tide Fetch Log", errorData)}
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-sm h-full">
              <CardHeader className="p-2 pt-3"><CardTitle className="text-base">{dataLocationContext || "Tide Data Plot"}</CardTitle></CardHeader>
              <CardContent className="p-1.5 h-[calc(100%-2.5rem)]"> 
                <ChartDisplay
                    data={tideData || []}
                    plottableSeries={['seaLevel']}
                    yAxisConfigs={yAxisConfigs}
                    timeAxisLabel="Time"
                    plotTitle={dataLocationContext || "Tide Height"}
                    chartRenderHeight={350} 
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Tide data from Open-Meteo.
          </p>
        </div>
      </footer>
    </div>
  );
}
