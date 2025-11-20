import { createClient } from './client';

export interface UserValidationResult {
  exists: boolean;
  userId?: string;
  fullName?: string;
  email: string;
}

export interface InvitationData {
  pinId: string;
  inviteeEmail: string;
  permissionLevel: 'view' | 'edit';
  inviterId: string;
}

export interface InvitationResult {
  success: boolean;
  invitationId?: string;
  invitationToken?: string;
  error?: string;
}

/**
 * Check if a user exists by email address
 */
export async function checkUserExists(email: string): Promise<UserValidationResult> {
  const supabase = createClient();
  try {
    // First try the database function
    const { data, error } = await supabase
      .rpc('check_user_exists', { email_address: email })
      .single<{ user_exists: boolean; user_id?: string; full_name?: string }>();

    if (!error) {
      return {
        exists: data?.user_exists || false,
        userId: data?.user_id,
        fullName: data?.full_name,
        email,
      };
    }

    // If the function fails, fall back to a simple approach
    console.warn('RPC function failed, using fallback method:', error);
    
    // Try to get current user to test if we have access
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    
    if (!currentUser) {
      // Not authenticated, can't check other users
      return {
        exists: false,
        email,
      };
    }

    // For now, return false and suggest creating account
    // In a real app, you might have other ways to check users
    return {
      exists: false,
      email,
    };
  } catch (error) {
    console.error('Error in checkUserExists:', error);
    return {
      exists: false,
      email,
    };
  }
}

/**
 * Create an invitation for a non-existing user
 */
export async function createInvitation(data: InvitationData): Promise<InvitationResult> {
  const supabase = createClient();
  try {
    const { data: invitation, error } = await supabase
      .from('invitations')
      .insert({
        pin_id: data.pinId,
        inviter_id: data.inviterId,
        invitee_email: data.inviteeEmail,
        permission_level: data.permissionLevel,
      })
      .select('id, invitation_token')
      .single();

    if (error) {
      console.error('Error creating invitation:', error);
      
      // Check if it's a unique constraint violation
      if (error.code === '23505') {
        return {
          success: false,
          error: 'An invitation has already been sent to this email for this pin',
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to create invitation',
      };
    }

    return {
      success: true,
      invitationId: invitation.id,
      invitationToken: invitation.invitation_token,
    };
  } catch (error) {
    console.error('Error in createInvitation:', error);
    return {
      success: false,
      error: 'Failed to create invitation',
    };
  }
}

/**
 * Accept an invitation using the invitation token
 */
export async function acceptInvitation(token: string, userEmail: string): Promise<{
  success: boolean;
  shareId?: string;
  pinId?: string;
  error?: string;
}> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .rpc('accept_invitation', {
        token,
        user_email: userEmail,
      });

    if (error) {
      console.error('Error accepting invitation:', error);
      return {
        success: false,
        error: error.message || 'Failed to accept invitation',
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Failed to accept invitation',
      };
    }

    return {
      success: true,
      shareId: data.share_id,
      pinId: data.pin_id,
    };
  } catch (error) {
    console.error('Error in acceptInvitation:', error);
    return {
      success: false,
      error: 'Failed to accept invitation',
    };
  }
}

/**
 * Get pending invitations for a user
 */
export async function getPendingInvitations(email: string) {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        pins (
          id,
          name,
          description,
          latitude,
          longitude
        ),
        inviter:inviter_id (
          email,
          raw_user_meta_data
        )
      `)
      .eq('invitee_email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invitations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPendingInvitations:', error);
    return [];
  }
}

/**
 * Cancel an invitation
 */
export async function cancelInvitation(invitationId: string): Promise<boolean> {
  const supabase = createClient();
  try {
    const { error } = await supabase
      .from('invitations')
      .update({ status: 'cancelled' })
      .eq('id', invitationId);

    if (error) {
      console.error('Error cancelling invitation:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in cancelInvitation:', error);
    return false;
  }
}

/**
 * Get invitation details by token
 */
export async function getInvitationByToken(token: string) {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from('invitations')
      .select(`
        *,
        pins (
          id,
          name,
          description
        )
      `)
      .eq('invitation_token', token)
      .single();

    if (error) {
      console.error('Error fetching invitation:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getInvitationByToken:', error);
    return null;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate invitation link
 */
export function generateInvitationLink(token: string): string {
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  
  return `${baseUrl}/invite/${token}`;
}

/**
 * Send invitation email (placeholder - implement with your email service)
 */
export async function sendInvitationEmail(
  inviteeEmail: string,
  inviterName: string,
  pinName: string,
  invitationLink: string
): Promise<boolean> {
  try {
    // TODO: Implement email sending using your preferred service
    // Options: SendGrid, Resend, AWS SES, etc.
    
    console.log('Invitation email would be sent to:', inviteeEmail);
    console.log('Invitation link:', invitationLink);
    console.log('From:', inviterName);
    console.log('Pin:', pinName);
    
    // For now, just log the invitation details
    // In production, integrate with an email service
    
    return true;
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return false;
  }
}