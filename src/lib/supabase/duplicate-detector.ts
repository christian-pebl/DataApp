import { createClient } from './client';

/**
 * Utility functions for detecting and handling duplicate files
 */

export interface DuplicateFile {
  pinId: string;
  fileName: string;
  duplicateCount: number;
  fileIds: string[];
  createdDates: string[];
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingFileId?: string;
  existingFileName?: string;
}

/**
 * Check if a file with the given name already exists for a pin
 */
export async function checkForDuplicateFile(
  pinId: string,
  fileName: string
): Promise<DuplicateCheckResult> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('pin_files')
      .select('id, file_name')
      .eq('pin_id', pinId)
      .eq('file_name', fileName)
      .maybeSingle();

    if (error) {
      console.error('Error checking for duplicate file:', error);
      return { isDuplicate: false };
    }

    if (data) {
      return {
        isDuplicate: true,
        existingFileId: data.id,
        existingFileName: data.file_name,
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error('Error in checkForDuplicateFile:', error);
    return { isDuplicate: false };
  }
}

/**
 * Find all duplicate files in the database
 */
export async function findAllDuplicates(): Promise<{
  success: boolean;
  duplicates?: DuplicateFile[];
  error?: string;
}> {
  const supabase = createClient();

  try {
    // Get all files grouped by pin_id and file_name
    const { data: files, error } = await supabase
      .from('pin_files')
      .select('id, pin_id, file_name, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      return {
        success: false,
        error: `Failed to fetch files: ${error.message}`,
      };
    }

    if (!files || files.length === 0) {
      return { success: true, duplicates: [] };
    }

    // Group files by pin_id and file_name
    const fileGroups = new Map<string, typeof files>();

    for (const file of files) {
      const key = `${file.pin_id}:${file.file_name}`;
      if (!fileGroups.has(key)) {
        fileGroups.set(key, []);
      }
      fileGroups.get(key)!.push(file);
    }

    // Find groups with duplicates
    const duplicates: DuplicateFile[] = [];

    for (const [key, group] of fileGroups.entries()) {
      if (group.length > 1) {
        const [pinId, fileName] = key.split(':');
        duplicates.push({
          pinId,
          fileName,
          duplicateCount: group.length,
          fileIds: group.map((f) => f.id),
          createdDates: group.map((f) => f.created_at),
        });
      }
    }

    return { success: true, duplicates };
  } catch (error) {
    console.error('Error in findAllDuplicates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove duplicate files, keeping only the oldest one for each pin_id + file_name combination
 */
export async function removeDuplicates(
  keepStrategy: 'oldest' | 'newest' = 'oldest'
): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const supabase = createClient();

  try {
    // First, find all duplicates
    const { success, duplicates, error } = await findAllDuplicates();

    if (!success || !duplicates) {
      return { success: false, error: error || 'Failed to find duplicates' };
    }

    if (duplicates.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    let deletedCount = 0;

    // Process each duplicate group
    for (const duplicate of duplicates) {
      // Determine which file to keep
      let keepIndex = 0;
      if (keepStrategy === 'newest') {
        keepIndex = duplicate.fileIds.length - 1;
      }

      // Delete all files except the one we want to keep
      const filesToDelete = duplicate.fileIds.filter(
        (_, index) => index !== keepIndex
      );

      for (const fileId of filesToDelete) {
        // Get file path first
        const { data: fileData } = await supabase
          .from('pin_files')
          .select('file_path')
          .eq('id', fileId)
          .single();

        if (fileData?.file_path) {
          // Delete from storage
          await supabase.storage.from('pin-files').remove([fileData.file_path]);
        }

        // Delete from database
        const { error: deleteError } = await supabase
          .from('pin_files')
          .delete()
          .eq('id', fileId);

        if (deleteError) {
          console.error(`Failed to delete file ${fileId}:`, deleteError);
        } else {
          deletedCount++;
        }
      }
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error('Error in removeDuplicates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a unique filename by appending a number if duplicate exists
 */
export async function generateUniqueFileName(
  pinId: string,
  baseFileName: string
): Promise<string> {
  const supabase = createClient();

  // Check if base name is available
  const { data: existingFile } = await supabase
    .from('pin_files')
    .select('id')
    .eq('pin_id', pinId)
    .eq('file_name', baseFileName)
    .maybeSingle();

  if (!existingFile) {
    return baseFileName;
  }

  // Extract name and extension
  const lastDotIndex = baseFileName.lastIndexOf('.');
  const name = lastDotIndex > 0 ? baseFileName.slice(0, lastDotIndex) : baseFileName;
  const extension = lastDotIndex > 0 ? baseFileName.slice(lastDotIndex) : '';

  // Try appending numbers until we find a unique name
  let counter = 1;
  while (counter < 1000) {
    const newFileName = `${name}_${counter}${extension}`;

    const { data: duplicate } = await supabase
      .from('pin_files')
      .select('id')
      .eq('pin_id', pinId)
      .eq('file_name', newFileName)
      .maybeSingle();

    if (!duplicate) {
      return newFileName;
    }

    counter++;
  }

  // Fallback: append timestamp
  return `${name}_${Date.now()}${extension}`;
}
