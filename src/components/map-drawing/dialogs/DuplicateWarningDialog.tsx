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
import { AlertCircle, Copy, Loader2 } from 'lucide-react';

interface DuplicateFile {
  fileName: string;
  existingFileId: string;
}

export interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateFiles: DuplicateFile[];
  isUploading: boolean;
  onCancel: () => void;
  onReplace: () => void;
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicateFiles,
  isUploading,
  onCancel,
  onReplace,
}: DuplicateWarningDialogProps) {
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            Duplicate Files Detected
          </DialogTitle>
          <DialogDescription>
            The following file{duplicateFiles.length > 1 ? 's' : ''} already exist{duplicateFiles.length === 1 ? 's' : ''} for this pin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show duplicate files */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Duplicate Files:</label>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 max-h-32 overflow-y-auto">
              {duplicateFiles.map((dup, index) => (
                <div key={index} className="text-xs font-mono text-amber-900 dark:text-amber-100 py-1 flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>{dup.fileName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">What would you like to do?</p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-start gap-2">
                <span className="font-bold text-amber-600">Replace:</span>
                <span>Delete existing files and upload new ones</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">Cancel:</span>
                <span>Keep existing files, discard upload</span>
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              Cancel Upload
            </Button>
            <Button
              size="sm"
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={onReplace}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Replacing...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Replace Files
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
