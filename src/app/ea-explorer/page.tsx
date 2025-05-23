
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, Search, MapPin, CalendarDays, Thermometer, Wind, Cloud as CloudIconLucide, Compass, Sailboat, Timer, ListChecks, AlertCircle, Target, Activity, Info, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay"; // Re-using this for single plot
import { useToast } from "@/hooks/use-toast";
import { formatISO, subDays, parseISO, isValid } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { MarineDataPoint, FetchMarineDataInput, LogStep, MarinePlotVisibilityKeys } from "./shared";
import { fetchOpenMeteoMarineDataAction } from "./actions";
// New component for marine plots grid (can be adapted from WeatherPlotsGrid or created new)
import { MarinePlotsGrid } from "@/components/marine/MarinePlotsGrid";


const knownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "milfordhaven": { lat: 51.71, lon: -5.04, name: "Milford Haven" },
  "newlyn": { lat: 50.10, lon: -5.55, name: "Newlyn" },
  "dover": { lat: 51.12, lon: -1.31, name: "Dover" },
  "liverpool": { lat: 53.40, lon: -2.99, name: "Liverpool" },
  "portsmouth": { lat: 50.81, lon: -1.08, name: "Portsmouth" },
};
const defaultLocationKey = "milfordhaven";

interface SearchedCoords {
  latitude: number;
  longitude: number;
}
interface Suggestion {
  key: string;
  name: string;
}

type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle';

const marinePlotConfigIcons: Record<MarinePlotVisibilityKeys, React.ElementType> = {
  seaLevel: Waves,
  waveHeight: Sailboat, // Using Sailboat for distinction
  waveDirection: Compass,
  wavePeriod: Timer,
};

const marinePlotDisplayTitles: Record<MarinePlotVisibilityKeys, string> = {
  seaLevel: "Sea Level (Tide)",
  waveHeight: "Wave Height",
  waveDirection: "Wave Direction",
  wavePeriod: "Wave Period",
};


