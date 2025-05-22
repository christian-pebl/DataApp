
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Thermometer, Wind, Cloud, MapPin, CalendarDays, Search } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { subDays, formatISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePickerWithRange } from "@/components/ui/date-picker-with-range";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export const weatherVariables = [
  { value: "temperature", label: "Temperature", icon: Thermometer },
  { value: "windSpeed", label: "Wind Speed", icon: Wind },
  { value: "cloudCover", label: "Cloud Cover", icon: Cloud },
] as const;

type WeatherVariableValue = typeof weatherVariables[number]['value'];

export const weatherControlsSchema = z.object({
  latitude: z.coerce.number().min(-90, "Min -90").max(90, "Max 90"),
  longitude: z.coerce.number().min(-180, "Min -180").max(180, "Max 180"),
  dateRange: z.object({
    from: z.date({ required_error: "Start date is required."}),
    to: z.date({ required_error: "End date is required."}),
  }).refine(data => data.from && data.to && data.from <= data.to, {
    message: "Start date must be before or same as end date.",
    path: ["dateRange"], // Path to show error under dateRange field
  }),
  variable: z.enum(weatherVariables.map(v => v.value) as [WeatherVariableValue, ...WeatherVariableValue[]]),
});

export type WeatherControlsFormValues = z.infer<typeof weatherControlsSchema>;

interface WeatherControlsProps {
  onSubmit: (values: {latitude: number, longitude: number, startDate: string, endDate: string, variable: WeatherVariableValue}) => void;
  isLoading: boolean;
}

export function WeatherControls({ onSubmit, isLoading }: WeatherControlsProps) {
  const form = useForm<WeatherControlsFormValues>({
    resolver: zodResolver(weatherControlsSchema),
    defaultValues: {
      latitude: 34.0522, // Default to Los Angeles
      longitude: -118.2437,
      dateRange: {
        from: subDays(new Date(), 7),
        to: new Date(),
      },
      variable: "temperature",
    },
  });

  function handleSubmit(values: WeatherControlsFormValues) {
    if (!values.dateRange.from || !values.dateRange.to) {
        form.setError("dateRange", { type: "manual", message: "Both start and end dates are required." });
        return;
    }
    onSubmit({
        ...values,
        startDate: formatISO(values.dateRange.from),
        endDate: formatISO(values.dateRange.to),
    });
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader className="p-4">
        <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Weather Data Explorer
        </CardTitle>
        <CardDescription className="text-xs">
          Select a location, date range, and variable to plot weather data.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 34.0522" {...field} disabled={isLoading} className="h-9"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., -118.2437" {...field} disabled={isLoading} className="h-9"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="mb-1">Date Range</FormLabel>
                  <DatePickerWithRange
                    date={field.value as DateRange | undefined}
                    onDateChange={field.onChange}
                    disabled={isLoading}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="variable"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weather Variable</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
                    <FormControl>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select a variable" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {weatherVariables.map((variable) => (
                        <SelectItem key={variable.value} value={variable.value}>
                          <div className="flex items-center gap-2">
                            <variable.icon className="h-4 w-4" />
                            {variable.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Fetch Weather Data
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
