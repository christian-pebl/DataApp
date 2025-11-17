"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface HeatmapSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cellWidth: number;
  onCellWidthChange: (width: number) => void;
  cellHeight: number;
  onCellHeightChange: (height: number) => void;
  onSaveSettings?: () => void;
  showSaveButton?: boolean;
}

export function HeatmapSettingsDialog({
  open,
  onOpenChange,
  cellWidth,
  onCellWidthChange,
  cellHeight,
  onCellHeightChange,
  onSaveSettings,
  showSaveButton = false,
}: HeatmapSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Heatmap Settings</DialogTitle>
          <DialogDescription>
            Adjust cell dimensions for the heatmap table
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Cell Width Slider */}
          <div className="space-y-2">
            <Label htmlFor="cell-width-slider" className="text-sm font-medium">
              Cell Width: {cellWidth}px
            </Label>
            <input
              id="cell-width-slider"
              type="range"
              min="5"
              max="150"
              value={cellWidth}
              onChange={(e) => onCellWidthChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>5px (Compact)</span>
              <span>75px (Default)</span>
              <span>150px (Spacious)</span>
            </div>
          </div>

          {/* Cell Height Slider */}
          <div className="space-y-2">
            <Label htmlFor="cell-height-slider" className="text-sm font-medium">
              Cell Height: {cellHeight}px
            </Label>
            <input
              id="cell-height-slider"
              type="range"
              min="10"
              max="100"
              value={cellHeight}
              onChange={(e) => onCellHeightChange(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>10px (Compact)</span>
              <span>50px (Default)</span>
              <span>100px (Spacious)</span>
            </div>
          </div>

          {/* Save Button */}
          {showSaveButton && onSaveSettings && (
            <div className="pt-4 border-t">
              <Button
                onClick={onSaveSettings}
                className="w-full gap-2"
                variant="default"
              >
                <Save className="h-4 w-4" />
                Save as _hapl Style
              </Button>
              <p className="text-xs text-gray-600 mt-2">
                Save these settings to automatically apply them to all _Hapl.csv files
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