export default function MarineExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();

  // Location state
  const [searchTerm, setSearchTerm] = useState("");
  const [initialCoords, setInitialCoords] = useState<SearchedCoords | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);

  // Date state
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7),
    to: new Date(),
  }));

  // Data state
  const [marineData, setMarineData] = useState<MarineDataPoint[] | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);
  const [dataLocationContext, setDataLocationContext] = useState<string | null>(null);

  // Plot visibility state
  const [plotVisibility, setPlotVisibility] = useState<Record<MarinePlotVisibilityKeys, boolean>>({
    seaLevel: true,
    waveHeight: true,
    waveDirection: true,
    wavePeriod: true,
  });
  
  // Fetch log state
  const [fetchLogSteps, setFetchLogSteps] = useState<LogStep[]>([]);
  const [showFetchLogAccordion, setShowFetchLogAccordion] = useState<string>(""); 
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [logOverallStatus, setLogOverallStatus] = useState<LogOverallStatus>('idle');

  const initialFetchDone = useRef(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");

    const defaultLoc = knownLocations[defaultLocationKey];
    if (defaultLoc) {
      setSearchTerm(defaultLoc.name); 
      setInitialCoords({ latitude: defaultLoc.lat, longitude: defaultLoc.lon });
      setCurrentLocationName(defaultLoc.name);
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handlePlotVisibilityChange = useCallback((key: MarinePlotVisibilityKeys, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  const handleLocationSearchAndFetch = useCallback(async () => {
    const term = searchTerm.trim().toLowerCase();
    setShowSuggestions(false); 
    let coordsToUse = initialCoords;
    let locationNameToUse = currentLocationName;

    if (!term) {
      toast({ variant: "destructive", title: "Search Error", description: "Please enter a location." });
      setInitialCoords(null); 
      setCurrentLocationName(null);
      setMarineData(null); 
      return;
    }

    const locationKey = Object.keys(knownLocations).find(
      key => key.toLowerCase() === term || knownLocations[key].name.toLowerCase() === term
    );

    if (locationKey) {
      const location = knownLocations[locationKey];
      coordsToUse = { latitude: location.lat, longitude: location.lon };
      locationNameToUse = location.name;
      if (location.name !== searchTerm) setSearchTerm(location.name);
      setInitialCoords(coordsToUse);
      setCurrentLocationName(locationNameToUse);
    } else {
      // If not a known location, try to use previously set coords if search term matches current name
      // Otherwise, prompt for known location. A real geocoding API would go here.
      if (!initialCoords || searchTerm.toLowerCase() !== (currentLocationName || "").toLowerCase()) {
          setMarineData(null); 
          setInitialCoords(null);
          setCurrentLocationName(null);
          toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known UK coastal location from suggestions or enter a valid one." });
          return;
      }
      // Use existing initialCoords if search term matches current name
      coordsToUse = initialCoords;
      locationNameToUse = currentLocationName;
    }
    
    if (coordsToUse && dateRange?.from && dateRange?.to) {
      await handleFetchMarineData(coordsToUse, locationNameToUse || "Selected Location");
    } else if (!coordsToUse) {
        toast({ variant: "destructive", title: "Missing Location", description: "Could not determine coordinates for fetching." });
    }
  }, [searchTerm, initialCoords, currentLocationName, dateRange, toast]);


  const handleFetchMarineData = async (coords: SearchedCoords, locationName: string) => {
    if (!coords) {
      toast({ variant: "destructive", title: "Missing Location", description: "Please search and select a location." });
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

    setIsLoadingData(true);
    setErrorData(null);
    setMarineData(null);
    setDataLocationContext(null);

    setFetchLogSteps([]);
    setIsLogLoading(true);
    setLogOverallStatus('pending');
    setShowFetchLogAccordion("marine-fetch-log-item");

    const input: FetchMarineDataInput = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
    };
    
    const loadingToastId = toast({ title: "Fetching Data", description: `Fetching marine data for ${locationName}...`}).id;
    
    const result = await fetchOpenMeteoMarineDataAction(input);
    
    if(loadingToastId) dismiss(loadingToastId);
    setFetchLogSteps(result.log || []);
    setIsLoadingData(false);
    setIsLogLoading(false);

    if (result.success && result.data) {
      setMarineData(result.data);
      setDataLocationContext(result.dataLocationContext || `Marine data for ${locationName}`);
      if (result.data.length === 0) {
        toast({ variant: "default", title: "No Data", description: result.error || `No marine data points found for ${locationName} in the selected range.`, duration: 4000 });
        setLogOverallStatus('success'); 
        setShowFetchLogAccordion(""); 
      } else {
        toast({ title: "Data Loaded", description: `Successfully loaded ${result.data.length} marine data points for ${locationName}.` });
        setLogOverallStatus('success');
        setShowFetchLogAccordion("");
      }
    } else {
      setErrorData(result.error || `Failed to load marine data for ${locationName}.`);
      toast({ variant: "destructive", title: "Error Loading Data", description: result.error || `Failed to load data for ${locationName}.` });
      setLogOverallStatus('error');
    }
  };
  
  // Auto-fetch for default location on initial load
  useEffect(() => {
    if (initialCoords && dateRange?.from && dateRange?.to && !initialFetchDone.current && !isLoadingData && !errorData) {
      handleFetchMarineData(initialCoords, currentLocationName || "Default Location");
      initialFetchDone.current = true;
    }
  }, [initialCoords, dateRange, isLoadingData, errorData, currentLocationName, handleFetchMarineData]);


  useEffect(() => {
    const currentSearchTerm = searchTerm.trim();
    if (currentSearchTerm === "") {
        if (document.activeElement === document.querySelector('input[placeholder="Search UK coastal location..."]')) {
           setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
           setShowSuggestions(true);
        } else {
          setSuggestions([]); setShowSuggestions(false); 
        }
        return;
      }

    const termLower = currentSearchTerm.toLowerCase();
    const filtered = Object.entries(knownLocations)
      .filter(([key, locObj]) =>
        key.toLowerCase().includes(termLower) || 
        locObj.name.toLowerCase().includes(termLower) 
      )
      .map(([key, locObj]) => ({ key, name: locObj.name }));
    
    setSuggestions(filtered.slice(0, 5)); 
    setShowSuggestions(filtered.length > 0 && document.activeElement === document.querySelector('input[placeholder="Search UK coastal location..."]'));
  }, [searchTerm]);

  const handleSuggestionClick = useCallback((suggestionKey: string) => {
    const location = knownLocations[suggestionKey];
    if (location) {
      setSearchTerm(location.name); 
      const newCoords = { latitude: location.lat, longitude: location.lon };
      setInitialCoords(newCoords); 
      setCurrentLocationName(location.name);
      setShowSuggestions(false);
      // Auto-fetch will be triggered by handleLocationSearchAndFetch button
    }
  }, []); 

  const handleInputFocus = () => {
    const currentSearchTerm = searchTerm.trim();
    if (currentSearchTerm === "" || Object.values(knownLocations).some(loc => loc.name.toLowerCase() === currentSearchTerm.toLowerCase())) {
      setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
      setShowSuggestions(true);
    } else if (suggestions.length > 0) { 
      setShowSuggestions(true);
    }
  };
  
  const handleInputBlur = () => {
    setTimeout(() => { setShowSuggestions(false); }, 150);
  };

  const getLogTriggerContent = (status: LogOverallStatus, isLoading: boolean, defaultTitle: string) => {
    if (isLoading) return <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching details...</>;
    if (status === 'success') return <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />{defaultTitle}: Success</>;
    if (status === 'error') return <><XCircle className="mr-2 h-4 w-4 text-destructive" />{defaultTitle}: Failed</>;
    if (status === 'pending') return <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{defaultTitle}: In Progress</>;
    return <><Info className="mr-2 h-4 w-4 text-muted-foreground" />{defaultTitle}: Idle</>;
  };
  
  const getLogAccordionItemClass = (status: LogOverallStatus) => {
    if (status === 'pending' || isLogLoading) return "bg-blue-500/10";
    if (status === 'success') return "bg-green-500/10";
    if (status === 'error') return "bg-destructive/10";
    return "";
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/marine-explorer" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Link href="/data-explorer" passHref><Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer"><LayoutGrid className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Data Explorer (CSV)</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/weather" passHref><Button variant={pathname === '/weather' ? "secondary": "ghost"} size="icon" aria-label="Weather Page"><CloudSun className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Weather Page</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/marine-explorer" passHref><Button variant={pathname === '/marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="Marine Data Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Marine Data Explorer</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Controls Column */}
          <div className="md:col-span-4 lg:col-span-3 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary"/>Location & Date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search UK coastal location..."
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
                        <button key={suggestion.key} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none" onClick={() => handleSuggestionClick(suggestion.key)} onMouseDown={(e) => e.preventDefault()}>
                          {suggestion.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {initialCoords && (
                  <p className="text-xs text-muted-foreground text-center">
                    Lat: {initialCoords.latitude.toFixed(4)}, Lon: {initialCoords.longitude.toFixed(4)}
                  </p>
                )}
                <div>
                  <UiLabel htmlFor="date-range-picker" className="text-sm font-medium mb-1 block">Date Range</UiLabel>
                  <DatePickerWithRange id="date-range-picker" date={dateRange} onDateChange={setDateRange} disabled={isLoadingData} />
                   {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && (
                    <p className="text-xs text-destructive px-1 pt-1">Start date must be before or same as end date.</p>
                  )}
                </div>
                 <Button 
                    onClick={handleLocationSearchAndFetch}
                    disabled={isLoadingData || !searchTerm || !dateRange?.from || !dateRange?.to}
                    className="w-full h-9 text-sm"
                  >
                    {isLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                    {isLoadingData ? "Fetching..." : "Fetch Marine Data"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Display Plots</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {(Object.keys(plotVisibility) as MarinePlotVisibilityKeys[]).map((key) => {
                  const IconComponent = marinePlotConfigIcons[key];
                  return (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`visibility-${key}`}
                        checked={plotVisibility[key]}
                        onCheckedChange={(checked) => handlePlotVisibilityChange(key, !!checked)}
                        className="h-4 w-4"
                      />
                      <UiLabel htmlFor={`visibility-${key}`} className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        {marinePlotDisplayTitles[key]}
                      </UiLabel>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {(isLogLoading || fetchLogSteps.length > 0 || logOverallStatus !== 'idle') && (
              <Card>
                <CardFooter className="p-2">
                  <Accordion type="single" collapsible value={showFetchLogAccordion} onValueChange={setShowFetchLogAccordion} className="w-full">
                    <AccordionItem value="marine-fetch-log-item" className={cn("border rounded-md", getLogAccordionItemClass(logOverallStatus))}>
                      <AccordionTrigger className="px-4 py-2 text-sm hover:no-underline">
                        {getLogTriggerContent(logOverallStatus, isLogLoading, 'Fetch Log')}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-2 pt-0">
                        <ScrollArea className="max-h-[30rem] h-auto w-full rounded-md border bg-muted/30 p-2 mt-1">
                          <ul className="space-y-1.5 text-xs">
                            {fetchLogSteps.map((step, index) => (
                              <li key={index} className="flex items-start gap-2">
                                {step.status === 'pending' && <Loader2 className="h-4 w-4 mt-0.5 text-blue-500 animate-spin flex-shrink-0" />}
                                {step.status === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />}
                                {step.status === 'error' && <XCircle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />}
                                {step.status === 'info' && <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />}
                                <div className="min-w-0">
                                  <p className={cn("break-words", step.status === 'error' && "text-destructive font-semibold")}>{step.message}</p>
                                  {step.details && <p className="text-muted-foreground text-[0.7rem] whitespace-pre-wrap break-all">{step.details}</p>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardFooter>
              </Card>
            )}

          </div>

          {/* Plot Area Column */}
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-lg h-full">
              <CardHeader className="p-3">
                 <CardTitle className="text-lg">{dataLocationContext || "Marine Data Plots"}</CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-[calc(100%-3rem)]">
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
            Marine data from Open-Meteo.
          </p>
        </div>
      </footer>
    </div>
  );
}
