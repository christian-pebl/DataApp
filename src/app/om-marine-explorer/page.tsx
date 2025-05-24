
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, Search, Info, CheckCircle2, XCircle, ListChecks, FileText, MapPin, CalendarDays, Sailboat, Compass, Timer, Thermometer, Copy, Anchor } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { MarinePlotsGrid } from "@/components/marine/MarinePlotsGrid"; // Will be adapted to CombinedPlotsGrid conceptually
import { useToast } from "@/hooks/use-toast";
import { formatISO, subDays } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

import type { CombinedDataPoint, LogStep, CombinedParameterKey } from './shared';
import { ALL_PARAMETERS, PARAMETER_CONFIG } from './shared';
import { fetchCombinedDataAction } from './actions';

type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle' | 'warning';

const knownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "milfordhaven": { lat: 51.7128, lon: -5.0341, name: "Milford Haven" },
  "stdavidshead": { lat: 52.0, lon: -5.3, name: "St David's Head" },
  "newlyn": { lat: 50.10, lon: -5.55, name: "Newlyn" },
  "dover": { lat: 51.12, lon: 1.32, name: "Dover" },
  "liverpool": { lat: 53.40, lon: -2.99, name: "Liverpool" },
  "portsmouth": { lat: 50.81, lon: -1.08, name: "Portsmouth" },
};
const defaultLocationKey = "milfordhaven"; // Sticking with Milford Haven

// Assign icons to parameter configs
(PARAMETER_CONFIG.waveHeight as { icon?: LucideIcon }).icon = Sailboat;
(PARAMETER_CONFIG.waveDirection as { icon?: LucideIcon }).icon = Compass;
(PARAMETER_CONFIG.wavePeriod as { icon?: LucideIcon }).icon = Timer;
if (PARAMETER_CONFIG.seaSurfaceTemperature) {
  (PARAMETER_CONFIG.seaSurfaceTemperature as { icon?: LucideIcon }).icon = Thermometer;
}
if (PARAMETER_CONFIG.seaLevelHeightMsl) {
  (PARAMETER_CONFIG.seaLevelHeightMsl as { icon?: LucideIcon }).icon = Waves;
}
// Weather icons
if (PARAMETER_CONFIG.temperature2m) {
  (PARAMETER_CONFIG.temperature2m as { icon?: LucideIcon }).icon = Thermometer;
}
if (PARAMETER_CONFIG.windSpeed10m) {
  (PARAMETER_CONFIG.windSpeed10m as { icon?: LucideIcon }).icon = Wind;
}
if (PARAMETER_CONFIG.windDirection10m) {
  (PARAMETER_CONFIG.windDirection10m as { icon?: LucideIcon }).icon = Compass;
}
if (PARAMETER_CONFIG.cloudCover) {
  (PARAMETER_CONFIG.cloudCover as { icon?: LucideIcon }).icon = CloudSun; // Re-using CloudSun for general cloud cover
}


