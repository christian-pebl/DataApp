
"use client";

import React, { useState, useEffect } from "react";
import { DataUploadForm } from "@/components/dataflow/DataUploadForm";
import { SeriesSelector } from "@/components/dataflow/SeriesSelector";
import { ChartDisplay } from "@/components/dataflow/ChartDisplay";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Github } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface DataPoint {
  time: string | number;
  [key: string]: string | number;
}

export default function DataFlowPage() {
  const [parsedData, setParsedData] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [dataSeries, setDataSeries] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string | undefined>(undefined);
  const [timeAxisLabel, setTimeAxisLabel] = useState<string | undefined>(undefined);
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (storedTheme) {
      setTheme(storedTheme);
    } else if (systemPrefersDark) {
      setTheme("dark");
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

  const handleDataUploaded = (data: DataPoint[], fileName: string, seriesNames: string[], timeHeader: string) => {
    setParsedData(data);
    setCurrentFileName(fileName);
    setDataSeries(seriesNames);
    setTimeAxisLabel(timeHeader);
    // Automatically select the first available series, if any
    if (seriesNames.length > 0) {
      setSelectedSeries(seriesNames[0]);
    } else {
      setSelectedSeries(undefined);
    }
  };

  const handleClearData = () => {
    setParsedData([]);
    setCurrentFileName(undefined);
    setDataSeries([]);
    setSelectedSeries(undefined);
    setTimeAxisLabel(undefined);
  };

  const handleSeriesSelected = (seriesName: string) => {
    setSelectedSeries(seriesName);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <h1 className="text-2xl font-bold text-primary">DataFlow</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            <a href="https://github.com/firebase/studio" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository">
              <Button variant="ghost" size="icon">
                <Github className="h-5 w-5" />
              </Button>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
          {/* Controls Panel */}
          <div className="md:col-span-3 space-y-6">
            <DataUploadForm
              onDataUploaded={handleDataUploaded}
              onClearData={handleClearData}
              currentFileNameFromParent={currentFileName}
            />
            <SeriesSelector
              availableSeries={dataSeries}
              selectedSeries={selectedSeries}
              onSeriesSelected={handleSeriesSelected}
              disabled={parsedData.length === 0}
            />
          </div>

          {/* Main Content Area (Chart) */}
          <div className="md:col-span-9 space-y-6">
            <ChartDisplay
              data={parsedData}
              selectedSeries={selectedSeries}
              timeAxisLabel={timeAxisLabel}
              currentFileName={currentFileName}
            />
          </div>
        </div>
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground">
            Built with Next.js and ShadCN/UI.
          </p>
        </div>
      </footer>
    </div>
  );
}

    