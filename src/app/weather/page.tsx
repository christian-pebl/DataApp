
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, SunMoon, LayoutGrid, Waves, Search, Info, CheckCircle2, XCircle, ListChecks, FileText, MapPin, CalendarDays, CloudSun, Thermometer, Wind as WindIcon, Compass, Cloud, Anchor, Copy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { WeatherPlotsGrid } from "@/components/weather/WeatherPlotsGrid";
import { useToast } from "@/hooks/use-toast";
import { formatISO, subDays, addDays } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

import type { WeatherDataPoint, LogStep, WeatherPlotVisibilityKeys } from './shared';
import { ALL_WEATHER_PARAMETERS, WEATHER_PARAMETER_CONFIG } from './shared';
import { fetchWeatherDataAction } from './actions';

const OpenLayersMapWithNoSSR = dynamic(
  () => import('@/components/map/OpenLayersMap'),
  { 
    ssr: false,
    loading: () => <p className="text-center p-4 text-muted-foreground">Loading map...</p> 
  }
);

type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle' | 'warning';

// Default coordinates (e.g., Manchester)
const DEFAULT_LATITUDE = 53.4808;
const DEFAULT_LONGITUDE = -2.2426;
const DEFAULT_MAP_CENTER: [number, number] = [DEFAULT_LONGITUDE, DEFAULT_LATITUDE]; // OpenLayers: [lon, lat]
const DEFAULT_MAP_ZOOM = 10;


