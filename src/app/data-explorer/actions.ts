'use server';

import { createClient } from '@/lib/supabase/server';

export interface UserFileDetails {
  id: string
  fileName: string
  projectName: string | null
  objectLabel: string | null
  deviceType: string
  uploadedAt: Date
  status: 'active' | 'processing'
  pinId: string
  projectId: string | null
  startDate: Date | null
  endDate: Date | null
  fileSource?: 'regular' | 'merged' // Add fileSource to identify merged files
}

export async function getAllUserFilesAction(): Promise<{
  success: boolean
  data?: UserFileDetails[]
  error?: string
}> {
  try {
    console.log('[Data Explorer Actions] Fetching all user files...');

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Data Explorer Actions] Authentication error:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('[Data Explorer Actions] User authenticated:', user.id);

    // First, get all pins owned by the user
    const { data: userPins, error: pinsError } = await supabase
      .from('pins')
      .select('id, label')
      .eq('user_id', user.id);

    if (pinsError) {
      console.error('[Data Explorer Actions] Error fetching pins:', pinsError);
      return {
        success: false,
        error: pinsError.message
      };
    }

    console.log(`[Data Explorer Actions] Found ${userPins?.length || 0} pins for user`);

    if (!userPins || userPins.length === 0) {
      console.log('[Data Explorer Actions] No pins found, returning empty array');
      return {
        success: true,
        data: []
      };
    }

    const pinIds = userPins.map(p => p.id);
    console.log('[Data Explorer Actions] Pin IDs:', pinIds);

    // Now get all files for these pins, ordered alphabetically by file name
    const { data: filesData, error: filesError } = await supabase
      .from('pin_files')
      .select('id, file_name, file_type, pin_id, project_id, uploaded_at, start_date, end_date')
      .in('pin_id', pinIds)
      .order('file_name', { ascending: true });

    if (filesError) {
      console.error('[Data Explorer Actions] Error fetching files:', filesError);
      return {
        success: false,
        error: filesError.message
      };
    }

    console.log(`[Data Explorer Actions] Found ${filesData?.length || 0} files`);

    // Get unique project IDs
    const projectIds = [...new Set(filesData?.map(f => f.project_id).filter(Boolean) || [])];

    // Fetch projects if there are any
    let projectsMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', projectIds);

      if (projectsData) {
        projectsMap = Object.fromEntries(projectsData.map(p => [p.id, p.name]));
      }
    }

    // Create a map of pin IDs to labels
    const pinsMap = Object.fromEntries(userPins.map(p => [p.id, p.label]));

    // Transform regular files
    const files: UserFileDetails[] = (filesData || []).map((item: any) => {
      let deviceType = 'Unknown';
      if (item.file_type === 'text/csv' || item.file_name?.toLowerCase().includes('csv')) {
        deviceType = 'CSV Data';
      } else if (item.file_type === 'application/json') {
        deviceType = 'JSON Data';
      } else if (item.file_type?.includes('excel') || item.file_name?.toLowerCase().includes('.xlsx')) {
        deviceType = 'Excel Data';
      }

      const status: 'active' | 'processing' = 'active';

      return {
        id: item.id,
        fileName: item.file_name,
        projectName: item.project_id ? (projectsMap[item.project_id] || null) : null,
        objectLabel: pinsMap[item.pin_id] || null,
        deviceType,
        uploadedAt: new Date(item.uploaded_at),
        status,
        pinId: item.pin_id,
        projectId: item.project_id,
        startDate: item.start_date ? new Date(item.start_date) : null,
        endDate: item.end_date ? new Date(item.end_date) : null,
        fileSource: 'regular' as const
      };
    });

    // Fetch merged files for all projects the user has access to
    const { data: mergedFilesData, error: mergedError } = await supabase
      .from('merged_files')
      .select('id, file_name, project_id, created_at, start_date, end_date')
      .in('project_id', projectIds.length > 0 ? projectIds : ['none'])
      .order('file_name', { ascending: true });

    if (mergedError) {
      console.error('[Data Explorer Actions] Error fetching merged files:', mergedError);
      // Continue without merged files - not a critical error
    }

    // Transform merged files
    const mergedFiles: UserFileDetails[] = (mergedFilesData || []).map((item: any) => ({
      id: item.id,
      fileName: item.file_name,
      projectName: item.project_id ? (projectsMap[item.project_id] || null) : null,
      objectLabel: 'Merged Files',
      deviceType: 'Merged Data',
      uploadedAt: new Date(item.created_at),
      status: 'active' as const,
      pinId: 'merged', // Special pinId for merged files
      projectId: item.project_id,
      startDate: item.start_date ? new Date(item.start_date) : null,
      endDate: item.end_date ? new Date(item.end_date) : null,
      fileSource: 'merged' as const
    }));

    // Combine regular files and merged files
    const allFiles = [...files, ...mergedFiles];

    console.log(`[Data Explorer Actions] Successfully fetched ${files.length} regular files and ${mergedFiles.length} merged files`);

    return {
      success: true,
      data: allFiles
    };
  } catch (error) {
    console.error('[Data Explorer Actions] Error fetching user files:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch user files'
    };
  }
}

