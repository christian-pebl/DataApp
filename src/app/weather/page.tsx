
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label"; 
import { Loader2, Search, MapPin, SunMoon, LayoutGrid, CloudSun, Waves, Thermometer, Wind, Cloud as CloudIconLucide, Compass, ListChecks } from "lucide-react";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { fetchWeatherDataAction } from "./actions";
import type { WeatherDataPoint, PlotVisibilityKeys } from "./shared";
import { useToast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";
import { formatISO, subDays } from "date-fns";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const WeatherPlotsGrid = dynamic(
  () => import('@/components/weather/WeatherPlotsGrid').then(mod => mod.WeatherPlotsGrid),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 text-primary mr-2" />Loading plots...</div>
  }
);

const knownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "london": { lat: 51.5074, lon: -0.1278, name: "London" },
  "manchester": { lat: 53.4808, lon: -2.2426, name: "Manchester" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, name: "Edinburgh" },
  "eh1 1aa": { lat: 55.9522, lon: -3.1900, name: "Edinburgh (EH1 1AA)" },
  "birmingham": { lat: 52.4862, lon: -1.8904, name: "Birmingham" },
  "stdavids": { lat: 51.8818, lon: -5.2661, name: "Saint David's" },
};
const defaultLocationKey = "stdavids";

interface SearchedCoords {
  latitude: number;
  longitude: number;
}

interface Suggestion {
  key: string;
  name: string;
}

const plotConfigIcons: Record<PlotVisibilityKeys, React.ElementType> = {
  temperature: Thermometer,
  windSpeed: Wind,
  cloudCover: CloudIconLucide,
  windDirection: Compass,
};
const plotDisplayTitles: Record<PlotVisibilityKeys, string> = {
  temperature: "Temperature", windSpeed: "Wind Speed", cloudCover: "Cloud Cover", windDirection: "Wind Direction",
};


