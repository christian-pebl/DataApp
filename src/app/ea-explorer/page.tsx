
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, SunMoon, LayoutGrid, CloudSun, Waves, ListChecks, AlertCircle, Target, Activity, CalendarDays, Search, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchMonitoringStationsAction, fetchStationMeasuresAction, fetchEATimeSeriesDataAction } from "./actions";
import type { EAStationInfo, EAMeasureInfo, EATimeSeriesDataPoint, FetchEATimeSeriesInput } from "./shared";
import { useToast } from "@/hooks/use-toast";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range"; // Reusing this
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay"; // Reusing ChartDisplay
import { subDays, formatISO } from 'date-fns';
import type { DateRange } from "react-day-picker";

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

  const [selectedMeasure, setSelectedMeasure] = useState<EAMeasureInfo | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7),
    to: new Date(),
  }));
  const [timeSeriesData, setTimeSeriesData] = useState<EATimeSeriesDataPoint[] | null>(null);
  const [isLoadingTimeSeries, setIsLoadingTimeSeries] = useState(false);
  const [errorTimeSeries, setErrorTimeSeries] = useState<string | null>(null);


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
    setSelectedMeasure(null);
    setTimeSeriesData(null);
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
    setSelectedMeasure(null);
    setTimeSeriesData(null);
    setCurrentStationNameForMeasures(station.name);

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

  const handleSelectMeasure = (measure: EAMeasureInfo) => {
    setSelectedMeasure(measure);
    setTimeSeriesData(null); // Clear previous plot data
    setErrorTimeSeries(null);
    // Optionally, you could auto-fetch here if a default date range is always fine
    // or wait for user to click "Fetch & Plot Data"
  };

  const handleFetchTimeSeries = async () => {
    if (!selectedMeasure) {
      toast({ variant: "destructive", title: "No Measure Selected", description: "Please select a measure to plot." });
      return;
    }
    if (!dateRange || !dateRange.from || !dateRange.to) {
      toast({ variant: "destructive", title: "Invalid Date Range", description: "Please select a valid start and end date." });
      return;
    }
     if (dateRange.from > dateRange.to) {
        toast({ variant: "destructive", title: "Invalid Date Range", description: "Start date cannot be after end date." });
        return;
    }

    setIsLoadingTimeSeries(true);
    setErrorTimeSeries(null);
    setTimeSeriesData(null);

    const input: FetchEATimeSeriesInput = {
      measureId: selectedMeasure.id, // This is the full URL for the measure
      startDate: formatISO(dateRange.from, { representation: 'date' }),
      endDate: formatISO(dateRange.to, { representation: 'date' }),
    };
    
    toast({ title: "Fetching Data", description: `Fetching '${selectedMeasure.parameterName}' data...` });
    const result = await fetchEATimeSeriesDataAction(input);
    setIsLoadingTimeSeries(false);

    if (result.success && result.data) {
      setTimeSeriesData(result.data);
      if (result.data.length === 0) {
        toast({ variant: "default", title: "No Data", description: `No data points found for '${selectedMeasure.parameterName}' in the selected range.`, duration: 4000 });
      } else {
        toast({ title: "Data Loaded", description: `Successfully loaded ${result.data.length} data points for '${selectedMeasure.parameterName}'.` });
      }
    } else {
      setErrorTimeSeries(result.error || `Failed to load time series data for '${selectedMeasure.parameterName}'.`);
      toast({ variant: "destructive", title: "Error Loading Data", description: result.error || `Failed to load data for '${selectedMeasure.parameterName}'.` });
    }
  };

  const yAxisPlotConfig: YAxisConfig[] | undefined = selectedMeasure ? [{
    id: 'value',
    orientation: 'left',
    label: `${selectedMeasure.parameterName} (${selectedMeasure.unitName || 'N/A'})`,
    color: '--chart-1',
    dataKey: 'value',
    unit: selectedMeasure.unitName || '',
  }] : undefined;

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
            <CardTitle>Environment Agency Data Explorer</CardTitle>
            <CardDescription>
              Load EA stations, select a measure, set a date range, and plot the data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLoadStations} disabled={isLoadingStations}>
              {isLoadingStations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
              Load Monitoring Stations
            </Button>
            {/* Stations List */}
            {isLoadingStations && <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading stations...</p></div>}
            {errorStations && !isLoadingStations && <div className="text-destructive p-2 bg-destructive/10 rounded-md"><AlertCircle className="inline mr-2"/>{errorStations}</div>}
            {stations.length > 0 && !isLoadingStations && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Available Stations ({stations.length})</h3>
                <ScrollArea className="h-60 w-full rounded-md border p-2">
                  <ul className="space-y-1">
                    {stations.map((station) => (
                      <li key={station.id}>
                        <Button variant={selectedStation?.id === station.id ? "secondary" : "ghost"} className="w-full justify-start text-left p-2 h-auto" onClick={() => handleSelectStation(station)} disabled={isLoadingMeasures && selectedStation?.id === station.id}>
                           <div className="flex flex-col">
                            <span className="font-medium text-sm">{station.name}</span>
                            <span className="text-xs text-muted-foreground">ID: {station.id}{station.notation && station.notation !== station.id && ` (Notation: ${station.notation})`}{station.lat && station.lon && ` | Lat: ${station.lat.toFixed(4)}, Lon: ${station.lon.toFixed(4)}`}</span>
                           </div>
                           {isLoadingMeasures && selectedStation?.id === station.id && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Measures List */}
        {selectedStation && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary"/> Measures for: {currentStationNameForMeasures || selectedStation.name}</CardTitle>
              <CardDescription>Station ID: {selectedStation.id}. Click a measure to select it for plotting.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMeasures && <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading measures...</p></div>}
              {errorMeasures && !isLoadingMeasures && <div className="text-destructive p-2 bg-destructive/10 rounded-md"><AlertCircle className="inline mr-2"/>{errorMeasures}</div>}
              {stationMeasures.length > 0 && !isLoadingMeasures && (
                <ScrollArea className="h-60 w-full rounded-md border p-2">
                  <ul className="divide-y divide-border">
                    {stationMeasures.map((measure) => (
                      <li key={measure.id}>
                        <Button variant={selectedMeasure?.id === measure.id ? "secondary" : "ghost"} className="w-full justify-start text-left p-2 h-auto hover:bg-muted/50" onClick={() => handleSelectMeasure(measure)}>
                          <div className="flex flex-col">
                            <p className="font-medium text-sm flex items-center gap-1.5"><Activity className="h-4 w-4 text-muted-foreground"/>{measure.parameterName}{measure.qualifier && <span className="text-xs text-muted-foreground">({measure.qualifier})</span>}</p>
                            <p className="text-xs text-muted-foreground ml-5">Unit: {measure.unitName}</p>
                          </div>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
              {stationMeasures.length === 0 && !isLoadingMeasures && !errorMeasures && <p className="text-sm text-muted-foreground">No measures found for this station.</p>}
            </CardContent>
          </Card>
        )}

        {/* Date Range and Plotting Area */}
        {selectedMeasure && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/> Plot: {selectedMeasure.parameterName}</CardTitle>
              <CardDescription>For station: {currentStationNameForMeasures || selectedStation?.name}. Select date range and fetch data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <label htmlFor="date-range-picker" className="text-sm font-medium mb-1 block">Date Range</label>
                <DatePickerWithRange id="date-range-picker" date={dateRange} onDateChange={setDateRange} disabled={isLoadingTimeSeries} />
              </div>
              <Button onClick={handleFetchTimeSeries} disabled={isLoadingTimeSeries || !dateRange?.from || !dateRange?.to}>
                {isLoadingTimeSeries ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Fetch & Plot Data
              </Button>

              {isLoadingTimeSeries && <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Loading data...</p></div>}
              {errorTimeSeries && !isLoadingTimeSeries && <div className="text-destructive p-2 bg-destructive/10 rounded-md"><AlertCircle className="inline mr-2"/>{errorTimeSeries}</div>}
              
              {timeSeriesData && !isLoadingTimeSeries && (
                <div className="h-[400px] w-full mt-4 border rounded-md p-2">
                  {timeSeriesData.length > 0 ? (
                    <ChartDisplay
                      data={timeSeriesData.map(d => ({ time: d.time, value: d.value }))}
                      plottableSeries={['value']}
                      timeAxisLabel="Time"
                      yAxisConfigs={yAxisPlotConfig}
                      plotTitle={`${selectedMeasure.parameterName} for ${currentStationNameForMeasures || selectedStation?.name}`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <AlertCircle className="w-10 h-10 mb-2 opacity-50"/>
                        <p>No data points found for the selected criteria.</p>
                    </div>
                  )}
                </div>
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
