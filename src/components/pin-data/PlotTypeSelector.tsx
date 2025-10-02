"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Database, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlotTypeSelectorProps {
  onSelectDeviceData: () => void;
  onSelectMarineMeteo: () => void;
  onCancel: () => void;
}

export function PlotTypeSelector({
  onSelectDeviceData,
  onSelectMarineMeteo,
  onCancel
}: PlotTypeSelectorProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99999] pointer-events-auto"
      onClick={onCancel}
    >
      <div
        className="bg-background p-6 rounded-lg shadow-lg max-w-2xl w-full pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-1">Add New Plot</h3>
          <p className="text-sm text-muted-foreground">
            Choose the type of data you want to add to the plot stack
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Device Data Option */}
          <button
            onClick={onSelectDeviceData}
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200",
              "hover:bg-accent/80 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
              "cursor-pointer active:scale-[0.98] text-left"
            )}
          >
            <Database className="h-12 w-12 mb-3 text-primary" />
            <h4 className="font-semibold text-base mb-1">Device Data</h4>
            <p className="text-xs text-muted-foreground text-center">
              Add data from uploaded device files (GP, FPOD, Subcam)
            </p>
          </button>

          {/* Marine & Meteo Data Option */}
          <button
            onClick={onSelectMarineMeteo}
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200",
              "hover:bg-accent/80 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
              "cursor-pointer active:scale-[0.98] text-left"
            )}
          >
            <Waves className="h-12 w-12 mb-3 text-primary" />
            <h4 className="font-semibold text-base mb-1">Marine & Meteo Data</h4>
            <p className="text-xs text-muted-foreground text-center">
              Add marine and meteorological data from API
            </p>
          </button>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
