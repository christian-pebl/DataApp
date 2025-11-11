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
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2 } from 'lucide-react';
import type { Project } from '@/lib/supabase/types';

export interface DeleteProjectConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectId: string;
  onConfirmDelete: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteProjectConfirmDialog({
  open,
  onOpenChange,
  projectName,
  projectId,
  onConfirmDelete,
  onCancel,
}: DeleteProjectConfirmDialogProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!projectId) {
      toast({
        title: "Error",
        description: "No project selected for deletion.",
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    try {
      await onConfirmDelete();
      toast({
        title: "Project Deleted",
        description: `Project "${projectName}" has been deleted successfully.`,
        duration: 3000
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast({
        title: "Deletion Failed",
        description: error instanceof Error ? error.message : "Failed to delete project. Please try again.",
        variant: "destructive",
        duration: 5000
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Delete Project
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{projectName}"?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive font-medium mb-2">This action will permanently delete:</p>
            <ul className="text-sm text-destructive space-y-1 ml-4 list-disc">
              <li>All pins, lines, and areas in this project</li>
              <li>All uploaded data files</li>
              <li>All project settings and configurations</li>
            </ul>
            <p className="text-sm text-destructive font-medium mt-2">This action cannot be undone.</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
