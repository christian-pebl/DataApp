"use client";

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { scaleLinear, scaleBand } from 'd3-scale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HaplotypeCellData, HaplotypeParseResult } from './csvParser';

interface HaplotypeHeatmapProps {
  haplotypeData: HaplotypeParseResult;
  containerHeight: number;
  rowHeight?: number; // Height of each species row (default: 35)
  cellWidth?: number; // Width of each cell/column (default: 85)
  spotSampleStyles?: {
    xAxisLabelRotation?: number;
    xAxisLabelFontSize?: number;
    yAxisLabelFontSize?: number;
    yAxisTitleFontSize?: number;
    yAxisTitleFontWeight?: number | string;
    yAxisTitleAlign?: 'left' | 'center' | 'right';
  };
}

interface ProcessedCell extends HaplotypeCellData {
  displayValue: string;
}

export function HaplotypeHeatmap({
  haplotypeData,
  containerHeight,
  rowHeight = 35,
  cellWidth = 85,
  spotSampleStyles
}: HaplotypeHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  // Extract styling properties with defaults
  const styles = {
    xAxisLabelRotation: spotSampleStyles?.xAxisLabelRotation ?? -45,
    xAxisLabelFontSize: spotSampleStyles?.xAxisLabelFontSize ?? 11,
    yAxisLabelFontSize: spotSampleStyles?.yAxisLabelFontSize ?? 12,
    yAxisTitleFontSize: spotSampleStyles?.yAxisTitleFontSize ?? 14,
    yAxisTitleFontWeight: spotSampleStyles?.yAxisTitleFontWeight ?? 'normal',
    yAxisTitleAlign: spotSampleStyles?.yAxisTitleAlign ?? 'center'
  };

  // Credibility filter state (all enabled by default)
  const [showHigh, setShowHigh] = useState(true);
  const [showModerate, setShowModerate] = useState(true);
  const [showLow, setShowLow] = useState(true);

  // Hide empty rows toggle (enabled by default - hides species with zero values across all sites)
  const [hideEmptyRows, setHideEmptyRows] = useState(true);

  // Hide Red List Status column toggle
  const [showRedListColumn, setShowRedListColumn] = useState(true);

  // Adjustable cell width
  const [adjustableCellWidth, setAdjustableCellWidth] = useState(cellWidth);

  const RED_LIST_COLUMN_WIDTH = 120; // Width for Red List Status column
  const SPECIES_NAME_WIDTH = 200; // Width for Species Name column
  const leftMargin = showRedListColumn ? 350 : (SPECIES_NAME_WIDTH + 20);
  const margin = { top: 120, right: 20, bottom: 20, left: leftMargin };
  const FILTER_PANEL_HEIGHT = 100;
  const heatmapHeight = containerHeight - FILTER_PANEL_HEIGHT;

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      setSvgDimensions({ width, height: heatmapHeight });
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, [heatmapHeight]);

  // Process and filter data
  const { filteredCells, filteredSpecies, sites, maxValue } = useMemo(() => {
    const { data, species, sites } = haplotypeData;

    // Filter species by credibility
    const credibilityFilter = (credibility: string) => {
      const cred = credibility.toUpperCase();
      if (cred === 'HIGH' && !showHigh) return false;
      if (cred === 'MODERATE' && !showModerate) return false;
      if (cred === 'LOW' && !showLow) return false;
      return true;
    };

    // Filter cells based on credibility filters
    const filtered = data.filter(cell =>
      credibilityFilter(cell.metadata.credibility)
    );

    // Get unique filtered species (sorted alphabetically)
    const filteredSpeciesSet = new Set(filtered.map(c => c.species));
    let sortedSpecies = Array.from(filteredSpeciesSet).sort((a, b) =>
      a.localeCompare(b)
    );

    // Filter out empty rows if hideEmptyRows is enabled
    if (hideEmptyRows) {
      sortedSpecies = sortedSpecies.filter(speciesName => {
        // Check if this species has at least one non-zero value across all sites
        const speciesCells = filtered.filter(c => c.species === speciesName);
        return speciesCells.some(c => c.count > 0);
      });
    }

    // Find max value for color scale
    const max = Math.max(...filtered.map(c => c.count), 1);

    return {
      filteredCells: filtered,
      filteredSpecies: sortedSpecies,
      sites,
      maxValue: max
    };
  }, [haplotypeData, showHigh, showModerate, showLow, hideEmptyRows]);

  // Purple gradient color scale (matching your screenshot)
  const colorScale = useMemo(() => {
    return scaleLinear<string>()
      .domain([0, maxValue])
      .range(['#e9d5ff', '#6b21a8']) // Light purple → Dark purple
      .clamp(true);
  }, [maxValue]);

  // Create cell lookup map
  const cellMap = useMemo(() => {
    const map = new Map<string, ProcessedCell>();
    filteredCells.forEach(cell => {
      const key = `${cell.species}__${cell.site}`;
      map.set(key, {
        ...cell,
        displayValue: cell.count > 0 ? cell.count.toString() : '0'
      });
    });
    return map;
  }, [filteredCells]);

  if (!haplotypeData || haplotypeData.species.length === 0) {
    return (
      <div style={{ height: `${containerHeight}px` }} className="flex items-center justify-center text-muted-foreground text-sm p-2 border rounded-md bg-muted/20">
        No haplotype data available
      </div>
    );
  }

  if (filteredSpecies.length === 0) {
    return (
      <div style={{ height: `${containerHeight}px` }} className="flex flex-col gap-4">
        {/* Filter Panel */}
        <div className="flex flex-col gap-3 p-3 border rounded-md bg-card shadow-sm">
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium">Credibility Filters:</span>
            <div className="flex items-center gap-2">
              <Checkbox id="high-empty" checked={showHigh} onCheckedChange={setShowHigh} />
              <Label htmlFor="high-empty" className="text-sm cursor-pointer">High</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="moderate-empty" checked={showModerate} onCheckedChange={setShowModerate} />
              <Label htmlFor="moderate-empty" className="text-sm cursor-pointer">Moderate</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="low-empty" checked={showLow} onCheckedChange={setShowLow} />
              <Label htmlFor="low-empty" className="text-sm cursor-pointer">Low</Label>
            </div>
            <div className="flex items-center gap-2 pl-6 border-l">
              <Checkbox id="hideEmpty-empty" checked={hideEmptyRows} onCheckedChange={setHideEmptyRows} />
              <Label htmlFor="hideEmpty-empty" className="text-sm cursor-pointer">Hide Empty Rows</Label>
            </div>
            <div className="flex items-center gap-2 pl-6 border-l">
              <Checkbox id="showRedList-empty" checked={showRedListColumn} onCheckedChange={setShowRedListColumn} />
              <Label htmlFor="showRedList-empty" className="text-sm cursor-pointer">Show RedList Status</Label>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Label htmlFor="cellWidth-empty" className="text-sm font-medium whitespace-nowrap">Cell Width:</Label>
            <input
              id="cellWidth-empty"
              type="range"
              min="5"
              max="150"
              value={adjustableCellWidth}
              onChange={(e) => setAdjustableCellWidth(Number(e.target.value))}
              className="w-48 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-muted-foreground min-w-[40px]">{adjustableCellWidth}px</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-2 border rounded-md bg-muted/20">
          No species match the selected filters
        </div>
      </div>
    );
  }

  const { width } = svgDimensions;

  // Calculate plot dimensions based on adjustable cell width and row height
  const plotWidth = sites.length * adjustableCellWidth;
  const plotHeight = filteredSpecies.length * rowHeight;

  // Use fixed bandwidth for xScale based on adjustable cellWidth
  const xScale = scaleBand<string>()
    .domain(sites)
    .range([0, plotWidth])
    .paddingInner(0.05)
    .paddingOuter(0.05);

  const yScale = scaleBand<string>()
    .domain(filteredSpecies)
    .range([0, plotHeight])
    .paddingInner(0.05)
    .paddingOuter(0.05);

  // Get Red List Status for a species from the first available cell
  const getRedListStatus = (species: string): string => {
    const cell = filteredCells.find(c => c.species === species);
    return cell?.metadata?.redListStatus || 'Not Evaluated';
  };

  // Shorten Red List Status for display
  const shortenRedListStatus = (status: string): string => {
    const statusMap: Record<string, string> = {
      'Critically Endangered': 'Crit. Endang.',
      'Endangered': 'Endangered',
      'Vulnerable': 'Vulnerable',
      'Near Threatened': 'Near Threat.',
      'Least Concern': 'Least Conc.',
      'Data Deficient': 'Data Defic.',
      'Not Evaluated': 'N/A'
    };
    return statusMap[status] || status;
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* Filter Panel */}
      <div className="flex flex-col gap-3 p-3 border rounded-md bg-card shadow-sm">
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium">Credibility Filters:</span>
          <div className="flex items-center gap-2">
            <Checkbox id="high" checked={showHigh} onCheckedChange={setShowHigh} />
            <Label htmlFor="high" className="text-sm cursor-pointer">High</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="moderate" checked={showModerate} onCheckedChange={setShowModerate} />
            <Label htmlFor="moderate" className="text-sm cursor-pointer">Moderate</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="low" checked={showLow} onCheckedChange={setShowLow} />
            <Label htmlFor="low" className="text-sm cursor-pointer">Low</Label>
          </div>
          <div className="flex items-center gap-2 pl-6 border-l">
            <Checkbox id="hideEmpty" checked={hideEmptyRows} onCheckedChange={setHideEmptyRows} />
            <Label htmlFor="hideEmpty" className="text-sm cursor-pointer">Hide Empty Rows</Label>
          </div>
          <div className="flex items-center gap-2 pl-6 border-l">
            <Checkbox id="showRedList" checked={showRedListColumn} onCheckedChange={setShowRedListColumn} />
            <Label htmlFor="showRedList" className="text-sm cursor-pointer">Show RedList Status</Label>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            {filteredSpecies.length} species • {sites.length} sites
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Label htmlFor="cellWidth" className="text-sm font-medium whitespace-nowrap">Cell Width:</Label>
          <input
            id="cellWidth"
            type="range"
            min="5"
            max="150"
            value={adjustableCellWidth}
            onChange={(e) => setAdjustableCellWidth(Number(e.target.value))}
            className="w-48 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-muted-foreground min-w-[40px]">{adjustableCellWidth}px</span>
        </div>
      </div>

      {/* Heatmap */}
      <div
        ref={containerRef}
        style={{ height: `${heatmapHeight}px` }}
        className="flex-1 w-full border rounded-md p-2 bg-muted/20 overflow-auto"
      >
        <TooltipProvider>
          <svg width="100%" height={Math.max(plotHeight + margin.top + margin.bottom, 400)}>
            {plotWidth > 0 && plotHeight > 0 && (
              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Column Headers */}
                <g className="column-headers">
                  {/* Species Name header */}
                  <text
                    x={-RED_LIST_COLUMN_WIDTH - SPECIES_NAME_WIDTH}
                    y={-10}
                    textAnchor="start"
                    dominantBaseline="middle"
                    className="font-bold"
                    style={{
                      fontSize: `${styles.yAxisLabelFontSize}px`,
                      fill: '#4b5563'
                    }}
                  >
                    Species Name
                  </text>

                  {/* Red List Status header */}
                  {showRedListColumn && (
                    <text
                      x={-RED_LIST_COLUMN_WIDTH + 5}
                      y={-10}
                      textAnchor="start"
                      dominantBaseline="middle"
                      className="font-bold"
                      style={{
                        fontSize: `${styles.yAxisLabelFontSize}px`,
                        fill: '#4b5563'
                      }}
                    >
                      RedList Status
                    </text>
                  )}

                  {/* Sample names (site headers) - 90 degree rotated (vertical) */}
                  {sites.map(site => (
                    <g key={site} transform={`translate(${(xScale(site) ?? 0) + xScale.bandwidth() / 2}, -84)`}>
                      <text
                        transform="rotate(-90)"
                        x={0}
                        y={5}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="font-bold"
                        style={{
                          fontSize: `${styles.yAxisLabelFontSize}px`,
                          fill: '#4b5563'
                        }}
                      >
                        {site}
                      </text>
                    </g>
                  ))}
                </g>

                {/* Y-axis (Species names on left) */}
                <g className="y-axis">
                  {yScale.domain().map(speciesName => (
                    <text
                      key={speciesName}
                      x={-RED_LIST_COLUMN_WIDTH - SPECIES_NAME_WIDTH}
                      y={(yScale(speciesName) ?? 0) + yScale.bandwidth() / 2}
                      textAnchor="start"
                      dominantBaseline="middle"
                      style={{
                        fontSize: `${styles.yAxisLabelFontSize}px`,
                        fontWeight: styles.yAxisTitleFontWeight,
                        fill: '#4b5563'
                      }}
                      title={speciesName}
                    >
                      {speciesName.length > 35 ? `${speciesName.substring(0, 33)}...` : speciesName}
                    </text>
                  ))}
                </g>

                {/* Red List Status column */}
                {showRedListColumn && (
                  <g className="red-list-column" transform={`translate(${-RED_LIST_COLUMN_WIDTH}, 0)`}>
                    {filteredSpecies.map(species => {
                      const redListStatus = getRedListStatus(species);
                      const shortStatus = shortenRedListStatus(redListStatus);
                      const isNotEvaluated = redListStatus === 'Not Evaluated';
                      return (
                        <text
                          key={species}
                          x={5}
                          y={(yScale(species) ?? 0) + yScale.bandwidth() / 2}
                          textAnchor="start"
                          dominantBaseline="middle"
                          style={{
                            fontSize: `${styles.yAxisLabelFontSize}px`,
                            fill: isNotEvaluated ? '#d1d5db' : '#4b5563'
                          }}
                        >
                          {shortStatus}
                        </text>
                      );
                    })}
                  </g>
                )}

                {/* Heatmap Cells */}
                <g className="cells">
                  {filteredSpecies.map(species => (
                    <React.Fragment key={species}>
                      {sites.map(site => {
                        const cell = cellMap.get(`${species}__${site}`);
                        const cellValue = cell?.count ?? 0;
                        const fillColor = cellValue > 0 ? colorScale(cellValue) : 'hsl(var(--muted)/0.3)';

                        // Get metadata for tooltip
                        const metadata = cell?.metadata;

                        return (
                          <Tooltip key={`${species}-${site}`} delayDuration={100}>
                            <TooltipTrigger asChild>
                              <g transform={`translate(${xScale(site)}, ${yScale(species)})`}>
                                {/* Cell background */}
                                <rect
                                  width={xScale.bandwidth()}
                                  height={yScale.bandwidth()}
                                  fill={fillColor}
                                  className="stroke-background/50"
                                  strokeWidth={1}
                                />

                                {/* Cell value (white text) */}
                                {cell && cellValue > 0 && (
                                  <text
                                    x={xScale.bandwidth() / 2}
                                    y={yScale.bandwidth() / 2}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    className="text-xs font-semibold fill-white pointer-events-none"
                                  >
                                    {cell.displayValue}
                                  </text>
                                )}
                              </g>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="font-bold">{species}</p>
                              <p className="text-sm">Site: {site}</p>
                              <p className="text-sm">Haplotype Count: {cellValue}</p>
                              {metadata && (
                                <>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Credibility: <span className="font-semibold">{metadata.credibility}</span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Phylum: {metadata.phylum}
                                  </p>
                                  {metadata.redListStatus !== 'Not Evaluated' && (
                                    <p className="text-xs text-red-600 font-semibold">
                                      Red List: {metadata.redListStatus}
                                    </p>
                                  )}
                                  {metadata.isInvasive && (
                                    <p className="text-xs text-red-600 font-semibold">
                                      Invasive: {metadata.invasiveSpeciesName}
                                    </p>
                                  )}
                                </>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </g>
              </g>
            )}
          </svg>
        </TooltipProvider>
      </div>
    </div>
  );
}
