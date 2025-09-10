import { createClient } from './client';

export interface SafeShareResult {
  success: boolean;
  error?: string;
  shareId?: string;
  steps: Array<{
    step: string;
    status: 'success' | 'error' | 'warning';
    message: string;
    details?: any;
  }>;
}

export interface SchemaValidationResult {
  tableExists: boolean;
  hasCorrectColumns: boolean;
  missingColumns: string[];
  availableColumns: string[];
}

class EnhancedSharingService {
  private supabase = createClient();

  /**
   * Validate database schema before attempting operations
   */
  async validateSchema(): Promise<SchemaValidationResult> {
    try {
      // Step 1: Check if pin_shares table exists by doing a simple select
      const { data, error } = await this.supabase
        .from('pin_shares')
        .select('*')
        .limit(1);
      
      if (error) {
        return {
          tableExists: false,
          hasCorrectColumns: false,
          missingColumns: ['table does not exist'],
          availableColumns: []
        };
      }

      // Step 2: Test schema by trying to build a query with required columns
      const requiredColumns = ['pin_id', 'shared_with_user_id', 'shared_by_user_id', 'permission_level'];
      let availableColumns: string[] = [];
      let missingColumns: string[] = [];

      // Test each required column individually by trying to select it
      for (const column of requiredColumns) {
        try {
          const { error: columnError } = await this.supabase
            .from('pin_shares')
            .select(column)
            .limit(1);

          if (columnError) {
            missingColumns.push(column);
          } else {
            availableColumns.push(column);
          }
        } catch {
          missingColumns.push(column);
        }
      }

      // Also test for common columns that should exist
      const commonColumns = ['id', 'created_at'];
      for (const column of commonColumns) {
        try {
          const { error: columnError } = await this.supabase
            .from('pin_shares')
            .select(column)
            .limit(1);

          if (!columnError) {
            availableColumns.push(column);
          }
        } catch {
          // Ignore errors for common columns
        }
      }

      return {
        tableExists: true,
        hasCorrectColumns: missingColumns.length === 0,
        missingColumns,
        availableColumns
      };

    } catch (error) {
      return {
        tableExists: false,
        hasCorrectColumns: false,
        missingColumns: ['validation failed'],
        availableColumns: []
      };
    }
  }

