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

    // Transform the data
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
        endDate: item.end_date ? new Date(item.end_date) : null
      };
    });

    console.log(`[Data Explorer Actions] Successfully fetched ${files.length} files`);

    return {
      success: true,
      data: files
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
  endDate: string
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
    const { error: updateError } = await supabase
      .from('pin_files')
      .update({
        start_date: startDate,
        end_date: endDate
      })
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