export default function WeatherPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7),
    to: new Date(),
  }));

  const [mapSelectedCoords, setMapSelectedCoords] = useState<{ lat: number; lon: number } | null>({
    lat: DEFAULT_LATITUDE,
    lon: DEFAULT_LONGITUDE,
  });

  const [weatherData, setWeatherData] = useState<WeatherDataPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLocationContext, setDataLocationContext] = useState<string | null>(null);

  const initialPlotVisibility = Object.fromEntries(
    ALL_WEATHER_PARAMETERS.map(key => [key, true])
  ) as Record<WeatherPlotVisibilityKeys, boolean>;
  const [plotVisibility, setPlotVisibility] = useState(initialPlotVisibility);

  const [fetchLogSteps, setFetchLogSteps] = useState<LogStep[]>([]);
  const [showFetchLogAccordion, setShowFetchLogAccordion] = useState<string>("");
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [logOverallStatus, setLogOverallStatus] = useState<LogOverallStatus>("idle");

  const initialFetchDone = useRef(false);

  const plotConfigIcons: Record<WeatherPlotVisibilityKeys, LucideIcon> = {
    temperature: Thermometer,
    windSpeed: WindIcon,
    cloudCover: Cloud,
    windDirection: Compass,
  };

  const handleMapLocationSelect = useCallback((coords: { lat: number; lon: number }) => {
    setMapSelectedCoords(coords);
    toast({ title: "Location Selected", description: `Lat: ${coords.lat.toFixed(4)}, Lon: ${coords.lon.toFixed(4)}` });
  }, [toast]);

  const handleFetchWeather = useCallback(async () => {
    if (!mapSelectedCoords) {
      toast({ variant: "destructive", title: "Missing Location", description: "Please select a location on the map." });
      return;
    }
    if (!dateRange || !dateRange.from || !dateRange.to) {
      toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range." });
      return;
    }
     if (dateRange.from > dateRange.to) {
      toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
      return;
    }

    const selectedParams = ALL_WEATHER_PARAMETERS.filter(key => plotVisibility[key]);
    if (selectedParams.length === 0) {
      toast({ variant: "destructive", title: "No Parameters Selected", description: "Please select at least one parameter to fetch." });
      return;
    }

    setIsLoading(true); setError(null); setWeatherData(null); setDataLocationContext(null);
    setFetchLogSteps([{ message: `Fetching data for Lat: ${mapSelectedCoords.lat.toFixed(3)}, Lon: ${mapSelectedCoords.lon.toFixed(3)}...`, status: 'pending' }]);
    setIsLogLoading(true); setLogOverallStatus('pending'); setShowFetchLogAccordion("weather-fetch-log-item");

    let loadingToastId = toast({ title: "Fetching Data", description: "Fetching weather data..." }).id;

    const result = await fetchWeatherDataAction({
      latitude: mapSelectedCoords.lat,
      longitude: mapSelectedCoords.lon,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
      parameters: selectedParams,
    });

    if (loadingToastId) dismiss(loadingToastId);
    setFetchLogSteps(result.log || []);
    setIsLogLoading(false); setIsLoading(false);

    if (result.success && result.data) {
      setWeatherData(result.data);
      setDataLocationContext(result.dataLocationContext || `Data for selected location`);
      if (result.data.length === 0 && !result.error) {
        toast({ variant: "default", title: "No Data", description: "No data points found for the selected criteria.", duration: 4000 });
        setLogOverallStatus('warning');
      } else if (result.data.length === 0 && result.error) {
        toast({ variant: "default", title: "No Data", description: result.error, duration: 4000 });
        setLogOverallStatus('warning');
      } else {
        toast({ title: "Data Loaded", description: `Loaded ${result.data.length} weather data points.` });
        setLogOverallStatus('success'); setShowFetchLogAccordion("");
      }
    } else {
      setError(result.error || "Failed to load weather data.");
      toast({ variant: "destructive", title: "Error Loading Data", description: result.error || "Failed to load weather data." });
      setLogOverallStatus('error');
    }
  }, [mapSelectedCoords, dateRange, plotVisibility, toast, dismiss]);

  useEffect(() => {
    if (initialFetchDone.current) return;
    if (mapSelectedCoords && dateRange?.from && dateRange?.to) {
      if (!(dateRange.from > dateRange.to)) {
        handleFetchWeather();
        initialFetchDone.current = true;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed dependencies to ensure it runs only once on initial mount

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handlePlotVisibilityChange = useCallback((key: WeatherPlotVisibilityKeys, checked: boolean) => {
    setPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  const getLogTriggerContent = (status: LogOverallStatus, isLoadingFlag: boolean, defaultTitle: string, lastError?: string) => {
    if (isLoadingFlag) return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Fetching log...</>;
    if (status === 'success') return <><CheckCircle2 className="mr-2 h-3 w-3 text-green-500" />{defaultTitle}: Success</>;
    if (status === 'error') return <><XCircle className="mr-2 h-3 w-3 text-destructive" />{defaultTitle}: Failed {lastError ? `(${lastError.substring(0,30)}...)` : ''}</>;
    if (status === 'pending') return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />{defaultTitle}: In Progress</>;
    if (status === 'warning') return <><Info className="mr-2 h-3 w-3 text-yellow-500" />{defaultTitle}: Warning</>;
    return <><Info className="mr-2 h-3 w-3 text-muted-foreground" />{defaultTitle}</>;
  };
  
  const getLogAccordionItemClass = (status: LogOverallStatus) => {
    if (status === 'pending') return "bg-blue-500/5 dark:bg-blue-500/10";
    if (status === 'success') return "bg-green-500/5 dark:bg-green-500/10";
    if (status === 'error') return "bg-destructive/10 dark:bg-destructive/20";
    if (status === 'warning') return "bg-yellow-500/5 dark:bg-yellow-500/10";
    return "";
  };

  const handleCopyLog = useCallback(() => {
    if (fetchLogSteps.length === 0) {
      toast({ title: "Log Empty", description: "There are no log messages to copy.", duration: 3000 });
      return;
    }
    const logText = fetchLogSteps
      .map(step => `[${step.status.toUpperCase()}] ${step.message}${step.details ? `\n  Details: ${step.details}` : ''}`)
      .join('\n\n');
    
    navigator.clipboard.writeText(logText)
      .then(() => {
        toast({ title: "Log Copied", description: "Fetch log copied to clipboard.", duration: 3000 });
      })
      .catch(err => {
        console.error('Failed to copy log: ', err);
        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy log to clipboard.", duration: 3000 });
      });
  }, [fetchLogSteps, toast]);

  const renderLogAccordion = (
    logSteps: LogStep[], 
    accordionValue: string, 
    onValueChange: (value: string) => void, 
    isLoadingFlag: boolean, 
    overallStatus: LogOverallStatus, 
    title: string, 
    errorDetails?: string | null
  ) => (
    (isLoadingFlag || logSteps.length > 0 || overallStatus === 'error' || overallStatus === 'warning') && (
      <CardFooter className="p-0 pt-2 flex flex-col items-stretch">
        <Accordion type="single" collapsible value={accordionValue} onValueChange={onValueChange} className="w-full">
          <AccordionItem value={title.toLowerCase().replace(/\s+/g, '-') + "-log-item"} className={cn("border rounded-md", getLogAccordionItemClass(overallStatus))}>
            <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline [&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3">
              {getLogTriggerContent(overallStatus, isLoadingFlag, title, errorDetails || undefined)}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-1 pt-0">
              <ScrollArea className="max-h-[35rem] h-auto w-full rounded-md border bg-muted/30 dark:bg-muted/10 p-1.5 mt-1">
                <ul className="space-y-1 text-[0.7rem]">
                  {logSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      {step.status === 'pending' && <Loader2 className="h-3 w-3 mt-0.5 text-blue-500 animate-spin flex-shrink-0" />}
                      {step.status === 'success' && <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />}
                      {step.status === 'error' && <XCircle className="h-3 w-3 mt-0.5 text-destructive flex-shrink-0" />}
                      {step.status === 'info' && <Info className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />}
                      {step.status === 'warning' && <Info className="h-3 w-3 mt-0.5 text-yellow-500 flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className={cn("break-words", step.status === 'error' && "text-destructive font-semibold", step.status === 'warning' && "text-yellow-600 dark:text-yellow-400")}>{step.message}</p>
                        {step.details && <p className="text-muted-foreground text-[0.6rem] whitespace-pre-wrap break-all">{step.details}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
                {logSteps.length === 0 && !isLoadingFlag && <p className="text-center text-muted-foreground text-[0.65rem] py-2">No log details for this operation.</p>}
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        {logSteps.length > 0 && !isLoadingFlag && (
          <div className="w-full flex justify-end mt-2">
            <Button variant="outline" size="sm" onClick={handleCopyLog} className="h-7 text-xs">
              <Copy className="mr-1.5 h-3 w-3" /> Copy Log
            </Button>
          </div>
        )}
      </CardFooter>
    )
  );

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
              <Tooltip><TooltipTrigger asChild><Link href="/om-marine-explorer" passHref><Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="OM Marine Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>OM Marine Explorer</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>
      
      <main className="flex-grow container mx-auto p-3 md:p-4">
        <Card className="mb-4">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-lg flex items-center gap-2"><CloudSun className="h-5 w-5 text-primary"/>Open-Meteo Weather Explorer</CardTitle>
            <CardDescription className="text-xs">
              Select parameters, a location on the map, and a date range to fetch and visualize data from Open-Meteo.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 lg:col-span-3 space-y-3">
            <Card>
              <CardHeader className="pb-2 pt-3"><CardTitle className="text-base flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" />Select Parameters</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {(Object.keys(plotVisibility) as WeatherPlotVisibilityKeys[]).map((key) => {
                  const paramConfig = WEATHER_PARAMETER_CONFIG[key];
                  const IconComp = plotConfigIcons[key];
                  return (
                    <div key={key} className="flex items-center space-x-1.5">
                      <Checkbox id={`weather-visibility-${key}`} checked={plotVisibility[key]} onCheckedChange={(c) => handlePlotVisibilityChange(key, !!c)} className="h-3.5 w-3.5"/>
                      <UiLabel htmlFor={`weather-visibility-${key}`} className="text-xs font-medium flex items-center gap-1 cursor-pointer"><IconComp className="h-3.5 w-3.5 text-muted-foreground"/>{paramConfig.name}</UiLabel>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary"/>Location & Date</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <UiLabel htmlFor="weather-map-container" className="text-xs font-medium mb-0.5 block">Click Map to Select Location</UiLabel>
                <div id="weather-map-container" className="h-[200px] w-full rounded-md overflow-hidden border">
                  <OpenLayersMapWithNoSSR
                    initialCenter={DEFAULT_MAP_CENTER}
                    initialZoom={DEFAULT_MAP_ZOOM}
                    selectedCoords={mapSelectedCoords}
                    onLocationSelect={handleMapLocationSelect}
                  />
                </div>
                {mapSelectedCoords && (
                  <p className="text-xs text-muted-foreground text-center">
                    Lat: {mapSelectedCoords.lat.toFixed(3)}, Lon: {mapSelectedCoords.lon.toFixed(3)}
                  </p>
                )}
                <div>
                  <UiLabel htmlFor="weather-date-range" className="text-xs font-medium mb-0.5 block">Date Range</UiLabel>
                  <DatePickerWithRange id="weather-date-range" date={dateRange} onDateChange={setDateRange} disabled={isLoading} />
                  {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                </div>
                <Button onClick={handleFetchWeather} disabled={isLoading || !mapSelectedCoords || !dateRange?.from || !dateRange?.to || ALL_WEATHER_PARAMETERS.filter(key => plotVisibility[key]).length === 0} className="w-full h-9 text-xs">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                  {isLoading ? "Fetching..." : "Fetch Weather Data"}
                </Button>
                {renderLogAccordion(fetchLogSteps, showFetchLogAccordion, setShowFetchLogAccordion, isLogLoading, logOverallStatus, "Weather Fetch Log", error)}
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-sm h-full">
               <CardHeader className="p-2 pt-3"><CardTitle className="text-base">{dataLocationContext || "Weather Data Plots"}</CardTitle></CardHeader>
              <CardContent className="p-1.5 h-[calc(100%-2.5rem)]">
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
            Weather data from Open-Meteo.
          </p>
        </div>
      </footer>
    </div>
  );
}