  /**
   * Enhanced share with comprehensive logging and validation
   */
  async shareWithUserSafely(
    pinId: string,
    userId: string,
    permissionLevel: 'view' | 'edit',
    onProgress?: (step: string, status: 'success' | 'error' | 'warning', message: string, details?: any) => void
  ): Promise<SafeShareResult> {
    
    const steps: Array<{ step: string; status: 'success' | 'error' | 'warning'; message: string; details?: any }> = [];
    const logStep = (step: string, status: 'success' | 'error' | 'warning', message: string, details?: any) => {
      steps.push({ step, status, message, details });
      if (onProgress) onProgress(step, status, message, details);
    };

    try {
      // Step 1: Validate authentication
      logStep('auth-check', 'success', 'Checking authentication...');
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        logStep('auth-check', 'error', 'Authentication failed', { error: authError?.message });
        return { success: false, error: 'Authentication required', steps };
      }
      logStep('auth-check', 'success', `Authenticated as ${user.email}`, { userId: user.id });

      // Step 2: Validate database schema
      logStep('schema-validation', 'success', 'Validating database schema...');
      const schemaResult = await this.validateSchema();
      
      if (!schemaResult.tableExists) {
        logStep('schema-validation', 'error', 'pin_shares table does not exist', schemaResult);
        return { 
          success: false, 
          error: 'Database schema error: pin_shares table missing. Please run the database migration.', 
          steps 
        };
      }
      
      if (!schemaResult.hasCorrectColumns) {
        logStep('schema-validation', 'warning', 
          `Schema mismatch - missing columns: ${schemaResult.missingColumns.join(', ')}`,
          schemaResult
        );
        return {
          success: false,
          error: `Database schema error: Missing columns ${schemaResult.missingColumns.join(', ')}. Please run the database migration.`,
          steps
        };
      }
      
      logStep('schema-validation', 'success', 'Database schema validated successfully');

      // Step 3: Validate pin exists and user owns it
      logStep('pin-validation', 'success', 'Validating pin ownership...');
      const { data: pin, error: pinError } = await this.supabase
        .from('pins')
        .select('id, user_id')
        .eq('id', pinId)
        .single();

      if (pinError || !pin) {
        logStep('pin-validation', 'error', 'Pin not found', { pinId, error: pinError?.message });
        return { success: false, error: 'Pin not found', steps };
      }

      if (pin.user_id !== user.id) {
        logStep('pin-validation', 'error', 'User does not own this pin', { pinId, ownerId: pin.user_id, currentUserId: user.id });
        return { success: false, error: 'You can only share pins you own', steps };
      }

      logStep('pin-validation', 'success', 'Pin ownership validated');

      // Step 4: Check if user exists
      logStep('recipient-validation', 'success', 'Validating recipient user...');
      const { data: recipientUser, error: recipientError } = await this.supabase
        .from('auth.users')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (recipientError) {
        logStep('recipient-validation', 'warning', 'Could not validate recipient (this may be normal)', { error: recipientError.message });
      } else {
        logStep('recipient-validation', 'success', `Recipient validated: ${recipientUser.email}`);
      }

      // Step 5: Check for existing share
      logStep('duplicate-check', 'success', 'Checking for existing shares...');
      const { data: existingShare } = await this.supabase
        .from('pin_shares')
        .select('id, permission_level')
        .eq('pin_id', pinId)
        .eq('shared_with_user_id', userId)
        .single();

      if (existingShare) {
        logStep('duplicate-check', 'warning', 'Share already exists, updating permission', { existingShareId: existingShare.id });
        
        // Update existing share
        const { data: updatedShare, error: updateError } = await this.supabase
          .from('pin_shares')
          .update({ 
            permission_level: permissionLevel,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingShare.id)
          .select()
          .single();

        if (updateError) {
          logStep('share-update', 'error', 'Failed to update existing share', { error: updateError.message });
          return { success: false, error: updateError.message, steps };
        }

        logStep('share-update', 'success', `Share updated successfully (${permissionLevel} access)`, { shareId: updatedShare.id });
        return { success: true, shareId: updatedShare.id, steps };
      }

      logStep('duplicate-check', 'success', 'No existing share found, creating new one');

      // Step 6: Create new share
      logStep('share-creation', 'success', 'Creating new share in database...');
      const { data: newShare, error: createError } = await this.supabase
        .from('pin_shares')
        .insert({
          pin_id: pinId,
          shared_with_user_id: userId,
          shared_by_user_id: user.id,
          permission_level: permissionLevel,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        logStep('share-creation', 'error', 'Failed to create share', { error: createError.message });
        return { success: false, error: createError.message, steps };
      }

      logStep('share-creation', 'success', `Share created successfully (${permissionLevel} access)`, { 
        shareId: newShare.id,
        pinId,
        recipientId: userId,
        permission: permissionLevel
      });

      // Step 7: Verify the share was created correctly
      logStep('verification', 'success', 'Verifying share creation...');
      const { data: verifyShare, error: verifyError } = await this.supabase
        .from('pin_shares')
        .select('*')
        .eq('id', newShare.id)
        .single();

      if (verifyError || !verifyShare) {
        logStep('verification', 'warning', 'Could not verify share creation', { error: verifyError?.message });
      } else {
        logStep('verification', 'success', 'Share verified in database', { shareData: verifyShare });
      }

      return { success: true, shareId: newShare.id, steps };

    } catch (error) {
      logStep('unexpected-error', 'error', `Unexpected error: ${error}`, { error });
      return { success: false, error: `Unexpected error: ${error}`, steps };
    }
  }
}

export const enhancedSharingService = new EnhancedSharingService();
export default enhancedSharingService;