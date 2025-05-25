
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay"; // Assuming ChartDisplay is in dataflow
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, CloudSun, Waves, SunMoon, FilePenLine, Edit3 } from "lucide-react"; // Added FilePenLine

interface DummyDataPoint {
  time: string;
  temperature: number;
}

const generateDummyData = (): DummyDataPoint[] => {
  const data: DummyDataPoint[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 7); // Start 7 days ago

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + day);
      currentDate.setHours(hour, 0, 0, 0);
      
      const time = currentDate.toISOString();
      
      // Simple sinusoidal temperature with some randomness
      // Simulates daily temperature fluctuation and a slight weekly trend
      const dayProgress = (day * 24 + hour) / (7 * 24); // 0 to 1 over the week
      const dailyCycle = Math.sin((hour / 24) * 2 * Math.PI - Math.PI / 2); // Peaking mid-day
      const weeklyTrend = Math.sin(dayProgress * Math.PI); // Gentle rise and fall over the week
      
      const baseTemp = 10 + (weeklyTrend * 5); // Base temp varies between 10 and 15
      const fluctuation = 5 * dailyCycle; // Daily fluctuation of +/- 5 degrees
      const noise = (Math.random() - 0.5) * 2; // +/- 1 degree noise
      
      const temperature = parseFloat((baseTemp + fluctuation + noise).toFixed(1));
      
      data.push({ time, temperature });
    }
  }
  return data;
};


export default function AnnotationPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const [dummyData, setDummyData] = useState<DummyDataPoint[]>([]);
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);


  useEffect(() => {
    const generatedData = generateDummyData();
    setDummyData(generatedData);
    setBrushEndIndex(generatedData.length > 0 ? generatedData.length - 1 : undefined);
  }, []);

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

  const yAxisConfigs: YAxisConfig[] = useMemo(() => [
    {
      id: 'temp',
      orientation: 'left',
      label: 'Temperature (°C)',
      color: '--chart-1', // Using theme variable for color
      dataKey: 'temperature',
      unit: '°C',
    }
  ], []);

  const plottableSeries = useMemo(() => ['temperature'], []);

  const handleBrushChange = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
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
                    <Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="Weather & Marine Explorer">
                      <Waves className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>Weather &amp; Marine Explorer</p></TooltipContent>
              </Tooltip>
               <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/annotation" passHref>
                    <Button variant={pathname === '/annotation' ? "secondary": "ghost"} size="icon" aria-label="Annotation Page">
                      <FilePenLine className="h-5 w-5" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent><p>Annotation Page</p></TooltipContent>
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
        <Card className="mb-4">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" />
              Annotation Page - Dummy Temperature Data
            </CardTitle>
            <CardDescription className="text-xs">
              A 7-day hourly temperature plot for demonstration purposes.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="p-2 pt-2"> {/* Adjusted padding for ChartDisplay */}
            <ChartDisplay
              data={dummyData}
              plottableSeries={plottableSeries}
              yAxisConfigs={yAxisConfigs}
              timeAxisLabel="Time"
              plotTitle="Weekly Temperature Trend"
              chartRenderHeight={350} // Default height, can be adjusted
              brushStartIndex={brushStartIndex}
              brushEndIndex={brushEndIndex}
              onBrushChange={handleBrushChange}
            />
          </CardContent>
        </Card>
      </main>

      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-12 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Annotation Page - PEBL data app.
          </p>
        </div>
      </footer>
    </div>
  );
}
