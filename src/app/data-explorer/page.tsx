
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"; // Added useMemo
import Link from "next/link";
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic'; // Added for dynamic map import
import type { DateRange } from "react-day-picker"; // Added for DatePicker
import { format, subDays, addDays } from 'date-fns'; // Added for DatePicker defaults

import { Button } from "@/components/ui/button";
import { PlotInstance } from "@/components/dataflow/PlotInstance";
import { PlusCircle, SunMoon, LayoutGrid, Waves, CloudSun, Anchor, MapPin, CalendarDays, Search } from "lucide-react"; // Added MapPin, CalendarDays, Search
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"; // Added Card components
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"; // Added DatePicker
import { Input } from "@/components/ui/input"; // Added Input
import { Label as UiLabel } from "@/components/ui/label"; // Added UiLabel
import { useToast } from "@/hooks/use-toast"; // Added useToast
import { cn } from "@/lib/utils"; // Added cn

interface PlotConfig {
  id: string;
  title: string;
}

// Dynamically import OpenLayersMap component to avoid SSR issues
const OpenLayersMapWithNoSSR = dynamic(
  () => import('@/components/map/OpenLayersMap').then(mod => mod.OpenLayersMap),
  {
    ssr: false,
    loading: () => <p className="text-center p-4 text-muted-foreground">Loading map...</p>
  }
);

// Default coordinates and known locations (copied from om-marine-explorer)
const DEFAULT_LATITUDE = 51.7128; // Milford Haven
const DEFAULT_LONGITUDE = -5.0341;
const DEFAULT_MAP_ZOOM = 9;

const defaultLocationKey = "milfordhaven";
const knownLocations: Record<string, { name: string; lat: number; lon: number }> = {
  milfordhaven: { name: "Milford Haven", lat: 51.7128, lon: -5.0341 },
  newlyn: { name: "Newlyn", lat: 50.102, lon: -5.549 },
  dover: { name: "Dover", lat: 51.123, lon: 1.317 },
  liverpool: { name: "Liverpool", lat: 53.408, lon: -2.992 },
  portsmouth: { name: "Portsmouth", lat: 50.819, lon: -1.088 },
  aberdeen: { name: "Aberdeen", lat: 57.149, lon: -2.094 },
  "stDavidsHead": { name: "St David's Head", lat: 52.0, lon: -5.3 },
};

