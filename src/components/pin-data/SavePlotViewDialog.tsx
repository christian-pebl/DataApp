"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Save, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SavedPlotViewConfig } from "@/lib/supabase/plot-view-types";

interface SavePlotViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewConfig: SavedPlotViewConfig;
  projectId: string;
  pinId?: string;
  onSaveSuccess?: () => void;
}

export function SavePlotViewDialog({
  open,
  onOpenChange,
  viewConfig,
  projectId,
  pinId,
  onSaveSuccess
}: SavePlotViewDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Name Required",
        description: "Please enter a name for this plot view"
      });
      return;
    }

    setIsSaving(true);

    try {
      // Import the service dynamically
      const { plotViewService } = await import('@/lib/supabase/plot-view-service');

      const result = await plotViewService.savePlotView({
        project_id: projectId,
        pin_id: pinId,
        name: name.trim(),
        description: description.trim() || undefined,
        view_config: viewConfig
      });

      if (result.success) {
        toast({
          title: "Plot View Saved",
          description: `"${name}" has been saved successfully`
        });

        // Reset form
        setName("");
        setDescription("");

        // Close dialog
        onOpenChange(false);

        // Notify parent
        onSaveSuccess?.();
      } else {
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: result.error || "Failed to save plot view"
        });
      }
    } catch (error) {
      console.error('❌ Error saving plot view:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred while saving"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Save Plot View
          </DialogTitle>
          <DialogDescription>
            Save the current plot configuration to load it again later
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="view-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="view-name"
              placeholder="e.g., Weekly Analysis - Station A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={isSaving}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="view-description">Description (Optional)</Label>
            <Textarea
              id="view-description"
              placeholder="Add notes about this view..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={isSaving}
            />
          </div>

          {/* Preview Card */}
          <div className="space-y-2 p-3 bg-muted/50 rounded-md border">
            <h4 className="text-sm font-semibold">What will be saved:</h4>
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {viewConfig.metadata.totalPlots} {viewConfig.metadata.totalPlots === 1 ? 'plot' : 'plots'}
                </Badge>
                <span className="text-muted-foreground">
                  {viewConfig.timeAxisMode === 'common' ? 'Common' : 'Separate'} time axis
                </span>
              </div>
              <div className="text-muted-foreground">
                <strong>Datasets:</strong> {viewConfig.metadata.datasetNames.slice(0, 3).join(', ')}
                {viewConfig.metadata.datasetNames.length > 3 && ` +${viewConfig.metadata.datasetNames.length - 3} more`}
              </div>
              {viewConfig.metadata.dateRangeDisplay && (
                <div className="text-muted-foreground">
                  <strong>Date range:</strong> {viewConfig.metadata.dateRangeDisplay}
                </div>
              )}
            </div>
          </div>

          {/* Warning about file dependencies */}
          {viewConfig.plots.some(p => p.type === 'device') && (
            <div className="flex items-start gap-2 p-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                This view references uploaded files. If these files are deleted or modified,
                you may not be able to fully restore this view.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save View
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