export async function renameFileAction(fileId: string, newFileName: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    console.log('[Data Explorer Actions] Renaming file:', { fileId, newFileName });

    // Validate input
    if (!newFileName || newFileName.trim().length === 0) {
      return {
        success: false,
        error: 'File name cannot be empty'
      };
    }

    // Validate file name doesn't contain invalid characters
    const invalidChars = /[<>:"|?*\\/]/;
    if (invalidChars.test(newFileName)) {
      return {
        success: false,
        error: 'File name contains invalid characters'
      };
    }

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Data Explorer Actions] Authentication error:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('[Data Explorer Actions] User authenticated:', user.id);

    // Get file metadata to verify ownership
    const { data: fileData, error: getError } = await supabase
      .from('pin_files')
      .select('pin_id, file_name')
      .eq('id', fileId)
      .single();

    if (getError || !fileData) {
      console.error('[Data Explorer Actions] Error fetching file:', getError);
      return {
        success: false,
        error: 'File not found'
      };
    }

    console.log('[Data Explorer Actions] Current file name:', fileData.file_name);

    // Verify user owns the pin associated with this file
    const { data: pinData, error: pinError } = await supabase
      .from('pins')
      .select('user_id')
      .eq('id', fileData.pin_id)
      .single();

    if (pinError || !pinData) {
      console.error('[Data Explorer Actions] Error fetching pin:', pinError);
      return {
        success: false,
        error: 'Pin not found'
      };
    }

    if (pinData.user_id !== user.id) {
      console.error('[Data Explorer Actions] User does not own this file');
      return {
        success: false,
        error: 'You do not have permission to rename this file'
      };
    }

    // Update the file name in the database
    console.log('[Data Explorer Actions] Updating file name in database...');
    const { error: updateError } = await supabase
      .from('pin_files')
      .update({ file_name: newFileName })
      .eq('id', fileId);

    if (updateError) {
      console.error('[Data Explorer Actions] Error updating file name:', updateError);
      return {
        success: false,
        error: updateError.message
      };
    }

    console.log('[Data Explorer Actions] File renamed successfully:', newFileName);

    return {
      success: true
    };
  } catch (error) {
    console.error('[Data Explorer Actions] Error renaming file:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rename file'
    };
  }
}

export async function updateFileDatesAction(
  fileId: string,
  startDate: string,
  endDate: string,
  isDiscrete?: boolean,
  uniqueDates?: string[]
): Promise<{
  success: boolean
  error?: string
}> {
  try {
    console.log('[Data Explorer Actions] Updating file dates:', { fileId, startDate, endDate });

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Data Explorer Actions] Authentication error:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('[Data Explorer Actions] User authenticated:', user.id);

    // Get file metadata to verify ownership
    const { data: fileData, error: getError } = await supabase
      .from('pin_files')
      .select('pin_id, file_name')
      .eq('id', fileId)
      .single();

    if (getError || !fileData) {
      console.error('[Data Explorer Actions] Error fetching file:', getError);
      return {
        success: false,
        error: 'File not found'
      };
    }

    console.log('[Data Explorer Actions] Updating dates for file:', fileData.file_name);

    // Verify user owns the pin associated with this file
    const { data: pinData, error: pinError } = await supabase
      .from('pins')
      .select('user_id')
      .eq('id', fileData.pin_id)
      .single();

    if (pinError || !pinData) {
      console.error('[Data Explorer Actions] Error fetching pin:', pinError);
      return {
        success: false,
        error: 'Pin not found'
      };
    }

    if (pinData.user_id !== user.id) {
      console.error('[Data Explorer Actions] User does not own this file');
      return {
        success: false,
        error: 'You do not have permission to update this file'
      };
    }

    // Update the file dates in the database
    console.log('[Data Explorer Actions] Updating file dates in database...');

    const updateData: any = {
      start_date: startDate,
      end_date: endDate
    };

    // Add discrete file metadata if provided
    if (isDiscrete !== undefined) {
      updateData.is_discrete = isDiscrete;
      updateData.unique_dates = uniqueDates || null;
    }

    const { error: updateError } = await supabase
      .from('pin_files')
      .update(updateData)
      .eq('id', fileId);

    if (updateError) {
      console.error('[Data Explorer Actions] Error updating file dates:', updateError);
      return {
        success: false,
        error: updateError.message
      };
    }

    console.log('[Data Explorer Actions] File dates updated successfully');

    return {
      success: true
    };
  } catch (error) {
    console.error('[Data Explorer Actions] Error updating file dates:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update file dates'
    };
  }
}

