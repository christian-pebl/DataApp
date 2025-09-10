import { createClient } from './client';

export interface SimplifiedShareResult {
  success: boolean;
  error?: string;
  shareId?: string;
}

export interface UserShare {
  id: string;
  pin_id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  permission_level: 'view' | 'edit';
  created_at: string;
  updated_at?: string;
  shared_with_user?: {
    email: string;
    display_name?: string;
  } | null;
}

export interface SharedPin {
  id: string;
  pin_id: string;
  pin_name: string;
  pin_description?: string;
  shared_by_email: string;
  shared_by_name?: string;
  permission_level: 'view' | 'edit';
  created_at: string;
}

class SimplifiedSharingService {
  private supabase = createClient();

  /**
   * Share a pin with an existing user (using user ID)
   */
  async shareWithUser(
    pinId: string,
    userId: string,
    permissionLevel: 'view' | 'edit'
  ): Promise<SimplifiedShareResult> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        return { success: false, error: 'Authentication required' };
      }

      // Check if already shared to prevent duplicates
      const { data: existingShare } = await this.supabase
        .from('pin_shares')
        .select('id')
        .eq('pin_id', pinId)
        .eq('shared_with_user_id', userId)
        .single();

      if (existingShare) {
        // Update existing share
        const { data, error } = await this.supabase
          .from('pin_shares')
          .update({
            permission_level: permissionLevel,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingShare.id)
          .select()
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, shareId: data.id };
      }

      // Create new share
      const { data, error } = await this.supabase
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

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, shareId: data.id };
    } catch (error) {
      console.error('Error in shareWithUser:', error);
      return { success: false, error: 'Failed to share pin' };
    }
  }

  /**
   * Get pins shared with the current user
   */
  async getSharedPins(): Promise<SharedPin[]> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required');
        return [];
      }

      // Get pins shared with this user
      const { data, error } = await this.supabase
        .from('pin_shares')
        .select(`
          id,
          pin_id,
          shared_by_user_id,
          permission_level,
          created_at,
          pins (
            id,
            name,
            description
          )
        `)
        .eq('shared_with_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shared pins:', error);
        return [];
      }

      // Fetch user profile information separately for each sharing user
      const sharedPinsWithUserInfo = await Promise.all(
        (data || []).map(async (share: any) => {
          try {
            const { data: userProfile } = await this.supabase
              .from('user_profiles')
              .select('email, display_name')
              .eq('id', share.shared_by_user_id)
              .single();

            return {
              id: share.id,
              pin_id: share.pin_id,
              pin_name: share.pins?.name || 'Unnamed Pin',
              pin_description: share.pins?.description,
              shared_by_email: userProfile?.email || 'Unknown',
              shared_by_name: userProfile?.display_name || 
                              userProfile?.email?.split('@')[0] || 
                              'Unknown User',
              permission_level: share.permission_level,
              created_at: share.created_at,
            };
          } catch (error) {
            console.error(`Error fetching user profile for ${share.shared_by_user_id}:`, error);
            return {
              id: share.id,
              pin_id: share.pin_id,
              pin_name: share.pins?.name || 'Unnamed Pin',
              pin_description: share.pins?.description,
              shared_by_email: 'Unknown',
              shared_by_name: 'Unknown User',
              permission_level: share.permission_level,
              created_at: share.created_at,
            };
          }
        })
      );

      return sharedPinsWithUserInfo;
    } catch (error) {
      console.error('Error in getSharedPins:', error);
      return [];
    }
  }

  /**
   * Get users who have access to a specific pin
   */
  async getPinShares(pinId: string): Promise<UserShare[]> {
    try {
      const { data, error } = await this.supabase
        .from('pin_shares')
        .select(`
          id,
          pin_id,
          shared_with_user_id,
          shared_by_user_id,
          permission_level,
          created_at,
          updated_at
        `)
        .eq('pin_id', pinId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pin shares:', error);
        return [];
      }

      // Fetch user profile information separately for each shared user
      const sharesWithUserInfo = await Promise.all(
        (data || []).map(async (share: any) => {
          try {
            const { data: userProfile } = await this.supabase
              .from('user_profiles')
              .select('email, display_name')
              .eq('id', share.shared_with_user_id)
              .single();

            return {
              ...share,
              shared_with_user: userProfile || null
            };
          } catch (error) {
            console.error(`Error fetching user profile for ${share.shared_with_user_id}:`, error);
            return {
              ...share,
              shared_with_user: null
            };
          }
        })
      );

      return sharesWithUserInfo;
    } catch (error) {
      console.error('Error in getPinShares:', error);
      return [];
    }
  }

  /**
   * Remove a share
   */
  async removeShare(shareId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('pin_shares')
        .delete()
        .eq('id', shareId);

      if (error) {
        console.error('Error removing share:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in removeShare:', error);
      return false;
    }
  }

  /**
   * Check if current user has access to a pin
   */
  async hasAccessToPin(pinId: string): Promise<{ hasAccess: boolean; permission?: 'view' | 'edit' }> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        return { hasAccess: false };
      }

      // Check if user owns the pin
      const { data: pin } = await this.supabase
        .from('pins')
        .select('user_id')
        .eq('id', pinId)
        .single();

      if (pin && pin.user_id === user.id) {
        return { hasAccess: true, permission: 'edit' }; // Owner has edit access
      }

      // Check if pin is shared with user
      const { data: share } = await this.supabase
        .from('pin_shares')
        .select('permission_level')
        .eq('pin_id', pinId)
        .eq('shared_with_user_id', user.id)
        .single();

      if (share) {
        return { hasAccess: true, permission: share.permission_level };
      }

      return { hasAccess: false };
    } catch (error) {
      console.error('Error checking pin access:', error);
      return { hasAccess: false };
    }
  }
}

// Export singleton instance
export const simplifiedSharingService = new SimplifiedSharingService();
export default simplifiedSharingService;