"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface RarefactionSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartSize: number;
  onChartSizeChange: (size: number) => void;
  legendXOffset: number;
  onLegendXOffsetChange: (offset: number) => void;
  legendYOffset: number;
  onLegendYOffsetChange: (offset: number) => void;
  yAxisTitleOffset: number;
  onYAxisTitleOffsetChange: (offset: number) => void;
  maxYAxis: number | null;
  onMaxYAxisChange: (value: number | null) => void;
  showLegend: boolean;
  onShowLegendChange: (show: boolean) => void;
  autoMaxYAxis: number;
}

export function RarefactionSettingsDialog({
  open,
  onOpenChange,
  chartSize,
  onChartSizeChange,
  legendXOffset,
  onLegendXOffsetChange,
  legendYOffset,
  onLegendYOffsetChange,
  yAxisTitleOffset,
  onYAxisTitleOffsetChange,
  maxYAxis,
  onMaxYAxisChange,
  showLegend,
  onShowLegendChange,
  autoMaxYAxis,
}: RarefactionSettingsDialogProps) {
  const [pendingMaxYAxis, setPendingMaxYAxis] = useState<number | null>(maxYAxis);

  // Update pending value when dialog opens or maxYAxis changes
  useEffect(() => {
    setPendingMaxYAxis(maxYAxis);
  }, [maxYAxis, open]);

  // Function to round to neat numbers
  const roundToNeatNumber = (value: number): number => {
    if (value <= 0) return 5;

    // Find the appropriate rounding increment based on value magnitude
    let increment: number;
    if (value <= 20) increment = 5;
    else if (value <= 50) increment = 10;
    else if (value <= 100) increment = 20;
    else if (value <= 200) increment = 50;
    else increment = 100;

    return Math.ceil(value / increment) * increment;
  };

  const handleConfirmMaxYAxis = () => {
    if (pendingMaxYAxis !== null) {
      const neatValue = roundToNeatNumber(pendingMaxYAxis);
      onMaxYAxisChange(neatValue);
      setPendingMaxYAxis(neatValue);
    }
  };

  const handleResetMaxYAxis = () => {
    onMaxYAxisChange(null);
    setPendingMaxYAxis(null);
  };

  // Chart size notches
  const chartSizeNotches = [100, 200, 250, 300, 400];

  const snapToNearestNotch = (value: number): number => {
    return chartSizeNotches.reduce((prev, curr) =>
      Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
    );
  };

  const handleChartSizeChange = (value: number) => {
    const snapped = snapToNearestNotch(value);
    onChartSizeChange(snapped);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Plot Settings</DialogTitle>
          <DialogDescription>
            Adjust visual settings for the rarefaction curve plot
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">

          {/* Chart Size Slider */}
          <div className="space-y-2">
            <Label htmlFor="chart-size-slider" className="text-sm font-medium">
              Chart Size: {chartSize}px
            </Label>
            <input
              id="chart-size-slider"
              type="range"
              min="100"
              max="400"
              list="chart-size-notches"
              value={chartSize}
              onChange={(e) => handleChartSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <datalist id="chart-size-notches">
              {chartSizeNotches.map((notch) => (
                <option key={notch} value={notch} />
              ))}
            </datalist>
            <div className="flex justify-between text-xs text-gray-500">
              <span>100px</span>
              <span>200px</span>
              <span>250px</span>
              <span>300px</span>
              <span>400px</span>
            </div>
          </div>

          {/* Show Legend Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="show-legend"
              checked={showLegend}
              onCheckedChange={onShowLegendChange}
            />
            <Label
              htmlFor="show-legend"
              className="text-sm font-medium cursor-pointer"
            >
              Show Legend
            </Label>
          </div>

          {/* Legend X Offset Slider */}
          <div className="space-y-2">
            <Label htmlFor="legend-x-offset" className="text-sm font-medium">
              Legend X Offset: {legendXOffset}px
            </Label>
            <input
              id="legend-x-offset"
              type="range"
              min="-50"
              max="100"
              value={legendXOffset}
              onChange={(e) => onLegendXOffsetChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-50px</span>
              <span>100px</span>
            </div>
          </div>

          {/* Legend Y Offset Slider */}
          <div className="space-y-2">
            <Label htmlFor="legend-y-offset" className="text-sm font-medium">
              Legend Y Offset: {legendYOffset}px
            </Label>
            <input
              id="legend-y-offset"
              type="range"
              min="-50"
              max="100"
              value={legendYOffset}
              onChange={(e) => onLegendYOffsetChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-50px</span>
              <span>100px</span>
            </div>
          </div>

          {/* Y-Axis Title Offset Slider */}
          <div className="space-y-2">
            <Label htmlFor="yaxis-title-offset" className="text-sm font-medium">
              Y-Axis Title Offset: {yAxisTitleOffset}px
            </Label>
            <input
              id="yaxis-title-offset"
              type="range"
              min="-20"
              max="20"
              value={yAxisTitleOffset}
              onChange={(e) => onYAxisTitleOffsetChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>-20px</span>
              <span>20px</span>
            </div>
          </div>

          {/* Max Y-Axis Value */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="max-y-axis" className="text-sm font-medium">
                Max Y-Axis: {maxYAxis !== null ? maxYAxis : `Auto (${autoMaxYAxis})`}
              </Label>
              <button
                onClick={handleResetMaxYAxis}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Reset to Auto
              </button>
            </div>
            <div className="flex gap-2">
              <input
                id="max-y-axis"
                type="number"
                min={10}
                max={500}
                value={pendingMaxYAxis !== null ? pendingMaxYAxis : autoMaxYAxis}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPendingMaxYAxis(val > 0 ? val : autoMaxYAxis);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmMaxYAxis();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button
                onClick={handleConfirmMaxYAxis}
                disabled={pendingMaxYAxis === maxYAxis}
                className="px-4 py-2 text-sm"
                size="sm"
              >
                Apply
              </Button>
            </div>
            <p className="text-xs text-gray-600">
              Enter value and click Apply. Value will be rounded to neat number (5, 10, 20, 50, 100...)
            </p>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
