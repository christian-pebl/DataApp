
"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "lucide-react"; // Or another relevant icon

interface SeriesSelectorProps {
  availableSeries: string[];
  selectedSeries: string | undefined;
  onSeriesSelected: (seriesName: string) => void;
  disabled?: boolean;
}

export function SeriesSelector({
  availableSeries,
  selectedSeries,
  onSeriesSelected,
  disabled = false,
}: SeriesSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart className="h-6 w-6 text-primary" /> {/* Changed icon */}
          Select Variable
        </CardTitle>
        <CardDescription>
          Choose a data series from your file to plot on the chart.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Select
          value={selectedSeries}
          onValueChange={onSeriesSelected}
          disabled={disabled || availableSeries.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a series" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Available Series</SelectLabel>
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
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

    