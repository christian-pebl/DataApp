
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, ListChecks, AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchMonitoringStationsAction } from "./actions";
import type { EAStationInfo } from "./shared";
import { useToast } from "@/hooks/use-toast";

export default function EAExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast } = useToast();

  const [stations, setStations] = useState<EAStationInfo[]>([]);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [errorStations, setErrorStations] = useState<string | null>(null);

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
    setStations([]);
    const result = await fetchMonitoringStationsAction();
    setIsLoadingStations(false);
    if (result.success && result.stations) {
      setStations(result.stations);
      toast({ title: "Success", description: `Found ${result.stations.length} relevant EA monitoring stations.` });
    } else {
      setErrorStations(result.error || "Failed to load stations.");
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to load stations." });
    }
  };

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

      <main className="flex-grow container mx-auto p-3 md:p-4">
        <Card>
          <CardHeader>
            <CardTitle>Environment Agency Data Explorer</CardTitle>
            <CardDescription>
              Explore available monitoring stations from the Environment Agency.
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
                      <li key={station.id} className="p-2 text-sm border-b last:border-b-0 hover:bg-muted/50 rounded-sm">
                        <p className="font-medium">{station.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {station.id}
                          {station.notation && station.notation !== station.id && ` (Notation: ${station.notation})`}
                          {station.lat && station.lon && ` | Lat: ${station.lat.toFixed(4)}, Lon: ${station.lon.toFixed(4)}`}
                        </p>
                        {/* Placeholder for future action: Select this station to view its measures */}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
                 <p className="text-xs text-muted-foreground pt-2">
                    Note: Station list is filtered for potential tidal relevance and limited to 100 results for performance. 
                    Clicking a station to see its measures will be the next step.
                  </p>
              </div>
            )}
             {stations.length === 0 && !isLoadingStations && !errorStations && (
                 <p className="text-sm text-muted-foreground pt-2">
                    Click "Load Monitoring Stations" to fetch a list of available stations.
                  </p>
            )}
          </CardContent>
        </Card>
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
