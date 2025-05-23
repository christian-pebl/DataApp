
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label as UiLabel } from "@/components/ui/label";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, Search, Info, CheckCircle2, XCircle, ListChecks, FileText, MapPin, CalendarDays, ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { MarinePlotsGrid } from "@/components/marine/MarinePlotsGrid";
import { useToast } from "@/hooks/use-toast";
import { formatISO, subDays, parseISO, isValid } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// OM Marine Imports
import type { MarineDataPoint as OMMarineDataPoint, LogStep as OMMLogStep } from './om-marine-shared';
import { fetchOpenMeteoMarineDataAction } from './om-marine-actions';
import type { MarinePlotVisibilityKeys } from '@/app/ea-explorer/om-marine-shared'; // Assuming this type is compatible or move/redefine

// EA Imports
import type { EAStationInfo, EAMeasureInfo, StationWithMeasureDetails, EATimeSeriesDataPoint, LogStep as EALogStep } from './ea-shared';
import { fetchAllUniqueEAParametersAction, fetchEAStationsForParameterAction, fetchEATimeSeriesDataAction } from './ea-actions';


type ExplorerMode = 'initial' | 'ea' | 'om-marine';
type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle';


// For OM Marine
const omKnownLocations: { [key: string]: { lat: number; lon: number; name: string } } = {
  "milfordhaven": { lat: 51.71, lon: -5.04, name: "Milford Haven" },
  "newlyn": { lat: 50.10, lon: -5.55, name: "Newlyn" },
  "dover": { lat: 51.12, lon: 1.31, name: "Dover" }, // Corrected lon
  "liverpool": { lat: 53.40, lon: -2.99, name: "Liverpool" },
  "portsmouth": { lat: 50.81, lon: -1.08, name: "Portsmouth" },
};
const omDefaultLocationKey = "milfordhaven";

const omPlotConfigIcons: Record<MarinePlotVisibilityKeys, React.ElementType> = {
  seaLevel: Waves, waveHeight: Waves, waveDirection: Compass, wavePeriod: Timer,
};
const omPlotDisplayTitles: Record<MarinePlotVisibilityKeys, string> = {
  seaLevel: "Sea Level (Tide)", waveHeight: "Wave Height", waveDirection: "Wave Direction", wavePeriod: "Wave Period",
};


// For EA
const eaKnownStations: { key: string; name: string; id: string; lat?:number; long?:number}[] = [ // Simplified for selection
  { key: "milfordhaven", name: "Milford Haven", id: "E71524", lat: 51.706, long: -5.036 }, // Note: EA IDs can be complex, this is an example
  { key: "newlyn", name: "Newlyn", id: "E72534", lat:50.103, long: -5.547 },
  { key: "dover", name: "Dover", id: "E71901", lat:51.119, long: 1.320 },
  { key: "liverpool", name: "Liverpool (Gladstone Dock)", id: "E70604", lat: 53.453, long: -3.020},
  { key: "portsmouth", name: "Portsmouth", id: "0054TH", lat: 50.796, long: -1.098 }, // Example, actual ID format varies
];
const eaDefaultStationKey = "milfordhaven";


