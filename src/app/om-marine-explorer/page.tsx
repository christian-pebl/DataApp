
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, Search, Info, CheckCircle2, XCircle, ListChecks, FileText, MapPin, CalendarDays, Sailboat, Compass, Timer, Thermometer, Wind, Copy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { MarinePlotsGrid } from "@/components/marine/MarinePlotsGrid";
import { useToast } from "@/hooks/use-toast";
import { formatISO, subDays } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

import type { MarineDataPoint, LogStep, MarineParameterKey } from './shared';
import { ALL_MARINE_PARAMETERS, MARINE_PARAMETER_CONFIG } from './shared';
import { fetchOpenMeteoMarineDataAction } from './actions';

type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle' | 'warning';

const knownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "milfordhaven": { lat: 51.71, lon: -5.04, name: "Milford Haven" },
  "stdavidshead": { lat: 52.0, lon: -5.3, name: "St David's Head" },
  "newlyn": { lat: 50.10, lon: -5.55, name: "Newlyn" },
  "dover": { lat: 51.12, lon: 1.32, name: "Dover" },
  "liverpool": { lat: 53.40, lon: -2.99, name: "Liverpool" },
  "portsmouth": { lat: 50.81, lon: -1.08, name: "Portsmouth" },
};
const defaultLocationKey = "stdavidshead";

MARINE_PARAMETER_CONFIG.seaLevel.icon = Waves;
MARINE_PARAMETER_CONFIG.waveHeight.icon = Sailboat;
MARINE_PARAMETER_CONFIG.waveDirection.icon = Compass;
MARINE_PARAMETER_CONFIG.wavePeriod.icon = Timer;
if (MARINE_PARAMETER_CONFIG.seaSurfaceTemperature) {
  MARINE_PARAMETER_CONFIG.seaSurfaceTemperature.icon = Thermometer;
}
if (MARINE_PARAMETER_CONFIG.windSpeed10m) {
  MARINE_PARAMETER_CONFIG.windSpeed10m.icon = Wind;
}

