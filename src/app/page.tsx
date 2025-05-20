
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
        <div className="container flex h-14 items-center justify-between px-3 md:px-4"> {/* Reduced height and padding */}
          <h1 className="text-xl font-bold text-primary">DataFlow</h1> {/* Reduced text size */}
          <div className="flex items-center gap-1"> {/* Reduced gap */}
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

      <main className="flex-grow container mx-auto p-3 md:p-4"> {/* Reduced padding */}
        <div className="mb-4"> {/* Reduced margin */}
          <Button onClick={addPlot} variant="outline" size="sm"> {/* Made button smaller */}
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Plot
          </Button>
        </div>

        {plots.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-8"> {/* Reduced py */}
            <PlusCircle className="h-12 w-12 mb-3" /> {/* Reduced size and margin */}
            <p className="text-md">No plots yet.</p> {/* Reduced text size */}
            <p className="text-sm">Click "Add New Plot" to get started.</p> {/* Reduced text size */}
          </div>
        )}

        <div className="space-y-4"> {/* Reduced spacing between plots */}
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
      <footer className="py-4 md:px-6 md:py-0 border-t"> {/* Reduced padding */}
        <div className="container flex flex-col items-center justify-center gap-3 md:h-20 md:flex-row"> {/* Reduced gap and height */}
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground"> {/* Reduced text size */}
            Built with Next.js and ShadCN/UI.
          </p>
        </div>
      </footer>
    </div>
  );
}
