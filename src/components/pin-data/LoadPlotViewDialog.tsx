"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { FolderOpen, Trash2, AlertTriangle, FileText, Calendar, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { SavedPlotView, PlotViewValidationResult } from "@/lib/supabase/plot-view-types";

interface LoadPlotViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onLoad: (view: SavedPlotView, validation: PlotViewValidationResult) => void;
}

export function LoadPlotViewDialog({
  open,
  onOpenChange,
  projectId,
  onLoad
}: LoadPlotViewDialogProps) {
  const [views, setViews] = useState<SavedPlotView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingViewId, setDeletingViewId] = useState<string | null>(null);
  const [viewToDelete, setViewToDelete] = useState<SavedPlotView | null>(null);
  const { toast } = useToast();

  const loadViews = useCallback(async () => {
    setIsLoading(true);

    try {
      const { plotViewService } = await import('@/lib/supabase/plot-view-service');
      const result = await plotViewService.listPlotViews(projectId);

      if (result.success && result.data) {
        setViews(result.data);
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Load Views",
          description: result.error || "Could not load saved plot views"
        });
      }
    } catch (error) {
      console.error('❌ Error loading plot views:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId]); // Removed toast from dependencies

  // Load views when dialog opens
  useEffect(() => {
    if (open) {
      loadViews();
    }
  }, [open, loadViews]);

  const handleLoadView = async (view: SavedPlotView) => {
    console.log('📂 Loading plot view:', view.name);

    try {
      const { plotViewService } = await import('@/lib/supabase/plot-view-service');

      // Validate the view first
      const validation = await plotViewService.validatePlotView(view.view_config);

      if (!validation.valid) {
        toast({
          variant: "destructive",
          title: "Cannot Load View",
          description: "This view references files that are no longer available"
        });
        return;
      }

      if (validation.warnings.length > 0) {
        // Show warnings but allow loading
        console.warn('⚠️ Validation warnings:', validation.warnings);
      }

      // Close dialog and pass view to parent
      onOpenChange(false);
      onLoad(view, validation);

      toast({
        title: "Plot View Loaded",
        description: `"${view.name}" has been loaded successfully`
      });

    } catch (error) {
      console.error('❌ Error loading plot view:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load plot view"
      });
    }
  };

  const handleDeleteClick = useCallback((view: SavedPlotView, e?: React.MouseEvent) => {
    console.log('🗑️ Delete button clicked for view:', view.name);
    e?.preventDefault();
    e?.stopPropagation();

    // Set the view to delete, which will open the AlertDialog
    setViewToDelete(view);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!viewToDelete) return;

    console.log('✅ Confirming delete for view:', viewToDelete.name);
    setDeletingViewId(viewToDelete.id);

    try {
      const { plotViewService } = await import('@/lib/supabase/plot-view-service');
      const result = await plotViewService.deletePlotView(viewToDelete.id);

      if (result.success) {
        toast({
          title: "View Deleted",
          description: `"${viewToDelete.name}" has been deleted`
        });

        // Reload views
        await loadViews();
      } else {
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: result.error || "Failed to delete view"
        });
      }
    } catch (error) {
      console.error('❌ Error deleting view:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setDeletingViewId(null);
      setViewToDelete(null);
    }
  }, [viewToDelete, toast, loadViews]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Load Plot View
            </DialogTitle>
            <DialogDescription>
              Select a saved plot view to restore your configuration
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <div className="animate-spin text-3xl mb-2">⏳</div>
                  <p className="text-sm">Loading saved views...</p>
                </div>
              </div>
            ) : views.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm font-medium">No saved plot views</p>
                <p className="text-xs mt-1">Save your current plot configuration to see it here</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Plots</TableHead>
                    <TableHead className="w-[150px]">Created</TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {views.map((view) => (
                    <TableRow key={view.id}>
                      <TableCell className="font-medium">
                        {view.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {view.description || (
                          <span className="italic">No description</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {view.view_config.metadata.totalPlots} {view.view_config.metadata.totalPlots === 1 ? 'plot' : 'plots'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(view.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadView(view)}
                            className="h-8"
                          >
                            <FolderOpen className="h-3.5 w-3.5 mr-1" />
                            Load
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              console.log('🖱️ Button clicked! State:', {
                                viewId: view.id,
                                viewName: view.name,
                                deletingViewId,
                                isLoading,
                                disabled: deletingViewId === view.id || isLoading
                              });
                              handleDeleteClick(view, e);
                            }}
                            disabled={deletingViewId === view.id || isLoading}
                            className="h-8 text-destructive hover:text-destructive"
                            title={`Delete ${view.name}`}
                          >
                            {deletingViewId === view.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
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

      {/* Delete Confirmation Dialog - Render separately to avoid conflicts */}
      {viewToDelete && (
        <AlertDialog
          open={true}
          onOpenChange={(isOpen) => {
            console.log('🔔 AlertDialog onOpenChange:', isOpen);
            if (!isOpen && !deletingViewId) {
              console.log('🔔 Closing AlertDialog, clearing viewToDelete');
              setViewToDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Plot View
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>"{viewToDelete.name}"</strong>?
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                disabled={!!deletingViewId}
                onClick={() => {
                  console.log('🔔 Cancel clicked');
                  setViewToDelete(null);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  console.log('🔔 Delete clicked');
                  handleDeleteConfirm();
                }}
                disabled={!!deletingViewId}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingViewId ? (
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
      )}
    </>
  );
}
