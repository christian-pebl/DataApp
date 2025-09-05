"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PlusCircle, LayoutGrid } from "lucide-react";
import { PinPlotInstance } from "./PinPlotInstance";

interface PlotConfig {
  id: string;
  title: string;
}

interface PinMarineDeviceDataProps {
  fileType: 'GP' | 'FPOD' | 'Subcam';
  files: File[];
  onRequestFileSelection?: () => void; // Callback to open file selector
}

export function PinMarineDeviceData({ fileType, files, onRequestFileSelection }: PinMarineDeviceDataProps) {
  // State for managing plots - exactly like the original Marine Device Data
  const [plots, setPlots] = useState<PlotConfig[]>([]);
  const plotsInitialized = useRef(false);

  // Plot management functions - copied from data-explorer page
  const addPlot = useCallback(() => {
    setPlots((prevPlots) => [
      ...prevPlots,
      { 
        id: `pin-plot-${Date.now()}-${prevPlots.length}`, 
        title: `${fileType} Data Plot ${prevPlots.length + 1}` 
      },
    ]);
  }, [fileType]);

  const removePlot = useCallback((idToRemove: string) => {
    setPlots((prevPlots) => prevPlots.filter((plot) => plot.id !== idToRemove));
  }, []);

  // Initialize with one plot - exactly like the original
  React.useEffect(() => {
    if (!plotsInitialized.current && plots.length === 0) {
      addPlot();
      plotsInitialized.current = true;
    }
  }, [addPlot, plots.length]);

  return (
    <div className="h-full flex flex-col">
      {/* Header - matches the original Marine Device Data header exactly */}
      <CardHeader className="pb-2 pt-3 flex flex-row items-center justify-between flex-shrink-0">
        <div>
          <CardTitle className="text-base flex items-center gap-1.5 font-futura font-semibold">
            Marine Device Data
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {fileType} analysis • {files.length} file{files.length > 1 ? 's' : ''} • {plots.length} plot{plots.length > 1 ? 's' : ''}
          </p>
        </div>
        <Button 
          onClick={() => {
            if (onRequestFileSelection) {
              onRequestFileSelection();
            } else {
              // Fallback to adding plot with current files
              addPlot();
            }
          }} 
          size="sm" 
          className="h-8 text-xs"
          title={onRequestFileSelection ? "Select different files or file types for a new plot" : "Add new plot with current files"}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> 
          {onRequestFileSelection ? "Add New Plot" : "Add New Plot"}
        </Button>
      </CardHeader>

      {/* Content area - matches the original structure */}
      <CardContent className="p-3 flex-1 overflow-hidden">
        {plots.length === 0 ? (
          // Empty state - exactly like the original
          <div className="flex flex-col items-center justify-center text-muted-foreground h-full min-h-40 p-2 border rounded-md bg-muted/20">
            <LayoutGrid className="w-8 h-8 mb-2 text-muted" />
            <p className="text-xs">No device data plots to display.</p>
            <p className="text-[0.7rem]">Click "Add New Plot" to get started.</p>
          </div>
        ) : (
          // Plots container - scrollable like the original
          <div className="space-y-3 h-full overflow-y-auto">
            {plots.map((plot) => (
              <PinPlotInstance
                key={plot.id}
                instanceId={plot.id}
                initialPlotTitle={plot.title}
                onRemovePlot={removePlot}
                fileType={fileType}
                files={files}
              />
            ))}
          </div>
        )}
      </CardContent>
    </div>
  );
}