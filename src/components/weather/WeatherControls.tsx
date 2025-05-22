
"use client";

import React from "react";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { CalendarDays } from "lucide-react";

interface WeatherControlsProps {
  dateRange: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  isLoading: boolean; // Keep isLoading to disable date picker during fetch
}

export function WeatherControls({ dateRange, onDateChange, isLoading }: WeatherControlsProps) {
  return (
    <Card className="w-full shadow-sm border-none"> {/* Removed shadow-lg to be less prominent if inside another card */}
      <CardHeader className="p-0 pt-2"> {/* Reduced padding */}
        {/* Title can be removed if the parent card already has a good title */}
        {/* <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Date Range
        </CardTitle> */}
      </CardHeader>
      <CardContent className="p-0"> {/* Reduced padding */}
          <div className="space-y-2"> {/* Reduced space */}
            <div className="flex flex-col space-y-1">
                <DatePickerWithRange
                    date={dateRange}
                    onDateChange={onDateChange}
                    disabled={isLoading}
                />
                {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && (
                    <p className="text-xs text-destructive px-1">Start date must be before or same as end date.</p>
                )}
            </div>
            {/* Fetch button is now managed in WeatherPage.tsx */}
          </div>
      </CardContent>
    </Card>
  );
}
