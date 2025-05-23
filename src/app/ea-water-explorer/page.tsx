
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, Search, Info, CheckCircle2, XCircle, ListChecks, FileText, MapPin, CalendarDays, ChevronDown, Droplets } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { useToast } from "@/hooks/use-toast";
import { formatISO, subDays } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

import type {
  EAStationInfo,
  EAMeasureInfo,
  StationWithMeasureDetails,
  EATimeSeriesDataPoint,
  LogStep
} from './shared';
import {
  fetchAllUniqueEAParametersAction,
  fetchEAStationsForParameterAction,
  fetchEATimeSeriesDataAction
} from './actions';

type LogOverallStatus = 'pending' | 'success' | 'error' | 'idle' | 'warning';

export default function EAWaterExplorerPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast, dismiss } = useToast();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7), to: new Date(),
  }));

  const [uniqueParameters, setUniqueParameters] = useState<string[] | null>(null);
  const [isLoadingParameters, setIsLoadingParameters] = useState(false);
  const [errorParameters, setErrorParameters] = useState<string | null>(null);
  const [parameterFetchLogSteps, setParameterFetchLogSteps] = useState<LogStep[]>([]);
  const [showParameterFetchLogAccordion, setShowParameterFetchLogAccordion] = useState<string>("");
  const [isParameterLogLoading, setIsParameterLogLoading] = useState(false);
  const [parameterLogStatus, setParameterLogStatus] = useState<LogOverallStatus>('idle');

  const [selectedParameter, setSelectedParameter] = useState<string | null>(null);
  
  const [stationsForParameter, setStationsForParameter] = useState<StationWithMeasureDetails[] | null>(null);
  const [isLoadingStations, setIsLoadingStations] = useState(false);
  const [errorStations, setErrorStations] = useState<string | null>(null);
  const [stationFilterLogSteps, setStationFilterLogSteps] = useState<LogStep[]>([]);
  const [showStationFilterLogAccordion, setShowStationFilterLogAccordion] = useState<string>("");
  const [isStationFilterLogLoading, setIsStationFilterLogLoading] = useState(false);
  const [stationFilterLogStatus, setStationFilterLogStatus] = useState<LogOverallStatus>('idle');
  
  const [showStationList, setShowStationList] = useState(false); // To control station list visibility after selection
  const [selectedStationDetails, setSelectedStationDetails] = useState<StationWithMeasureDetails | null>(null);
  
  const [timeSeriesData, setTimeSeriesData] = useState<EATimeSeriesDataPoint[] | null>(null);
  const [isLoadingTimeSeries, setIsLoadingTimeSeries] = useState(false);
  const [errorTimeSeries, setErrorTimeSeries] = useState<string | null>(null);
  const [timeSeriesFetchLogSteps, setTimeSeriesFetchLogSteps] = useState<LogStep[]>([]);
  const [showTimeSeriesFetchLogAccordion, setShowTimeSeriesFetchLogAccordion] = useState<string>("");
  const [isTimeSeriesLogLoading, setIsTimeSeriesLogLoading] = useState(false);
  const [timeSeriesLogStatus, setTimeSeriesLogStatus] = useState<LogOverallStatus>('idle');
  const [plotYAxisConfig, setPlotYAxisConfig] = useState<YAxisConfig[]>([]);

  // Theme management
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

  // Log Accordion Helper
  const getLogTriggerContent = (status: LogOverallStatus, isLoading: boolean, defaultTitle: string, lastError?: string) => {
    if (isLoading) return <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Fetching log...</>;
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

  // Parameter Discovery
  const handleLoadEAParameters = async () => {
    setIsLoadingParameters(true); setErrorParameters(null); setUniqueParameters(null);
    setParameterFetchLogSteps([]); setIsParameterLogLoading(true); setParameterLogStatus('pending'); setShowParameterFetchLogAccordion("ea-param-log-item");
    const toastId = toast({title: "Fetching EA Parameters", description: "Loading available parameters from EA stations..."}).id;

    const result = await fetchAllUniqueEAParametersAction({});
    
    if(toastId) dismiss(toastId);
    setParameterFetchLogSteps(result.log || []);
    setIsLoadingParameters(false); setIsParameterLogLoading(false);

    if (result.success && result.uniqueParameters) {
      setUniqueParameters(result.uniqueParameters);
      if (result.uniqueParameters.length === 0){
        toast({title: "No Parameters", description: `No unique parameters found from sampled EA stations.`});
        setParameterLogStatus('warning');
      } else {
        toast({title: "Parameters Loaded", description: `Found ${result.uniqueParameters.length} unique parameters.`});
        setParameterLogStatus('success'); setShowParameterFetchLogAccordion("");
      }
    } else {
      setErrorParameters(result.error || "Failed to load EA parameters.");
      toast({variant: "destructive", title: "Error", description: result.error || "Failed to load EA parameters."});
      setParameterLogStatus('error');
    }
  };

  // Station Filtering by Parameter
  const handleEASelectParameter = async (parameter: string | null) => {
    setSelectedParameter(parameter);
    setStationsForParameter(null); setErrorStations(null); 
    setSelectedStationDetails(null); setShowStationList(false);
    setTimeSeriesData(null); 

    if (parameter) {
      setIsLoadingStations(true);
      setStationFilterLogSteps([]); setIsStationFilterLogLoading(true); setStationFilterLogStatus('pending'); setShowStationFilterLogAccordion("ea-station-log-item");
      const toastId = toast({title: "Fetching Stations", description: `Finding EA stations measuring '${parameter}'...`}).id;

      const result = await fetchEAStationsForParameterAction({ selectedParameter: parameter });

      if(toastId) dismiss(toastId);
      setStationFilterLogSteps(result.log || []);
      setIsLoadingStations(false); setIsStationFilterLogLoading(false);

      if (result.success && result.stations) {
        setStationsForParameter(result.stations);
        setShowStationList(true); 
        if (result.stations.length === 0) {
          toast({title: "No Stations", description: `No EA stations found measuring '${parameter}'.`});
          setStationFilterLogStatus('warning'); 
        } else {
          toast({title: "Stations Loaded", description: `Found ${result.stations.length} stations for '${parameter}'.`});
          setStationFilterLogStatus('success'); setShowStationFilterLogAccordion("");
        }
      } else {
        setErrorStations(result.error || "Failed to load stations for parameter.");
        toast({variant: "destructive", title: "Error", description: result.error || "Failed to load stations."});
        setStationFilterLogStatus('error');
      }
    }
  };
  
  // Station Selection
  const handleEASelectStation = (stationDetails: StationWithMeasureDetails | null) => {
    setSelectedStationDetails(stationDetails);
    setTimeSeriesData(null); // Clear previous plot data
    if (stationDetails) {
        toast({title: "Station Selected", description: `${stationDetails.label} ready for data fetch.`});
        setShowStationList(false); // Hide station list once selected
    }
  };

  // Time Series Fetching
  const handleEAFetchTimeSeries = async () => {
    if (!selectedStationDetails || !selectedParameter || !dateRange?.from || !dateRange?.to) {
      toast({variant: "destructive", title: "Missing Inputs", description: "Please select a parameter, station, and date range."});
      return;
    }
     if (dateRange.from > dateRange.to) {
        toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
        return;
    }

    setIsLoadingTimeSeries(true); setErrorTimeSeries(null); setTimeSeriesData(null);
    setTimeSeriesFetchLogSteps([]); setIsTimeSeriesLogLoading(true); setTimeSeriesLogStatus('pending'); setShowTimeSeriesFetchLogAccordion("ea-timeseries-log-item");
    const toastId = toast({title: "Fetching Time Series", description: `Fetching '${selectedParameter}' for ${selectedStationDetails.label}...`}).id;

    const result = await fetchEATimeSeriesDataAction({
      measureId: selectedStationDetails.measureIdForSelectedParam,
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
    });
    
    if(toastId) dismiss(toastId);
    setTimeSeriesFetchLogSteps(result.log || []);
    setIsLoadingTimeSeries(false); setIsTimeSeriesLogLoading(false);

    if (result.success && result.data) {
      setTimeSeriesData(result.data);
      const yAxisUnit = result.unitName || selectedStationDetails.unitNameForSelectedParam || "";
      setPlotYAxisConfig([{
        id: 'value', dataKey: 'value', label: `${result.parameterName || selectedParameter} (${yAxisUnit})`, 
        orientation: 'left', color: '--chart-1', unit: yAxisUnit
      }]);
      if(result.data.length === 0) {
         toast({title: "No Time Series Data", description: `No data points found for ${selectedStationDetails.label} in the selected period.`});
         setTimeSeriesLogStatus('warning');
      } else {
         toast({title: "Data Plotted", description: `Displaying ${result.data.length} points for ${selectedStationDetails.label}.`});
         setTimeSeriesLogStatus('success'); setShowTimeSeriesFetchLogAccordion("");
      }
    } else {
      setErrorTimeSeries(result.error || "Failed to fetch time series data.");
      toast({variant: "destructive", title: "Error Plotting", description: result.error || "Failed to plot data."});
      setTimeSeriesLogStatus('error');
    }
  };

  const renderLogAccordion = (
    logSteps: LogStep[], 
    accordionValue: string, 
    onValueChange: (value: string) => void, 
    isLoading: boolean, 
    overallStatus: LogOverallStatus, 
    title: string, 
    errorDetails?: string | null
  ) => (
    (isLoading || logSteps.length > 0 || overallStatus === 'error' || overallStatus === 'warning') && (
      <CardFooter className="p-0 pt-2">
        <Accordion type="single" collapsible value={accordionValue} onValueChange={onValueChange} className="w-full">
          <AccordionItem value={title.toLowerCase().replace(/\s+/g, '-') + "-log-item"} className={cn("border rounded-md", getLogAccordionItemClass(overallStatus))}>
            <AccordionTrigger className="px-3 py-1.5 text-xs hover:no-underline [&_svg.lucide-chevron-down]:h-3 [&_svg.lucide-chevron-down]:w-3">
              {getLogTriggerContent(overallStatus, isLoading, title, errorDetails || undefined)}
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-1 pt-0">
              <ScrollArea className="max-h-[30rem] h-auto w-full rounded-md border bg-muted/30 dark:bg-muted/10 p-1.5 mt-1">
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
                {logSteps.length === 0 && !isLoading && <p className="text-center text-muted-foreground text-[0.65rem] py-2">No log details for this operation.</p>}
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
              <Tooltip><TooltipTrigger asChild><Link href="/ea-water-explorer" passHref><Button variant={pathname === '/ea-water-explorer' ? "secondary": "ghost"} size="icon" aria-label="EA Water Explorer"><Droplets className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>EA Water Explorer</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/om-marine-explorer" passHref><Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="OM Marine Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>OM Marine Explorer</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-3 md:p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-primary" />EA Water Level & Flow Explorer
            </CardTitle>
             <CardDescription className="text-xs">
                Discover and visualize water-related data from Environment Agency monitoring stations.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Card 1: Parameter Discovery */}
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base">1. Discover EA Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={handleLoadEAParameters} disabled={isLoadingParameters} className="text-xs h-8">
              {isLoadingParameters ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Load Available Parameters
            </Button>
            {uniqueParameters && uniqueParameters.length > 0 && (
              <Select onValueChange={(value) => handleEASelectParameter(value)} value={selectedParameter || ""}>
                <SelectTrigger className="w-full sm:w-[300px] h-9 text-xs">
                  <SelectValue placeholder="Select a parameter to explore..." />
                </SelectTrigger>
                <SelectContent>
                  {uniqueParameters.map(param => <SelectItem key={param} value={param} className="text-xs">{param}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {isLoadingParameters && <p className="text-xs text-muted-foreground">Loading parameters...</p>}
            {!isLoadingParameters && uniqueParameters === null && !errorParameters && <p className="text-xs text-muted-foreground">Click button to load available parameters.</p>}
            {!isLoadingParameters && uniqueParameters && uniqueParameters.length === 0 && <p className="text-xs text-muted-foreground">No unique parameters found from sampled EA stations.</p>}
            {errorParameters && <p className="text-xs text-destructive">{errorParameters}</p>}
          </CardContent>
          {renderLogAccordion(parameterFetchLogSteps, showParameterFetchLogAccordion, setShowParameterFetchLogAccordion, isParameterLogLoading, parameterLogStatus, "Parameter Discovery Log", errorParameters)}
        </Card>

        {/* Card 2: Select Station (conditionally rendered) */}
        {selectedParameter && (showStationList || (stationsForParameter && stationsForParameter.length > 0 && !selectedStationDetails)) && (
        <Card>
            <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base">2. Select Station for: <span className="font-semibold text-primary">{selectedParameter}</span></CardTitle>
                 <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1" onClick={() => { setSelectedParameter(null); setStationsForParameter(null); setSelectedStationDetails(null); setTimeSeriesData(null); setShowStationList(false);}}>
                    Change Parameter
                </Button>
            </CardHeader>
            <CardContent>
                {isLoadingStations && <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading stations...</div>}
                {!isLoadingStations && stationsForParameter && stationsForParameter.length === 0 && <p className="text-xs text-muted-foreground">No stations found measuring '{selectedParameter}'. Try a different parameter.</p>}
                {errorStations && <p className="text-xs text-destructive">{errorStations}</p>}
                {stationsForParameter && stationsForParameter.length > 0 && (
                    <ScrollArea className="h-72 w-full rounded-md border p-2">
                        <div className="space-y-1">
                        {stationsForParameter.map(station => (
                            <Button key={station['@id']} variant={selectedStationDetails?.['@id'] === station['@id'] ? "default" : "outline"} size="sm" className="w-full justify-start text-left h-auto py-1.5 text-xs" onClick={() => handleEASelectStation(station)}>
                                <div className="flex flex-col">
                                    <span>{station.label} (ID: {station.stationReference || station.notation})</span>
                                    <span className="text-xs text-muted-foreground">Lat: {station.lat?.toFixed(3)}, Lon: {station.long?.toFixed(3)}</span>
                                    <span className="text-xs text-muted-foreground/80">Unit: {station.unitNameForSelectedParam}, Qualifier: {station.qualifierForSelectedParam}</span>
                                </div>
                            </Button>
                        ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
             {renderLogAccordion(stationFilterLogSteps, showStationFilterLogAccordion, setShowStationFilterLogAccordion, isStationFilterLogLoading, stationFilterLogStatus, "Station Filter Log", errorStations)}
        </Card>
        )}
            
        {/* Card 3: Plotting Area (conditionally rendered) */}
        {selectedStationDetails && selectedParameter && !showStationList && (
        <Card>
            <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base">3. Plot Data for: <span className="font-semibold text-primary">{selectedParameter}</span> at <span className="font-semibold text-primary">{selectedStationDetails.label}</span></CardTitle>
                <div className="flex gap-2">
                    <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1" onClick={() => { setSelectedStationDetails(null); setTimeSeriesData(null); setShowStationList(true); }}>
                        Change Station
                    </Button>
                     <Button variant="link" size="sm" className="text-xs h-auto p-0 mt-1" onClick={() => { setSelectedParameter(null); setStationsForParameter(null); setSelectedStationDetails(null); setTimeSeriesData(null); setShowStationList(false);}}>
                        Change Parameter
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div>
                    <UiLabel htmlFor="ea-date-range" className="text-xs font-medium">Date Range</UiLabel>
                    <DatePickerWithRange id="ea-date-range" date={dateRange} onDateChange={setDateRange} disabled={isLoadingTimeSeries} />
                     {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && (
                        <p className="text-xs text-destructive px-1 pt-1">Start date must be before or same as end date.</p>
                     )}
                </div>
                <Button onClick={handleEAFetchTimeSeries} disabled={isLoadingTimeSeries || !dateRange?.from || !dateRange?.to} className="text-xs h-8">
                    {isLoadingTimeSeries ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4"/>}
                    Fetch & Plot Data
                </Button>
                
                {isLoadingTimeSeries && <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Loading data...</div>}
                {errorTimeSeries && <p className="text-xs text-destructive">{errorTimeSeries}</p>}
                {timeSeriesData && (
                    <div className="h-[350px] mt-2 border rounded-md p-1">
                       <ChartDisplay data={timeSeriesData} plottableSeries={['value']} timeAxisLabel="Time" yAxisConfigs={plotYAxisConfig} />
                    </div>
                )}
                {!isLoadingTimeSeries && timeSeriesData && timeSeriesData.length === 0 && <p className="text-xs text-muted-foreground mt-2">No time series data found for this selection.</p>}
            </CardContent>
             {renderLogAccordion(timeSeriesFetchLogSteps, showTimeSeriesFetchLogAccordion, setShowTimeSeriesFetchLogAccordion, isTimeSeriesLogLoading, timeSeriesLogStatus, "Time Series Fetch Log", errorTimeSeries)}
        </Card>
        )}
      </main>

      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            EA data from Environment Agency. Data Explorer. Weather. Marine Data.
          </p>
        </div>
      </footer>
    </div>
  );
}
