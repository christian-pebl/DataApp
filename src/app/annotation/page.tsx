
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutGrid, Waves, SunMoon, FilePenLine, Edit, 
  Trash2, Plus, Copy, MoveRight, Spline, Palette,
  Move as MoveIcon // Still keeping for potential future use if direct move tool is re-added
} from "lucide-react"; 
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator as DropdownMenuSeparatorShadcn,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";


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
  arrowStyle?: 'none' | 'end' | 'both';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  strokeWidth?: number;
  color?: string;
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

const DEFAULT_STROKE_WIDTH = 1.5;
const SELECTED_STROKE_WIDTH_OFFSET = 1;
const CHART_RENDERING_BASE_HEIGHT = 278 * 0.85; 
const DEFAULT_LINE_COLOR = 'hsl(var(--primary))';

const LineStyleIcon = ({ style }: { style: 'solid' | 'dashed' | 'dotted' }) => {
  let strokeDasharray;
  if (style === 'dashed') strokeDasharray = "3,2";
  if (style === 'dotted') strokeDasharray = "1,2";
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="mr-2">
      <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray={strokeDasharray} />
    </svg>
  );
};

const ArrowStyleIcon = ({ style }: { style: 'none' | 'end' | 'both' }) => {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="mr-2">
      <defs>
        <marker id="dropdown-arrowhead-preview" markerWidth="4" markerHeight="3" refX="0" refY="1.5" orient="auto" fill="currentColor">
          <polygon points="0 0, 4 1.5, 0 3" />
        </marker>
      </defs>
      <line 
        x1={style === 'both' ? "7" : "2"}
        y1="8" 
        x2={(style === 'end' || style === 'both') ? "17" : "22"} 
        y2="8" 
        stroke="currentColor" 
        strokeWidth="2" 
        markerStart={(style === 'both') ? "url(#dropdown-arrowhead-preview)" : undefined}
        markerEnd={(style === 'end' || style === 'both') ? "url(#dropdown-arrowhead-preview)" : undefined}
      />
    </svg>
  );
};

const ColorSwatch = ({ color }: { color: string }) => (
  <div className="w-4 h-4 rounded-sm border border-border mr-2" style={{ backgroundColor: color }} />
);


