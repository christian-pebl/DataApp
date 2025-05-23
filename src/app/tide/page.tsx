
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, MapPin, LayoutGrid, CloudSun, Waves, SunMoon, Info, CheckCircle2, XCircle } from "lucide-react";
import { WeatherControls } from "@/components/weather/WeatherControls"; 
import { fetchMarineDataAction } from "./actions"; 
import type { MarineDataPoint, FetchMarineDataInput } from "./shared"; 
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { useToast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";
import { formatISO, subDays, addDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const knownLocations: { [key: string]: { lat: number; lon: number; name: string, eaStationId?: string } } = {
  "milfordhaven": { lat: 51.710, lon: -5.042, name: "Milford Haven", eaStationId: "0401" },
  "newlyn": { lat: 50.102, lon: -5.549, name: "Newlyn", eaStationId: "0001" },
  "dover": { lat: 51.124, lon: 1.323, name: "Dover", eaStationId: "0023" },
  "holyhead": { lat: 53.3075, lon: -4.6281, name: "Holyhead", eaStationId: "E71525" }, // Example complex ID
  "liverpool": { lat: 53.410, lon: -3.017, name: "Liverpool (Gladstone Dock)", eaStationId: "E71896" }, // Example complex ID
  "portsmouth": { lat: 50.81, lon: -1.08, name: "Portsmouth", eaStationId: "E72614"},
  "southampton_docks": { lat: 50.90, lon: -1.40, name: "Southampton Docks"}, // No EA ID, will use Open-Meteo
  // Add more verified EA station locations if needed
};

const defaultLocationKey = "milfordhaven";

interface SearchedCoords {
  latitude: number;
  longitude: number;
  eaStationId?: string;
  key?: string; 
}

interface Suggestion {
  key: string;
  name: string;
}

interface FetchLogStep {
  id: string; // Unique ID for React key
  message: string;
  status: 'pending' | 'success' | 'error' | 'info';
}


export default function TidePage() {
  const [theme, setTheme] = useState("light");
  const [marineData, setMarineData] = useState<MarineDataPoint[] | null>(null);
  const [dataLocationContext, setDataLocationContext] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const pathname = usePathname();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentLocationDetails, setCurrentLocationDetails] = useState<SearchedCoords | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 3), 
    to: new Date(),
  });
  
  const initialFetchDone = useRef(false);
  const [fetchLogSteps, setFetchLogSteps] = useState<FetchLogStep[]>([]);
  const [logAccordionValue, setLogAccordionValue] = useState<string>(""); // To control accordion open/close
  const [logOverallStatus, setLogOverallStatus] = useState<'pending' | 'success' | 'error' | 'idle'>('idle');


  const addLogStep = useCallback((message: string, status: FetchLogStep['status'], replaceLast = false) => {
    setFetchLogSteps(prevSteps => {
      const newStep = { id: `log-${Date.now()}-${Math.random()}`, message, status };
      if (replaceLast && prevSteps.length > 0) {
        const updatedSteps = [...prevSteps];
        updatedSteps[prevSteps.length -1] = newStep;
        return updatedSteps;
      }
      return [...prevSteps, newStep];
    });
  }, []);


  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    else {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemPrefersDark) setTheme("dark");
    }
    
    const defaultLoc = knownLocations[defaultLocationKey];
    if (defaultLoc) {
      setSearchTerm(defaultLoc.name);
      const defaultDetails = { 
        latitude: defaultLoc.lat, 
        longitude: defaultLoc.lon, 
        eaStationId: defaultLoc.eaStationId,
        key: defaultLocationKey 
      };
      setCurrentLocationDetails(defaultDetails);
      if (dateRange?.from && dateRange?.to && !initialFetchDone.current) {
         handleFetchMarineData(defaultDetails, dateRange, true); 
         initialFetchDone.current = true;
      }
    }
  }, []); 

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handleFetchMarineData = useCallback(async (locationDetails?: SearchedCoords, datesToUse?: DateRange, isInitialFetch = false) => {
    const currentLoc = locationDetails || currentLocationDetails;
    const currentDates = datesToUse || dateRange;
    const currentLocKey = currentLoc?.key || null;

    if (!isInitialFetch) {
        if (!currentLoc) {
          toast({ variant: "destructive", title: "Missing Location", description: "Please search and select a location." });
          return;
        }
        if (!currentDates || !currentDates.from || !currentDates.to) {
          toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range."});
          return;
        }
        if (currentDates.from > currentDates.to) {
          toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
          return;
        }
        const maxDays = 90; 
        if (addDays(currentDates.from, maxDays) < currentDates.to) {
            toast({ variant: "destructive", title: "Date Range Too Large", description: `Please select a range within ${maxDays} days.` });
            return;
        }
    }
    
    if (!currentLoc || !currentDates?.from || !currentDates?.to) return;


    setIsLoading(true);
    setError(null);
    setDataLocationContext(undefined);
    setMarineData(null);
    setFetchLogSteps([]); 
    addLogStep(`Initiating data fetch for ${currentLoc.key ? knownLocations[currentLoc.key]?.name : `Lat: ${currentLoc.latitude.toFixed(2)}, Lon: ${currentLoc.longitude.toFixed(2)}`}...`, 'pending');
    setLogAccordionValue("fetch-log-details"); 
    setLogOverallStatus('pending');


    const result = await fetchMarineDataAction({
      latitude: currentLoc.latitude,
      longitude: currentLoc.longitude,
      startDate: formatISO(currentDates.from, { representation: 'date' }),
      endDate: formatISO(currentDates.to, { representation: 'date' }),
      eaStationId: currentLoc.eaStationId,
    });

    setIsLoading(false);
    if (result.log) {
      setFetchLogSteps(prev => {
        const newLogs = result.log!.map((l, index) => ({ id: `server-log-${Date.now()}-${index}`, ...l }));
        return prev.length > 0 && prev[0].status === 'pending' ? newLogs : [...prev, ...newLogs];
      });
    }

    if (result.success && result.data) {
      setMarineData(result.data as MarineDataPoint[]);
      setDataLocationContext(result.dataLocationContext);
      setLogOverallStatus('success');
      addLogStep("Data fetch successful.", 'success', true);
      if (result.message && !isInitialFetch) { 
        toast({ title: "Info", description: result.message, duration: 5000 });
      }
      if (result.data.length === 0 && !result.error && !isInitialFetch) {
        toast({ title: "No Data", description: "No tide data found for the selected criteria.", duration: 3000 });
      }
    } else {
      setError(result.error || "Failed to fetch marine data.");
      setLogOverallStatus('error');
      addLogStep(`Fetch failed: ${result.error || "Unknown error"}`, 'error', true);
      if (!isInitialFetch) {
        toast({ variant: "destructive", title: "Error", description: result.error || "Failed to fetch marine data." });
      }
    }
  }, [currentLocationDetails, dateRange, toast, addLogStep]);
  
  const handleLocationSearchAndFetch = useCallback(async () => {
    const term = searchTerm.trim().toLowerCase();
    setShowSuggestions(false); 
    if (!term) {
      toast({ variant: "destructive", title: "Search Error", description: "Please enter a location." });
      setCurrentLocationDetails(null); 
      setMarineData(null); 
      return;
    }

    let locDetailsToFetch: SearchedCoords | null = null;
    
    const locationKey = Object.keys(knownLocations).find(
      key => knownLocations[key].name.toLowerCase() === term
    );

    if (locationKey) {
      const location = knownLocations[locationKey];
      locDetailsToFetch = { 
        latitude: location.lat, 
        longitude: location.lon, 
        eaStationId: location.eaStationId,
        key: locationKey
      };
      if (locDetailsToFetch.key !== currentLocationDetails?.key || 
          locDetailsToFetch.latitude !== currentLocationDetails?.latitude ||
          locDetailsToFetch.longitude !== currentLocationDetails?.longitude) {
          setCurrentLocationDetails(locDetailsToFetch);
      }
       if (knownLocations[locationKey].name !== searchTerm) setSearchTerm(knownLocations[locationKey].name);
    } else if (currentLocationDetails && searchTerm.toLowerCase() === knownLocations[currentLocationDetails.key as string]?.name.toLowerCase()) {
      locDetailsToFetch = currentLocationDetails;
    } else {
      toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known marine location from suggestions or search for coordinates." });
      setMarineData(null); 
      setCurrentLocationDetails(null);
      return;
    }
    
    if (locDetailsToFetch && dateRange?.from && dateRange?.to) {
      await handleFetchMarineData(locDetailsToFetch, dateRange);
    } else if (!locDetailsToFetch) {
        toast({ variant: "destructive", title: "Location Error", description: "Could not determine coordinates." });
    } else {
        toast({ variant: "destructive", title: "Date Error", description: "Select a valid date range." });
    }
  }, [searchTerm, toast, handleFetchMarineData, dateRange, currentLocationDetails]);


  useEffect(() => {
    const currentSearchTerm = searchTerm.trim();
    if (currentSearchTerm === "") {
      if (document.activeElement === document.querySelector('input[type="text"]')) {
         setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
         setShowSuggestions(true);
      } else {
        setSuggestions([]); setShowSuggestions(false); 
      }
      return;
    }
    const termLower = currentSearchTerm.toLowerCase();
    const filtered = Object.entries(knownLocations)
      .filter(([key, locObj]) => key.toLowerCase().includes(termLower) || locObj.name.toLowerCase().includes(termLower))
      .map(([key, locObj]) => ({ key, name: locObj.name }));
    setSuggestions(filtered.slice(0, 5)); 
    setShowSuggestions(filtered.length > 0);
  }, [searchTerm]);

  const handleSuggestionClick = useCallback((suggestionKey: string) => {
    const location = knownLocations[suggestionKey];
    if (location) {
      setSearchTerm(location.name); 
      const newDetails = { 
        latitude: location.lat, 
        longitude: location.lon, 
        eaStationId: location.eaStationId,
        key: suggestionKey
      };
      setCurrentLocationDetails(newDetails); 
      setShowSuggestions(false);
      if (dateRange?.from && dateRange?.to) {
        handleFetchMarineData(newDetails, dateRange);
      } else {
        toast({ variant: "destructive", title: "Date Error", description: "Please select a valid date range before fetching." });
      }
    }
  }, [dateRange, handleFetchMarineData, toast]); 

  const handleInputFocus = () => {
    const currentSearchTerm = searchTerm.trim();
    if (currentSearchTerm === "" || Object.values(knownLocations).some(loc => loc.name.toLowerCase() === currentSearchTerm.toLowerCase())) {
      setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
      setShowSuggestions(true);
    } else if (suggestions.length > 0) { 
      setShowSuggestions(true);
    }
  };
  
  const handleInputBlur = () => { setTimeout(() => { setShowSuggestions(false); }, 150); };

  const yAxisTideConfig: YAxisConfig[] = [
    { id: 'tide', orientation: 'left', label: 'Tide Height (m)', color: '--chart-1', dataKey: 'tideHeight', unit: 'm' }
  ];

  const getLogTriggerContent = () => {
    if (logOverallStatus === 'pending') {
      return <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching data...</>;
    }
    if (logOverallStatus === 'success') {
      return <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" /> Fetch Log: Success</>;
    }
    if (logOverallStatus === 'error') {
      const lastErrorStep = [...fetchLogSteps].reverse().find(s => s.status === 'error');
      return <><XCircle className="mr-2 h-4 w-4 text-destructive" /> Fetch Log: Failed {lastErrorStep ? `- ${lastErrorStep.message.substring(0,30)}...` : ''}</>;
    }
    return "Show Fetch Log";
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <TooltipProvider>
          <div className="container flex h-14 items-center justify-between px-3 md:px-4">
            <Link href="/tide" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/data-explorer" passHref>
                    <Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer">
                      <LayoutGrid className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>Data Explorer (CSV)</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/weather" passHref> 
                    <Button variant={pathname === '/weather' ? "secondary": "ghost"} size="icon" aria-label="Weather Page">
                      <CloudSun className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>Weather Page</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/tide" passHref> 
                    <Button variant={pathname === '/tide' ? "secondary": "ghost"} size="icon" aria-label="Tide Page">
                      <Waves className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>Tide Data Page</p></TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme">
                    <SunMoon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Toggle Theme</p></TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 lg:col-span-3 space-y-4">
             <Card className="p-4 border rounded-lg shadow-sm bg-card">
              <h3 className="text-md font-semibold mb-2 text-center flex items-center justify-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Location & Date
              </h3>
              <div className="relative mb-1">
                <Input
                  type="text"
                  placeholder="Search UK marine location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') { handleLocationSearchAndFetch(); setShowSuggestions(false); } }}
                  className="h-9 text-sm"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-0 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                        onClick={() => handleSuggestionClick(suggestion.key)}
                        onMouseDown={(e) => e.preventDefault()} 
                      >
                        {suggestion.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {currentLocationDetails && (
                <p className="text-xs text-center text-muted-foreground mb-1">
                  Lat: {currentLocationDetails.latitude.toFixed(4)}, Lon: {currentLocationDetails.longitude.toFixed(4)}
                  {currentLocationDetails.eaStationId && ` (EA ID: ${currentLocationDetails.eaStationId})`}
                </p>
              )}
               <WeatherControls dateRange={dateRange} onDateChange={setDateRange} isLoading={isLoading} />
               <Button 
                  onClick={handleLocationSearchAndFetch} 
                  disabled={isLoading || !searchTerm || !dateRange?.from || !dateRange?.to}
                  className="w-full h-9 text-sm mt-3"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                  {isLoading ? "Fetching..." : "Search & Fetch Tide Data"}
              </Button>
              {logOverallStatus !== 'idle' && (
                <Accordion type="single" collapsible value={logAccordionValue} onValueChange={setLogAccordionValue} className="w-full mt-2">
                  <AccordionItem value="fetch-log-details" className="border rounded-md">
                    <AccordionTrigger
                      className={cn(
                        "flex items-center justify-between text-xs p-2 rounded-md hover:no-underline hover:bg-muted/50 text-left w-full",
                        logOverallStatus === 'error' && 'bg-destructive/10 text-destructive hover:bg-destructive/20',
                        logOverallStatus === 'success' && 'bg-green-500/10 text-green-700 hover:bg-green-500/20',
                        logOverallStatus === 'pending' && 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/20'
                      )}
                    >
                      {getLogTriggerContent()}
                    </AccordionTrigger>
                    <AccordionContent className="pt-1 pb-1 max-h-[30rem]"> {/* Increased max-height */}
                      <ScrollArea className="w-full rounded-md border p-1.5 bg-muted/20 h-full"> {/* Set ScrollArea to h-full */}
                        {fetchLogSteps.map((step) => (
                          <li key={step.id} className="flex items-start list-none py-0.5">
                            <div className="flex-shrink-0 w-3 h-3 mr-1.5 mt-0.5">
                              {step.status === 'pending' && <Loader2 className="h-full w-full text-blue-500 animate-spin" />}
                              {step.status === 'success' && <CheckCircle2 className="h-full w-full text-green-500" />}
                              {step.status === 'error' && <XCircle className="h-full w-full text-red-500" />}
                              {step.status === 'info' && <Info className="h-full w-full text-muted-foreground" />}
                            </div>
                            <div className="flex-grow min-w-0">
                              <span className={cn(
                                'block text-xs leading-tight',
                                step.status === 'error' && 'text-destructive font-medium',
                                step.status === 'success' && 'text-green-600',
                                step.status === 'info' && 'text-muted-foreground'
                              )}>
                                {step.message}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ScrollArea>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </Card>
          </div>

          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-lg h-full">
              <CardHeader className="p-3">
                 <CardTitle className="text-md">Tide Data {dataLocationContext ? `- ${dataLocationContext}` : ''}</CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-[calc(100%-3rem)]"> 
                <ChartDisplay
                    data={marineData || []}
                    plottableSeries={marineData && marineData.length > 0 ? ['tideHeight'] : []}
                    timeAxisLabel="Time"
                    plotTitle={dataLocationContext || "Tide Data"}
                    yAxisConfigs={yAxisTideConfig}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-16 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Tide data from Environment Agency / Open-Meteo. Built with Next.js and ShadCN/UI.
          </p>
        </div>
      </footer>
    </div>
  );
}


    