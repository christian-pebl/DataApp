
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Search, MapPin, LayoutGrid, CloudSun, Waves, SunMoon } from "lucide-react";
import { WeatherControls } from "@/components/weather/WeatherControls"; // Reusing for date range
import { fetchTideDataAction } from "./actions";
import type { TideDataPoint } from "./shared"; 
import { useToast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";
import { formatISO, subDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ChartDisplayProps } from "@/components/dataflow/ChartDisplay"; // Using ChartDisplay

const ChartDisplay = dynamic<ChartDisplayProps>(
  () => import('@/components/dataflow/ChartDisplay').then(mod => mod.ChartDisplay),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-muted-foreground"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>Loading plot...</div>
  }
);

const knownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "london": { lat: 51.5074, lon: -0.1278, name: "London" },
  "manchester": { lat: 53.4808, lon: -2.2426, name: "Manchester" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, name: "Edinburgh" },
  "eh1 1aa": { lat: 55.9522, lon: -3.1900, name: "Edinburgh (EH1 1AA)" },
  "birmingham": { lat: 52.4862, lon: -1.8904, name: "Birmingham" },
  "glasgow": { lat: 55.8642, lon: -4.2518, name: "Glasgow" },
  "liverpool": { lat: 53.4084, lon: -2.9916, name: "Liverpool" },
  "bristol": { lat: 51.4545, lon: -2.5879, name: "Bristol" },
  "leeds": { lat: 53.8008, lon: -1.5491, name: "Leeds" },
  "sheffield": { lat: 53.3811, lon: -1.4701, name: "Sheffield" },
  "stdavids": { lat: 51.8818, lon: -5.2661, name: "Saint David's" }, // Default
};

interface SearchedCoords {
  latitude: number;
  longitude: number;
}

interface Suggestion {
  key: string;
  name: string;
}

const defaultLocationKey = "stdavids";

