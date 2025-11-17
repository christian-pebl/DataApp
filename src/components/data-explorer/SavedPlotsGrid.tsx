'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Clock, MoreVertical, FolderOpenDot, Trash2, Loader2, AlertTriangle, FolderOpen, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SavedPlotView } from '@/lib/supabase/plot-view-types';

interface SavedPlotsGridProps {
  plots: SavedPlotView[];
  onPlotClick: (plot: SavedPlotView) => void;
  onPlotDelete: (plotId: string) => Promise<void>;
  onPlotEdit?: (plot: SavedPlotView) => void;
  isCompact?: boolean; // For panel view vs full page view
}

/**
 * SavedPlotsGrid Component
 *
 * Displays a grid of saved plot view cards with actions (open, delete).
 * Extracted from data-explorer page for reusability.
 *
 * Used in:
 * - Data Explorer Panel (compact mode)
 * - Data Explorer Page (full mode)
 */
export function SavedPlotsGrid({
  plots,
  onPlotClick,
  onPlotDelete,
  onPlotEdit,
  isCompact = false
}: SavedPlotsGridProps) {
  const { toast } = useToast();
  const [plotToDelete, setPlotToDelete] = useState<SavedPlotView | null>(null);
  const [deletingPlotId, setDeletingPlotId] = useState<string | null>(null);

  const handleDeletePlot = async () => {
    if (!plotToDelete) return;

    setDeletingPlotId(plotToDelete.id);

    try {
      await onPlotDelete(plotToDelete.id);

      toast({
        title: "Plot Deleted",
        description: `"${plotToDelete.name}" has been deleted`
      });
    } catch (error) {
      console.error('❌ [SavedPlotsGrid] Error deleting plot:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete plot"
      });
    } finally {
      setDeletingPlotId(null);
      setPlotToDelete(null);
    }
  };

  if (plots.length === 0) {
    return (
      <div className="text-center py-8">
        <FolderOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-sm font-medium text-muted-foreground">No saved plots yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Create and save plot configurations to see them here
        </p>
      </div>
    );
  }

  return (
    <>
      {isCompact ? (
        // Compact one-line view
        <div className="space-y-2">
          {plots.map((plot) => (
            <Card key={plot.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0 flex items-center gap-3">
                    <h4 className="text-sm font-medium truncate" title={plot.name}>
                      {plot.name}
                    </h4>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {plot.view_config.metadata.totalPlots} {plot.view_config.metadata.totalPlots === 1 ? 'plot' : 'plots'}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(plot.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onPlotClick(plot)}
                      className="h-7 text-xs px-3"
                      disabled={deletingPlotId === plot.id}
                    >
                      Open
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={deletingPlotId === plot.id}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onPlotClick(plot)}>
                          <FolderOpenDot className="h-3.5 w-3.5 mr-2" />
                          Open
                        </DropdownMenuItem>
                        {onPlotEdit && (
                          <DropdownMenuItem onClick={() => onPlotEdit(plot)}>
                            <Edit className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setPlotToDelete(plot)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Full card grid view - Single line layout
        <div className="grid grid-cols-1 gap-2">
          {plots.map((plot) => (
            <Card key={plot.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-2">
                <div className="flex items-center gap-3">
                  {/* Plot Name */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium truncate" title={plot.name}>
                      {plot.name}
                    </h4>
                  </div>

                  {/* Description - truncated to one line */}
                  {plot.description && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate" title={plot.description}>
                        {plot.description}
                      </p>
                    </div>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Clock className="h-3 w-3" />
                    <span className="whitespace-nowrap">{format(new Date(plot.created_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>

                  {/* Plot count */}
                  <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                    {plot.view_config.metadata.totalPlots} {plot.view_config.metadata.totalPlots === 1 ? 'plot' : 'plots'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onPlotClick(plot)}
                      className="h-7 text-xs px-3"
                      disabled={deletingPlotId === plot.id}
                    >
                      Open
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={deletingPlotId === plot.id}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onPlotClick(plot)}>
                          <FolderOpenDot className="h-3.5 w-3.5 mr-2" />
                          Open
                        </DropdownMenuItem>
                        {onPlotEdit && (
                          <DropdownMenuItem onClick={() => onPlotEdit(plot)}>
                            <Edit className="h-3.5 w-3.5 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => setPlotToDelete(plot)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!plotToDelete} onOpenChange={(open) => !open && setPlotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Saved Plot
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>&quot;{plotToDelete?.name}&quot;</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingPlotId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePlot}
              disabled={!!deletingPlotId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPlotId ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
