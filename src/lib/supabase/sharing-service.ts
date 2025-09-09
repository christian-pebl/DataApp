import { createClient } from './client';
import bcrypt from 'bcryptjs';

export interface SharePermission {
  level: 'view' | 'edit' | 'admin';
  description: string;
}

export const SHARE_PERMISSIONS: Record<string, SharePermission> = {
  view: {
    level: 'view',
    description: 'Can view pin and download files'
  },
  edit: {
    level: 'edit',
    description: 'Can view, edit pin details, and manage files'
  },
  admin: {
    level: 'admin',
    description: 'Full control including sharing and deletion'
  }
};

export interface PinShare {
  id: string;
  pinId: string;
  ownerId: string;
  sharedWithId: string;
  permission: 'view' | 'edit' | 'admin';
  sharedAt: Date;
  expiresAt?: Date;
  sharedWithEmail?: string;
}

export interface ShareToken {
  id: string;
  token: string;
  pinId?: string;
  projectId?: string;
  ownerId: string;
  permission: 'view' | 'edit';
  passwordHash?: string;
  maxUses?: number;
  usedCount: number;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
}

class SharingService {
  private supabase = createClient();

  /**
   * Share a pin with another user by email
   */
  async shareWithUser(
    pinId: string,
    email: string,
    permission: 'view' | 'edit' | 'admin',
    expiresInDays?: number
  ): Promise<PinShare | null> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required');
        return null;
      }

      // Find user by email
      const { data: profiles } = await this.supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (!profiles) {
        throw new Error('User not found. They need to sign up first.');
      }

      // Calculate expiration
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create share
      const { data, error } = await this.supabase
        .from('pin_shares')
        .insert({
          pin_id: pinId,
          owner_id: user.id,
          shared_with_id: profiles.id,
          permission,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      // Send notification email (implement email service)
      // await this.sendShareNotification(email, pinId, permission);

      return {
        id: data.id,
        pinId: data.pin_id,
        ownerId: data.owner_id,
        sharedWithId: data.shared_with_id,
        permission: data.permission,
        sharedAt: new Date(data.shared_at),
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        sharedWithEmail: email
      };
    } catch (error) {
      console.error('Share with user error:', error);
      return null;
    }
  }

  /**
   * Create a public shareable link
   */
  async createPublicLink(
    pinId: string,
    permission: 'view' | 'edit',
    options?: {
      password?: string;
      maxUses?: number;
      expiresInDays?: number;
    }
  ): Promise<ShareToken | null> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required');
        return null;
      }

      // Generate secure token
      const token = this.generateSecureToken();

      // Hash password if provided
      const passwordHash = options?.password
        ? await bcrypt.hash(options.password, 10)
        : null;

      // Calculate expiration
      const expiresAt = options?.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Create share token
      const { data, error } = await this.supabase
        .from('share_tokens')
        .insert({
          token,
          pin_id: pinId,
          owner_id: user.id,
          permission,
          password_hash: passwordHash,
          max_uses: options?.maxUses || null,
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        token: data.token,
        pinId: data.pin_id,
        ownerId: data.owner_id,
        permission: data.permission,
        passwordHash: data.password_hash,
        maxUses: data.max_uses,
        usedCount: data.used_count,
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined
      };
    } catch (error) {
      console.error('Create public link error:', error);
      return null;
    }
  }

  /**
   * Validate a share token
   */
  async validateToken(token: string, password?: string): Promise<{
    valid: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      // Get token details
      const { data: tokenData, error } = await this.supabase
        .from('share_tokens')
        .select(`
          *,
          pins!pin_id(*)
        `)
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (error || !tokenData) {
        return { valid: false, error: 'Invalid or expired token' };
      }

      // Check expiration
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        return { valid: false, error: 'Token has expired' };
      }

      // Check max uses
      if (tokenData.max_uses && tokenData.used_count >= tokenData.max_uses) {
        return { valid: false, error: 'Token has reached maximum uses' };
      }

      // Verify password if protected
      if (tokenData.password_hash) {
        if (!password) {
          return { valid: false, error: 'Password required' };
        }

        const passwordValid = await bcrypt.compare(password, tokenData.password_hash);
        if (!passwordValid) {
          return { valid: false, error: 'Invalid password' };
        }
      }

      // Update usage count
      await this.supabase
        .from('share_tokens')
        .update({
          used_count: tokenData.used_count + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', tokenData.id);

      // Log analytics
      await this.logShareAccess(tokenData.id, 'token', 'view');

      return {
        valid: true,
        data: {
          pin: tokenData.pins,
          permission: tokenData.permission,
          remainingUses: tokenData.max_uses
            ? tokenData.max_uses - tokenData.used_count - 1
            : null
        }
      };
    } catch (error) {
      console.error('Validate token error:', error);
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Get pins shared with the current user
   */
  async getSharedWithMe(): Promise<any[]> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required');
        return [];
      }

      const { data, error } = await this.supabase
        .from('pin_shares')
        .select(`
          *,
          pins!pin_id(*),
          profiles!owner_id(email)
        `)
        .eq('shared_with_id', user.id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      if (error) {
        console.error('Get shared pins error:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Get shared with me error:', error);
      return [];
    }
  }

  /**
   * Revoke a share
   */
  async revokeShare(shareId: string): Promise<boolean> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required');
        return false;
      }

      const { error } = await this.supabase
        .from('pin_shares')
        .delete()
        .eq('id', shareId)
        .eq('owner_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Revoke share error:', error);
      return false;
    }
  }

  /**
   * Revoke a public link
   */
  async revokePublicLink(tokenId: string): Promise<boolean> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) {
        console.error('Authentication required');
        return false;
      }

      const { error } = await this.supabase
        .from('share_tokens')
        .update({ is_active: false })
        .eq('id', tokenId)
        .eq('owner_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Revoke public link error:', error);
      return false;
    }
  }

  /**
   * Check if user has permission for a pin
   */
  async checkPermission(
    pinId: string,
    requiredPermission: 'view' | 'edit' | 'admin'
  ): Promise<boolean> {
    try {
      const { data: { user }, error: authError } = await this.supabase.auth.getUser();
      if (authError || !user) return false;

      // Check if user owns the pin
      const { data: pin } = await this.supabase
        .from('pins')
        .select('user_id')
        .eq('id', pinId)
        .single();

      if (pin?.user_id === user.id) return true;

      // Check if user has been granted permission
      const { data: share } = await this.supabase
        .from('pin_shares')
        .select('permission')
        .eq('pin_id', pinId)
        .eq('shared_with_id', user.id)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .single();

      if (!share) return false;

      // Check permission hierarchy
      const permissionHierarchy = ['view', 'edit', 'admin'];
      const userPermLevel = permissionHierarchy.indexOf(share.permission);
      const requiredLevel = permissionHierarchy.indexOf(requiredPermission);

      return userPermLevel >= requiredLevel;
    } catch (error) {
      console.error('Check permission error:', error);
      return false;
    }
  }

  /**
   * Generate a secure random token
   */
  private generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Log share access for analytics
   */
  private async logShareAccess(
    shareId: string,
    shareType: 'token' | 'direct',
    action: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('share_analytics')
        .insert({
          [shareType === 'token' ? 'share_token_id' : 'pin_share_id']: shareId,
          action,
          accessed_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Log share access error:', error);
    }
  }
}

export const sharingService = new SharingService();