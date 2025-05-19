
"use client";

import React, { useState, useEffect } from "react";
import { DataUploadForm } from "@/components/dataflow/DataUploadForm";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Github, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface DataPoint {
  time: string | number;
  [key: string]: string | number; 
}

export default function DataFlowPage() {
  const [parsedData, setParsedData] = useState<DataPoint[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string | undefined>(undefined);
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

  const handleDataUploaded = (data: DataPoint[], fileName: string) => {
    console.log("DataFlowPage: handleDataUploaded - Start");
    console.log("DataFlowPage: Raw Data received:", data);
    console.log("DataFlowPage: File Name:", fileName);

    setParsedData(data);
    setCurrentFileName(fileName);
    
    console.log("DataFlowPage: handleDataUploaded - End. State after update (next render):", { parsedData: data, currentFileName: fileName });
  };

  const handleClearData = () => {
    setParsedData([]);
    setCurrentFileName(undefined);
    console.log("DataFlowPage: Data cleared.");
  };
  
  console.log("DataFlowPage: Rendering. Current file name:", currentFileName);
  console.log("DataFlowPage: Parsed data length:", parsedData.length);


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
            {/* SeriesSelector and ChartSelector removed */}
          </div>

          {/* Main Content Area (Placeholder) */}
          <div className="md:col-span-9 space-y-6">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                   <Info className="h-6 w-6" /> Data Visualization Area
                </CardTitle>
                <CardDescription>
                  {parsedData.length > 0 && currentFileName 
                    ? `Data from "${currentFileName}" is loaded (${parsedData.length} rows). Visualization components have been removed.`
                    : "Upload a CSV file to see its data details here. Visualization components have been removed."
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Info className="h-16 w-16 mx-auto mb-4" />
                  <p>Data visualization components have been removed.</p>
                  {parsedData.length > 0 && (
                    <p className="mt-2 text-sm">
                      {parsedData.length} data rows loaded from {currentFileName}.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
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
