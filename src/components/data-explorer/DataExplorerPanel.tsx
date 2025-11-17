'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Bookmark, Database } from "lucide-react";
import { FilesOverview } from './FilesOverview';
import { SavedPlotsGrid } from './SavedPlotsGrid';
import type { SavedPlotView } from '@/lib/supabase/plot-view-types';
import type { PinFile } from '@/lib/supabase/file-storage-service';

interface DataExplorerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Files tab props
  files: (PinFile & { pinLabel: string })[];
  isLoadingFiles?: boolean;
  onFileClick: (file: PinFile & { pinLabel: string }) => void;
  onFileDelete: (file: PinFile & { pinLabel: string }) => void;
  onFileRename: (file: PinFile & { pinLabel: string }, newName: string) => Promise<boolean>;
  getFileDateRange: (file: PinFile) => Promise<any>;
  onOpenStackedPlots?: (files: (PinFile & { pinLabel: string })[]) => void;

  // Saved plots tab props
  savedPlots: SavedPlotView[];
  isLoadingPlots?: boolean;
  onPlotClick: (plot: SavedPlotView) => void;
  onPlotDelete: (plotId: string) => Promise<void>;
  onPlotEdit?: (plot: SavedPlotView) => void;
}

/**
 * DataExplorerPanel Component
 *
 * A slide-out panel that provides access to:
 * - Files Tab: All uploaded files with timeline view
 * - Saved Plots Tab: All saved plot configurations
 *
 * Integrated into the map-drawing page to provide quick access
 * to data without leaving the map context.
 *
 * Features:
 * - Opens from account dropdown menu
 * - Keyboard shortcut: Cmd/Ctrl + D
 * - Responsive design (full screen on mobile, side panel on desktop)
 * - Badge counts for files and plots
 * - Seamless integration with existing Marine Device Modal
 */
export function DataExplorerPanel({
  open,
  onOpenChange,
  files,
  isLoadingFiles,
  onFileClick,
  onFileDelete,
  onFileRename,
  getFileDateRange,
  onOpenStackedPlots,
  savedPlots,
  isLoadingPlots,
  onPlotClick,
  onPlotDelete,
  onPlotEdit,
}: DataExplorerPanelProps) {
  const [activeTab, setActiveTab] = useState<'files' | 'plots'>('files');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[85vw] md:w-[90vw] overflow-y-auto p-0 flex flex-col"
      >
        {/* Header */}
        <div className="p-6 pb-3 border-b">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <SheetTitle className="flex items-center gap-2 text-xl">
                  <Database className="h-5 w-5 text-primary" />
                  Data Explorer
                </SheetTitle>
                <SheetDescription>
                  Browse files and saved plot configurations
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
            <div className="px-6 pt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="files" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Files
                  {files.length > 0 && (
                    <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {files.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="plots" className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  Plots
                  {savedPlots.length > 0 && (
                    <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      {savedPlots.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <TabsContent value="files" className="mt-4 h-full">
                <FilesOverview
                  files={files}
                  isLoading={isLoadingFiles}
                  onFileClick={onFileClick}
                  onFileDelete={onFileDelete}
                  onFileRename={onFileRename}
                  getFileDateRange={getFileDateRange}
                  onOpenStackedPlots={onOpenStackedPlots}
                />
              </TabsContent>

              <TabsContent value="plots" className="mt-4 h-full">
                <SavedPlotsGrid
                  plots={savedPlots}
                  onPlotClick={onPlotClick}
                  onPlotDelete={onPlotDelete}
                  onPlotEdit={onPlotEdit}
                  isCompact={false}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
