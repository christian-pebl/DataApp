
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, CloudSun, LayoutGrid, PlusCircle } from "lucide-react"; // Added LayoutGrid
import { PlotInstance } from "@/components/dataflow/PlotInstance";
import Link from "next/link";

interface PlotConfig {
  id: string;
  title: string;
}

export default function DataFlowPage() {
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const [theme, setTheme] = useState("light");

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

      <main className="flex-grow container mx-auto p-2 md:p-3">
        <div className="mb-3">
          <Button onClick={addPlot} variant="outline" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Plot
          </Button>
        </div>

        {plots.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-6">
            <PlusCircle className="h-10 w-10 mb-2" />
            <p className="text-sm">No plots yet.</p>
            <p className="text-xs">Click "Add New Plot" to get started.</p>
          </div>
        )}

        <div className="space-y-3">
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
      <footer className="py-3 md:px-4 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-2 md:h-16 md:flex-row">
          <p className="text-balance text-center text-xs leading-loose text-muted-foreground">
            Built with Next.js and ShadCN/UI.
          </p>
        </div>
      </footer>
    </div>
  );
}
    
