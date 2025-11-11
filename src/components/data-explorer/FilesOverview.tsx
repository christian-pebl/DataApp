'use client';

import { DataTimeline } from "@/components/pin-data/DataTimeline";
import { Loader2, Database } from "lucide-react";
import type { PinFile } from '@/lib/supabase/file-storage-service';

interface FilesOverviewProps {
  files: (PinFile & { pinLabel: string })[];
  isLoading?: boolean;
  onFileClick: (file: PinFile & { pinLabel: string }) => void;
  onFileDelete: (file: PinFile & { pinLabel: string }) => void;
  onFileRename: (file: PinFile & { pinLabel: string }, newName: string) => Promise<boolean>;
  getFileDateRange: (file: PinFile) => Promise<any>;
}

/**
 * FilesOverview Component
 *
 * Displays a timeline view of all user files with actions (click, delete, rename).
 * Extracted from data-explorer page for reusability.
 *
 * Used in:
 * - Data Explorer Panel
 * - Data Explorer Page
 */
export function FilesOverview({
  files,
  isLoading,
  onFileClick,
  onFileDelete,
  onFileRename,
  getFileDateRange
}: FilesOverviewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading files...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8 border rounded-md bg-muted/20">
        <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No uploaded files found</p>
        <p className="text-sm mt-1">Upload device data files to see them here</p>
      </div>
    );
  }

  return (
    <DataTimeline
      files={files}
      getFileDateRange={getFileDateRange}
      onFileClick={onFileClick}
      onDeleteFile={onFileDelete}
      onRenameFile={onFileRename}
    />
  );
}
