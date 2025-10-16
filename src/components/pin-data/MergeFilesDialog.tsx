'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { PinFile } from '@/lib/supabase/file-storage-service';

interface FileWithDateRange {
  file: PinFile & { pinLabel: string };
  dateRange: {
    totalDays: number | null;
    startDate: string | null;
    endDate: string | null;
    error?: string;
    loading: boolean;
  };
}

interface MergeFilesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupKey: string | null;
  files: FileWithDateRange[];
  onSuccess?: () => void;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  columnHeaders?: string[];
  dateRanges?: Array<{
    fileId: string;
    fileName: string;
    startDate: string | null;
    endDate: string | null;
  }>;
  overlaps?: Array<{
    file1: string;
    file2: string;
    overlapStart: string;
    overlapEnd: string;
  }>;
}

export function MergeFilesDialog({
  open,
  onOpenChange,
  groupKey,
  files,
  onSuccess,
}: MergeFilesDialogProps) {
  const { toast } = useToast();
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>(
    files.map(f => f.file.id)
  );
  const [outputFileName, setOutputFileName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [step, setStep] = useState<'select' | 'validate' | 'name' | 'merge'>('select');

  // Auto-generate suggested filename
  const suggestedFileName = groupKey
    ? `${groupKey}_merged.csv`
    : 'merged_data.csv';

  // Handle validation
  const handleValidate = async () => {
    if (selectedFileIds.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Select Files',
        description: 'Please select at least 2 files to merge',
      });
      return;
    }

    setIsValidating(true);
    setStep('validate');

    try {
      const response = await fetch('/api/files/merge?action=validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: selectedFileIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      setValidation(data.validation);

      if (data.validation.valid) {
        setStep('name');
        setOutputFileName(suggestedFileName);
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: error instanceof Error ? error.message : 'Failed to validate files',
      });
      setStep('select');
    } finally {
      setIsValidating(false);
    }
  };

  // Handle merge
  const handleMerge = async () => {
    if (!outputFileName.trim()) {
      toast({
        variant: 'destructive',
        title: 'File Name Required',
        description: 'Please enter a name for the merged file',
      });
      return;
    }

    // Get pin ID from first file
    const pinId = files[0]?.file.pinId;
    if (!pinId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not determine pin ID',
      });
      return;
    }

    setIsMerging(true);
    setStep('merge');

    try {
      const response = await fetch('/api/files/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: selectedFileIds,
          outputFileName: outputFileName.trim(),
          pinId,
          deduplicateStrategy: 'exact',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Merge failed');
      }

      toast({
        title: 'Files Merged Successfully',
        description: `Created ${outputFileName}`,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Merge Error',
        description: error instanceof Error ? error.message : 'Failed to merge files',
      });
      setStep('name');
    } finally {
      setIsMerging(false);
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge Data Files</DialogTitle>
          <DialogDescription>
            {step === 'select' && 'Select files to merge and validate compatibility'}
            {step === 'validate' && 'Validating file compatibility...'}
            {step === 'name' && 'Enter a name for the merged file'}
            {step === 'merge' && 'Merging files...'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: File Selection */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Group: <span className="font-mono font-medium">{groupKey}</span>
            </div>

            <div className="space-y-2">
              <Label>Select Files ({selectedFileIds.length} of {files.length})</Label>
              <div className="border rounded-md max-h-64 overflow-y-auto">
                {files.map((fileWithDate) => (
                  <div
                    key={fileWithDate.file.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 border-b last:border-b-0"
                  >
                    <Checkbox
                      checked={selectedFileIds.includes(fileWithDate.file.id)}
                      onCheckedChange={() => toggleFileSelection(fileWithDate.file.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-mono">{fileWithDate.file.fileName}</div>
                      {fileWithDate.dateRange.startDate && fileWithDate.dateRange.endDate && (
                        <div className="text-xs text-muted-foreground">
                          {fileWithDate.dateRange.startDate} to {fileWithDate.dateRange.endDate}
                          {fileWithDate.dateRange.totalDays && (
                            <span> ({fileWithDate.dateRange.totalDays} days)</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleValidate}
              disabled={selectedFileIds.length < 2 || isValidating}
              className="w-full"
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Validate & Continue'
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Validation Results */}
        {step === 'validate' && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Step 3: Name Input */}
        {step === 'name' && validation && (
          <div className="space-y-4">
            {/* Validation Summary */}
            <div className="border rounded-md p-4 space-y-3">
              <div className="font-medium text-sm">Validation Results:</div>

              {validation.valid ? (
                <div className="flex items-start gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4 mt-0.5" />
                  <span>All files are compatible and ready to merge</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span>Validation failed</span>
                </div>
              )}

              {validation.warnings && validation.warnings.length > 0 && (
                <div className="space-y-1">
                  {validation.warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              )}

              {validation.errors && validation.errors.length > 0 && (
                <div className="space-y-1">
                  {validation.errors.map((error, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {validation.valid && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fileName">Output File Name</Label>
                  <Input
                    id="fileName"
                    value={outputFileName}
                    onChange={(e) => setOutputFileName(e.target.value)}
                    placeholder="merged_data.csv"
                  />
                  <div className="text-xs text-muted-foreground">
                    Suggested: {suggestedFileName}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep('select')}>
                    Back
                  </Button>
                  <Button onClick={handleMerge} disabled={!outputFileName.trim()}>
                    Merge Files
                  </Button>
                </DialogFooter>
              </>
            )}

            {!validation.valid && (
              <DialogFooter>
                <Button onClick={() => setStep('select')}>Back</Button>
              </DialogFooter>
            )}
          </div>
        )}

        {/* Step 4: Merging */}
        {step === 'merge' && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-sm text-muted-foreground">
              Merging {selectedFileIds.length} files...
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
