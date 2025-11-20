"use client";

import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Download, Search, Filter, CheckCircle2, Info, Maximize2, Minimize2, ChevronsUpDown, Merge } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PresenceAbsenceResult, PresenceAbsenceRow } from "./PresenceAbsenceDialog";

interface PresenceAbsenceTableProps {
  data: PresenceAbsenceResult;
  plotId: string;
  onClose: () => void;
}

type FilterMode = 'all' | 'shared-only' | 'unique-only';
type SortMode = 'alphabetical' | 'most-common' | 'most-unique';
type DensityMode = 'normal' | 'compact' | 'very-compact' | 'ultra-compact';
type ViewMode = 'taxa' | 'species';

interface MergedColumn {
  id: string;
  name: string;
  sourceColumns: string[];
}

export function PresenceAbsenceTable({ data, plotId, onClose }: PresenceAbsenceTableProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [densityMode, setDensityMode] = useState<DensityMode>('very-compact');
  const [viewMode, setViewMode] = useState<ViewMode>('taxa');

  // Merge functionality state
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedColumnsForMerge, setSelectedColumnsForMerge] = useState<Set<string>>(new Set());
  const [mergedColumns, setMergedColumns] = useState<MergedColumn[]>([]);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Density settings
  const getDensitySettings = (mode: DensityMode) => {
    switch (mode) {
      case 'normal':
        return { rowHeight: 'h-[15px]', padding: 'py-0.5', fontSize: 'text-xs' };
      case 'compact':
        return { rowHeight: 'h-[10px]', padding: 'py-0', fontSize: 'text-[0.7rem]' };
      case 'very-compact':
        return { rowHeight: 'h-[7px]', padding: 'py-0', fontSize: 'text-[0.65rem]' };
      case 'ultra-compact':
        return { rowHeight: 'h-[5px]', padding: 'py-0', fontSize: 'text-[0.6rem]' };
    }
  };

  const densitySettings = getDensitySettings(densityMode);

  // Get all columns (original + merged)
  const allColumns = useMemo(() => {
    const columns: Array<{ id: string; name: string; isOriginal: boolean; sourceColumns?: string[] }> = [];

    // Add original columns that haven't been merged
    for (const fileName of data.selectedFiles) {
      const isMerged = mergedColumns.some(mc => mc.sourceColumns.includes(fileName));
      if (!isMerged) {
        columns.push({ id: fileName, name: fileName, isOriginal: true });
      }
    }

    // Add merged columns
    for (const merged of mergedColumns) {
      columns.push({
        id: merged.id,
        name: merged.name,
        isOriginal: false,
        sourceColumns: merged.sourceColumns
      });
    }

    return columns;
  }, [data.selectedFiles, mergedColumns]);

  // Column name mapping (for custom names)
  const [columnNames, setColumnNames] = useState<Record<string, string>>({});

  // Get display name for a column
  const getColumnDisplayName = (columnId: string): string => {
    if (columnNames[columnId]) {
      return columnNames[columnId];
    }
    const merged = mergedColumns.find(mc => mc.id === columnId);
    return merged ? merged.name : columnId;
  };

  // Handle column selection for merging
  const handleColumnSelectForMerge = (columnId: string) => {
    const newSelection = new Set(selectedColumnsForMerge);
    if (newSelection.has(columnId)) {
      newSelection.delete(columnId);
    } else {
      newSelection.add(columnId);
    }
    setSelectedColumnsForMerge(newSelection);
  };

  // Perform merge
  const handleMergeColumns = () => {
    if (selectedColumnsForMerge.size < 2) return;

    const columnsToMerge = Array.from(selectedColumnsForMerge);

    // Get source columns (expand merged columns)
    const sourceColumns: string[] = [];
    for (const colId of columnsToMerge) {
      const merged = mergedColumns.find(mc => mc.id === colId);
      if (merged) {
        sourceColumns.push(...merged.sourceColumns);
      } else {
        sourceColumns.push(colId);
      }
    }

    // Create merged column name (each original name on new lines)
    const names = columnsToMerge.map(colId => {
      const { line1, line2 } = getSplitFileName(colId);
      return line2 ? `${line1}\n${line2}` : line1;
    });
    const mergedName = names.join('\n');

    // Create merged column
    const newMerged: MergedColumn = {
      id: `merged_${Date.now()}`,
      name: mergedName,
      sourceColumns: sourceColumns
    };

    // Remove old merged columns that are being re-merged
    const updatedMergedColumns = mergedColumns.filter(
      mc => !columnsToMerge.includes(mc.id)
    );
    updatedMergedColumns.push(newMerged);

    setMergedColumns(updatedMergedColumns);
    setSelectedColumnsForMerge(new Set());
    setIsMergeMode(false);
  };

  // Handle double-click to edit column name
  const handleColumnDoubleClick = (columnId: string) => {
    setEditingColumn(columnId);
    setEditingName(getColumnDisplayName(columnId));
  };

  // Save edited column name
  const handleSaveColumnName = () => {
    if (editingColumn && editingName.trim()) {
      setColumnNames({ ...columnNames, [editingColumn]: editingName.trim() });
    }
    setEditingColumn(null);
    setEditingName('');
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingColumn(null);
    setEditingName('');
  };

  // Filtered and sorted data
  const filteredData = useMemo(() => {
    let filtered = data.matrix;

    // Apply view mode filter (taxa vs species)
    if (viewMode === 'species') {
      // Only show entries with "(sp.)" in the name
      filtered = filtered.filter(row =>
        row.species.toLowerCase().includes('(sp.)')
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(row =>
        row.species.toLowerCase().includes(query)
      );
    }

    // Apply presence filter
    if (filterMode === 'shared-only') {
      filtered = filtered.filter(row => {
        const presentCount = Object.values(row.presence).filter(p => p.status === 'present').length;
        return presentCount > 1;
      });
    } else if (filterMode === 'unique-only') {
      filtered = filtered.filter(row => {
        const presentCount = Object.values(row.presence).filter(p => p.status === 'present').length;
        return presentCount === 1;
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      if (sortMode === 'alphabetical') {
        return a.species.localeCompare(b.species);
      } else if (sortMode === 'most-common') {
        const aCount = Object.values(a.presence).filter(p => p.status === 'present').length;
        const bCount = Object.values(b.presence).filter(p => p.status === 'present').length;
        return bCount - aCount; // Descending
      } else if (sortMode === 'most-unique') {
        const aUnique = Object.values(a.presence).some(p => p.status === 'present' && p.isUnique);
        const bUnique = Object.values(b.presence).some(p => p.status === 'present' && p.isUnique);
        if (aUnique && !bUnique) return -1;
        if (!aUnique && bUnique) return 1;
        return a.species.localeCompare(b.species);
      }
      return 0;
    });

    return filtered;
  }, [data.matrix, searchQuery, filterMode, sortMode, viewMode]);

  // Statistics (updated to work with merged columns and viewMode filter)
  const stats = useMemo(() => {
    const uniqueToFiles: Record<string, number> = {};
    const totalPresencePerFile: Record<string, number> = {};
    const uniqueCountPerFile: Record<string, number> = {};
    const sharedCountPerFile: Record<string, number> = {};

    // Initialize stats for all columns (original and merged)
    for (const column of allColumns) {
      uniqueToFiles[column.id] = 0;
      totalPresencePerFile[column.id] = 0;
      uniqueCountPerFile[column.id] = 0;
      sharedCountPerFile[column.id] = 0;
    }

    let sharedSpecies = 0;

    // Apply viewMode filter to data before calculating stats
    let dataToAnalyze = data.matrix;
    if (viewMode === 'species') {
      dataToAnalyze = dataToAnalyze.filter(row =>
        row.species.toLowerCase().includes('(sp.)')
      );
    }

    for (const row of dataToAnalyze) {
      // Calculate presence for each column (considering merged columns)
      const columnPresence: Record<string, boolean> = {};

      for (const column of allColumns) {
        if (column.isOriginal) {
          // Original column
          columnPresence[column.id] = row.presence[column.id]?.status === 'present';
        } else if (column.sourceColumns) {
          // Merged column - present if in ANY source column
          columnPresence[column.id] = column.sourceColumns.some(
            sourceCol => row.presence[sourceCol]?.status === 'present'
          );
        }
      }

      const presentColumns = Object.entries(columnPresence)
        .filter(([_, isPresent]) => isPresent)
        .map(([colId, _]) => colId);

      if (presentColumns.length === 1) {
        uniqueToFiles[presentColumns[0]]++;
        uniqueCountPerFile[presentColumns[0]]++;
        totalPresencePerFile[presentColumns[0]]++;
      } else if (presentColumns.length > 1) {
        sharedSpecies++;
        for (const colId of presentColumns) {
          sharedCountPerFile[colId]++;
          totalPresencePerFile[colId]++;
        }
      }
    }

    return {
      uniqueToFiles,
      sharedSpecies,
      totalPresencePerFile,
      uniqueCountPerFile,
      sharedCountPerFile,
      totalCount: dataToAnalyze.length
    };
  }, [data, allColumns, viewMode]);

  // Export to CSV (updated to work with merged columns)
  const handleExportCSV = () => {
    const headers = ['Species', ...allColumns.map(col => getColumnDisplayName(col.id).replace(/\n/g, ' '))];
    const rows = filteredData.map(row => {
      const cells = [row.species];
      for (const column of allColumns) {
        let isPresent = false;
        if (column.isOriginal) {
          const presence = row.presence[column.id];
          isPresent = presence?.status === 'present';
        } else if (column.sourceColumns) {
          // Merged column - present if in ANY source column
          isPresent = column.sourceColumns.some(
            sourceCol => row.presence[sourceCol]?.status === 'present'
          );
        }

        // Check if unique
        const presentCount = allColumns.filter(col => {
          if (col.isOriginal) {
            return row.presence[col.id]?.status === 'present';
          } else if (col.sourceColumns) {
            return col.sourceColumns.some(sc => row.presence[sc]?.status === 'present');
          }
          return false;
        }).length;

        if (isPresent) {
          cells.push(presentCount === 1 ? 'Unique' : 'Shared');
        } else {
          cells.push('Absent');
        }
      }
      return cells.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presence-absence-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Split filename into two lines for better readability
  // Line 1: Project and data type (e.g., "ALGA_SUBCAM")
  // Line 2: Sampling station and date range (e.g., "F_I_2503_2504")
  const getSplitFileName = (fileName: string): { line1: string; line2: string } => {
    const parts = fileName.replace(/\.(csv|CSV|txt|TXT)$/i, '').split('_');
    let line1 = '';
    let line2 = '';

    if (parts.length >= 6) {
      // Format: PROJECT_DATATYPE_STATION_DATERANGE_type
      line1 = `${parts[0]}_${parts[1]}`;
      line2 = parts.slice(2, -1).join('_');
    } else if (parts.length >= 4) {
      // Fallback: split in half
      const midpoint = Math.ceil(parts.length / 2);
      line1 = parts.slice(0, midpoint).join('_');
      line2 = parts.slice(midpoint).join('_');
    } else {
      // Too short, just use filename
      line1 = fileName.replace(/\.(csv|CSV|txt|TXT)$/i, '');
      line2 = '';
    }

    return { line1, line2 };
  };

  // Get a shortened filename for display in compact areas
  const getShortFileName = (fileName: string): string => {
    const withoutExt = fileName.replace(/\.(csv|CSV|txt|TXT)$/i, '');
    // Truncate if too long
    return withoutExt.length > 35 ? withoutExt.substring(0, 35) + '...' : withoutExt;
  };

  // Detect file type based on filename
  const getFileType = (fileName: string): 'subcam' | 'hapl-edna' => {
    const lowerFileName = fileName.toLowerCase();
    if (lowerFileName.includes('_hapl') || lowerFileName.includes('edna')) {
      return 'hapl-edna';
    }
    return 'subcam';
  };

  // Get color classes based on file type and presence status
  const getPresenceColorClasses = (fileName: string, isPresent: boolean, isUnique: boolean): string => {
    if (!isPresent) {
      return "bg-white dark:bg-background";
    }

    const fileType = getFileType(fileName);

    if (fileType === 'hapl-edna') {
      // Orange colors for HAPL/EDNA files
      return isUnique
        ? "bg-orange-300 dark:bg-orange-800"  // Light orange for unique
        : "bg-orange-600 dark:bg-orange-500"; // Dark orange for shared
    } else {
      // Blue colors for SUBCAM files (default)
      return isUnique
        ? "bg-blue-300 dark:bg-blue-800"   // Light blue for unique
        : "bg-blue-600 dark:bg-blue-500";  // Dark blue for shared
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex-1">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Presence-Absence Comparison
            <span className="text-sm font-normal text-muted-foreground">
              ({stats.totalCount} {viewMode === 'taxa' ? 'taxa' : 'species'} × {data.fileCount} files)
            </span>
          </CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* View Mode Toggle */}
        <div className="flex items-center justify-center gap-2 p-3 bg-muted/30 rounded-lg border">
          <span className="text-sm font-semibold mr-2">View:</span>
          <div className="flex gap-1 bg-background rounded-md p-1">
            <Button
              variant={viewMode === 'taxa' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('taxa')}
              className={cn(
                "text-xs",
                viewMode === 'taxa' && "bg-purple-600 hover:bg-purple-700 text-white"
              )}
            >
              Taxa (All Entries)
            </Button>
            <Button
              variant={viewMode === 'species' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('species')}
              className={cn(
                "text-xs",
                viewMode === 'species' && "bg-green-600 hover:bg-green-700 text-white"
              )}
            >
              Species (sp. only)
            </Button>
          </div>
        </div>

        {/* Statistics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.totalCount}
            </p>
            <p className="text-xs text-muted-foreground">Total {viewMode === 'taxa' ? 'Taxa' : 'Species'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.sharedSpecies}
            </p>
            <p className="text-xs text-muted-foreground">Shared {viewMode === 'taxa' ? 'Taxa' : 'Species'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {Object.values(stats.uniqueToFiles).reduce((sum, count) => sum + count, 0)}
            </p>
            <p className="text-xs text-muted-foreground">Unique {viewMode === 'taxa' ? 'Taxa' : 'Species'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {data.corrections.length}
            </p>
            <p className="text-xs text-muted-foreground">Corrections Made</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={`Search ${viewMode === 'taxa' ? 'taxa' : 'species'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter */}
          <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {viewMode === 'taxa' ? 'Taxa' : 'Species'}</SelectItem>
              <SelectItem value="shared-only">Shared Only</SelectItem>
              <SelectItem value="unique-only">Unique Only</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
              <SelectItem value="most-common">Most Common</SelectItem>
              <SelectItem value="most-unique">Unique First</SelectItem>
            </SelectContent>
          </Select>

          {/* Export */}
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>

          {/* Merge Button */}
          {!isMergeMode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMergeMode(true)}
              className="gap-2"
            >
              <Merge className="w-4 h-4" />
              Merge
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsMergeMode(false);
                  setSelectedColumnsForMerge(new Set());
                }}
                className="gap-2"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMergeColumns}
                disabled={selectedColumnsForMerge.size < 2}
                className={cn(
                  "gap-2",
                  selectedColumnsForMerge.size >= 2 && "bg-green-500 hover:bg-green-600 text-white"
                )}
              >
                <Merge className="w-4 h-4" />
                Merge Selected ({selectedColumnsForMerge.size})
              </Button>
            </div>
          )}

          {/* Fullscreen Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="gap-2"
            title={isFullScreen ? "Fixed height with scroll" : "Full screen view"}
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Fixed
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                Expand
              </>
            )}
          </Button>

          {/* Density Toggle */}
          <Select value={densityMode} onValueChange={(v) => setDensityMode(v as DensityMode)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <ChevronsUpDown className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="very-compact">Very Compact</SelectItem>
              <SelectItem value="ultra-compact">Ultra Compact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" />
          Showing {filteredData.length} of {stats.totalCount} {viewMode === 'taxa' ? 'taxa' : 'species'}
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className={cn(
            "w-full overflow-x-auto",
            !isFullScreen && "max-h-[500px] overflow-y-auto"
          )}>
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                {/* Checkbox row for merge mode */}
                {isMergeMode && (
                  <tr className="border-b bg-blue-50 dark:bg-blue-950/20">
                    <th className="text-center px-3 py-2 border-r sticky left-0 bg-blue-50 dark:bg-blue-950/20 z-20" colSpan={2}>
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Select columns to merge</span>
                    </th>
                    {allColumns.map((column, idx) => (
                      <th key={idx} className="text-center px-3 py-2 border-r bg-blue-50 dark:bg-blue-950/20 min-w-[100px]">
                        <Checkbox
                          checked={selectedColumnsForMerge.has(column.id)}
                          onCheckedChange={() => handleColumnSelectForMerge(column.id)}
                          className="mx-auto"
                        />
                      </th>
                    ))}
                  </tr>
                )}
                <tr className="border-b bg-muted">
                  <th className="text-left px-3 py-2 font-semibold border-r sticky left-0 bg-muted z-20 min-w-[200px]">
                    {viewMode === 'taxa' ? 'Taxa' : 'Species'}
                  </th>
                  <th className="text-center px-3 py-2 font-semibold border-r bg-muted min-w-[80px]">
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs whitespace-nowrap">Shared</span>
                      <span className="text-xs whitespace-nowrap">Count</span>
                    </div>
                  </th>
                  {allColumns.map((column, idx) => {
                    const isEditing = editingColumn === column.id;
                    const displayName = getColumnDisplayName(column.id);

                    // For original columns, use split filename; for others use display name
                    let headerLines: string[];
                    if (column.isOriginal && !columnNames[column.id]) {
                      const { line1, line2 } = getSplitFileName(column.id);
                      headerLines = line2 ? [line1, line2] : [line1];
                    } else {
                      headerLines = displayName.split('\n');
                    }

                    return (
                      <th
                        key={idx}
                        className="text-center px-3 py-2 font-semibold border-r min-w-[100px]"
                        title={column.isOriginal ? column.id : `Merged: ${column.sourceColumns?.join(', ')}`}
                        onDoubleClick={() => !isEditing && handleColumnDoubleClick(column.id)}
                      >
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveColumnName();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="h-6 text-xs"
                              autoFocus
                            />
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={handleSaveColumnName} className="h-5 text-[0.65rem] px-1">
                                Save
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-5 text-[0.65rem] px-1">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col leading-tight cursor-pointer hover:bg-muted/50" title="Double-click to edit">
                            {headerLines.map((line, i) => (
                              <span key={i} className="text-xs whitespace-nowrap">{line}</span>
                            ))}
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan={allColumns.length + 2}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No {viewMode === 'taxa' ? 'taxa' : 'species'} found matching your criteria
                    </td>
                  </tr>
                ) : (
                  filteredData.map((row, rowIdx) => {
                    // Calculate shared count across all columns (including merged)
                    const sharedCount = allColumns.filter(column => {
                      if (column.isOriginal) {
                        return row.presence[column.id]?.status === 'present';
                      } else if (column.sourceColumns) {
                        return column.sourceColumns.some(
                          sourceCol => row.presence[sourceCol]?.status === 'present'
                        );
                      }
                      return false;
                    }).length;

                    return (
                      <tr key={rowIdx} className={cn(
                        "border-b hover:bg-muted/30 transition-colors",
                        densitySettings.rowHeight
                      )}>
                        <td className={cn(
                          "px-3 font-mono border-r sticky left-0 bg-background z-10",
                          densitySettings.padding,
                          densitySettings.fontSize
                        )}>
                          {row.species}
                        </td>
                        <td className={cn(
                          "px-3 text-center border-r bg-amber-50 dark:bg-amber-950/30 text-xs font-semibold",
                          densitySettings.padding
                        )}>
                          {sharedCount}
                        </td>
                        {allColumns.map((column, fileIdx) => {
                        let isPresent = false;
                        let isUnique = false;
                        let tooltipText = '';
                        let fileName = column.id;

                        if (column.isOriginal) {
                          const presence = row.presence[column.id];
                          isPresent = presence?.status === 'present';
                          isUnique = presence?.isUnique ?? false;
                          const fileType = getFileType(column.id);
                          const fileTypeLabel = fileType === 'hapl-edna' ? 'HAPL/EDNA' : 'SUBCAM';
                          tooltipText = isPresent
                            ? isUnique
                              ? `${row.species} - Unique to ${column.id} (${fileTypeLabel})`
                              : `${row.species} - Shared with other files (${fileTypeLabel})`
                            : `${row.species} - Not present in ${column.id}`;
                        } else if (column.sourceColumns) {
                          // Merged column
                          isPresent = column.sourceColumns.some(
                            sourceCol => row.presence[sourceCol]?.status === 'present'
                          );
                          isUnique = sharedCount === 1;
                          const presentInSources = column.sourceColumns
                            .filter(sc => row.presence[sc]?.status === 'present')
                            .join(', ');
                          tooltipText = isPresent
                            ? `${row.species} - Present in: ${presentInSources}`
                            : `${row.species} - Not present in any merged columns`;
                        }

                        return (
                          <td
                            key={fileIdx}
                            className={cn(
                              "px-3 text-center border-r transition-colors",
                              densitySettings.padding,
                              getPresenceColorClasses(
                                fileName,
                                isPresent,
                                isUnique
                              )
                            )}
                            title={tooltipText}
                          >
                            {isPresent && (
                              <div className="flex items-center justify-center">
                                <CheckCircle2 className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-muted/90 backdrop-blur-sm">
                {/* Total Presence Row */}
                <tr className="border-t-2 border-b">
                  <td className="px-3 py-1 font-semibold text-xs border-r sticky left-0 bg-muted/90 z-20">
                    Total Presence
                  </td>
                  <td className="px-3 py-1 text-center text-xs border-r bg-muted/90"></td>
                  {allColumns.map((column, idx) => (
                    <td key={idx} className="px-3 py-1 text-center text-xs font-semibold border-r bg-purple-100 dark:bg-purple-900/30">
                      {stats.totalPresencePerFile[column.id] || 0}
                    </td>
                  ))}
                </tr>
                {/* Total Unique Row */}
                <tr className="border-b">
                  <td className="px-3 py-1 font-semibold text-xs border-r sticky left-0 bg-muted/90 z-20">
                    Total Unique
                  </td>
                  <td className="px-3 py-1 text-center text-xs border-r bg-muted/90"></td>
                  {allColumns.map((column, idx) => (
                    <td key={idx} className="px-3 py-1 text-center text-xs font-semibold border-r bg-cyan-100 dark:bg-cyan-900/30">
                      {stats.uniqueCountPerFile[column.id] || 0}
                    </td>
                  ))}
                </tr>
                {/* Total Shared Row */}
                <tr className="border-b">
                  <td className="px-3 py-1 font-semibold text-xs border-r sticky left-0 bg-muted/90 z-20">
                    Total Shared
                  </td>
                  <td className="px-3 py-1 text-center text-xs border-r bg-muted/90"></td>
                  {allColumns.map((column, idx) => (
                    <td key={idx} className="px-3 py-1 text-center text-xs font-semibold border-r bg-blue-100 dark:bg-blue-900/30">
                      {stats.sharedCountPerFile[column.id] || 0}
                    </td>
                  ))}
                </tr>
                {/* Total Taxa/Species Across All Samples Row */}
                <tr className="border-t-2">
                  <td className="px-3 py-1 font-bold text-xs border-r sticky left-0 bg-muted/90 z-20">
                    Total {viewMode === 'taxa' ? 'Taxa' : 'Species'} (All)
                  </td>
                  <td
                    colSpan={allColumns.length + 1}
                    className="px-3 py-1 text-center text-xs font-bold bg-green-100 dark:bg-green-900/30 border-r"
                  >
                    {stats.totalCount} {viewMode === 'taxa' ? 'taxa' : 'species'} across all samples
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-xs flex-wrap p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="font-semibold text-blue-700 dark:text-blue-300 mr-2">SUBCAM files:</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-600 dark:bg-blue-500 rounded border flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span>Shared (present in multiple files)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-300 dark:bg-blue-800 rounded border flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span>Unique (present only in this file)</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
            <span className="font-semibold text-orange-700 dark:text-orange-300 mr-2">HAPL/EDNA files:</span>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-600 dark:bg-orange-500 rounded border flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span>Shared (present in multiple files)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-orange-300 dark:bg-orange-800 rounded border flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span>Unique (present only in this file)</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs flex-wrap p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white dark:bg-background rounded border"></div>
              <span>Absent (not present in file)</span>
            </div>
          </div>
        </div>

        {/* Per-File Unique Counts */}
        {Object.keys(stats.uniqueToFiles).length > 0 && (
          <div className="border-t pt-3">
            <h4 className="text-xs font-semibold mb-2">Unique {viewMode === 'taxa' ? 'Taxa' : 'Species'} per Column</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(stats.uniqueToFiles).map(([columnId, count]) => {
                const displayName = getColumnDisplayName(columnId).replace(/\n/g, ' ');
                const column = allColumns.find(c => c.id === columnId);
                const tooltip = column?.isOriginal
                  ? columnId
                  : `Merged: ${column?.sourceColumns?.join(', ')}`;

                return (
                  <div key={columnId} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                    <span className="truncate flex-1 mr-2" title={tooltip}>
                      {displayName.length > 35 ? displayName.substring(0, 35) + '...' : displayName}
                    </span>
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                      {count} unique
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Corrections Info */}
        {data.corrections.length > 0 && (
          <div className="border-t pt-3">
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-green-700 dark:text-green-300 mb-2">
                View {data.corrections.length} AI Corrections
              </summary>
              <ul className="space-y-1 text-muted-foreground ml-4">
                {data.corrections.map((correction, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span>•</span>
                    <span>
                      "{correction.original}" → "{correction.corrected}"
                      <span className="ml-1 text-[0.65rem]">({correction.reason})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