export default function AnnotationPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const [dummyData, setDummyData] = useState<DummyDataPoint[]>([]);
  // const { toast } = useToast(); // Not used in this version
  
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const [isOverlayActive, setIsOverlayActive] = useState(false);

  const [lines, setLines] = useState<LineAnnotation[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  
  const [draggingPoint, setDraggingPoint] = useState<{ lineId: string; pointType: 'start' | 'end' } | null>(null);
  
  const [movingLineId, setMovingLineId] = useState<string | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [lineBeingMovedOriginalState, setLineBeingMovedOriginalState] = useState<LineAnnotation | null>(null);

  const getNormalizedCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent<Element> | MouseEvent | TouchEvent) => {
    if ('touches' in event && event.touches.length > 0) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    if ('clientX' in event) {
      return { clientX: event.clientX, clientY: event.clientY };
    }
    return { clientX: 0, clientY: 0 }; 
  }, []);

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

  const handleAddLine = () => {
    if (!svgOverlayRef.current || draggingPoint || movingLineId ) return;
    
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const centerX = svgRect.width / 2;
    const centerY = svgRect.height / 2;
    const defaultLineLength = Math.min(svgRect.width, svgRect.height) * 0.2;

    const newLine: LineAnnotation = {
      id: Date.now().toString(),
      x1: centerX - defaultLineLength / 2,
      y1: centerY,
      x2: centerX + defaultLineLength / 2,
      y2: centerY,
      arrowStyle: 'none',
      lineStyle: 'solid',
      strokeWidth: DEFAULT_STROKE_WIDTH,
      color: DEFAULT_LINE_COLOR,
    };

    setLines(prevLines => [...prevLines, newLine]);
    setSelectedLineId(newLine.id);
  };
  
  const handleDraggablePointInteractionStart = (lineId: string, pointType: 'start' | 'end', event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if ('preventDefault' in event) event.preventDefault(); 
    setDraggingPoint({ lineId, pointType });
    setSelectedLineId(lineId); 
  };

  const handleInteractionMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!svgOverlayRef.current) return;
    
    const isTouchEvent = event.type.startsWith('touch');
    if (isTouchEvent && (draggingPoint || movingLineId)) {
      if ('preventDefault' in event) event.preventDefault();
    }

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));
    
    if (draggingPoint) {
      setLines(prevLines =>
        prevLines.map(line => {
          if (line.id === draggingPoint.lineId) {
            return draggingPoint.pointType === 'start' ? { ...line, x1: x, y1: y } : { ...line, x2: x, y2: y };
          }
          return line;
        })
      );
    } else if (movingLineId && dragStartCoords && lineBeingMovedOriginalState) {
      const dx = x - dragStartCoords.x;
      const dy = y - dragStartCoords.y;
      setLines(prevLines =>
        prevLines.map(line => {
          if (line.id === movingLineId) {
            return {
              ...line,
              x1: Math.max(0, Math.min(lineBeingMovedOriginalState.x1 + dx, rect.width)),
              y1: Math.max(0, Math.min(lineBeingMovedOriginalState.y1 + dy, rect.height)),
              x2: Math.max(0, Math.min(lineBeingMovedOriginalState.x2 + dx, rect.width)),
              y2: Math.max(0, Math.min(lineBeingMovedOriginalState.y2 + dy, rect.height)),
            };
          }
          return line;
        })
      );
    }
  }, [draggingPoint, movingLineId, dragStartCoords, lineBeingMovedOriginalState, getNormalizedCoordinates, lines]);

  const handleInteractionEnd = useCallback(() => {
    if (draggingPoint) {
      setDraggingPoint(null);
    }
    if (movingLineId) {
      setMovingLineId(null);
      setDragStartCoords(null);
      setLineBeingMovedOriginalState(null);
    }
  }, [draggingPoint, movingLineId]);

  useEffect(() => {
    if (draggingPoint || movingLineId) {
      window.addEventListener('mousemove', handleInteractionMove);
      window.addEventListener('touchmove', handleInteractionMove, { passive: false });
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchend', handleInteractionEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchend', handleInteractionEnd);
    };
  }, [draggingPoint, movingLineId, handleInteractionMove, handleInteractionEnd]);
  
  const handleLineHitboxInteractionStart = (lineId: string, event: React.MouseEvent | React.TouchEvent<Element>) => {
    event.stopPropagation();
    if (draggingPoint) return; // If already dragging an endpoint, don't initiate a line move

    setSelectedLineId(lineId); // Always select the line first
    
    // Initiate whole line move
    if (!svgOverlayRef.current) return;
    const line = lines.find(l => l.id === lineId);
    if (!line) return;

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setMovingLineId(lineId);
    setDragStartCoords({ x, y });
    setLineBeingMovedOriginalState({ ...line });
  };
  
  const handleArrowStyleChange = (style: 'none' | 'end' | 'both') => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, arrowStyle: style } : line
        )
      );
    }
  };

  const handleLineStyleChange = (style: 'solid' | 'dashed' | 'dotted') => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, lineStyle: style } : line
        )
      );
    }
  };

  const handleStrokeWeightChange = (newWeightArray: number[]) => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      const newWeight = newWeightArray[0];
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, strokeWidth: newWeight } : line
        )
      );
    }
  };

  const handleLineColorChange = (color: string) => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, color: color } : line
        )
      );
    }
  };

  const handleDeleteSelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
    }
  };

  const handleCopySelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      const lineToCopy = lines.find(l => l.id === selectedLineId);
      if (lineToCopy && svgOverlayRef.current) {
        const svgRect = svgOverlayRef.current.getBoundingClientRect();
        const offsetX = Math.min(20, svgRect.width * 0.05); 
        const offsetY = Math.min(20, svgRect.height * 0.05);

        let newX1 = lineToCopy.x1 + offsetX;
        let newY1 = lineToCopy.y1 + offsetY;
        let newX2 = lineToCopy.x2 + offsetX;
        let newY2 = lineToCopy.y2 + offsetY;
        
        if (newX1 > svgRect.width || newY1 > svgRect.height || newX2 > svgRect.width || newY2 > svgRect.height) {
          newX1 = lineToCopy.x1 - offsetX;
          newY1 = lineToCopy.y1 - offsetY;
          newX2 = lineToCopy.x2 - offsetX;
          newY2 = lineToCopy.y2 - offsetY;
        }
        
        newX1 = Math.max(0, Math.min(newX1, svgRect.width));
        newY1 = Math.max(0, Math.min(newY1, svgRect.height));
        newX2 = Math.max(0, Math.min(newX2, svgRect.width));
        newY2 = Math.max(0, Math.min(newY2, svgRect.height));

        const newLine: LineAnnotation = {
          ...lineToCopy,
          id: Date.now().toString(),
          x1: newX1,
          y1: newY1,
          x2: newX2,
          y2: newY2,
        };
        setLines(prevLines => [...prevLines, newLine]);
        setSelectedLineId(newLine.id); 
      }
    }
  };

  const selectedLine = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);
  
  const isMainToolbarButtonDisabled = (buttonType?: 'style' | 'color' | 'action') => {
    if (draggingPoint || movingLineId) return true; 
    if (buttonType === 'style' || buttonType === 'color' || buttonType === 'action') return !selectedLineId;
    return false; 
  };
  
  const getStrokeDasharray = (style?: 'solid' | 'dashed' | 'dotted') => {
    switch (style) {
      case 'dashed':
        return "5,5";
      case 'dotted':
        return "1,4";
      case 'solid':
      default:
        return undefined;
    }
  };

  const handleSvgBackgroundClick = (event: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (event.target === svgOverlayRef.current && !draggingPoint && !movingLineId) {
        setSelectedLineId(null);
    }
  };

  const svgCursor = useMemo(() => {
    if (movingLineId) return 'grabbing';
    if (draggingPoint) return 'grabbing';
    if (selectedLineId && !draggingPoint && !movingLineId) return 'move'; 
    return 'default';
  }, [selectedLineId, draggingPoint, movingLineId]);


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
                Toggle overlay. Add lines. Select to move/drag. Use toolbars to style or delete.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="annotation-overlay-switch"
                checked={isOverlayActive}
                onCheckedChange={(checked) => {
                  setIsOverlayActive(checked);
                  if (!checked) { 
                    setSelectedLineId(null);
                    setDraggingPoint(null);
                    setMovingLineId(null);
                    setDragStartCoords(null);
                    setLineBeingMovedOriginalState(null);
                  }
                }}
              />
              <Label htmlFor="annotation-overlay-switch" className="text-sm">Annotation Overlay</Label>
            </div>
          </CardHeader>
          <CardContent className="p-2 pt-2">
            {isOverlayActive && (
              <TooltipProvider delayDuration={0}>
                <div className="absolute top-16 left-5 z-20 bg-card border shadow-lg rounded-md p-1 flex items-center space-x-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={"outline"}
                        className="h-8 px-2" 
                        onClick={handleAddLine}
                        disabled={draggingPoint !== null || movingLineId !== null}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Line
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Add Straight Line</p></TooltipContent>
                  </Tooltip>
                  
                  <Separator orientation="vertical" className="h-6 mx-1" />

                  <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={isMainToolbarButtonDisabled('style')}
                                    aria-label="Arrow Style Options"
                                >
                                    <MoveRight className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Arrow Style</p></TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>Arrow Style</DropdownMenuLabel>
                        <DropdownMenuSeparatorShadcn />
                        <DropdownMenuRadioGroup
                            value={selectedLine?.arrowStyle || 'none'}
                            onValueChange={(value) => handleArrowStyleChange(value as 'none' | 'end' | 'both')}
                        >
                            <DropdownMenuRadioItem value="none">
                                <ArrowStyleIcon style="none" /> 
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="end">
                                <ArrowStyleIcon style="end" />
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="both">
                               <ArrowStyleIcon style="both" />
                            </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                           <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isMainToolbarButtonDisabled('style')}
                            aria-label="Line Style & Thickness Options"
                          >
                            {/* Custom SVG Icon for Line Style/Thickness */}
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                                <path d="M2 4h12v1H2zM2 7.5h12v2H2zM2 11h12v3H2z"/>
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent><p>Line Style & Thickness</p></TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Line Style</DropdownMenuLabel>
                      <DropdownMenuSeparatorShadcn />
                      <DropdownMenuRadioGroup 
                        value={selectedLine?.lineStyle || 'solid'} 
                        onValueChange={(value) => handleLineStyleChange(value as 'solid' | 'dashed' | 'dotted')}
                      >
                        <DropdownMenuRadioItem value="solid">
                            <LineStyleIcon style="solid" /> {/* No text label */}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dashed">
                            <LineStyleIcon style="dashed" /> {/* No text label */}
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dotted">
                           <LineStyleIcon style="dotted" /> {/* No text label */}
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparatorShadcn />
                      <DropdownMenuLabel>Stroke Weight</DropdownMenuLabel>
                       <div className="px-2 py-1.5 flex items-center space-x-2">
                         <Slider
                            defaultValue={[DEFAULT_STROKE_WIDTH]}
                            value={[selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH]}
                            onValueChange={handleStrokeWeightChange}
                            min={1}
                            max={10}
                            step={0.5}
                            disabled={isMainToolbarButtonDisabled('style')}
                            className="flex-grow"
                          />
                          <span className="text-xs w-10 text-right">{(selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH).toFixed(1)}px</span>
                       </div>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={isMainToolbarButtonDisabled('color')}
                            aria-label="Line Color Options"
                          >
                            <Palette className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent><p>Line Color</p></TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Line Color</DropdownMenuLabel>
                      <DropdownMenuSeparatorShadcn />
                      <DropdownMenuRadioGroup
                        value={selectedLine?.color || DEFAULT_LINE_COLOR}
                        onValueChange={handleLineColorChange}
                      >
                        <DropdownMenuRadioItem value={'hsl(var(--primary))'}>
                          <ColorSwatch color="hsl(var(--primary))" />Primary
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value={'hsl(var(--accent))'}>
                          <ColorSwatch color="hsl(var(--accent))" />Accent
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value={'hsl(var(--foreground))'}>
                          <ColorSwatch color="hsl(var(--foreground))" />Foreground
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value={'hsl(var(--destructive))'}>
                          <ColorSwatch color="hsl(var(--destructive))" />Destructive
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Separator orientation="vertical" className="h-6 mx-1" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCopySelectedLine} disabled={isMainToolbarButtonDisabled('action')}><Copy className="h-4 w-4" /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copy Selected Line</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleDeleteSelectedLine} disabled={isMainToolbarButtonDisabled('action')}><Trash2 className="h-4 w-4" /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Selected Line</p></TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}
            

            <div className="relative" ref={chartAreaRef} style={{ height: `${CHART_RENDERING_BASE_HEIGHT}px` }}>
              <div className={cn(isOverlayActive && "opacity-30 transition-opacity", (isOverlayActive && (draggingPoint || movingLineId)) && "pointer-events-none")}>
                <ChartDisplay
                  data={dummyData}
                  plottableSeries={plottableSeries}
                  yAxisConfigs={yAxisConfigs}
                  timeAxisLabel="Time"
                  plotTitle="" 
                  chartRenderHeight={CHART_RENDERING_BASE_HEIGHT} 
                  brushStartIndex={brushStartIndex}
                  brushEndIndex={brushEndIndex}
                  onBrushChange={handleBrushChange}
                />
              </div>
              {isOverlayActive && chartAreaRef.current && (
                 <svg
                    ref={svgOverlayRef}
                    className="absolute top-0 left-0 w-full h-full z-10" 
                    onClick={handleSvgBackgroundClick}
                    onTouchStart={handleSvgBackgroundClick} 
                    style={{ 
                        cursor: svgCursor,
                        pointerEvents: (draggingPoint || movingLineId) ? 'auto' : 'auto', 
                    }}
                  >
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="4" 
                        markerHeight="3"
                        refX="0" 
                        refY="1.5" 
                        orient="auto-start-reverse"
                        fill="currentColor" 
                      >
                        <polygon points="0 0, 4 1.5, 0 3" /> 
                      </marker>
                    </defs>
                    {lines.map((line) => (
                      <g key={line.id}>
                        <line // Invisible hitbox
                          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                          stroke="transparent"
                          strokeWidth="20" 
                          className={cn(
                            "cursor-pointer",
                            selectedLineId === line.id && !draggingPoint && "cursor-move" 
                          )}
                          onMouseDown={(e) => handleLineHitboxInteractionStart(line.id, e)}
                          onTouchStart={(e) => handleLineHitboxInteractionStart(line.id, e as unknown as React.TouchEvent<SVGLineElement>)}
                          style={{ pointerEvents: (draggingPoint || (movingLineId && movingLineId !== line.id)) ? 'none' : 'auto' }}
                        />
                        <line // Visible line
                          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                          stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : (line.color || DEFAULT_LINE_COLOR)}
                          strokeWidth={selectedLineId === line.id ? (line.strokeWidth || DEFAULT_STROKE_WIDTH) + SELECTED_STROKE_WIDTH_OFFSET : (line.strokeWidth || DEFAULT_STROKE_WIDTH)} 
                          markerStart={(line.arrowStyle === 'start' || line.arrowStyle === 'both') ? "url(#arrowhead)" : undefined}
                          markerEnd={(line.arrowStyle === 'end' || line.arrowStyle === 'both') ? "url(#arrowhead)" : undefined}
                          strokeDasharray={getStrokeDasharray(line.lineStyle)}
                          style={{ pointerEvents: 'none' }} 
                        />
                        {selectedLineId === line.id && !movingLineId && (
                          <>
                            <circle // Start point handle
                              cx={line.x1} cy={line.y1} r="8" 
                              fill="hsl(var(--destructive))" opacity="0.5" 
                              className="cursor-grab active:cursor-grabbing"
                              onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)}
                              onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)}
                              style={{ pointerEvents: 'auto' }} 
                            />
                             <circle 
                              cx={line.x1} cy={line.y1} r="4"
                              fill="hsl(var(--destructive))"
                              style={{ pointerEvents: 'none' }}
                            />
                            <circle // End point handle
                              cx={line.x2} cy={line.y2} r="8" 
                              fill="hsl(var(--destructive))" opacity="0.5" 
                              className="cursor-grab active:cursor-grabbing"
                              onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)}
                              onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)}
                              style={{ pointerEvents: 'auto' }} 
                            />
                            <circle 
                              cx={line.x2} cy={line.y2} r="4"
                              fill="hsl(var(--destructive))"
                              style={{ pointerEvents: 'none' }}
                            />
                          </>
                        )}
                      </g>
                    ))}
                  </svg>
              )}
            </div>
          </CardContent>
        </Card>
         {isOverlayActive && selectedLineId && !draggingPoint && !movingLineId && <CardDescription className="text-center text-xs mt-2">Line selected. Drag endpoints or whole line. Use toolbars to style/delete.</CardDescription>}
         {isOverlayActive && (draggingPoint || movingLineId) && <CardDescription className="text-center text-xs mt-2">{draggingPoint ? 'Dragging line endpoint...' : 'Moving line...'}</CardDescription>}
         {!isOverlayActive && lines.length > 0 && <CardDescription className="text-center text-xs mt-2">Toggle "Annotation Overlay" to edit annotations.</CardDescription>}
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

    