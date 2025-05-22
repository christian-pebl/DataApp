
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SunMoon, CloudSun, LayoutGrid, AlertTriangle, Info, Search as SearchIcon, MapPin } from "lucide-react"; // Added SearchIcon
import { WeatherControls } from "@/components/weather/WeatherControls";
import type { WeatherControlsFormValues, WeatherVariableValue } from "@/components/weather/WeatherControls";
import { ChartDisplay } from "@/components/dataflow/ChartDisplay";
import { fetchWeatherDataAction } from "./actions";
import type { WeatherDataPoint } from "./shared";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input"; // Added Input

// Simulated geocoding data
const knownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "london": { lat: 51.5074, lon: -0.1278, name: "London" },
  "manchester": { lat: 53.4808, lon: -2.2426, name: "Manchester" },
  "edinburgh": { lat: 55.9533, lon: -3.1883, name: "Edinburgh" },
  "eh1 1aa": { lat: 55.9522, lon: -3.1900, name: "Edinburgh (EH1 1AA)" }, // Example UK postcode
  "birmingham": { lat: 52.4862, lon: -1.8904, name: "Birmingham" },
};

interface SearchedCoords {
  latitude: number;
  longitude: number;
}

export default function WeatherPage() {
  const [theme, setTheme] = useState("light");
  const [weatherData, setWeatherData] = useState<WeatherDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSelectedVariable, setCurrentSelectedVariable] = useState<string>("temperature");
  const { toast } = useToast();
  const pathname = usePathname();

  const [searchTerm, setSearchTerm] = useState("");
  const [initialCoords, setInitialCoords] = useState<SearchedCoords | null>(null);


  // Theme management
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

  const handleFetchWeather = async (values: {latitude: number, longitude: number, startDate: string, endDate: string, variable: WeatherVariableValue}) => {
    setIsLoading(true);
    setError(null);
    setWeatherData([]); // Clear previous data
    setCurrentSelectedVariable(values.variable);

    const result = await fetchWeatherDataAction({
      latitude: values.latitude,
      longitude: values.longitude,
      startDate: values.startDate,
      endDate: values.endDate,
    });

    setIsLoading(false);
    if (result.success && result.data) {
      setWeatherData(result.data);
      if (result.message) {
        toast({ title: "Info", description: result.message });
      } else if (result.data.length === 0) {
        toast({ title: "No Data", description: "No weather data found for the selected criteria." });
      } else {
        // Toast for successful data fetch
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
  
  const handleLocationSearch = () => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      toast({ variant: "destructive", title: "Search Error", description: "Please enter a location to search." });
      return;
    }
    const location = knownLocations[term];
    if (location) {
      setInitialCoords({ latitude: location.lat, longitude: location.lon });
      toast({ title: "Location Found", description: `Coordinates for ${location.name} updated.` });
    } else {
      setInitialCoords(null); // Clear if previous search was successful
      toast({ variant: "destructive", title: "Location Not Found", description: "Location not found. Try a major UK city or postcode, or enter coordinates manually." });
    }
  };


  const chartCompatibleData = weatherData as Array<{[key: string]: string | number | undefined; time: string | number}>;

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
          <div className="md:col-span-4 lg:col-span-3">
            <Card className="mb-4 p-4 border rounded-lg shadow-sm bg-card">
              <h3 className="text-md font-semibold mb-2 text-center flex items-center justify-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Location Selector
              </h3>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  type="text"
                  placeholder="Search UK place or postcode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLocationSearch(); }}
                  className="h-9 text-sm"
                />
                <Button onClick={handleLocationSearch} size="icon" variant="outline" className="h-9 w-9 shrink-0">
                  <SearchIcon className="h-4 w-4" />
                  <span className="sr-only">Search</span>
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground mb-1">
                Or enter latitude/longitude below.
              </p>
            </Card>
            <WeatherControls 
              onSubmit={handleFetchWeather} 
              isLoading={isLoading}
              initialCoords={initialCoords} 
            />
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-lg h-full">
              <CardHeader className="p-3">
                <CardTitle className="text-md">
                  Weather Plot: {currentSelectedVariable.charAt(0).toUpperCase() + currentSelectedVariable.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-[calc(100%-4rem)]"> {/* Adjust height calculation if header padding changes */}
                {isLoading && (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-2"></div>
                    Fetching data...
                  </div>
                )}
                {error && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-destructive p-4 text-center">
                    <AlertTriangle className="h-10 w-10 mb-2" />
                    <p className="font-semibold">Error Fetching Data</p>
                    <p className="text-sm">{error}</p>
                  </div>
                )}
                {!isLoading && !error && weatherData.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center">
                    <Info className="h-10 w-10 mb-2" />
                    <p>No data to display.</p>
                    <p className="text-sm">Please select criteria and fetch weather data.</p>
                  </div>
                )}
                {!isLoading && !error && weatherData.length > 0 && (
                  <ChartDisplay
                    data={chartCompatibleData}
                    plottableSeries={[currentSelectedVariable]}
                    timeAxisLabel="Date / Time"
                    plotTitle={`Weather Data: ${currentSelectedVariable}`}
                    chartRenderHeight={400} // Example height, adjust as needed
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
            Weather data is illustrative. Built with Next.js and ShadCN/UI.
          </p>
        </div>
      </footer>
    </div>
  );
}

    