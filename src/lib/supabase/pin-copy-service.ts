import { createClient } from './client';

export interface CopyProgress {
  step: string;
  status: 'pending' | 'in-progress' | 'success' | 'error';
  message: string;
  details?: any;
}

export interface CopyResult {
  success: boolean;
  error?: string;
  copiedPinId?: string;
  progress: CopyProgress[];
}

class PinCopyService {
  private supabase = createClient();

  /**
   * Copy pin using database functions to bypass RLS restrictions
   */
  async copyPinToUser(
    originalPinId: string, 
    targetUserEmail: string,
    onProgress?: (progress: CopyProgress[]) => void
  ): Promise<CopyResult> {
    const progress: CopyProgress[] = [];
    
    const logStep = (step: string, status: CopyProgress['status'], message: string, details?: any) => {
      const progressItem: CopyProgress = { step, status, message, details };
      progress.push(progressItem);
      console.log(`📌 Pin Copy [${step}] ${status}: ${message}`, details || '');
      onProgress?.(progress);
    };

    try {
      // Step 1: Validate target user using database function
      logStep('validate-user', 'in-progress', 'Validating target user...');
      
      const { data: userCheckResult, error: userError } = await this.supabase
        .rpc('check_user_exists_by_email', { user_email: targetUserEmail });

      if (userError || !userCheckResult?.[0]?.user_exists) {
        logStep('validate-user', 'error', 'Target user not found', { email: targetUserEmail, error: userError });
        return { success: false, error: 'Target user not found', progress };
      }

      const targetUser = userCheckResult[0];
      logStep('validate-user', 'success', `Target user validated: ${targetUser.display_name}`);

      // Step 2: Use database function to copy pin (bypasses RLS)
      logStep('copy-pin', 'in-progress', 'Copying pin using database function...');
      
      const { data: copyResult, error: copyError } = await this.supabase
        .rpc('copy_pin_to_user', {
          original_pin_id: originalPinId,
          target_user_email: targetUserEmail
        });

      if (copyError || !copyResult?.[0]?.success) {
        const errorMessage = copyError?.message || copyResult?.[0]?.message || 'Pin copy failed';
        logStep('copy-pin', 'error', errorMessage, { error: copyError, result: copyResult });
        return { success: false, error: errorMessage, progress };
      }

      const newPinId = copyResult[0].copied_pin_id;
      logStep('copy-pin', 'success', `Pin copy created with ID: ${newPinId}`);

      // Step 3: Copy pin files if any exist
      logStep('copy-files', 'in-progress', 'Checking for pin files...');
      
      // Note: Using pin_files table (not pin_data_files)
      const { data: originalFiles, error: filesError } = await this.supabase
        .from('pin_files')
        .select('*')
        .eq('pin_id', originalPinId);

      if (!filesError && originalFiles && originalFiles.length > 0) {
        logStep('copy-files', 'in-progress', `Found ${originalFiles.length} file(s) to copy`);
        
        // Step 2: Copy files with actual content
        let copiedCount = 0;
        let failedCount = 0;
        
        for (const originalFile of originalFiles) {
          try {
            // Generate new file path for the copied pin
            const newFilePath = originalFile.file_path.replace(
              `pins/${originalPinId}/`,
              `pins/${newPinId}/`
            );
            
            logStep('copy-files', 'in-progress', 
              `Copying file: ${originalFile.file_name}`);
            
            // Step 2a: Download the original file from storage
            console.log(`📥 Downloading original file: ${originalFile.file_path}`);
            const { data: fileBlob, error: downloadError } = await this.supabase.storage
              .from('pin-files')
              .download(originalFile.file_path);
            
            if (downloadError || !fileBlob) {
              console.error(`Failed to download file ${originalFile.file_name}:`, downloadError);
              failedCount++;
              continue;
            }
            
            console.log(`✅ Downloaded file: ${originalFile.file_name} (${fileBlob.size} bytes)`);
            
            // Step 2b: Upload the file to the new location
            console.log(`📤 Uploading to new location: ${newFilePath}`);
            const { error: uploadError } = await this.supabase.storage
              .from('pin-files')
              .upload(newFilePath, fileBlob, {
                cacheControl: '3600',
                upsert: false,
                contentType: originalFile.file_type || 'text/csv'
              });
            
            if (uploadError) {
              console.error(`Failed to upload file ${originalFile.file_name}:`, uploadError);
              failedCount++;
              continue;
            }
            
            console.log(`✅ Uploaded file to new location: ${newFilePath}`);
            
            // Step 2c: Create metadata entry for the copied file
            const newFileData = {
              pin_id: newPinId,
              file_name: originalFile.file_name,
              file_path: newFilePath,
              file_size: originalFile.file_size,
              file_type: originalFile.file_type,
              project_id: originalFile.project_id
            };
            
            const { error: insertError } = await this.supabase
              .from('pin_files')
              .insert(newFileData);
            
            if (insertError) {
              console.error(`Failed to create file metadata for ${originalFile.file_name}:`, insertError);
              // Try to clean up the uploaded file
              await this.supabase.storage
                .from('pin-files')
                .remove([newFilePath]);
              failedCount++;
            } else {
              copiedCount++;
              console.log(`✅ File fully copied: ${originalFile.file_name}`);
            }
            
          } catch (fileError) {
            console.error(`Error copying file ${originalFile.file_name}:`, fileError);
            failedCount++;
          }
        }
        
        if (copiedCount > 0) {
          logStep('copy-files', 'success', 
            `Successfully copied ${copiedCount} file(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}`);
        } else if (failedCount > 0) {
          logStep('copy-files', 'error', `Failed to copy files (0/${originalFiles.length} succeeded)`);
        }
        
      } else {
        logStep('copy-files', 'success', 'No files to copy');
      }

      // Step 4: Skip notification (notification system removed)
      logStep('notify-user', 'success', 'Skipped notification - notification system removed');

      // Success!
      logStep('complete', 'success', `Pin successfully copied to ${targetUserEmail}!`);
      
      return { 
        success: true, 
        copiedPinId: newPinId,
        progress 
      };

    } catch (error) {
      logStep('error', 'error', 'Unexpected error during pin copy', { error: error instanceof Error ? error.message : error });
      return { success: false, error: 'Unexpected error occurred', progress };
    }
  }

  private async getCurrentUserEmail(): Promise<string> {
    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      return user?.email || 'Unknown User';
    } catch {
      return 'Unknown User';
    }
  }
}

export const pinCopyService = new PinCopyService();