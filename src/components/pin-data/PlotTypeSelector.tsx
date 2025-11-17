"use client";

import React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Database, Waves, Merge, Copy, Minus, Table } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlotTypeSelectorProps {
  onSelectDeviceData: () => void;
  onSelectMarineMeteo: () => void;
  onSelectMerge?: () => void;
  onSelectSubtract?: () => void;
  onSelectCopyPrevious?: () => void;
  onSelectPresenceAbsence?: () => void;
  onCancel: () => void;
  canMergePlots?: boolean;
  canSubtractPlots?: boolean;
  canCopyPrevious?: boolean;
  canCreatePresenceAbsence?: boolean;
}

export function PlotTypeSelector({
  onSelectDeviceData,
  onSelectMarineMeteo,
  onSelectMerge,
  onSelectSubtract,
  onSelectCopyPrevious,
  onSelectPresenceAbsence,
  onCancel,
  canMergePlots = false,
  canSubtractPlots = false,
  canCopyPrevious = false,
  canCreatePresenceAbsence = false
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

        <div className={cn(
          "grid gap-4 mb-6",
          // Calculate number of columns based on enabled options
          (() => {
            const optionalCount = [canMergePlots, canSubtractPlots, canCopyPrevious, canCreatePresenceAbsence].filter(Boolean).length;
            const totalColumns = 2 + optionalCount; // 2 base (Device, Marine) + optional
            if (totalColumns === 2) return "grid-cols-1 md:grid-cols-2";
            if (totalColumns === 3) return "grid-cols-1 md:grid-cols-3";
            if (totalColumns === 4) return "grid-cols-1 md:grid-cols-4";
            if (totalColumns === 5) return "grid-cols-1 md:grid-cols-5";
            return "grid-cols-1 md:grid-cols-6";
          })()
        )}>
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

          {/* Merge Two Plots Option - Only shown when canMergePlots is true */}
          {canMergePlots && onSelectMerge && (
            <button
              onClick={onSelectMerge}
              className={cn(
                "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200",
                "hover:bg-accent/80 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
                "cursor-pointer active:scale-[0.98] text-left",
                "border-primary/30 bg-primary/5"
              )}
            >
              <Merge className="h-12 w-12 mb-3 text-primary" />
              <h4 className="font-semibold text-base mb-1">Merge Two Plots</h4>
              <p className="text-xs text-muted-foreground text-center">
                Combine selected parameters from first two plots
              </p>
            </button>
          )}

          {/* Subtract Two Plots Option - Only shown when canSubtractPlots is true */}
          {canSubtractPlots && onSelectSubtract && (
            <button
              onClick={onSelectSubtract}
              className={cn(
                "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200",
                "hover:bg-accent/80 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
                "cursor-pointer active:scale-[0.98] text-left",
                "border-orange-500/30 bg-orange-500/5"
              )}
            >
              <Minus className="h-12 w-12 mb-3 text-orange-600 dark:text-orange-500" />
              <h4 className="font-semibold text-base mb-1">Subtract Two Plots</h4>
              <p className="text-xs text-muted-foreground text-center">
                Subtract parameters from first two plots
              </p>
            </button>
          )}

          {/* Copy Previous Plot Option - Only shown when canCopyPrevious is true */}
          {canCopyPrevious && onSelectCopyPrevious && (
            <button
              onClick={onSelectCopyPrevious}
              className={cn(
                "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200",
                "hover:bg-accent/80 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
                "cursor-pointer active:scale-[0.98] text-left",
                "border-green-500/30 bg-green-500/5"
              )}
            >
              <Copy className="h-12 w-12 mb-3 text-green-600 dark:text-green-500" />
              <h4 className="font-semibold text-base mb-1">Copy Previous Plot</h4>
              <p className="text-xs text-muted-foreground text-center">
                Duplicate the plot directly above this one
              </p>
            </button>
          )}

          {/* Presence-Absence Table Option - Only shown when canCreatePresenceAbsence is true */}
          {canCreatePresenceAbsence && onSelectPresenceAbsence && (
            <button
              onClick={onSelectPresenceAbsence}
              className={cn(
                "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all duration-200",
                "hover:bg-accent/80 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50",
                "cursor-pointer active:scale-[0.98] text-left",
                "border-purple-500/30 bg-purple-500/5"
              )}
            >
              <Table className="h-12 w-12 mb-3 text-purple-600 dark:text-purple-500" />
              <h4 className="font-semibold text-base mb-1">Presence-Absence Table</h4>
              <p className="text-xs text-muted-foreground text-center">
                Compare species across HAPL/NMAX files
              </p>
            </button>
          )}
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