export async function deleteFileAction(fileId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    console.log('[Data Explorer Actions] Deleting file:', fileId);

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Data Explorer Actions] Authentication error:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('[Data Explorer Actions] User authenticated:', user.id);

    // Get file metadata to verify ownership
    const { data: fileData, error: getError } = await supabase
      .from('pin_files')
      .select('pin_id, file_path, file_name')
      .eq('id', fileId)
      .single();

    if (getError || !fileData) {
      console.error('[Data Explorer Actions] Error fetching file:', getError);
      return {
        success: false,
        error: 'File not found'
      };
    }

    console.log('[Data Explorer Actions] File to delete:', fileData.file_name);

    // Verify user owns the pin associated with this file
    const { data: pinData, error: pinError } = await supabase
      .from('pins')
      .select('user_id')
      .eq('id', fileData.pin_id)
      .single();

    if (pinError || !pinData) {
      console.error('[Data Explorer Actions] Error fetching pin:', pinError);
      return {
        success: false,
        error: 'Pin not found'
      };
    }

    if (pinData.user_id !== user.id) {
      console.error('[Data Explorer Actions] User does not own this file');
      return {
        success: false,
        error: 'You do not have permission to delete this file'
      };
    }

    // Delete file from storage (optional - file might not exist)
    if (fileData.file_path) {
      const { error: storageError } = await supabase.storage
        .from('pin-files')
        .remove([fileData.file_path]);

      if (storageError) {
        console.warn('[Data Explorer Actions] Storage delete warning (continuing):', storageError);
      } else {
        console.log('[Data Explorer Actions] File deleted from storage');
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('pin_files')
      .delete()
      .eq('id', fileId);

    if (deleteError) {
      console.error('[Data Explorer Actions] Error deleting file from database:', deleteError);
      return {
        success: false,
        error: deleteError.message
      };
    }

    console.log('[Data Explorer Actions] File deleted successfully');

    return {
      success: true
    };
  } catch (error) {
    console.error('[Data Explorer Actions] Error deleting file:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file'
    };
  }
}

export async function downloadFileAction(fileId: string): Promise<{
  success: boolean
  data?: { blob: Blob; fileName: string }
  error?: string
}> {
  try {
    console.log('[Data Explorer Actions] Downloading file:', fileId);

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Data Explorer Actions] Authentication error:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('[Data Explorer Actions] User authenticated:', user.id);

    // Get file metadata to verify ownership
    const { data: fileData, error: getError } = await supabase
      .from('pin_files')
      .select('pin_id, file_path, file_name')
      .eq('id', fileId)
      .single();

    if (getError || !fileData) {
      console.error('[Data Explorer Actions] Error fetching file:', getError);
      return {
        success: false,
        error: 'File not found'
      };
    }

    console.log('[Data Explorer Actions] File to download:', fileData.file_name);

    // Verify user owns the pin associated with this file
    const { data: pinData, error: pinError } = await supabase
      .from('pins')
      .select('user_id')
      .eq('id', fileData.pin_id)
      .single();

    if (pinError || !pinData) {
      console.error('[Data Explorer Actions] Error fetching pin:', pinError);
      return {
        success: false,
        error: 'Pin not found'
      };
    }

    if (pinData.user_id !== user.id) {
      console.error('[Data Explorer Actions] User does not own this file');
      return {
        success: false,
        error: 'You do not have permission to download this file'
      };
    }

    if (!fileData.file_path) {
      console.error('[Data Explorer Actions] No file path found');
      return {
        success: false,
        error: 'File path not found'
      };
    }

    // Download file from storage
    const { data: blob, error: downloadError } = await supabase.storage
      .from('pin-files')
      .download(fileData.file_path);

    if (downloadError || !blob) {
      console.error('[Data Explorer Actions] Error downloading file:', downloadError);
      return {
        success: false,
        error: downloadError?.message || 'Failed to download file'
      };
    }

    console.log('[Data Explorer Actions] File downloaded successfully');

    return {
      success: true,
      data: {
        blob,
        fileName: fileData.file_name
      }
    };
  } catch (error) {
    console.error('[Data Explorer Actions] Error downloading file:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to download file'
    };
  }
}

