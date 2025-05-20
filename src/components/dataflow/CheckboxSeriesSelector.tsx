
"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ListFilter } from "lucide-react";

interface CheckboxSeriesSelectorProps {
  availableSeries: string[];
  visibleSeries: Record<string, boolean>;
  onSeriesVisibilityChange: (seriesName: string, isVisible: boolean) => void;
  onSelectAllToggle: (selectAll: boolean) => void;
  disabled?: boolean;
}

export function CheckboxSeriesSelector({
  availableSeries,
  visibleSeries,
  onSeriesVisibilityChange,
  onSelectAllToggle,
  disabled = false,
}: CheckboxSeriesSelectorProps) {
  const allSelected = availableSeries.length > 0 && availableSeries.every(series => visibleSeries[series]);
  const someSelected = availableSeries.some(series => visibleSeries[series]);

  const handleMasterCheckboxChange = () => {
    onSelectAllToggle(!allSelected);
  };

  if (availableSeries.length === 0 && !disabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListFilter className="h-6 w-6 text-primary" />
            Select Variables
          </CardTitle>
          <CardDescription>
            No data series available to select. Upload a file first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No variables loaded.</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListFilter className="h-6 w-6 text-primary" />
          Select Variables
        </CardTitle>
        <CardDescription>
          Choose which data series to plot on the chart.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={allSelected}
            onCheckedChange={handleMasterCheckboxChange}
            disabled={disabled || availableSeries.length === 0}
            aria-label={allSelected ? "Deselect all series" : "Select all series"}
          />
          <Label
            htmlFor="select-all"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {allSelected ? "Deselect All" : "Select All"} ({availableSeries.filter(s => visibleSeries[s]).length}/{availableSeries.length})
          </Label>
        </div>
        <ScrollArea className="w-full rounded-md border p-2 max-h-60"> {/* Changed h-60 to max-h-60 */}
          {availableSeries.length > 0 ? (
            availableSeries.map((seriesName) => (
              <div key={seriesName} className="flex items-center space-x-2 py-1">
                <Checkbox
                  id={`series-${seriesName}`}
                  checked={!!visibleSeries[seriesName]}
                  onCheckedChange={(checked) => onSeriesVisibilityChange(seriesName, !!checked)}
                  disabled={disabled}
                />
                <Label
                  htmlFor={`series-${seriesName}`}
                  className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 truncate"
                  title={seriesName}
                >
                  {seriesName}
                </Label>
              </div>
            ))
          ) : (
            <p className="text-sm text-center text-muted-foreground py-4">
              {disabled ? "Upload data to see variables." : "No variables found in the uploaded file."}
            </p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
