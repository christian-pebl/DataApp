"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette, Info, Settings } from "lucide-react";

// Define the styling properties for each rule
export interface StyleProperties {
  xAxisRange?: { min: string; max: string }; // Time range like "00:00" to "24:00"
  xAxisTitle?: string;
  defaultAxisMode?: 'single' | 'multi';
  yAxisTitle?: string;
  yAxisWidth?: number; // Width/spacing for left Y-axis (default: 80)
  secondaryYAxis?: {
    enabled: boolean;
    title: string;
    // Calculation formula: value of primary axis divided by this number, then multiplied by 100
    // Example: DPM / 60 * 100 = Detection rate (% of hour)
    divideBy: number;
    width?: number; // Width/spacing for right Y-axis (default: 80)
  };
  plotToParametersGap?: number; // Gap between plot area and parameters pane (default: 12, in px equivalent - Tailwind gap-3 = 12px)
  chartRightMargin?: number; // Right margin inside chart (space between plot border and right Y-axis, default: 80)
  xAxisTitlePosition?: number; // Vertical position of X-axis title from bottom (default: 40, in px)
  xAxisTitleMargin?: number; // Margin between X-axis title and plot boundary (default: 10, in px)
  chartBottomMargin?: number; // Bottom margin inside chart (space for X-axis and title, default: -5)
  chartHeight?: number; // Total chart container height (default: 208, which is h-52 in Tailwind)
  xAxisTitleFontSize?: number; // Font size for X-axis title (default: 14 = 0.875rem)
  yAxisMultiLine?: boolean; // Enable multi-line y-axis titles (splits long titles at halfway point)
  yAxisMultiLineWordThreshold?: number; // Minimum number of words before splitting (default: 3)
  heatmapRowHeight?: number; // Height of each row in heatmap view (default: 35, in px)

  // Parameter-level styling properties
  defaultLineStyle?: 'solid' | 'dashed' | 'dotted'; // Line style for parameters (default: solid)
  defaultOpacity?: number; // Opacity for parameters (default: 1.0, range: 0-1)
  defaultLineWidth?: number; // Line width for parameters (default: 1, range: 1-4)

  // Spot-sample (discrete sampling) specific properties
  spotSample?: {
    // Column Chart specific
    barGap?: number; // Gap between bars in the same category (default: 4, in px)
    barCategoryGap?: number; // Gap between different categories (default: 10, as % of category size)
    columnBorderWidth?: number; // Border thickness for column bars (default: 0, range: 0-5)
    columnColorMode?: 'unique' | 'single'; // Color mode: 'unique' = different color per sample, 'single' = same color for all (default: 'single')
    singleColumnColor?: string; // Hex color for single color mode (default: '#3b82f6')
    sampleColors?: Record<string, string>; // Custom colors for each sample ID when in 'unique' mode (e.g., { "Sample-A": "#ff0000", "Sample-B": "#00ff00" })

    // Whisker Plot specific
    whiskerBoxWidth?: number; // Overall width of whisker box (default: 40, in pixels, range: 20-100)
    whiskerSpacing?: number; // Spacing between whisker plot centers (default: 80, in pixels, range: 50-200)
    whiskerLineWidth?: number; // Thickness of whisker lines (default: 2, range: 1-5)
    whiskerBoxBorderWidth?: number; // Border thickness of box (default: 2, range: 1-5)
    whiskerCapWidth?: number; // Width of whisker caps at min/max (default: 20, as % of box width)

    // Chart margins
    chartMarginTop?: number; // Top margin (default: 20)
    chartMarginRight?: number; // Right margin (default: 30)
    chartMarginLeft?: number; // Left margin (default: 40)
    chartMarginBottom?: number; // Bottom margin for X-axis labels (default: 80)
    // Error bar styling
    errorBarWidth?: number; // Width of error bar cap (default: 4)
    errorBarStrokeWidth?: number; // Thickness of error bar line (default: 2)
    // X-axis label styling
    xAxisLabelRotation?: number; // Rotation angle in degrees (default: -45)
    xAxisLabelFontSize?: number; // Font size for X-axis labels (default: 11)
    xAxisLabelSecondLineOffset?: number; // Horizontal offset for second line of X-axis label (default: 0, range: -20 to 20)
    // X-axis label component toggles (for _indiv files)
    xAxisShowDate?: boolean; // Show date in X-axis label (default: true)
    xAxisShowStationName?: boolean; // Show station name in X-axis label (default: true)
    xAxisShowSampleId?: boolean; // Show sample ID in X-axis label (default: true)
    // Y-axis label styling
    yAxisLabelFontSize?: number; // Font size for Y-axis labels (default: 12)
    // Y-axis title styling
    yAxisTitleFontSize?: number; // Font size for Y-axis title (default: 14)
    yAxisTitleFontWeight?: number | string; // Font weight for Y-axis title (default: 'normal', can be 'bold', 'normal', or numeric like 500)
    yAxisTitleAlign?: 'left' | 'center' | 'right'; // Text alignment for Y-axis title (default: 'center')
    // Chart dimensions
    chartHeight?: number; // Height of each parameter chart (default: 350)
    // Parameter ordering
    parameterOrder?: string[]; // Ordered list of parameter names to display (e.g., ["Length", "Width", "Fouling"])
    // Parameter-specific Y-axis ranges (for CHEMWQ files)
    parameterYAxisRanges?: Record<string, { min?: number; max?: number }>; // Custom Y-axis ranges per parameter
  };
}

// Define the styling rules structure
export interface StyleRule {
  suffix: string;
  styleName: string;
  description: string;
  enabled: boolean;
  properties: StyleProperties;
}

// Version for style rules - increment when defaults change
export const STYLE_RULES_VERSION = 19;

