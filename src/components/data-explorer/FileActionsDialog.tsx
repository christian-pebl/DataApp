'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, Info, Trash2, Wand2, Pencil, AlertCircle, Sparkles, BarChart3, Table, Download } from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { ColumnOutlierStats } from '@/lib/outlier-detection';
import { useToast } from '@/hooks/use-toast';

// Lazy load OutlierCleanupDialog - only loads when user clicks "Clean Outliers"
const OutlierCleanupDialog = dynamic(
  () => import('./OutlierCleanupDialog').then(mod => ({ default: mod.OutlierCleanupDialog })),
  { ssr: false, loading: () => <div className="animate-pulse p-4">Loading outlier cleanup...</div> }
);

// Lazy load RawCsvViewer - only loads when user clicks "Open Raw"
const RawCsvViewer = dynamic(
  () => import('./RawCsvViewer').then(mod => ({ default: mod.RawCsvViewer })),
  { ssr: false, loading: () => <div className="animate-pulse p-4">Loading CSV viewer...</div> }
);

interface FileActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    fileName: string;
    projectName?: string | null;
    objectLabel?: string | null;
    deviceType?: string;
    uploadedAt?: Date;
    startDate?: Date | null;
    endDate?: Date | null;
  } | null;
  onRenameSuccess: (fileId: string, newFileName: string) => void;
  onDeleteSuccess?: (fileId: string) => void;
  onOpenFile?: (fileId: string) => void;
  onFileUpdated?: () => void;
}

type DialogMode = 'menu' | 'rename' | 'info' | 'delete' | 'transform';

