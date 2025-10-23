/**
 * Types for Saved Plot View feature
 * These types define the structure of saved plot configurations
 */

import type { MergeRule } from '@/components/pin-data/MergeRulesDialog';

/**
 * Merged parameter configuration for merged plots
 */
export interface MergedParameterConfig {
  parameter: string;
  sourceType: 'GP' | 'FPOD' | 'Subcam' | 'marine';
  sourceLabel: string;
  color: string;
  axis: 'left' | 'right';
  fileType?: 'GP' | 'FPOD' | 'Subcam';
  files?: File[];
  location?: { lat: number; lon: number };
  timeRange?: { startDate: string; endDate: string };
  // Smoothing metadata
  isSmoothed?: boolean;
  originalObsCount?: number;
  smoothedObsCount?: number;
}

/**
 * Individual plot configuration within a saved view
 */
export interface SavedPlotConfig {
  id: string;
  title: string;
  type: 'device' | 'marine-meteo';

  // File references (device plots)
  fileType?: 'GP' | 'FPOD' | 'Subcam';
  pinId?: string;
  fileName?: string;
  fileId?: string; // DB file ID for validation
  filePath?: string; // Storage path

  // Marine/meteo references
  location?: { lat: number; lon: number };
  locationName?: string;
  timeRange?: { startDate: string; endDate: string };

  // Merge/operation metadata
  isMerged?: boolean;
  mergedParams?: MergedParameterConfig[];

  // Parameter display settings (which parameters are checked and their styling)
  visibleParameters: string[];
  parameterColors: Record<string, string>;
  // Complete parameter state (opacity, lineStyle, lineWidth, filters, MA, etc.)
  parameterSettings?: Record<string, {
    opacity?: number;
    lineStyle?: 'solid' | 'dashed';
    lineWidth?: number;
    isSolo?: boolean;
    timeFilter?: {
      enabled: boolean;
      excludeStart: string;
      excludeEnd: string;
    };
    movingAverage?: {
      enabled: boolean;
      windowDays: number;
      showLine: boolean;
    };
  }>;
}

/**
 * Complete saved plot view configuration
 * This is what gets stored in the database as JSONB
 */
export interface SavedPlotViewConfig {
  version: string; // "1.0.0" for versioning/migrations
  timestamp: string; // ISO timestamp when saved

  // Time axis configuration
  timeAxisMode: 'separate' | 'common';
  globalBrushRange: {
    startIndex: number;
    endIndex: number | undefined;
  };

  // Plot configurations
  plots: SavedPlotConfig[];

  // Data processing settings
  timeRoundingInterval: string; // '1min', '10min', '30min', '1hr', '6hr', '1day'
  mergeRules: MergeRule[];

  // Additional metadata for display
  metadata: {
    totalPlots: number;
    datasetNames: string[];
    dateRangeDisplay: string;
  };
}

/**
 * Database row structure for saved_plot_views table
 */
export interface SavedPlotView {
  id: string;
  user_id: string;
  project_id: string;
  pin_id?: string;
  name: string;
  description?: string;
  view_config: SavedPlotViewConfig;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new saved plot view
 */
export interface CreateSavedPlotViewInput {
  project_id: string;
  pin_id?: string;
  name: string;
  description?: string;
  view_config: SavedPlotViewConfig;
}

/**
 * Input for updating a saved plot view
 */
export interface UpdateSavedPlotViewInput {
  name?: string;
  description?: string;
  view_config?: SavedPlotViewConfig;
}

/**
 * File availability validation result
 */
export interface FileAvailability {
  fileId: string;
  fileName: string;
  available: boolean;
  modified?: boolean; // File was modified after view was saved
  modifiedAt?: string;
}

/**
 * Validation result for a saved plot view
 */
export interface PlotViewValidationResult {
  valid: boolean;
  allFilesAvailable: boolean;
  missingFiles: FileAvailability[];
  modifiedFiles: FileAvailability[];
  availablePlotIds: string[]; // IDs of plots that can be restored
  warnings: string[];
  errors: string[];
}

/**
 * Service operation result
 */
export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
