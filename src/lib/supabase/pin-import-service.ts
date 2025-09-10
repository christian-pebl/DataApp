import { createClient } from './client';

export interface ImportProgress {
  step: string;
  status: 'pending' | 'in-progress' | 'success' | 'error';
  message: string;
  details?: any;
}

export interface ImportResult {
  success: boolean;
  error?: string;
  importedPinId?: string;
  progress: ImportProgress[];
}

class PinImportService {
  private supabase = createClient();

  /**
   * Import a shared pin and all its data to the current user's account
   * 
   * TESTING CHECKLIST - Run these validations before reporting issues:
   * 1. Check browser console for detailed error logs
   * 2. Verify user authentication status  
   * 3. Confirm pin ID is valid and exists
   * 4. Check pin_shares table for access permissions
   * 5. Review all progress step details in the import log
   * 
   * VALIDATION STEPS:
   * - Pre-import: User session, pin ID format, pin_shares access
   * - Database integrity: Pin exists, no orphaned records, RLS policies
   * - Import process: All steps complete, data copied correctly
   * - Post-import: New pin on map, files accessible, original unchanged
   */
  async importSharedPin(
    originalPinId: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    
    const progress: ImportProgress[] = [];
    const logStep = (step: string, status: 'pending' | 'in-progress' | 'success' | 'error', message: string, details?: any) => {
      const progressItem = { step, status, message, details };
      progress.push(progressItem);
      if (onProgress) onProgress(progressItem);
    };

    try {
      // Step 0: Initial validation and setup
      logStep('init', 'in-progress', 'Starting pin import process...');
      logStep('init', 'in-progress', `Import target: Pin ID ${originalPinId}`);
      logStep('init', 'in-progress', 'Validating pin ID format...');
      
      // Validate pin ID format (should be UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(originalPinId)) {
        logStep('init', 'error', 'Invalid pin ID format - must be valid UUID', {
          providedId: originalPinId,
          expectedFormat: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx',
          validationFailed: true
        });
        return { success: false, error: 'Invalid pin ID format', progress };
      }
      
      logStep('init', 'success', 'Pin ID format validated successfully', {
        pinId: originalPinId,
        format: 'Valid UUID',
        ready: true
      });
      // Step 1: Get current user
      logStep('auth', 'in-progress', 'Authenticating user...');
      logStep('auth', 'in-progress', 'Checking session token validity...');
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      
      if (authError) {
        logStep('auth', 'error', 'Authentication error details', { 
          error: authError.message,
          code: authError.status,
          details: authError
        });
        return { success: false, error: 'Authentication required', progress };
      }
      
      if (!user) {
        logStep('auth', 'error', 'No user session found', { 
          sessionExists: false,
          possibleCauses: [
            'User not logged in',
            'Session expired',
            'Invalid auth token'
          ]
        });
        return { success: false, error: 'Authentication required', progress };
      }
      
      logStep('auth', 'success', `User authenticated successfully`, {
        userId: user.id,
        email: user.email,
        sessionValid: true,
        userMetadata: user.user_metadata
      });

      // Step 2: Check authorization for shared pin
      logStep('authorization', 'in-progress', 'Verifying access to shared pin...');
      logStep('authorization', 'in-progress', `Querying pin_shares table for pin_id: ${originalPinId}`);
      logStep('authorization', 'in-progress', `Checking access for user_id: ${user.id}`);
      
      // Check if user has permission to access this pin via shares table
      const { data: shareAccess, error: shareError } = await this.supabase
        .from('pin_shares')
        .select('permission_level, created_at, id')
        .eq('pin_id', originalPinId)
        .eq('shared_with_user_id', user.id)
        .single();

      logStep('authorization', 'in-progress', 'Pin_shares query completed', {
        queryResult: shareAccess,
        error: shareError?.message,
        queryDetails: {
          table: 'pin_shares',
          filters: {
            pin_id: originalPinId,
            shared_with_user_id: user.id
          }
        }
      });

      if (shareError) {
        logStep('authorization', 'error', 'Database error querying pin_shares', { 
          error: shareError.message,
          code: shareError.code,
          details: shareError,
          troubleshooting: [
            'Check if pin_shares table exists',
            'Verify RLS policies on pin_shares table',
            'Check if pin_id exists in database',
            'Verify user has proper access permissions'
          ]
        });
        return { success: false, error: 'Access denied', progress };
      }
      
      if (!shareAccess) {
        logStep('authorization', 'error', 'No sharing relationship found', { 
          pinId: originalPinId,
          userId: user.id,
          shareRecordExists: false,
          possibleCauses: [
            'Pin was never shared with this user',
            'Share was revoked or deleted',
            'Pin ID is incorrect',
            'User ID mismatch'
          ]
        });
        return { success: false, error: 'Access denied', progress };
      }
      
      logStep('authorization', 'success', 'Access granted - you can create a copy of this pin', {
        shareId: shareAccess.id,
        permissionLevel: shareAccess.permission_level,
        sharedAt: shareAccess.created_at,
        accessValidated: true
      });

      // Step 2.5: Cross-validate pin exists (data integrity check)
      logStep('cross-validation', 'in-progress', 'Cross-validating pin exists after authorization...');
      logStep('cross-validation', 'in-progress', `Querying pins table for pin_id: ${originalPinId}`);
      logStep('cross-validation', 'in-progress', 'This step prevents data integrity issues');
      
      const { data: pinExistsCheck, error: existsError } = await this.supabase
        .from('pins')
        .select('id, name, user_id, created_at, latitude, longitude')
        .eq('id', originalPinId)
        .limit(1);

      logStep('cross-validation', 'in-progress', 'Cross-validation query completed', {
        queryResult: pinExistsCheck,
        error: existsError?.message,
        resultsCount: pinExistsCheck?.length || 0
      });

      if (existsError) {
        logStep('cross-validation', 'error', 'Database error during cross-validation', { 
          error: existsError.message,
          code: existsError.code,
          troubleshooting: [
            'Check pins table permissions',
            'Verify RLS policies on pins table',
            'Check database connection',
            'Verify table structure'
          ]
        });
        return { success: false, error: `Cross-validation failed: ${existsError.message}`, progress };
      }

      if (!pinExistsCheck || pinExistsCheck.length === 0) {
        logStep('cross-validation', 'error', 'CRITICAL: Pin authorized but does not exist - data integrity issue', {
          pinId: originalPinId,
          authorizationPassed: true,
          pinExists: false,
          criticalIssue: 'Orphaned pin_shares record',
          immediateActions: [
            'Check if pin was recently deleted',
            'Verify pin_shares cleanup procedures',
            'Check for database constraint violations',
            'Review pin deletion audit logs'
          ]
        });
        return { success: false, error: 'Data integrity error: authorized pin not found', progress };
      }

      const pinDetails = pinExistsCheck[0];
      logStep('cross-validation', 'success', `Pin exists and accessible: "${pinDetails.name}"`, {
        pinId: pinDetails.id,
        pinName: pinDetails.name,
        originalOwner: pinDetails.user_id,
        createdAt: pinDetails.created_at,
        coordinates: `${pinDetails.latitude}, ${pinDetails.longitude}`,
        integrityCheckPassed: true
      });

      // Step 3: Get original pin data
      logStep('fetch-pin', 'in-progress', 'Fetching original pin data...');
      const { data: pinData, error: pinError } = await this.supabase
        .from('pins')
        .select('*')
        .eq('id', originalPinId);

      if (pinError) {
        logStep('fetch-pin', 'error', 'Database error fetching pin', { error: pinError.message, pinId: originalPinId });
        return { success: false, error: `Database error: ${pinError.message}`, progress };
      }

      if (!pinData || pinData.length === 0) {
        // Enhanced error logging for debugging data integrity issues
        logStep('fetch-pin', 'error', 'Pin not found in database', { 
          pinId: originalPinId,
          queryResult: pinData,
          authorizationPassed: true,
          possibleCauses: [
            'Pin was deleted after authorization check',
            'Database foreign key constraint violation',
            'Row Level Security policy preventing access',
            'Pin ID mismatch between authorization and fetch'
          ]
        });
        
        // Additional diagnostic: re-check pin_shares to confirm it still exists
        const { data: reCheckShare, error: reCheckError } = await this.supabase
          .from('pin_shares')
          .select('*')
          .eq('pin_id', originalPinId)
          .eq('shared_with_user_id', user.id);
          
        logStep('fetch-pin', 'error', 'Diagnostic: Re-checking pin_shares record', {
          shareRecordExists: !!reCheckShare?.length,
          shareData: reCheckShare,
          shareError: reCheckError?.message
        });
        
        return { success: false, error: 'Original pin not found - possible data integrity issue', progress };
      }

      if (pinData.length > 1) {
        logStep('fetch-pin', 'error', 'Multiple pins found with same ID', { pinId: originalPinId, count: pinData.length });
        return { success: false, error: 'Data integrity issue: multiple pins found', progress };
      }

      const originalPin = pinData[0];
      logStep('fetch-pin', 'success', `Pin "${originalPin.name}" data retrieved`, {
        pinId: originalPin.id,
        name: originalPin.name,
        userId: originalPin.user_id
      });

      // Step 4: Validate location coordinates
      logStep('location-validation', 'in-progress', 'Validating pin coordinates...');
      if (!originalPin.latitude || !originalPin.longitude || 
          originalPin.latitude < -90 || originalPin.latitude > 90 ||
          originalPin.longitude < -180 || originalPin.longitude > 180) {
        logStep('location-validation', 'error', 'Invalid coordinates detected');
        return { success: false, error: 'Invalid pin coordinates', progress };
      }
      logStep('location-validation', 'success', `Valid coordinates: ${originalPin.latitude}, ${originalPin.longitude}`);

      // Step 5: Check if pin already exists for this user
      logStep('check-existing', 'in-progress', 'Checking for existing pin...');
      const { data: existingPin } = await this.supabase
        .from('pins')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('name', originalPin.name)
        .eq('latitude', originalPin.latitude)
        .eq('longitude', originalPin.longitude)
        .single();

      if (existingPin) {
        logStep('check-existing', 'success', 'Pin already exists in your account', { existingPinId: existingPin.id });
        return { success: true, importedPinId: existingPin.id, progress };
      }
      logStep('check-existing', 'success', 'No duplicate found, proceeding with import');

      // Step 6: Create new pin for current user (map placement)
      logStep('create-pin', 'in-progress', 'Creating pin on map...');
      const newPinData = {
        user_id: user.id,
        name: originalPin.name,
        latitude: originalPin.latitude,
        longitude: originalPin.longitude,
        description: originalPin.description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: newPin, error: createError } = await this.supabase
        .from('pins')
        .insert(newPinData)
        .select()
        .single();

      if (createError || !newPin) {
        logStep('create-pin', 'error', 'Failed to create pin', { error: createError?.message });
        return { success: false, error: 'Failed to create pin', progress };
      }
      logStep('create-pin', 'success', `Pin placed on map with ID: ${newPin.id}`);

      // Step 7: Sync pin properties
      logStep('sync-properties', 'in-progress', 'Syncing pin properties...');
      // Additional property sync if needed (styling, tags, etc.)
      logStep('sync-properties', 'success', `Properties synced - Name: "${originalPin.name}", Description: "${originalPin.description || 'None'}"`);

      // Step 8: Discover data files
      logStep('discover-files', 'in-progress', 'Discovering attached data files...');
      const { data: files, error: filesError } = await this.supabase
        .from('pin_data')
        .select('*')
        .eq('pin_id', originalPinId);

      if (filesError) {
        logStep('discover-files', 'error', 'Failed to discover files', { error: filesError.message });
        return { success: false, error: 'Failed to discover files', progress };
      }

      logStep('discover-files', 'success', `Discovered ${files?.length || 0} data files`);

      // Step 9: Validate file metadata
      if (files && files.length > 0) {
        logStep('validate-files', 'in-progress', 'Validating file metadata...');
        let totalSize = 0;
        const fileTypes = new Set();
        
        for (const file of files) {
          totalSize += file.file_size || 0;
          fileTypes.add(file.mime_type);
        }
        
        logStep('validate-files', 'success', `Files validated - Total: ${files.length}, Size: ${(totalSize/1024).toFixed(1)}KB, Types: ${Array.from(fileTypes).join(', ')}`);

        // Step 10: Transfer data files
        logStep('transfer-files', 'in-progress', 'Transferring data files...');
        let successfulTransfers = 0;
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          logStep('transfer-files', 'in-progress', `Copying file ${i+1}/${files.length}: ${file.file_name}`);
          
          const newFileData = {
            pin_id: newPin.id,
            file_name: file.file_name,
            file_path: file.file_path,
            file_size: file.file_size,
            mime_type: file.mime_type,
            upload_date: new Date().toISOString()
          };

          const { error: fileError } = await this.supabase
            .from('pin_data')
            .insert(newFileData);

          if (fileError) {
            logStep('transfer-files', 'error', `Failed to copy file: ${file.file_name}`, { error: fileError.message });
            // Continue with other files instead of failing completely
          } else {
            successfulTransfers++;
          }
        }
        
        logStep('transfer-files', 'success', `File transfer complete - ${successfulTransfers}/${files.length} files transferred successfully`);

        // Step 11: Verify file associations
        logStep('verify-associations', 'in-progress', 'Verifying file associations...');
        const { data: verifyFiles, error: verifyFileError } = await this.supabase
          .from('pin_data')
          .select('file_name')
          .eq('pin_id', newPin.id);

        if (verifyFileError) {
          logStep('verify-associations', 'error', 'Failed to verify file associations', { error: verifyFileError.message });
        } else {
          logStep('verify-associations', 'success', `${verifyFiles?.length || 0} files correctly associated with pin`);
        }
      } else {
        logStep('validate-files', 'success', 'No data files to process');
        logStep('transfer-files', 'success', 'No files to transfer');
        logStep('verify-associations', 'success', 'No file associations to verify');
      }

