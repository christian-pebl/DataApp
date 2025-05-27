
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
  Trash2, Plus, Copy, RotateCcw, Move as MoveIcon, MoveRight, Spline, Ban
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

const DEFAULT_STROKE_WIDTH = 2;
const ROTATION_ANGLE_STEP = 15; // degrees

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
        <marker id="dropdown-arrowhead-preview" markerWidth="4" markerHeight="3" refX="0" refY="1.5" orient="auto" markerUnits="strokeWidth" fill="currentColor">
          <polygon points="0 0, 4 1.5, 0 3" />
        </marker>
      </defs>
      <line 
        x1={style === 'both' ? "7" : "2"}
        y1="8" 
        x2={style === 'end' || style === 'both' ? "17" : "22"} 
        y2="8" 
        stroke="currentColor" 
        strokeWidth="2" 
        markerStart={(style === 'both') ? "url(#dropdown-arrowhead-preview)" : undefined}
        markerEnd={(style === 'end' || style === 'both') ? "url(#dropdown-arrowhead-preview)" : undefined}
      />
    </svg>
  );
};


export default function AnnotationPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const [dummyData, setDummyData] = useState<DummyDataPoint[]>([]);
  const { toast } = useToast();
  
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

  const [activeTool, setActiveTool] = useState<'move' | null>(null);
  
  const [contextualToolbarPosition, setContextualToolbarPosition] = useState<{ x: number; y: number } | null>(null);

  const getNormalizedCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent<Element> | MouseEvent | TouchEvent) => {
    if ('touches' in event && event.touches.length > 0) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    if ('clientX' in event) {
      return { clientX: event.clientX, clientY: event.clientY };
    }
    return { clientX: 0, clientY: 0 }; 
  }, []);

  const updateContextualToolbarPos = useCallback((line: LineAnnotation | null | undefined) => {
    if (line && svgOverlayRef.current) {
      const svgRect = svgOverlayRef.current.getBoundingClientRect();
      const midX = (line.x1 + line.x2) / 2;
      const midY = (line.y1 + line.y2) / 2;
      
      const toolbarX = Math.max(30, Math.min(midX, svgRect.width - 30)); 
      const toolbarY = Math.max(30, Math.min(midY - 50, svgRect.height - 50)); // Adjusted to position toolbar slightly above the line
      setContextualToolbarPosition({ x: toolbarX, y: toolbarY });
    } else {
      setContextualToolbarPosition(null);
    }
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
    if (!svgOverlayRef.current || draggingPoint || movingLineId) return;
    setActiveTool(null); 

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
    };

    setLines(prevLines => [...prevLines, newLine]);
    setSelectedLineId(newLine.id);
    updateContextualToolbarPos(newLine);
  };

  const handleDraggablePointInteractionStart = (lineId: string, pointType: 'start' | 'end', event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if ('preventDefault' in event) event.preventDefault(); 
    setActiveTool(null);
    setDraggingPoint({ lineId, pointType });
    setSelectedLineId(lineId); 
    // Do not setContextualToolbarPosition(null); here to keep it visible during drag
  };

  const handleInteractionMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!svgOverlayRef.current) return;
    if ('preventDefault' in event) event.preventDefault(); 

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    x = Math.max(0, Math.min(x, svgOverlayRef.current.clientWidth));
    y = Math.max(0, Math.min(y, svgOverlayRef.current.clientHeight));

    if (draggingPoint) {
      setLines(prevLines =>
        prevLines.map(line => {
          if (line.id === draggingPoint.lineId) {
            const updatedLine = draggingPoint.pointType === 'start' ? { ...line, x1: x, y1: y } : { ...line, x2: x, y2: y };
            updateContextualToolbarPos(updatedLine);
            return updatedLine;
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
            const movedLine = {
              ...line,
              x1: Math.max(0, Math.min(lineBeingMovedOriginalState.x1 + dx, svgOverlayRef.current!.clientWidth)),
              y1: Math.max(0, Math.min(lineBeingMovedOriginalState.y1 + dy, svgOverlayRef.current!.clientHeight)),
              x2: Math.max(0, Math.min(lineBeingMovedOriginalState.x2 + dx, svgOverlayRef.current!.clientWidth)),
              y2: Math.max(0, Math.min(lineBeingMovedOriginalState.y2 + dy, svgOverlayRef.current!.clientHeight)),
            };
            updateContextualToolbarPos(movedLine); 
            return movedLine;
          }
          return line;
        })
      );
    }
  }, [draggingPoint, movingLineId, dragStartCoords, lineBeingMovedOriginalState, updateContextualToolbarPos, getNormalizedCoordinates]);

  const handleInteractionEnd = useCallback(() => {
    if (draggingPoint) {
      const line = lines.find(l => l.id === draggingPoint.lineId);
      if (line) updateContextualToolbarPos(line);
      setDraggingPoint(null);
    }
    if (movingLineId) {
      const line = lines.find(l => l.id === movingLineId);
      if (line) updateContextualToolbarPos(line);
      setMovingLineId(null);
      setDragStartCoords(null);
      setLineBeingMovedOriginalState(null);
      setActiveTool(null); 
    }
  }, [draggingPoint, movingLineId, lines, updateContextualToolbarPos]);

  useEffect(() => {
    if (draggingPoint || (movingLineId && dragStartCoords)) {
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
  }, [draggingPoint, movingLineId, dragStartCoords, handleInteractionMove, handleInteractionEnd]);

  
  const handleSelectLine = (lineId: string, event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation(); 
    if (!draggingPoint && !movingLineId && activeTool !== 'move') { 
      setSelectedLineId(lineId); 
      const line = lines.find(l => l.id === lineId);
      updateContextualToolbarPos(line);
    }
  };

  const handleLineHitboxMouseDown = (lineId: string, event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if (activeTool === 'move' && selectedLineId === lineId) {
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
      // Do not setContextualToolbarPosition(null); here to keep it visible during move
    } else if (!draggingPoint && !movingLineId && activeTool !== 'move') {
      setSelectedLineId(lineId);
      const line = lines.find(l => l.id === lineId);
      updateContextualToolbarPos(line);
    }
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

  const handleDeleteSelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
      setActiveTool(null);
    }
  };

  const handleCopySelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      const lineToCopy = lines.find(l => l.id === selectedLineId);
      if (lineToCopy) {
        const newLine: LineAnnotation = {
          ...lineToCopy,
          id: Date.now().toString(),
          x1: lineToCopy.x1 + 10, 
          y1: lineToCopy.y1 + 10,
          x2: lineToCopy.x2 + 10,
          y2: lineToCopy.y2 + 10,
        };
        setLines(prevLines => [...prevLines, newLine]);
        setSelectedLineId(newLine.id); 
        updateContextualToolbarPos(newLine);
        setActiveTool(null);
      }
    }
  };

  const handleRotateSelectedLine = () => {
    if (!selectedLineId || draggingPoint || movingLineId) return;
    const line = lines.find(l => l.id === selectedLineId);
    if (!line) return;

    const cx = (line.x1 + line.x2) / 2;
    const cy = (line.y1 + line.y2) / 2;
    const angleRad = ROTATION_ANGLE_STEP * (Math.PI / 180); 
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    const rotatePoint = (x: number, y: number) => {
      const translatedX = x - cx;
      const translatedY = y - cy;
      const rotatedX = translatedX * cosAngle - translatedY * sinAngle;
      const rotatedY = translatedX * sinAngle + translatedY * cosAngle;
      return { x: rotatedX + cx, y: rotatedY + cy };
    };

    const newP1 = rotatePoint(line.x1, line.y1);
    const newP2 = rotatePoint(line.x2, line.y2);
    
    const svgWidth = svgOverlayRef.current?.clientWidth || Infinity;
    const svgHeight = svgOverlayRef.current?.clientHeight || Infinity;

    const updatedLine = {
      ...line,
      x1: Math.max(0, Math.min(newP1.x, svgWidth)),
      y1: Math.max(0, Math.min(newP1.y, svgHeight)),
      x2: Math.max(0, Math.min(newP2.x, svgWidth)),
      y2: Math.max(0, Math.min(newP2.y, svgHeight)),
    };
    
    setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? updatedLine : l));
    updateContextualToolbarPos(updatedLine);
  };

  const handleToggleMoveTool = () => {
    if (!selectedLineId || draggingPoint || movingLineId) return;
    if (activeTool === 'move') {
      setActiveTool(null);
    } else {
      setActiveTool('move');
    }
  };

  const selectedLine = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);

  const isToolbarButtonDisabled = draggingPoint !== null || movingLineId !== null;
  const isContextualButtonDisabled = draggingPoint !== null || movingLineId !== null || activeTool === 'move';


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
      setContextualToolbarPosition(null);
      setActiveTool(null);
    }
  };

  const svgCursor = useMemo(() => {
    if (movingLineId && dragStartCoords) return 'grabbing';
    if (activeTool === 'move' && selectedLineId) return 'move';
    if (draggingPoint) return 'grabbing';
    return 'default';
  }, [activeTool, selectedLineId, draggingPoint, movingLineId, dragStartCoords]);


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
                Toggle overlay to annotate. Click "+ Line" to add lines. Click lines to select & modify.
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
                    setContextualToolbarPosition(null);
                    setMovingLineId(null);
                    setDragStartCoords(null);
                    setLineBeingMovedOriginalState(null);
                    setActiveTool(null);
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
                        disabled={isToolbarButtonDisabled}
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
                                    disabled={!selectedLineId || isToolbarButtonDisabled || activeTool === 'move'}
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
                                <div className="flex items-center"><ArrowStyleIcon style="none" /><span>No Arrowhead</span></div>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="end">
                                <div className="flex items-center"><ArrowStyleIcon style="end" /><span>Arrowhead on one side</span></div>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="both">
                                <div className="flex items-center"><ArrowStyleIcon style="both" /><span>Arrowhead on both sides</span></div>
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
                            disabled={!selectedLineId || isToolbarButtonDisabled || activeTool === 'move'}
                            aria-label="Line Style Options"
                          >
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
                            <div className="flex items-center"><LineStyleIcon style="solid" /><span>Solid</span></div>
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dashed">
                            <div className="flex items-center"><LineStyleIcon style="dashed" /><span>Dashed</span></div>
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dotted">
                            <div className="flex items-center"><LineStyleIcon style="dotted" /><span>Dotted</span></div>
                        </DropdownMenuRadioItem>
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparatorShadcn />
                      <DropdownMenuLabel>Stroke Weight</DropdownMenuLabel>
                       <div className="px-2 py-1.5">
                         <Slider
                            defaultValue={[DEFAULT_STROKE_WIDTH]}
                            value={[selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH]}
                            onValueChange={handleStrokeWeightChange}
                            min={1}
                            max={10}
                            step={0.5}
                            disabled={!selectedLineId || isToolbarButtonDisabled || activeTool === 'move'}
                          />
                       </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Separator orientation="vertical" className="h-6 mx-1" />

                   <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleDeleteSelectedLine}
                        disabled={!selectedLineId || isToolbarButtonDisabled || activeTool === 'move'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Selected Line</p></TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}
            {selectedLineId && contextualToolbarPosition && isOverlayActive && (
              <TooltipProvider delayDuration={0}>
                <div
                  className="absolute z-30 bg-card border shadow-lg rounded-md p-1 flex items-center space-x-1"
                  style={{
                    left: `${contextualToolbarPosition.x}px`,
                    top: `${contextualToolbarPosition.y}px`,
                    transform: 'translateX(-50%)', 
                  }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className={cn("h-7 w-7", activeTool === 'move' && 'bg-primary/20')} 
                        onClick={handleToggleMoveTool}
                        disabled={isContextualButtonDisabled && activeTool !== 'move'}
                      >
                        <MoveIcon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{activeTool === 'move' ? 'Cancel Move (Click SVG to drop)' : 'Move Line'}</p></TooltipContent>
                  </Tooltip>
                   <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={handleRotateSelectedLine}
                        disabled={isContextualButtonDisabled || activeTool === 'move'}
                        >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Rotate Line (15° CW)</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7" 
                        onClick={handleCopySelectedLine}
                        disabled={isContextualButtonDisabled || activeTool === 'move'}
                        >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Copy Line</p></TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}

            <div className="relative" ref={chartAreaRef}>
              <div className={cn(isOverlayActive && "opacity-30 transition-opacity", (isOverlayActive && (draggingPoint || movingLineId || activeTool)) && "pointer-events-none")}>
                <ChartDisplay
                  data={dummyData}
                  plottableSeries={plottableSeries}
                  yAxisConfigs={yAxisConfigs}
                  timeAxisLabel="Time"
                  plotTitle="" 
                  chartRenderHeight={278 * 0.85} 
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
                    onMouseDown={(e) => {
                      if (activeTool === 'move' && selectedLineId) {
                        handleLineHitboxMouseDown(selectedLineId, e);
                      }
                    }}
                    onTouchStartCapture={(e) => { 
                      if (activeTool === 'move' && selectedLineId) {
                         handleLineHitboxMouseDown(selectedLineId, e as unknown as React.TouchEvent<SVGSVGElement>);
                      }
                    }}
                    style={{ 
                        cursor: svgCursor,
                        pointerEvents: 'auto', 
                        width: chartAreaRef.current.clientWidth, 
                        height: chartAreaRef.current.clientHeight, 
                    }}
                  >
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="6" 
                        markerHeight="4"
                        refX="0" 
                        refY="2" 
                        orient="auto"
                        markerUnits="strokeWidth"
                        fill="currentColor" 
                      >
                        <polygon points="0 0, 6 2, 0 4" /> 
                      </marker>
                    </defs>
                    {lines.map((line) => (
                      <g key={line.id}>
                        <line // Invisible hitbox
                          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                          stroke="transparent"
                          strokeWidth="20" 
                          className={cn("cursor-pointer", activeTool === 'move' && selectedLineId === line.id && "cursor-move")}
                          onClick={(e) => {
                            if (activeTool !== 'move') handleSelectLine(line.id, e);
                          }}
                          onTouchStart={(e) => {
                            if (activeTool !== 'move') handleSelectLine(line.id, e);
                          }}
                          onMouseDown={(e) => handleLineHitboxMouseDown(line.id, e)}
                          onTouchStartCapture={(e) => handleLineHitboxMouseDown(line.id, e)}
                          style={{ pointerEvents: (draggingPoint || (movingLineId && movingLineId !== line.id)) ? 'none' : 'auto' }}
                        />
                        <line // Visible line
                          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                          stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                          strokeWidth={line.strokeWidth || DEFAULT_STROKE_WIDTH} 
                          markerStart={(line.arrowStyle === 'start' || line.arrowStyle === 'both') ? "url(#arrowhead)" : undefined}
                          markerEnd={(line.arrowStyle === 'end' || line.arrowStyle === 'both') ? "url(#arrowhead)" : undefined}
                          strokeDasharray={getStrokeDasharray(line.lineStyle)}
                          style={{ pointerEvents: 'none' }} 
                        />
                        {selectedLineId === line.id && !movingLineId && activeTool !== 'move' && (
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
         {isOverlayActive && selectedLineId && !draggingPoint && !movingLineId && <CardDescription className="text-center text-xs mt-2">Line selected. Use toolbars to modify or drag endpoints to reposition. {activeTool === 'move' && 'Click and drag line to move. Click SVG background to drop.'}</CardDescription>}
         {isOverlayActive && (draggingPoint || (movingLineId && dragStartCoords)) && <CardDescription className="text-center text-xs mt-2">{draggingPoint ? 'Dragging line endpoint...' : 'Moving line...'}</CardDescription>}
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

    

    