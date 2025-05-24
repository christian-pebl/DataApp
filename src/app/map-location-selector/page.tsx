
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SunMoon, LayoutGrid, Waves, CloudSun, MapPin as MapPinIcon, Anchor } from "lucide-react"; // Added MapPinIcon for header
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import type { LatLngExpression } from 'leaflet';

// Dynamically import the map component to avoid SSR issues
const InteractivePinMap = dynamic(
  () => import('@/components/map/InteractivePinMap').then((mod) => mod.InteractivePinMap),
  { 
    ssr: false,
    loading: () => <p className="text-center p-4">Loading map...</p> 
  }
);

export default function MapLocationSelectorPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([54.5, -3.5]); // Approx center of UK
  const [mapZoom, setMapZoom] = useState<number>(6);


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

  const handleLocationSelect = (coords: { lat: number; lng: number }) => {
    setSelectedCoords(coords);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/om-marine-explorer" passHref>
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
                  <Link href="/om-marine-explorer" passHref>
                    <Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="OM Marine Explorer">
                      <Waves className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>OM Marine Explorer</p></TooltipContent>
              </Tooltip>
               <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/map-location-selector" passHref>
                    <Button variant={pathname === '/map-location-selector' ? "secondary" : "ghost"} size="icon" aria-label="Map Location Selector">
                      <MapPinIcon className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>Map Location Selector</p></TooltipContent>
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

      <main className="flex-grow container mx-auto p-3 md:p-4 flex flex-col">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-primary" />
              Map Location Selector
            </CardTitle>
            <CardDescription className="text-xs">
              Click on the map to select a location and get its coordinates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedCoords ? (
              <div className="mb-3 p-3 border rounded-md bg-muted/50 text-sm">
                <p><span className="font-semibold">Selected Latitude:</span> {selectedCoords.lat.toFixed(5)}</p>
                <p><span className="font-semibold">Selected Longitude:</span> {selectedCoords.lng.toFixed(5)}</p>
              </div>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">No location selected yet. Click on the map.</p>
            )}
          </CardContent>
        </Card>
        
        <Card className="flex-grow flex flex-col shadow-sm">
            <CardContent className="p-1.5 flex-grow">
                 <div className="h-[500px] md:h-full w-full rounded-md overflow-hidden border">
                    <InteractivePinMap 
                        initialCenter={mapCenter}
                        initialZoom={mapZoom}
                        onLocationSelect={handleLocationSelect}
                        selectedCoords={selectedCoords}
                    />
                </div>
            </CardContent>
        </Card>
      </main>

      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            PEBL data app - Map Location Selector
          </p>
        </div>
      </footer>
    </div>
  );
}

