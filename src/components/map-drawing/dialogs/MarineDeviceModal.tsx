'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Database } from 'lucide-react';
import { PinMarineDeviceData } from '@/components/pin-data/PinMarineDeviceData';
import type { PinFile } from '@/lib/supabase/file-storage-service';

interface AvailableProject {
  id: string;
  name: string;
}

export interface MarineDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFileType: 'GP' | 'FPOD' | 'Subcam' | null;
  selectedFiles: File[];
  isLoadingFromSavedPlot: boolean;
  onRequestFileSelection: () => void;
  availableFilesForPlots: PinFile[];
  onDownloadFile: (fileId: string) => void;
  objectGpsCoords: { lat: number; lng: number } | undefined;
  objectName: string;
  multiFileMergeMode: boolean;
  allProjectFilesForTimeline: PinFile[];
  getFileDateRange: (fileId: string) => { start: Date; end: Date } | null;
  projectId: string;
  onRefreshFiles: () => void;
  availableProjects: AvailableProject[];
  onClose: () => void;
}

export function MarineDeviceModal({
  open,
  onOpenChange,
  selectedFileType,
  selectedFiles,
  isLoadingFromSavedPlot,
  onRequestFileSelection,
  availableFilesForPlots,
  onDownloadFile,
  objectGpsCoords,
  objectName,
  multiFileMergeMode,
  allProjectFilesForTimeline,
  getFileDateRange,
  projectId,
  onRefreshFiles,
  availableProjects,
  onClose,
}: MarineDeviceModalProps) {
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="max-w-6xl h-[80vh] marine-device-modal" data-marine-modal>
        <DialogHeader className="sr-only">
          <DialogTitle>
            {selectedFileType ? `${selectedFileType} Data Analysis` : 'Data Viewer'}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {selectedFileType && (selectedFiles.length > 0 || sessionStorage.getItem('pebl-load-plot-view') || isLoadingFromSavedPlot) ? (
            <PinMarineDeviceData
              fileType={selectedFileType}
              files={selectedFiles}
              onRequestFileSelection={onRequestFileSelection}
              availableFiles={availableFilesForPlots}
              onDownloadFile={onDownloadFile}
              objectLocation={objectGpsCoords}
              objectName={objectName}
              multiFileMergeMode={multiFileMergeMode}
              allProjectFilesForTimeline={allProjectFilesForTimeline}
              getFileDateRange={getFileDateRange}
              projectId={projectId}
              onRefreshFiles={onRefreshFiles}
              availableProjects={availableProjects}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div className="text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No files selected</p>
                <p className="text-sm">Select a file type to begin analysis</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
