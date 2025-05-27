
"use client";

import React, { useState, useEffect, useRef, useCallback, useId, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label as UiLabel } from "@/components/ui/label";
import { ChartDisplay, type YAxisConfig } from "@/components/dataflow/ChartDisplay";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { LayoutGrid, Waves, SunMoon, FilePenLine, Plus, Ban, PenLine, Spline, MoveRight, Palette, Copy, Trash2, Move as MoveIcon, GripVertical } from "lucide-react"; // Added MoveRight
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { format, addHours, subDays } from 'date-fns';

interface DummyDataPoint {
  time: string;
  temperature?: number;
}

interface LineAnnotation {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  arrowStyle?: 'none' | 'end' | 'both';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  strokeWidth?: number;
  color?: string;
}

const DEFAULT_LINE_COLOR = 'hsl(var(--primary))';
const DEFAULT_STROKE_WIDTH = 1.5; 
const SELECTED_STROKE_WIDTH_OFFSET = 1; 

// Removed TOOLBAR_APPROX_WIDTH_MIN, TOOLBAR_APPROX_HEIGHT, VERTICAL_GAP_TOOLBAR, HORIZONTAL_EDGE_BUFFER, TOOLBAR_OFFSET_FROM_LINE_Y as contextual toolbar is removed.

const CHART_RENDERING_BASE_HEIGHT = 278; 

const LineStyleIcon = ({ style, className }: { style: 'solid' | 'dashed' | 'dotted', className?: string }) => {
  let strokeDasharray;
  if (style === 'dashed') strokeDasharray = "3,2";
  if (style === 'dotted') strokeDasharray = "1,2";
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className={cn("h-4 w-6", className)}> {/* Removed mr-1 */}
      <line x1="2" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" strokeDasharray={strokeDasharray} />
    </svg>
  );
};

const ArrowStyleIcon = ({ style, uniqueId, className }: { style: 'none' | 'end' | 'both', uniqueId: string, className?: string }) => {
  const markerWidth = 3; 
  const markerHeight = 3.5;
  const refY = markerHeight / 2; // Center of the base
  const padding = 2; // Padding from SVG edges
  let x1 = padding;
  let x2 = 24 - padding;

  const endMarkerId = `dropdown-arrow-end-preview-${uniqueId}`;
  const startMarkerId = `dropdown-arrow-start-preview-${uniqueId}`;
  
  // Adjust line ends for markers if style is 'end' or 'both'
  if (style === 'end') { x2 -= markerWidth; } 
  else if (style === 'both') { x1 += markerWidth; x2 -= markerWidth; }


  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className={cn("h-4 w-6", className)}> {/* Removed mr-1 */}
      <defs>
        {/* End marker points right */}
        <marker id={endMarkerId} markerWidth={markerWidth} markerHeight={markerHeight} refX={markerWidth} refY={refY} orient="auto" fill="currentColor"><polygon points={`0 0, ${markerWidth} ${refY}, 0 ${markerHeight}`} /></marker>
        {/* Start marker points left */}
        <marker id={startMarkerId} markerWidth={markerWidth} markerHeight={markerHeight} refX="0" refY={refY} orient="auto-start-reverse" fill="currentColor"><polygon points={`0 0, ${markerWidth} ${refY}, 0 ${markerHeight}`} /></marker>
      </defs>
      <line
        x1={x1} y1="8" x2={x2} y2="8" stroke="currentColor" strokeWidth="2"
        markerStart={style === 'both' ? `url(#${startMarkerId})` : undefined}
        markerEnd={(style === 'end' || style === 'both') ? `url(#${endMarkerId})` : undefined}
      />
    </svg>
  );
};

const ColorSwatch = ({ color, className }: { color: string, className?: string }) => (
  <div className={cn("w-3 h-3 rounded-sm border border-border mr-2 flex-shrink-0", className)} style={{ backgroundColor: color }} />
);