export default function WeatherAndMarineExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: new Date("2025-05-17"), 
    to: new Date("2025-05-20"),
  }));

  const [searchTerm, setSearchTerm] = useState(() => knownLocations[defaultLocationKey]?.name || "");
  const [initialCoords, setInitialCoords] = useState<{ latitude: number; longitude: number } | null>(() => {
    const loc = knownLocations[defaultLocationKey];
    return loc ? { latitude: loc.lat, longitude: loc.lon } : null;
  });
  const [suggestions, setSuggestions] = useState<Array<{ key: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(() => knownLocations[defaultLocationKey]?.name || null);

  const [combinedData, setCombinedData] = useState<CombinedDataPoint[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [dataLocationContext, setDataLocationContext] = useState<string | null>(null);
  
  const initialVisibility = Object.fromEntries(ALL_PARAMETERS.map(key => [key, true])) as Record<CombinedParameterKey, boolean>;
  const [plotVisibility, setPlotVisibility] = useState<Record<CombinedParameterKey, boolean>>(initialVisibility);
  
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

  const handlePlotVisibilityChange = useCallback((key: CombinedParameterKey, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  const handleLocationSearchAndFetch = useCallback(async (
    coordsOverride?: { latitude: number; longitude: number },
    nameOverride?: string,
    isAutoFetch: boolean = false 
  ) => {
    const currentSearchTermValue = isAutoFetch && nameOverride ? nameOverride : searchTerm.trim().toLowerCase();
    
    setShowSuggestions(false);
    
    let coordsToUse: { latitude: number; longitude: number } | null = coordsOverride || initialCoords;
    let locationNameToUse: string | null = nameOverride || currentLocationName;

    if (!isAutoFetch && !coordsOverride) { 
      if (!currentSearchTermValue) {
        toast({ variant: "destructive", title: "Search Error", description: "Please enter a location." });
        return;
      }
      const locationKey = Object.keys(knownLocations).find(
        key => key.toLowerCase() === currentSearchTermValue || knownLocations[key].name.toLowerCase() === currentSearchTermValue
      );

      if (locationKey) {
        const location = knownLocations[locationKey];
        coordsToUse = { latitude: location.lat, longitude: location.lon };
        locationNameToUse = location.name;
        
        if (initialCoords?.latitude !== coordsToUse.latitude || initialCoords?.longitude !== coordsToUse.longitude) {
            setInitialCoords(coordsToUse); 
        }
        if (currentLocationName !== locationNameToUse) {
            setCurrentLocationName(locationNameToUse);
        }
        if (location.name !== searchTerm) setSearchTerm(location.name);
      } else {
         toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known coastal location." });
         return;
      }
    }

    if (!coordsToUse || !locationNameToUse) {
      if (!isAutoFetch) { 
          toast({ variant: "destructive", title: "Missing Location", description: "Could not determine coordinates for fetching."});
      }
      return;
    }
    if (!dateRange || !dateRange.from || !dateRange.to) {
      if (!isAutoFetch) {
          toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range."});
      }
      return;
    }
    if (dateRange.from > dateRange.to) {
      if (!isAutoFetch) {
          toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
      }
      return;
    }
    
    const currentPlotVisibility = plotVisibility; 
    const selectedParams = ALL_PARAMETERS.filter(key => currentPlotVisibility[key]);
    if (selectedParams.length === 0) {
      if (!isAutoFetch) {
          toast({ variant: "destructive", title: "No Parameters Selected", description: "Please select at least one parameter to fetch." });
      }
      return;
    }

    setIsLoadingData(true); setErrorData(null); setCombinedData(null); setDataLocationContext(null);
    setFetchLogSteps([{message: `Fetching data for ${locationNameToUse}...`, status: 'pending'}]); 
    setIsLogLoading(true); setLogOverallStatus('pending'); setShowFetchLogAccordion("combined-fetch-log-item");
    
    let loadingToastId: string | undefined;
    if (!isAutoFetch) {
        loadingToastId = toast({ title: "Fetching Data", description: `Fetching data for ${locationNameToUse}...`}).id;
    }
    
    const result = await fetchCombinedDataAction({
      latitude: coordsToUse.latitude,
      longitude: coordsToUse.longitude,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
      parameters: selectedParams as string[], // Cast as string[]
    });
    
    if(loadingToastId) dismiss(loadingToastId);
    setFetchLogSteps(result.log || []);
    setIsLoadingData(false); setIsLogLoading(false);

    if (result.success && result.data) {
      setCombinedData(result.data);
      setDataLocationContext(result.dataLocationContext || `Data for ${locationNameToUse}`);
      if (result.data.length === 0 && !result.error) { 
        if (!isAutoFetch) toast({ variant: "default", title: "No Data", description: "No data points found for the selected criteria.", duration: 4000 });
        setLogOverallStatus('warning');
      } else if (result.data.length === 0 && result.error) { 
         if (!isAutoFetch) toast({ variant: "default", title: "No Data", description: result.error, duration: 4000 });
         setLogOverallStatus('warning');
      } else {
        if (!isAutoFetch) toast({ title: "Data Loaded", description: `Loaded ${result.data.length} data points for ${locationNameToUse}.` });
        setLogOverallStatus('success'); setShowFetchLogAccordion("");
      }
    } else {
      setErrorData(result.error || `Failed to load data for ${locationNameToUse}.`);
      if (!isAutoFetch) toast({ variant: "destructive", title: "Error Loading Data", description: result.error || `Failed to load data for ${locationNameToUse}.` });
      setLogOverallStatus('error');
    }
  }, [searchTerm, initialCoords, currentLocationName, dateRange, plotVisibility, toast, dismiss]);


  const handleSuggestionClick = useCallback((suggestionKey: string) => {
    const location = knownLocations[suggestionKey];
    if (location) {
      setSearchTerm(location.name); 
      setInitialCoords({ latitude: location.lat, longitude: location.lon }); 
      setCurrentLocationName(location.name);
      setShowSuggestions(false);
      
      // Automatically fetch when a suggestion is clicked and date range is valid
      if (dateRange?.from && dateRange?.to && ! (dateRange.from > dateRange.to)) {
        handleLocationSearchAndFetch({ latitude: location.lat, longitude: location.lon }, location.name, false);
      }
    }
  }, [dateRange, handleLocationSearchAndFetch]); 

  useEffect(() => {
    if (initialFetchDone.current) return;
    initialFetchDone.current = true; 

    const defaultLoc = knownLocations[defaultLocationKey];
    const currentInitialCoords = initialCoords; 
    const currentLocName = currentLocationName; 
    const currentDR = dateRange; 
    
    if (defaultLoc && currentInitialCoords && currentLocName && currentDR?.from && currentDR?.to) {
      if (!(currentDR.from > currentDR.to)) {
         handleLocationSearchAndFetch(currentInitialCoords, currentLocName, true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, []); // Dependencies removed to ensure it truly runs once based on initial derived state


  useEffect(() => {
    const currentSearchTerm = searchTerm.trim();
    const inputElement = document.activeElement as HTMLInputElement;
    const isFocused = inputElement && inputElement.id === "combined-location-search";

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
          <div className="w-full flex justify-end mt-2">
            <Button variant="outline" size="sm" onClick={handleCopyLog} className="h-7 text-xs">
              <Copy className="mr-1.5 h-3 w-3" /> Copy Log
            </Button>
          </div>
        )}
      </CardFooter>
    )
  );

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
              <Tooltip><TooltipTrigger asChild><Link href="/om-marine-explorer" passHref><Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="Weather & Marine Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Weather & Marine Explorer</p></TooltipContent></Tooltip>
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
              <Waves className="h-5 w-5 text-primary" />Open-Meteo Weather & Marine Explorer
            </CardTitle>
             <CardDescription className="text-xs">
                Select parameters, a coastal location, and a date range to fetch and visualize weather and marine data.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 lg:col-span-3 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-base flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" />Select Parameters</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {ALL_PARAMETERS.map((key) => {
                  const paramConfig = PARAMETER_CONFIG[key];
                  const IconComp = (paramConfig as { icon?: LucideIcon }).icon || Info; 
                  return (
                    <div key={key} className="flex items-center space-x-1.5">
                      <Checkbox id={`combined-visibility-${key}`} checked={plotVisibility[key]} onCheckedChange={(c) => handlePlotVisibilityChange(key, !!c)} className="h-3.5 w-3.5"/>
                      <UiLabel htmlFor={`combined-visibility-${key}`} className="text-xs font-medium flex items-center gap-1 cursor-pointer"><IconComp className="h-3.5 w-3.5 text-muted-foreground"/>{paramConfig.name}</UiLabel>
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
                  <UiLabel htmlFor="combined-location-search" className="text-xs font-medium mb-0.5 block">Location Search</UiLabel>
                  <Input 
                         id="combined-location-search"
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
                  <UiLabel htmlFor="combined-date-range" className="text-xs font-medium mb-0.5 block">Date Range</UiLabel>
                  <DatePickerWithRange id="combined-date-range" date={dateRange} onDateChange={setDateRange} disabled={isLoadingData} />
                  {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                </div>
                <Button onClick={() => handleLocationSearchAndFetch(undefined, undefined, false)} disabled={isLoadingData || !searchTerm || !dateRange?.from || !dateRange?.to || ALL_PARAMETERS.filter(key => plotVisibility[key]).length === 0} className="w-full h-9 text-xs">
                  {isLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                  {isLoadingData ? "Fetching..." : "Fetch Data"}
                </Button>
                 {renderLogAccordion(fetchLogSteps, showFetchLogAccordion, setShowFetchLogAccordion, isLogLoading, logOverallStatus, "Data Fetch Log", errorData)}
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-sm h-full">
              <CardHeader className="p-2 pt-3"><CardTitle className="text-base">{dataLocationContext || "Open-Meteo Weather & Marine Data Plots"}</CardTitle></CardHeader>
              <CardContent className="p-1.5 h-[calc(100%-2.5rem)]"> 
                <MarinePlotsGrid // Re-using MarinePlotsGrid, might need renaming or adaptation
                    marineData={combinedData} // Prop name expects 'marineData'
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
            Weather & Marine data from Open-Meteo.
          </p>
        </div>
      </footer>
    </div>
  );
}
