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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FolderOpen, Trash2, AlertTriangle, FileText, Calendar, Loader2, X, Check, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null); // viewId of the confirm popover
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState<string | null>(null); // viewId of the edit dialog
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [sortColumn, setSortColumn] = useState<'name' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
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
    console.log('🗑️ [DELETE-FLOW-1] Delete button clicked for view:', view.name, view.id);
    console.log('🗑️ [DELETE-FLOW-1] Current state:', {
      deletingViewId,
      deleteConfirmOpen,
      isLoading,
      viewsCount: views.length
    });
    e?.preventDefault();
    e?.stopPropagation();

    // Open the confirmation popover for this specific view
    console.log('🗑️ [DELETE-FLOW-2] Opening confirmation popover for:', view.id);
    setDeleteConfirmOpen(view.id);
  }, [deletingViewId, deleteConfirmOpen, isLoading, views.length]);

  const handleDeleteConfirm = useCallback(async (view: SavedPlotView) => {
    console.log('✅ [DELETE-FLOW-3] Confirming delete for view:', view.name, view.id);
    console.log('✅ [DELETE-FLOW-3] Current state before delete:', {
      deletingViewId,
      deleteConfirmOpen,
      isLoading
    });

    // Close the popover first
    setDeleteConfirmOpen(null);

    // Set deleting state
    console.log('🔄 [DELETE-FLOW-4] Setting deletingViewId to:', view.id);
    setDeletingViewId(view.id);

    try {
      console.log('📡 [DELETE-FLOW-5] Importing plot view service...');
      const { plotViewService } = await import('@/lib/supabase/plot-view-service');

      console.log('📡 [DELETE-FLOW-6] Calling deletePlotView service for:', view.id);
      const result = await plotViewService.deletePlotView(view.id);

      console.log('📡 [DELETE-FLOW-7] Delete service result:', result);

      if (result.success) {
        console.log('✅ [DELETE-FLOW-8] Delete successful, showing toast');
        toast({
          title: "View Deleted",
          description: `"${view.name}" has been deleted`
        });

        console.log('🔄 [DELETE-FLOW-9] Reloading views...');
        await loadViews();
        console.log('✅ [DELETE-FLOW-10] Views reloaded successfully');
      } else {
        console.error('❌ [DELETE-FLOW-ERROR-1] Delete failed:', result.error);
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: result.error || "Failed to delete view"
        });
      }
    } catch (error) {
      console.error('❌ [DELETE-FLOW-ERROR-2] Exception during delete:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      console.log('🧹 [DELETE-FLOW-11] Cleanup: clearing deletingViewId');
      setDeletingViewId(null);
    }
  }, [deletingViewId, deleteConfirmOpen, isLoading, toast, loadViews]);

  const handleDeleteCancel = useCallback((viewId: string) => {
    console.log('❌ [DELETE-FLOW-CANCEL] User cancelled delete for:', viewId);
    setDeleteConfirmOpen(null);
  }, []);

  const handleEditClick = useCallback((view: SavedPlotView, e?: React.MouseEvent) => {
    console.log('✏️ [EDIT-FLOW-1] Edit button clicked for view:', view.name, view.id);
    e?.preventDefault();
    e?.stopPropagation();

    // Set the current values for editing
    setEditName(view.name);
    setEditDescription(view.description || "");
    setEditDialogOpen(view.id);
  }, []);

  const handleEditSave = useCallback(async (view: SavedPlotView) => {
    console.log('✅ [EDIT-FLOW-2] Saving edits for view:', view.name, view.id);

    // Close the dialog first
    setEditDialogOpen(null);

    // Set editing state
    setEditingViewId(view.id);

    try {
      const { plotViewService } = await import('@/lib/supabase/plot-view-service');

      const result = await plotViewService.updatePlotView(view.id, {
        name: editName.trim() || view.name, // Fallback to original if empty
        description: editDescription.trim() || undefined
      });

      if (result.success) {
        toast({
          title: "View Updated",
          description: `"${editName}" has been updated successfully`
        });

        // Reload views to show the updated data
        await loadViews();
      } else {
        toast({
          variant: "destructive",
          title: "Update Failed",
          description: result.error || "Failed to update view"
        });
      }
    } catch (error) {
      console.error('❌ [EDIT-FLOW-ERROR] Exception during update:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred"
      });
    } finally {
      setEditingViewId(null);
    }
  }, [editName, editDescription, toast, loadViews]);

  const handleEditCancel = useCallback((viewId: string) => {
    console.log('❌ [EDIT-FLOW-CANCEL] User cancelled edit for:', viewId);
    setEditDialogOpen(null);
  }, []);

  const handleSort = useCallback((column: 'name' | 'created_at') => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending for name, descending for created_at
      setSortColumn(column);
      setSortDirection(column === 'name' ? 'asc' : 'desc');
    }
  }, [sortColumn]);

  // Sorted views
  const sortedViews = React.useMemo(() => {
    const sorted = [...views].sort((a, b) => {
      if (sortColumn === 'name') {
        const comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        // created_at
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });
    return sorted;
  }, [views, sortColumn, sortDirection]);

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
                    <TableHead className="w-[200px]">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                      >
                        Name
                        {sortColumn === 'name' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]">Plots</TableHead>
                    <TableHead className="w-[150px]">
                      <button
                        onClick={() => handleSort('created_at')}
                        className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                      >
                        Created
                        {sortColumn === 'created_at' ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="w-[180px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedViews.map((view) => (
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

                          <Popover
                            open={editDialogOpen === view.id}
                            onOpenChange={(open) => {
                              if (!open) {
                                setEditDialogOpen(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleEditClick(view, e)}
                                disabled={editingViewId === view.id || isLoading}
                                className="h-8"
                                title={`Edit ${view.name}`}
                              >
                                {editingViewId === view.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Pencil className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-80 p-4"
                              side="left"
                              align="center"
                              onOpenAutoFocus={(e) => {
                                e.preventDefault();
                              }}
                            >
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-sm mb-3">Edit Plot View</h4>

                                  <div className="space-y-3">
                                    <div className="space-y-1.5">
                                      <Label htmlFor="edit-name" className="text-xs">
                                        Name
                                      </Label>
                                      <Input
                                        id="edit-name"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        placeholder="Enter view name"
                                        className="h-8"
                                      />
                                    </div>

                                    <div className="space-y-1.5">
                                      <Label htmlFor="edit-description" className="text-xs">
                                        Description
                                      </Label>
                                      <Textarea
                                        id="edit-description"
                                        value={editDescription}
                                        onChange={(e) => setEditDescription(e.target.value)}
                                        placeholder="Enter description (optional)"
                                        className="min-h-[60px] text-sm"
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditCancel(view.id)}
                                    className="h-8"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleEditSave(view)}
                                    disabled={!editName.trim()}
                                    className="h-8"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Save
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>

                          <Popover
                            open={deleteConfirmOpen === view.id}
                            onOpenChange={(open) => {
                              console.log('🔔 [POPOVER] onOpenChange:', open, 'for view:', view.id);
                              if (!open) {
                                setDeleteConfirmOpen(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  console.log('🖱️ [POPOVER-TRIGGER] Button clicked! State:', {
                                    viewId: view.id,
                                    viewName: view.name,
                                    deletingViewId,
                                    deleteConfirmOpen,
                                    isLoading,
                                    disabled: deletingViewId === view.id || isLoading
                                  });
                                  handleDeleteClick(view, e);
                                }}
                                disabled={deletingViewId === view.id || isLoading}
                                className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title={`Delete ${view.name}`}
                              >
                                {deletingViewId === view.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-64 p-4"
                              side="left"
                              align="center"
                              onOpenAutoFocus={(e) => {
                                console.log('🔔 [POPOVER] onOpenAutoFocus');
                                e.preventDefault();
                              }}
                            >
                              <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-sm">Delete Plot View?</h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Delete <strong>{view.name}</strong>? This cannot be undone.
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      console.log('❌ [POPOVER] Cancel clicked');
                                      handleDeleteCancel(view.id);
                                    }}
                                    className="h-8"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      console.log('✅ [POPOVER] Delete confirmed clicked');
                                      handleDeleteConfirm(view);
                                    }}
                                    className="h-8"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
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
    </>
  );
}
