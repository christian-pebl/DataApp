
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Github, PlusCircle } from "lucide-react";
import { PlotInstance } from "@/components/dataflow/PlotInstance";

interface PlotConfig {
  id: string;
  title: string;
}

export default function DataFlowPage() {
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const [theme, setTheme] = useState("light");

  // Initialize with one plot by default
  useEffect(() => {
    if (plots.length === 0) {
      addPlot();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
        // Check system preference only if no theme is stored
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

  const addPlot = () => {
    const newPlotId = `plot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newPlotTitle = `Plot ${plots.length + 1}`;
    setPlots(prevPlots => [...prevPlots, { id: newPlotId, title: newPlotTitle }]);
  };

  const removePlot = (idToRemove: string) => {
    setPlots(prevPlots => prevPlots.filter(plot => plot.id !== idToRemove));
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
        <div className="mb-6">
          <Button onClick={addPlot} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Plot
          </Button>
        </div>

        {plots.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-10">
            <PlusCircle className="h-16 w-16 mb-4" />
            <p className="text-lg">No plots yet.</p>
            <p>Click "Add New Plot" to get started.</p>
          </div>
        )}

        <div className="space-y-8">
          {plots.map((plot, index) => (
            <PlotInstance
              key={plot.id}
              instanceId={plot.id}
              onRemovePlot={removePlot}
              initialPlotTitle={plot.title || `Plot ${index + 1}`}
            />
          ))}
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