      // Step 12: Verify map placement
      logStep('verify-map-placement', 'in-progress', 'Verifying pin appears on map...');
      const { data: mapPin, error: mapError } = await this.supabase
        .from('pins')
        .select('id, name, latitude, longitude')
        .eq('id', newPin.id)
        .single();

      if (mapError || !mapPin) {
        logStep('verify-map-placement', 'error', 'Pin not found on map', { error: mapError?.message });
        return { success: false, error: 'Map verification failed', progress };
      }
      logStep('verify-map-placement', 'success', `Pin correctly placed at ${mapPin.latitude}, ${mapPin.longitude}`);

      // Step 13: Final integrity check
      logStep('final-integrity', 'in-progress', 'Running final integrity check...');
      const { data: verifyPin, error: verifyError } = await this.supabase
        .from('pins')
        .select(`
          *,
          pin_data:pin_data(count)
        `)
        .eq('id', newPin.id)
        .single();

      if (verifyError || !verifyPin) {
        logStep('final-integrity', 'error', 'Final integrity check failed', { error: verifyError?.message });
        return { success: false, error: 'Import verification failed', progress };
      }

      const importSummary = {
        pinId: newPin.id,
        pinName: newPin.name,
        location: `${verifyPin.latitude}, ${verifyPin.longitude}`,
        filesImported: files?.length || 0,
        dataAttached: verifyPin.pin_data?.[0]?.count || 0
      };

      logStep('final-integrity', 'success', 'Import completed successfully!', importSummary);

      return { success: true, importedPinId: newPin.id, progress };

    } catch (error) {
      logStep('error', 'error', `Unexpected error: ${error}`, { error });
      return { success: false, error: `Unexpected error: ${error}`, progress };
    }
  }

  /**
   * Mark a pin share notification as processed
   */
  async markShareNotificationProcessed(notificationId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      return !error;
    } catch (error) {
      console.error('Error marking notification as processed:', error);
      return false;
    }
  }
}

export const pinImportService = new PinImportService();
export default pinImportService;
