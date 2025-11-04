'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

interface BatchDateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileNames: string[];
  onConfirmSameDate: () => void;
  onConfirmDifferentDates: () => void;
  onCancel: () => void;
}

export function BatchDateConfirmDialog({
  open,
  onOpenChange,
  fileNames,
  onConfirmSameDate,
  onConfirmDifferentDates,
  onCancel
}: BatchDateConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Multiple Files Without Date Columns
          </DialogTitle>
          <DialogDescription>
            The following files do not contain a date/time column and need dates added:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File List */}
          <div className="rounded-lg border bg-muted/10 p-3">
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {fileNames.map((fileName, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium truncate">{fileName}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Question */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <p className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">
              Are all these files from the same sampling date?
            </p>
            <p className="text-xs text-muted-foreground">
              If yes, you can add the same date column to all files at once.
              If no, you'll need to add dates individually for each file.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancel Upload
          </Button>
          <Button
            variant="secondary"
            onClick={onConfirmDifferentDates}
            className="w-full sm:w-auto"
          >
            Different Dates (Add Individually)
          </Button>
          <Button
            onClick={onConfirmSameDate}
            className="w-full sm:w-auto"
          >
            Same Date (Add to All Files)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
