"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Palette, Pencil, Info } from "lucide-react";

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
}

export function StylingRulesDialog({
  open,
  onOpenChange,
  styleRules,
  onStyleRuleToggle,
  currentFileName,
  onStyleRuleUpdate
}: StylingRulesDialogProps) {
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [originalValues, setOriginalValues] = useState<{
    leftWidth: number;
    rightWidth: number;
    gap: number;
    rightMargin: number;
    xAxisTitlePosition: number;
    xAxisTitleMargin: number;
    chartBottomMargin: number;
    chartHeight: number;
    xAxisTitleFontSize: number;
    xAxisTitle: string;
    yAxisTitle: string;
    secondaryYAxisTitle: string;
  } | null>(null);

  // Draggable dialog state - Position on right side by default
  const [position, setPosition] = useState({ x: 0, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dialogRef = React.useRef<HTMLDivElement>(null);

  // Calculate right-aligned position on mount
  React.useEffect(() => {
    if (open && dialogRef.current) {
      const dialogWidth = dialogRef.current.offsetWidth || 672; // 672px = max-w-2xl default
      const windowWidth = window.innerWidth;
      const rightMargin = 20; // 20px from right edge
      const rightAlignedX = (windowWidth - dialogWidth) / 2 - rightMargin;
      setPosition({ x: rightAlignedX, y: 20 });
    }
  }, [open]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.dialog-header-drag')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Auto-expand matching rule when dialog opens with a current file
  React.useEffect(() => {
    if (open && currentFileName) {
      // Find matching rule by checking if filename ends with any rule suffix
      const matchingRule = styleRules.find(rule => 
        currentFileName.toLowerCase().endsWith(rule.suffix.toLowerCase())
      );
      
      if (matchingRule) {
        // Automatically expand the matching rule
        handleEditClick(matchingRule);
      }
    } else if (!open) {
      // Reset when dialog closes
      setEditingRule(null);
      setOriginalValues(null);
    }
  }, [open, currentFileName]);


  const handleEditClick = (rule: StyleRule) => {
    // Store original values for potential revert
    setOriginalValues({
      leftWidth: rule.properties.yAxisWidth || 80,
      rightWidth: rule.properties.secondaryYAxis?.width || 80,
      gap: rule.properties.plotToParametersGap || 12,
      rightMargin: rule.properties.chartRightMargin || 80,
      xAxisTitlePosition: rule.properties.xAxisTitlePosition || 20,
      xAxisTitleMargin: rule.properties.xAxisTitleMargin ?? -5,
      chartBottomMargin: rule.properties.chartBottomMargin ?? 10,
      chartHeight: rule.properties.chartHeight || 208,
      xAxisTitleFontSize: rule.properties.xAxisTitleFontSize || 10,
      xAxisTitle: rule.properties.xAxisTitle || "Time",
      yAxisTitle: rule.properties.yAxisTitle || "Detection Positive Minutes (DPM)",
      secondaryYAxisTitle: rule.properties.secondaryYAxis?.title || "Detection Rate (% of hour)"
    });
    setEditingRule(rule.suffix);
  };

  const handleLeftWidthChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        yAxisWidth: value
      });
    }
  };

  const handleRightWidthChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      const rule = styleRules.find(r => r.suffix === suffix);
      onStyleRuleUpdate(suffix, {
        secondaryYAxis: {
          ...rule?.properties.secondaryYAxis,
          width: value,
          enabled: rule?.properties.secondaryYAxis?.enabled || false,
          title: rule?.properties.secondaryYAxis?.title || "",
          divideBy: rule?.properties.secondaryYAxis?.divideBy || 60
        }
      });
    }
  };

  const handleGapChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        plotToParametersGap: value
      });
    }
  };

  const handleRightMarginChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        chartRightMargin: value
      });
    }
  };

  const handleXAxisTitlePositionChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        xAxisTitlePosition: value
      });
    }
  };

  const handleXAxisTitleMarginChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        xAxisTitleMargin: value
      });
    }
  };

  const handleChartBottomMarginChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        chartBottomMargin: value
      });
    }
  };

  const handleChartHeightChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        chartHeight: value
      });
    }
  };

  const handleXAxisTitleFontSizeChange = (suffix: string, value: number) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        xAxisTitleFontSize: value
      });
    }
  };

  const handleXAxisTitleChange = (suffix: string, value: string) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        xAxisTitle: value
      });
    }
  };

  const handleYAxisTitleChange = (suffix: string, value: string) => {
    if (onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        yAxisTitle: value
      });
    }
  };

  const handleSecondaryYAxisTitleChange = (suffix: string, value: string) => {
    if (onStyleRuleUpdate) {
      const rule = styleRules.find(r => r.suffix === suffix);
      onStyleRuleUpdate(suffix, {
        secondaryYAxis: {
          ...rule?.properties.secondaryYAxis,
          title: value,
          enabled: rule?.properties.secondaryYAxis?.enabled || false,
          divideBy: rule?.properties.secondaryYAxis?.divideBy || 60,
          width: rule?.properties.secondaryYAxis?.width || 80
        }
      });
    }
  };

  // Spot-sample property handlers
  const handleSpotSamplePropertyChange = (suffix: string, property: string, value: number) => {
    if (onStyleRuleUpdate) {
      const rule = styleRules.find(r => r.suffix === suffix);
      onStyleRuleUpdate(suffix, {
        spotSample: {
          ...rule?.properties.spotSample,
          [property]: value
        }
      });
    }
  };

  const handleSaveChanges = () => {
    // Changes are already applied, just close
    setEditingRule(null);
    setOriginalValues(null);
  };

  const handleCancelChanges = (suffix: string) => {
    // Revert to original values
    if (originalValues && onStyleRuleUpdate) {
      const rule = styleRules.find(r => r.suffix === suffix);
      onStyleRuleUpdate(suffix, {
        yAxisWidth: originalValues.leftWidth,
        yAxisTitle: originalValues.yAxisTitle,
        xAxisTitle: originalValues.xAxisTitle,
        plotToParametersGap: originalValues.gap,
        chartRightMargin: originalValues.rightMargin,
        xAxisTitlePosition: originalValues.xAxisTitlePosition,
        xAxisTitleMargin: originalValues.xAxisTitleMargin,
        chartBottomMargin: originalValues.chartBottomMargin,
        chartHeight: originalValues.chartHeight,
        xAxisTitleFontSize: originalValues.xAxisTitleFontSize,
        secondaryYAxis: {
          ...rule?.properties.secondaryYAxis,
          width: originalValues.rightWidth,
          title: originalValues.secondaryYAxisTitle,
          enabled: rule?.properties.secondaryYAxis?.enabled || false,
          divideBy: rule?.properties.secondaryYAxis?.divideBy || 60
        }
      });
    }
    setEditingRule(null);
    setOriginalValues(null);
  };

  // Reset position when dialog opens
  React.useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 20 });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="max-w-2xl max-h-[65vh] overflow-y-auto"
        style={{
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`
        }}
        onMouseDown={handleMouseDown}
      >
        <DialogHeader className="dialog-header-drag cursor-move select-none">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <DialogTitle>Styling Rules</DialogTitle>
            <span className="text-xs text-muted-foreground ml-auto">(drag to move)</span>
          </div>
        </DialogHeader>

        <div className="mt-4">
          {styleRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No styling rules configured yet.</p>
              <p className="text-xs mt-2">Styling rules will appear here once defined.</p>
            </div>
          ) : editingRule && currentFileName ? null : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">File Suffix</TableHead>
                  <TableHead className="w-[140px]">Style Name</TableHead>
                  <TableHead className="w-[80px] text-center">Enabled</TableHead>
                  <TableHead>Configuration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {styleRules.map((rule) => (
                  <TableRow key={rule.suffix}>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="font-mono text-xs">
                        {rule.suffix}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="secondary" className="font-mono text-xs whitespace-normal">
                        {rule.styleName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center align-top">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(enabled) => onStyleRuleToggle(rule.suffix, enabled)}
                        aria-label={`Toggle ${rule.styleName}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Info Button - Shows Configuration Details */}
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        title="View configuration details"
                                      >
                                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-3" align="end" side="left">
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-semibold mb-2">Configuration Details</h4>
                                        <p className="text-xs text-muted-foreground mb-2 pb-2 border-b">{rule.description}</p>
                                        <div className="text-xs text-muted-foreground space-y-1">
                                          {rule.properties.xAxisRange && (
                                            <div className="flex items-start gap-1.5">
                                              <span className="text-primary mt-0.5">•</span>
                                              <span><strong>X-axis range:</strong> {rule.properties.xAxisRange.min} to {rule.properties.xAxisRange.max}</span>
                                            </div>
                                          )}
                                          {rule.properties.xAxisTitle && (
                                            <div className="flex items-start gap-1.5">
                                              <span className="text-primary mt-0.5">•</span>
                                              <span><strong>X-axis title:</strong> "{rule.properties.xAxisTitle}"</span>
                                            </div>
                                          )}
                                          {rule.properties.defaultAxisMode && (
                                            <div className="flex items-start gap-1.5">
                                              <span className="text-primary mt-0.5">•</span>
                                              <span><strong>Default mode:</strong> {rule.properties.defaultAxisMode} axis</span>
                                            </div>
                                          )}
                                          {rule.properties.yAxisTitle && (
                                            <div className="flex items-start gap-1.5">
                                              <span className="text-primary mt-0.5">•</span>
                                              <span><strong>Y-axis title:</strong> "{rule.properties.yAxisTitle}"</span>
                                            </div>
                                          )}
                                          {rule.properties.secondaryYAxis?.enabled && (
                                            <div className="flex items-start gap-1.5">
                                              <span className="text-primary mt-0.5">•</span>
                                              <span><strong>Secondary Y-axis:</strong> "{rule.properties.secondaryYAxis.title}" (calculated as: value ÷ {rule.properties.secondaryYAxis.divideBy} × 100)</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>View configuration details</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {/* Edit Axes Button */}
                            {onStyleRuleUpdate && (
                              <Popover open={editingRule === rule.suffix} onOpenChange={(open) => !open && setEditingRule(null)}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleEditClick(rule)}
                                    title="Edit layout and spacing"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 max-h-[450px] overflow-y-auto p-4" align="end" side="left" sideOffset={10}>
                                <TooltipProvider delayDuration={200}>
                                  <div className="space-y-3">
                                    {/* Show appropriate header based on rule type */}
                                    <div>
                                      <h4 className="text-sm font-semibold">
                                        {rule.properties.spotSample
                                          ? "Spot-Sample Chart Controls"
                                          : "Axis Titles & Layout"}
                                      </h4>
                                      {rule.properties.spotSample && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Customize column spacing, margins, and error bar styling
                                        </p>
                                      )}
                                    </div>

                                    {/* Time-Series Plot Controls (only show if NOT spot-sample) */}
                                    {!rule.properties.spotSample && (
                                      <>
                                    {/* Axis Title Text Inputs */}
                                    <div className="space-y-2 border-b pb-3">
                                      {/* X-Axis Title Input */}
                                      <div className="space-y-1">
                                        <Label htmlFor={`x-axis-title-${rule.suffix}`} className="text-xs font-medium">
                                          X-Axis Title
                                        </Label>
                                        <Input
                                          id={`x-axis-title-${rule.suffix}`}
                                          value={rule.properties.xAxisTitle || "Time"}
                                          onChange={(e) => handleXAxisTitleChange(rule.suffix, e.target.value)}
                                          className="h-8 text-xs"
                                          placeholder="Enter X-axis title"
                                        />
                                      </div>

                                      {/* Left Y-Axis Title Input */}
                                      <div className="space-y-1">
                                        <Label htmlFor={`y-axis-title-${rule.suffix}`} className="text-xs font-medium">
                                          Left Y-Axis Title
                                        </Label>
                                        <Input
                                          id={`y-axis-title-${rule.suffix}`}
                                          value={rule.properties.yAxisTitle || "Detection Positive Minutes (DPM)"}
                                          onChange={(e) => handleYAxisTitleChange(rule.suffix, e.target.value)}
                                          className="h-8 text-xs"
                                          placeholder="Enter left Y-axis title"
                                        />
                                      </div>

                                      {/* Right Y-Axis Title Input (if secondary axis enabled) */}
                                      {rule.properties.secondaryYAxis?.enabled && (
                                        <div className="space-y-1">
                                          <Label htmlFor={`secondary-y-axis-title-${rule.suffix}`} className="text-xs font-medium">
                                            Right Y-Axis Title
                                          </Label>
                                          <Input
                                            id={`secondary-y-axis-title-${rule.suffix}`}
                                            value={rule.properties.secondaryYAxis?.title || "Detection Rate (% of hour)"}
                                            onChange={(e) => handleSecondaryYAxisTitleChange(rule.suffix, e.target.value)}
                                            className="h-8 text-xs"
                                            placeholder="Enter right Y-axis title"
                                          />
                                        </div>
                                      )}
                                    </div>

                                    {/* Left Y-Axis Width Slider */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Label htmlFor={`left-axis-${rule.suffix}`} className="text-xs font-medium">
                                            Left Y-Axis Width
                                          </Label>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs">
                                              <p>Width of the left Y-axis area including labels and title</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{rule.properties.yAxisWidth || 80}px</span>
                                      </div>
                                      <Slider
                                        id={`left-axis-${rule.suffix}`}
                                        value={[rule.properties.yAxisWidth || 80]}
                                        onValueChange={(values) => handleLeftWidthChange(rule.suffix, values[0])}
                                        min={40}
                                        max={150}
                                        step={5}
                                        className="w-full"
                                      />
                                    </div>

                                    {/* Right Y-Axis Width Slider (if secondary axis enabled) */}
                                    {rule.properties.secondaryYAxis?.enabled && (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <Label htmlFor={`right-axis-${rule.suffix}`} className="text-xs font-medium">
                                              Right Y-Axis Width
                                            </Label>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent side="right" className="max-w-xs text-xs">
                                                <p>Width of the right Y-axis area including labels and title</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{rule.properties.secondaryYAxis?.width || 80}px</span>
                                        </div>
                                        <Slider
                                          id={`right-axis-${rule.suffix}`}
                                          value={[rule.properties.secondaryYAxis?.width || 80]}
                                          onValueChange={(values) => handleRightWidthChange(rule.suffix, values[0])}
                                          min={40}
                                          max={150}
                                          step={5}
                                          className="w-full"
                                        />
                                      </div>
                                    )}

                                    {/* Chart Right Margin Slider */}
                                    {rule.properties.secondaryYAxis?.enabled && (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <Label htmlFor={`right-margin-${rule.suffix}`} className="text-xs font-medium">
                                              Chart Right Margin
                                            </Label>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                              </TooltipTrigger>
                                              <TooltipContent side="right" className="max-w-xs text-xs">
                                                <p>Space between the plot border and the right Y-axis</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </div>
                                          <span className="text-xs text-muted-foreground">{rule.properties.chartRightMargin || 80}px</span>
                                        </div>
                                        <Slider
                                          id={`right-margin-${rule.suffix}`}
                                          value={[rule.properties.chartRightMargin || 80]}
                                          onValueChange={(values) => handleRightMarginChange(rule.suffix, values[0])}
                                          min={0}
                                          max={150}
                                          step={5}
                                          className="w-full"
                                        />
                                      </div>
                                    )}

                                    {/* Plot to Parameters Gap Slider */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Label htmlFor={`gap-${rule.suffix}`} className="text-xs font-medium">
                                            Plot to Parameters Gap
                                          </Label>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs">
                                              <p>Horizontal spacing between chart container and parameters pane</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{rule.properties.plotToParametersGap || 12}px</span>
                                      </div>
                                      <Slider
                                        id={`gap-${rule.suffix}`}
                                        value={[rule.properties.plotToParametersGap || 12]}
                                        onValueChange={(values) => handleGapChange(rule.suffix, values[0])}
                                        min={0}
                                        max={48}
                                        step={4}
                                        className="w-full"
                                      />
                                    </div>

                                    {/* X-Axis Title Position Slider */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Label htmlFor={`x-title-pos-${rule.suffix}`} className="text-xs font-medium">
                                            X-Axis Title Position
                                          </Label>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs">
                                              <p>Total height allocated for the X-axis title area below the chart</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{rule.properties.xAxisTitlePosition || 20}px</span>
                                      </div>
                                      <Slider
                                        id={`x-title-pos-${rule.suffix}`}
                                        value={[rule.properties.xAxisTitlePosition || 20]}
                                        onValueChange={(values) => handleXAxisTitlePositionChange(rule.suffix, values[0])}
                                        min={20}
                                        max={100}
                                        step={5}
                                        className="w-full"
                                      />
                                    </div>

                                    {/* X-Axis Title Margin Slider */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Label htmlFor={`x-title-margin-${rule.suffix}`} className="text-xs font-medium">
                                            X-Axis Title Offset
                                          </Label>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs">
                                              <p>Fine-tune distance between X-axis ticks and title text</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{rule.properties.xAxisTitleMargin ?? -5}px</span>
                                      </div>
                                      <Slider
                                        id={`x-title-margin-${rule.suffix}`}
                                        value={[rule.properties.xAxisTitleMargin ?? -5]}
                                        onValueChange={(values) => handleXAxisTitleMarginChange(rule.suffix, values[0])}
                                        min={-20}
                                        max={30}
                                        step={2}
                                        className="w-full"
                                      />
                                    </div>

                                    {/* Chart Bottom Margin Slider - CRITICAL FOR X-AXIS TITLE VISIBILITY */}
                                    <div className="space-y-1.5 border-t pt-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Label htmlFor={`chart-bottom-margin-${rule.suffix}`} className="text-xs font-medium text-primary">
                                            Chart Bottom Margin ⚠️
                                          </Label>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-primary cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs">
                                              <p><strong>CRITICAL:</strong> Negative values will hide the X-axis title! Try increasing to 20-50 to see the title appear.</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                        <span className="text-xs font-semibold text-primary">{rule.properties.chartBottomMargin ?? 10}px</span>
                                      </div>
                                      <Slider
                                        id={`chart-bottom-margin-${rule.suffix}`}
                                        value={[rule.properties.chartBottomMargin ?? 10]}
                                        onValueChange={(values) => handleChartBottomMarginChange(rule.suffix, values[0])}
                                        min={-20}
                                        max={80}
                                        step={5}
                                        className="w-full"
                                      />
                                    </div>

                                    {/* Chart Height Slider */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Label htmlFor={`chart-height-${rule.suffix}`} className="text-xs font-medium">
                                            Chart Container Height
                                          </Label>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs">
                                              <p>Total height of chart container. Increase if title is still cut off.</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{rule.properties.chartHeight || 208}px</span>
                                      </div>
                                      <Slider
                                        id={`chart-height-${rule.suffix}`}
                                        value={[rule.properties.chartHeight || 208]}
                                        onValueChange={(values) => handleChartHeightChange(rule.suffix, values[0])}
                                        min={150}
                                        max={400}
                                        step={10}
                                        className="w-full"
                                      />
                                    </div>

                                    {/* X-Axis Title Font Size Slider */}
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <Label htmlFor={`x-title-font-${rule.suffix}`} className="text-xs font-medium">
                                            X-Axis Title Font Size
                                          </Label>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="max-w-xs text-xs">
                                              <p>Font size for the X-axis title text</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{rule.properties.xAxisTitleFontSize || 10}px</span>
                                      </div>
                                      <Slider
                                        id={`x-title-font-${rule.suffix}`}
                                        value={[rule.properties.xAxisTitleFontSize || 10]}
                                        onValueChange={(values) => handleXAxisTitleFontSizeChange(rule.suffix, values[0])}
                                        min={8}
                                        max={24}
                                        step={1}
                                        className="w-full"
                                      />
                                    </div>
                                    </>
                                    )}

                                    {/* Spot-Sample (Discrete Sampling) Controls */}
                                    {rule.properties.spotSample && (
                                      <div className="space-y-3">

                                        {/* COLUMN CHART CONTROLS */}
                                        <div className="space-y-3 border-b pb-3">
                                          <h5 className="text-xs font-semibold text-blue-600">📊 Column Chart Controls</h5>

                                          {/* Bar Gap */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`bar-gap-${rule.suffix}`} className="text-xs font-medium">
                                                  Bar Gap
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Gap between bars in the same category (in pixels)</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.barGap ?? 4}px</span>
                                            </div>
                                            <Slider
                                              id={`bar-gap-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.barGap ?? 4]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'barGap', values[0])}
                                              min={0}
                                              max={20}
                                              step={1}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Bar Category Gap */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`bar-category-gap-${rule.suffix}`} className="text-xs font-medium">
                                                  Category Gap
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Gap between different categories (% of space)</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.barCategoryGap ?? 10}%</span>
                                            </div>
                                            <Slider
                                              id={`bar-category-gap-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.barCategoryGap ?? 10]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'barCategoryGap', values[0])}
                                              min={0}
                                              max={50}
                                              step={5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Column Border Width */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`column-border-width-${rule.suffix}`} className="text-xs font-medium">
                                                  Column Border Thickness
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Border thickness around column bars (0 = no border)</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.columnBorderWidth ?? 0}px</span>
                                            </div>
                                            <Slider
                                              id={`column-border-width-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.columnBorderWidth ?? 0]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'columnBorderWidth', values[0])}
                                              min={0}
                                              max={5}
                                              step={0.5}
                                              className="w-full"
                                            />
                                          </div>
                                        </div>

                                        {/* WHISKER PLOT CONTROLS */}
                                        <div className="space-y-3 border-b pb-3">
                                          <h5 className="text-xs font-semibold text-purple-600">📈 Whisker Plot Controls</h5>

                                          {/* Whisker Box Width */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`whisker-box-width-${rule.suffix}`} className="text-xs font-medium">
                                                  Whisker Box Width
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Overall width of the whisker box (in pixels)</p>
                                                    <p className="mt-1">Controls the entire whisker element width</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.whiskerBoxWidth ?? 40}px</span>
                                            </div>
                                            <Slider
                                              id={`whisker-box-width-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.whiskerBoxWidth ?? 40]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'whiskerBoxWidth', values[0])}
                                              min={20}
                                              max={100}
                                              step={5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Whisker Spacing */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`whisker-spacing-${rule.suffix}`} className="text-xs font-medium">
                                                  Gap Between Whiskers
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Distance between whisker plot centers (in pixels)</p>
                                                    <p className="mt-1">Lower = whiskers closer together, Higher = more spread out</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.whiskerSpacing ?? 80}px</span>
                                            </div>
                                            <Slider
                                              id={`whisker-spacing-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.whiskerSpacing ?? 80]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'whiskerSpacing', values[0])}
                                              min={50}
                                              max={200}
                                              step={10}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Whisker Line Width */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`whisker-line-width-${rule.suffix}`} className="text-xs font-medium">
                                                  Whisker Line Thickness
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Thickness of the whisker lines (min/max markers)</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.whiskerLineWidth ?? 2}px</span>
                                            </div>
                                            <Slider
                                              id={`whisker-line-width-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.whiskerLineWidth ?? 2]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'whiskerLineWidth', values[0])}
                                              min={1}
                                              max={5}
                                              step={0.5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Whisker Box Border Width */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`whisker-box-border-${rule.suffix}`} className="text-xs font-medium">
                                                  Box Border Thickness
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Thickness of the box border and median line</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.whiskerBoxBorderWidth ?? 2}px</span>
                                            </div>
                                            <Slider
                                              id={`whisker-box-border-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.whiskerBoxBorderWidth ?? 2]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'whiskerBoxBorderWidth', values[0])}
                                              min={1}
                                              max={5}
                                              step={0.5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Whisker Cap Width */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`whisker-cap-width-${rule.suffix}`} className="text-xs font-medium">
                                                  Whisker Cap Width
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Width of the horizontal caps at min/max (% of box width)</p>
                                                    <p className="mt-1">20% = narrow caps, 50% = wide caps</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.whiskerCapWidth ?? 20}%</span>
                                            </div>
                                            <Slider
                                              id={`whisker-cap-width-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.whiskerCapWidth ?? 20]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'whiskerCapWidth', values[0])}
                                              min={10}
                                              max={50}
                                              step={5}
                                              className="w-full"
                                            />
                                          </div>
                                        </div>

                                        {/* CHART MARGINS */}
                                        <div className="space-y-3 border-b pb-3">
                                          <h5 className="text-xs font-semibold">Chart Margins</h5>

                                          {/* Top Margin */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`chart-margin-top-${rule.suffix}`} className="text-xs font-medium">
                                                Top Margin
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.chartMarginTop ?? 20}px</span>
                                            </div>
                                            <Slider
                                              id={`chart-margin-top-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.chartMarginTop ?? 20]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'chartMarginTop', values[0])}
                                              min={0}
                                              max={60}
                                              step={5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Right Margin */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`chart-margin-right-${rule.suffix}`} className="text-xs font-medium">
                                                Right Margin
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.chartMarginRight ?? 30}px</span>
                                            </div>
                                            <Slider
                                              id={`chart-margin-right-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.chartMarginRight ?? 30]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'chartMarginRight', values[0])}
                                              min={0}
                                              max={100}
                                              step={5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Left Margin */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`chart-margin-left-${rule.suffix}`} className="text-xs font-medium">
                                                Left Margin
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.chartMarginLeft ?? 40}px</span>
                                            </div>
                                            <Slider
                                              id={`chart-margin-left-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.chartMarginLeft ?? 40]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'chartMarginLeft', values[0])}
                                              min={0}
                                              max={100}
                                              step={5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Bottom Margin */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`chart-margin-bottom-${rule.suffix}`} className="text-xs font-medium">
                                                Bottom Margin
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.chartMarginBottom ?? 80}px</span>
                                            </div>
                                            <Slider
                                              id={`chart-margin-bottom-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.chartMarginBottom ?? 80]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'chartMarginBottom', values[0])}
                                              min={40}
                                              max={150}
                                              step={10}
                                              className="w-full"
                                            />
                                          </div>
                                        </div>

                                        {/* ERROR BAR STYLING */}
                                        <div className="space-y-3 border-b pb-3">
                                          <h5 className="text-xs font-semibold">Error Bar Styling</h5>

                                          {/* Error Bar Width */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`error-bar-width-${rule.suffix}`} className="text-xs font-medium">
                                                Error Bar Cap Width
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.errorBarWidth ?? 4}px</span>
                                            </div>
                                            <Slider
                                              id={`error-bar-width-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.errorBarWidth ?? 4]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'errorBarWidth', values[0])}
                                              min={2}
                                              max={10}
                                              step={1}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* Error Bar Stroke Width */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`error-bar-stroke-${rule.suffix}`} className="text-xs font-medium">
                                                Error Bar Line Thickness
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.errorBarStrokeWidth ?? 2}px</span>
                                            </div>
                                            <Slider
                                              id={`error-bar-stroke-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.errorBarStrokeWidth ?? 2]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'errorBarStrokeWidth', values[0])}
                                              min={1}
                                              max={5}
                                              step={0.5}
                                              className="w-full"
                                            />
                                          </div>
                                        </div>

                                        {/* AXIS LABEL STYLING */}
                                        <div className="space-y-3 border-b pb-3">
                                          <h5 className="text-xs font-semibold">Axis Label Styling</h5>

                                          {/* X-Axis Label Rotation */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`x-axis-rotation-${rule.suffix}`} className="text-xs font-medium">
                                                X-Axis Label Rotation
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.xAxisLabelRotation ?? -45}°</span>
                                            </div>
                                            <Slider
                                              id={`x-axis-rotation-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.xAxisLabelRotation ?? -45]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'xAxisLabelRotation', values[0])}
                                              min={-90}
                                              max={0}
                                              step={5}
                                              className="w-full"
                                            />
                                          </div>

                                          {/* X-Axis Label Font Size */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`x-axis-font-${rule.suffix}`} className="text-xs font-medium">
                                                X-Axis Label Font Size
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.xAxisLabelFontSize ?? 11}px</span>
                                            </div>
                                            <Slider
                                              id={`x-axis-font-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.xAxisLabelFontSize ?? 11]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'xAxisLabelFontSize', values[0])}
                                              min={8}
                                              max={16}
                                              step={1}
                                              className="w-full"
                                            />
                                          </div>


                                          {/* X-Axis Label Second Line Offset */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Label htmlFor={`x-axis-offset-${rule.suffix}`} className="text-xs font-medium">
                                                  X-Axis 2nd Line Alignment
                                                </Label>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="max-w-xs text-xs">
                                                    <p>Horizontal offset for second line of X-axis label (e.g., [Farm-L 1-NE-3])</p>
                                                    <p className="mt-1">Positive values shift right (align with first line), negative shifts left</p>
                                                  </TooltipContent>
                                                </Tooltip>
                                              </div>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.xAxisLabelSecondLineOffset ?? 0}px</span>
                                            </div>
                                            <Slider
                                              id={`x-axis-offset-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.xAxisLabelSecondLineOffset ?? 0]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'xAxisLabelSecondLineOffset', values[0])}
                                              min={-20}
                                              max={20}
                                              step={1}
                                              className="w-full"
                                            />
                                          </div>
                                          {/* Y-Axis Label Font Size */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <Label htmlFor={`y-axis-font-${rule.suffix}`} className="text-xs font-medium">
                                                Y-Axis Label Font Size
                                              </Label>
                                              <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.yAxisLabelFontSize ?? 12}px</span>
                                            </div>
                                            <Slider
                                              id={`y-axis-font-${rule.suffix}`}
                                              value={[rule.properties.spotSample?.yAxisLabelFontSize ?? 12]}
                                              onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'yAxisLabelFontSize', values[0])}
                                              min={8}
                                              max={16}
                                              step={1}
                                              className="w-full"
                                            />
                                          </div>
                                        </div>

                                        {/* CHART HEIGHT */}
                                        <div className="space-y-1.5">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                              <Label htmlFor={`spot-chart-height-${rule.suffix}`} className="text-xs font-medium">
                                                Chart Height
                                              </Label>
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="max-w-xs text-xs">
                                                  <p>Height of each parameter chart</p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{rule.properties.spotSample?.chartHeight ?? 350}px</span>
                                          </div>
                                          <Slider
                                            id={`spot-chart-height-${rule.suffix}`}
                                            value={[rule.properties.spotSample?.chartHeight ?? 350]}
                                            onValueChange={(values) => handleSpotSamplePropertyChange(rule.suffix, 'chartHeight', values[0])}
                                            min={200}
                                            max={600}
                                            step={25}
                                            className="w-full"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-2 border-t">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleCancelChanges(rule.suffix)}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        className="flex-1"
                                        onClick={handleSaveChanges}
                                      >
                                        Confirm
                                      </Button>
                                    </div>
                                  </div>
                                </TooltipProvider>
                              </PopoverContent>
                            </Popover>
                          )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
