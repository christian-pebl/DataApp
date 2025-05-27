
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, Waves, SunMoon, FilePenLine, Edit3, PlusCircle, Trash2, Lightbulb } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface DummyDataPoint {
  time: string;
  temperature: number;
}

interface Annotation {
  id: string;
  startIndex: number;
  endIndex: number;
  startTime: string;
  endTime: string;
  text: string;
}

const generateDummyData = (): DummyDataPoint[] => {
  const data: DummyDataPoint[] = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 7); 

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const currentDate = new Date(baseDate);
      currentDate.setDate(baseDate.getDate() + day);
      currentDate.setHours(hour, 0, 0, 0);
      
      const time = currentDate.toISOString();
      const dayProgress = (day * 24 + hour) / (7 * 24); 
      const dailyCycle = Math.sin((hour / 24) * 2 * Math.PI - Math.PI / 2); 
      const weeklyTrend = Math.sin(dayProgress * Math.PI); 
      const baseTemp = 10 + (weeklyTrend * 5); 
      const fluctuation = 5 * dailyCycle; 
      const noise = (Math.random() - 0.5) * 2; 
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
  
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentAnnotationText, setCurrentAnnotationText] = useState("");
  const [isAnnotationModeActive, setIsAnnotationModeActive] = useState(false);

  useEffect(() => {
    const generatedData = generateDummyData();
    setDummyData(generatedData);
    if (generatedData.length > 0) {
        setBrushStartIndex(0);
        setBrushEndIndex(Math.min(23, generatedData.length - 1)); 
    }
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
      color: '--chart-1', 
      dataKey: 'temperature',
      unit: '°C',
    }
  ], []);

  const plottableSeries = useMemo(() => ['temperature'], []);

  const handleBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  }, []);

  const handleAddAnnotation = () => {
    if (currentAnnotationText.trim() === "" || brushStartIndex === undefined || brushEndIndex === undefined || brushStartIndex >= brushEndIndex) {
      return;
    }
    if (brushStartIndex < 0 || brushEndIndex >= dummyData.length) return;

    const newAnnotation: Annotation = {
      id: `anno-${Date.now()}`,
      startIndex: brushStartIndex,
      endIndex: brushEndIndex,
      startTime: dummyData[brushStartIndex].time,
      endTime: dummyData[brushEndIndex].time,
      text: currentAnnotationText.trim(),
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setCurrentAnnotationText("");
  };

  const handleDeleteAnnotation = (idToDelete: string) => {
    setAnnotations(prev => prev.filter(anno => anno.id !== idToDelete));
  };

  const isRangeSelectedForAnnotation = brushStartIndex !== undefined && brushEndIndex !== undefined && brushStartIndex < brushEndIndex;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/annotation" passHref>
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

      <main className="flex-grow container mx-auto p-3 md:p-4 space-y-4">
        <Card>
          <CardHeader className="pb-3 pt-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary" />
                Annotation Demo - Weekly Temperature
              </CardTitle>
              <CardDescription className="text-xs">
                {isAnnotationModeActive ? "Select a range on the chart to annotate." : "Enable annotation mode to add notes."}
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="annotation-mode-switch"
                checked={isAnnotationModeActive}
                onCheckedChange={setIsAnnotationModeActive}
              />
              <Label htmlFor="annotation-mode-switch" className="text-xs">Annotation Mode</Label>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-2">
            <ChartDisplay
              data={dummyData}
              plottableSeries={plottableSeries}
              yAxisConfigs={yAxisConfigs}
              timeAxisLabel="Time"
              plotTitle="" // Title is handled by CardHeader now
              chartRenderHeight={278} 
              brushStartIndex={brushStartIndex}
              brushEndIndex={brushEndIndex}
              onBrushChange={handleBrushChange}
            />
          </CardContent>
        </Card>

        {isAnnotationModeActive && isRangeSelectedForAnnotation && (
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Add Annotation
              </CardTitle>
              <CardDescription className="text-xs">
                  {isRangeSelectedForAnnotation 
                      ? `Selected range: ${dummyData[brushStartIndex as number]?.time ? format(parseISO(dummyData[brushStartIndex as number]?.time), 'MMM dd, HH:mm') : ''} to ${dummyData[brushEndIndex as number]?.time ? format(parseISO(dummyData[brushEndIndex as number]?.time), 'MMM dd, HH:mm') : ''}` 
                      : "Use the slider on the chart above to select a time range."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Enter annotation text..."
                  value={currentAnnotationText}
                  onChange={(e) => setCurrentAnnotationText(e.target.value)}
                  disabled={!isRangeSelectedForAnnotation}
                  className="text-sm"
                />
                <Button 
                  onClick={handleAddAnnotation} 
                  disabled={!isRangeSelectedForAnnotation || currentAnnotationText.trim() === ""}
                  size="sm"
                  className="text-xs"
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {annotations.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FilePenLine className="h-4 w-4 text-primary" />
                Saved Annotations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48 w-full rounded-md border p-2">
                <ul className="space-y-2">
                  {annotations.map((anno) => (
                    <li key={anno.id} className="text-xs p-2 rounded-md bg-muted/50 flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-foreground">{anno.text}</p>
                        <p className="text-muted-foreground">
                          Range: {format(parseISO(anno.startTime), 'MMM dd, HH:mm')} - {format(parseISO(anno.endTime), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteAnnotation(anno.id)}
                        className="h-6 w-6"
                        aria-label="Delete annotation"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
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
