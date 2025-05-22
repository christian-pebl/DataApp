
"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SunMoon, LayoutGrid, AlertTriangle, Info, Search as SearchIcon, MapPin, CloudSun, Thermometer, Wind, Cloud, Compass } from "lucide-react";
import { WeatherControls } from "@/components/weather/WeatherControls";
import { fetchWeatherDataAction } from "./actions";
import type { WeatherDataPoint } from "./shared";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { WeatherPlotsGrid } from "@/components/weather/WeatherPlotsGrid";
import type { DateRange } from "react-day-picker";
import { formatISO, subDays } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
};

interface SearchedCoords {
  latitude: number;
  longitude: number;
}

interface Suggestion {
  key: string;
  name: string;
}

const initialPlotVisibility = {
  temperature: true,
  windSpeed: true,
  cloudCover: true,
  windDirection: true,
};
type PlotVisibilityKeys = keyof typeof initialPlotVisibility;


export default function WeatherPage() {
  const [theme, setTheme] = useState("light");
  const [weatherData, setWeatherData] = useState<WeatherDataPoint[]>([]);
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

  const [plotVisibility, setPlotVisibility] = useState(initialPlotVisibility);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemPrefersDark) {
        setTheme("dark");
      }
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleFetchWeather = async () => {
    if (!initialCoords) {
      toast({ variant: "destructive", title: "Missing Location", description: "Please search and select a location first." });
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

    setIsLoading(true);
    setError(null);
    setWeatherData([]);

    const result = await fetchWeatherDataAction({
      latitude: initialCoords.latitude,
      longitude: initialCoords.longitude,
      startDate: formatISO(dateRange.from),
      endDate: formatISO(dateRange.to),
    });

    setIsLoading(false);
    if (result.success && result.data) {
      setWeatherData(result.data);
      if (result.message) {
        toast({ title: "Info", description: result.message, duration: 3000 });
      } else if (result.data.length === 0) {
        toast({ title: "No Data", description: "No weather data found for the selected criteria.", duration: 3000 });
      } else {
        const successToast = toast({ title: "Success", description: "Weather data fetched successfully." });
        setTimeout(() => {
            if (successToast && successToast.id) {
             toast().dismiss(successToast.id);
            }
        }, 2000);
      }
    } else {
      setError(result.error || "Failed to fetch weather data.");
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to fetch weather data." });
    }
  };
  
  const handleLocationSearchAndFetch = async () => {
    const term = searchTerm.trim().toLowerCase();
    setShowSuggestions(false);
    if (!term) {
      toast({ variant: "destructive", title: "Search Error", description: "Please enter a location to search." });
      setInitialCoords(null); // Clear coords if search term is empty
      return;
    }
    const locationKey = Object.keys(knownLocations).find(
      key => key.toLowerCase() === term || knownLocations[key].name.toLowerCase() === term
    );

    if (locationKey) {
      const location = knownLocations[locationKey];
      setInitialCoords({ latitude: location.lat, longitude: location.lon });
      toast({ title: "Location Found", description: `Coordinates for ${location.name} updated. Fetching data...` });
      await handleFetchWeather(); // Fetch data immediately after setting coords
    } else {
      setInitialCoords(null); 
      toast({ variant: "destructive", title: "Location Not Found", description: "Location not found. Try a major UK city or postcode, or enter coordinates manually." });
    }
  };


  useEffect(() => {
    if (searchTerm.trim() === "") {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = Object.entries(knownLocations)
      .filter(([key, locObj]) =>
        key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        locObj.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .map(([key, locObj]) => ({ key, name: locObj.name }));

    setSuggestions(filtered.slice(0, 5));
    setShowSuggestions(filtered.length > 0);
  }, [searchTerm]);

  const handleSuggestionClick = async (suggestionKey: string) => {
    const location = knownLocations[suggestionKey];
    if (location) {
      setSearchTerm(location.name);
      setInitialCoords({ latitude: location.lat, longitude: location.lon });
      toast({ title: "Location Selected", description: `Coordinates for ${location.name} updated. Fetching data...` });
      setShowSuggestions(false);
      await handleFetchWeather(); // Fetch data immediately after suggestion click
    }
  };

  const handleInputBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  const handlePlotVisibilityChange = (plotKey: PlotVisibilityKeys, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [plotKey]: checked }));
  };


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <TooltipProvider>
          <div className="container flex h-14 items-center justify-between px-3 md:px-4">
            <Link href="/" passHref>
              <h1 className="text-2xl font-bold text-primary cursor-pointer">PEBL</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/" passHref>
                    <Button variant={pathname === '/' ? "secondary" : "ghost"} size="icon" aria-label="Data Explorer">
                      <LayoutGrid className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Data Explorer</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/weather" passHref>
                    <Button variant={pathname === '/weather' ? "secondary" : "ghost"} size="icon" aria-label="Weather Page">
                      <CloudSun className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Weather Page</p>
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme (Settings)">
                    <SunMoon className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle Theme</p>
                </TooltipContent>
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
                <MapPin className="h-5 w-5 text-primary" /> Location & Fetch
              </h3>
              <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                  <Input
                    type="text"
                    placeholder="Search UK place or postcode..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => {
                      if (searchTerm.trim() !== "" && suggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    onBlur={handleInputBlur}
                    onKeyDown={(e) => { 
                      if (e.key === 'Enter') {
                        handleLocationSearchAndFetch();
                        setShowSuggestions(false);
                      }
                    }}
                    className="h-9 text-sm"
                  />
                  <Button onClick={handleLocationSearchAndFetch} size="icon" variant="default" className="h-9 w-9 shrink-0">
                    <SearchIcon className="h-4 w-4" />
                    <span className="sr-only">Search & Fetch Weather</span>
                  </Button>
                </div>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-0 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion.key}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted focus:bg-muted focus:outline-none"
                        onClick={() => handleSuggestionClick(suggestion.key)}
                        onMouseDown={(e) => e.preventDefault()} // Prevents onBlur from firing before onClick
                      >
                        {suggestion.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {initialCoords && (
                <p className="text-xs text-center text-muted-foreground mt-2 mb-1">
                  Lat: {initialCoords.latitude.toFixed(4)}, Lon: {initialCoords.longitude.toFixed(4)}
                </p>
              )}
            </Card>

            <Card className="p-4 border rounded-lg shadow-sm bg-card">
                <h3 className="text-md font-semibold mb-3 text-center">Display Plots</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {(Object.keys(plotVisibility) as PlotVisibilityKeys[]).map((key) => (
                        <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                                id={`visibility-${key}`}
                                checked={plotVisibility[key]}
                                onCheckedChange={(checked) => handlePlotVisibilityChange(key, !!checked)}
                            />
                            <Label htmlFor={`visibility-${key}`} className="text-sm font-normal capitalize cursor-pointer">
                                {key.replace(/([A-Z])/g, ' $1').trim()} {/* Add space before capital letters */}
                            </Label>
                        </div>
                    ))}
                </div>
            </Card>
            
            <WeatherControls 
              dateRange={dateRange}
              onDateChange={setDateRange}
            />
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-lg h-full">
              <CardHeader className="p-3">
                <CardTitle className="text-md">
                  Historical Weather Data Plots
                </CardTitle>
                <CardDescription className="text-xs">Data from Open-Meteo. Select location and date range.</CardDescription>
              </CardHeader>
              <CardContent className="p-2 h-[calc(100%-5rem)]">
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
        <div className="container flex flex-col items-center justify-center gap-2 md:h-16 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Weather data provided by Open-Meteo. Built with Next.js and ShadCN/UI.
          </p>
        </div>
      </footer>
    </div>
  );
}

    