// Default styling rules - can be expanded
// IMPORTANT: Order matters! More specific patterns must come BEFORE more general patterns
// because .find() returns the first match. For example, "_diff_std.csv" must come before "_std.csv"
// because "file_diff_std.csv".endsWith("_std.csv") returns true.
export const DEFAULT_STYLE_RULES: StyleRule[] = [
  {
    suffix: "_24hr.csv",
    styleName: "24hr_style",
    description: "24-hour aggregated data styling with dual y-axes showing DPM and detection rate percentage",
    enabled: false,
    properties: {
      xAxisRange: { min: "00:00", max: "24:00" },
      xAxisTitle: "Time",
      defaultAxisMode: 'single',
      yAxisTitle: "Detection Positive Minutes (DPM)",
      yAxisWidth: 80,
      secondaryYAxis: {
        enabled: true,
        title: "Detection Rate (% of hour)",
        divideBy: 60,  // DPM / 60 * 100 = percentage of hour
        width: 80
      },
      plotToParametersGap: 12, // Default gap (gap-3 equivalent)
      chartRightMargin: 80, // Default right margin inside chart
      xAxisTitlePosition: 20, // Default X-axis title position from bottom (reduced from 40)
      xAxisTitleMargin: -5, // Default margin between X-axis title and plot (negative brings it closer)
      chartBottomMargin: 10, // Default bottom margin (positive value for proper spacing)
      chartHeight: 208, // Default chart height (h-52 in Tailwind = 208px)
      xAxisTitleFontSize: 10 // Default font size to match Y-axis (0.65rem ≈ 10px)
    }
  },
  // Check _diff_std.csv BEFORE _std.csv (more specific pattern first)
  {
    suffix: "_diff_std.csv",
    styleName: "stddiff_style",
    description: "Standard difference plot styling (subtracted std files) with dual y-axes showing daily DPM difference and difference rate percentage",
    enabled: false,
    properties: {
      xAxisTitle: "Time",
      defaultAxisMode: 'single',
      yAxisTitle: "Difference (DPM)",
      yAxisWidth: 80,
      secondaryYAxis: {
        enabled: true,
        title: "DPM diff rate (%hr)",
        divideBy: 60,  // DPM / 60 * 100 = percentage of hour
        width: 80
      },
      plotToParametersGap: 12, // Default gap (gap-3 equivalent)
      chartRightMargin: 80, // Default right margin inside chart
      xAxisTitlePosition: 20, // Default X-axis title position from bottom
      xAxisTitleMargin: -5, // Default margin between X-axis title and plot (negative brings it closer)
      chartBottomMargin: 10, // Default bottom margin (positive value for proper spacing)
      chartHeight: 208, // Default chart height (h-52 in Tailwind = 208px)
      xAxisTitleFontSize: 10, // Default font size to match Y-axis (0.65rem ≈ 10px)

      // Parameter-level styling for _std difference files
      defaultLineStyle: 'dashed', // Use dashed lines for _std difference parameters
      defaultOpacity: 1.0, // Full opacity
      defaultLineWidth: 1 // Standard line width
    }
  },
  {
    suffix: "_std.csv",
    styleName: "std_style",
    description: "Standard interval data styling with dual y-axes showing daily DPM and DPM rate percentage",
    enabled: false,
    properties: {
      xAxisTitle: "Time",
      defaultAxisMode: 'single',
      yAxisTitle: "Daily DPM (DPM/hr)",
      yAxisWidth: 80,
      secondaryYAxis: {
        enabled: true,
        title: "DPM rate (%hr)",
        divideBy: 60,  // DPM / 60 * 100 = percentage of hour
        width: 80
      },
      plotToParametersGap: 12, // Default gap (gap-3 equivalent)
      chartRightMargin: 80, // Default right margin inside chart
      xAxisTitlePosition: 20, // Default X-axis title position from bottom
      xAxisTitleMargin: -5, // Default margin between X-axis title and plot (negative brings it closer)
      chartBottomMargin: 10, // Default bottom margin (positive value for proper spacing)
      chartHeight: 208, // Default chart height (h-52 in Tailwind = 208px)
      xAxisTitleFontSize: 10, // Default font size to match Y-axis (0.65rem ≈ 10px)

      // Parameter-level styling for _std files
      defaultLineStyle: 'dashed', // Use dashed lines for _std parameters
      defaultOpacity: 1.0, // Full opacity
      defaultLineWidth: 1 // Standard line width
    }
  },
  {
    suffix: "_nmax.csv",
    styleName: "nmax_style",
    description: "Subcam maximum values data styling with multi-line Y-axis titles for long parameter names and configurable heatmap row height",
    enabled: true,
    properties: {
      xAxisTitle: "Time",
      defaultAxisMode: 'single',
      yAxisWidth: 80,
      yAxisMultiLine: true, // Enable multi-line Y-axis titles
      yAxisMultiLineWordThreshold: 3, // Split titles with 3+ words
      plotToParametersGap: 12,
      chartRightMargin: 12,
      xAxisTitlePosition: 20,
      xAxisTitleMargin: -5,
      chartBottomMargin: 10,
      chartHeight: 208,
      xAxisTitleFontSize: 10,
      heatmapRowHeight: 35 // Default heatmap row height in pixels
    }
  },
  // Spot-sample / Discrete sampling files styling (CROP, CHEM, WQ, EDNA)
  {
    suffix: "_indiv.csv",
    styleName: "indiv_style",
    description: "Individual blade measurements - whisker plots grouped by Date+Farm+Station. Station ID extracted from 'blade ID' column after underscore (e.g., '1_1-SW-1' → '1-SW-1'). X-axis: Date / [Farm Station]. Params: length, width, Fouling, Yield, Fertility. First 4 shown by default (Fertility hidden, often zero), select more via sidebar.",
    enabled: true,
    properties: {
      spotSample: {
        // Column Chart specific
        barGap: 4, // Gap between bars in same category (px)
        barCategoryGap: 10, // Gap between different categories (% of category size)
        columnBorderWidth: 0, // Border thickness for column bars
        columnColorMode: 'single', // Default to single color for all columns
        singleColumnColor: '#3b82f6', // Default blue color

        // Whisker Plot specific
        whiskerBoxWidth: 40, // Overall width of whisker box (in pixels)
        whiskerSpacing: 80, // Spacing between whisker plot centers (in pixels)
        whiskerLineWidth: 2, // Thickness of whisker lines
        whiskerBoxBorderWidth: 2, // Border thickness of box
        whiskerCapWidth: 20, // Width of whisker caps at min/max (% of box width)

        // Chart margins
        chartMarginTop: 20,
        chartMarginRight: 30,
        chartMarginLeft: 60, // Extra space for Y-axis title
        chartMarginBottom: 80, // Extra space for rotated X-axis labels

        // Error bar styling
        errorBarWidth: 4, // Width of error bar cap
        errorBarStrokeWidth: 2, // Thickness of error bar line

        // X-axis label styling
        xAxisLabelRotation: -45, // Rotation angle in degrees
        xAxisLabelFontSize: 11, // Font size for labels
        xAxisLabelSecondLineOffset: 10, // Horizontal offset for second line (aligns to right)

        // X-axis label component toggles
        xAxisShowDate: true, // Show date in X-axis label
        xAxisShowStationName: true, // Show station name in X-axis label
        xAxisShowSampleId: true, // Show sample ID in X-axis label

        // Y-axis label styling
        yAxisLabelFontSize: 12,

        // Y-axis title styling (matches the chart title appearance)
        yAxisTitleFontSize: 14, // Font size for Y-axis title (matches h3 text-sm)
        yAxisTitleFontWeight: 600, // Font weight for Y-axis title (matches font-semibold)
        yAxisTitleAlign: 'center', // Center align Y-axis title

        // Chart dimensions
        chartHeight: 350, // Height of each parameter chart

        // Parameter ordering - display parameters in this specific order (exact column names with units)
        parameterOrder: [
          "length (cm)",
          "width (cm)",
          "Fouling (% area)",
          "Yield (kg/m)",
          "Fertility (% blade sorus)"
        ]
      }
    }
  },
  {
    suffix: "_Meta.csv",
    styleName: "edna_meta_style",
    description: "eDNA Metadata - bar charts showing concentration parameters grouped by Date+Station. Station labels abbreviated. X-axis: Date / [Station]. Params: eDNA Concentration, 18SSSU Marker Concentration, COILB Marker Concentration. Only these 3 concentration parameters are displayed.",
    enabled: true,
    properties: {
      spotSample: {
        // Column Chart specific
        barGap: 4, // Gap between bars in same category (px)
        barCategoryGap: 10, // Gap between different categories (% of category size)
        columnBorderWidth: 0, // Border thickness for column bars
        columnColorMode: 'single', // Default to single color for all columns
        singleColumnColor: '#3b82f6', // Default blue color

        // Whisker Plot specific
        whiskerBoxWidth: 40, // Overall width of whisker box (in pixels)
        whiskerSpacing: 80, // Spacing between whisker plot centers (in pixels)
        whiskerLineWidth: 2, // Thickness of whisker lines
        whiskerBoxBorderWidth: 2, // Border thickness of box
        whiskerCapWidth: 20, // Width of whisker caps at min/max (% of box width)

        // Chart margins
        chartMarginTop: 20,
        chartMarginRight: 30,
        chartMarginLeft: 40,
        chartMarginBottom: 80, // Extra space for rotated X-axis labels

        // Error bar styling
        errorBarWidth: 4, // Width of error bar cap
        errorBarStrokeWidth: 2, // Thickness of error bar line

        // X-axis label styling
        xAxisLabelRotation: -45, // Rotation angle in degrees
        xAxisLabelFontSize: 11, // Font size for labels
        xAxisLabelSecondLineOffset: 10, // Horizontal offset for second line (aligns to right)

        // Y-axis label styling
        yAxisLabelFontSize: 12,

        // Y-axis title styling (matched to X-axis label styling)
        yAxisTitleFontSize: 11, // Match X-axis label font size
        yAxisTitleFontWeight: 'normal', // Match X-axis label weight
        yAxisTitleAlign: 'center', // Center align Y-axis title

        // Chart dimensions
        chartHeight: 350, // Height of each parameter chart

        // Parameter ordering - display ONLY these eDNA concentration parameters
        parameterOrder: [
          "eDNA Concentration (ng/µL)",
          "18SSSU Marker Concentration (ng/µL)",
          "COILB Marker Concentration (ng/µL)"
        ]
      }
    }
  },
  {
    suffix: "_Cred.csv",
    styleName: "edna_cred_style",
    description: "eDNA Credibility Scores - stacked column chart showing species counts by detection credibility (Low/Moderate/High) and GBIF validation status. Displays total unique species detected. Default colors: Green (GBIF verified), Orange (GBIF unverified).",
    enabled: true,
    properties: {
      spotSample: {
        // Column Chart specific
        barGap: 4,
        barCategoryGap: 15,
        columnBorderWidth: 0,

        // Chart margins
        chartMarginTop: 60, // Extra space for summary overlay box
        chartMarginRight: 30,
        chartMarginLeft: 50,
        chartMarginBottom: 80,

        // Chart dimensions
        chartHeight: 400,

        // GBIF color scheme (user-customizable)
        gbifTrueColor: "#4CAF50",  // Green for verified species
        gbifFalseColor: "#FF9800", // Orange for unverified species

        // Chart labels
        chartTitle: "Detection Credibility Score",
        yAxisLabel: "Species Count"
      }
    }
  },
  {
    suffix: "_chem.csv",
    styleName: "chemwq_style",
    description: "CHEMWQ Water Quality - Column charts with error bars for discrete water quality measurements (pH, Salinity, Nutrients). Supports parameter-specific Y-axis ranges and unified column coloring.",
    enabled: true,
    properties: {
      spotSample: {
        // Column Chart specific
        barGap: 4,
        barCategoryGap: 10,
        columnBorderWidth: 0,
        columnColorMode: 'single', // Default to single color for CHEMWQ
        singleColumnColor: '#3b82f6', // Default blue color

        // Chart margins
        chartMarginTop: 20,
        chartMarginRight: 30,
        chartMarginLeft: 50,
        chartMarginBottom: 100, // Extra space for rotated labels

        // Error bar styling
        errorBarWidth: 4,
        errorBarStrokeWidth: 2,

        // X-axis label styling
        xAxisLabelRotation: -45,
        xAxisLabelFontSize: 10,

        // Y-axis label styling
        yAxisLabelFontSize: 12,

        // Y-axis title styling
        yAxisTitleFontSize: 14,
        yAxisTitleFontWeight: 'normal',
        yAxisTitleAlign: 'center',

        // Chart dimensions
        chartHeight: 350,

        // Parameter ordering
        parameterOrder: [
          "pH",
          "Sal (ppt)",
          "PO4 (mg/L)",
          "NO3 (mg/L)"
        ],

        // Parameter-specific Y-axis ranges (initially empty, user can customize)
        parameterYAxisRanges: {}
      }
    }
  },
  // eDNA Credibility files - stacked bar chart showing detection credibility scores
  {
    suffix: "_cred.csv",
    styleName: "edna_cred_style",
    description: "eDNA Credibility Scores - stacked column chart showing species counts by credibility level (Low/Moderate/High) and GBIF validation status. Chart shows total unique species detected.",
    enabled: true,
    properties: {
      spotSample: {
        chartHeight: 400,
        chartTitle: "Detection Credibility Score",
        yAxisLabel: "Species Count",
        gbifTrueColor: "#4CAF50", // Green for GBIF verified
        gbifFalseColor: "#FF9800" // Orange for GBIF unverified
      }
    }
  },
  // eDNA Taxonomy files - stacked bar chart showing phylum-level community composition
  {
    suffix: "_taxo.csv",
    styleName: "edna_taxonomy_style",
    description: "eDNA Taxonomy Composition - stacked bar chart showing phylum-level community composition across sampling sites. X-axis: sample locations, Y-axis: relative abundance (%), stacked by phylum with distinct colors.",
    enabled: true,
    properties: {
      spotSample: {
        chartHeight: 600,
        chartTitle: "eDNA Phylum Composition",
        yAxisLabel: "Relative Abundance (%)"
      }
    }
  },
  // eDNA Haplotype files - heatmap showing species distribution across sites
  {
    suffix: "_Hapl.csv",
    styleName: "hapl_style",
    description: "eDNA Haplotype data styling with configurable heatmap row height for species visualization",
    enabled: true,
    properties: {
      heatmapRowHeight: 35 // Default heatmap row height in pixels
    }
  },
  // Add more rules as needed
];

