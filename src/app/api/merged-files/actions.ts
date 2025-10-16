'use server';

import { mergedFilesService, type CreateMergedFileParams, type AddFilesToMergedFileParams } from '@/lib/supabase/merged-files-service';

/**
 * Create a new merged file
 */
export async function createMergedFileAction(params: CreateMergedFileParams) {
  try {
    const result = await mergedFilesService.createMergedFile(params);
    return result;
  } catch (error) {
    console.error('Error in createMergedFileAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create merged file'
    };
  }
}

/**
 * Add files to an existing merged file
 */
export async function addFilesToMergedFileAction(params: AddFilesToMergedFileParams) {
  try {
    const result = await mergedFilesService.addFilesToMergedFile(params);
    return result;
  } catch (error) {
    console.error('Error in addFilesToMergedFileAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add files to merged file'
    };
  }
}

/**
 * Get all merged files for a pin
 */
export async function getMergedFilesByPinAction(pinId: string) {
  try {
    const result = await mergedFilesService.getMergedFilesByPin(pinId);
    return result;
  } catch (error) {
    console.error('Error in getMergedFilesByPinAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch merged files'
    };
  }
}

/**
 * Get all merged files for a project
 */
export async function getMergedFilesByProjectAction(projectId: string) {
  try {
    const result = await mergedFilesService.getMergedFilesByProject(projectId);
    return result;
  } catch (error) {
    console.error('Error in getMergedFilesByProjectAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch merged files'
    };
  }
}

/**
 * Download merged file content
 */
export async function downloadMergedFileAction(filePath: string) {
  try {
    const result = await mergedFilesService.downloadMergedFile(filePath);

    if (result.success && result.data) {
      // Convert Blob to text for transmission
      const text = await result.data.text();
      return { success: true, data: text };
    }

    return { success: false, error: result.error };
  } catch (error) {
    console.error('Error in downloadMergedFileAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download merged file'
    };
  }
}

/**
 * Delete a merged file
 */
export async function deleteMergedFileAction(mergedFileId: string) {
  try {
    const result = await mergedFilesService.deleteMergedFile(mergedFileId);
    return result;
  } catch (error) {
    console.error('Error in deleteMergedFileAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete merged file'
    };
  }
}

/**
 * Rename a merged file
 */
export async function renameMergedFileAction(mergedFileId: string, newFileName: string) {
  try {
    const result = await mergedFilesService.renameMergedFile(mergedFileId, newFileName);
    return result;
  } catch (error) {
    console.error('Error in renameMergedFileAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rename merged file'
    };
  }
}

/**
 * Check source files status for a merged file
 */
export async function checkSourceFilesStatusAction(mergedFileId: string) {
  try {
    const result = await mergedFilesService.checkSourceFilesStatus(mergedFileId);
    return result;
  } catch (error) {
    console.error('Error in checkSourceFilesStatusAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check source files status'
    };
  }
}
