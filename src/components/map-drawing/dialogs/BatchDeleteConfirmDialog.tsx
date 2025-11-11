'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface SelectedObject {
  id: string;
  type: 'pin' | 'line' | 'area';
  label: string;
}

interface ObjectWithFileCount extends SelectedObject {
  fileCount: number;
}

export interface BatchDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedObjects: ObjectWithFileCount[];
  selectedCount: number;
  onConfirmDelete: () => void;
  onCancel: () => void;
}

export function BatchDeleteConfirmDialog({
  open,
  onOpenChange,
  selectedObjects,
  selectedCount,
  onConfirmDelete,
  onCancel,
}: BatchDeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirm Batch Deletion
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. The following {selectedCount} object{selectedCount !== 1 ? 's' : ''} will be permanently deleted:
          </DialogDescription>
        </DialogHeader>

        {/* List of objects to delete */}
        <div className="max-h-48 overflow-y-auto border rounded p-3 space-y-2">
          {selectedObjects.map(obj => (
            <div key={obj.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {obj.type === 'pin' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                {obj.type === 'line' && <div className="w-3 h-0.5 bg-green-500"></div>}
                {obj.type === 'area' && <div className="w-2 h-2 bg-red-500/30 border border-red-500"></div>}
                <span className="font-medium">{obj.label || `Unnamed ${obj.type}`}</span>
              </div>
              {obj.fileCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  {obj.fileCount} file{obj.fileCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirmDelete}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete {selectedCount} Object{selectedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
