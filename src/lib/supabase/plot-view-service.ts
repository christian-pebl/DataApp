import { createClient } from './client';
import { perfLogger } from '../perf-logger';
import type {
  SavedPlotView,
  CreateSavedPlotViewInput,
  UpdateSavedPlotViewInput,
  PlotViewValidationResult,
  FileAvailability,
  ServiceResult,
  SavedPlotViewConfig
} from './plot-view-types';

/**
 * Service for managing saved plot views
 * Handles CRUD operations and validation for saved plot configurations
 */
class PlotViewService {
  private supabase = createClient();

  /**
   * Save a new plot view configuration
   */
  async savePlotView(input: CreateSavedPlotViewInput): Promise<ServiceResult<SavedPlotView>> {
    perfLogger.start('savePlotView');

    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();

      if (authError || !user) {
        console.error('❌ Authentication required to save plot views:', authError);
        perfLogger.end('savePlotView', 'auth-failed');
        return { success: false, error: 'Authentication required' };
      }

      console.log('💾 Saving plot view:', { name: input.name, project_id: input.project_id });

      // Insert the plot view
      const { data, error } = await this.supabase
        .from('saved_plot_views')
        .insert({
          user_id: user.id,
          project_id: input.project_id,
          pin_id: input.pin_id || null,
          name: input.name,
          description: input.description || null,
          view_config: input.view_config as any // Cast to any for JSONB
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving plot view:', error);

        // Check for unique constraint violation
        if (error.code === '23505') {
          perfLogger.end('savePlotView', 'duplicate-name');
          return {
            success: false,
            error: `A view named "${input.name}" already exists in this project`
          };
        }

        perfLogger.end('savePlotView', 'db-error');
        return { success: false, error: error.message };
      }

      console.log('✅ Plot view saved successfully:', data.id);
      perfLogger.end('savePlotView', 'success');

      return {
        success: true,
        data: {
          ...data,
          view_config: data.view_config as SavedPlotViewConfig
        } as SavedPlotView
      };

    } catch (error) {
      console.error('❌ Save plot view exception:', error);
      perfLogger.end('savePlotView', 'exception');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load a specific plot view by ID
   */
  async loadPlotView(viewId: string): Promise<ServiceResult<SavedPlotView>> {
    perfLogger.start(`loadPlotView-${viewId.slice(0, 8)}`);

    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();

      if (authError || !user) {
        console.error('❌ Authentication required to load plot views');
        perfLogger.end(`loadPlotView-${viewId.slice(0, 8)}`, 'auth-failed');
        return { success: false, error: 'Authentication required' };
      }

      console.log('📂 Loading plot view:', viewId);

      const { data, error } = await this.supabase
        .from('saved_plot_views')
        .select('*')
        .eq('id', viewId)
        .eq('user_id', user.id) // Ensure user owns this view
        .single();

      if (error) {
        console.error('❌ Error loading plot view:', error);
        perfLogger.end(`loadPlotView-${viewId.slice(0, 8)}`, 'not-found');
        return { success: false, error: 'Plot view not found' };
      }

      console.log('✅ Plot view loaded successfully');
      perfLogger.end(`loadPlotView-${viewId.slice(0, 8)}`, 'success');

      return {
        success: true,
        data: {
          ...data,
          view_config: data.view_config as SavedPlotViewConfig
        } as SavedPlotView
      };

    } catch (error) {
      console.error('❌ Load plot view exception:', error);
      perfLogger.end(`loadPlotView-${viewId.slice(0, 8)}`, 'exception');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List all plot views for a specific project
   */
  async listPlotViews(projectId: string): Promise<ServiceResult<SavedPlotView[]>> {
    perfLogger.start(`listPlotViews-${projectId.slice(0, 8)}`);

    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();

      if (authError || !user) {
        console.error('❌ Authentication required to list plot views');
        perfLogger.end(`listPlotViews-${projectId.slice(0, 8)}`, 'auth-failed');
        return { success: false, error: 'Authentication required' };
      }

      const { data, error } = await this.supabase
        .from('saved_plot_views')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id) // Only user's own views
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error listing plot views:', error);
        perfLogger.end(`listPlotViews-${projectId.slice(0, 8)}`, 'error');
        return { success: false, error: error.message };
      }

      perfLogger.end(`listPlotViews-${projectId.slice(0, 8)}`, `${data.length} views`);

      return {
        success: true,
        data: data.map(view => ({
          ...view,
          view_config: view.view_config as SavedPlotViewConfig
        })) as SavedPlotView[]
      };

    } catch (error) {
      console.error('❌ List plot views exception:', error);
      perfLogger.end(`listPlotViews-${projectId.slice(0, 8)}`, 'exception');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update an existing plot view
   */
  async updatePlotView(
    viewId: string,
    updates: UpdateSavedPlotViewInput
  ): Promise<ServiceResult<SavedPlotView>> {
    perfLogger.start(`updatePlotView-${viewId.slice(0, 8)}`);

    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();

      if (authError || !user) {
        console.error('❌ Authentication required to update plot views');
        perfLogger.end(`updatePlotView-${viewId.slice(0, 8)}`, 'auth-failed');
        return { success: false, error: 'Authentication required' };
      }

      console.log('✏️ Updating plot view:', viewId);

      const { data, error } = await this.supabase
        .from('saved_plot_views')
        .update(updates as any) // Cast for JSONB handling
        .eq('id', viewId)
        .eq('user_id', user.id) // Ensure user owns this view
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating plot view:', error);

        // Check for unique constraint violation
        if (error.code === '23505') {
          perfLogger.end(`updatePlotView-${viewId.slice(0, 8)}`, 'duplicate-name');
          return {
            success: false,
            error: `A view with this name already exists in this project`
          };
        }

        perfLogger.end(`updatePlotView-${viewId.slice(0, 8)}`, 'error');
        return { success: false, error: error.message };
      }

      console.log('✅ Plot view updated successfully');
      perfLogger.end(`updatePlotView-${viewId.slice(0, 8)}`, 'success');

      return {
        success: true,
        data: {
          ...data,
          view_config: data.view_config as SavedPlotViewConfig
        } as SavedPlotView
      };

    } catch (error) {
      console.error('❌ Update plot view exception:', error);
      perfLogger.end(`updatePlotView-${viewId.slice(0, 8)}`, 'exception');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a plot view
   */
  async deletePlotView(viewId: string): Promise<ServiceResult> {
    const perfLabel = `deletePlotView-${viewId.slice(0, 8)}`;
    perfLogger.start(perfLabel);
    console.log('🗑️ [SERVICE-1] deletePlotView called with viewId:', viewId);

    try {
      // Get current user
      console.log('🔐 [SERVICE-2] Getting current user...');
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();

      if (authError || !user) {
        console.error('❌ [SERVICE-ERROR-1] Authentication required to delete plot views:', authError);
        perfLogger.end(perfLabel, 'auth-failed');
        return { success: false, error: 'Authentication required' };
      }

      console.log('✅ [SERVICE-3] User authenticated:', user.id);
      console.log('🗑️ [SERVICE-4] Deleting plot view from database:', {
        viewId,
        userId: user.id
      });

      const { error, count } = await this.supabase
        .from('saved_plot_views')
        .delete({ count: 'exact' })
        .eq('id', viewId)
        .eq('user_id', user.id); // Ensure user owns this view

      console.log('🗑️ [SERVICE-5] Delete query complete:', {
        error: error ? error.message : null,
        count,
        hasError: !!error
      });

      if (error) {
        console.error('❌ [SERVICE-ERROR-2] Error deleting plot view:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        perfLogger.end(perfLabel, 'error');
        return { success: false, error: error.message };
      }

      console.log('✅ [SERVICE-6] Plot view deleted successfully, rows affected:', count);
      perfLogger.end(perfLabel, 'success');

      return { success: true };

    } catch (error) {
      console.error('❌ [SERVICE-ERROR-3] Delete plot view exception:', error);
      if (error instanceof Error) {
        console.error('❌ [SERVICE-ERROR-3] Exception details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }
      perfLogger.end(perfLabel, 'exception');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate a plot view configuration
   * Checks if all referenced files are still available
   */
  async validatePlotView(config: SavedPlotViewConfig): Promise<PlotViewValidationResult> {
    perfLogger.start('validatePlotView');

    try {
      console.log('🔍 Validating plot view configuration...');

      // Collect all file IDs from the config
      const fileIds = new Set<string>();
      const fileMap = new Map<string, { fileName: string; plotId: string }>();

      config.plots.forEach(plot => {
        if (plot.type === 'device' && plot.fileId) {
          fileIds.add(plot.fileId);
          fileMap.set(plot.fileId, {
            fileName: plot.fileName || 'Unknown',
            plotId: plot.id
          });
        }
      });

      if (fileIds.size === 0) {
        // No files to validate (all marine/meteo plots)
        console.log('ℹ️ No files to validate');
        perfLogger.end('validatePlotView', 'no-files');
        return {
          valid: true,
          allFilesAvailable: true,
          missingFiles: [],
          modifiedFiles: [],
          availablePlotIds: config.plots.map(p => p.id),
          unavailablePlotIds: [],
          warnings: [],
          errors: [],
          hasWarnings: false
        };
      }

      // Query all files at once from both pin_files and merged_files
      const { data: pinFilesData, error: pinFilesError } = await this.supabase
        .from('pin_files')
        .select('id, file_name, updated_at')
        .in('id', Array.from(fileIds));

      const { data: mergedFilesData, error: mergedFilesError } = await this.supabase
        .from('merged_files')
        .select('id, file_name, updated_at')
        .in('id', Array.from(fileIds));

      if (pinFilesError && mergedFilesError) {
        console.error('❌ Error querying files:', { pinFilesError, mergedFilesError });
        perfLogger.end('validatePlotView', 'query-error');
        return {
          valid: false,
          allFilesAvailable: false,
          missingFiles: [],
          modifiedFiles: [],
          availablePlotIds: [],
          unavailablePlotIds: config.plots.map(p => p.id),
          warnings: [],
          errors: ['Failed to validate files'],
          hasWarnings: false
        };
      }

      // Combine results from both tables
      const filesData = [
        ...(pinFilesData || []),
        ...(mergedFilesData || [])
      ];

      console.log(`📊 [VALIDATION] Found ${pinFilesData?.length || 0} pin files and ${mergedFilesData?.length || 0} merged files`);
      console.log(`📊 [VALIDATION] Checking ${config.plots.length} plots in view config`);

      // Build availability map
      const availableFileIds = new Set(filesData.map(f => f.id));
      const missingFiles: FileAvailability[] = [];
      const modifiedFiles: FileAvailability[] = [];
      const availablePlotIds: string[] = [];

      // Check each plot
      config.plots.forEach((plot, idx) => {
        console.log(`📊 [VALIDATION] Plot ${idx + 1}/${config.plots.length}:`, {
          id: plot.id,
          type: plot.type,
          fileId: plot.fileId,
          fileName: plot.fileName,
          computationType: plot.computationType
        });

        // Computed plots are always available if their source plots are
        if (plot.computationType) {
          console.log(`  🧮 [VALIDATION] Computed plot (${plot.computationType}), checking source plots...`);
          const sourcePlotIds = plot.sourcePlotIds || [];
          const allSourcesAvailable = sourcePlotIds.every(sourceId =>
            config.plots.find(p => p.id === sourceId && !p.computationType)
          );

          if (allSourcesAvailable) {
            console.log(`  ✅ [VALIDATION] All source plots exist, marking computed plot as available`);
            availablePlotIds.push(plot.id);
          } else {
            console.log(`  ❌ [VALIDATION] Some source plots missing, marking computed plot as unavailable`);
            missingFiles.push({
              fileId: plot.id,
              fileName: plot.fileName || plot.title || 'Computed Plot',
              available: false
            });
          }
        } else if (plot.type === 'device') {
          // If fileId is missing but fileName is present, try to find it
          if (!plot.fileId && plot.fileName) {
            console.log(`  🔍 [VALIDATION] fileId missing, searching by fileName: ${plot.fileName}`);
            const fileByName = filesData.find(f => f.file_name === plot.fileName);
            if (fileByName) {
              console.log(`  ✅ [VALIDATION] File found by name, adding plot to available list`);
              availablePlotIds.push(plot.id);
            } else {
              console.log(`  ❌ [VALIDATION] File NOT found by name`);
              missingFiles.push({
                fileId: plot.fileId || 'unknown',
                fileName: plot.fileName || 'Unknown',
                available: false
              });
            }
          } else if (plot.fileId && availableFileIds.has(plot.fileId)) {
            console.log(`  ✅ [VALIDATION] File found by ID, adding plot to available list`);
            availablePlotIds.push(plot.id);

            // Check if file was modified after view was saved
            const fileData = filesData.find(f => f.id === plot.fileId);
            if (fileData) {
              const fileUpdatedAt = new Date(fileData.updated_at);
              const viewSavedAt = new Date(config.timestamp);

              if (fileUpdatedAt > viewSavedAt) {
                modifiedFiles.push({
                  fileId: plot.fileId,
                  fileName: plot.fileName || 'Unknown',
                  available: true,
                  modified: true,
                  modifiedAt: fileData.updated_at
                });
              }
            }
          } else {
            // File is missing
            console.log(`  ❌ [VALIDATION] File NOT found, marking as missing`);
            missingFiles.push({
              fileId: plot.fileId,
              fileName: plot.fileName || 'Unknown',
              available: false
            });
          }
        } else if (plot.type === 'marine-meteo') {
          // Marine/meteo plots don't have files
          console.log(`  ✅ [VALIDATION] Marine/meteo plot, no file check needed`);
          availablePlotIds.push(plot.id);
        } else {
          console.log(`  ⚠️ [VALIDATION] Plot type '${plot.type}' with no fileId - skipping`);
        }
      });

      const allFilesAvailable = missingFiles.length === 0;
      const warnings: string[] = [];
      const errors: string[] = [];

      if (missingFiles.length > 0) {
        errors.push(`${missingFiles.length} file(s) are no longer available`);
      }

      if (modifiedFiles.length > 0) {
        warnings.push(`${modifiedFiles.length} file(s) have been modified since this view was saved`);
      }

      // Log summary of which plots are available vs unavailable
      const unavailablePlotIds = config.plots
        .filter(p => !availablePlotIds.includes(p.id))
        .map(p => p.id);

      console.log(`✅ Validation complete: ${availablePlotIds.length}/${config.plots.length} plots available`);
      console.log('📊 [VALIDATION SUMMARY]', {
        totalPlots: config.plots.length,
        availablePlots: availablePlotIds.length,
        unavailablePlots: unavailablePlotIds.length,
        availableIds: availablePlotIds,
        unavailableIds: unavailablePlotIds
      });

      perfLogger.end('validatePlotView', `${availablePlotIds.length}/${config.plots.length}`);

      return {
        valid: availablePlotIds.length > 0,
        allFilesAvailable,
        missingFiles,
        modifiedFiles,
        availablePlotIds,
        unavailablePlotIds,
        warnings,
        errors,
        hasWarnings: warnings.length > 0
      };

    } catch (error) {
      console.error('❌ Validation exception:', error);
      perfLogger.end('validatePlotView', 'exception');
      return {
        valid: false,
        allFilesAvailable: false,
        missingFiles: [],
        modifiedFiles: [],
        availablePlotIds: [],
        unavailablePlotIds: config?.plots?.map(p => p.id) || [],
        warnings: [],
        errors: ['Validation failed due to an error'],
        hasWarnings: false
      };
    }
  }

  /**
   * Check if specific files are available
   */
  async checkFileAvailability(fileIds: string[]): Promise<Record<string, boolean>> {
    if (fileIds.length === 0) return {};

    try {
      const { data, error } = await this.supabase
        .from('pin_files')
        .select('id')
        .in('id', fileIds);

      if (error) {
        console.error('❌ Error checking file availability:', error);
        return {};
      }

      const availableIds = new Set(data.map(f => f.id));
      const result: Record<string, boolean> = {};

      fileIds.forEach(id => {
        result[id] = availableIds.has(id);
      });

      return result;

    } catch (error) {
      console.error('❌ Check file availability exception:', error);
      return {};
    }
  }
}

export const plotViewService = new PlotViewService();
