
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, Waves, SunMoon, FilePenLine, Edit, Ban, PenLine } from "lucide-react"; // Added Ban, PenLine
import { cn } from "@/lib/utils";

interface DummyDataPoint {
  time: string;
  temperature: number;
}

interface LineAnnotation {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
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

  const [isOverlayActive, setIsOverlayActive] = useState(false);

  // State for line drawing
  const [drawingMode, setDrawingMode] = useState<'line' | null>(null);
  const [lineStartPoint, setLineStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [lines, setLines] = useState<LineAnnotation[]>([]);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);


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
    } else if (typeof window !== 'undefined') {
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (systemPrefersDark) {
        setTheme("dark");
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", theme);
    }
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

  const handleBrushChange = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };

  const handleSvgClick = (event: React.MouseEvent<SVGSVGElement>) => {
    if (drawingMode !== 'line' || !svgOverlayRef.current) return;

    // Get click coordinates relative to the SVG overlay
    const rect = svgOverlayRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (!lineStartPoint) {
      setLineStartPoint({ x, y });
    } else {
      setLines(prevLines => [
        ...prevLines, 
        { x1: lineStartPoint.x, y1: lineStartPoint.y, x2: x, y2: y, id: Date.now().toString() }
      ]);
      setLineStartPoint(null); // Reset to allow drawing a new line immediately
    }
  };

  const toggleDrawingMode = () => {
    if (drawingMode === 'line') {
      setDrawingMode(null);
      setLineStartPoint(null); // Clear any pending line start
    } else {
      setDrawingMode('line');
      setLineStartPoint(null); // Ensure starting fresh
    }
  };


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
                <Edit className="h-5 w-5 text-primary" />
                Annotation Demo - Weekly Temperature
              </CardTitle>
              <CardDescription className="text-xs">
                Toggle overlay to enable annotation tools.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="annotation-overlay-switch"
                checked={isOverlayActive}
                onCheckedChange={(checked) => {
                  setIsOverlayActive(checked);
                  if (!checked) { // If turning overlay off, also turn off drawing mode
                    setDrawingMode(null);
                    setLineStartPoint(null);
                  }
                }}
              />
              <Label htmlFor="annotation-overlay-switch" className="text-sm">Annotation Overlay</Label>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-2">
            {isOverlayActive && (
              <div className="absolute top-16 left-5 z-20 bg-card border shadow-lg rounded-md p-1 flex space-x-1"> {/* Adjusted top to be below header */}
                <Button
                  variant="outline"
                  size="sm" // Make button slightly larger
                  className="h-8 px-2" // Custom padding
                  title={drawingMode === 'line' ? "Cancel Drawing" : "Draw Line"}
                  onClick={toggleDrawingMode}
                >
                  {drawingMode === 'line' ? 
                    <Ban className="h-4 w-4 mr-1" /> : 
                    <PenLine className="h-4 w-4 mr-1" />
                  }
                  {drawingMode === 'line' ? "Cancel" : "Line"}
                </Button>
                {/* Add other placeholder toolbar buttons here */}
              </div>
            )}
            <div className="relative" ref={chartAreaRef}>
              <div className={cn(isOverlayActive && "opacity-30 transition-opacity")}>
                <ChartDisplay
                  data={dummyData}
                  plottableSeries={plottableSeries}
                  yAxisConfigs={yAxisConfigs}
                  timeAxisLabel="Time"
                  plotTitle="" 
                  chartRenderHeight={278}
                  brushStartIndex={brushStartIndex}
                  brushEndIndex={brushEndIndex}
                  onBrushChange={handleBrushChange}
                />
              </div>
              {isOverlayActive && chartAreaRef.current && (
                 <svg
                    ref={svgOverlayRef}
                    className="absolute top-0 left-0 w-full h-full z-10" // Ensure SVG is on top
                    onClick={handleSvgClick}
                    style={{ 
                        pointerEvents: drawingMode === 'line' ? 'auto' : 'none',
                        width: chartAreaRef.current.clientWidth, // Match parent div width
                        height: chartAreaRef.current.clientHeight, // Match parent div height
                    }}
                  >
                    {lines.map((line) => (
                      <line
                        key={line.id}
                        x1={line.x1}
                        y1={line.y1}
                        x2={line.x2}
                        y2={line.y2}
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                      />
                    ))}
                    {lineStartPoint && ( // Visualize the starting point if drawing
                        <circle cx={lineStartPoint.x} cy={lineStartPoint.y} r="3" fill="hsl(var(--primary))" />
                    )}
                  </svg>
              )}
            </div>
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

