'use client';

import { useEffect, useState } from 'react';
import { notificationService } from '@/lib/supabase/notification-service';
import { createClient } from '@/lib/supabase/client';

interface NotificationIndicatorProps {
  className?: string;
}

export function NotificationIndicator({ className = '' }: NotificationIndicatorProps) {
  const [hasUnread, setHasUnread] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      checkUnreadNotifications();
      
      // Subscribe to real-time notifications
      const unsubscribe = notificationService.subscribeToNotifications(
        userId,
        () => {
          // When a new notification arrives, update the indicator
          setHasUnread(true);
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

  const checkUnreadNotifications = async () => {
    if (userId) {
      const count = await notificationService.getUnreadCount(userId);
      setHasUnread(count > 0);
    }
  };

  // Expose a method to refresh the indicator
  useEffect(() => {
    if (window) {
      (window as any).refreshNotificationIndicator = checkUnreadNotifications;
    }
  }, [userId]);

  if (!hasUnread) return null;

  return (
    <div 
      className={`absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white ${className}`}
      aria-label="New notifications"
    />
  );
}