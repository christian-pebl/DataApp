'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { NotificationBadge } from './NotificationBadge';
import { notificationService, type Notification } from '@/lib/supabase/notification-service';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Loader2,
  Share2,
  UserCheck,
  FileUp,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [supabase] = useState(() => createClient());
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId && isOpen) {
      loadNotifications();
    }
  }, [userId, isOpen]);

  useEffect(() => {
    if (userId) {
      // Subscribe to real-time notifications
      const unsubscribe = notificationService.subscribeToNotifications(
        userId,
        (notification) => {
          // Add new notification to the top of the list
          setNotifications(prev => [notification, ...prev]);
          
          // Show toast for new notification
          toast.info(notification.title, {
            description: notification.message,
            action: notification.action_url ? {
              label: 'View',
              onClick: () => handleNotificationClick(notification)
            } : undefined
          });
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

  const loadNotifications = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const data = await notificationService.getNotifications(userId, 20);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read && userId) {
      await notificationService.markSingleAsRead(notification.id, userId);
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      
      // Refresh badge count
      if ((window as any).refreshNotificationCount) {
        (window as any).refreshNotificationCount();
      }
    }

    // Navigate if there's an action URL
    if (notification.action_url) {
      setIsOpen(false);
      router.push(notification.action_url);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    
    const success = await notificationService.markAllAsRead(userId);
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
      
      // Refresh badge count
      if ((window as any).refreshNotificationCount) {
        (window as any).refreshNotificationCount();
      }
    }
  };

  const handleDeleteNotification = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    
    if (!userId) return;
    
    const success = await notificationService.deleteNotification(notificationId, userId);
    if (success) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast.success('Notification deleted');
      
      // Refresh badge count if it was unread
      const notification = notifications.find(n => n.id === notificationId);
      if (notification && !notification.is_read) {
        if ((window as any).refreshNotificationCount) {
          (window as any).refreshNotificationCount();
        }
      }
    }
  };

  const getNotificationIcon = (type: Notification['notification_type']) => {
    switch (type) {
      case 'pin_shared':
        return <Share2 className="h-4 w-4" />;
      case 'invitation_accepted':
        return <UserCheck className="h-4 w-4" />;
      case 'file_uploaded':
        return <FileUp className="h-4 w-4" />;
      case 'pin_updated':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <div>
          <NotificationBadge />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between p-3 pb-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-auto p-1 text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground">
                You'll see new notifications here
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 ${
                    !notification.is_read ? 'bg-muted/20' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-3 w-full">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.notification_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { 
                              addSuffix: true 
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notification.is_read && (
                            <div className="h-2 w-2 bg-primary rounded-full" />
                          )}
                          {notification.action_url && (
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => handleDeleteNotification(e, notification.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {notifications.length > 20 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-sm text-muted-foreground">
              Showing recent 20 notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}