export default function TidePage() {
  const [theme, setTheme] = useState("light");
  const [tideData, setTideData] = useState<TideDataPoint[]>([]);
  const [dataLocationContext, setDataLocationContext] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const pathname = usePathname();

  const [searchTerm, setSearchTerm] = useState("");
  const [initialCoords, setInitialCoords] = useState<SearchedCoords | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
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
      setInitialCoords({ latitude: defaultLoc.lat, longitude: defaultLoc.lon });
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handleFetchTideData = useCallback(async (coordsToUse?: SearchedCoords, datesToUse?: DateRange) => {
    const currentCoords = coordsToUse || initialCoords;
    const currentDates = datesToUse || dateRange;

    if (!currentCoords) {
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

    setIsLoading(true);
    setError(null);
    setDataLocationContext(undefined);

    const result = await fetchTideDataAction({
      latitude: currentCoords.latitude,
      longitude: currentCoords.longitude,
      startDate: formatISO(currentDates.from, { representation: 'date' }),
      endDate: formatISO(currentDates.to, { representation: 'date' }),
    });

    setIsLoading(false);
    if (result.success && result.data) {
      setTideData(result.data as TideDataPoint[]);
      setDataLocationContext(result.dataLocationContext);
      if (result.message) {
        toast({ title: "Info", description: result.message, duration: 3000 });
      } else if (result.data.length === 0) {
        toast({ title: "No Data", description: "No tide data found for the selected criteria.", duration: 3000 });
      } else {
        const successToast = toast({ title: "Success", description: "Tide data fetched." });
        setTimeout(() => { if (successToast && successToast.id) toast().dismiss(successToast.id); }, 2000);
      }
    } else {
      setError(result.error || "Failed to fetch tide data.");
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to fetch tide data." });
    }
  }, [initialCoords, dateRange, toast]);
  
  const handleLocationSearchAndFetch = useCallback(async () => {
    const term = searchTerm.trim().toLowerCase();
    setShowSuggestions(false); 
    if (!term) {
      toast({ variant: "destructive", title: "Search Error", description: "Please enter a location." });
      setInitialCoords(null); 
      setTideData([]); 
      return;
    }
    const locationKey = Object.keys(knownLocations).find(
      key => key.toLowerCase() === term || knownLocations[key].name.toLowerCase() === term
    );

    let coordsForFetch: SearchedCoords | null = null;

    if (locationKey) {
      const location = knownLocations[locationKey];
      coordsForFetch = { latitude: location.lat, longitude: location.lon };
      setInitialCoords(coordsForFetch); 
      if (knownLocations[locationKey].name !== searchTerm) setSearchTerm(knownLocations[locationKey].name);
    } else {
      const currentKnownNameForInitialCoords = Object.values(knownLocations).find(loc => loc.lat === initialCoords?.latitude && loc.lon === initialCoords?.longitude)?.name;
      if (searchTerm.toLowerCase() !== currentKnownNameForInitialCoords?.toLowerCase()) {
         setTideData([]); 
         setInitialCoords(null); 
         toast({ variant: "destructive", title: "Location Not Found", description: "Please select a location from suggestions or a known UK city/postcode." });
         return;
      }
      coordsForFetch = initialCoords;
    }
    
    if (coordsForFetch && dateRange?.from && dateRange?.to) {
      await handleFetchTideData(coordsForFetch, dateRange);
    } else if (!coordsForFetch) {
        toast({ variant: "destructive", title: "Location Error", description: "Could not determine coordinates." });
    } else {
        toast({ variant: "destructive", title: "Date Error", description: "Select a valid date range." });
    }
  }, [searchTerm, toast, handleFetchTideData, dateRange, initialCoords]);

  useEffect(() => {
    if (initialCoords && dateRange?.from && dateRange?.to && !initialFetchDone.current && !isLoading && !error) {
      handleFetchTideData(initialCoords, dateRange);
      initialFetchDone.current = true;
    }
  }, [initialCoords, dateRange, isLoading, error, handleFetchTideData]);

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
      const newCoords = { latitude: location.lat, longitude: location.lon };
      setInitialCoords(newCoords); 
      setShowSuggestions(false);
    }
  }, []); 

  const handleInputFocus = () => {
    const currentSearchTerm = searchTerm.trim();
    if (currentSearchTerm === "" || Object.values(knownLocations).some(loc => loc.name === currentSearchTerm)) {
      setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
      setShowSuggestions(true);
    } else if (suggestions.length > 0) { 
      setShowSuggestions(true);
    }
  };
  
  const handleInputBlur = () => { setTimeout(() => { setShowSuggestions(false); }, 150); };

  const tideYAxisConfig: ChartDisplayProps['yAxisConfigs'] = [
    { id: 'tide', orientation: 'left', label: 'Tide Height (m)', color: '--chart-1', dataKey: 'tideHeight', unit: 'm' }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <TooltipProvider>
          <div className="container flex h-14 items-center justify-between px-3 md:px-4">
            <Link href="/weather" passHref>
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
                <TooltipContent><p>Tide Page</p></TooltipContent>
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
                  placeholder="Search UK place or postcode..."
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
              {initialCoords && (
                <p className="text-xs text-center text-muted-foreground mb-3">
                  Lat: {initialCoords.latitude.toFixed(4)}, Lon: {initialCoords.longitude.toFixed(4)}
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
              <CardContent className="p-2 h-[calc(100%-3.5rem)]"> 
                 {isLoading && <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Fetching data...</div>}
                 {!isLoading && error && <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center"><Waves className="h-10 w-10 mb-2" /><p className="font-semibold">Error Fetching Data</p><p className="text-sm">{error}</p></div>}
                 {!isLoading && !error && tideData.length === 0 && <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center"><Waves className="h-10 w-10 mb-2" /><p>No tide data to display.</p><p className="text-sm">Search for a location and select a date range.</p></div>}
                 {!isLoading && !error && tideData.length > 0 && (
                    <ChartDisplay
                        data={tideData}
                        plottableSeries={['tideHeight']}
                        timeAxisLabel="Time"
                        yAxisConfigs={tideYAxisConfig}
                        chartRenderHeight={500} // Adjust as needed
                    />
                 )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-16 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Tide data provided by Open-Meteo. Built with Next.js and ShadCN/UI.
          </p>
        </div>
      </footer>
    </div>
  );
}
