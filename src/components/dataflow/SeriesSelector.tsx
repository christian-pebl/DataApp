
"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTree } from "lucide-react"; // Icon for series selection

interface SeriesSelectorProps {
  availableSeries: string[];
  selectedSeries: string | undefined;
  onSeriesChange: (seriesName: string) => void;
  disabled?: boolean;
}

export function SeriesSelector({ availableSeries, selectedSeries, onSeriesChange, disabled = false }: SeriesSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListTree className="h-6 w-6 text-primary" />
          Select Series
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor="series-select" className="sr-only">Select Data Series</Label>
        <Select 
          value={selectedSeries} 
          onValueChange={onSeriesChange}
          disabled={disabled || availableSeries.length === 0}
        >
          <SelectTrigger id="series-select" className="w-full">
            <SelectValue placeholder="Select a data series" />
          </SelectTrigger>
          <SelectContent>
            {availableSeries.length > 0 ? (
              availableSeries.map((seriesName) => (
                <SelectItem key={seriesName} value={seriesName}>
                  {seriesName}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-series" disabled>
                No series available
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