export default function AnnotationPage() {
  const [theme, setTheme] = useState("light");
  const pathname = usePathname();
  const { toast } = useToast();
  const uniqueComponentId = useId();

  const [dummyData, setDummyData] = useState<DummyDataPoint[]>([]);
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(23); 

  const [isOverlayActive, setIsOverlayActive] = useState(false);
  const [lines, setLines] = useState<LineAnnotation[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  const [draggingPoint, setDraggingPoint] = useState<{ lineId: string; pointType: 'start' | 'end' } | null>(null);
  const [movingLineId, setMovingLineId] = useState<string | null>(null); // For moving the whole line
  const [dragStartCoords, setDragStartCoords] = useState<{ x: number; y: number } | null>(null);
  const [lineBeingMovedOriginalState, setLineBeingMovedOriginalState] = useState<LineAnnotation | null>(null);

  // Removed contextual toolbar state: contextualToolbarPosition, isDraggingToolbar, toolbarDragStart, toolbarInitialPosition

  const svgOverlayRef = useRef<SVGSVGElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null); 

  const selectedLine = useMemo(() => lines.find(line => line.id === selectedLineId), [lines, selectedLineId]);

  const getNormalizedCoordinates = useCallback((event: React.MouseEvent | React.TouchEvent<Element> | globalThis.MouseEvent | globalThis.TouchEvent) => {
    let clientX = 0, clientY = 0;
    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    return { clientX, clientY };
  }, []);

  // Removed updateContextualToolbarPos

  useEffect(() => {
    const data: DummyDataPoint[] = [];
    const now = new Date();
    const oneWeekAgo = subDays(now, 7);
    for (let i = 0; i < 7 * 24; i++) { 
      const time = addHours(oneWeekAgo, i);
      data.push({
        time: time.toISOString(),
        temperature: 10 + Math.sin(i / 12) * 5 + Math.random() * 2, 
      });
    }
    setDummyData(data);
  }, []);

  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) setTheme(storedTheme);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
  }, []);

  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  const handleBrushChange = useCallback((newIndex: { startIndex?: number; endIndex?: number }) => {
    setBrushStartIndex(newIndex.startIndex);
    setBrushEndIndex(newIndex.endIndex);
  }, []);

  const handleAddLine = useCallback(() => {
    if (!svgOverlayRef.current) return;
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    const centerX = svgRect.width / 2;
    const centerY = svgRect.height / 2; 
    const defaultLineLength = Math.min(svgRect.width, svgRect.height) * 0.2;

    const newLine: LineAnnotation = {
      id: `${Date.now()}-${uniqueComponentId}-line`,
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
    // No contextual toolbar to position
  }, [uniqueComponentId]);

  const handleSvgBackgroundClick = useCallback((event: React.MouseEvent<SVGElement> | React.TouchEvent<SVGElement>) => {
    if (event.target === svgOverlayRef.current && !draggingPoint && !movingLineId) { // Added !movingLineId
      setSelectedLineId(null);
      // No contextual toolbar to hide
    }
  }, [draggingPoint, movingLineId]);

  // This function now initiates a "whole line move" if clicking an already selected line.
  // If clicking a different line, it selects it and also initiates a move.
  const handleLineHitboxInteractionStart = useCallback((line: LineAnnotation, event: React.MouseEvent<SVGGElement> | React.TouchEvent<SVGGElement>) => {
    event.stopPropagation();
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    if (draggingPoint) return; // Don't interfere if an endpoint drag is already in progress

    setSelectedLineId(line.id); // Always select the clicked line

    // Immediately initiate move for the clicked line
    if (!svgOverlayRef.current) return;
    const { clientX, clientY } = getNormalizedCoordinates(event);
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    setDragStartCoords({ x: clientX - svgRect.left, y: clientY - svgRect.top });
    setLineBeingMovedOriginalState({ ...line });
    setMovingLineId(line.id); 
    // No contextual toolbar to hide
  }, [getNormalizedCoordinates, draggingPoint]);
  
  const handleDraggablePointInteractionStart = useCallback((lineId: string, pointType: 'start' | 'end', event: React.MouseEvent<SVGCircleElement> | React.TouchEvent<SVGCircleElement>) => {
    event.stopPropagation();
    if ('preventDefault' in event && event.type.startsWith('touch')) event.preventDefault();
    if (movingLineId) return; 

    setSelectedLineId(lineId);
    setDraggingPoint({ lineId, pointType });
    // No contextual toolbar to hide
  }, [movingLineId]);

  const handleInteractionMove = useCallback((event: globalThis.MouseEvent | globalThis.TouchEvent) => {
    if (!svgOverlayRef.current) return;
    if ('preventDefault' in event && (draggingPoint || movingLineId)) event.preventDefault();

    const { clientX, clientY } = getNormalizedCoordinates(event);
    const svgRect = svgOverlayRef.current.getBoundingClientRect();
    let svgX = clientX - svgRect.left;
    let svgY = clientY - svgRect.top;

    svgX = Math.max(0, Math.min(svgX, svgRect.width));
    svgY = Math.max(0, Math.min(svgY, svgRect.height));

    if (draggingPoint) {
      setLines(prevLines => prevLines.map(l => {
        if (l.id === draggingPoint.lineId) {
          const updatedLine = draggingPoint.pointType === 'start' ? { ...l, x1: svgX, y1: svgY } : { ...l, x2: svgX, y2: svgY };
          // No contextual toolbar to update position for
          return updatedLine;
        }
        return l;
      }));
    } else if (movingLineId && dragStartCoords && lineBeingMovedOriginalState) {
      const dx = svgX - dragStartCoords.x;
      const dy = svgY - dragStartCoords.y;
      setLines(prevLines => prevLines.map(l => {
        if (l.id === movingLineId) {
          const newX1 = Math.max(0, Math.min(lineBeingMovedOriginalState.x1 + dx, svgRect.width));
          const newY1 = Math.max(0, Math.min(lineBeingMovedOriginalState.y1 + dy, svgRect.height));
          const newX2 = Math.max(0, Math.min(lineBeingMovedOriginalState.x2 + dx, svgRect.width));
          const newY2 = Math.max(0, Math.min(lineBeingMovedOriginalState.y2 + dy, svgRect.height));
          const updatedLine = { ...l, x1: newX1, y1: newY1, x2: newX2, y2: newY2 };
          // No contextual toolbar to update position for
          return updatedLine;
        }
        return l;
      }));
    } 
    // Removed toolbar dragging logic
  }, [draggingPoint, movingLineId, dragStartCoords, lineBeingMovedOriginalState, getNormalizedCoordinates]);

  const handleInteractionEnd = useCallback(() => {
    // No contextual toolbar to reposition
    setDraggingPoint(null);
    setMovingLineId(null);
    setDragStartCoords(null);
    setLineBeingMovedOriginalState(null);
    // Removed toolbar dragging state resets
  }, []);

  useEffect(() => {
    if (draggingPoint || movingLineId) { // Removed isDraggingToolbar
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
  }, [draggingPoint, movingLineId, handleInteractionMove, handleInteractionEnd]); // Removed isDraggingToolbar


  const handleArrowStyleChange = useCallback((style: 'none' | 'end' | 'both') => {
    if (selectedLineId) {
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, arrowStyle: style } : l));
    }
  }, [selectedLineId]);

  const handleLineStyleChange = useCallback((style: 'solid' | 'dashed' | 'dotted') => {
    if (selectedLineId) {
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, lineStyle: style } : l));
    }
  }, [selectedLineId]);
  
  const handleStrokeWeightChange = useCallback((newWeightArray: number[]) => {
    if (selectedLineId) {
      const newWeight = newWeightArray[0];
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, strokeWidth: newWeight } : l));
    }
  }, [selectedLineId]);

  const handleLineColorChange = useCallback((color: string) => {
     if (selectedLineId) {
      setLines(prevLines => prevLines.map(l => l.id === selectedLineId ? { ...l, color: color } : l));
    }
  }, [selectedLineId]);

  const handleCopySelectedLine = useCallback(() => {
    if (!selectedLineId || draggingPoint || movingLineId) return;
    const lineToCopy = lines.find(l => l.id === selectedLineId);
    if (lineToCopy && svgOverlayRef.current) {
        const svgRect = svgOverlayRef.current.getBoundingClientRect();
        let offsetX = 10, offsetY = 10;
        
        let newX1 = lineToCopy.x1 + offsetX;
        let newY1 = lineToCopy.y1 + offsetY;
        let newX2 = lineToCopy.x2 + offsetX;
        let newY2 = lineToCopy.y2 + offsetY;

        if (newX2 > svgRect.width || newX1 < 0 || newY2 > svgRect.height || newY1 < 0) {
            offsetX = -10; offsetY = -10;
            newX1 = lineToCopy.x1 + offsetX; newY1 = lineToCopy.y1 + offsetY;
            newX2 = lineToCopy.x2 + offsetX; newY2 = lineToCopy.y2 + offsetY;
        }
        
        newX1 = Math.max(0, Math.min(newX1, svgRect.width));
        newY1 = Math.max(0, Math.min(newY1, svgRect.height));
        newX2 = Math.max(0, Math.min(newX2, svgRect.width));
        newY2 = Math.max(0, Math.min(newY2, svgRect.height));

        const newCopiedLine: LineAnnotation = {
            ...lineToCopy, 
            id: `${Date.now()}-${uniqueComponentId}-line-copy`,
            x1: newX1, y1: newY1,
            x2: newX2, y2: newY2,
        };
        setLines(prevLines => [...prevLines, newCopiedLine]);
        setSelectedLineId(newCopiedLine.id);
        // No contextual toolbar to position
        toast({ title: "Line Copied", duration: 2000 });
    }
  }, [selectedLineId, lines, uniqueComponentId, toast, draggingPoint, movingLineId]);

  const handleDeleteSelectedLine = useCallback(() => {
    if (selectedLineId && !draggingPoint && !movingLineId) {
      setLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
      setSelectedLineId(null);
      // No contextual toolbar to hide
      toast({ title: "Line Deleted", duration: 2000 });
    }
  }, [selectedLineId, toast, draggingPoint, movingLineId]);

  // Removed handleToolbarDragStart

  const getStrokeDasharray = useCallback((style?: 'solid' | 'dashed' | 'dotted') => {
    switch (style) {
      case 'dashed': return "5,5";
      case 'dotted': return "1,4";
      case 'solid': default: return undefined;
    }
  }, []);

  const anyAnnotationInteractionActive = useMemo(() => 
    !!(draggingPoint || movingLineId), // Removed isDraggingToolbar
  [draggingPoint, movingLineId]);

  const isMainToolbarButtonDisabled = useMemo(() => 
    anyAnnotationInteractionActive, 
  [anyAnnotationInteractionActive]);
  
  // Removed isContextualToolbarButtonDisabled

  const yAxisConfigs: YAxisConfig[] = useMemo(() => [{
    id: 'temp-y-axis',
    orientation: 'left',
    label: 'Temperature',
    color: '--chart-1',
    dataKey: 'temperature',
    unit: '°C'
  }], []);

  const svgCursor = useMemo(() => {
    // Removed isDraggingToolbar condition
    if (movingLineId) return 'grabbing'; 
    if (draggingPoint) return 'grabbing'; 
    if (selectedLineId && !anyAnnotationInteractionActive) return 'move'; 
    return 'default';
  }, [selectedLineId, draggingPoint, movingLineId, anyAnnotationInteractionActive]); // Removed isDraggingToolbar

  const chartDescriptionText = useMemo(() => {
    if (!isOverlayActive) return "Enable 'Annotation Tools' to add annotations.";
    return "Annotation tools active. Click '+ Line' to add. Click a line to select and move it, or drag its endpoints. Use toolbar to edit styles.";
  }, [isOverlayActive]);


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <TooltipProvider>
          <div className="container flex h-full items-center justify-between px-3 md:px-4">
            <Link href="/annotation" passHref>
              <h1 className="text-xl font-sans text-foreground cursor-pointer dark:text-2xl">PEBL data app</h1>
            </Link>
            <div className="flex items-center gap-1">
              <Tooltip><TooltipTrigger asChild><Link href="/data-explorer" passHref><Button variant={pathname === '/data-explorer' ? "secondary": "ghost"} size="icon" aria-label="Data Explorer (CSV)"><LayoutGrid className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Data Explorer (CSV)</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/om-marine-explorer" passHref><Button variant={pathname === '/om-marine-explorer' ? "secondary": "ghost"} size="icon" aria-label="OM Marine Explorer"><Waves className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>OM Marine Explorer</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Link href="/annotation" passHref><Button variant={pathname === '/annotation' ? "secondary": "ghost"} size="icon" aria-label="Annotation Page"><FilePenLine className="h-5 w-5" /></Button></Link></TooltipTrigger><TooltipContent><p>Annotation Page</p></TooltipContent></Tooltip>
              <Separator orientation="vertical" className="h-6 mx-1 text-muted-foreground/50" />
              <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle Theme"><SunMoon className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent><p>Toggle Theme</p></TooltipContent></Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </header>

      <main className="flex-grow container mx-auto p-2 md:p-3 space-y-3">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between p-3">
            <CardTitle className="text-md text-foreground">Annotation Demo - Weekly Temperature</CardTitle>
            <div className="flex items-center space-x-2">
              <UiLabel htmlFor={`annotation-overlay-switch-${uniqueComponentId}`} className="text-sm font-medium text-foreground">Annotation Tools</UiLabel>
              <Switch
                id={`annotation-overlay-switch-${uniqueComponentId}`}
                checked={isOverlayActive}
                onCheckedChange={setIsOverlayActive}
                className="data-[state=unchecked]:bg-input data-[state=unchecked]:border-border data-[state=unchecked]:hover:bg-muted/80"
              />
            </div>
          </CardHeader>
          <CardDescription className="px-3 pb-2 text-xs text-muted-foreground">
            {chartDescriptionText}
          </CardDescription>
          <CardContent className="p-2 pt-0">
            {/* Main Fixed Toolbar - appears when overlay is active */}
            {isOverlayActive && (
              <div className="mb-2 p-1 border rounded-md bg-card flex items-center space-x-1 flex-wrap shadow">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={"outline"}
                        size="sm"
                        className="h-8 px-2"
                        onClick={handleAddLine}
                        disabled={isMainToolbarButtonDisabled}
                        aria-label={"Add Line"}
                      >
                        <Plus className="h-4 w-4 mr-1" /> Line
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Add New Line</p></TooltipContent>
                  </Tooltip>

                  <Separator orientation="vertical" className="h-5 mx-0.5" />
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Style & Thickness Options">
                            {/* Custom SVG icon for line styles */}
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                              <rect y="3" width="16" height="1.5" rx="0.5"/>
                              <rect y="6.25" width="16" height="2.5" rx="0.5"/>
                              <rect y="10.5" width="16" height="3.5" rx="0.5"/>
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-60">
                           <DropdownMenuLabel>Line Style</DropdownMenuLabel>
                           <DropdownMenuSeparatorShadcn />
                           <DropdownMenuRadioGroup value={selectedLine?.lineStyle || 'solid'} onValueChange={(value) => handleLineStyleChange(value as 'solid' | 'dashed' | 'dotted')}>
                            {(['solid', 'dashed', 'dotted'] as const).map(s => 
                                <DropdownMenuRadioItem key={s} value={s} className="text-xs py-1 flex items-center">
                                    <LineStyleIcon style={s} className="mr-2"/> {/* Icon only */}
                                </DropdownMenuRadioItem>
                            )}
                           </DropdownMenuRadioGroup>
                           <DropdownMenuSeparatorShadcn />
                           <DropdownMenuLabel>Stroke Weight</DropdownMenuLabel>
                           <div className="px-2 py-1.5 flex items-center space-x-2">
                                <Slider 
                                  defaultValue={[DEFAULT_STROKE_WIDTH]} 
                                  value={[selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH]} 
                                  onValueChange={handleStrokeWeightChange} 
                                  min={1} max={10} step={0.5} 
                                  disabled={isMainToolbarButtonDisabled || !selectedLineId} 
                                  className="flex-grow" 
                                />
                                <span className="text-xs w-12 text-right tabular-nums">{(selectedLine?.strokeWidth || DEFAULT_STROKE_WIDTH).toFixed(1)}px</span>
                           </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TooltipTrigger>
                    <TooltipContent><p>Line Style & Thickness</p></TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Arrow Style Options">
                                    <MoveRight className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>Arrow Style</DropdownMenuLabel>
                                <DropdownMenuSeparatorShadcn />
                                <DropdownMenuRadioGroup value={selectedLine?.arrowStyle || 'none'} onValueChange={(value) => handleArrowStyleChange(value as 'none' | 'end' | 'both')}>
                                    {[
                                        { value: 'none', label: "No Arrowhead" },
                                        { value: 'end', label: "Arrowhead on one side" },
                                        { value: 'both', label: "Arrowhead on both sides" }
                                    ].map((opt) => 
                                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs py-1 flex items-center">
                                            <ArrowStyleIcon style={opt.value as 'none' | 'end' | 'both'} uniqueId={`${uniqueComponentId}-${opt.value}`} className="mr-2"/>
                                            {opt.label}
                                        </DropdownMenuRadioItem>
                                    )}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TooltipTrigger>
                    <TooltipContent><p>Arrow Style</p></TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Line Color Options">
                                    <Palette className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56">
                                <DropdownMenuLabel>Line Color</DropdownMenuLabel>
                                <DropdownMenuSeparatorShadcn />
                                <DropdownMenuRadioGroup value={selectedLine?.color || DEFAULT_LINE_COLOR} onValueChange={handleLineColorChange}>
                                    {[
                                        { value: 'hsl(var(--primary))', label: "Primary" }, { value: 'hsl(var(--accent))', label: "Accent" },
                                        { value: 'hsl(var(--foreground))', label: "Foreground" }, { value: 'hsl(var(--destructive))', label: "Destructive" },
                                        { value: 'hsl(var(--chart-2))', label: "Chart Color 2" }, { value: 'hsl(var(--chart-3))', label: "Chart Color 3" },
                                    ].map(colorOpt => ( 
                                        <DropdownMenuRadioItem key={colorOpt.value} value={colorOpt.value} className="text-xs flex items-center">
                                            <ColorSwatch color={colorOpt.value} className="mr-2" />{colorOpt.label}
                                        </DropdownMenuRadioItem> 
                                    ))}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TooltipTrigger>
                    <TooltipContent><p>Line Color</p></TooltipContent>
                  </Tooltip>
                  
                  <Separator orientation="vertical" className="h-5 mx-0.5" />

                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCopySelectedLine} disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Copy Line">
                              <Copy className="h-3.5 w-3.5" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Copy Selected Line</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={handleDeleteSelectedLine} disabled={isMainToolbarButtonDisabled || !selectedLineId} aria-label="Delete Selected Line">
                              <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Delete Selected Line</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            <div 
              ref={chartAreaRef} 
              className={cn(
                "relative",
                (anyAnnotationInteractionActive && isOverlayActive) && "opacity-70 pointer-events-none"
              )}
              style={{ height: `${CHART_RENDERING_BASE_HEIGHT * 0.85}px` }}
            >
              <ChartDisplay
                data={dummyData}
                plottableSeries={['temperature']}
                timeAxisLabel="Time"
                plotTitle="Weekly Temperature"
                chartRenderHeight={CHART_RENDERING_BASE_HEIGHT}
                brushStartIndex={brushStartIndex}
                brushEndIndex={brushEndIndex}
                onBrushChange={handleBrushChange}
                yAxisConfigs={yAxisConfigs}
              />
              {isOverlayActive && (
                 <svg
                    ref={svgOverlayRef}
                    width="100%"
                    height="100%"
                    className="absolute top-0 left-0 z-10"
                    onClick={handleSvgBackgroundClick}
                    onTouchStart={handleSvgBackgroundClick}
                    style={{ 
                        cursor: svgCursor,
                        pointerEvents: (isOverlayActive && (anyAnnotationInteractionActive || selectedLineId)) ? 'auto' : 'none'
                    }}
                >
                    <defs>
                        <marker id="arrowheadEnd" markerWidth="3" markerHeight="3.5" refX="3" refY="1.75" orient="auto" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                        <marker id="arrowheadStart" markerWidth="3" markerHeight="3.5" refX="0" refY="1.75" orient="auto-start-reverse" fill="currentColor"><polygon points="0 0, 3 1.75, 0 3.5" /></marker>
                    </defs>
                    {lines.map(line => (
                        <g key={line.id} >
                            <line
                                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                                stroke="transparent"
                                strokeWidth="20" 
                                className={cn(selectedLineId === line.id && !anyAnnotationInteractionActive ? "cursor-move" : "cursor-pointer")}
                                onMouseDown={(e) => { e.stopPropagation(); handleLineHitboxInteractionStart(line, e);}}
                                onTouchStart={(e) => { e.stopPropagation(); handleLineHitboxInteractionStart(line, e as unknown as React.TouchEvent<SVGGElement>);}}
                                style={{ pointerEvents: (anyAnnotationInteractionActive && movingLineId !== line.id && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }}
                            />
                            <line
                                x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                                stroke={selectedLineId === line.id ? "hsl(var(--destructive))" : (line.color || DEFAULT_LINE_COLOR)}
                                strokeWidth={selectedLineId === line.id ? (line.strokeWidth || DEFAULT_STROKE_WIDTH) + SELECTED_STROKE_WIDTH_OFFSET : (line.strokeWidth || DEFAULT_STROKE_WIDTH)}
                                strokeDasharray={getStrokeDasharray(line.lineStyle)}
                                markerStart={(line.arrowStyle === 'start' || line.arrowStyle === 'both') ? "url(#arrowheadStart)" : undefined}
                                markerEnd={(line.arrowStyle === 'end' || line.arrowStyle === 'both') ? "url(#arrowheadEnd)" : undefined}
                                style={{ pointerEvents: 'none' }}
                            />
                            {selectedLineId === line.id && !movingLineId && ( // Removed !isDraggingToolbar as contextual toolbar is gone
                                <>
                                    <circle cx={line.x1} cy={line.y1} r="8" fill="hsl(var(--destructive))" fillOpacity="0.3" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'start', e)} style={{ pointerEvents: (anyAnnotationInteractionActive && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }} />
                                    <circle cx={line.x1} cy={line.y1} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
                                    <circle cx={line.x2} cy={line.y2} r="8" fill="hsl(var(--destructive))" fillOpacity="0.3" className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} onTouchStart={(e) => handleDraggablePointInteractionStart(line.id, 'end', e)} style={{ pointerEvents: (anyAnnotationInteractionActive && draggingPoint?.lineId !== line.id) ? 'none' : 'auto' }} />
                                    <circle cx={line.x2} cy={line.y2} r="3" fill="hsl(var(--background))" stroke="hsl(var(--destructive))" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
                                </>
                            )}
                        </g>
                    ))}
                    {/* Floating Contextual Toolbar Removed */}
                </svg>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="py-2 md:px-3 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-1 md:h-10 md:flex-row">
          <p className="text-balance text-center text-[0.7rem] leading-loose text-muted-foreground">
            PEBL data app - Annotation Page.
          </p>
        </div>
      </footer>
    </div>
  );
}


    