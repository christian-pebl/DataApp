
"use client";

import React from "react";
import type { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { CalendarDays } from "lucide-react";

interface WeatherControlsProps {
  dateRange: DateRange | undefined;
  onDateChange: (date: DateRange | undefined) => void;
  // isLoading prop is removed as the button triggering the load is now in the parent
}

export function WeatherControls({ dateRange, onDateChange }: WeatherControlsProps) {
  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-md flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Date Range
        </CardTitle>
        <CardDescription className="text-xs">
          Select start and end dates for weather data.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col space-y-1">
                <DatePickerWithRange
                    date={dateRange}
                    onDateChange={onDateChange}
                    // disabled={isLoading} // Disable if parent indicates loading
                />
                {dateRange?.from && dateRange?.to && dateRange.from > dateRange.to && (
                    <p className="text-xs text-destructive px-1">Start date must be before or same as end date.</p>
                )}
            </div>
            {/* Fetch button removed, functionality moved to parent */}
          </div>
      </CardContent>
    </Card>
  );
}

    