export default function WeatherPage() {
  const [theme, setTheme] = useState("light");
  const [weatherData, setWeatherData] = useState<WeatherDataPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, dismiss } = useToast();
  const pathname = usePathname();

  const [searchTerm, setSearchTerm] = useState("");
  const [initialCoords, setInitialCoords] = useState<SearchedCoords | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocationName, setCurrentLocationName] = useState<string | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7),
    to: new Date(),
  }));

  const [plotVisibility, setPlotVisibility] = useState<Record<PlotVisibilityKeys, boolean>>({
    temperature: true,
    windSpeed: true,
    cloudCover: true,
    windDirection: true,
  });

  const initialFetchDone = useRef(false);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
    
    const defaultLoc = knownLocations[defaultLocationKey];
    if (defaultLoc) {
      setSearchTerm(defaultLoc.name); 
      const coords = { latitude: defaultLoc.lat, longitude: defaultLoc.lon };
      setInitialCoords(coords);
      setCurrentLocationName(defaultLoc.name);
      if (dateRange?.from && dateRange?.to && !initialFetchDone.current && !isLoading && !error) {
         handleLocationSearchAndFetch(coords, defaultLoc.name, true); // Auto fetch for default
         initialFetchDone.current = true;
      }
    }
  }, []); 

  const handlePlotVisibilityChange = useCallback((key: PlotVisibilityKeys, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  const handleFetchWeatherData = async (coordsToUse: SearchedCoords, locationNameToUse: string) => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range."});
      return;
    }
    if (dateRange.from > dateRange.to) {
        toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
        return;
    }

    setIsLoading(true);
    setError(null);
    // setWeatherData(null); // Keep old data while new is fetching for smoother UX unless explicitly cleared

    const loadingToastId = toast({ title: "Fetching Data", description: `Fetching weather data for ${locationNameToUse}...` }).id;

    const result = await fetchWeatherDataAction({
      latitude: coordsToUse.latitude,
      longitude: coordsToUse.longitude,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
    });
    
    if(loadingToastId) dismiss(loadingToastId);
    setIsLoading(false);

    if (result.success && result.data) {
      setWeatherData(result.data);
      setCurrentLocationName(locationNameToUse); // Update current location name on successful fetch
      if (result.message) { 
        toast({ title: "Info", description: result.message, duration: 3000 });
      } else if (result.data.length === 0) {
        toast({ title: "No Data", description: `No weather data points found for ${locationNameToUse} in the selected period.`, duration: 3000 });
      } else {
        toast({ title: "Success", description: `Weather data fetched for ${locationNameToUse}.` });
      }
    } else {
      setError(result.error || "Failed to fetch weather data.");
      setWeatherData(null); // Clear data on error
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to fetch weather data." });
    }
  };
  
  const handleLocationSearchAndFetch = useCallback(async (
    coordsOverride?: SearchedCoords, 
    nameOverride?: string,
    isAutoFetch: boolean = false
  ) => {
    const term = searchTerm.trim().toLowerCase();
    setShowSuggestions(false); 
    
    let coordsForFetch: SearchedCoords | null = coordsOverride || initialCoords;
    let nameForFetch: string | null = nameOverride || currentLocationName;

    if (!isAutoFetch && !coordsOverride) { // Standard search button click
      if (!term) {
        toast({ variant: "destructive", title: "Search Error", description: "Please enter a location." });
        return;
      }
      const locationKey = Object.keys(knownLocations).find(
        key => key.toLowerCase() === term || knownLocations[key].name.toLowerCase() === term
      );

      if (locationKey) {
        const location = knownLocations[locationKey];
        coordsForFetch = { latitude: location.lat, longitude: location.lon };
        nameForFetch = location.name;
        setInitialCoords(coordsForFetch); 
        setCurrentLocationName(nameForFetch);
        if (knownLocations[locationKey].name !== searchTerm) {
          setSearchTerm(knownLocations[locationKey].name);
        }
      } else {
         toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known UK location from suggestions or enter a valid one." });
         return;
      }
    }
    
    if (coordsForFetch && nameForFetch && dateRange?.from && dateRange?.to) {
      await handleFetchWeatherData(coordsForFetch, nameForFetch);
    } else if (!coordsForFetch || !nameForFetch) {
       toast({ variant: "destructive", title: "Missing Location", description: "Could not determine coordinates for fetching." });
    }
  }, [searchTerm, initialCoords, currentLocationName, dateRange, toast]);


  useEffect(() => { // For suggestions
    const currentSearchTerm = searchTerm.trim();
    const inputElement = document.activeElement as HTMLInputElement;
    const isFocused = inputElement && inputElement.placeholder === "Search UK place or postcode...";

    if (currentSearchTerm === "" && isFocused) {
       setSuggestions(Object.entries(knownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
       setShowSuggestions(true); return;
    }
    if (currentSearchTerm === "") { setSuggestions([]); setShowSuggestions(false); return; }

    const termLower = currentSearchTerm.toLowerCase();
    const filtered = Object.entries(knownLocations)
      .filter(([key, locObj]) => key.toLowerCase().includes(termLower) || locObj.name.toLowerCase().includes(termLower) )
      .map(([key, locObj]) => ({ key, name: locObj.name }));
    setSuggestions(filtered.slice(0, 5));
    setShowSuggestions(filtered.length > 0 && isFocused);
  }, [searchTerm]);

  const handleSuggestionClick = useCallback((suggestionKey: string) => {
    const location = knownLocations[suggestionKey];
    if (location) {
      setSearchTerm(location.name); 
      const newCoords = { latitude: location.lat, longitude: location.lon };
      setInitialCoords(newCoords); 
      setCurrentLocationName(location.name);
      setShowSuggestions(false);
      // Do not auto-fetch here; user will click "Search & Fetch Weather"
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
  
  const handleInputBlur = () => { setTimeout(() => { setShowSuggestions(false); }, 150); }; // Delay to allow click on suggestion

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/weather" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Link href="/data-explorer" passHref><Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer (CSV)"><LayoutGrid className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Data Explorer (CSV)</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/weather" passHref><Button variant={pathname === '/weather' ? "secondary": "ghost"} size="icon" aria-label="Weather Page"><CloudSun className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Weather Page</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/ea-explorer" passHref><Button variant={pathname === '/ea-explorer' ? "secondary": "ghost"} size="icon" aria-label="Open Access Data Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Open Access Data Explorer</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 lg:col-span-3 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary"/>Location & Date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="relative">
                  <Input type="text" placeholder="Search UK place or postcode..." value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         onFocus={handleInputFocus} onBlur={handleInputBlur}
                         onKeyDown={(e) => { if (e.key === 'Enter') { handleLocationSearchAndFetch(); setShowSuggestions(false); } }}
                         className="h-9 text-xs"/>
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-0 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {suggestions.map((s) => <button key={s.key} type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted focus:bg-muted focus:outline-none" onClick={() => handleSuggestionClick(s.key)} onMouseDown={(e) => e.preventDefault()}>{s.name}</button>)}
                    </div>
                  )}
                </div>
                {initialCoords && <p className="text-xs text-muted-foreground text-center">Lat: {initialCoords.latitude.toFixed(3)}, Lon: {initialCoords.longitude.toFixed(3)}</p>}
                <div>
                  <UiLabel htmlFor="date-range-picker" className="text-xs font-medium mb-0.5 block">Date Range</UiLabel>
                  <DatePickerWithRange id="date-range-picker" date={dateRange} onDateChange={setDateRange} disabled={isLoading} />
                   {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                </div>
                 <Button onClick={() => handleLocationSearchAndFetch()} disabled={isLoading || !searchTerm || !dateRange?.from || !dateRange?.to} className="w-full h-9 text-xs">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                    {isLoading ? "Fetching..." : "Search & Fetch Weather"}
                </Button>
              </CardContent>
            </Card>
            <Card>
                <CardHeader className="pb-2 pt-3"><CardTitle className="text-base flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" />Display Plots</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                    {(Object.keys(plotVisibility) as PlotVisibilityKeys[]).map((key) => {
                    const IconComp = plotConfigIcons[key];
                    const title = plotDisplayTitles[key];
                    return (
                        <div key={key} className="flex items-center space-x-1.5">
                        <Checkbox id={`visibility-${key}`} checked={plotVisibility[key]} onCheckedChange={(c) => handlePlotVisibilityChange(key, !!c)} className="h-3.5 w-3.5"/>
                        <UiLabel htmlFor={`visibility-${key}`} className="text-xs font-medium flex items-center gap-1 cursor-pointer"><IconComp className="h-3.5 w-3.5 text-muted-foreground"/>{title}</UiLabel>
                        </div>
                    );
                    })}
                </CardContent>
            </Card>
          </div>

          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-sm h-full">
              <CardHeader className="p-2 pt-3">
                 <CardTitle className="text-base">Data <span className="text-muted-foreground font-normal text-sm">{currentLocationName ? `- ${currentLocationName}` : ""}</span></CardTitle>
                 {/* <CardDescription className="text-xs">Weather data for the selected location and period.</CardDescription> */}
              </CardHeader>
              <CardContent className="p-1.5 h-[calc(100%-2.5rem)]"> {/* Adjusted height */}
                <WeatherPlotsGrid
                    weatherData={weatherData}
                    isLoading={isLoading}
                    error={error}
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
            Weather data by Open-Meteo. PEBL data app.
          </p>
        </div>
      </footer>
    </div>
  );
}