export default function OMMarineExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7), to: new Date(),
  }));

  const [searchTerm, setSearchTerm] = useState("");
  const [initialCoords, setInitialCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ key: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);

  const [marineData, setMarineData] = useState<MarineDataPoint[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [dataLocationContext, setDataLocationContext] = useState<string | null>(null);
  
  const initialVisibility = Object.fromEntries(ALL_MARINE_PARAMETERS.map(key => [key, true])) as Record<MarineParameterKey, boolean>;
  const [plotVisibility, setPlotVisibility] = useState<Record<MarineParameterKey, boolean>>(initialVisibility);
  
  const [fetchLogSteps, setFetchLogSteps] = useState<LogStep[]>([]);
  const [showFetchLogAccordion, setShowFetchLogAccordion] = useState<string>(""); // Accordion value, e.g., "item-1"
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
          <Button variant="outline" size="sm" onClick={handleCopyLog} className="mt-2 h-7 text-xs self-end">
            <Copy className="mr-1.5 h-3 w-3" /> Copy Log
          </Button>
        )}
      </CardFooter>
    )
  );

  useEffect(() => {
    const defaultLoc = knownLocations[defaultLocationKey];
    if (defaultLoc) {
      setSearchTerm(defaultLoc.name);
      const coords = { latitude: defaultLoc.lat, longitude: defaultLoc.lon };
      setInitialCoords(coords);
      setCurrentLocationName(defaultLoc.name);
      if (!initialFetchDone.current && coords && dateRange?.from && dateRange?.to) {
        handleLocationSearchAndFetch(coords, defaultLoc.name, true);
        initialFetchDone.current = true;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]); 

  useEffect(() => {
    const currentSearchTerm = searchTerm.trim();
    const inputElement = document.activeElement as HTMLInputElement;
    const isFocused = inputElement && inputElement.placeholder === "Search UK coastal location...";

    if (currentSearchTerm === "" && isFocused) {
       setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
       setShowSuggestions(true); return;
    }
    if (currentSearchTerm === "") { setSuggestions([]); setShowSuggestions(false); return; }

    const termLower = currentSearchTerm.toLowerCase();
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
      setInitialCoords({ latitude: location.lat, longitude: location.lon }); 
      setCurrentLocationName(location.name);
      setShowSuggestions(false);
    }
  }, []); 

  const handlePlotVisibilityChange = useCallback((key: MarineParameterKey, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

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
      const locationKey = Object.keys(knownLocations).find(
        key => key.toLowerCase() === term || knownLocations[key].name.toLowerCase() === term
      );

      if (locationKey) {
        const location = knownLocations[locationKey];
        coordsToUse = { latitude: location.lat, longitude: location.lon };
        locationNameToUse = location.name;
        setInitialCoords(coordsToUse); 
        setCurrentLocationName(locationNameToUse);
        if (location.name !== searchTerm) setSearchTerm(location.name);
      } else {
         toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known coastal location." });
         return;
      }
    }

    if (!coordsToUse || !locationNameToUse) {
      toast({ variant: "destructive", title: "Missing Location", description: "Could not determine coordinates for fetching."});
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
    const selectedParams = ALL_MARINE_PARAMETERS.filter(key => plotVisibility[key]);
    if (selectedParams.length === 0) {
      toast({ variant: "destructive", title: "No Parameters Selected", description: "Please select at least one marine parameter to fetch." });
      return;
    }

    setIsLoadingData(true); setErrorData(null); setMarineData(null); setDataLocationContext(null);
    setFetchLogSteps([{message: `Fetching marine data for ${locationNameToUse}...`, status: 'pending'}]); 
    setIsLogLoading(true); setLogOverallStatus('pending'); setShowFetchLogAccordion("om-fetch-log-item");
    
    const loadingToastId = toast({ title: "Fetching Data", description: `Fetching marine data for ${locationNameToUse}...`}).id;
    
    const result = await fetchOpenMeteoMarineDataAction({
      latitude: coordsToUse.latitude,
      longitude: coordsToUse.longitude,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
      parameters: selectedParams,
    });
    
    if(loadingToastId) dismiss(loadingToastId);
    setFetchLogSteps(result.log || []);
    setIsLoadingData(false); setIsLogLoading(false);

    if (result.success && result.data) {
      setMarineData(result.data);
      setDataLocationContext(result.dataLocationContext || `Marine data for ${locationNameToUse}`);
      if (result.data.length === 0 && !result.error) { 
        toast({ variant: "default", title: "No Data", description: "No marine data points found for the selected criteria.", duration: 4000 });
        setLogOverallStatus('warning');
      } else if (result.data.length === 0 && result.error) { 
         toast({ variant: "default", title: "No Data", description: result.error, duration: 4000 });
         setLogOverallStatus('warning');
      } else {
        toast({ title: "Data Loaded", description: `Loaded ${result.data.length} marine data points for ${locationNameToUse}.` });
        setLogOverallStatus('success'); setShowFetchLogAccordion("");
      }
    } else {
      setErrorData(result.error || `Failed to load marine data for ${locationNameToUse}.`);
      toast({ variant: "destructive", title: "Error Loading Data", description: result.error || `Failed to load data for ${locationNameToUse}.` });
      setLogOverallStatus('error');
    }
  }, [searchTerm, initialCoords, currentLocationName, dateRange, plotVisibility, toast, dismiss]);

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
              <Waves className="h-5 w-5 text-primary" />Open-Meteo Marine Data Explorer
            </CardTitle>
             <CardDescription className="text-xs">
                Select desired parameters, a coastal location, and a date range to fetch and visualize marine data.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 lg:col-span-3 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-base flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" />Select Parameters</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {ALL_MARINE_PARAMETERS.map((key) => {
                  const paramConfig = MARINE_PARAMETER_CONFIG[key];
                  const IconComp = paramConfig.icon || Info; 
                  return (
                    <div key={key} className="flex items-center space-x-1.5">
                      <Checkbox id={`om-visibility-${key}`} checked={plotVisibility[key]} onCheckedChange={(c) => handlePlotVisibilityChange(key, !!c)} className="h-3.5 w-3.5"/>
                      <UiLabel htmlFor={`om-visibility-${key}`} className="text-xs font-medium flex items-center gap-1 cursor-pointer"><IconComp className="h-3.5 w-3.5 text-muted-foreground"/>{paramConfig.name}</UiLabel>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary"/>Location & Date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="relative">
                  <Input type="text" placeholder="Search UK coastal location..." value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         onFocus={() => setShowSuggestions(true)}
                         onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} 
                         onKeyDown={(e) => { if (e.key === 'Enter') { handleLocationSearchAndFetch(); setShowSuggestions(false); } }}
                         className="h-9 text-xs" />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-0 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {suggestions.map((s) => <button key={s.key} type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted focus:bg-muted focus:outline-none" onClick={() => handleSuggestionClick(s.key)} onMouseDown={(e) => e.preventDefault() }>{s.name}</button>)}
                    </div>
                  )}
                </div>
                {initialCoords && <p className="text-xs text-muted-foreground text-center">Lat: {initialCoords.latitude.toFixed(3)}, Lon: {initialCoords.longitude.toFixed(3)}</p>}
                <div>
                  <UiLabel htmlFor="om-date-range" className="text-xs font-medium mb-0.5 block">Date Range</UiLabel>
                  <DatePickerWithRange id="om-date-range" date={dateRange} onDateChange={setDateRange} disabled={isLoadingData} />
                  {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                </div>
                <Button onClick={() => handleLocationSearchAndFetch()} disabled={isLoadingData || !searchTerm || !dateRange?.from || !dateRange?.to || ALL_MARINE_PARAMETERS.filter(key => plotVisibility[key]).length === 0} className="w-full h-9 text-xs">
                  {isLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                  {isLoadingData ? "Fetching..." : "Fetch Marine Data"}
                </Button>
                 {renderLogAccordion(fetchLogSteps, showFetchLogAccordion, setShowFetchLogAccordion, isLogLoading, logOverallStatus, "OM Marine Fetch Log", errorData)}
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-sm h-full">
              <CardHeader className="p-2 pt-3"><CardTitle className="text-base">{dataLocationContext || "Open-Meteo Marine Data Plots"}</CardTitle></CardHeader>
              <CardContent className="p-1.5 h-[calc(100%-2.5rem)]"> 
                <MarinePlotsGrid 
                    marineData={marineData} 
                    isLoading={isLoadingData} 
                    error={errorData} 
                    plotVisibility={plotVisibility}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Marine data from Open-Meteo. Data Explorer. Weather.
          </p>
        </div>
      </footer>
    </div>
  );
}

    