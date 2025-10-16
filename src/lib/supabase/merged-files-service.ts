import { createClient } from './client';
import { fileStorageService } from './file-storage-service';
import type { MergeMode } from '@/lib/multiFileValidator';

export interface MergedFile {
  id: string;
  pinId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  mergeMode: MergeMode;
  mergeRules: any[];
  sourceFileIds: string[];
  sourceFilesMetadata: Record<string, any>;
  missingSourceFiles: string[];
  startDate: Date | null;
  endDate: Date | null;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMergedFileParams {
  pinId: string;
  fileName: string;
  csvContent: string;
  mergeMode: MergeMode;
  mergeRules: any[];
  sourceFileIds: string[];
  sourceFilesMetadata: Record<string, any>;
  startDate?: string;
  endDate?: string;
  projectId: string; // Will be cast to UUID in the insert
}

export interface AddFilesToMergedFileParams {
  mergedFileId: string;
  newCsvContent: string;
  newSourceFileIds: string[];
  newSourceFilesMetadata: Record<string, any>;
  startDate?: string;
  endDate?: string;
}

class MergedFilesService {
  /**
   * Create a new merged file
   */
  async createMergedFile(params: CreateMergedFileParams): Promise<{ success: boolean; data?: MergedFile; error?: string }> {
    const supabase = createClient();

    try {
      // Generate file path for storage
      const timestamp = Date.now();
      const sanitizedFileName = params.fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = `${params.pinId}/merged/${timestamp}_${sanitizedFileName}`;

      // Convert CSV content to Blob
      const blob = new Blob([params.csvContent], { type: 'text/csv' });

      // Upload file to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pin-files')
        .upload(filePath, blob, {
          contentType: 'text/csv',
          upsert: false
        });

      if (uploadError) {
        console.error('Failed to upload merged file:', uploadError);
        return { success: false, error: `Upload failed: ${uploadError.message}` };
      }

      // Get file size
      const fileSize = blob.size;

      // Insert metadata into database
      const { data: dbData, error: dbError } = await supabase
        .from('merged_files')
        .insert({
          pin_id: params.pinId,
          file_name: params.fileName,
          file_path: filePath,
          file_size: fileSize,
          file_type: 'text/csv',
          merge_mode: params.mergeMode,
          merge_rules: params.mergeRules,
          source_file_ids: params.sourceFileIds,
          source_files_metadata: params.sourceFilesMetadata,
          missing_source_files: [],
          start_date: params.startDate || null,
          end_date: params.endDate || null,
          project_id: params.projectId
        })
        .select()
        .single();

      if (dbError) {
        console.error('Failed to save merged file metadata:', dbError);
        // Clean up uploaded file
        await supabase.storage.from('pin-files').remove([filePath]);
        return { success: false, error: `Database error: ${dbError.message}` };
      }

      const mergedFile: MergedFile = {
        id: dbData.id,
        pinId: dbData.pin_id,
        fileName: dbData.file_name,
        filePath: dbData.file_path,
        fileSize: dbData.file_size,
        fileType: dbData.file_type,
        mergeMode: dbData.merge_mode as MergeMode,
        mergeRules: dbData.merge_rules || [],
        sourceFileIds: dbData.source_file_ids || [],
        sourceFilesMetadata: dbData.source_files_metadata || {},
        missingSourceFiles: dbData.missing_source_files || [],
        startDate: dbData.start_date ? new Date(dbData.start_date) : null,
        endDate: dbData.end_date ? new Date(dbData.end_date) : null,
        projectId: dbData.project_id,
        createdAt: new Date(dbData.created_at),
        updatedAt: new Date(dbData.updated_at)
      };

      return { success: true, data: mergedFile };
    } catch (error) {
      console.error('Error creating merged file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Add files to an existing merged file (update the merge)
   */
  async addFilesToMergedFile(params: AddFilesToMergedFileParams): Promise<{ success: boolean; data?: MergedFile; error?: string }> {
    const supabase = createClient();

    try {
      // Get existing merged file
      const { data: existingFile, error: fetchError } = await supabase
        .from('merged_files')
        .select('*')
        .eq('id', params.mergedFileId)
        .single();

      if (fetchError || !existingFile) {
        return { success: false, error: 'Merged file not found' };
      }

      // Update file in storage with new content
      const blob = new Blob([params.newCsvContent], { type: 'text/csv' });
      const { error: uploadError } = await supabase.storage
        .from('pin-files')
        .update(existingFile.file_path, blob, {
          contentType: 'text/csv',
          upsert: true
        });

      if (uploadError) {
        console.error('Failed to update merged file:', uploadError);
        return { success: false, error: `Upload failed: ${uploadError.message}` };
      }

      // Merge source file IDs and metadata
      const updatedSourceFileIds = [
        ...(existingFile.source_file_ids || []),
        ...params.newSourceFileIds
      ];

      const updatedSourceFilesMetadata = {
        ...(existingFile.source_files_metadata || {}),
        ...params.newSourceFilesMetadata
      };

      // Update database metadata
      const { data: updatedData, error: updateError } = await supabase
        .from('merged_files')
        .update({
          file_size: blob.size,
          source_file_ids: updatedSourceFileIds,
          source_files_metadata: updatedSourceFilesMetadata,
          start_date: params.startDate || existingFile.start_date,
          end_date: params.endDate || existingFile.end_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.mergedFileId)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update merged file metadata:', updateError);
        return { success: false, error: `Database error: ${updateError.message}` };
      }

      const mergedFile: MergedFile = {
        id: updatedData.id,
        pinId: updatedData.pin_id,
        fileName: updatedData.file_name,
        filePath: updatedData.file_path,
        fileSize: updatedData.file_size,
        fileType: updatedData.file_type,
        mergeMode: updatedData.merge_mode as MergeMode,
        mergeRules: updatedData.merge_rules || [],
        sourceFileIds: updatedData.source_file_ids || [],
        sourceFilesMetadata: updatedData.source_files_metadata || {},
        missingSourceFiles: updatedData.missing_source_files || [],
        startDate: updatedData.start_date ? new Date(updatedData.start_date) : null,
        endDate: updatedData.end_date ? new Date(updatedData.end_date) : null,
        projectId: updatedData.project_id,
        createdAt: new Date(updatedData.created_at),
        updatedAt: new Date(updatedData.updated_at)
      };

      return { success: true, data: mergedFile };
    } catch (error) {
      console.error('Error adding files to merged file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all merged files for a specific pin
   */
  async getMergedFilesByPin(pinId: string): Promise<{ success: boolean; data?: MergedFile[]; error?: string }> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('merged_files')
        .select('*')
        .eq('pin_id', pinId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch merged files:', error);
        return { success: false, error: error.message };
      }

      const mergedFiles: MergedFile[] = (data || []).map(item => ({
        id: item.id,
        pinId: item.pin_id,
        fileName: item.file_name,
        filePath: item.file_path,
        fileSize: item.file_size,
        fileType: item.file_type,
        mergeMode: item.merge_mode as MergeMode,
        mergeRules: item.merge_rules || [],
        sourceFileIds: item.source_file_ids || [],
        sourceFilesMetadata: item.source_files_metadata || {},
        missingSourceFiles: item.missing_source_files || [],
        startDate: item.start_date ? new Date(item.start_date) : null,
        endDate: item.end_date ? new Date(item.end_date) : null,
        projectId: item.project_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));

      return { success: true, data: mergedFiles };
    } catch (error) {
      console.error('Error fetching merged files:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get all merged files for a specific project
   */
  async getMergedFilesByProject(projectId: string): Promise<{ success: boolean; data?: MergedFile[]; error?: string }> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from('merged_files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch merged files:', error);
        return { success: false, error: error.message };
      }

      const mergedFiles: MergedFile[] = (data || []).map(item => ({
        id: item.id,
        pinId: item.pin_id,
        fileName: item.file_name,
        filePath: item.file_path,
        fileSize: item.file_size,
        fileType: item.file_type,
        mergeMode: item.merge_mode as MergeMode,
        mergeRules: item.merge_rules || [],
        sourceFileIds: item.source_file_ids || [],
        sourceFilesMetadata: item.source_files_metadata || {},
        missingSourceFiles: item.missing_source_files || [],
        startDate: item.start_date ? new Date(item.start_date) : null,
        endDate: item.end_date ? new Date(item.end_date) : null,
        projectId: item.project_id,
        createdAt: new Date(item.created_at),
        updatedAt: new Date(item.updated_at)
      }));

      return { success: true, data: mergedFiles };
    } catch (error) {
      console.error('Error fetching merged files:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Download merged file content
   */
  async downloadMergedFile(filePath: string): Promise<{ success: boolean; data?: Blob; error?: string }> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.storage
        .from('pin-files')
        .download(filePath);

      if (error) {
        console.error('Failed to download merged file:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error downloading merged file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete a merged file
   */
  async deleteMergedFile(mergedFileId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();

    try {
      // Get file path first
      const { data: fileData, error: fetchError } = await supabase
        .from('merged_files')
        .select('file_path')
        .eq('id', mergedFileId)
        .single();

      if (fetchError || !fileData) {
        return { success: false, error: 'Merged file not found' };
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('pin-files')
        .remove([fileData.file_path]);

      if (storageError) {
        console.error('Failed to delete file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('merged_files')
        .delete()
        .eq('id', mergedFileId);

      if (dbError) {
        console.error('Failed to delete merged file from database:', dbError);
        return { success: false, error: dbError.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting merged file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Rename a merged file
   */
  async renameMergedFile(mergedFileId: string, newFileName: string): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('merged_files')
        .update({ file_name: newFileName })
        .eq('id', mergedFileId);

      if (error) {
        console.error('Failed to rename merged file:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error renaming merged file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check and update missing source files status
   */
  async checkSourceFilesStatus(mergedFileId: string): Promise<{ success: boolean; missingFiles?: string[]; error?: string }> {
    const supabase = createClient();

    try {
      // Get merged file with source file IDs
      const { data: mergedFile, error: fetchError } = await supabase
        .from('merged_files')
        .select('source_file_ids, missing_source_files')
        .eq('id', mergedFileId)
        .single();

      if (fetchError || !mergedFile) {
        return { success: false, error: 'Merged file not found' };
      }

      const sourceFileIds = mergedFile.source_file_ids || [];

      // Check which source files still exist
      const { data: existingFiles, error: checkError } = await supabase
        .from('pin_files')
        .select('id')
        .in('id', sourceFileIds);

      if (checkError) {
        console.error('Failed to check source files:', checkError);
        return { success: false, error: checkError.message };
      }

      const existingFileIds = new Set((existingFiles || []).map(f => f.id));
      const missingFileIds = sourceFileIds.filter((id: string) => !existingFileIds.has(id));

      // Update missing_source_files if there are any new missing files
      if (missingFileIds.length > 0) {
        const currentMissing = mergedFile.missing_source_files || [];
        const updatedMissing = Array.from(new Set([...currentMissing, ...missingFileIds]));

        await supabase
          .from('merged_files')
          .update({ missing_source_files: updatedMissing })
          .eq('id', mergedFileId);
      }

      return { success: true, missingFiles: missingFileIds };
    } catch (error) {
      console.error('Error checking source files status:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const mergedFilesService = new MergedFilesService();