export default function OpenAccessDataExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  const [currentMode, setCurrentMode] = useState<ExplorerMode>('initial');
  
  // Common State
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7), to: new Date(),
  }));

  // == Open-Meteo Marine State ==
  const [omSearchTerm, setOmSearchTerm] = useState("");
  const [omInitialCoords, setOmInitialCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [omSuggestions, setOmSuggestions] = useState<Array<{ key: string; name: string }>>([]);
  const [omShowSuggestions, setOmShowSuggestions] = useState(false);
  const [omCurrentLocationName, setOmCurrentLocationName] = useState<string | null>(null);
  const [omMarineData, setOmMarineData] = useState<OMMarineDataPoint[] | null>(null);
  const [omIsLoadingData, setOmIsLoadingData] = useState(false);
  const [omErrorData, setOmErrorData] = useState<string | null>(null);
  const [omDataLocationContext, setOmDataLocationContext] = useState<string | null>(null);
  const [omPlotVisibility, setOmPlotVisibility] = useState<Record<MarinePlotVisibilityKeys, boolean>>({
    seaLevel: true, waveHeight: true, waveDirection: true, wavePeriod: true,
  });
  const [omFetchLogSteps, setOmFetchLogSteps] = useState<OMMLogStep[]>([]);
  const [omShowFetchLogAccordion, setOmShowFetchLogAccordion] = useState<string>("");
  const [omIsLogLoading, setOmIsLogLoading] = useState(false);
  const [omLogOverallStatus, setOmLogOverallStatus] = useState<LogOverallStatus>('idle');
  const omInitialFetchDone = React.useRef(false);

  // == Environment Agency State ==
  const [eaUniqueParameters, setEaUniqueParameters] = useState<string[] | null>(null);
  const [eaIsLoadingParameters, setEaIsLoadingParameters] = useState(false);
  const [eaErrorParameters, setEaErrorParameters] = useState<string | null>(null);
  const [eaParamFetchLogSteps, setEaParamFetchLogSteps] = useState<EALogStep[]>([]);
  const [eaShowParamFetchLog, setEaShowParamFetchLog] = useState<string>("");
  const [eaIsParamLogLoading, setEaIsParamLogLoading] = useState(false);
  const [eaParamLogStatus, setEaParamLogStatus] = useState<LogOverallStatus>('idle');

  const [eaSelectedParameter, setEaSelectedParameter] = useState<string | null>(null);
  
  const [eaStationsForParameter, setEaStationsForParameter] = useState<StationWithMeasureDetails[] | null>(null);
  const [eaIsLoadingStations, setEaIsLoadingStations] = useState(false);
  const [eaErrorStations, setEaErrorStations] = useState<string | null>(null);
  const [eaStationFetchLogSteps, setEaStationFetchLogSteps] = useState<EALogStep[]>([]);
  const [eaShowStationFetchLog, setEaShowStationFetchLog] = useState<string>("");
  const [eaIsStationLogLoading, setEaIsStationLogLoading] = useState(false);
  const [eaStationLogStatus, setEaStationLogStatus] = useState<LogOverallStatus>('idle');

  const [eaSelectedStationDetails, setEaSelectedStationDetails] = useState<StationWithMeasureDetails | null>(null);
  
  const [eaTimeSeriesData, setEaTimeSeriesData] = useState<EATimeSeriesDataPoint[] | null>(null);
  const [eaIsLoadingTimeSeries, setEaIsLoadingTimeSeries] = useState(false);
  const [eaErrorTimeSeries, setEaErrorTimeSeries] = useState<string | null>(null);
  const [eaTimeSeriesFetchLogSteps, setEaTimeSeriesFetchLogSteps] = useState<EALogStep[]>([]);
  const [eaShowTimeSeriesFetchLog, setEaShowTimeSeriesFetchLog] = useState<string>("");
  const [eaIsTimeSeriesLogLoading, setEaIsTimeSeriesLogLoading] = useState(false);
  const [eaTimeSeriesLogStatus, setEaTimeSeriesLogStatus] = useState<LogOverallStatus>('idle');
  const [eaPlotYAxisConfig, setEaPlotYAxisConfig] = useState<YAxisConfig[]>([]);


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

  const getLogTriggerContent = (status: LogOverallStatus, isLoading: boolean, defaultTitle: string, lastError?: string) => {
    if (isLoading) return <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching details...</>;
    if (status === 'success') return <><CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />{defaultTitle}: Success</>;
    if (status === 'error') return <><XCircle className="mr-2 h-4 w-4 text-destructive" />{defaultTitle}: Failed {lastError ? `(${lastError.substring(0,30)}...)` : ''}</>;
    if (status === 'pending') return <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{defaultTitle}: In Progress</>;
    return <><Info className="mr-2 h-4 w-4 text-muted-foreground" />{defaultTitle}</>;
  };
  
  const getLogAccordionItemClass = (status: LogOverallStatus) => {
    if (status === 'pending') return "bg-blue-500/10";
    if (status === 'success') return "bg-green-500/10";
    if (status === 'error') return "bg-destructive/10";
    return "";
  };

  // --- Open-Meteo Marine Logic ---
  useEffect(() => { // For OM Marine default location load
    if (currentMode === 'om-marine' && !omInitialFetchDone.current) {
      const defaultLoc = omKnownLocations[omDefaultLocationKey];
      if (defaultLoc) {
        setOmSearchTerm(defaultLoc.name);
        const coords = { latitude: defaultLoc.lat, longitude: defaultLoc.lon };
        setOmInitialCoords(coords);
        setOmCurrentLocationName(defaultLoc.name);
        if (dateRange?.from && dateRange?.to) {
         // handleOMFetchMarineData(coords, defaultLoc.name); // Auto-fetch removed, user clicks button
        }
      }
      omInitialFetchDone.current = true;
    }
  }, [currentMode, dateRange]);


  const handleOMPlotVisibilityChange = useCallback((key: MarinePlotVisibilityKeys, checked: boolean) => {
    setOmPlotVisibility(prev => ({ ...prev, [key]: checked }));
  }, []);

  const handleOMLocationSearchAndFetch = useCallback(async () => {
    const term = omSearchTerm.trim().toLowerCase();
    setOmShowSuggestions(false);
    let coordsToUse = omInitialCoords;
    let locationNameToUse = omCurrentLocationName;

    if (!term) {
      toast({ variant: "destructive", title: "Search Error", description: "Please enter a location for Open-Meteo Marine." });
      setOmInitialCoords(null); setOmCurrentLocationName(null); setOmMarineData(null);
      return;
    }

    const locationKey = Object.keys(omKnownLocations).find(
      key => key.toLowerCase() === term || omKnownLocations[key].name.toLowerCase() === term
    );

    if (locationKey) {
      const location = omKnownLocations[locationKey];
      coordsToUse = { latitude: location.lat, longitude: location.lon };
      locationNameToUse = location.name;
      if (location.name !== omSearchTerm) setOmSearchTerm(location.name);
      setOmInitialCoords(coordsToUse);
      setOmCurrentLocationName(locationNameToUse);
    } else {
      if (!omInitialCoords || omSearchTerm.toLowerCase() !== (omCurrentLocationName || "").toLowerCase()) {
        setOmMarineData(null); setOmInitialCoords(null); setOmCurrentLocationName(null);
        toast({ variant: "destructive", title: "Location Not Found", description: "Please select a known coastal location for Open-Meteo Marine." });
        return;
      }
      coordsToUse = omInitialCoords;
      locationNameToUse = omCurrentLocationName;
    }
    
    if (coordsToUse && dateRange?.from && dateRange?.to) {
      await handleOMFetchMarineData(coordsToUse, locationNameToUse || "Selected Location");
    } else if (!coordsToUse) {
      toast({ variant: "destructive", title: "Missing Location", description: "Could not determine coordinates for Open-Meteo Marine." });
    }
  }, [omSearchTerm, omInitialCoords, omCurrentLocationName, dateRange, toast]);

  const handleOMFetchMarineData = async (coords: { latitude: number; longitude: number }, locationName: string) => {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      toast({ variant: "destructive", title: "Missing Date Range", description: "Please select a valid date range."});
      return;
    }
    if (dateRange.from > dateRange.to) {
      toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
      return;
    }

    setOmIsLoadingData(true); setOmErrorData(null); setOmMarineData(null); setOmDataLocationContext(null);
    setOmFetchLogSteps([]); setOmIsLogLoading(true); setOmLogOverallStatus('pending'); setOmShowFetchLogAccordion("om-fetch-log");
    
    const loadingToastId = toast({ title: "Fetching Data", description: `Fetching Open-Meteo Marine data for ${locationName}...`}).id;
    
    const result = await fetchOpenMeteoMarineDataAction({
      latitude: coords.latitude, longitude: coords.longitude,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
    });
    
    if(loadingToastId) dismiss(loadingToastId);
    setOmFetchLogSteps(result.log || []);
    setOmIsLoadingData(false); setOmIsLogLoading(false);

    if (result.success && result.data) {
      setOmMarineData(result.data);
      setOmDataLocationContext(result.dataLocationContext || `Marine data for ${locationName}`);
      if (result.data.length === 0) {
        toast({ variant: "default", title: "No Data", description: result.error || `No Open-Meteo Marine data found for ${locationName}.`, duration: 4000 });
      } else {
        toast({ title: "Data Loaded", description: `Loaded ${result.data.length} marine data points for ${locationName}.` });
      }
      setOmLogOverallStatus('success'); setOmShowFetchLogAccordion("");
    } else {
      setOmErrorData(result.error || `Failed to load Open-Meteo Marine data for ${locationName}.`);
      toast({ variant: "destructive", title: "Error Loading Data", description: result.error || `Failed to load data for ${locationName}.` });
      setOmLogOverallStatus('error');
    }
  };

  useEffect(() => { // For OM suggestions
    const currentSearchTerm = omSearchTerm.trim();
    if (currentSearchTerm === "" && document.activeElement === document.querySelector('input[placeholder="Search UK coastal location..."]')) {
       setOmSuggestions(Object.entries(omKnownLocations).map(([key, locObj]) => ({ key, name: locObj.name })));
       setOmShowSuggestions(true); return;
    }
    if (currentSearchTerm === "") { setOmSuggestions([]); setOmShowSuggestions(false); return; }

    const termLower = currentSearchTerm.toLowerCase();
    const filtered = Object.entries(omKnownLocations)
      .filter(([key, locObj]) => key.toLowerCase().includes(termLower) || locObj.name.toLowerCase().includes(termLower))
      .map(([key, locObj]) => ({ key, name: locObj.name }));
    setOmSuggestions(filtered.slice(0, 5));
    setOmShowSuggestions(filtered.length > 0 && document.activeElement === document.querySelector('input[placeholder="Search UK coastal location..."]'));
  }, [omSearchTerm]);

  const handleOMSuggestionClick = useCallback((suggestionKey: string) => {
    const location = omKnownLocations[suggestionKey];
    if (location) {
      setOmSearchTerm(location.name); 
      setOmInitialCoords({ latitude: location.lat, longitude: location.lon }); 
      setOmCurrentLocationName(location.name);
      setOmShowSuggestions(false);
    }
  }, []); 

  // --- Environment Agency Logic ---
  const handleLoadEAParameters = async () => {
    setEaIsLoadingParameters(true); setEaErrorParameters(null); setEaUniqueParameters(null);
    setEaParamFetchLogSteps([]); setEaIsParamLogLoading(true); setEaParamLogStatus('pending'); setEaShowParamFetchLog("ea-param-log");
    const toastId = toast({title: "Fetching EA Parameters", description: "Loading available parameters from Environment Agency stations..."}).id;

    const result = await fetchAllUniqueEAParametersAction({});
    
    if(toastId) dismiss(toastId);
    setEaParamFetchLogSteps(result.log || []);
    setEaIsLoadingParameters(false); setEaIsParamLogLoading(false);

    if (result.success && result.uniqueParameters) {
      setEaUniqueParameters(result.uniqueParameters);
      toast({title: "Parameters Loaded", description: `Found ${result.uniqueParameters.length} unique parameters.`});
      setEaParamLogStatus('success'); setEaShowParamFetchLog("");
    } else {
      setEaErrorParameters(result.error || "Failed to load EA parameters.");
      toast({variant: "destructive", title: "Error", description: result.error || "Failed to load EA parameters."});
      setEaParamLogStatus('error');
    }
  };

  const handleEASelectParameter = async (parameter: string | null) => {
    setEaSelectedParameter(parameter);
    setEaStationsForParameter(null); setEaErrorStations(null); setEaSelectedStationDetails(null); 
    setEaTimeSeriesData(null); // Clear plot data when param changes

    if (parameter) {
      setEaIsLoadingStations(true);
      setEaStationFetchLogSteps([]); setEaIsStationLogLoading(true); setEaStationLogStatus('pending'); setEaShowStationFetchLog("ea-station-log");
      const toastId = toast({title: "Fetching Stations", description: `Finding EA stations measuring '${parameter}'...`}).id;

      const result = await fetchEAStationsForParameterAction({ selectedParameter: parameter });

      if(toastId) dismiss(toastId);
      setEaStationFetchLogSteps(result.log || []);
      setEaIsLoadingStations(false); setEaIsStationLogLoading(false);

      if (result.success && result.stations) {
        setEaStationsForParameter(result.stations);
        toast({title: "Stations Loaded", description: `Found ${result.stations.length} stations for '${parameter}'.`});
        setEaStationLogStatus('success'); 
        if (result.stations.length > 0) setEaShowStationFetchLog(""); else setEaShowStationFetchLog("ea-station-log"); // Keep open if no stations
      } else {
        setEaErrorStations(result.error || "Failed to load stations for parameter.");
        toast({variant: "destructive", title: "Error", description: result.error || "Failed to load stations."});
        setEaStationLogStatus('error');
      }
    }
  };
  
  const handleEASelectStation = (stationDetails: StationWithMeasureDetails | null) => {
    setEaSelectedStationDetails(stationDetails);
    setEaTimeSeriesData(null); // Clear plot data when station changes
    if (stationDetails) {
        toast({title: "Station Selected", description: `${stationDetails.label} ready for data fetch.`});
    }
  };

  const handleEAFetchTimeSeries = async () => {
    if (!eaSelectedStationDetails || !eaSelectedParameter || !dateRange?.from || !dateRange?.to) {
      toast({variant: "destructive", title: "Missing Inputs", description: "Please select a parameter, station, and date range."});
      return;
    }
     if (dateRange.from > dateRange.to) {
        toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
        return;
    }

    setEaIsLoadingTimeSeries(true); setEaErrorTimeSeries(null); setEaTimeSeriesData(null);
    setEaTimeSeriesFetchLogSteps([]); setEaIsTimeSeriesLogLoading(true); setEaTimeSeriesLogStatus('pending'); setEaShowTimeSeriesFetchLog("ea-timeseries-log");
    const toastId = toast({title: "Fetching Time Series", description: `Fetching '${eaSelectedParameter}' for ${eaSelectedStationDetails.label}...`}).id;

    const result = await fetchEATimeSeriesDataAction({
      measureId: eaSelectedStationDetails.measureIdForSelectedParam,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
    });
    
    if(toastId) dismiss(toastId);
    setEaTimeSeriesFetchLogSteps(result.log || []);
    setEaIsLoadingTimeSeries(false); setEaIsTimeSeriesLogLoading(false);

    if (result.success && result.data) {
      setEaTimeSeriesData(result.data);
      const yAxisUnit = result.unitName || eaSelectedStationDetails.unitNameForSelectedParam || "";
      setEaPlotYAxisConfig([{
        id: 'value', dataKey: 'value', label: `${result.parameterName || eaSelectedParameter} (${yAxisUnit})`, 
        orientation: 'left', color: '--chart-1', unit: yAxisUnit
      }]);
      toast({title: "Data Plotted", description: `Displaying ${result.data.length} points for ${eaSelectedStationDetails.label}.`});
      setEaTimeSeriesLogStatus('success'); setEaShowTimeSeriesFetchLog("");
    } else {
      setEaErrorTimeSeries(result.error || "Failed to fetch time series data.");
      toast({variant: "destructive", title: "Error Plotting", description: result.error || "Failed to plot data."});
      setEaTimeSeriesLogStatus('error');
    }
  };

  const renderLogAccordion = (
    logSteps: EALogStep[] | OMMLogStep[], 
    accordionValue: string, 
    onValueChange: (value: string) => void, 
    isLoading: boolean, 
    overallStatus: LogOverallStatus, 
    title: string, 
    lastError?: string | null
  ) => (
    (isLoading || logSteps.length > 0 || overallStatus !== 'idle') && (
      <CardFooter className="p-0 pt-2">
        <Accordion type="single" collapsible value={accordionValue} onValueChange={onValueChange} className="w-full">
          <AccordionItem value={title.toLowerCase().replace(/\s+/g, '-') + "-log-item"} className={cn("border rounded-md", getLogAccordionItemClass(overallStatus))}>
            <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline">
              {getLogTriggerContent(overallStatus, isLoading, title, lastError || undefined)}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-1 pt-0">
              <ScrollArea className="max-h-[20rem] h-auto w-full rounded-md border bg-muted/30 p-1.5 mt-1">
                <ul className="space-y-1 text-[0.7rem]">
                  {logSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      {step.status === 'pending' && <Loader2 className="h-3.5 w-3.5 mt-0.5 text-blue-500 animate-spin flex-shrink-0" />}
                      {step.status === 'success' && <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-500 flex-shrink-0" />}
                      {step.status === 'error' && <XCircle className="h-3.5 w-3.5 mt-0.5 text-destructive flex-shrink-0" />}
                      {step.status === 'info' && <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className={cn("break-words", step.status === 'error' && "text-destructive font-semibold")}>{step.message}</p>
                        {step.details && <p className="text-muted-foreground text-[0.6rem] whitespace-pre-wrap break-all">{step.details}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardFooter>
    )
  );

  // ---- RENDER -----
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/ea-explorer" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Link href="/data-explorer" passHref><Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer"><LayoutGrid className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Data Explorer (CSV)</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/weather" passHref><Button variant={pathname === '/weather' ? "secondary": "ghost"} size="icon" aria-label="Weather Page"><CloudSun className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Weather Page</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/ea-explorer" passHref><Button variant={pathname === '/ea-explorer' ? "secondary": "ghost"} size="icon" aria-label="Open Access Data Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Open Access Data Explorer</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-3 md:p-4">
        <Card className="mb-4">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />Open Access Data Explorer
            </CardTitle>
             <CardDescription className="text-xs">
                Select a data source to explore. Environment Agency (EA) data provides UK river levels, rainfall, groundwater, etc. Open-Meteo Marine offers global sea level, wave data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => { setCurrentMode('ea'); setEaUniqueParameters(null); setEaSelectedParameter(null); setEaStationsForParameter(null); setEaSelectedStationDetails(null); setEaTimeSeriesData(null);}} 
                    variant={currentMode === 'ea' ? 'default' : 'outline'} className="w-full sm:w-auto text-xs h-8">
              <FileText className="mr-2 h-4 w-4" /> Explore Environment Agency Data
            </Button>
            <Button onClick={() => { setCurrentMode('om-marine'); const df = omKnownLocations[omDefaultLocationKey]; if(df) { setOmSearchTerm(df.name); setOmInitialCoords({lat: df.lat, lon: df.lon}); setOmCurrentLocationName(df.name); } else {setOmSearchTerm(""); setOmInitialCoords(null); setOmCurrentLocationName(null);}}} 
                    variant={currentMode === 'om-marine' ? 'default' : 'outline'} className="w-full sm:w-auto text-xs h-8">
              <Waves className="mr-2 h-4 w-4" /> Explore Open-Meteo Marine Data
            </Button>
          </CardContent>
        </Card>

        {currentMode === 'initial' && (
          <div className="text-center text-muted-foreground py-10">
            <Info className="mx-auto h-12 w-12 mb-4" />
            <p>Please select a data source above to begin exploring.</p>
          </div>
        )}

        {/* Environment Agency UI */}
        {currentMode === 'ea' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base">1. Discover EA Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button onClick={handleLoadEAParameters} disabled={eaIsLoadingParameters} className="text-xs h-8">
                  {eaIsLoadingParameters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Load Available EA Parameters
                </Button>
                {eaUniqueParameters && eaUniqueParameters.length > 0 && (
                  <Select onValueChange={(value) => handleEASelectParameter(value)} value={eaSelectedParameter || ""}>
                    <SelectTrigger className="w-full sm:w-[300px] h-9 text-xs">
                      <SelectValue placeholder="Select a parameter to explore..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eaUniqueParameters.map(param => <SelectItem key={param} value={param} className="text-xs">{param}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {eaIsLoadingParameters && <p className="text-xs text-muted-foreground">Loading parameters...</p>}
                {!eaIsLoadingParameters && eaUniqueParameters === null && !eaErrorParameters && <p className="text-xs text-muted-foreground">Click button to load parameters.</p>}
                {!eaIsLoadingParameters && eaUniqueParameters && eaUniqueParameters.length === 0 && <p className="text-xs text-muted-foreground">No unique parameters found from sampled stations.</p>}
                {eaErrorParameters && <p className="text-xs text-destructive">{eaErrorParameters}</p>}
              </CardContent>
              {renderLogAccordion(eaParamFetchLogSteps, eaShowParamFetchLog, setEaShowParamFetchLog, eaIsParamLogLoading, eaParamLogStatus, "Parameter Discovery Log", eaErrorParameters)}
            </Card>

            {eaSelectedParameter && (
            <Card>
                <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-base">2. Select Station for: <span className="font-semibold text-primary">{eaSelectedParameter}</span></CardTitle>
                     <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1" onClick={() => { setEaSelectedParameter(null); setEaStationsForParameter(null); setEaSelectedStationDetails(null); setEaTimeSeriesData(null);}}>
                        Change Parameter
                    </Button>
                </CardHeader>
                <CardContent>
                    {eaIsLoadingStations && <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading stations...</div>}
                    {!eaIsLoadingStations && eaStationsForParameter && eaStationsForParameter.length === 0 && <p className="text-xs text-muted-foreground">No stations found measuring '{eaSelectedParameter}'. Try a different parameter.</p>}
                    {eaErrorStations && <p className="text-xs text-destructive">{eaErrorStations}</p>}
                    {eaStationsForParameter && eaStationsForParameter.length > 0 && (
                        <ScrollArea className="h-72 w-full rounded-md border p-2">
                            <div className="space-y-1">
                            {eaStationsForParameter.map(station => (
                                <Button key={station['@id']} variant={eaSelectedStationDetails?.['@id'] === station['@id'] ? "default" : "outline"} size="sm" className="w-full justify-start text-left h-auto py-1.5 text-xs" onClick={() => handleEASelectStation(station)}>
                                    <div className="flex flex-col">
                                        <span>{station.label} (ID: {station.stationReference || station.notation})</span>
                                        <span className="text-xs text-muted-foreground">{station.lat?.toFixed(3)}, {station.long?.toFixed(3)}</span>
                                    </div>
                                </Button>
                            ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
                {renderLogAccordion(eaStationFetchLogSteps, eaShowStationFetchLog, setEaShowStationFetchLog, eaIsStationLogLoading, eaStationLogStatus, "Station Filter Log", eaErrorStations)}
            </Card>
            )}
            
            {eaSelectedStationDetails && eaSelectedParameter && (
            <Card>
                <CardHeader className="pb-2 pt-3">
                    <CardTitle className="text-base">3. Plot Data for: <span className="font-semibold text-primary">{eaSelectedParameter}</span> at <span className="font-semibold text-primary">{eaSelectedStationDetails.label}</span></CardTitle>
                    <div className="flex gap-2">
                        <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1" onClick={() => { setEaSelectedStationDetails(null); setEaTimeSeriesData(null); }}>
                            Change Station
                        </Button>
                         <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1" onClick={() => { setEaSelectedParameter(null); setEaStationsForParameter(null); setEaSelectedStationDetails(null); setEaTimeSeriesData(null);}}>
                            Change Parameter
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <UiLabel htmlFor="ea-date-range" className="text-xs font-medium">Date Range</UiLabel>
                        <DatePickerWithRange id="ea-date-range" date={dateRange} onDateChange={setDateRange} disabled={eaIsLoadingTimeSeries} />
                         {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && (
                            <p className="text-xs text-destructive px-1 pt-1">Start date must be before or same as end date.</p>
                         )}
                    </div>
                    <Button onClick={handleEAFetchTimeSeries} disabled={eaIsLoadingTimeSeries || !dateRange?.from || !dateRange?.to} className="text-xs h-8">
                        {eaIsLoadingTimeSeries ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                        Fetch & Plot Data
                    </Button>
                    
                    {eaIsLoadingTimeSeries && <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading data...</div>}
                    {eaErrorTimeSeries && <p className="text-xs text-destructive">{eaErrorTimeSeries}</p>}
                    {eaTimeSeriesData && (
                        <div className="h-[350px] mt-2 border rounded-md p-1">
                           <ChartDisplay data={eaTimeSeriesData} plottableSeries={['value']} timeAxisLabel="Time" yAxisConfigs={eaPlotYAxisConfig} />
                        </div>
                    )}
                    {!eaIsLoadingTimeSeries && eaTimeSeriesData && eaTimeSeriesData.length === 0 && <p className="text-xs text-muted-foreground mt-2">No time series data found for this selection.</p>}
                </CardContent>
                 {renderLogAccordion(eaTimeSeriesFetchLogSteps, eaShowTimeSeriesFetchLog, setEaShowTimeSeriesFetchLog, eaIsTimeSeriesLogLoading, eaTimeSeriesLogStatus, "Time Series Fetch Log", eaErrorTimeSeries)}
            </Card>
            )}
          </div>
        )}

        {/* Open-Meteo Marine UI */}
        {currentMode === 'om-marine' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 lg:col-span-3 space-y-4">
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4 text-primary"/>Location & Date</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="relative">
                    <Input type="text" placeholder="Search UK coastal location..." value={omSearchTerm}
                           onChange={(e) => setOmSearchTerm(e.target.value)}
                           onFocus={() => setOmShowSuggestions(true)}
                           onBlur={() => setTimeout(() => setOmShowSuggestions(false), 150)}
                           onKeyDown={(e) => { if (e.key === 'Enter') { handleOMLocationSearchAndFetch(); setOmShowSuggestions(false); } }}
                           className="h-9 text-xs" />
                    {omShowSuggestions && omSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-0 bg-card border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {omSuggestions.map((s) => <button key={s.key} type="button" className="w-full text-left px-3 py-2 text-xs hover:bg-muted focus:bg-muted focus:outline-none" onClick={() => handleOMSuggestionClick(s.key)} onMouseDown={(e) => e.preventDefault()}>{s.name}</button>)}
                      </div>
                    )}
                  </div>
                  {omInitialCoords && <p className="text-xs text-muted-foreground text-center">Lat: {omInitialCoords.latitude.toFixed(4)}, Lon: {omInitialCoords.longitude.toFixed(4)}</p>}
                  <div>
                    <UiLabel htmlFor="om-date-range" className="text-xs font-medium mb-0.5 block">Date Range</UiLabel>
                    <DatePickerWithRange id="om-date-range" date={dateRange} onDateChange={setDateRange} disabled={omIsLoadingData} />
                    {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && <p className="text-xs text-destructive px-1 pt-1">Start date error.</p>}
                  </div>
                  <Button onClick={handleOMLocationSearchAndFetch} disabled={omIsLoadingData || !omSearchTerm || !dateRange?.from || !dateRange?.to} className="w-full h-9 text-xs">
                    {omIsLoadingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                    {omIsLoadingData ? "Fetching..." : "Fetch Marine Data"}
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2 pt-3"><CardTitle className="text-base">Display Plots</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {(Object.keys(omPlotVisibility) as MarinePlotVisibilityKeys[]).map((key) => {
                    const IconComp = omPlotConfigIcons[key];
                    return (
                      <div key={key} className="flex items-center space-x-1.5">
                        <Checkbox id={`om-visibility-${key}`} checked={omPlotVisibility[key]} onCheckedChange={(c) => handleOMPlotVisibilityChange(key, !!c)} className="h-3.5 w-3.5"/>
                        <UiLabel htmlFor={`om-visibility-${key}`} className="text-xs font-medium flex items-center gap-1 cursor-pointer"><IconComp className="h-3.5 w-3.5 text-muted-foreground"/>{omPlotDisplayTitles[key]}</UiLabel>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
              {renderLogAccordion(omFetchLogSteps, omShowFetchLogAccordion, setOmShowFetchLogAccordion, omIsLogLoading, omLogOverallStatus, "OM Marine Fetch Log", omErrorData)}
            </div>
            <div className="md:col-span-8 lg:col-span-9">
              <Card className="shadow-sm h-full">
                <CardHeader className="p-2 pt-3"><CardTitle className="text-base">{omDataLocationContext || "Open-Meteo Marine Data Plots"}</CardTitle></CardHeader>
                <CardContent className="p-1.5 h-[calc(100%-2.5rem)]">
                  <MarinePlotsGrid marineData={omMarineData} isLoading={omIsLoadingData} error={omErrorData} plotVisibility={omPlotVisibility} />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Marine data from Open-Meteo & EA. Data Explorer for CSVs & Weather.
          </p>
        </div>
      </footer>
    </div>
  );
}

// Util: isValidDateString (ensure this is available or define it)
// const isValidDateString = (val: string): boolean => { /* ... from lib/utils ... */ };

