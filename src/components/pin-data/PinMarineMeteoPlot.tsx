"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PinChartDisplay from "@/components/charts/LazyPinChartDisplay";
import type { ParsedDataPoint } from "./csvParser";
import { fetchCombinedDataAction } from "@/app/om-marine-explorer/actions";
import type { CombinedDataPoint } from "@/app/om-marine-explorer/shared";
import { ALL_PARAMETERS } from "@/app/om-marine-explorer/shared";

interface PinMarineMeteoPlotProps {
  instanceId: string;
  location: { lat: number; lon: number };
  locationName: string;
  timeRange: { startDate: string; endDate: string }; // ISO format YYYY-MM-DD
  onRemovePlot?: (id: string) => void;
  timeAxisMode?: 'separate' | 'common';
  globalTimeRange?: { min: Date | null; max: Date | null };
  globalBrushRange?: { startIndex: number; endIndex: number | undefined };
  onDataParsed?: (plotId: string, data: CombinedDataPoint[]) => void;
  onBrushChange?: (brushData: { startIndex?: number; endIndex?: number }) => void;
  isLastPlot?: boolean;
  // Visibility tracking for merge feature
  onVisibilityChange?: (visibleParams: string[], paramColors: Record<string, string>) => void;
  // Initial state for restoring saved views
  initialVisibleParameters?: string[];
  initialParameterColors?: Record<string, string>;
  initialParameterSettings?: Record<string, any>;
}

export function PinMarineMeteoPlot({
  instanceId,
  location,
  locationName,
  timeRange,
  onRemovePlot,
  timeAxisMode,
  globalTimeRange,
  globalBrushRange,
  onDataParsed,
  onBrushChange,
  isLastPlot,
  onVisibilityChange,
  initialVisibleParameters,
  initialParameterColors,
  initialParameterSettings
}: PinMarineMeteoPlotProps) {
  const { toast } = useToast();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marineData, setMarineData] = useState<CombinedDataPoint[] | null>(null);

  // Fetch marine/meteo data on mount - fetch ALL parameters
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchCombinedDataAction({
          latitude: location.lat,
          longitude: location.lon,
          startDate: timeRange.startDate,
          endDate: timeRange.endDate,
          parameters: ALL_PARAMETERS, // Fetch all parameters
        });

        if (result.success && result.data) {
          setMarineData(result.data);

          // Notify parent of parsed data for synchronization
          if (onDataParsed) {
            onDataParsed(instanceId, result.data);
          }

          // Check if there was a date adjustment warning in the logs
          const dateAdjustmentWarning = result.log?.find(
            log => log.status === 'warning' && log.message.includes('Adjusted to')
          );

          if (result.data.length === 0) {
            toast({
              variant: "default",
              title: "No Marine/Meteo Data",
              description: "No data points found for the selected time range.",
              duration: 4000
            });
          } else {
            toast({
              title: "Marine/Meteo Data Loaded",
              description: dateAdjustmentWarning
                ? `${dateAdjustmentWarning.message} Loaded ${result.data.length} data points.`
                : `Loaded ${result.data.length} data points for ${locationName}.`,
              variant: dateAdjustmentWarning ? "default" : "default",
              duration: dateAdjustmentWarning ? 8000 : 3000
            });
          }
        } else {
          const errorMsg = result.error || "Failed to load marine/meteo data.";
          setError(errorMsg);

          // Include helpful log information in error
          const relevantLogs = result.log?.filter(
            log => log.status === 'error' || log.status === 'warning'
          ).map(log => log.message).join('; ') || '';

          toast({
            variant: "destructive",
            title: "Error Loading Marine/Meteo Data",
            description: relevantLogs || errorMsg
          });
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "An unknown error occurred during fetch.";
        setError(errorMsg);
        toast({
          variant: "destructive",
          title: "Critical Fetch Error",
          description: errorMsg
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch on mount

  // Convert CombinedDataPoint[] to ParsedDataPoint[] format for PinChartDisplay
  const parsedData: ParsedDataPoint[] = useMemo(() => {
    if (!marineData) return [];

    return marineData.map(point => {
      // Convert CombinedDataPoint to ParsedDataPoint format
      const parsed: ParsedDataPoint = {
        time: point.time
      };

      // Add all marine/meteo parameters as properties
      if (point.waveHeight !== undefined && point.waveHeight !== null) {
        parsed['Wave Height'] = point.waveHeight;
      }
      if (point.windSpeed10m !== undefined && point.windSpeed10m !== null) {
        parsed['Wind Speed (10m)'] = point.windSpeed10m;
      }
      if (point.windDirection10m !== undefined && point.windDirection10m !== null) {
        parsed['Wind Direction (10m)'] = point.windDirection10m;
      }
      if (point.seaLevelHeightMsl !== undefined && point.seaLevelHeightMsl !== null) {
        parsed['Sea Level (MSL)'] = point.seaLevelHeightMsl;
      }
      if (point.wavePeriod !== undefined && point.wavePeriod !== null) {
        parsed['Wave Period'] = point.wavePeriod;
      }
      if (point.waveDirection !== undefined && point.waveDirection !== null) {
        parsed['Wave Direction'] = point.waveDirection;
      }
      if (point.temperature2m !== undefined && point.temperature2m !== null) {
        parsed['Air Temperature (2m)'] = point.temperature2m;
      }
      if (point.seaSurfaceTemperature !== undefined && point.seaSurfaceTemperature !== null) {
        parsed['Sea Surface Temp (0m)'] = point.seaSurfaceTemperature;
      }
      if (point.ghi !== undefined && point.ghi !== null) {
        parsed['Global Horizontal Irradiance (GHI)'] = point.ghi;
      }

      return parsed;
    });
  }, [marineData]);

  return (
    <Card className="shadow-sm relative">
      {/* Remove button - only show if onRemovePlot is provided */}
      {onRemovePlot && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 z-10"
          onClick={() => onRemovePlot(instanceId)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardContent className="p-3">
        {/* Loading State */}
        {isLoading && !marineData ? (
          <div className="flex items-center justify-center h-[285px]">
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Fetching marine & meteo data...</p>
            </div>
          </div>
        ) : error && !marineData ? (
          /* Error State */
          <div className="flex items-center justify-center h-[285px]">
            <div className="text-center">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
              <p className="text-xs text-destructive font-medium mb-1">Failed to Load Data</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        ) : marineData && parsedData.length > 0 ? (
          /* Data Display - Use PinChartDisplay like GP data */
          <div className="min-h-[285px]">
            <PinChartDisplay
              data={parsedData}
              fileType="GP" // Use GP type for consistent styling
              timeColumn="time"
              showYAxisLabels={true}
              fileName={`Marine & Meteo Data - ${locationName}`}
              dataSource="marine"
              timeAxisMode={timeAxisMode}
              globalTimeRange={globalTimeRange}
              globalBrushRange={globalBrushRange}
              onBrushChange={onBrushChange}
              isLastPlot={isLastPlot}
              onVisibilityChange={onVisibilityChange}
              // Initial state for restoring saved views
              initialVisibleParameters={initialVisibleParameters}
              initialParameterColors={initialParameterColors}
              initialParameterSettings={initialParameterSettings}
            />
          </div>
        ) : (
          /* No Data State */
          <div className="flex items-center justify-center h-[285px] text-center">
            <div>
              <p className="text-xs text-muted-foreground">No data available</p>
              <p className="text-xs text-muted-foreground opacity-70">Try a different time range</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
