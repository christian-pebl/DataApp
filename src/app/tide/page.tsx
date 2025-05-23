
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Search, MapPin, LayoutGrid, CloudSun, Waves, SunMoon } from "lucide-react";
import { WeatherControls } from "@/components/weather/WeatherControls"; // Reusing for date range
import { fetchMarineDataAction } from "./actions"; 
import type { MarineDataPoint } from "./shared"; 
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay"; // Reusing ChartDisplay
import { useToast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";
import { formatISO, subDays, addDays, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Verified EA Station IDs (or common examples)
const knownLocations: { [key: string]: { lat: number; lon: number; name: string, eaStationId?: string } } = {
  "milfordhaven": { lat: 51.710, lon: -5.042, name: "Milford Haven", eaStationId: "0401" }, // EA ID might be like E72534 for specific gauge. Using short ref.
  "newlyn": { lat: 50.102, lon: -5.549, name: "Newlyn", eaStationId: "0001" }, // Primary Tide Gauge, common EA ref
  "dover": { lat: 51.124, lon: 1.323, name: "Dover", eaStationId: "0023" },
  "holyhead": { lat: 53.3075, lon: -4.6281, name: "Holyhead", eaStationId: "E71525" }, // Example of a more specific EA ID
  "liverpool": { lat: 53.410, lon: -3.017, name: "Liverpool (Gladstone Dock)", eaStationId: "E71896" },
  "southampton_docks": { lat: 50.90, lon: -1.40, name: "Southampton Docks"}, // No EA ID, will use Open-Meteo
  "portsmouth": { lat: 50.81, lon: -1.08, name: "Portsmouth", eaStationId: "E72614"}
};

const defaultLocationKey = "milfordhaven";

interface SearchedCoords {
  latitude: number;
  longitude: number;
  eaStationId?: string;
  key?: string; // to store the original key like "milfordhaven"
}

interface Suggestion {
  key: string;
  name: string;
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
    from: subDays(new Date(), 3), // Default to 3 days for potentially faster API responses
    to: new Date(),
  });
  
  const initialFetchDone = useRef(false);

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
      setCurrentLocationDetails({ 
        latitude: defaultLoc.lat, 
        longitude: defaultLoc.lon, 
        eaStationId: defaultLoc.eaStationId,
        key: defaultLocationKey 
      });
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handleFetchMarineData = useCallback(async (locationDetails?: SearchedCoords, datesToUse?: DateRange) => {
    const currentLoc = locationDetails || currentLocationDetails;
    const currentDates = datesToUse || dateRange;

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

    setIsLoading(true);
    setError(null);
    setDataLocationContext(undefined);
    setMarineData(null);

    const result = await fetchMarineDataAction({
      latitude: currentLoc.latitude,
      longitude: currentLoc.longitude,
      startDate: formatISO(currentDates.from, { representation: 'date' }),
      endDate: formatISO(currentDates.to, { representation: 'date' }),
      eaStationId: currentLoc.eaStationId,
    });

    setIsLoading(false);
    if (result.success && result.data) {
      setMarineData(result.data as MarineDataPoint[]);
      setDataLocationContext(result.dataLocationContext);
      if (result.message) { // Display source or error message from action
        toast({ title: "Info", description: result.message, duration: 5000 });
      }
      if (result.data.length === 0 && !result.error) {
        toast({ title: "No Data", description: "No tide data found for the selected criteria.", duration: 3000 });
      }
    } else {
      setError(result.error || "Failed to fetch marine data.");
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to fetch marine data." });
    }
  }, [currentLocationDetails, dateRange, toast]);
  
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
    
    // Prioritize selection from `knownLocations` if the search term matches
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
      // Update current location details if different from what was set by suggestion click
      if (locDetailsToFetch.key !== currentLocationDetails?.key) {
          setCurrentLocationDetails(locDetailsToFetch);
      }
       if (knownLocations[locationKey].name !== searchTerm) setSearchTerm(knownLocations[locationKey].name);
    } else if (currentLocationDetails && searchTerm.toLowerCase() === knownLocations[currentLocationDetails.key as string]?.name.toLowerCase()) {
      // If search term matches the name of the currently selected details (e.g., after a suggestion click)
      locDetailsToFetch = currentLocationDetails;
    } else {
      // This is for a general search term not matching a predefined name.
      // For this page, we are focusing on predefined locations or those with similar names.
      // If a geocoding API were integrated, this is where it would be called for searchTerm.
      // For now, if it's not a known name, we'll treat it as an error for the tide page's focus.
      toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known marine location from suggestions." });
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
    if (currentLocationDetails && dateRange?.from && dateRange?.to && !initialFetchDone.current && !isLoading && !error) {
      handleFetchMarineData(currentLocationDetails, dateRange);
      initialFetchDone.current = true;
    }
  }, [currentLocationDetails, dateRange, isLoading, error, handleFetchMarineData]);

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
      // Optionally trigger fetch on suggestion click:
      // if (dateRange?.from && dateRange?.to) {
      //   handleFetchMarineData(newDetails, dateRange);
      // }
    }
  }, [dateRange, handleFetchMarineData]); 

  const handleInputFocus = () => {
    const currentSearchTerm = searchTerm.trim();
    // Show all known locations if input is empty or matches a known location name
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
