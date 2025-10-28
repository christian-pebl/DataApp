"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart3, TableIcon, Settings } from "lucide-react";
import type { ParsedDataPoint } from './csvParser';
import { groupBySampleAndDate, type SpotSampleGroup } from '@/lib/statistical-utils';
import { ColumnChartWithErrorBars } from './ColumnChartWithErrorBars';
import { WhiskerPlot } from './WhiskerPlot';
import { StackedCredibilityChart } from './StackedCredibilityChart';
import { StackedTaxonomyChart } from './StackedTaxonomyChart';
import { format, parseISO } from 'date-fns';
import { DEFAULT_STYLE_RULES, STYLE_RULES_VERSION, type StyleRule, type StyleProperties, StylingRulesDialog } from './StylingRulesDialog';
import { isEdnaMetaFile, extractProjectPrefix, abbreviateStationLabel } from '@/lib/edna-utils';
import { isCredFile, processCredibilityFile } from '@/lib/edna-cred-processor';
import { isTaxonomyFile, processTaxonomyFile } from '@/lib/edna-taxonomy-processor';

interface PinChartDisplaySpotSampleProps {
  data: ParsedDataPoint[];
  timeColumn: string | null;
  detectedSampleIdColumn: string | null;
  headers: string[];
  fileName?: string;
  diagnosticLogs?: string[];
}

// Default color palette for sample IDs
const DEFAULT_COLOR_PALETTE = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#f43f5e', // Rose
];

/**
 * Spot-Sample Plotting Component
 * Handles discrete sampling data (CROP, CHEM, WQ, EDNA files)
 * Displays column charts with error bars or whisker plots
 */