export default function DataExplorerPage() {
  const [theme, setTheme] = useState("light");
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const plotsInitialized = useRef(false);
  const pathname = usePathname();
  const { toast } = useToast(); // For map location selection toast

  // State for new Location & Date section (from om-marine-explorer)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: new Date("2025-05-17"), // Default copied from om-marine-explorer
    to: new Date("2025-05-20"),   // Default copied from om-marine-explorer
  }));

  const [mapSelectedCoords, setMapSelectedCoords] = useState<{ lat: number; lon: number } | null>(
    knownLocations[defaultLocationKey]
      ? { lat: knownLocations[defaultLocationKey].lat, lon: knownLocations[defaultLocationKey].lon }
      : { lat: DEFAULT_LATITUDE, lon: DEFAULT_LONGITUDE }
  );
  const [currentLocationName, setCurrentLocationName] = useState<string>(
    knownLocations[defaultLocationKey]?.name || "Selected Location"
  );
  const [searchTerm, setSearchTerm] = useState<string>(knownLocations[defaultLocationKey]?.name || "");
  const [suggestions, setSuggestions] = useState<Array<{ key: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const initialMapRenderDone = useRef(false); // To prevent re-centering map on every render

  useEffect(() => {
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem("theme") : null;
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      const systemPrefersDark = typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemPrefersDark) {
        setTheme("dark");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const addPlot = useCallback(() => {
    setPlots((prevPlots) => [
      ...prevPlots,
      { id: `plot-${Date.now()}-${prevPlots.length}`, title: `Plot ${prevPlots.length + 1}` },
    ]);
  }, []);

  const removePlot = useCallback((idToRemove: string) => {
    setPlots((prevPlots) => prevPlots.filter((plot) => plot.id !== idToRemove));
  }, []);

  useEffect(() => {
    if (!plotsInitialized.current && plots.length === 0) {
      addPlot(); 
      plotsInitialized.current = true;
    }
  }, [addPlot, plots.length]);

  // Logic for new Location & Date section (from om-marine-explorer)
  const handleMapLocationSelect = useCallback((coords: { lat: number; lon: number }) => {
    setMapSelectedCoords(coords);
    let foundName = "Custom Location";
    for (const key in knownLocations) {
      if (knownLocations[key].lat.toFixed(3) === coords.lat.toFixed(3) && knownLocations[key].lon.toFixed(3) === coords.lon.toFixed(3)) {
        foundName = knownLocations[key].name;
        break;
      }
    }
    setCurrentLocationName(foundName);
    setSearchTerm(foundName); // Update search term when map is clicked
    toast({ title: "Location Selected on Map", description: `${foundName} (Lat: ${coords.lat.toFixed(3)}, Lon: ${coords.lon.toFixed(3)})` });
    setShowSuggestions(false);
  }, [toast]);

  const handleSuggestionClick = useCallback((locationKey: string) => {
    const selectedLoc = knownLocations[locationKey];
    if (selectedLoc) {
      handleMapLocationSelect({ lat: selectedLoc.lat, lon: selectedLoc.lon });
    }
  }, [handleMapLocationSelect]);

  useEffect(() => {
    if (searchTerm === "") {
      setSuggestions([]);
      // Keep suggestions open if input is focused, even if empty
      // setShowSuggestions(false); 
      return;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = Object.entries(knownLocations)
      .filter(([key, loc]) => key.toLowerCase().includes(lowerSearchTerm) || loc.name.toLowerCase().includes(lowerSearchTerm))
      .map(([key, loc]) => ({ key, name: loc.name }))
      .slice(0, 5);
    setSuggestions(filtered);
    setShowSuggestions(true); // Always show if there are suggestions and search term is not empty
  }, [searchTerm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  // Ensure initialMapRenderDone logic for default map centering
  useEffect(() => {
    if (!mapSelectedCoords && !initialMapRenderDone.current && knownLocations[defaultLocationKey]) {
      setMapSelectedCoords({
        lat: knownLocations[defaultLocationKey].lat,
        lon: knownLocations[defaultLocationKey].lon,
      });
      setCurrentLocationName(knownLocations[defaultLocationKey].name);
      setSearchTerm(knownLocations[defaultLocationKey].name);
      initialMapRenderDone.current = true;
    }
  }, [mapSelectedCoords]);


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/data-explorer" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/data-explorer" passHref>
                    <Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer (CSV)">
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
                  <Link href="/om-marine-explorer" passHref>
                    <Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="OM Marine Explorer">
                      <Waves className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>OM Marine Explorer</p></TooltipContent>
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

      <main className="flex-grow container mx-auto p-2 md:p-3 space-y-3">
        <div className="flex justify-center mb-3">
          <Button onClick={addPlot} size="sm" className="h-8 text-xs">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Plot (CSV)
          </Button>
        </div>

        {/* New Location & Date Selection Card */}
        <Card className="mb-3 shadow-sm">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> Location &amp; Date (for API Data - future)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-3">
             <div className="relative" ref={suggestionsRef}>
              <UiLabel htmlFor="location-search-data-explorer" className="text-xs font-medium mb-0.5 block">Search Location</UiLabel>
              <div className="flex gap-1">
                <Input
                  id="location-search-data-explorer"
                  type="text"
                  placeholder="e.g., Milford Haven"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => { if(suggestions.length > 0 || searchTerm === "" || Object.values(knownLocations).some(loc => loc.name === searchTerm)) setShowSuggestions(true);}}
                  className="h-9 text-xs flex-grow"
                />
              </div>
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 border bg-card shadow-lg rounded-md max-h-60 overflow-y-auto">
                  {suggestions.map(loc => (
                    <button
                      key={loc.key}
                      onClick={() => handleSuggestionClick(loc.key)}
                      className="block w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Select Location on Map:</p>
              <div className="h-[200px] w-full rounded-md overflow-hidden border">
                <OpenLayersMapWithNoSSR
                  initialCenter={mapSelectedCoords ? [mapSelectedCoords.lon, mapSelectedCoords.lat] : [DEFAULT_LONGITUDE, DEFAULT_LATITUDE]}
                  initialZoom={DEFAULT_MAP_ZOOM}
                  selectedCoords={mapSelectedCoords}
                  onLocationSelect={handleMapLocationSelect}
                />
              </div>
              {mapSelectedCoords && (
                <p className="text-xs text-muted-foreground text-center mt-1">
                  {currentLocationName} (Lat: {mapSelectedCoords.lat.toFixed(3)}, Lon: {mapSelectedCoords.lon.toFixed(3)})
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium mb-1 flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-primary/80" /> Select Date Range:
              </p>
              <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
            </div>
          </CardContent>
        </Card>
        {/* End of New Location & Date Selection Card */}

        {plots.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground h-60 p-2">
            <LayoutGrid className="w-8 h-8 mb-2 text-muted" />
            <p className="text-xs">No CSV plots to display.</p>
            <p className="text-[0.7rem]">Click "Add New Plot (CSV)" to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plots.map((plot) => (
              <PlotInstance
                key={plot.id}
                instanceId={plot.id}
                initialPlotTitle={plot.title}
                onRemovePlot={removePlot}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="py-2 md:px-3 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-1 md:h-10 md:flex-row">
          <p className="text-balance text-center text-[0.7rem] leading-loose text-muted-foreground">
            PEBL data app - CSV Data Explorer.
          </p>
        </div>
      </footer>
    </div>
  );
}