export async function fetchFileDataAction(fileId: string): Promise<{
  success: boolean
  data?: Array<Record<string, any>>
  error?: string
}> {
  try {
    console.log('[Data Explorer Actions] Fetching file data:', fileId);

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Data Explorer Actions] Authentication error:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('[Data Explorer Actions] User authenticated:', user.id);

    // Get file metadata to verify ownership
    const { data: fileData, error: getError } = await supabase
      .from('pin_files')
      .select('pin_id, file_path, file_name')
      .eq('id', fileId)
      .single();

    if (getError || !fileData) {
      console.error('[Data Explorer Actions] Error fetching file:', getError);
      return {
        success: false,
        error: 'File not found'
      };
    }

    console.log('[Data Explorer Actions] File to fetch data from:', fileData.file_name);

    // Verify user owns the pin associated with this file
    const { data: pinData, error: pinError } = await supabase
      .from('pins')
      .select('user_id')
      .eq('id', fileData.pin_id)
      .single();

    if (pinError || !pinData) {
      console.error('[Data Explorer Actions] Error fetching pin:', pinError);
      return {
        success: false,
        error: 'Pin not found'
      };
    }

    if (pinData.user_id !== user.id) {
      console.error('[Data Explorer Actions] User does not own this file');
      return {
        success: false,
        error: 'You do not have permission to access this file'
      };
    }

    if (!fileData.file_path) {
      console.error('[Data Explorer Actions] No file path found');
      return {
        success: false,
        error: 'File path not found'
      };
    }

    // Download file from storage
    const { data: blob, error: downloadError } = await supabase.storage
      .from('pin-files')
      .download(fileData.file_path);

    if (downloadError || !blob) {
      console.error('[Data Explorer Actions] Error downloading file:', downloadError);
      return {
        success: false,
        error: downloadError?.message || 'Failed to download file'
      };
    }

    console.log('[Data Explorer Actions] File downloaded, parsing CSV...');

    // Parse CSV using papa-parse
    const Papa = (await import('papaparse')).default;
    const text = await blob.text();

    const parseResult = Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0) {
      console.error('[Data Explorer Actions] CSV parsing errors:', parseResult.errors);
      return {
        success: false,
        error: 'Failed to parse CSV file'
      };
    }

    console.log('[Data Explorer Actions] CSV parsed successfully, rows:', parseResult.data.length);

    return {
      success: true,
      data: parseResult.data as Array<Record<string, any>>
    };
  } catch (error) {
    console.error('[Data Explorer Actions] Error fetching file data:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch file data'
    };
  }
}

export async function uploadCleanedFileAction(
  originalFileId: string,
  cleanedData: Array<Record<string, any>>,
  cleanedFileName: string
): Promise<{
  success: boolean
  fileId?: string
  error?: string
}> {
  try {
    console.log('[Data Explorer Actions] Uploading cleaned file:', cleanedFileName);

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Data Explorer Actions] Authentication error:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('[Data Explorer Actions] User authenticated:', user.id);

    // Get original file metadata
    const { data: originalFile, error: getError } = await supabase
      .from('pin_files')
      .select('pin_id, project_id, file_type, start_date, end_date')
      .eq('id', originalFileId)
      .single();

    if (getError || !originalFile) {
      console.error('[Data Explorer Actions] Error fetching original file:', getError);
      return {
        success: false,
        error: 'Original file not found'
      };
    }

    // Verify user owns the pin
    const { data: pinData, error: pinError } = await supabase
      .from('pins')
      .select('user_id')
      .eq('id', originalFile.pin_id)
      .single();

    if (pinError || !pinData || pinData.user_id !== user.id) {
      console.error('[Data Explorer Actions] User does not own this file');
      return {
        success: false,
        error: 'You do not have permission to upload files to this pin'
      };
    }

    // Convert cleaned data back to CSV
    const Papa = (await import('papaparse')).default;
    const csv = Papa.unparse(cleanedData);
    const blob = new Blob([csv], { type: 'text/csv' });

    // Upload to storage
    const filePath = `${user.id}/${originalFile.pin_id}/${Date.now()}_${cleanedFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('pin-files')
      .upload(filePath, blob);

    if (uploadError) {
      console.error('[Data Explorer Actions] Error uploading file:', uploadError);
      return {
        success: false,
        error: uploadError.message
      };
    }

    console.log('[Data Explorer Actions] File uploaded to storage');

    // Insert file record into database
    const { data: newFile, error: insertError } = await supabase
      .from('pin_files')
      .insert({
        pin_id: originalFile.pin_id,
        project_id: originalFile.project_id,
        file_name: cleanedFileName,
        file_path: filePath,
        file_type: 'text/csv',
        start_date: originalFile.start_date,
        end_date: originalFile.end_date,
      })
      .select('id')
      .single();

    if (insertError || !newFile) {
      console.error('[Data Explorer Actions] Error inserting file record:', insertError);
      // Try to clean up uploaded file
      await supabase.storage.from('pin-files').remove([filePath]);
      return {
        success: false,
        error: insertError?.message || 'Failed to create file record'
      };
    }

    console.log('[Data Explorer Actions] Cleaned file uploaded successfully');

    return {
      success: true,
      fileId: newFile.id
    };
  } catch (error) {
    console.error('[Data Explorer Actions] Error uploading cleaned file:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload cleaned file'
    };
  }
}
