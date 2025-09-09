import { createClient } from './client'
import { v4 as uuidv4 } from 'uuid'

export interface PinFile {
  id: string
  pinId: string
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  uploadedAt: Date
  projectId: string
}

class FileStorageService {
  private supabase = createClient()

  /**
   * Upload a file to Supabase Storage and save metadata to database
   */
  async uploadPinFile(
    pinId: string, 
    file: File, 
    projectId: string = 'default'
  ): Promise<PinFile | null> {
    try {
      // Get current user and verify authentication
      console.log('🔐 Checking authentication for file upload...');
      const { data: { user }, error: authError } = await this.supabase.auth.getUser()
      
      if (authError || !user) {
        console.error('❌ Authentication required to upload pin files:', authError)
        return null
      }
      console.log(`✅ Authenticated as user: ${user.id}`);

      // Verify that the user owns the pin they're trying to upload to
      console.log(`🔍 Verifying ownership of pin ${pinId}...`);
      const { data: pinData, error: pinError } = await this.supabase
        .from('pins')
        .select('id, user_id')
        .eq('id', pinId)
        .eq('user_id', user.id)
        .single()

      if (pinError || !pinData) {
        console.error('❌ Pin not found or user does not have upload access:', pinError)
        console.error('Pin ID:', pinId, 'User ID:', user.id);
        return null
      }
      console.log('✅ Pin ownership verified');

      // Generate unique file path
      const fileId = uuidv4()
      const fileExtension = file.name.split('.').pop()
      const filePath = `pins/${pinId}/${fileId}.${fileExtension}`

      // Upload file to Supabase Storage
      console.log(`📤 Uploading file to storage: ${filePath}`);
      const { error: uploadError } = await this.supabase.storage
        .from('pin-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('❌ File upload error:', uploadError)
        console.error('Bucket:', 'pin-files', 'Path:', filePath);
        return null
      }
      console.log('✅ File uploaded to storage successfully');

      // Save file metadata to database (using snake_case column names)
      const pinFileData = {
        pin_id: pinId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || 'text/csv',
        project_id: projectId
      }

      console.log('💾 Inserting pin file metadata to database:', pinFileData);

      const { data, error: dbError } = await this.supabase
        .from('pin_files')
        .insert(pinFileData)
        .select()
        .single()

      if (dbError) {
        console.error('❌ Database error:', dbError)
        console.error('Table: pin_files, Data:', pinFileData);
        // Clean up uploaded file if database save fails
        console.log('🧹 Cleaning up uploaded file due to database error...');
        await this.supabase.storage
          .from('pin-files')
          .remove([filePath])
        return null
      }

      console.log('✅ Database insert successful:', data);

      // Transform snake_case to camelCase for return
      return {
        id: data.id,
        pinId: data.pin_id,
        fileName: data.file_name,
        filePath: data.file_path,
        fileSize: data.file_size,
        fileType: data.file_type,
        projectId: data.project_id,
        uploadedAt: new Date(data.uploaded_at)
      } as PinFile

    } catch (error) {
      console.error('Upload file error:', error)
      return null
    }
  }

  /**
   * Get all files for a specific pin (with user authentication check)
   */
  async getPinFiles(pinId: string): Promise<PinFile[]> {
    try {
      // Get current user to ensure they have access to this pin
      console.log(`🔍 Getting files for pin ${pinId}...`);
      const { data: { user }, error: authError } = await this.supabase.auth.getUser()
      
      if (authError || !user) {
        console.error('❌ Authentication required to get pin files:', authError)
        return []
      }
      console.log(`✅ Authenticated as user: ${user.id}`);

      // First verify that the user owns the pin
      console.log(`🔐 Verifying pin ownership for retrieval...`);
      const { data: pinData, error: pinError } = await this.supabase
        .from('pins')
        .select('id, user_id')
        .eq('id', pinId)
        .eq('user_id', user.id)
        .single()

      if (pinError || !pinData) {
        console.error('❌ Pin not found or user does not have access:', pinError)
        console.error('Pin ID:', pinId, 'User ID:', user.id);
        return []
      }
      console.log('✅ Pin ownership verified for retrieval');

      // Now get the files - RLS policies will handle additional filtering
      console.log(`📂 Querying pin_files table for pin ${pinId}...`);
      const { data, error } = await this.supabase
        .from('pin_files')
        .select('*')
        .eq('pin_id', pinId)  // Use snake_case column name
        .order('uploaded_at', { ascending: false })  // Use snake_case column name

      if (error) {
        console.error('❌ Get pin files error:', error)
        console.error('Query: pin_id =', pinId);
        return []
      }
      
      console.log(`✅ Found ${data?.length || 0} file(s) in database for pin ${pinId}`);
      if (data && data.length > 0) {
        data.forEach((file: any) => {
          console.log(`  - ${file.file_name} (${file.file_path})`);
        });
      }

      // Transform snake_case to camelCase for return
      return (data || []).map(item => ({
        id: item.id,
        pinId: item.pin_id,
        fileName: item.file_name,
        filePath: item.file_path,
        fileSize: item.file_size,
        fileType: item.file_type,
        projectId: item.project_id,
        uploadedAt: new Date(item.uploaded_at)
      }))
    } catch (error) {
      console.error('Get pin files error:', error)
      return []
    }
  }

  /**
   * Download a file from Supabase Storage
   */
  async downloadFile(filePath: string): Promise<Blob | null> {
    try {
      const { data, error } = await this.supabase.storage
        .from('pin-files')
        .download(filePath)

      if (error) {
        console.error('Download file error:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Download file error:', error)
      return null
    }
  }

  /**
   * Delete a file from storage and database (with user authentication check)
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      // Get current user to ensure they have access
      const { data: { user }, error: authError } = await this.supabase.auth.getUser()
      
      if (authError || !user) {
        console.error('Authentication required to delete pin files:', authError)
        return false
      }

      // Get file metadata and verify user ownership through pin ownership
      const { data: fileData, error: getError } = await this.supabase
        .from('pin_files')
        .select(`
          file_path,
          pin_id,
          pins!inner(user_id)
        `)
        .eq('id', fileId)
        .single()

      if (getError || !fileData) {
        console.error('Get file data error:', getError)
        return false
      }

      // Check if user owns the pin associated with this file
      if (fileData.pins.user_id !== user.id) {
        console.error('User does not have permission to delete this file')
        return false
      }

      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from('pin-files')
        .remove([fileData.file_path])

      if (storageError) {
        console.error('Storage delete error:', storageError)
        return false
      }

      // Delete from database - RLS policies will handle additional filtering
      const { error: dbError } = await this.supabase
        .from('pin_files')
        .delete()
        .eq('id', fileId)

      if (dbError) {
        console.error('Database delete error:', dbError)
        return false
      }

      return true
    } catch (error) {
      console.error('Delete file error:', error)
      return false
    }
  }

  /**
   * Get all files for a project
   */
  async getProjectFiles(projectId: string): Promise<PinFile[]> {
    try {
      const { data, error } = await this.supabase
        .from('pin_files')
        .select('*')
        .eq('projectId', projectId)
        .order('uploadedAt', { ascending: false })

      if (error) {
        console.error('Get project files error:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Get project files error:', error)
      return []
    }
  }

  /**
   * Create a public URL for a file (for viewing/analysis)
   */
  getPublicUrl(filePath: string): string | null {
    try {
      const { data } = this.supabase.storage
        .from('pin-files')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('Get public URL error:', error)
      return null
    }
  }
}

export const fileStorageService = new FileStorageService()