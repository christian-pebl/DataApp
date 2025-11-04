'use client';

import React, { useState } from 'react';
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
import { Calendar } from 'lucide-react';

interface DateInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  suggestedDate?: Date | null;
  onDateConfirm: (date: string) => void;
  onCancel: () => void;
  // Batch mode props
  isBatchMode?: boolean;
  batchFileCount?: number;
}

export function DateInputDialog({
  open,
  onOpenChange,
  fileName,
  suggestedDate,
  onDateConfirm,
  onCancel,
  isBatchMode = false,
  batchFileCount = 1
}: DateInputDialogProps) {
  // Format date as DD/MM/YYYY
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const [dateInput, setDateInput] = useState<string>(
    suggestedDate ? formatDate(suggestedDate) : formatDate(new Date())
  );
  const [error, setError] = useState<string>('');

  const validateDate = (input: string): boolean => {
    // Check format DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = input.match(dateRegex);

    if (!match) {
      setError('Invalid format. Use DD/MM/YYYY');
      return false;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    // Validate ranges
    if (month < 1 || month > 12) {
      setError('Month must be between 01 and 12');
      return false;
    }

    if (day < 1 || day > 31) {
      setError('Day must be between 01 and 31');
      return false;
    }

    if (year < 1900 || year > 2100) {
      setError('Year must be between 1900 and 2100');
      return false;
    }

    // Check if valid date (e.g., not 31/02/2025)
    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      setError('Invalid date (e.g., 31/02/2025 doesn\'t exist)');
      return false;
    }

    setError('');
    return true;
  };

  const handleConfirm = () => {
    if (validateDate(dateInput)) {
      onDateConfirm(dateInput);
    }
  };

  const handleCancel = () => {
    setError('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Required for Upload
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-2">
              {isBatchMode ? (
                <>
                  <div>
                    <span className="font-semibold text-foreground">{batchFileCount} files</span> do not contain a date/time column.
                  </div>
                  <div>
                    Please enter the sampling date to add as the first column in all {batchFileCount} files.
                  </div>
                </>
              ) : (
                <>
                  <div>
                    The file <span className="font-semibold text-foreground">{fileName}</span> does not contain a date/time column.
                  </div>
                  <div>
                    Please enter the sampling date to add as the first column in the file.
                  </div>
                </>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="date-input">
              Sampling Date
              {suggestedDate && (
                <span className="text-xs text-muted-foreground ml-2">
                  (extracted from filename)
                </span>
              )}
            </Label>
            <Input
              id="date-input"
              placeholder="DD/MM/YYYY"
              value={dateInput}
              onChange={(e) => {
                setDateInput(e.target.value);
                if (error) setError(''); // Clear error on typing
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm();
                }
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Format: DD/MM/YYYY (e.g., 31/07/2025)
            </p>
          </div>

          {suggestedDate && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold mb-1">Auto-detected Date:</p>
              <p className="text-muted-foreground">
                Based on the filename pattern, the suggested date is <span className="font-semibold text-foreground">{formatDate(suggestedDate)}</span>.
                You can modify it if needed.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel Upload
          </Button>
          <Button onClick={handleConfirm}>
            {isBatchMode ? `Add Date to ${batchFileCount} Files & Upload` : 'Add Date & Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