export function FileActionsDialog({
  open,
  onOpenChange,
  file,
  onRenameSuccess,
  onDeleteSuccess,
  onOpenFile,
  onFileUpdated
}: FileActionsDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<DialogMode>('menu');
  const [newFileName, setNewFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Outlier cleanup state
  const [showOutlierCleanup, setShowOutlierCleanup] = useState(false);
  const [fileData, setFileData] = useState<Array<Record<string, any>> | null>(null);
  const [isFetchingData, setIsFetchingData] = useState(false);

  // Raw CSV viewer state
  const [showRawViewer, setShowRawViewer] = useState(false);

  // Reset state when dialog opens/closes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && file) {
      setMode('menu');
      setNewFileName(file.fileName);
      setError(null);
    } else {
      setMode('menu');
      setNewFileName('');
      setError(null);
    }
    onOpenChange(isOpen);
  };

  const handleRename = async () => {
    if (!file || !newFileName.trim()) {
      setError('File name cannot be empty');
      return;
    }

    // Validate file name
    const invalidChars = /[<>:"|?*\\/]/;
    if (invalidChars.test(newFileName)) {
      setError('File name contains invalid characters: < > : " | ? * \\ /');
      return;
    }

    setIsRenaming(true);
    setError(null);

    try {
      const { renameFileAction } = await import('@/app/data-explorer/actions');
      const result = await renameFileAction(file.id, newFileName);

      if (result.success) {
        onRenameSuccess(file.id, newFileName);
        handleOpenChange(false);
      } else {
        setError(result.error || 'Failed to rename file');
      }
    } catch (err) {
      logger.error('Error renaming file', err, { context: 'FileActionsDialog' });
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDelete = async () => {
    if (!file) return;

    setIsDeleting(true);
    setError(null);

    try {
      const { deleteFileAction } = await import('@/app/data-explorer/actions');
      const result = await deleteFileAction(file.id);

      if (result.success) {
        if (onDeleteSuccess) {
          onDeleteSuccess(file.id);
        }
        handleOpenChange(false);
      } else {
        setError(result.error || 'Failed to delete file');
      }
    } catch (err) {
      logger.error('Error deleting file', err, { context: 'FileActionsDialog' });
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleOpenFile = async () => {
    if (!file) return;

    setIsDownloading(true);
    setError(null);

    try {
      const { downloadFileAction } = await import('@/app/data-explorer/actions');
      const result = await downloadFileAction(file.id);

      if (result.success && result.data) {
        // Create a download link and trigger download
        const url = window.URL.createObjectURL(result.data.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        handleOpenChange(false);
      } else {
        setError(result.error || 'Failed to download file');
      }
    } catch (err) {
      logger.error('Error downloading file', err, { context: 'FileActionsDialog' });
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenOutlierCleanup = async () => {
    if (!file) return;

    setIsFetchingData(true);
    setError(null);

    try {
      const { fetchFileDataAction } = await import('@/app/data-explorer/actions');
      const result = await fetchFileDataAction(file.id);

      if (result.success && result.data) {
        setFileData(result.data);
        setShowOutlierCleanup(true);
        handleOpenChange(false);
      } else {
        setError(result.error || 'Failed to load file data');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to load file data'
        });
      }
    } catch (err) {
      logger.error('Error fetching file data', err, { context: 'FileActionsDialog' });
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg
      });
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleCleanupComplete = async (
    cleanedData: Array<Record<string, any>>,
    stats: ColumnOutlierStats[]
  ) => {
    if (!file) return;

    try {
      // Generate cleaned file name
      const baseName = file.fileName.replace(/\.[^/.]+$/, ''); // Remove extension
      const extension = file.fileName.match(/\.[^/.]+$/)?.[0] || '.csv';
      const cleanedFileName = `${baseName}_cleaned${extension}`;

      const { uploadCleanedFileAction } = await import('@/app/data-explorer/actions');
      const result = await uploadCleanedFileAction(file.id, cleanedData, cleanedFileName);

      if (result.success) {
        const totalOutliers = stats.reduce((sum, stat) => sum + stat.outlierCount, 0);
        const columnsAffected = stats.length;

        toast({
          title: 'Outliers Cleaned',
          description: `Created ${cleanedFileName}: Removed ${totalOutliers} outliers from ${columnsAffected} column(s)`
        });

        // Notify parent to refresh file list
        if (onFileUpdated) {
          onFileUpdated();
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'Upload Failed',
          description: result.error || 'Failed to upload cleaned file'
        });
      }
    } catch (err) {
      logger.error('Error uploading cleaned file', err, { context: 'FileActionsDialog' });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to upload cleaned file'
      });
    }
  };

  const renderMenuMode = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          File Actions
        </DialogTitle>
        <DialogDescription>
          Choose an action for {file?.fileName}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2 py-4">
        <Button
          variant="outline"
          className="justify-start h-auto py-3"
          onClick={handleOpenFile}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-3 h-4 w-4" />
          )}
          <div className="text-left">
            <div className="font-medium">
              {isDownloading ? 'Downloading...' : 'Open Plot'}
            </div>
            <div className="text-xs text-muted-foreground">
              {isDownloading ? 'Please wait' : 'View data plots'}
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="justify-start h-auto py-3"
          onClick={() => {
            setShowRawViewer(true);
            handleOpenChange(false);
          }}
        >
          <Table className="mr-3 h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">Open Raw</div>
            <div className="text-xs text-muted-foreground">View raw CSV data</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="justify-start h-auto py-3"
          onClick={() => setMode('rename')}
        >
          <Pencil className="mr-3 h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">Rename</div>
            <div className="text-xs text-muted-foreground">Change file name</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="justify-start h-auto py-3"
          onClick={() => setMode('info')}
        >
          <Info className="mr-3 h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">Info</div>
            <div className="text-xs text-muted-foreground">View file details</div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="justify-start h-auto py-3"
          onClick={handleOpenOutlierCleanup}
          disabled={isFetchingData}
        >
          {isFetchingData ? (
            <Loader2 className="mr-3 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-3 h-4 w-4" />
          )}
          <div className="text-left">
            <div className="font-medium">
              {isFetchingData ? 'Loading data...' : 'Clean Outliers'}
            </div>
            <div className="text-xs text-muted-foreground">
              {isFetchingData ? 'Please wait' : 'Detect and remove outliers'}
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          className="justify-start h-auto py-3"
          onClick={() => setMode('transform')}
          disabled
        >
          <Wand2 className="mr-3 h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">Transform</div>
            <div className="text-xs text-muted-foreground">Coming soon</div>
          </div>
        </Button>

        <Separator />

        <Button
          variant="outline"
          className="justify-start h-auto py-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setMode('delete')}
        >
          <Trash2 className="mr-3 h-4 w-4" />
          <div className="text-left">
            <div className="font-medium">Delete</div>
            <div className="text-xs text-muted-foreground">Permanently remove file</div>
          </div>
        </Button>
      </div>
    </>
  );

  const renderRenameMode = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="h-5 w-5 text-primary" />
          Rename File
        </DialogTitle>
        <DialogDescription>
          Enter a new name for this file.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="fileName" className="text-sm font-medium">
            File Name
          </Label>
          <Input
            id="fileName"
            value={newFileName}
            onChange={(e) => {
              setNewFileName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isRenaming) {
                handleRename();
              }
            }}
            placeholder="Enter new file name"
            disabled={isRenaming}
            className="text-sm"
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
        </div>

        <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
          <strong>Current name:</strong> {file?.fileName}
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setMode('menu')}
          disabled={isRenaming}
        >
          Back
        </Button>
        <Button
          onClick={handleRename}
          disabled={isRenaming || !newFileName.trim() || newFileName === file?.fileName}
        >
          {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isRenaming ? 'Renaming...' : 'Rename'}
        </Button>
      </DialogFooter>
    </>
  );

  const renderInfoMode = () => {
    // Calculate duration in days
    let durationDays: number | null = null;
    if (file?.startDate && file?.endDate) {
      const start = new Date(file.startDate);
      const end = new Date(file.endDate);
      durationDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            File Information
          </DialogTitle>
          <DialogDescription>
            Details about {file?.fileName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">File Name:</span>
              <span className="font-medium font-mono">{file?.fileName}</span>
            </div>
            {file?.projectName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Project:</span>
                <span className="font-medium">{file.projectName}</span>
              </div>
            )}
            {file?.objectLabel && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Object:</span>
                <span className="font-medium">{file.objectLabel}</span>
              </div>
            )}
            {file?.deviceType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device Type:</span>
                <span className="font-medium">{file.deviceType}</span>
              </div>
            )}
            {file?.uploadedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uploaded:</span>
                <span className="font-medium">{format(file.uploadedAt, 'MMM d, yyyy HH:mm')}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date:</span>
              <span className="font-medium font-mono">
                {file?.startDate ? format(new Date(file.startDate), 'yyyy-MM-dd') : 'Not available'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End Date:</span>
              <span className="font-medium font-mono">
                {file?.endDate ? format(new Date(file.endDate), 'yyyy-MM-dd') : 'Not available'}
              </span>
            </div>
            {durationDays !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span className="bg-primary/10 px-2 py-0.5 rounded text-sm font-medium">
                  {durationDays} days
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setMode('menu')}
          >
            Back
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderDeleteMode = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Delete File
        </DialogTitle>
        <DialogDescription>
          This action cannot be undone. Are you sure you want to delete this file?
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">File to be deleted:</p>
              <p className="font-mono text-xs">{file?.fileName}</p>
              <p className="text-xs text-muted-foreground pt-2">
                This file and all its data will be permanently removed from the system.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1 mt-3">
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setMode('menu')}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isDeleting ? 'Deleting...' : 'Delete File'}
        </Button>
      </DialogFooter>
    </>
  );

  const renderTransformMode = () => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          Transform Data
        </DialogTitle>
        <DialogDescription>
          Data transformation features coming soon
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <div className="bg-muted/50 rounded-md p-4 text-center">
          <Wand2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Data transformation features are under development and will be available soon.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setMode('menu')}
        >
          Back
        </Button>
      </DialogFooter>
    </>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          {mode === 'menu' && renderMenuMode()}
          {mode === 'rename' && renderRenameMode()}
          {mode === 'info' && renderInfoMode()}
          {mode === 'delete' && renderDeleteMode()}
          {mode === 'transform' && renderTransformMode()}
        </DialogContent>
      </Dialog>

      {/* Outlier Cleanup Dialog */}
      {fileData && file && (
        <OutlierCleanupDialog
          open={showOutlierCleanup}
          onOpenChange={setShowOutlierCleanup}
          fileName={file.fileName}
          fileData={fileData}
          onCleanComplete={handleCleanupComplete}
        />
      )}

      {/* Raw CSV Viewer Dialog */}
      {file && (
        <RawCsvViewer
          fileId={file.id}
          fileName={file.fileName}
          isOpen={showRawViewer}
          onClose={() => setShowRawViewer(false)}
        />
      )}
    </>
  );
}
