
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
  Trash2, Plus, Copy, Move as MoveIcon, Spline, Palette,
  RotateCcw, GripVertical, MoveRight, Highlighter, CornerUpRight, Ban, PenLine, Minus
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
const CHART_RENDERING_BASE_HEIGHT = 278; // Base height for the chart display area
const DEFAULT_LINE_COLOR = 'hsl(var(--primary))';

// Constants for contextual toolbar
const TOOLBAR_APPROX_HEIGHT = 36; // Approximate height of the toolbar
const TOOLBAR_APPROX_WIDTH = 100; // Approximate width of the toolbar (for 3 buttons)
const VERTICAL_GAP_TOOLBAR = 8; 
const HORIZONTAL_EDGE_BUFFER_TOOLBAR = 8; 
const TOOLBAR_OFFSET_FROM_LINE_Y = 15;


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
  const markerWidth = 3; 
  const padding = 2; 
  let x1 = padding;
  let x2 = 24 - padding;

  if (style === 'end') {
    x2 -= markerWidth;
  } else if (style === 'both') {
    x1 += markerWidth;
    x2 -= markerWidth;
  }

  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="mr-2">
      <defs>
        <marker id="dropdown-arrow-end-preview" markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto" fill="currentColor">
          <polygon points="0 0, 3 1.75, 0 3.5" />
        </marker>
        <marker id="dropdown-arrow-start-preview" markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto-start-reverse" fill="currentColor">
          <polygon points="0 0, 3 1.75, 0 3.5" />
        </marker>
      </defs>
      <line 
        x1={x1}
        y1="8" 
        x2={x2}
        y2="8" 
        stroke="currentColor" 
        strokeWidth="2" 
        markerStart={(style === 'start' || style === 'both') ? "url(#dropdown-arrow-start-preview)" : undefined}
        markerEnd={(style === 'end' || style === 'both') ? "url(#dropdown-arrow-end-preview)" : undefined}
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
  const { toast } = useToast();
  
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(undefined);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(undefined);

  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [isHighlighterToolActive, setIsHighlighterToolActive] = useState(false);
  
  const [lines, setLines] = useState<LineAnnotation[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);
  
  const [draggingPoint, setDraggingPoint] = useState<{ lineId: string; pointType: 'start' | 'end' } | null>(null);
  
  const [movingLineId, setMovingLineId] = useState<string | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [lineBeingMovedOriginalState, setLineBeingMovedOriginalState] = useState<LineAnnotation | null>(null);

  const [contextualToolbarPosition, setContextualToolbarPosition] = useState<{x: number, y: number} | null>(null);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const [toolbarDragStart, setToolbarDragStart] = useState<{ x: number; y: number } | null>(null);
  const [toolbarInitialPosition, setToolbarInitialPosition] = useState<{ x: number; y: number } | null>(null);

  const getNormalizedCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent<Element> | MouseEvent | TouchEvent) => {
    if ('touches' in event && event.touches.length > 0) {
      return { clientX: event.touches[0].clientX, clientY: event.touches[0].clientY };
    }
    if ('clientX' in event) {
      return { clientX: event.clientX, clientY: event.clientY };
    }
    return { clientX: 0, clientY: 0 }; 
  }, []);

  const updateContextualToolbarPos = useCallback((line: LineAnnotation | null) => {
    if (!line || !svgOverlayRef.current) {
      setContextualToolbarPosition(null);
      return;
    }
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const midX = (line.x1 + line.x2) / 2;
    const midY = (line.y1 + line.y2) / 2;

    let toolbarX = midX;
    let toolbarY = midY - TOOLBAR_APPROX_HEIGHT / 2 - TOOLBAR_OFFSET_FROM_LINE_Y; 

    // Clamp Y position
    toolbarY = Math.max(
      TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR, 
      Math.min(toolbarY, svgRect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR)
    );
    
    // Clamp X position
    toolbarX = Math.max(
      TOOLBAR_APPROX_WIDTH / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR,
      Math.min(toolbarX, svgRect.width - TOOLBAR_APPROX_WIDTH / 2 - HORIZONTAL_EDGE_BUFFER_TOOLBAR)
    );
    
    setContextualToolbarPosition({ x: toolbarX, y: toolbarY });
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
    if (storedTheme) setTheme(storedTheme);
    else if (typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const yAxisConfigs: YAxisConfig[] = useMemo(() => [{
    id: 'temp', orientation: 'left', label: 'Temperature (°C)', 
    color: '--chart-1', dataKey: 'temperature', unit: '°C',
  }], []);

  const plottableSeries = useMemo(() => ['temperature'], []);
  const handleBrushChange = (newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  };

  const handleAddLine = () => {
    if (!svgOverlayRef.current || draggingPoint || movingLineId || isDraggingToolbar) return;
    
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
    updateContextualToolbarPos(newLine);
  };
  
  const handleDraggablePointInteractionStart = (lineId: string, pointType: 'start' | 'end', event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation();
    if ('preventDefault' in event) event.preventDefault(); 
    setSelectedLineId(lineId); 
    setDraggingPoint({ lineId, pointType });
  };

  const handleInteractionMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (!svgOverlayRef.current) return;
    
    const isTouchEvent = event.type.startsWith('touch');
    if (isTouchEvent && (draggingPoint || movingLineId || isDraggingToolbar)) {
      if ('preventDefault' in event) event.preventDefault();
    }

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    if (draggingPoint) {
      x = Math.max(0, Math.min(x, rect.width));
      y = Math.max(0, Math.min(y, rect.height));
      let movedLine: LineAnnotation | null = null;
      setLines(prevLines =>
        prevLines.map(line => {
          if (line.id === draggingPoint.lineId) {
            movedLine = draggingPoint.pointType === 'start' ? { ...line, x1: x, y1: y } : { ...line, x2: x, y2: y };
            return movedLine;
          }
          return line;
        })
      );
      if (movedLine) updateContextualToolbarPos(movedLine);
    } else if (movingLineId && dragStartCoords && lineBeingMovedOriginalState) {
      const dx = x - dragStartCoords.x;
      const dy = y - dragStartCoords.y;
      let movedLine: LineAnnotation | null = null;
      setLines(prevLines =>
        prevLines.map(line => {
          if (line.id === movingLineId) {
             movedLine = {
              ...line,
              x1: Math.max(0, Math.min(lineBeingMovedOriginalState.x1 + dx, rect.width)),
              y1: Math.max(0, Math.min(lineBeingMovedOriginalState.y1 + dy, rect.height)),
              x2: Math.max(0, Math.min(lineBeingMovedOriginalState.x2 + dx, rect.width)),
              y2: Math.max(0, Math.min(lineBeingMovedOriginalState.y2 + dy, rect.height)),
            };
            return movedLine;
          }
          return line;
        })
      );
      if (movedLine) updateContextualToolbarPos(movedLine);
    } else if (isDraggingToolbar && toolbarDragStart && toolbarInitialPosition) {
        const dxGlobal = clientX - toolbarDragStart.x;
        const dyGlobal = clientY - toolbarDragStart.y;
        
        let newToolbarX = toolbarInitialPosition.x + dxGlobal;
        let newToolbarY = toolbarInitialPosition.y + dyGlobal;

        newToolbarY = Math.max(
            TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR,
            Math.min(newToolbarY, rect.height - TOOLBAR_APPROX_HEIGHT / 2 - VERTICAL_GAP_TOOLBAR)
        );
        newToolbarX = Math.max(
            TOOLBAR_APPROX_WIDTH / 2 + HORIZONTAL_EDGE_BUFFER_TOOLBAR,
            Math.min(newToolbarX, rect.width - TOOLBAR_APPROX_WIDTH / 2 - HORIZONTAL_EDGE_BUFFER_TOOLBAR)
        );
        
        setContextualToolbarPosition({ x: newToolbarX, y: newToolbarY });
    }
  }, [draggingPoint, movingLineId, dragStartCoords, lineBeingMovedOriginalState, getNormalizedCoordinates, updateContextualToolbarPos, isDraggingToolbar, toolbarDragStart, toolbarInitialPosition]);

  const handleInteractionEnd = useCallback(() => {
    let finalLine: LineAnnotation | null = null;
    if (draggingPoint) {
      finalLine = lines.find(l => l.id === draggingPoint.lineId) || null;
      setDraggingPoint(null);
    }
    if (movingLineId) {
      finalLine = lines.find(l => l.id === movingLineId) || null;
      setMovingLineId(null);
      setDragStartCoords(null);
      setLineBeingMovedOriginalState(null);
    }
    if (isDraggingToolbar) {
        setIsDraggingToolbar(false);
        setToolbarDragStart(null);
        setToolbarInitialPosition(null);
        // Don't return early if a line was also selected, we might still want to update its toolbar pos
    }
    if (finalLine) updateContextualToolbarPos(finalLine);

  }, [draggingPoint, movingLineId, lines, updateContextualToolbarPos, isDraggingToolbar]);

  useEffect(() => {
    const isAnyDragActive = !!(draggingPoint || movingLineId || isDraggingToolbar);
    if (isAnyDragActive) {
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
  }, [draggingPoint, movingLineId, isDraggingToolbar, handleInteractionMove, handleInteractionEnd]);
  
  const handleLineHitboxInteractionStart = (lineId: string, event: React.MouseEvent | React.TouchEvent<Element>) => {
    event.stopPropagation();
    if (draggingPoint || isDraggingToolbar) return; 

    const lineToInteract = lines.find(l => l.id === lineId);
    if (!lineToInteract) return;
    
    if (selectedLineId !== lineId) { // If clicking a new line, select it
      setSelectedLineId(lineId);
      updateContextualToolbarPos(lineToInteract);
    }
    
    // Start moving the whole line
    if (!svgOverlayRef.current) return;
    const { clientX, clientY } = getNormalizedCoordinates(event);
    const rect = svgOverlayRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setMovingLineId(lineId);
    setDragStartCoords({ x, y });
    setLineBeingMovedOriginalState({ ...lineToInteract });
  };

  const handleToolbarDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    event.stopPropagation(); 
    if (!contextualToolbarPosition) return;
    setIsDraggingToolbar(true);
    const { clientX, clientY } = getNormalizedCoordinates(event);
    setToolbarDragStart({ x: clientX, y: clientY });
    setToolbarInitialPosition({ ...contextualToolbarPosition });
  };
  
  const handleArrowStyleChange = (style: 'none' | 'end' | 'both') => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, arrowStyle: style } : line
        )
      );
    }
  };

  const handleLineStyleChange = (style: 'solid' | 'dashed' | 'dotted') => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, lineStyle: style } : line
        )
      );
    }
  };

  const handleStrokeWeightChange = (newWeightArray: number[]) => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      const newWeight = newWeightArray[0];
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, strokeWidth: newWeight } : line
        )
      );
    }
  };

  const handleLineColorChange = (color: string) => {
     if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines =>
        prevLines.map(line =>
          line.id === selectedLineId ? { ...line, color: color } : line
        )
      );
    }
  };

  const handleDeleteSelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      setContextualToolbarPosition(null);
    }
  };

  const handleCopySelectedLine = () => {
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) {
      const lineToCopy = lines.find(l => l.id === selectedLineId);
      if (lineToCopy && svgOverlayRef.current) {
        const svgRect = svgOverlayRef.current.getBoundingClientRect();
        const offsetX = Math.min(20, svgRect.width * 0.05); 
        const offsetY = Math.min(20, svgRect.height * 0.05);

        let newX1 = lineToCopy.x1 + offsetX;
        let newY1 = lineToCopy.y1 + offsetY;
        let newX2 = lineToCopy.x2 + offsetX;
        let newY2 = lineToCopy.y2 + offsetY;
        
        if (newX1 > svgRect.width || newY1 > svgRect.height || newX2 > svgRect.width || newY2 > svgRect.height ||
            newX1 < 0 || newY1 < 0 || newX2 < 0 || newY2 < 0) {
          newX1 = lineToCopy.x1 - offsetX;
          newY1 = lineToCopy.y1 - offsetY;
          newX2 = lineToCopy.x2 - offsetX;
          newY2 = lineToCopy.y2 - offsetY;
        }
        
        const newLine: LineAnnotation = {
          ...lineToCopy,
          id: Date.now().toString(),
          x1: Math.max(0, Math.min(newX1, svgRect.width)),
          y1: Math.max(0, Math.min(newY1, svgRect.height)),
          x2: Math.max(0, Math.min(newX2, svgRect.width)),
          y2: Math.max(0, Math.min(newY2, svgRect.height)),
        };
        setLines(prevLines => [...prevLines, newLine]);
        setSelectedLineId(newLine.id); 
        updateContextualToolbarPos(newLine);
      }
    }
  };

  const selectedLine = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);
  
  const isMainToolbarButtonDisabled = (buttonType?: 'style' | 'color' | 'action') => {
    if (draggingPoint || movingLineId || isDraggingToolbar) return true; 
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
    if (event.target === svgOverlayRef.current && !draggingPoint && !movingLineId && !isDraggingToolbar) {
        setSelectedLineId(null);
        setContextualToolbarPosition(null);
    }
  };

  // This indicates if any annotation drawing/editing tool is active
  const isDrawingToolActive = false; // Placeholder for future tools like freehand drawing
  // This indicates if any line annotation is being actively manipulated (point drag, whole line move, or toolbar drag)
  const anyAnnotationInteractionActive = !!(draggingPoint || movingLineId || isDraggingToolbar);

  const svgCursor = useMemo(() => {
    if (isDraggingToolbar) return 'grabbing';
    if (movingLineId) return 'grabbing';
    if (draggingPoint) return 'grabbing';
    if (selectedLineId && !draggingPoint && !movingLineId && !isDraggingToolbar) return 'move'; 
    return 'default';
  }, [selectedLineId, draggingPoint, movingLineId, isDraggingToolbar]);

  const currentActiveHighlightRange = useMemo(() => 
    isHighlighterToolActive &&
    brushStartIndex !== undefined &&
    brushEndIndex !== undefined &&
    brushStartIndex <= brushEndIndex 
      ? { startIndex: brushStartIndex, endIndex: brushEndIndex }
      : null, 
  [isHighlighterToolActive, brushStartIndex, brushEndIndex]);

  const isContextualToolbarDisabled = isDraggingToolbar || draggingPoint || movingLineId;


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
                Toggle overlay to draw lines or highlight series. Click line to move/edit. Use toolbars to style.
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
                    setContextualToolbarPosition(null);
                    setIsDraggingToolbar(false);
                    setIsHighlighterToolActive(false);
                  }
                }}
              />
              <Label htmlFor="annotation-overlay-switch" className="text-sm">Annotation Tools</Label>
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
                        disabled={isMainToolbarButtonDisabled() || isHighlighterToolActive}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Line
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Add Straight Line</p></TooltipContent>
                  </Tooltip>

                   <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={isHighlighterToolActive ? "secondary" : "outline"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setIsHighlighterToolActive(!isHighlighterToolActive)}
                            disabled={isMainToolbarButtonDisabled()}
                            aria-label="Toggle Data Series Highlighter"
                        >
                            <Highlighter className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Toggle Data Highlighter</p></TooltipContent>
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
                                    disabled={isMainToolbarButtonDisabled('style') || isHighlighterToolActive}
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
                            disabled={isMainToolbarButtonDisabled('style') || isHighlighterToolActive}
                            aria-label="Line Style & Thickness Options"
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
                            <LineStyleIcon style="solid" />
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dashed">
                            <LineStyleIcon style="dashed" />
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="dotted">
                           <LineStyleIcon style="dotted" />
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
                            disabled={isMainToolbarButtonDisabled('style') || isHighlighterToolActive}
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
                            disabled={isMainToolbarButtonDisabled('color') || isHighlighterToolActive}
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

                </div>
              </TooltipProvider>
            )}
            
            <div 
              ref={chartAreaRef} 
              className="relative" 
              style={{ height: `${CHART_RENDERING_BASE_HEIGHT}px` }} // Use full base height for chart area
            >
              <div className={cn(
                (isOverlayActive && !isHighlighterToolActive) && "opacity-30 transition-opacity", 
                anyAnnotationInteractionActive || (isOverlayActive && isHighlighterToolActive) && "pointer-events-none"
              )}>
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
                  activeHighlightRange={currentActiveHighlightRange}
                />
              </div>
              {isOverlayActive && !isHighlighterToolActive && chartAreaRef.current && ( 
                 <svg
                    ref={svgOverlayRef}
                    className="absolute top-0 left-0 w-full h-full z-10" 
                    onClick={handleSvgBackgroundClick}
                    onTouchStart={handleSvgBackgroundClick} 
                    style={{ 
                        cursor: svgCursor,
                        pointerEvents: (isHighlighterToolActive) ? 'none' : ( (anyAnnotationInteractionActive || selectedLineId) ? 'auto' : 'auto' )
                    }}
                  >
                    <defs>
                        <marker id="arrowheadEnd" markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto" fill="currentColor">
                            <polygon points="0 0, 3 1.75, 0 3.5" />
                        </marker>
                        <marker id="arrowheadStart" markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto-start-reverse" fill="currentColor">
                            <polygon points="0 0, 3 1.75, 0 3.5" />
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
                             selectedLineId === line.id && !draggingPoint && !movingLineId && !isDraggingToolbar && "cursor-move"
                          )}
                          onMouseDown={(e) => handleLineHitboxInteractionStart(line.id, e)}
                          onTouchStart={(e) => handleLineHitboxInteractionStart(line.id, e as unknown as React.TouchEvent<SVGLineElement>)}
                          style={{ pointerEvents: (draggingPoint || (movingLineId && movingLineId !== line.id) || isDraggingToolbar) ? 'none' : 'auto' }}
                        />
                        <line // Visible line
                          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                          stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : (line.color || DEFAULT_LINE_COLOR)}
                          strokeWidth={selectedLineId === line.id ? (line.strokeWidth || DEFAULT_STROKE_WIDTH) + SELECTED_STROKE_WIDTH_OFFSET : (line.strokeWidth || DEFAULT_STROKE_WIDTH)} 
                          markerStart={(line.arrowStyle === 'both') ? "url(#arrowheadStart)" : undefined}
                          markerEnd={(line.arrowStyle === 'end' || line.arrowStyle === 'both') ? "url(#arrowheadEnd)" : undefined}
                          strokeDasharray={getStrokeDasharray(line.lineStyle)}
                          style={{ pointerEvents: 'none' }} 
                        />
                        {selectedLineId === line.id && !movingLineId && !isDraggingToolbar && (
                          <>
                            <circle 
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
                            <circle 
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
              {/* Contextual Toolbar */}
              {isOverlayActive && !isHighlighterToolActive && selectedLineId && contextualToolbarPosition && !isDrawingToolActive && (
                  <div
                      className="absolute bg-card border shadow-lg rounded-md p-1 flex items-center space-x-1 z-30"
                      style={{
                          left: `${contextualToolbarPosition.x}px`,
                          top: `${contextualToolbarPosition.y}px`,
                          transform: `translateX(-50%) translateY(-${TOOLBAR_APPROX_HEIGHT / 2 + VERTICAL_GAP_TOOLBAR}px)`,
                          cursor: isDraggingToolbar ? 'grabbing' : 'default',
                      }}
                  >
                      <TooltipProvider delayDuration={100}>
                          <div 
                            className="p-0.5 cursor-grab active:cursor-grabbing"
                            onMouseDown={handleToolbarDragStart}
                            onTouchStart={handleToolbarDragStart}
                          >
                             <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={handleCopySelectedLine}
                                      disabled={isContextualToolbarDisabled}
                                      aria-label="Copy Selected Line"
                                  >
                                      <Copy className="h-3.5 w-3.5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>Copy Line</p></TooltipContent>
                          </Tooltip>

                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={handleDeleteSelectedLine}
                                      disabled={isContextualToolbarDisabled}
                                      aria-label="Delete Selected Line"
                                  >
                                      <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom"><p>Delete Line</p></TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
                  </div>
              )}
            </div>
          </CardContent>
        </Card>
         {isOverlayActive && !isHighlighterToolActive && selectedLineId && !anyAnnotationInteractionActive && <CardDescription className="text-center text-xs mt-2">Line selected. Drag line or endpoints to move/resize. Use main toolbar to style.</CardDescription>}
         {isOverlayActive && !isHighlighterToolActive && anyAnnotationInteractionActive && <CardDescription className="text-center text-xs mt-2">{draggingPoint ? 'Dragging line endpoint...' : (movingLineId ? 'Moving line...' : (isDraggingToolbar ? 'Dragging toolbar...' : 'Drawing...'))}</CardDescription>}
         {isOverlayActive && isHighlighterToolActive && <CardDescription className="text-center text-xs mt-2">Highlighter active. Use the chart slider below to select a range to highlight.</CardDescription>}
         {!isOverlayActive && (lines.length > 0 || currentActiveHighlightRange) && <CardDescription className="text-center text-xs mt-2">Toggle "Annotation Tools" to edit annotations or highlights.</CardDescription>}
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
    

    