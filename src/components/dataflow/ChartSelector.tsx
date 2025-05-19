
"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChartBig, LineChartIcon, DotIcon } from "lucide-react"; // Using DotIcon for Scatter

interface ChartSelectorProps {
  selectedChartType: string;
  onChartTypeChange: (type: string) => void;
}

const chartTypes = [
  { value: "line", label: "Line Chart", icon: <LineChartIcon className="h-5 w-5 mr-2 text-primary" /> },
  { value: "bar", label: "Bar Chart", icon: <BarChartBig className="h-5 w-5 mr-2 text-primary" /> },
  { value: "scatter", label: "Scatter Plot", icon: <DotIcon className="h-5 w-5 mr-2 text-primary" /> },
];

export function ChartSelector({ selectedChartType, onChartTypeChange }: ChartSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LineChartIcon className="h-6 w-6 text-primary" /> {/* Generic icon for section */}
          Chart Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Label htmlFor="chart-type-select" className="sr-only">Select Chart Type</Label>
        <Select value={selectedChartType} onValueChange={onChartTypeChange}>
          <SelectTrigger id="chart-type-select" className="w-full">
            <SelectValue placeholder="Select chart type" />
          </SelectTrigger>
          <SelectContent>
            {chartTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div className="flex items-center">
                  {type.icon}
                  {type.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
