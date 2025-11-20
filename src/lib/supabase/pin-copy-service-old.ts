import { createClient } from './client';
// import { notificationService } from './notification-service'; // Commented out - notification-service doesn't exist

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
   * Simplified direct pin copy - bypasses pin_shares table entirely
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
      // Step 1: Validate target user
      logStep('validate-user', 'in-progress', 'Validating target user...');
      
      const { data: targetUser, error: userError } = await this.supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', targetUserEmail)
        .single();

      if (userError || !targetUser) {
        logStep('validate-user', 'error', 'Target user not found', { email: targetUserEmail, error: userError });
        return { success: false, error: 'Target user not found', progress };
      }

      logStep('validate-user', 'success', `Target user validated: ${targetUser.full_name || targetUser.email}`);

      // Step 2: Fetch original pin
      logStep('fetch-original', 'in-progress', 'Fetching original pin data...');
      
      const { data: originalPin, error: pinError } = await this.supabase
        .from('pins')
        .select('*')
        .eq('id', originalPinId)
        .single();

      if (pinError || !originalPin) {
        logStep('fetch-original', 'error', 'Original pin not found', { pinId: originalPinId, error: pinError });
        return { success: false, error: 'Original pin not found', progress };
      }

      logStep('fetch-original', 'success', `Original pin fetched: "${originalPin.label}"`);

      // Step 3: Create new pin for target user
      logStep('create-copy', 'in-progress', 'Creating pin copy...');
      
      const newPinData = {
        label: `${originalPin.label} (Copy)`,
        notes: originalPin.notes,
        lat: originalPin.lat,
        lng: originalPin.lng,
        color: originalPin.color,
        size: originalPin.size,
        is_private: originalPin.is_private,
        user_id: targetUser.id, // Assign to target user
        project_id: null, // Don't copy project associations
        tag_ids: originalPin.tag_ids || []
      };

      const { data: newPin, error: createError } = await this.supabase
        .from('pins')
        .insert([newPinData])
        .select()
        .single();

      if (createError || !newPin) {
        logStep('create-copy', 'error', 'Failed to create pin copy', { error: createError });
        return { success: false, error: 'Failed to create pin copy', progress };
      }

      logStep('create-copy', 'success', `Pin copy created with ID: ${newPin.id}`);

      // Step 4: Copy pin files if any exist
      logStep('copy-files', 'in-progress', 'Copying pin files...');
      
      const { data: originalFiles, error: filesError } = await this.supabase
        .from('pin_files')
        .select('*')
        .eq('pin_id', originalPinId);

      if (!filesError && originalFiles && originalFiles.length > 0) {
        let filesCopied = 0;
        for (const file of originalFiles) {
          try {
            const newFileData = {
              pin_id: newPin.id,
              user_id: targetUser.id,
              file_name: file.file_name,
              file_path: file.file_path, // Keep same path for now
              file_size: file.file_size,
              file_type: file.file_type,
              upload_date: new Date().toISOString()
            };

            await this.supabase.from('pin_files').insert([newFileData]);
            filesCopied++;
          } catch (fileError) {
            console.warn('Failed to copy file:', file.file_name, fileError);
          }
        }
        logStep('copy-files', 'success', `Copied ${filesCopied} files`);
      } else {
        logStep('copy-files', 'success', 'No files to copy');
      }

      // Step 5: Send success notification to target user
      logStep('notify-user', 'in-progress', 'Sending notification to target user...');

      try {
        // Notification service disabled - service doesn't exist
        /* await notificationService.createNotification({
          user_id: targetUser.id,
          title: 'Pin Copied to Your Account',
          message: `"${originalPin.label}" has been copied to your account.`,
          notification_type: 'pin_copy',
          action_url: '/map-drawing',
          metadata: {
            original_pin_id: originalPinId,
            copied_pin_id: newPin.id,
            from_user: await this.getCurrentUserEmail()
          }
        }); */
        
        logStep('notify-user', 'success', 'Notification sent successfully');
      } catch (notifyError) {
        logStep('notify-user', 'error', 'Failed to send notification', { error: notifyError });
        // Don't fail the whole process for notification errors
      }

      // Success!
      logStep('complete', 'success', `Pin successfully copied to ${targetUserEmail}!`);
      
      return { 
        success: true, 
        copiedPinId: newPin.id,
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