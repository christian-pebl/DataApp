import { createClient } from './client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: 'pin_shared' | 'invitation_accepted' | 'file_uploaded' | 'pin_updated';
  action_url?: string;
  is_read: boolean;
  metadata?: any;
  created_at: string;
  updated_at?: string;
}

export interface NotificationCreateData {
  userId: string;
  title: string;
  message: string;
  type: Notification['notification_type'];
  actionUrl?: string;
  metadata?: any;
}

class NotificationService {
  private subscription: RealtimeChannel | null = null;
  private listeners: Set<(notification: Notification) => void> = new Set();
  private supabase = createClient();

  /**
   * Create a new notification
   */
  async createNotification(data: NotificationCreateData): Promise<Notification | null> {
    try {
      const { data: notification, error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: data.userId,
          title: data.title,
          message: data.message,
          notification_type: data.type,
          action_url: data.actionUrl,
          metadata: data.metadata,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        return null;
      }

      return notification;
    } catch (error) {
      console.error('Error in createNotification:', error);
      return null;
    }
  }

  /**
   * Get all notifications for a user
   */
  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getNotifications:', error);
      return [];
    }
  }

  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    try {
      const { data, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching unread notifications:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUnreadNotifications:', error);
      return [];
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_unread_notification_count', { user_uuid: userId });

      if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(notificationIds: string[], userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('mark_notifications_read', {
          notification_ids: notificationIds,
          user_uuid: userId,
        });

      if (error) {
        console.error('Error marking notifications as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAsRead:', error);
      return false;
    }
  }

  /**
   * Mark a single notification as read
   */
  async markSingleAsRead(notificationId: string, userId: string): Promise<boolean> {
    return this.markAsRead([notificationId], userId);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ is_read: true, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAllAsRead:', error);
      return false;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteNotification:', error);
      return false;
    }
  }

  /**
   * Subscribe to real-time notifications for a user
   */
  subscribeToNotifications(
    userId: string,
    onNotification: (notification: Notification) => void
  ): () => void {
    // Add listener
    this.listeners.add(onNotification);

    // If already subscribed, just return the unsubscribe function
    if (this.subscription) {
      return () => {
        this.listeners.delete(onNotification);
        if (this.listeners.size === 0) {
          this.unsubscribe();
        }
      };
    }

    // Create new subscription
    this.subscription = this.supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as Notification;
          // Notify all listeners
          this.listeners.forEach((listener) => listener(notification));
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      this.listeners.delete(onNotification);
      if (this.listeners.size === 0) {
        this.unsubscribe();
      }
    };
  }

  /**
   * Unsubscribe from real-time notifications
   */
  private unsubscribe() {
    if (this.subscription) {
      this.supabase.removeChannel(this.subscription);
      this.subscription = null;
    }
  }

  /**
   * Create a share notification
   */
  async createShareNotification(
    recipientId: string,
    pinId: string,
    pinName: string,
    sharerName: string,
    permissionLevel: 'copy'
  ): Promise<Notification | null> {
    return this.createNotification({
      userId: recipientId,
      title: 'Pin Shared for Copy',
      message: `${sharerName} shared "${pinName}" with you - you can create your own copy`,
      type: 'pin_shared',
      actionUrl: `/map-drawing?pin=${pinId}`,
      metadata: {
        pin_id: pinId,
        pin_name: pinName,
        permission_level: permissionLevel,
        import_status: 'pending',
        import_progress: []
      },
    });
  }

  /**
   * Update notification with import progress
   */
  async updateImportProgress(
    notificationId: string,
    progress: any[],
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          metadata: {
            import_status: status,
            import_progress: progress,
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error updating import progress:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateImportProgress:', error);
      return false;
    }
  }

  /**
   * Create an invitation accepted notification
   */
  async createInvitationAcceptedNotification(
    inviterId: string,
    inviteeEmail: string,
    pinId: string
  ): Promise<Notification | null> {
    return this.createNotification({
      userId: inviterId,
      title: 'Invitation Accepted',
      message: `${inviteeEmail} accepted your invitation to collaborate`,
      type: 'invitation_accepted',
      actionUrl: `/map-drawing?pin=${pinId}`,
      metadata: {
        invitee_email: inviteeEmail,
        pin_id: pinId,
      },
    });
  }

  /**
   * Clear old notifications (older than 30 days)
   */
  async clearOldNotifications(userId: string): Promise<boolean> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', thirtyDaysAgo.toISOString());

      if (error) {
        console.error('Error clearing old notifications:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in clearOldNotifications:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();

// Also export the class for testing or custom instances
export { NotificationService };