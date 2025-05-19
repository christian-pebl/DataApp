
"use client";

import React, { useState, useRef, useEffect } from "react";
import { DataUploadForm } from "@/components/dataflow/DataUploadForm";
import { ChartSelector } from "@/components/dataflow/ChartSelector";
import ChartDisplay, { type ChartDisplayHandle } from "@/components/dataflow/ChartDisplay";
import { ChartExport } from "@/components/dataflow/ChartExport";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Github } from "lucide-react"; // Github icon for branding/link

interface DataPoint {
  time: string | number;
  value: number;
  [key: string]: any;
}

export default function DataFlowPage() {
  const [parsedData, setParsedData] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
  const [chartType, setChartType] = useState<string>("line");
  const chartDisplayRef = useRef<ChartDisplayHandle>(null);
  const [theme, setTheme] = useState("light"); // Default to light theme

  useEffect(() => {
    // Detect system theme or load from local storage
    const storedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches; // Corrected typo: systemPréfèreDark -> systemPrefersDark
    if (storedTheme) {
      setTheme(storedTheme);
    } else if (systemPrefersDark) { // Used corrected variable
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

  const handleDataUploaded = (data: DataPoint[], fileName: string) => {
    setParsedData(data);
    setCurrentFileName(fileName);
  };

  const handleClearData = () => {
    setParsedData([]);
    setCurrentFileName(undefined);
  };
  
  const getSvgRef = () => {
    return chartDisplayRef.current?.getSvgRef() ?? { current: null };
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
            <DataUploadForm onDataUploaded={handleDataUploaded} onClearData={handleClearData} />
            <Separator />
            <ChartSelector
              selectedChartType={chartType}
              onChartTypeChange={setChartType}
            />
            <Separator />
            <ChartExport svgRef={getSvgRef()} fileName={currentFileName} />
          </div>

          {/* Chart Display Area */}
          <div className="md:col-span-9 min-h-[400px] md:min-h-0"> {/* Ensure chart area has substantial height */}
            <ChartDisplay ref={chartDisplayRef} data={parsedData} chartType={chartType} fileName={currentFileName} />
          </div>
        </div>
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground">
            Built with Next.js, ShadCN/UI, and Recharts.
          </p>
        </div>
      </footer>
    </div>
  );
}
