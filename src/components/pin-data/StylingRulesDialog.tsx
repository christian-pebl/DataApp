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
}

// Define the styling rules structure
export interface StyleRule {
  suffix: string;
  styleName: string;
  description: string;
  enabled: boolean;
  properties: StyleProperties;
}

// Default styling rules - can be expanded
export const DEFAULT_STYLE_RULES: StyleRule[] = [
  {
    suffix: "_24hr.csv",
    styleName: "24hr_style",
    description: "24-hour aggregated data styling with dual y-axes showing DPM and detection rate percentage",
    enabled: true,
    properties: {
      xAxisRange: { min: "00:00", max: "24:00" },
      xAxisTitle: "time",
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
      xAxisTitlePosition: 40, // Default X-axis title position from bottom
      xAxisTitleMargin: 10 // Default margin between X-axis title and plot
    }
  },
  // Add more rules as needed
];

interface StylingRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleRules: StyleRule[];
  onStyleRuleToggle: (suffix: string, enabled: boolean) => void;
  onStyleRuleUpdate?: (suffix: string, properties: Partial<StyleProperties>) => void;
}

export function StylingRulesDialog({
  open,
  onOpenChange,
  styleRules,
  onStyleRuleToggle,
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
  } | null>(null);

  // Draggable dialog state
  const [position, setPosition] = useState({ x: 0, y: -30 }); // Start slightly higher
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dialogRef = React.useRef<HTMLDivElement>(null);

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

  const handleEditClick = (rule: StyleRule) => {
    // Store original values for potential revert
    setOriginalValues({
      leftWidth: rule.properties.yAxisWidth || 80,
      rightWidth: rule.properties.secondaryYAxis?.width || 80,
      gap: rule.properties.plotToParametersGap || 12,
      rightMargin: rule.properties.chartRightMargin || 80,
      xAxisTitlePosition: rule.properties.xAxisTitlePosition || 40,
      xAxisTitleMargin: rule.properties.xAxisTitleMargin || 10
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

  const handleSaveChanges = () => {
    // Changes are already applied, just close
    setEditingRule(null);
    setOriginalValues(null);
  };

  const handleCancelChanges = (suffix: string) => {
    // Revert to original values
    if (originalValues && onStyleRuleUpdate) {
      onStyleRuleUpdate(suffix, {
        yAxisWidth: originalValues.leftWidth,
        plotToParametersGap: originalValues.gap,
        chartRightMargin: originalValues.rightMargin,
        xAxisTitlePosition: originalValues.xAxisTitlePosition,
        xAxisTitleMargin: originalValues.xAxisTitleMargin,
        secondaryYAxis: {
          ...styleRules.find(r => r.suffix === suffix)?.properties.secondaryYAxis,
          width: originalValues.rightWidth,
          enabled: styleRules.find(r => r.suffix === suffix)?.properties.secondaryYAxis?.enabled || false,
          title: styleRules.find(r => r.suffix === suffix)?.properties.secondaryYAxis?.title || "",
          divideBy: styleRules.find(r => r.suffix === suffix)?.properties.secondaryYAxis?.divideBy || 60
        }
      });
    }
    setEditingRule(null);
    setOriginalValues(null);
  };

  // Reset position when dialog opens
  React.useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: -30 });
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
          <DialogDescription>
            Configure automatic styling rules applied to stacked plots based on file suffixes.
            These rules are applied by default when plots are loaded but can be toggled on/off.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {styleRules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No styling rules configured yet.</p>
              <p className="text-xs mt-2">Styling rules will appear here once defined.</p>
            </div>
          ) : (
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
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground leading-relaxed flex-1">{rule.description}</p>

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
                                    <div>
                                      <h4 className="text-sm font-semibold">Adjust Layout & Spacing</h4>
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
                                        <span className="text-xs text-muted-foreground">{rule.properties.xAxisTitlePosition || 40}px</span>
                                      </div>
                                      <Slider
                                        id={`x-title-pos-${rule.suffix}`}
                                        value={[rule.properties.xAxisTitlePosition || 40]}
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
                                        <span className="text-xs text-muted-foreground">{rule.properties.xAxisTitleMargin || 10}px</span>
                                      </div>
                                      <Slider
                                        id={`x-title-margin-${rule.suffix}`}
                                        value={[rule.properties.xAxisTitleMargin || 10]}
                                        onValueChange={(values) => handleXAxisTitleMarginChange(rule.suffix, values[0])}
                                        min={0}
                                        max={30}
                                        step={2}
                                        className="w-full"
                                      />
                                    </div>

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

                        <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 p-2 rounded border">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="mt-4 p-3 bg-muted/50 rounded-md border">
          <div className="flex items-start gap-2">
            <Palette className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold mb-1">How Styling Rules Work:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Rules are automatically applied when files matching the suffix are loaded</li>
                <li>Each file suffix can have its own unique styling configuration</li>
                <li>Toggle rules on/off to control which styling is applied</li>
                <li>More styling options will be added in future updates</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