export function PinChartDisplaySpotSample({
  data,
  timeColumn,
  detectedSampleIdColumn,
  headers,
  fileName,
  diagnosticLogs
}: PinChartDisplaySpotSampleProps) {

  // IMMEDIATE DIAGNOSTIC LOGGING - runs before any processing
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SPOT-SAMPLE COMPONENT ENTRY                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('[SPOT-SAMPLE-ENTRY] fileName:', fileName);
  console.log('[SPOT-SAMPLE-ENTRY] data exists:', !!data);
  console.log('[SPOT-SAMPLE-ENTRY] data length:', data?.length);
  console.log('[SPOT-SAMPLE-ENTRY] data sample:', data?.slice(0, 2));
  console.log('[SPOT-SAMPLE-ENTRY] First row full structure:', data?.[0]);
  console.log('[SPOT-SAMPLE-ENTRY] First row Date value:', data?.[0]?.['Date'], 'Type:', typeof data?.[0]?.['Date']);
  console.log('[SPOT-SAMPLE-ENTRY] First row Sample value:', data?.[0]?.['Sample'], 'Type:', typeof data?.[0]?.['Sample']);
  console.log('[SPOT-SAMPLE-ENTRY] First row C (% m/m) value:', data?.[0]?.['C (% m/m)'], 'Type:', typeof data?.[0]?.['C (% m/m)']);
  console.log('[SPOT-SAMPLE-ENTRY] timeColumn:', timeColumn);
  console.log('[SPOT-SAMPLE-ENTRY] detectedSampleIdColumn:', detectedSampleIdColumn);
  console.log('[SPOT-SAMPLE-ENTRY] headers exists:', !!headers);
  console.log('[SPOT-SAMPLE-ENTRY] headers:', headers);
  console.log('═══════════════════════════════════════════════════════════════');

  // State
  const [showTable, setShowTable] = useState(false);

  // Default to whisker chart for _indiv files, column chart for others
  const defaultChartType = fileName?.toLowerCase().endsWith('_indiv.csv') ? 'whisker' : 'column';
  const [chartType, setChartType] = useState<'column' | 'whisker'>(defaultChartType);

  const [selectedSampleIdColumn, setSelectedSampleIdColumn] = useState<string | null>(
    detectedSampleIdColumn
  );
  const [showStylingDialog, setShowStylingDialog] = useState(false);

  // Column chart color mode: 'unique' = different color per sample, 'single' = same color for all
  // Initialize with defaults, will be updated by useEffect when spotSampleStyles is available
  const [columnColorMode, setColumnColorMode] = useState<'unique' | 'single'>('single');
  const [singleColumnColor, setSingleColumnColor] = useState('#3b82f6');

  // Parameter visibility state - default to showing first 2 parameters
  const [visibleParameters, setVisibleParameters] = useState<Set<string>>(() => new Set());

  // Parameter-specific Y-axis ranges (for CHEMWQ files)
  // Initialize with empty object, will be updated by useEffect when spotSampleStyles is available
  const [parameterYAxisRanges, setParameterYAxisRanges] = useState<Record<string, { min?: number; max?: number }>>({});
  const [yAxisDialogOpen, setYAxisDialogOpen] = useState<string | null>(null); // Track which parameter dialog is open
  const [tempYAxisMin, setTempYAxisMin] = useState<string>('');
  const [tempYAxisMax, setTempYAxisMax] = useState<string>('');

  // Load style rules from localStorage (with versioning)
  const [styleRules, setStyleRules] = useState<StyleRule[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_STYLE_RULES;

    try {
      const storedRules = localStorage.getItem('styleRules');
      const storedVersion = localStorage.getItem('styleRulesVersion');

      if (storedRules && storedVersion === String(STYLE_RULES_VERSION)) {
        return JSON.parse(storedRules);
      } else {
        // Version mismatch or no stored version - use defaults
        localStorage.setItem('styleRules', JSON.stringify(DEFAULT_STYLE_RULES));
        localStorage.setItem('styleRulesVersion', String(STYLE_RULES_VERSION));
        return DEFAULT_STYLE_RULES;
      }
    } catch (error) {
      console.error('[SPOT-SAMPLE] Failed to load style rules from localStorage:', error);
      return DEFAULT_STYLE_RULES;
    }
  });

  // Find matching style rule based on fileName
  const matchingStyleRule = useMemo(() => {
    if (!fileName) return null;

    // Find first enabled rule that matches the filename suffix
    const rule = styleRules.find(rule =>
      rule.enabled && fileName.toLowerCase().endsWith(rule.suffix.toLowerCase())
    );

    if (rule) {
      console.log('[SPOT-SAMPLE] Found matching style rule:', rule.styleName, 'for file:', fileName);
      console.log('[SPOT-SAMPLE] Spot sample styles:', rule.properties.spotSample);
    } else {
      console.log('[SPOT-SAMPLE] No matching style rule found for file:', fileName);
    }

    return rule;
  }, [fileName, styleRules]);

  // Get matching suffix for style updates
  const matchingSuffix = matchingStyleRule?.suffix;

  // Extract spot sample styles from matching rule (needs to be after matchingStyleRule)
  const spotSampleStyles = React.useMemo(() => {
    return matchingStyleRule?.properties.spotSample;
  }, [matchingStyleRule]);

  // Update color settings when style rules change
  React.useEffect(() => {
    if (spotSampleStyles?.columnColorMode) {
      setColumnColorMode(spotSampleStyles.columnColorMode);
    }
    if (spotSampleStyles?.singleColumnColor) {
      setSingleColumnColor(spotSampleStyles.singleColumnColor);
    }
    if (spotSampleStyles?.parameterYAxisRanges) {
      setParameterYAxisRanges(spotSampleStyles.parameterYAxisRanges);
    }
  }, [spotSampleStyles]);

  // Detect and process _Cred files
  const isCredibilityFile = useMemo(() => {
    const result = fileName ? isCredFile(fileName) : false;
    console.log('[SPOT-SAMPLE] 🔍 Credibility file detection:', {
      fileName,
      isCredFile: result
    });
    return result;
  }, [fileName]);

  const credibilityData = useMemo(() => {
    if (!isCredibilityFile) {
      console.log('[SPOT-SAMPLE] ⏭️  Not a credibility file, skipping _Cred processing');
      return null;
    }

    console.log('[SPOT-SAMPLE] 📊 Processing _Cred file:', fileName);
    console.log('[SPOT-SAMPLE]   - Data rows:', data.length);
    console.log('[SPOT-SAMPLE]   - Headers:', headers);
    console.log('[SPOT-SAMPLE]   - Sample first row:', data[0]);

    const { aggregated, skippedCount } = processCredibilityFile(data, headers);

    console.log('[SPOT-SAMPLE] ✅ _Cred processing complete:', {
      aggregated,
      skippedCount,
      totalUniqueSpecies: aggregated.totalUniqueSpecies
    });

    if (skippedCount > 0) {
      console.warn(`[SPOT-SAMPLE] ⚠️  Skipped ${skippedCount} invalid rows in _Cred file`);
    }

    return aggregated;
  }, [isCredibilityFile, data, headers, fileName]);

  // Detect and process _taxo files
  const isTaxonomyFileDetected = useMemo(() => {
    const result = fileName ? isTaxonomyFile(fileName) : false;
    console.log('[SPOT-SAMPLE] 🔍 Taxonomy file detection:', {
      fileName,
      isTaxonomyFile: result
    });
    return result;
  }, [fileName]);

  const taxonomyData = useMemo(() => {
    if (!isTaxonomyFileDetected) {
      console.log('[SPOT-SAMPLE] ⏭️  Not a taxonomy file, skipping _taxo processing');
      return null;
    }

    console.log('[SPOT-SAMPLE] 📊 Processing _taxo file:', fileName);
    console.log('[SPOT-SAMPLE]   - Data rows:', data.length);
    console.log('[SPOT-SAMPLE]   - Headers:', headers);
    console.log('[SPOT-SAMPLE]   - Sample first row:', data[0]);

    const { aggregated, skippedCount } = processTaxonomyFile(data, headers);

    console.log('[SPOT-SAMPLE] ✅ _taxo processing complete:', {
      aggregated,
      skippedCount,
      totalSamples: aggregated.samples.length,
      totalPhyla: aggregated.allPhyla.length
    });

    if (skippedCount > 0) {
      console.warn(`[SPOT-SAMPLE] ⚠️  Skipped ${skippedCount} invalid rows in _taxo file`);
    }

    return aggregated;
  }, [isTaxonomyFileDetected, data, headers, fileName]);

  // Styling dialog handlers
  const handleStyleRuleToggle = (suffix: string, enabled: boolean) => {
    const updatedRules = styleRules.map(rule =>
      rule.suffix === suffix ? { ...rule, enabled } : rule
    );
    setStyleRules(updatedRules);
    localStorage.setItem('styleRules', JSON.stringify(updatedRules));
    console.log('[SPOT-SAMPLE] Style rule toggled:', suffix, enabled);
  };

  const handleStyleRuleUpdate = (suffix: string, properties: Partial<StyleProperties>) => {
    const updatedRules = styleRules.map(rule => {
      if (rule.suffix !== suffix) return rule;

      // Deep merge spotSample properties if they exist
      const updatedProperties = { ...rule.properties };
      if (properties.spotSample && rule.properties.spotSample) {
        updatedProperties.spotSample = {
          ...rule.properties.spotSample,
          ...properties.spotSample
        };
      } else if (properties.spotSample) {
        updatedProperties.spotSample = properties.spotSample;
      }

      // Merge other top-level properties
      Object.keys(properties).forEach(key => {
        if (key !== 'spotSample') {
          updatedProperties[key as keyof StyleProperties] = properties[key as keyof StyleProperties] as any;
        }
      });

      return { ...rule, properties: updatedProperties };
    });

    setStyleRules(updatedRules);
    localStorage.setItem('styleRules', JSON.stringify(updatedRules));
    console.log('[SPOT-SAMPLE] Style rule updated:', suffix, properties);
  };

  // Color mode change handler - updates state and persists to style rules
  const handleColumnColorModeChange = (mode: 'unique' | 'single') => {
    setColumnColorMode(mode);

    // Find matching style rule and update it
    if (matchingSuffix) {
      handleStyleRuleUpdate(matchingSuffix, {
        spotSample: { columnColorMode: mode }
      });
    }
    console.log('[SPOT-SAMPLE] Column color mode changed:', mode);
  };

  // Single column color change handler - updates state and persists to style rules
  const handleSingleColumnColorChange = (color: string) => {
    setSingleColumnColor(color);

    // Find matching style rule and update it
    if (matchingSuffix) {
      handleStyleRuleUpdate(matchingSuffix, {
        spotSample: { singleColumnColor: color }
      });
    }
    console.log('[SPOT-SAMPLE] Single column color changed:', color);
  };

  // Parameter Y-axis range change handler - updates state and persists to style rules
  const handleParameterYAxisRangeChange = (parameter: string, min?: number, max?: number) => {
    const updatedRanges = {
      ...parameterYAxisRanges,
      [parameter]: { min, max }
    };
    setParameterYAxisRanges(updatedRanges);

    // Find matching style rule and update it
    if (matchingSuffix) {
      handleStyleRuleUpdate(matchingSuffix, {
        spotSample: { parameterYAxisRanges: updatedRanges }
      });
    }
    console.log('[SPOT-SAMPLE] Parameter Y-axis range changed:', parameter, { min, max });
  };

  // Sample color change handler - updates custom sample colors in style rules
  const handleSampleColorChange = (sampleId: string, color: string) => {
    // Get current custom colors from style rules
    const currentCustomColors = spotSampleStyles?.sampleColors || {};
    const updatedColors = {
      ...currentCustomColors,
      [sampleId]: color
    };

    // Find matching style rule and update it
    if (matchingSuffix) {
      handleStyleRuleUpdate(matchingSuffix, {
        spotSample: { sampleColors: updatedColors }
      });
    }
    console.log('[SPOT-SAMPLE] Sample color changed:', sampleId, color);
  };

  // Get actual sample ID column (user selection or detected)
  const sampleIdColumn = selectedSampleIdColumn || detectedSampleIdColumn;

  // Detect Station ID column for _indiv files
  // The "station ID" column contains the full station identifier (e.g., "1-NE-3", "2-SW-1")
  // This is what we want to display in x-axis labels
  const stationIdColumn = useMemo(() => {
    console.log('[SPOT-SAMPLE] Searching for Station ID column in headers:', headers);

    // Look for "station ID" column (case insensitive, flexible matching)
    const stationCol = headers.find(h => {
      const normalized = h.toLowerCase().replace(/[\s_-]/g, '');
      return normalized === 'stationid';
    });

    if (stationCol) {
      console.log('[SPOT-SAMPLE] ✅ Detected Station ID column:', stationCol);
    } else {
      console.log('[SPOT-SAMPLE] ❌ No Station ID column found');
    }
    return stationCol || null;
  }, [headers]);

  // Get parameter columns (exclude time and sample ID columns)
  const parameterColumns = useMemo(() => {
    const filtered = headers.filter(h =>
      h !== timeColumn &&
      h !== sampleIdColumn &&
      h !== stationIdColumn &&
      h.toLowerCase() !== 'time' &&
      h.toLowerCase() !== 'sample' &&
      h.toLowerCase() !== 'sample id' &&
      h.toLowerCase() !== 'subset' &&
      h.toLowerCase() !== 'replicate' &&
      h.toLowerCase().replace(/[\s_-]/g, '') !== 'stationid' &&
      h.toLowerCase().replace(/[\s_-]/g, '') !== 'subsetid' &&
      h.toLowerCase().replace(/[\s_-]/g, '') !== 'bladeid' &&
      h.toLowerCase().replace(/[\s_-]/g, '') !== 'imageid' &&
      // Exclude haplotype taxonomy columns (text fields, not numeric data)
      h.toLowerCase() !== 'kingdom' &&
      h.toLowerCase() !== 'phylum' &&
      h.toLowerCase() !== 'class' &&
      h.toLowerCase() !== 'order' &&
      h.toLowerCase() !== 'family' &&
      h.toLowerCase() !== 'genus' &&
      h.toLowerCase() !== 'species' &&
      h.toLowerCase() !== 'redlist_status' &&
      h.toLowerCase() !== 'score' &&
      h.toLowerCase() !== 'nns'
    );

    // console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');
    // console.log('[SPOT-SAMPLE] Header Analysis:');
    // console.log('[SPOT-SAMPLE] All headers:', headers);
    // console.log('[SPOT-SAMPLE] Time column:', timeColumn);
    // console.log('[SPOT-SAMPLE] Sample ID column:', sampleIdColumn);
    // console.log('[SPOT-SAMPLE] Station ID column:', stationIdColumn);
    // console.log('[SPOT-SAMPLE] Filtered parameter columns:', filtered);

    // Sort parameters according to parameterOrder if defined
    let sortedParams = filtered;
    if (spotSampleStyles?.parameterOrder && spotSampleStyles.parameterOrder.length > 0) {
      console.log('[SPOT-SAMPLE] Applying parameter order:', spotSampleStyles.parameterOrder);

      // For files with parameterOrder defined, ONLY show parameters in the order list
      // This filters out metadata columns like "station ID", "subset ID", "image ID"
      const orderMap = new Map(
        spotSampleStyles.parameterOrder.map((param, index) => [param.toLowerCase(), index])
      );

      // Only keep parameters that are in the parameterOrder list
      sortedParams = filtered
        .filter(param => orderMap.has(param.toLowerCase()))
        .sort((a, b) => {
          const indexA = orderMap.get(a.toLowerCase()) ?? 999;
          const indexB = orderMap.get(b.toLowerCase()) ?? 999;
          return indexA - indexB;
        });

      console.log('[SPOT-SAMPLE] Filtered to only ordered parameters:', sortedParams);
    }

    console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');

    return sortedParams;
  }, [headers, timeColumn, sampleIdColumn, stationIdColumn, spotSampleStyles]);

  // Initialize visible parameters to first 2 when parameterColumns change
  React.useEffect(() => {
    if (parameterColumns.length > 0 && visibleParameters.size === 0) {
      const defaultVisible = new Set(parameterColumns.slice(0, 2));
      setVisibleParameters(defaultVisible);
      console.log('[SPOT-SAMPLE] Initialized visible parameters:', Array.from(defaultVisible));
    }
  }, [parameterColumns, visibleParameters.size]);

  // Group data by date + sample ID
  const groupedData = useMemo(() => {
    // Allow empty strings as valid column names (for unnamed columns)
    if (!timeColumn || sampleIdColumn === null || sampleIdColumn === undefined) {
      console.log('[SPOT-SAMPLE] ❌ Missing required columns:', { timeColumn, sampleIdColumn });
      return [];
    }

    // console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');
    // console.log('[SPOT-SAMPLE] Starting data grouping...');
    // console.log('[SPOT-SAMPLE] Total data rows:', data.length);
    // console.log('[SPOT-SAMPLE] Sample first 3 rows:', data.slice(0, 3));
    // console.log('[SPOT-SAMPLE] Time column:', timeColumn);
    // console.log('[SPOT-SAMPLE] Sample ID column:', sampleIdColumn);
    // console.log('[SPOT-SAMPLE] Station ID column:', stationIdColumn || 'none');
    // console.log('[SPOT-SAMPLE] Parameters to process:', parameterColumns);
    // console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');

    // Only pass stationIdColumn as blade ID if it's different from sample ID column
    // This prevents duplicate labels like "Control-S Control-S" in CHEMWQ files
    const bladeIdColumn = (stationIdColumn && stationIdColumn !== sampleIdColumn) ? stationIdColumn : undefined;
    console.log('[SPOT-SAMPLE] Blade ID column (for grouping):', bladeIdColumn || 'none (same as sample ID)');

    const result = groupBySampleAndDate(data, timeColumn, sampleIdColumn, parameterColumns, bladeIdColumn);

    // console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');
    // console.log('[SPOT-SAMPLE] Grouping complete!');
    // console.log('[SPOT-SAMPLE] Result groups:', result.length);
    // console.log('[SPOT-SAMPLE] Sample first 3 groups:', result.slice(0, 3));
    // console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');

    return result;
  }, [data, timeColumn, sampleIdColumn, parameterColumns, stationIdColumn]);

  // Post-process for eDNA files: abbreviate station labels
  const processedGroupedData = useMemo(() => {
    if (!fileName || !isEdnaMetaFile(fileName)) {
      return groupedData;
    }

    console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');
    console.log('[SPOT-SAMPLE] eDNA Meta file detected, abbreviating station labels');

    const projectPrefix = extractProjectPrefix(fileName);
    console.log('[SPOT-SAMPLE] Project prefix:', projectPrefix);

    const abbreviated = groupedData.map(group => {
      const originalLabel = group.xAxisLabel;

      // Extract the station part from the x-axis label
      // Format is typically: "DD/MM/YY [Station_Name]" or just "Station_Name"
      const match = originalLabel.match(/\[(.*?)\]/) || originalLabel.match(/^(.*)$/);
      const stationPart = match ? match[1] : originalLabel;

      const abbreviatedStation = abbreviateStationLabel(stationPart, projectPrefix);

      // Reconstruct the label with abbreviated station
      let newLabel: string;
      if (originalLabel.includes('[')) {
        // Has date prefix, keep it
        const dateMatch = originalLabel.match(/^(.*?)\s*\[/);
        const datePart = dateMatch ? dateMatch[1] : '';
        newLabel = datePart ? `${datePart} [${abbreviatedStation}]` : abbreviatedStation;
      } else {
        // No date prefix, just use abbreviated station
        newLabel = abbreviatedStation;
      }

      console.log('[SPOT-SAMPLE] Label transform:', originalLabel, '→', newLabel);

      return {
        ...group,
        xAxisLabel: newLabel
      };
    });

    console.log('[SPOT-SAMPLE] Abbreviation complete');
    console.log('[SPOT-SAMPLE] ═══════════════════════════════════════');

    return abbreviated;
  }, [groupedData, fileName]);

  // Assign colors to unique sample IDs
  // Use custom colors from style rules if available, otherwise use default palette
  const sampleIdColors = useMemo(() => {
    const uniqueSampleIds = [...new Set(processedGroupedData.map(d => d.sampleId))];
    const colors: Record<string, string> = {};
    const customColors = spotSampleStyles?.sampleColors || {};

    uniqueSampleIds.forEach((id, index) => {
      // Use custom color if defined, otherwise fall back to default palette
      colors[id] = customColors[id] || DEFAULT_COLOR_PALETTE[index % DEFAULT_COLOR_PALETTE.length];
    });

    console.log('[SPOT-SAMPLE] Assigned colors:', colors);
    console.log('[SPOT-SAMPLE] Custom colors from style rules:', customColors);
    return colors;
  }, [processedGroupedData, spotSampleStyles]);

  // Get available sample ID column options
  const sampleIdColumnOptions = useMemo(() => {
    return headers.filter(h => h !== timeColumn);
  }, [headers, timeColumn]);

  // Get list of unique sample IDs for color customization
  const availableSampleIds = useMemo(() => {
    return [...new Set(processedGroupedData.map(d => d.sampleId))];
  }, [processedGroupedData]);

  // Calculate dynamic chart width for horizontal scrolling
  const uniqueDataPoints = useMemo(() => {
    return [...new Set(processedGroupedData.map(d => d.xAxisLabel))].length;
  }, [processedGroupedData]);

  const needsScrolling = uniqueDataPoints > 20;
  const chartWidth = needsScrolling ? uniqueDataPoints * 60 : undefined;

  // Early validation with detailed error messages
  if (!data || data.length === 0) {
    console.error('[SPOT-SAMPLE] ❌ ERROR: No data provided or empty data array');
    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-sm font-semibold text-destructive mb-1">
          No Data Available
        </p>
        <p className="text-xs text-muted-foreground">
          The data array is empty or undefined. This might be a CSV parsing issue.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Check console logs for CSV parser errors.
        </p>
      </div>
    );
  }

  if (!headers || headers.length === 0) {
    console.error('[SPOT-SAMPLE] ❌ ERROR: No headers provided');
    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-sm font-semibold text-destructive mb-1">
          Missing CSV Headers
        </p>
        <p className="text-xs text-muted-foreground">
          Could not read column headers from the CSV file.
        </p>
      </div>
    );
  }

  // Special handling for _Cred files - bypass normal spot-sample requirements
  if (isCredibilityFile && credibilityData) {
    console.log('[SPOT-SAMPLE] 🎨 Rendering _Cred chart:', fileName);
    console.log('[SPOT-SAMPLE]   - Credibility data:', credibilityData);
    console.log('[SPOT-SAMPLE]   - Spot sample styles:', spotSampleStyles);
    console.log('[SPOT-SAMPLE]   - Custom title:', spotSampleStyles?.chartTitle);
    console.log('[SPOT-SAMPLE]   - Custom Y-axis:', spotSampleStyles?.yAxisLabel);
    console.log('[SPOT-SAMPLE]   - GBIF colors:', {
      trueColor: spotSampleStyles?.gbifTrueColor,
      falseColor: spotSampleStyles?.gbifFalseColor
    });

    return (
      <div className="space-y-3">
        {/* Control Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Chart/Table Toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={!showTable ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowTable(false)}
              className="h-8"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Chart
            </Button>
            <Button
              variant={showTable ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowTable(true)}
              className="h-8"
            >
              <TableIcon className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>

          {/* Styling Button */}
          <StylingRulesDialog
            open={showStylingDialog}
            onOpenChange={setShowStylingDialog}
            styleRules={styleRules}
            onStyleRuleToggle={handleStyleRuleToggle}
            onStyleRuleUpdate={handleStyleRuleUpdate}
            currentFileName={fileName}
            currentChartType="credibility"
            columnColorMode={columnColorMode}
            onColumnColorModeChange={setColumnColorMode}
            singleColumnColor={singleColumnColor}
            onSingleColumnColorChange={setSingleColumnColor}
            availableSampleIds={availableSampleIds}
            sampleIdColors={sampleIdColors}
            onSampleColorChange={handleSampleColorChange}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 ml-auto"
              title="Configure chart styling"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </StylingRulesDialog>

          {/* Info Badge */}
          <div className="text-xs text-muted-foreground">
            {credibilityData.totalUniqueSpecies} unique species detected
          </div>
        </div>

        {/* Chart or Table View */}
        {showTable ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-background">Credibility Level</TableHead>
                    <TableHead className="sticky top-0 bg-background">GBIF Status</TableHead>
                    <TableHead className="sticky top-0 bg-background text-right">Species Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Low</TableCell>
                    <TableCell>GBIF Verified</TableCell>
                    <TableCell className="text-right">{credibilityData.low_gbif_true}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Low</TableCell>
                    <TableCell>GBIF Unverified</TableCell>
                    <TableCell className="text-right">{credibilityData.low_gbif_false}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Moderate</TableCell>
                    <TableCell>GBIF Verified</TableCell>
                    <TableCell className="text-right">{credibilityData.moderate_gbif_true}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Moderate</TableCell>
                    <TableCell>GBIF Unverified</TableCell>
                    <TableCell className="text-right">{credibilityData.moderate_gbif_false}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">High</TableCell>
                    <TableCell>GBIF Verified</TableCell>
                    <TableCell className="text-right">{credibilityData.high_gbif_true}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">High</TableCell>
                    <TableCell>GBIF Unverified</TableCell>
                    <TableCell className="text-right">{credibilityData.high_gbif_false}</TableCell>
                  </TableRow>
                  <TableRow className="font-semibold bg-muted">
                    <TableCell colSpan={2}>Total Unique Species</TableCell>
                    <TableCell className="text-right">{credibilityData.totalUniqueSpecies}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-4">
            <StackedCredibilityChart
              data={credibilityData}
              fileName={fileName || 'credibility_data.csv'}
              customTitle={spotSampleStyles?.chartTitle as string | undefined}
              customYAxisLabel={spotSampleStyles?.yAxisLabel as string | undefined}
              gbifTrueColor={spotSampleStyles?.gbifTrueColor as string | undefined}
              gbifFalseColor={spotSampleStyles?.gbifFalseColor as string | undefined}
              height={spotSampleStyles?.chartHeight || 400}
            />
          </div>
        )}
      </div>
    );
  }

  // Special handling for _taxo files - bypass normal spot-sample requirements
  if (isTaxonomyFileDetected && taxonomyData) {
    console.log('[SPOT-SAMPLE] 🎨 Rendering _taxo chart:', fileName);
    console.log('[SPOT-SAMPLE]   - Taxonomy data:', taxonomyData);
    console.log('[SPOT-SAMPLE]   - Total samples:', taxonomyData.samples.length);
    console.log('[SPOT-SAMPLE]   - Total phyla:', taxonomyData.allPhyla.length);
    console.log('[SPOT-SAMPLE]   - Spot sample styles:', spotSampleStyles);

    return (
      <div className="space-y-3">
        {/* Control Bar */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Chart/Table Toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={!showTable ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowTable(false)}
              className="h-8"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Chart
            </Button>
            <Button
              variant={showTable ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowTable(true)}
              className="h-8"
            >
              <TableIcon className="h-4 w-4 mr-1" />
              Table
            </Button>
          </div>

          {/* Styling Button */}
          <StylingRulesDialog
            open={showStylingDialog}
            onOpenChange={setShowStylingDialog}
            styleRules={styleRules}
            onStyleRuleToggle={handleStyleRuleToggle}
            onStyleRuleUpdate={handleStyleRuleUpdate}
            currentFileName={fileName}
            currentChartType="taxonomy"
            columnColorMode={columnColorMode}
            onColumnColorModeChange={setColumnColorMode}
            singleColumnColor={singleColumnColor}
            onSingleColumnColorChange={setSingleColumnColor}
            availableSampleIds={availableSampleIds}
            sampleIdColors={sampleIdColors}
            onSampleColorChange={handleSampleColorChange}
          >
            <Button
              variant="outline"
              size="sm"
              className="h-8 ml-auto"
              title="Configure chart styling"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </StylingRulesDialog>

          {/* Info Badge */}
          <div className="text-xs text-muted-foreground">
            {taxonomyData.allPhyla.length} phyla across {taxonomyData.samples.length} samples
          </div>
        </div>

        {/* Chart or Table View */}
        {showTable ? (
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-background">Phylum</TableHead>
                    {taxonomyData.samples.map(sample => (
                      <TableHead key={sample} className="sticky top-0 bg-background text-right">
                        {sample}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taxonomyData.allPhyla.map(phylum => (
                    <TableRow key={phylum}>
                      <TableCell className="font-medium">{phylum}</TableCell>
                      {taxonomyData.samples.map(sample => {
                        const count = taxonomyData.phylumCounts[phylum][sample];
                        const percentage = taxonomyData.phylumPercentages[phylum][sample];
                        return (
                          <TableCell key={sample} className="text-right">
                            {count} ({percentage.toFixed(1)}%)
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted">
                    <TableCell>Total Taxa</TableCell>
                    {taxonomyData.samples.map(sample => (
                      <TableCell key={sample} className="text-right">
                        {taxonomyData.totalTaxaPerSample[sample]}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-4">
            <StackedTaxonomyChart
              data={taxonomyData}
              fileName={fileName || 'taxonomy_data.csv'}
              customTitle={spotSampleStyles?.chartTitle as string | undefined}
              customYAxisLabel={spotSampleStyles?.yAxisLabel as string | undefined}
              height={spotSampleStyles?.chartHeight || 600}
            />
          </div>
        )}
      </div>
    );
  }

  if (!timeColumn) {
    console.error('[SPOT-SAMPLE] ❌ ERROR: No time column detected');
    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-sm font-semibold text-destructive mb-1">
          Missing Time Column
        </p>
        <p className="text-xs text-muted-foreground">
          Could not detect a time/date column in the CSV.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Available headers: {headers.join(', ')}
        </p>
      </div>
    );
  }

  // Allow empty strings as valid column names (for unnamed columns)
  if (sampleIdColumn === null || sampleIdColumn === undefined) {
    console.error('[SPOT-SAMPLE] ❌ ERROR: No sample ID column detected');
    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-sm font-semibold text-destructive mb-1">
          Missing Sample ID Column
        </p>
        <p className="text-xs text-muted-foreground">
          Could not detect a "Sample ID" or "Sample" column in the CSV.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Available headers: {headers.join(', ')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Use the dropdown below to manually select the sample ID column.
        </p>
      </div>
    );
  }

  if (processedGroupedData.length === 0) {
    console.error('[SPOT-SAMPLE] ❌ ERROR: No grouped data created');
    console.error('[SPOT-SAMPLE] This means the grouping function returned 0 groups');
    console.error('[SPOT-SAMPLE] Check the [STATISTICAL-UTILS] logs above for skip reasons');

    return (
      <div className="p-4 border border-destructive rounded-lg bg-destructive/10">
        <p className="text-sm font-semibold text-destructive mb-2">
          No Valid Data Points Found
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          The CSV was loaded but no valid numeric data could be grouped.
        </p>
        <details className="mt-2">
          <summary className="text-xs font-semibold cursor-pointer">Possible Causes</summary>
          <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4 list-disc">
            <li>Parameter values are stored as text instead of numbers</li>
            <li>All date values are missing or invalid</li>
            <li>All sample ID values are missing or empty</li>
            <li>All numeric columns contain null/empty values</li>
          </ul>
        </details>

        {diagnosticLogs && diagnosticLogs.length > 0 && (
          <details className="mt-3 open">
            <summary className="text-xs font-semibold cursor-pointer text-blue-600 mb-2">
              📋 Parser Diagnostic Logs ({diagnosticLogs.length} messages)
            </summary>
            <div className="mt-2 p-3 bg-muted rounded text-xs font-mono max-h-64 overflow-y-auto">
              {diagnosticLogs.map((log, index) => (
                <div key={index} className="py-0.5 border-b border-muted-foreground/10 last:border-0">
                  {log}
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="mt-3 p-2 bg-muted rounded text-xs font-mono">
          <div>Data rows: {data.length}</div>
          <div>Headers: {headers.length}</div>
          <div>Time column: {timeColumn}</div>
          <div>Sample ID column: {sampleIdColumn}</div>
          <div>Parameters: {parameterColumns.length}</div>
        </div>

        {!diagnosticLogs && (
          <p className="text-xs text-muted-foreground mt-3 font-semibold">
            📊 Check console logs for detailed diagnostics
          </p>
        )}
      </div>
    );
  }

  // Handler for toggling parameter visibility
  const toggleParameterVisibility = (param: string) => {
    setVisibleParameters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(param)) {
        newSet.delete(param);
      } else {
        newSet.add(param);
      }
      console.log('[SPOT-SAMPLE] Toggled parameter:', param, '- Now visible:', newSet.has(param));
      return newSet;
    });
  };

  // Filter parameters to only show visible ones
  const visibleParametersList = parameterColumns.filter(p => visibleParameters.has(p));

  return (
    <div className="flex gap-3">
      {/* Main chart area */}
      <div className="flex-1 space-y-3">
        {/* Control Bar */}
        <div className="flex items-center gap-3 flex-wrap">
        {/* Chart/Table Toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={!showTable ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowTable(false)}
            className="h-8"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Chart
          </Button>
          <Button
            variant={showTable ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowTable(true)}
            className="h-8"
          >
            <TableIcon className="h-4 w-4 mr-1" />
            Table
          </Button>
        </div>

        {/* Chart Type Selector (only show when chart is active) */}
        {!showTable && (
          <Select
            value={chartType}
            onValueChange={(val) => {
              console.log('[CHART-TYPE] Changing from', chartType, 'to', val);
              setChartType(val as 'column' | 'whisker');
            }}
          >
            <SelectTrigger className="w-[160px] h-8">
              <SelectValue placeholder="Select chart type" />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="column">
                Column Chart
              </SelectItem>
              <SelectItem value="whisker">
                Whisker Plot
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Sample ID Column Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sample ID:</span>
          <Select
            value={selectedSampleIdColumn || detectedSampleIdColumn || ''}
            onValueChange={(val) => setSelectedSampleIdColumn(val)}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue>
                {selectedSampleIdColumn
                  ? selectedSampleIdColumn
                  : detectedSampleIdColumn === ''
                    ? 'Auto (Column 2)'
                    : `Auto (${detectedSampleIdColumn})`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sampleIdColumnOptions.map((col, idx) => (
                <SelectItem key={col || `col-${idx}`} value={col || '__empty__'}>
                  {col === '' ? 'Column 2 (Unnamed)' : col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Styling Button */}
        <StylingRulesDialog
          open={showStylingDialog}
          onOpenChange={setShowStylingDialog}
          styleRules={styleRules}
          onStyleRuleToggle={handleStyleRuleToggle}
          onStyleRuleUpdate={handleStyleRuleUpdate}
          currentFileName={fileName}
          currentChartType={chartType}
          columnColorMode={columnColorMode}
          onColumnColorModeChange={handleColumnColorModeChange}
          singleColumnColor={singleColumnColor}
          onSingleColumnColorChange={handleSingleColumnColorChange}
          availableSampleIds={availableSampleIds}
          sampleIdColors={sampleIdColors}
          onSampleColorChange={handleSampleColorChange}
        >
          <Button
            variant="outline"
            size="sm"
            className="h-8 ml-auto"
            title="Configure chart styling"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </StylingRulesDialog>

        {/* Info Badge */}
        <div className="text-xs text-muted-foreground">
          {processedGroupedData.length} data point{processedGroupedData.length !== 1 ? 's' : ''} • {' '}
          {Object.keys(sampleIdColors).length} sample{Object.keys(sampleIdColors).length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Chart or Table View */}
      {showTable ? (
        <div className="border rounded-lg overflow-hidden">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky top-0 bg-background">Date</TableHead>
                  <TableHead className="sticky top-0 bg-background">Sample ID</TableHead>
                  <TableHead className="sticky top-0 bg-background">Parameter</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Count</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Mean</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">SD</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Min</TableHead>
                  <TableHead className="sticky top-0 bg-background text-right">Max</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedGroupedData.map((group, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {format(parseISO(group.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: sampleIdColors[group.sampleId] }}
                        />
                        {group.sampleId}
                      </div>
                    </TableCell>
                    <TableCell>{group.parameter}</TableCell>
                    <TableCell className="text-right">{group.count}</TableCell>
                    <TableCell className="text-right">{group.stats.mean.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {group.count > 1 ? `±${group.stats.sd.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">{group.stats.min.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{group.stats.max.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className={needsScrolling ? "overflow-x-auto border rounded-lg" : "border rounded-lg"}>
          <div className="space-y-3 p-2">
            {/* Render a chart for each parameter */}
            {(() => {
              console.log('[SPOT-SAMPLE] 📊 RENDERING CHARTS');
              console.log('[SPOT-SAMPLE] Chart type:', chartType);
              console.log('[SPOT-SAMPLE] All parameter columns:', parameterColumns);
              console.log('[SPOT-SAMPLE] Visible parameters:', Array.from(visibleParameters));
              console.log('[SPOT-SAMPLE] Grouped data length:', processedGroupedData.length);
              console.log('[SPOT-SAMPLE] Chart width:', chartWidth);
              return null;
            })()}
            {visibleParametersList.map(param => {
              // Log data being passed to chart component
              const paramData = processedGroupedData.filter(d => d.parameter === param);
              console.log(`[SPOT-SAMPLE-CHART] 🎨 Rendering ${param} chart:`, {
                parameterName: param,
                dataPointsCount: paramData.length,
                sampleFirstThree: paramData.slice(0, 3).map(d => ({
                  xLabel: d.xAxisLabel,
                  mean: d.stats.mean,
                  sd: d.stats.sd,
                  rawValues: d.values,
                  valuesCount: d.count
                }))
              });

              return (
                <div key={param} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{param}</h3>
                    {/* Parameter-specific Y-axis controls */}
                    <Popover
                      open={yAxisDialogOpen === param}
                      onOpenChange={(open) => {
                        setYAxisDialogOpen(open ? param : null);
                        // Initialize temp values when opening
                        if (open) {
                          const currentRange = parameterYAxisRanges[param];
                          setTempYAxisMin(currentRange?.min?.toString() || '');
                          setTempYAxisMax(currentRange?.max?.toString() || '');
                        }
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          title={`Set Y-axis range for ${param}`}
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-4">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Y-Axis Range for {param}</Label>
                            <p className="text-xs text-muted-foreground">
                              Set custom min/max values for this parameter's Y-axis. Leave empty for auto-scale.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Minimum</Label>
                            <Input
                              type="number"
                              placeholder="Auto"
                              value={tempYAxisMin}
                              onChange={(e) => setTempYAxisMin(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Maximum</Label>
                            <Input
                              type="number"
                              placeholder="Auto"
                              value={tempYAxisMax}
                              onChange={(e) => setTempYAxisMax(e.target.value)}
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-8 text-xs"
                              onClick={() => {
                                // Clear the range
                                handleParameterYAxisRangeChange(param, undefined, undefined);
                                setTempYAxisMin('');
                                setTempYAxisMax('');
                                setYAxisDialogOpen(null);
                              }}
                            >
                              Clear
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() => {
                                // Apply the range
                                const min = tempYAxisMin ? parseFloat(tempYAxisMin) : undefined;
                                const max = tempYAxisMax ? parseFloat(tempYAxisMax) : undefined;
                                handleParameterYAxisRangeChange(param, min, max);
                                setYAxisDialogOpen(null);
                              }}
                            >
                              Apply
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div style={{ width: chartWidth || '100%' }}>
                    {chartType === 'column' ? (
                      <ColumnChartWithErrorBars
                        data={processedGroupedData}
                        parameter={param}
                        sampleIdColors={sampleIdColors}
                        width={chartWidth || '100%'}
                        height={350}
                        spotSampleStyles={spotSampleStyles}
                        columnColorMode={columnColorMode}
                        singleColumnColor={singleColumnColor}
                        yAxisRange={parameterYAxisRanges[param]}
                      />
                    ) : (
                    <WhiskerPlot
                      data={processedGroupedData}
                      parameter={param}
                      sampleIdColors={sampleIdColors}
                      width={chartWidth || '100%'}
                      height={350}
                      spotSampleStyles={spotSampleStyles}
                    />
                  )}
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap px-2">
          <span className="text-xs font-semibold text-muted-foreground">Sample IDs:</span>
          {Object.entries(sampleIdColors).map(([sampleId, color]) => (
            <div key={sampleId} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs">{sampleId}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Parameter Selector Panel */}
      <div className="w-48 shrink-0">
        <div className="sticky top-4 border rounded-lg p-3 bg-background">
          <h3 className="text-sm font-semibold mb-3">Parameters</h3>
          <div className="space-y-2">
            {parameterColumns.map(param => (
              <div key={param} className="flex items-center space-x-2">
                <Checkbox
                  id={`param-${param}`}
                  checked={visibleParameters.has(param)}
                  onCheckedChange={() => toggleParameterVisibility(param)}
                />
                <Label
                  htmlFor={`param-${param}`}
                  className="text-xs cursor-pointer flex-1 leading-tight"
                >
                  {param}
                </Label>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            {visibleParameters.size} of {parameterColumns.length} visible
          </div>
        </div>
      </div>
    </div>
  );
}
