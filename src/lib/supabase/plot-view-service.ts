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

      console.log('📋 Listing plot views for project:', projectId);

      const { data, error } = await this.supabase
        .from('saved_plot_views')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id) // Only user's own views
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error listing plot views:', error);
        perfLogger.end(`listPlotViews-${projectId.slice(0, 8)}`, 'error');
        return { success: false, error: error.message };
      }

      console.log(`✅ Found ${data.length} plot views`);
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
    perfLogger.start(`deletePlotView-${viewId.slice(0, 8)}`);

    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();

      if (authError || !user) {
        console.error('❌ Authentication required to delete plot views');
        perfLogger.end(`deletePlotView-${viewId.slice(0, 8)}`, 'auth-failed');
        return { success: false, error: 'Authentication required' };
      }

      console.log('🗑️ Deleting plot view:', viewId);

      const { error } = await this.supabase
        .from('saved_plot_views')
        .delete()
        .eq('id', viewId)
        .eq('user_id', user.id); // Ensure user owns this view

      if (error) {
        console.error('❌ Error deleting plot view:', error);
        perfLogger.end(`deletePlotView-${viewId.slice(0, 8)}`, 'error');
        return { success: false, error: error.message };
      }

      console.log('✅ Plot view deleted successfully');
      perfLogger.end(`deletePlotView-${viewId.slice(0, 8)}`, 'success');

      return { success: true };

    } catch (error) {
      console.error('❌ Delete plot view exception:', error);
      perfLogger.end(`deletePlotView-${viewId.slice(0, 8)}`, 'exception');
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
          warnings: [],
          errors: []
        };
      }

      // Query all files at once
      const { data: filesData, error } = await this.supabase
        .from('pin_files')
        .select('id, file_name, updated_at')
        .in('id', Array.from(fileIds));

      if (error) {
        console.error('❌ Error querying files:', error);
        perfLogger.end('validatePlotView', 'query-error');
        return {
          valid: false,
          allFilesAvailable: false,
          missingFiles: [],
          modifiedFiles: [],
          availablePlotIds: [],
          warnings: [],
          errors: ['Failed to validate files']
        };
      }

      // Build availability map
      const availableFileIds = new Set(filesData.map(f => f.id));
      const missingFiles: FileAvailability[] = [];
      const modifiedFiles: FileAvailability[] = [];
      const availablePlotIds: string[] = [];

      // Check each plot
      config.plots.forEach(plot => {
        if (plot.type === 'device' && plot.fileId) {
          if (availableFileIds.has(plot.fileId)) {
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
            missingFiles.push({
              fileId: plot.fileId,
              fileName: plot.fileName || 'Unknown',
              available: false
            });
          }
        } else if (plot.type === 'marine-meteo') {
          // Marine/meteo plots don't have files
          availablePlotIds.push(plot.id);
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

      console.log(`✅ Validation complete: ${availablePlotIds.length}/${config.plots.length} plots available`);
      perfLogger.end('validatePlotView', `${availablePlotIds.length}/${config.plots.length}`);

      return {
        valid: availablePlotIds.length > 0,
        allFilesAvailable,
        missingFiles,
        modifiedFiles,
        availablePlotIds,
        warnings,
        errors
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
        warnings: [],
        errors: ['Validation failed due to an error']
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
