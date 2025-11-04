'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { fetchRawCsvAction } from '@/app/data-explorer/actions';

interface RawCsvViewerProps {
  fileId: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function RawCsvViewer({ fileId, fileName, isOpen, onClose }: RawCsvViewerProps) {
  const { toast } = useToast();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch raw CSV data when dialog opens
  useEffect(() => {
    if (isOpen && fileId) {
      fetchRawData();
    }
  }, [isOpen, fileId]);

  const fetchRawData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchRawCsvAction(fileId);

      if (result.success && result.data) {
        setHeaders(result.data.headers);
        setRows(result.data.rows);
      } else {
        setError(result.error || 'Failed to load CSV data');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: result.error || 'Failed to load CSV data'
        });
      }
    } catch (err) {
      logger.error('Error fetching raw CSV', err, { context: 'RawCsvViewer' });
      const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMsg);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMsg
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    try {
      // Reconstruct CSV from headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => {
          // Escape cells containing commas, quotes, or newlines
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        }).join(','))
        .join('\n');

      // Create blob and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download Complete',
        description: `${fileName} has been downloaded`
      });
    } catch (err) {
      logger.error('Error downloading CSV', err, { context: 'RawCsvViewer' });
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: 'Failed to download CSV file'
      });
    }
  };

  const handleClose = () => {
    setHeaders([]);
    setRows([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="font-mono text-sm truncate">{fileName}</span>
            <div className="flex items-center gap-2">
              {!isLoading && !error && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            {isLoading ? (
              'Loading raw CSV data...'
            ) : error ? (
              'Failed to load CSV data'
            ) : (
              `${rows.length.toLocaleString()} rows × ${headers.length} columns`
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 px-6 pb-6">
          <div className="h-full border rounded-md overflow-hidden bg-background">
            {isLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm text-muted-foreground">Loading CSV data...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-4">
                  <p className="text-destructive font-medium mb-2">Error loading CSV</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchRawData}
                    className="mt-4"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && !error && headers.length > 0 && (
              <div className="h-full overflow-auto scroll-smooth scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/30">
                <table className="w-full border-collapse text-sm relative">
                  <thead className="sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="border border-border bg-muted p-2 text-left font-semibold w-16 min-w-[4rem] sticky left-0 z-30 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                        #
                      </th>
                      {headers.map((header, idx) => (
                        <th
                          key={idx}
                          className="border border-border bg-muted p-2 text-left font-semibold min-w-[120px] max-w-[300px] whitespace-nowrap"
                        >
                          <div className="truncate" title={header}>
                            {header}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <td className="border border-border p-2 text-center font-mono text-xs text-muted-foreground bg-muted/30 sticky left-0 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                          {rowIdx + 1}
                        </td>
                        {row.map((cell, cellIdx) => (
                          <td
                            key={cellIdx}
                            className="border border-border p-2 font-mono text-xs whitespace-nowrap"
                          >
                            <div className="max-w-[300px] truncate" title={cell}>
                              {cell}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {rows.length === 0 && (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-muted-foreground">No data rows found</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
