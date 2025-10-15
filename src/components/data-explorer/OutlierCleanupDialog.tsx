'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import {
  detectNumericalColumns,
  getColumnOutlierStats,
  cleanOutliers,
  DetectionMethod,
  HandlingStrategy,
  ColumnOutlierStats,
} from '@/lib/outlier-detection';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

interface OutlierCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileData: Array<Record<string, any>>;
  onCleanComplete: (cleanedData: Array<Record<string, any>>, stats: ColumnOutlierStats[]) => void;
}

export function OutlierCleanupDialog({
  open,
  onOpenChange,
  fileName,
  fileData,
  onCleanComplete,
}: OutlierCleanupDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [detectionMethod, setDetectionMethod] = useState<DetectionMethod>('iqr');
  const [sensitivity, setSensitivity] = useState<number>(1.5);
  const [handlingStrategy, setHandlingStrategy] = useState<HandlingStrategy>('remove');
  const [isProcessing, setIsProcessing] = useState(false);

  // Detect numerical columns
  const numericalColumns = useMemo(() => {
    return detectNumericalColumns(fileData);
  }, [fileData]);

  // Pre-select common measurement columns
  useEffect(() => {
    if (numericalColumns.length > 0 && selectedColumns.size === 0) {
      const commonColumns = ['width', 'length', 'depth', 'temperature', 'salinity', 'pressure'];
      const columnsToSelect = numericalColumns.filter(col =>
        commonColumns.some(common => col.toLowerCase().includes(common))
      );

      if (columnsToSelect.length > 0) {
        setSelectedColumns(new Set(columnsToSelect));
      } else {
        // If no common columns found, select all
        setSelectedColumns(new Set(numericalColumns));
      }
    }
  }, [numericalColumns]);

  // Calculate outlier statistics for selected columns
  const outlierStats = useMemo(() => {
    if (selectedColumns.size === 0) return [];

    const stats: ColumnOutlierStats[] = [];
    selectedColumns.forEach(column => {
      const numericData = fileData
        .map(row => {
          const val = row[column];
          return typeof val === 'number' ? val : parseFloat(val);
        })
        .filter(val => !isNaN(val));

      if (numericData.length > 0) {
        const columnStats = getColumnOutlierStats(
          column,
          numericData,
          detectionMethod,
          sensitivity
        );
        stats.push(columnStats);
      }
    });

    return stats;
  }, [selectedColumns, detectionMethod, sensitivity, fileData]);

  // Total outlier count
  const totalOutliers = useMemo(() => {
    const outlierRowIndices = new Set<number>();
    outlierStats.forEach(stat => {
      stat.outlierIndices.forEach(idx => outlierRowIndices.add(idx));
    });
    return outlierRowIndices.size;
  }, [outlierStats]);

  // Toggle column selection
  const toggleColumn = (column: string) => {
    const newSelection = new Set(selectedColumns);
    if (newSelection.has(column)) {
      newSelection.delete(column);
    } else {
      newSelection.add(column);
    }
    setSelectedColumns(newSelection);
  };

  // Handle cleanup
  const handleCleanup = async () => {
    if (selectedColumns.size === 0) return;

    setIsProcessing(true);
    try {
      // Small delay to show processing state
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = cleanOutliers(
        fileData,
        Array.from(selectedColumns),
        handlingStrategy,
        detectionMethod,
        sensitivity
      );

      onCleanComplete(result.cleanedData, result.stats);
      onOpenChange(false);
    } catch (error) {
      console.error('Error cleaning outliers:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Prepare scatter plot data for a column
  const getScatterData = (columnName: string, stat: ColumnOutlierStats) => {
    return fileData.map((row, index) => {
      const value = parseFloat(row[columnName]);
      return {
        index,
        value: isNaN(value) ? null : value,
        isOutlier: stat.outlierIndices.includes(index),
      };
    }).filter(item => item.value !== null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Clean Outliers - {fileName}</DialogTitle>
          <DialogDescription>
            Detect and handle outliers in numerical columns. Original file will be preserved.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Detection Method */}
            <div className="space-y-2">
              <Label>Detection Method</Label>
              <Select
                value={detectionMethod}
                onValueChange={(value) => setDetectionMethod(value as DetectionMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="iqr">IQR (Interquartile Range) - Recommended</SelectItem>
                  <SelectItem value="stddev">Standard Deviation</SelectItem>
                  <SelectItem value="zscore">Z-Score</SelectItem>
                  <SelectItem value="modified-zscore">Modified Z-Score</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sensitivity Slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Sensitivity: {sensitivity.toFixed(1)}x</Label>
                <span className="text-sm text-muted-foreground">
                  {sensitivity < 1.5 ? 'Aggressive' : sensitivity > 2.5 ? 'Conservative' : 'Standard'}
                </span>
              </div>
              <Slider
                value={[sensitivity]}
                onValueChange={(values) => setSensitivity(values[0])}
                min={1.0}
                max={3.0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Handling Strategy */}
            <div className="space-y-2">
              <Label>Handling Strategy</Label>
              <Select
                value={handlingStrategy}
                onValueChange={(value) => setHandlingStrategy(value as HandlingStrategy)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remove">Remove - Delete rows with outliers</SelectItem>
                  <SelectItem value="flag">Flag - Add is_outlier column</SelectItem>
                  <SelectItem value="median">Replace with Median</SelectItem>
                  <SelectItem value="mean">Replace with Mean</SelectItem>
                  <SelectItem value="cap">Cap - Replace with threshold values</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Column Selection */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Select Columns to Check ({selectedColumns.size} selected)</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (selectedColumns.size === numericalColumns.length) {
                      setSelectedColumns(new Set());
                    } else {
                      setSelectedColumns(new Set(numericalColumns));
                    }
                  }}
                >
                  {selectedColumns.size === numericalColumns.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {numericalColumns.map(column => {
                  const stat = outlierStats.find(s => s.columnName === column);
                  return (
                    <div
                      key={column}
                      className="flex items-center space-x-2 p-2 border rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleColumn(column)}
                    >
                      <Checkbox
                        checked={selectedColumns.has(column)}
                        onCheckedChange={() => toggleColumn(column)}
                      />
                      <div className="flex-1 min-w-0">
                        <Label className="cursor-pointer font-normal">{column}</Label>
                        {stat && (
                          <p className="text-xs text-muted-foreground">
                            {stat.outlierCount} outliers ({stat.outlierPercentage.toFixed(1)}%)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Statistics */}
            {outlierStats.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Summary</Label>
                    <Badge variant={totalOutliers > 0 ? 'destructive' : 'secondary'}>
                      {totalOutliers} rows affected
                    </Badge>
                  </div>

                  {outlierStats.map(stat => (
                    <Card key={stat.columnName}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">{stat.columnName}</CardTitle>
                          <Badge variant={stat.outlierCount > 0 ? 'destructive' : 'secondary'}>
                            {stat.outlierCount} outliers
                          </Badge>
                        </div>
                        <CardDescription>
                          Range: {stat.min.toFixed(2)} to {stat.max.toFixed(2)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-muted-foreground">Q1:</span> {stat.q1.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Q3:</span> {stat.q3.toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            <span className="text-muted-foreground">Lower:</span> {stat.lowerBound.toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span className="text-muted-foreground">Upper:</span> {stat.upperBound.toFixed(2)}
                          </div>
                        </div>

                        {/* Scatter Plot Preview */}
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="index"
                                name="Row"
                                type="number"
                                domain={[0, fileData.length]}
                                label={{ value: 'Row Index', position: 'bottom' }}
                              />
                              <YAxis
                                dataKey="value"
                                name="Value"
                                type="number"
                                label={{ value: stat.columnName, angle: -90, position: 'insideLeft' }}
                              />
                              <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                content={({ payload }) => {
                                  if (payload && payload.length > 0) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-background border rounded p-2 text-xs">
                                        <p>Row: {data.index}</p>
                                        <p>Value: {data.value.toFixed(2)}</p>
                                        <p className={data.isOutlier ? 'text-destructive font-semibold' : ''}>
                                          {data.isOutlier ? 'Outlier' : 'Normal'}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Scatter data={getScatterData(stat.columnName, stat)} fill="#8884d8">
                                {getScatterData(stat.columnName, stat).map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={entry.isOutlier ? '#ef4444' : '#3b82f6'}
                                  />
                                ))}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {selectedColumns.size === 0 && (
              <div className="flex items-center gap-2 p-4 border rounded bg-muted">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select at least one column to detect outliers
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCleanup}
            disabled={selectedColumns.size === 0 || isProcessing}
          >
            {isProcessing ? 'Processing...' : `Create Cleaned File`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
