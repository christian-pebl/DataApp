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
}

interface ProcessedCell extends HaplotypeCellData {
  displayValue: string;
}

export function HaplotypeHeatmap({
  haplotypeData,
  containerHeight,
  rowHeight = 35
}: HaplotypeHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  // Credibility filter state (all enabled by default)
  const [showHigh, setShowHigh] = useState(true);
  const [showModerate, setShowModerate] = useState(true);
  const [showLow, setShowLow] = useState(true);

  // Hide empty rows toggle (enabled by default - hides species with zero values across all sites)
  const [hideEmptyRows, setHideEmptyRows] = useState(true);

  const margin = { top: 20, right: 20, bottom: 80, left: 250 };
  const FILTER_PANEL_HEIGHT = 60;
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
        <div className="flex items-center gap-6 p-3 border rounded-md bg-card shadow-sm">
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
        </div>

        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-2 border rounded-md bg-muted/20">
          No species match the selected filters
        </div>
      </div>
    );
  }

  const { width } = svgDimensions;
  const plotWidth = width > 0 ? width - margin.left - margin.right : 0;

  // Calculate plot height based on number of species and row height
  const plotHeight = filteredSpecies.length * rowHeight;

  const xScale = scaleBand<string>().domain(sites).range([0, plotWidth]).padding(0.05);
  const yScale = scaleBand<string>().domain(filteredSpecies).range([0, plotHeight]).padding(0.05);

  // Helper function to check if species is threatened
  const isThreatened = (redListStatus: string): boolean => {
    const status = redListStatus.toLowerCase();
    return status !== 'not evaluated' && status !== 'na' && status !== '';
  };

  // Helper function to check if species is invasive
  const isInvasive = (nnsValue: string): boolean => {
    return nnsValue !== 'NA' && nnsValue !== '' && nnsValue !== null;
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      {/* Filter Panel */}
      <div className="flex items-center gap-6 p-3 border rounded-md bg-card shadow-sm">
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
        <div className="ml-auto text-xs text-muted-foreground">
          {filteredSpecies.length} species • {sites.length} sites
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
                {/* Y-axis (Species names on left) */}
                <g className="y-axis">
                  {yScale.domain().map(speciesName => (
                    <text
                      key={speciesName}
                      x={-10}
                      y={(yScale(speciesName) ?? 0) + yScale.bandwidth() / 2}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="text-xs fill-current text-muted-foreground"
                      title={speciesName}
                    >
                      {speciesName.length > 35 ? `${speciesName.substring(0, 33)}...` : speciesName}
                    </text>
                  ))}
                </g>

                {/* X-axis (Site names at bottom) */}
                <g className="x-axis" transform={`translate(0, ${plotHeight})`}>
                  {sites.map(site => (
                    <g key={site} transform={`translate(${(xScale(site) ?? 0) + xScale.bandwidth() / 2}, 0)`}>
                      <text
                        transform="rotate(-45)"
                        y={10}
                        x={-5}
                        textAnchor="end"
                        dominantBaseline="middle"
                        className="text-xs fill-current text-muted-foreground"
                      >
                        {site}
                      </text>
                    </g>
                  ))}
                </g>

                {/* Heatmap Cells */}
                <g className="cells">
                  {filteredSpecies.map(species => (
                    <React.Fragment key={species}>
                      {sites.map(site => {
                        const cell = cellMap.get(`${species}__${site}`);
                        const cellValue = cell?.count ?? 0;
                        const fillColor = cellValue > 0 ? colorScale(cellValue) : 'hsl(var(--muted)/0.3)';

                        // Get metadata for badges
                        const metadata = cell?.metadata;
                        const showThreatened = metadata && isThreatened(metadata.redListStatus);
                        const showInvasiveBadge = metadata && isInvasive(metadata.invasiveSpeciesName || 'NA');

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

                                {/* Threatened badge (red T in top-right corner) */}
                                {showThreatened && xScale.bandwidth() > 20 && (
                                  <text
                                    x={xScale.bandwidth() - 4}
                                    y={8}
                                    textAnchor="end"
                                    className="text-[0.6rem] font-bold fill-red-600 pointer-events-none"
                                    style={{ textShadow: '0 0 2px white' }}
                                  >
                                    T
                                  </text>
                                )}

                                {/* Invasive badge (red I in top-left corner) */}
                                {showInvasiveBadge && xScale.bandwidth() > 20 && (
                                  <text
                                    x={4}
                                    y={8}
                                    textAnchor="start"
                                    className="text-[0.6rem] font-bold fill-red-600 pointer-events-none"
                                    style={{ textShadow: '0 0 2px white' }}
                                  >
                                    I
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
