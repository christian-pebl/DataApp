
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Moon, Sun, CloudSun, LayoutGrid, AlertTriangle, Info } from "lucide-react"; // Added LayoutGrid, removed Github, Home
import { WeatherControls } from "@/components/weather/WeatherControls";
import type { WeatherControlsFormValues, WeatherVariableValue } from "@/components/weather/WeatherControls";
import { ChartDisplay } from "@/components/dataflow/ChartDisplay";
import { fetchWeatherDataAction } from "./actions";
import type { WeatherDataPoint } from "./shared";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function WeatherPage() {
  const [theme, setTheme] = useState("light");
  const [weatherData, setWeatherData] = useState<WeatherDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSelectedVariable, setCurrentSelectedVariable] = useState<string>("temperature");
  const { toast } = useToast();

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
        toast({ title: "Success", description: "Weather data fetched successfully." });
      }
    } else {
      setError(result.error || "Failed to fetch weather data.");
      toast({ variant: "destructive", title: "Error", description: result.error || "Failed to fetch weather data." });
    }
  };
  
  const chartCompatibleData = weatherData as Array<{[key: string]: string | number | undefined; time: string | number}>;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-3 md:px-4">
          <Link href="/" passHref>
            <h1 className="text-2xl font-bold text-primary cursor-pointer">PEBL</h1>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/" passHref>
              <Button variant="ghost" size="icon" aria-label="Data Explorer">
                <LayoutGrid className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/weather" passHref>
              <Button variant="ghost" size="icon" aria-label="Weather Page">
                <CloudSun className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme (Settings)">
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4 lg:col-span-3">
            <WeatherControls onSubmit={handleFetchWeather} isLoading={isLoading} />
          </div>
          <div className="md:col-span-8 lg:col-span-9">
            <Card className="shadow-lg h-full">
              <CardHeader className="p-3">
                <CardTitle className="text-md">
                  Weather Plot: {currentSelectedVariable.charAt(0).toUpperCase() + currentSelectedVariable.slice(1)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 h-[calc(100%-4rem)]">
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
                    chartRenderHeight={400} 
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

