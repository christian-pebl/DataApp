"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Filter, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParameterFilterPanelProps {
  parameters: string[];
  sourceFilter: string[];
  dateFilter: string[];
  unitFilter: string[];
  stationFilter: string[];
  onSourceFilterChange: (value: string[]) => void;
  onDateFilterChange: (value: string[]) => void;
  onUnitFilterChange: (value: string[]) => void;
  onStationFilterChange: (value: string[]) => void;
  onClearFilters: () => void;
}

/**
 * ParameterFilterPanel - Filters for 24hr style parameters
 *
 * Provides filtering options based on parameter naming patterns like:
 * "Porpoise (DPM) [2406_2407]" or "Porpoise (DPM) [C_S]"
 *
 * - Source: Porpoise, Dolphin, Sonar (filters by species name)
 * - Unit: DPM, Clicks (filters by measurement unit)
 * - Date: [2406_2407], [2408_2409], etc. (filters by date range)
 * - Station: [C_S], [C_W], [F_L], etc. (filters by station identifier)
 */
export function ParameterFilterPanel({
  parameters,
  sourceFilter,
  dateFilter,
  unitFilter,
  stationFilter,
  onSourceFilterChange,
  onDateFilterChange,
  onUnitFilterChange,
  onStationFilterChange,
  onClearFilters,
}: ParameterFilterPanelProps) {
  // Log parameters for debugging
  React.useEffect(() => {
    console.log('[ParameterFilterPanel] Parameters received:', parameters);
  }, [parameters]);

  // Extract unique sources from parameter names
  const availableSources = React.useMemo(() => {
    const sources = new Set<string>();
    const sourcePatterns = ['Porpoise', 'Dolphin', 'Sonar'];

    parameters.forEach(param => {
      sourcePatterns.forEach(pattern => {
        if (param.toLowerCase().includes(pattern.toLowerCase())) {
          sources.add(pattern);
          console.log(`[ParameterFilterPanel] Found source "${pattern}" in "${param}"`);
        }
      });
    });

    const sourcesArray = Array.from(sources).sort();
    console.log('[ParameterFilterPanel] Available sources:', sourcesArray);
    console.log('[ParameterFilterPanel] Sources count:', sourcesArray.length);
    return sourcesArray;
  }, [parameters]);

  // Extract unique date ranges from parameter names (text in square brackets that matches date pattern)
  const availableDateRanges = React.useMemo(() => {
    const dateRanges = new Set<string>();

    parameters.forEach(param => {
      // Match pattern like [2406_2407] or [2406-2407] or any 4digit_4digit pattern
      const matches = param.match(/\[(\d{4}[_\-]\d{4})\]/g);
      if (matches) {
        matches.forEach(match => {
          // Extract just the date part without brackets
          const dateOnly = match.replace(/[\[\]]/g, '');
          dateRanges.add(dateOnly);
        });
      }
    });

    console.log('[ParameterFilterPanel] Available date ranges:', Array.from(dateRanges));
    console.log('[ParameterFilterPanel] Sample parameters:', parameters.slice(0, 3));
    return Array.from(dateRanges).sort();
  }, [parameters]);

  // Extract unique station identifiers from parameter names (text in square brackets that is NOT a date pattern)
  const availableStations = React.useMemo(() => {
    const stations = new Set<string>();

    parameters.forEach(param => {
      // Match anything in square brackets
      const matches = param.match(/\[([^\]]+)\]/g);
      if (matches) {
        matches.forEach(match => {
          const content = match.replace(/[\[\]]/g, '');
          // Exclude if it matches date pattern (4digit_4digit)
          if (!/^\d{4}[_\-]\d{4}$/.test(content)) {
            stations.add(content);
          }
        });
      }
    });

    console.log('[ParameterFilterPanel] Available stations:', Array.from(stations));
    return Array.from(stations).sort();
  }, [parameters]);

  // Extract unique units from parameter names (DPM, Clicks, etc.)
  const availableUnits = React.useMemo(() => {
    const units = new Set<string>();
    const unitPatterns = ['DPM', 'Clicks'];

    parameters.forEach(param => {
      unitPatterns.forEach(pattern => {
        if (param.includes(`(${pattern})`)) {
          units.add(pattern);
        }
      });
    });

    console.log('[ParameterFilterPanel] Available units:', Array.from(units));
    return Array.from(units).sort();
  }, [parameters]);

  // Check if any filters are active
  const hasActiveFilters = sourceFilter.length > 0 || dateFilter.length > 0 || unitFilter.length > 0 || stationFilter.length > 0;

  // Toggle helper functions for adding/removing items from filter arrays
  const toggleFilter = (currentFilter: string[], value: string, onChange: (value: string[]) => void) => {
    if (currentFilter.includes(value)) {
      onChange(currentFilter.filter(item => item !== value));
    } else {
      onChange([...currentFilter, value]);
    }
  };

  // Debug: Log final filter counts
  React.useEffect(() => {
    console.log('[ParameterFilterPanel] Final Filter Counts:', {
      sources: availableSources.length,
      units: availableUnits.length,
      dateRanges: availableDateRanges.length,
      stations: availableStations.length,
    });
  }, [availableSources, availableUnits, availableDateRanges, availableStations]);

  // If no filter options available, show message
  if (availableSources.length === 0 && availableDateRanges.length === 0 && availableUnits.length === 0 && availableStations.length === 0) {
    console.log('[ParameterFilterPanel] No filter options detected. Parameters:', parameters);
    return (
      <div className="p-1.5 mb-1.5 bg-muted/20 rounded border border-border/30">
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3 text-muted-foreground/50" />
          <Label className="text-[10px] text-muted-foreground italic">No 24hr filters available</Label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-1.5 bg-muted/30 rounded border border-border/40 mb-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <Label className="text-[10px] font-semibold text-foreground uppercase tracking-wide">Filters</Label>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-5 px-1.5 text-[10px]"
          >
            <X className="h-2.5 w-2.5 mr-0.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1">
        {/* Source Filter */}
        {availableSources.length > 0 && (
          <div className="space-y-0.5">
            <Label className="text-[9px] text-muted-foreground" title={`${availableSources.length} sources detected: ${availableSources.join(', ')}`}>
              Source ({availableSources.length})
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-6 text-[10px] px-1.5 justify-between font-normal">
                  <span className="truncate">{sourceFilter.length === 0 ? 'All...' : `${sourceFilter.length} selected`}</span>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {availableSources.map((source) => (
                    <div key={source} className="flex items-center gap-2">
                      <Checkbox
                        id={`source-${source}`}
                        checked={sourceFilter.includes(source)}
                        onCheckedChange={() => toggleFilter(sourceFilter, source, onSourceFilterChange)}
                        className="h-3 w-3"
                      />
                      <Label htmlFor={`source-${source}`} className="text-xs cursor-pointer flex-1">
                        {source}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Unit Filter */}
        {availableUnits.length > 0 && (
          <div className="space-y-0.5">
            <Label className="text-[9px] text-muted-foreground" title={`${availableUnits.length} units detected: ${availableUnits.join(', ')}`}>
              Unit ({availableUnits.length})
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-6 text-[10px] px-1.5 justify-between font-normal">
                  <span className="truncate">{unitFilter.length === 0 ? 'All...' : unitFilter.join(', ')}</span>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {availableUnits.map((unit) => (
                    <div key={unit} className="flex items-center gap-2">
                      <Checkbox
                        id={`unit-${unit}`}
                        checked={unitFilter.includes(unit)}
                        onCheckedChange={() => toggleFilter(unitFilter, unit, onUnitFilterChange)}
                        className="h-3 w-3"
                      />
                      <Label htmlFor={`unit-${unit}`} className="text-xs cursor-pointer flex-1">
                        {unit}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Station Filter */}
        {availableStations.length > 0 && (
          <div className="space-y-0.5">
            <Label className="text-[9px] text-muted-foreground" title={`${availableStations.length} stations detected: ${availableStations.join(', ')}`}>
              Station ({availableStations.length})
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-6 text-[10px] px-1.5 justify-between font-normal">
                  <span className="truncate">{stationFilter.length === 0 ? 'All...' : `${stationFilter.length} selected`}</span>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {availableStations.map((station) => (
                    <div key={station} className="flex items-center gap-2">
                      <Checkbox
                        id={`station-${station}`}
                        checked={stationFilter.includes(station)}
                        onCheckedChange={() => toggleFilter(stationFilter, station, onStationFilterChange)}
                        className="h-3 w-3"
                      />
                      <Label htmlFor={`station-${station}`} className="text-xs cursor-pointer flex-1">
                        [{station}]
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Date Range Filter */}
        {availableDateRanges.length > 0 && (
          <div className="space-y-0.5">
            <Label className="text-[9px] text-muted-foreground" title={`${availableDateRanges.length} time frames detected: ${availableDateRanges.join(', ')}`}>
              Time Frame ({availableDateRanges.length})
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-6 text-[10px] px-1.5 justify-between font-normal">
                  <span className="truncate">{dateFilter.length === 0 ? 'All...' : `${dateFilter.length} selected`}</span>
                  <ChevronDown className="h-3 w-3 opacity-50 ml-1 flex-shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {availableDateRanges.map((dateRange) => (
                    <div key={dateRange} className="flex items-center gap-2">
                      <Checkbox
                        id={`date-${dateRange}`}
                        checked={dateFilter.includes(dateRange)}
                        onCheckedChange={() => toggleFilter(dateFilter, dateRange, onDateFilterChange)}
                        className="h-3 w-3"
                      />
                      <Label htmlFor={`date-${dateRange}`} className="text-xs cursor-pointer flex-1">
                        [{dateRange}]
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
}
