import { createClient } from './client';
import { notificationService } from './notification-service';

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

      // Step 3: Copy pin files if any exist (optional - can be expanded later)
      logStep('copy-files', 'in-progress', 'Checking for pin files...');
      
      const { data: originalFiles, error: filesError } = await this.supabase
        .from('pin_data_files')
        .select('*')
        .eq('pin_id', originalPinId);

      if (!filesError && originalFiles && originalFiles.length > 0) {
        logStep('copy-files', 'success', `Found ${originalFiles.length} files - file copying not implemented yet`);
        // TODO: Implement file copying logic later
      } else {
        logStep('copy-files', 'success', 'No files to copy');
      }

      // Step 4: Send success notification to target user
      logStep('notify-user', 'in-progress', 'Sending notification to target user...');
      
      try {
        await notificationService.createNotification({
          user_id: targetUser.user_id,
          title: 'Pin Copied to Your Account',
          message: `A pin has been copied to your account.`,
          notification_type: 'pin_copy',
          action_url: '/map-drawing',
          metadata: {
            original_pin_id: originalPinId,
            copied_pin_id: newPinId,
            from_user: await this.getCurrentUserEmail()
          }
        });
        
        logStep('notify-user', 'success', 'Notification sent successfully');
      } catch (notifyError) {
        logStep('notify-user', 'error', 'Failed to send notification', { error: notifyError });
        // Don't fail the whole process for notification errors
      }

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