interface StylingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleRules: StyleRule[];
  onStyleRuleToggle: (suffix: string, enabled: boolean) => void;
  currentFileName?: string; // Current file name to auto-expand matching rule
  onStyleRuleUpdate?: (suffix: string, properties: Partial<StyleProperties>) => void;
  children: React.ReactNode; // Trigger element
  currentChartType?: 'column' | 'whisker' | 'credibility'; // Current chart type being displayed
  columnColorMode?: 'unique' | 'single'; // Color mode for column charts
  onColumnColorModeChange?: (mode: 'unique' | 'single') => void;
  singleColumnColor?: string; // Color when in single color mode
  onSingleColumnColorChange?: (color: string) => void;
  availableSampleIds?: string[]; // List of available sample IDs for color customization
  sampleIdColors?: Record<string, string>; // Current colors for each sample ID
  onSampleColorChange?: (sampleId: string, color: string) => void; // Callback when sample color changes
}

export function StylingRulesDialog({
  open,
  onOpenChange,
  styleRules,
  onStyleRuleToggle,
  currentFileName,
  onStyleRuleUpdate,
  children,
  currentChartType,
  columnColorMode,
  onColumnColorModeChange,
  singleColumnColor,
  onSingleColumnColorChange,
  availableSampleIds = [],
  sampleIdColors = {},
  onSampleColorChange
}: StylingRulesDialogProps) {
  // Find the currently active rule (matching filename and enabled)
  const activeRule = currentFileName
    ? styleRules.find(rule => rule.enabled && currentFileName.toLowerCase().endsWith(rule.suffix.toLowerCase()))
    : null;

  // Selected rule for editing (defaults to active rule, or first rule if no active)
  const [selectedRuleSuffix, setSelectedRuleSuffix] = useState<string>(
    activeRule?.suffix || styleRules[0]?.suffix || ""
  );

  // Track whether advanced controls are shown
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update selected rule when dialog opens or filename changes
  React.useEffect(() => {
    if (open && activeRule) {
      setSelectedRuleSuffix(activeRule.suffix);
    }
  }, [open, activeRule]);

  const selectedRule = styleRules.find(r => r.suffix === selectedRuleSuffix);

  if (!selectedRule) return <>{children}</>;

  // Handler functions for property updates
  const handlePropertyChange = (property: string, value: any) => {
    if (!onStyleRuleUpdate) return;
    onStyleRuleUpdate(selectedRule.suffix, { [property]: value });
  };

  const handleSecondaryYAxisChange = (property: string, value: any) => {
    if (!onStyleRuleUpdate || !selectedRule.properties.secondaryYAxis) return;
    onStyleRuleUpdate(selectedRule.suffix, {
      secondaryYAxis: {
        ...selectedRule.properties.secondaryYAxis,
        [property]: value
      }
    });
  };

  const handleSpotSamplePropertyChange = (property: string, value: any) => {
    if (!onStyleRuleUpdate) return;
    onStyleRuleUpdate(selectedRule.suffix, {
      spotSample: {
        ...selectedRule.properties.spotSample,
        [property]: value
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={true}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 max-h-[500px] overflow-y-auto p-3"
        align="start"
        side="bottom"
        sideOffset={5}
        onInteractOutside={(e) => {
          // Allow interaction with parent popover
          const target = e.target as HTMLElement;
          if (target.closest('[role="dialog"]') || target.closest('[data-radix-popover-content]')) {
            e.preventDefault();
          }
        }}
      >
        <TooltipProvider delayDuration={200}>
          <div className="space-y-3">
            {/* Header with icon */}
            <div className="flex items-center gap-2 border-b pb-2">
              <Settings className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Plot Styling</h4>
            </div>

            {/* Rule selector dropdown */}
            <div className="space-y-1.5">
              <Label className="text-xs">Select Style Rule</Label>
              <Select value={selectedRuleSuffix} onValueChange={setSelectedRuleSuffix}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styleRules.map((rule) => (
                    <SelectItem key={rule.suffix} value={rule.suffix} className="text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={rule.enabled ? "default" : "outline"} className="text-[10px] px-1">
                          {rule.suffix}
                        </Badge>
                        <span className="text-muted-foreground text-[10px]">
                          {rule.styleName}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enable/Disable toggle */}
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded border">
              <Label className="text-xs cursor-pointer" htmlFor="rule-enabled">
                Enable for {selectedRule.suffix}
              </Label>
              <Switch
                id="rule-enabled"
                checked={selectedRule.enabled}
                onCheckedChange={(enabled) => onStyleRuleToggle(selectedRule.suffix, enabled)}
              />
            </div>

            {/* Configuration based on rule type */}
            {selectedRule.properties.spotSample ? (
              /* Spot-Sample Controls */
              <div className="space-y-3">
                <h5 className="text-xs font-semibold">
                  {currentChartType === 'whisker' ? 'Whisker Plot Controls' : currentChartType === 'column' ? 'Column Chart Controls' : 'Chart Controls'}
                </h5>

                {/* Column Chart Controls - only show when column chart is active */}
                {currentChartType === 'column' && (
                  <>
                    {/* Color Mode Toggle */}
                    <div className="space-y-2 p-3 bg-muted/30 rounded-md">
                      <Label className="text-xs font-semibold">Column Color Mode</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={columnColorMode === 'unique' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => onColumnColorModeChange?.('unique')}
                        >
                          Unique Colors
                        </Button>
                        <Button
                          variant={columnColorMode === 'single' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => onColumnColorModeChange?.('single')}
                        >
                          Single Color
                        </Button>
                      </div>

                      {/* Color Picker - only show in single color mode */}
                      {columnColorMode === 'single' && (
                        <div className="mt-2 space-y-2">
                          <Label className="text-xs">Column Color</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className="w-full h-8 justify-start gap-2"
                              >
                                <div
                                  className="w-4 h-4 rounded border"
                                  style={{ backgroundColor: singleColumnColor }}
                                />
                                <span className="text-xs">{singleColumnColor}</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3">
                              <div className="space-y-3">
                                <Label className="text-xs font-semibold">Select Color</Label>
                                <input
                                  type="color"
                                  value={singleColumnColor}
                                  onChange={(e) => onSingleColumnColorChange?.(e.target.value)}
                                  className="w-full h-10 rounded cursor-pointer"
                                />
                                <Input
                                  type="text"
                                  value={singleColumnColor}
                                  onChange={(e) => onSingleColumnColorChange?.(e.target.value)}
                                  placeholder="#3b82f6"
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}

                      {/* Individual Sample Color Pickers - only show in unique color mode */}
                      {columnColorMode === 'unique' && availableSampleIds.length > 0 && (
                        <div className="mt-2 space-y-3">
                          <div className="border-t pt-3">
                            <Label className="text-xs font-semibold">Sample Colors</Label>
                            <p className="text-xs text-muted-foreground mt-1">Customize color for each sample</p>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {availableSampleIds.map(sampleId => (
                              <div key={sampleId} className="space-y-1">
                                <Label className="text-xs">{sampleId}</Label>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      className="w-full h-8 justify-start gap-2"
                                    >
                                      <div
                                        className="w-4 h-4 rounded border"
                                        style={{ backgroundColor: sampleIdColors[sampleId] || '#3b82f6' }}
                                      />
                                      <span className="text-xs">{sampleIdColors[sampleId] || '#3b82f6'}</span>
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-3">
                                    <div className="space-y-3">
                                      <Label className="text-xs font-semibold">Color for {sampleId}</Label>
                                      <input
                                        type="color"
                                        value={sampleIdColors[sampleId] || '#3b82f6'}
                                        onChange={(e) => onSampleColorChange?.(sampleId, e.target.value)}
                                        className="w-full h-10 rounded cursor-pointer"
                                      />
                                      <Input
                                        type="text"
                                        value={sampleIdColors[sampleId] || '#3b82f6'}
                                        onChange={(e) => onSampleColorChange?.(sampleId, e.target.value)}
                                        placeholder="#3b82f6"
                                        className="h-8 text-xs font-mono"
                                      />
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Bar Gap */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Gap Between Bars</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.barGap ?? 4}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.barGap ?? 4]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('barGap', values[0])}
                        min={0}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Bar Category Gap */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Gap Between Categories</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.barCategoryGap ?? 10}%
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.barCategoryGap ?? 10]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('barCategoryGap', values[0])}
                        min={0}
                        max={50}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {/* Credibility Chart Controls - only show for _Cred files */}
                {currentChartType === 'credibility' && currentFileName?.toLowerCase().endsWith('_cred.csv') && (
                  <>
                    {/* GBIF Color Pickers */}
                    <div className="space-y-2 p-3 bg-muted/30 rounded-md">
                      <Label className="text-xs font-semibold">GBIF Colors</Label>
                      <p className="text-xs text-muted-foreground">Customize colors for GBIF verified/unverified species</p>

                      {/* GBIF TRUE Color */}
                      <div className="space-y-2">
                        <Label className="text-xs">GBIF Verified (TRUE)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-8 justify-start gap-2"
                            >
                              <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: selectedRule?.properties?.spotSample?.gbifTrueColor || '#4CAF50' }}
                              />
                              <span className="text-xs">{selectedRule?.properties?.spotSample?.gbifTrueColor || '#4CAF50'}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3">
                            <div className="space-y-3">
                              <Label className="text-xs font-semibold">GBIF Verified Color</Label>
                              <input
                                type="color"
                                value={selectedRule?.properties?.spotSample?.gbifTrueColor || '#4CAF50'}
                                onChange={(e) => {
                                  if (!selectedRule) return;
                                  onStyleRuleUpdate?.(selectedRule.suffix, {
                                    spotSample: {
                                      ...selectedRule.properties.spotSample,
                                      gbifTrueColor: e.target.value
                                    }
                                  });
                                }}
                                className="w-full h-10 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={selectedRule?.properties?.spotSample?.gbifTrueColor || '#4CAF50'}
                                onChange={(e) => {
                                  if (!selectedRule) return;
                                  onStyleRuleUpdate?.(selectedRule.suffix, {
                                    spotSample: {
                                      ...selectedRule.properties.spotSample,
                                      gbifTrueColor: e.target.value
                                    }
                                  });
                                }}
                                placeholder="#4CAF50"
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* GBIF FALSE Color */}
                      <div className="space-y-2">
                        <Label className="text-xs">GBIF Unverified (FALSE)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full h-8 justify-start gap-2"
                            >
                              <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: selectedRule?.properties?.spotSample?.gbifFalseColor || '#FF9800' }}
                              />
                              <span className="text-xs">{selectedRule?.properties?.spotSample?.gbifFalseColor || '#FF9800'}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3">
                            <div className="space-y-3">
                              <Label className="text-xs font-semibold">GBIF Unverified Color</Label>
                              <input
                                type="color"
                                value={selectedRule?.properties?.spotSample?.gbifFalseColor || '#FF9800'}
                                onChange={(e) => {
                                  if (!selectedRule) return;
                                  onStyleRuleUpdate?.(selectedRule.suffix, {
                                    spotSample: {
                                      ...selectedRule.properties.spotSample,
                                      gbifFalseColor: e.target.value
                                    }
                                  });
                                }}
                                className="w-full h-10 rounded cursor-pointer"
                              />
                              <Input
                                type="text"
                                value={selectedRule?.properties?.spotSample?.gbifFalseColor || '#FF9800'}
                                onChange={(e) => {
                                  if (!selectedRule) return;
                                  onStyleRuleUpdate?.(selectedRule.suffix, {
                                    spotSample: {
                                      ...selectedRule.properties.spotSample,
                                      gbifFalseColor: e.target.value
                                    }
                                  });
                                }}
                                placeholder="#FF9800"
                                className="h-8 text-xs font-mono"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </>
                )}

                {/* Whisker Plot Controls - only show when whisker plot is active */}
                {currentChartType === 'whisker' && (
                  <>
                    {/* Whisker Spacing */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs">Gap Between Whiskers</Label>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-xs">
                              <p>Distance between whisker centers - reduces total plot width</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.whiskerSpacing ?? 80}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.whiskerSpacing ?? 80]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('whiskerSpacing', values[0])}
                        min={50}
                        max={200}
                        step={10}
                        className="w-full"
                      />
                    </div>

                    {/* Whisker Box Width */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Whisker Box Width</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.whiskerBoxWidth ?? 40}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.whiskerBoxWidth ?? 40]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('whiskerBoxWidth', values[0])}
                        min={20}
                        max={100}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  </>
                )}

                {/* Chart Height */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Chart Height</Label>
                    <span className="text-xs text-muted-foreground">
                      {selectedRule.properties.spotSample?.chartHeight ?? 350}px
                    </span>
                  </div>
                  <Slider
                    value={[selectedRule.properties.spotSample?.chartHeight ?? 350]}
                    onValueChange={(values) => handleSpotSamplePropertyChange('chartHeight', values[0])}
                    min={200}
                    max={600}
                    step={25}
                    className="w-full"
                  />
                </div>

                {/* Chart Width */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Chart Width</Label>
                    <span className="text-xs text-muted-foreground">
                      {selectedRule.properties.spotSample?.chartWidth ? `${selectedRule.properties.spotSample.chartWidth}px` : 'Auto'}
                    </span>
                  </div>
                  <Slider
                    value={[selectedRule.properties.spotSample?.chartWidth ?? 400]}
                    onValueChange={(values) => handleSpotSamplePropertyChange('chartWidth', values[0])}
                    min={200}
                    max={1200}
                    step={50}
                    className="w-full"
                  />
                </div>

                {/* X-axis Label Components - only show for _indiv files */}
                {selectedRule.suffix === "_indiv.csv" && (
                  <div className="space-y-2 p-3 bg-muted/30 rounded-md">
                    <Label className="text-xs font-semibold">X-Axis Label Components</Label>
                    <p className="text-xs text-muted-foreground">Show/hide parts of the X-axis labels</p>

                    <div className="space-y-3">
                      {/* Show Date Toggle */}
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-date" className="text-xs cursor-pointer">Show Date</Label>
                        <Switch
                          id="show-date"
                          checked={selectedRule.properties.spotSample?.xAxisShowDate ?? true}
                          onCheckedChange={(checked) => handleSpotSamplePropertyChange('xAxisShowDate', checked)}
                        />
                      </div>

                      {/* Show Station Name Toggle */}
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-station" className="text-xs cursor-pointer">Show Station Name</Label>
                        <Switch
                          id="show-station"
                          checked={selectedRule.properties.spotSample?.xAxisShowStationName ?? true}
                          onCheckedChange={(checked) => handleSpotSamplePropertyChange('xAxisShowStationName', checked)}
                        />
                      </div>

                      {/* Show Sample ID Toggle */}
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-sample-id" className="text-xs cursor-pointer">Show Sample ID</Label>
                        <Switch
                          id="show-sample-id"
                          checked={selectedRule.properties.spotSample?.xAxisShowSampleId ?? true}
                          onCheckedChange={(checked) => handleSpotSamplePropertyChange('xAxisShowSampleId', checked)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* More controls button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <Info className="h-3 w-3 mr-1" />
                  {showAdvanced ? 'Hide Advanced Controls' : 'More Advanced Controls'}
                </Button>

                {/* Advanced controls - shown when expanded */}
                {showAdvanced && (
                  <div className="space-y-3 pt-3 border-t">
                    <h6 className="text-xs font-semibold text-muted-foreground">Advanced Styling</h6>

                    {/* Whisker Line Width */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Whisker Line Width</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.whiskerLineWidth ?? 2}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.whiskerLineWidth ?? 2]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('whiskerLineWidth', values[0])}
                        min={1}
                        max={5}
                        step={0.5}
                        className="w-full"
                      />
                    </div>

                    {/* Whisker Box Border Width */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Box Border Width</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.whiskerBoxBorderWidth ?? 2}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.whiskerBoxBorderWidth ?? 2]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('whiskerBoxBorderWidth', values[0])}
                        min={1}
                        max={5}
                        step={0.5}
                        className="w-full"
                      />
                    </div>

                    {/* Whisker Cap Width */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Cap Width (% of box)</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.whiskerCapWidth ?? 20}%
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.whiskerCapWidth ?? 20]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('whiskerCapWidth', values[0])}
                        min={10}
                        max={50}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    {/* X-Axis Label Rotation */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">X-Axis Label Rotation</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.xAxisLabelRotation ?? -45}°
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.xAxisLabelRotation ?? -45]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('xAxisLabelRotation', values[0])}
                        min={-90}
                        max={0}
                        step={15}
                        className="w-full"
                      />
                    </div>

                    {/* X-Axis Label Font Size */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">X-Axis Label Font Size</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.spotSample?.xAxisLabelFontSize ?? 11}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.spotSample?.xAxisLabelFontSize ?? 11]}
                        onValueChange={(values) => handleSpotSamplePropertyChange('xAxisLabelFontSize', values[0])}
                        min={8}
                        max={16}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Chart Margins */}
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-semibold">Chart Margins</Label>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Top: {selectedRule.properties.spotSample?.chartMarginTop ?? 20}px</Label>
                          <Slider
                            value={[selectedRule.properties.spotSample?.chartMarginTop ?? 20]}
                            onValueChange={(values) => handleSpotSamplePropertyChange('chartMarginTop', values[0])}
                            min={0}
                            max={50}
                            step={5}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Bottom: {selectedRule.properties.spotSample?.chartMarginBottom ?? 140}px</Label>
                          <Slider
                            value={[selectedRule.properties.spotSample?.chartMarginBottom ?? 140]}
                            onValueChange={(values) => handleSpotSamplePropertyChange('chartMarginBottom', values[0])}
                            min={40}
                            max={150}
                            step={10}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Left: {selectedRule.properties.spotSample?.chartMarginLeft ?? 60}px</Label>
                          <Slider
                            value={[selectedRule.properties.spotSample?.chartMarginLeft ?? 60]}
                            onValueChange={(values) => handleSpotSamplePropertyChange('chartMarginLeft', values[0])}
                            min={20}
                            max={80}
                            step={5}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Right: {selectedRule.properties.spotSample?.chartMarginRight ?? 30}px</Label>
                          <Slider
                            value={[selectedRule.properties.spotSample?.chartMarginRight ?? 30]}
                            onValueChange={(values) => handleSpotSamplePropertyChange('chartMarginRight', values[0])}
                            min={10}
                            max={60}
                            step={5}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Time-Series Plot Controls */
              <div className="space-y-3">
                <h5 className="text-xs font-semibold">Time-Series Chart Controls</h5>

                {/* X-Axis Title */}
                <div className="space-y-1">
                  <Label className="text-xs">X-Axis Title</Label>
                  <Input
                    value={selectedRule.properties.xAxisTitle || "Time"}
                    onChange={(e) => handlePropertyChange('xAxisTitle', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>

                {/* Y-Axis Title */}
                <div className="space-y-1">
                  <Label className="text-xs">Y-Axis Title</Label>
                  <Input
                    value={selectedRule.properties.yAxisTitle || ""}
                    onChange={(e) => handlePropertyChange('yAxisTitle', e.target.value)}
                    className="h-7 text-xs"
                  />
                </div>

                {/* Chart Height */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Chart Height</Label>
                    <span className="text-xs text-muted-foreground">
                      {selectedRule.properties.chartHeight || 208}px
                    </span>
                  </div>
                  <Slider
                    value={[selectedRule.properties.chartHeight || 208]}
                    onValueChange={(values) => handlePropertyChange('chartHeight', values[0])}
                    min={150}
                    max={400}
                    step={10}
                    className="w-full"
                  />
                </div>

                {/* Y-Axis Width */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Y-Axis Width</Label>
                    <span className="text-xs text-muted-foreground">
                      {selectedRule.properties.yAxisWidth || 80}px
                    </span>
                  </div>
                  <Slider
                    value={[selectedRule.properties.yAxisWidth || 80]}
                    onValueChange={(values) => handlePropertyChange('yAxisWidth', values[0])}
                    min={40}
                    max={150}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Heatmap Row Height - show for nmax and Hapl files */}
                {(selectedRule.suffix === "_nmax.csv" || selectedRule.suffix === "_Hapl.csv") && (
                  <div className="space-y-1.5 p-3 bg-muted/30 rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-semibold">Heatmap Row Height</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs text-xs">
                            <p>Height of each species row in heatmap view (range: -40 to 80px, default: 35px). Use lower values for more compact display.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {selectedRule.properties.heatmapRowHeight || 35}px
                      </span>
                    </div>
                    <Slider
                      value={[selectedRule.properties.heatmapRowHeight || 35]}
                      onValueChange={(values) => handlePropertyChange('heatmapRowHeight', values[0])}
                      min={-40}
                      max={80}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}

                {/* More controls button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <Info className="h-3 w-3 mr-1" />
                  {showAdvanced ? 'Hide Advanced Controls' : 'More Advanced Controls'}
                </Button>

                {/* Advanced controls - shown when expanded */}
                {showAdvanced && (
                  <div className="space-y-3 pt-3 border-t">
                    <h6 className="text-xs font-semibold text-muted-foreground">Advanced Styling</h6>

                    {/* X-Axis Title Position */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">X-Axis Title Position</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.xAxisTitlePosition ?? 20}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.xAxisTitlePosition ?? 20]}
                        onValueChange={(values) => handlePropertyChange('xAxisTitlePosition', values[0])}
                        min={0}
                        max={60}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    {/* X-Axis Title Font Size */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">X-Axis Title Font Size</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.xAxisTitleFontSize ?? 10}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.xAxisTitleFontSize ?? 10]}
                        onValueChange={(values) => handlePropertyChange('xAxisTitleFontSize', values[0])}
                        min={8}
                        max={16}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    {/* Chart Right Margin */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Chart Right Margin</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.chartRightMargin ?? 80}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.chartRightMargin ?? 80]}
                        onValueChange={(values) => handlePropertyChange('chartRightMargin', values[0])}
                        min={40}
                        max={150}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    {/* Chart Bottom Margin */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Chart Bottom Margin</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.chartBottomMargin ?? 10}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.chartBottomMargin ?? 10]}
                        onValueChange={(values) => handlePropertyChange('chartBottomMargin', values[0])}
                        min={-20}
                        max={40}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    {/* Plot to Parameters Gap */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Plot to Parameters Gap</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.plotToParametersGap ?? 12}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.plotToParametersGap ?? 12]}
                        onValueChange={(values) => handlePropertyChange('plotToParametersGap', values[0])}
                        min={0}
                        max={40}
                        step={4}
                        className="w-full"
                      />
                    </div>

                    {/* Default Line Style */}
                    <div className="space-y-1">
                      <Label className="text-xs">Default Line Style</Label>
                      <Select
                        value={selectedRule.properties.defaultLineStyle || 'solid'}
                        onValueChange={(value) => handlePropertyChange('defaultLineStyle', value as 'solid' | 'dashed' | 'dotted')}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solid" className="text-xs">Solid</SelectItem>
                          <SelectItem value="dashed" className="text-xs">Dashed</SelectItem>
                          <SelectItem value="dotted" className="text-xs">Dotted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Default Opacity */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Default Opacity</Label>
                        <span className="text-xs text-muted-foreground">
                          {(selectedRule.properties.defaultOpacity ?? 1.0).toFixed(1)}
                        </span>
                      </div>
                      <Slider
                        value={[(selectedRule.properties.defaultOpacity ?? 1.0) * 100]}
                        onValueChange={(values) => handlePropertyChange('defaultOpacity', values[0] / 100)}
                        min={10}
                        max={100}
                        step={10}
                        className="w-full"
                      />
                    </div>

                    {/* Default Line Width */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Default Line Width</Label>
                        <span className="text-xs text-muted-foreground">
                          {selectedRule.properties.defaultLineWidth ?? 1}px
                        </span>
                      </div>
                      <Slider
                        value={[selectedRule.properties.defaultLineWidth ?? 1]}
                        onValueChange={(values) => handlePropertyChange('defaultLineWidth', values[0])}
                        min={1}
                        max={4}
                        step={0.5}
                        className="w-full"
                      />
                    </div>

                    {/* Secondary Y-Axis Controls (if enabled) */}
                    {selectedRule.properties.secondaryYAxis && (
                      <div className="space-y-3 pt-3 border-t">
                        <h6 className="text-xs font-semibold text-muted-foreground">Secondary Y-Axis</h6>

                        {/* Secondary Y-Axis Title */}
                        <div className="space-y-1">
                          <Label className="text-xs">Secondary Y-Axis Title</Label>
                          <Input
                            value={selectedRule.properties.secondaryYAxis.title || ""}
                            onChange={(e) => handleSecondaryYAxisChange('title', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>

                        {/* Secondary Y-Axis Width */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Secondary Y-Axis Width</Label>
                            <span className="text-xs text-muted-foreground">
                              {selectedRule.properties.secondaryYAxis.width ?? 80}px
                            </span>
                          </div>
                          <Slider
                            value={[selectedRule.properties.secondaryYAxis.width ?? 80]}
                            onValueChange={(values) => handleSecondaryYAxisChange('width', values[0])}
                            min={40}
                            max={150}
                            step={5}
                            className="w-full"
                          />
                        </div>

                        {/* Divide By Factor */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Label className="text-xs">Divide By Factor</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs text-xs">
                                  <p>Secondary axis = (Primary value / this) × 100</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {selectedRule.properties.secondaryYAxis.divideBy ?? 60}
                            </span>
                          </div>
                          <Slider
                            value={[selectedRule.properties.secondaryYAxis.divideBy ?? 60]}
                            onValueChange={(values) => handleSecondaryYAxisChange('divideBy', values[0])}
                            min={1}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
