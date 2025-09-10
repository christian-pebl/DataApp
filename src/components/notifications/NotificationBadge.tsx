'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { notificationService } from '@/lib/supabase/notification-service';
import { createClient } from '@/lib/supabase/client';

interface NotificationBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function NotificationBadge({ onClick, className = '' }: NotificationBadgeProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadUnreadCount();
      
      // Subscribe to real-time notifications
      const unsubscribe = notificationService.subscribeToNotifications(
        userId,
        () => {
          // When a new notification arrives, increment the count
          setUnreadCount(prev => prev + 1);
        }
      );

      return () => {
        unsubscribe();
      };
    }
  }, [userId]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadUnreadCount = async () => {
    if (userId) {
      const count = await notificationService.getUnreadCount(userId);
      setUnreadCount(count);
    }
  };

  // Expose a method to refresh the count
  useEffect(() => {
    if (window) {
      (window as any).refreshNotificationCount = loadUnreadCount;
    }
  }, [userId]);

  return (
    <button
      onClick={onClick}
      className={`relative p-2 hover:bg-muted rounded-lg transition-colors ${className}`}
      aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge 
          className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center"
          variant="destructive"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </button>
  );
}