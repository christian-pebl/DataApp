
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, ListChecks, AlertCircle, Target, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchMonitoringStationsAction, fetchStationMeasuresAction } from "./actions";
import type { EAStationInfo, EAMeasureInfo } from "./shared";
import { useToast } from "@/hooks/use-toast";

export default function EAExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast } = useToast();

  const [stations, setStations] = useState<EAStationInfo[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [errorStations, setErrorStations] = useState<string | null>(null);

  const [selectedStation, setSelectedStation] = useState<EAStationInfo | null>(null);
  const [stationMeasures, setStationMeasures] = useState<EAMeasureInfo[]>([]);
  const [isLoadingMeasures, setIsLoadingMeasures] = useState(false);
  const [errorMeasures, setErrorMeasures] = useState<string | null>(null);
  const [currentStationNameForMeasures, setCurrentStationNameForMeasures] = useState<string | null>(null);


  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    else {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemPrefersDark) setTheme("dark");
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handleLoadStations = async () => {
    setIsLoadingStations(true);
    setErrorStations(null);
    setSelectedStation(null);
    setStationMeasures([]);
    setErrorMeasures(null);
    setStations([]);
    const result = await fetchMonitoringStationsAction();
    setIsLoadingStations(false);
    if (result.success && result.stations) {
      setStations(result.stations);
      toast({ title: "Success", description: `Found ${result.stations.length} active EA monitoring stations.` });
    } else {
      setErrorStations(result.error || "Failed to load stations.");
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to load stations." });
    }
  };

  const handleSelectStation = useCallback(async (station: EAStationInfo) => {
    setSelectedStation(station);
    setIsLoadingMeasures(true);
    setErrorMeasures(null);
    setStationMeasures([]);
    setCurrentStationNameForMeasures(station.name); // Optimistically set name

    toast({ title: "Fetching Measures", description: `Loading measures for ${station.name}...`});

    const result = await fetchStationMeasuresAction(station.id);
    setIsLoadingMeasures(false);

    if (result.success && result.measures) {
      setStationMeasures(result.measures);
      if (result.stationName) setCurrentStationNameForMeasures(result.stationName);
      if (result.measures.length === 0) {
        toast({ variant: "default", title: "No Measures", description: `No specific measures found for ${result.stationName || station.name}.`, duration: 3000 });
      } else {
        toast({ title: "Measures Loaded", description: `Found ${result.measures.length} measures for ${result.stationName || station.name}.` });
      }
    } else {
      setErrorMeasures(result.error || `Failed to load measures for ${station.name}.`);
      toast({ variant: "destructive", title: "Error Loading Measures", description: result.error || `Failed to load measures for ${station.name}.` });
    }
  }, [toast]);


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
                  <Link href="/ea-explorer" passHref>
                    <Button variant={pathname === '/ea-explorer' ? "secondary": "ghost"} size="icon" aria-label="EA Explorer">
                      <Waves className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>EA Data Explorer</p></TooltipContent>
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

      <main className="flex-grow container mx-auto p-3 md:p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Environment Agency Station Explorer</CardTitle>
            <CardDescription>
              Load and explore active monitoring stations from the Environment Agency. Click a station to view its measures.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLoadStations} disabled={isLoadingStations}>
              {isLoadingStations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
              Load Monitoring Stations
            </Button>

            {isLoadingStations && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading stations...</p>
              </div>
            )}

            {errorStations && !isLoadingStations && (
              <div className="flex flex-col items-center justify-center p-4 text-destructive bg-destructive/10 rounded-md">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="font-semibold">Failed to load stations</p>
                <p className="text-sm text-center">{errorStations}</p>
              </div>
            )}

            {stations.length > 0 && !isLoadingStations && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Available Stations ({stations.length} found)</h3>
                <ScrollArea className="h-72 w-full rounded-md border p-2">
                  <ul className="space-y-1">
                    {stations.map((station) => (
                      <li key={station.id}>
                        <Button
                          variant={selectedStation?.id === station.id ? "secondary" : "ghost"}
                          className="w-full justify-start text-left p-2 h-auto"
                          onClick={() => handleSelectStation(station)}
                          disabled={isLoadingMeasures && selectedStation?.id === station.id}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{station.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ID: {station.id}
                              {station.notation && station.notation !== station.id && ` (Notation: ${station.notation})`}
                              {station.lat && station.lon && ` | Lat: ${station.lat.toFixed(4)}, Lon: ${station.lon.toFixed(4)}`}
                            </span>
                           </div>
                           {isLoadingMeasures && selectedStation?.id === station.id && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
             {stations.length === 0 && !isLoadingStations && !errorStations && (
                 <p className="text-sm text-muted-foreground pt-2">
                    Click "Load Monitoring Stations" to fetch a list of available stations.
                  </p>
            )}
          </CardContent>
        </Card>

        {/* Section to display measures for selected station */}
        {selectedStation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary"/> Measures for: {currentStationNameForMeasures || selectedStation.name}
              </CardTitle>
              <CardDescription>Station ID: {selectedStation.id}</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMeasures && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 text-muted-foreground">Loading measures...</p>
                </div>
              )}
              {errorMeasures && !isLoadingMeasures && (
                <div className="flex flex-col items-center justify-center p-4 text-destructive bg-destructive/10 rounded-md">
                  <AlertCircle className="h-8 w-8 mb-2" />
                  <p className="font-semibold">Failed to load measures</p>
                  <p className="text-sm text-center">{errorMeasures}</p>
                </div>
              )}
              {stationMeasures.length > 0 && !isLoadingMeasures && (
                <div className="space-y-2">
                  <h3 className="text-md font-semibold">Available Measures ({stationMeasures.length} found)</h3>
                  <ScrollArea className="h-60 w-full rounded-md border p-2">
                    <ul className="divide-y divide-border">
                      {stationMeasures.map((measure) => (
                        <li key={measure.id} className="p-2 text-sm hover:bg-muted/50">
                          <p className="font-medium flex items-center gap-1.5">
                            <Activity className="h-4 w-4 text-muted-foreground"/>
                            {measure.parameterName}
                            {measure.qualifier && <span className="text-xs text-muted-foreground">({measure.qualifier})</span>}
                          </p>
                          <p className="text-xs text-muted-foreground ml-5">Unit: {measure.unitName}</p>
                          {/* Placeholder for future: Click to select this measure for plotting */}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
              {stationMeasures.length === 0 && !isLoadingMeasures && !errorMeasures && (
                <p className="text-sm text-muted-foreground">No measures found for this station, or the data is currently unavailable.</p>
              )}
            </CardContent>
          </Card>
        )}

      </main>

      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Data from Environment Agency.
          </p>
        </div>
      </footer>
    </div>
  );
}
