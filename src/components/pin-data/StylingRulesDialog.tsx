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
    // Y-axis label styling
    yAxisLabelFontSize?: number; // Font size for Y-axis labels (default: 12)
    // Chart dimensions
    chartHeight?: number; // Height of each parameter chart (default: 350)
    // Parameter ordering
    parameterOrder?: string[]; // Ordered list of parameter names to display (e.g., ["Length", "Width", "Fouling"])
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
export const STYLE_RULES_VERSION = 9;

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
  // Spot-sample / Discrete sampling files styling (CROP, CHEM, WQ, EDNA)
  {
    suffix: "_indiv.csv",
    styleName: "indiv_style",
    description: "Individual blade measurements - whisker plots grouped by Date+Farm+Station. Station ID extracted from 'blade ID' column after underscore (e.g., '1_1-SW-1' → '1-SW-1'). X-axis: Date / [Farm Station]. Params: length, width, Fouling, Fertility, Yield. First 2 shown by default, select more via sidebar.",
    enabled: true,
    properties: {
      spotSample: {
        // Column Chart specific
        barGap: 4, // Gap between bars in same category (px)
        barCategoryGap: 10, // Gap between different categories (% of category size)
        columnBorderWidth: 0, // Border thickness for column bars

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

        // Chart dimensions
        chartHeight: 350, // Height of each parameter chart

        // Parameter ordering - display parameters in this specific order (exact column names with units)
        parameterOrder: [
          "length (cm)",
          "width (cm)",
          "Fouling (% area)",
          "Fertility (% blade sorus)",
          "Yield (kg/m)"
        ]
      }
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
}

export function StylingRulesDialog({
  open,
  onOpenChange,
  styleRules,
  onStyleRuleToggle,
  currentFileName,
  onStyleRuleUpdate,
  children
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
                <h5 className="text-xs font-semibold">Spot-Sample Chart Controls</h5>

                {/* Whisker Spacing - THE FIX! */}
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

                {/* More controls button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    // Open expanded controls if needed
                  }}
                >
                  <Info className="h-3 w-3 mr-1" />
                  More Advanced Controls
                </Button>
              </div>
            )}
          </div>
        </TooltipProvider>
      </PopoverContent>
    </Popover>
  );
}
