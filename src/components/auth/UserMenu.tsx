'use client';

import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { SunMoon, Settings, LogOut, Ruler, Map, BarChart3, Loader2, Save, Bell, Download, CheckCircle, ChevronDown, ChevronUp, Clock, AlertCircle, History } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useSettings } from '@/hooks/use-settings'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { dataSyncService } from '@/lib/supabase/data-sync-service'
import { useToast } from '@/hooks/use-toast'
import { NotificationIndicator } from '@/components/notifications/NotificationIndicator'
import pinImportService, { ImportProgress } from "@/lib/supabase/pin-import-service";
import { notificationService, type Notification } from '@/lib/supabase/notification-service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface UserMenuProps {
  user: User
}

// Notification section component
function NotificationSection({ 
  showArchiveDialog, 
  setShowArchiveDialog, 
  historyNotifications, 
  setHistoryNotifications, 
  getStatusIcon, 
  centerOnPin 
}: { 
  showArchiveDialog: boolean, 
  setShowArchiveDialog: (show: boolean) => void,
  historyNotifications: Notification[],
  setHistoryNotifications: (notifications: Notification[]) => void,
  getStatusIcon: (status: string) => JSX.Element,
  centerOnPin: (notification: Notification) => Promise<void>
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [importingPins, setImportingPins] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState<{[key: string]: string}>({});
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadNotifications();
    }
  }, [userId]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const importPin = async (notification: Notification) => {
    if (!notification.metadata?.pin_id) {
      toast({ title: "Error", description: "Pin ID not found in notification", variant: "destructive" });
      return;
    }

    const pinId = notification.metadata.pin_id;
    setImportingPins(prev => new Set([...prev, pinId]));
    setImportProgress(prev => ({ ...prev, [pinId]: "Starting import..." }));

    // Store all progress steps for the notification
    let allProgressSteps: any[] = [];

    try {
      // Update notification to in_progress status
      await notificationService.updateImportProgress(notification.id, [], 'in_progress');
      
      const result = await pinImportService.importSharedPin(
        pinId,
        (progress) => {
          // Store progress step
          allProgressSteps.push({
            ...progress,
            timestamp: new Date().toISOString()
          });
          
          // Update UI with latest step
          setImportProgress(prev => ({
            ...prev,
            [pinId]: `${progress.step}: ${progress.message}`
          }));

          // Update notification with current progress
          notificationService.updateImportProgress(
            notification.id, 
            allProgressSteps, 
            progress.status === 'error' ? 'failed' : 'in_progress'
          );
        }
      );

      if (result.success) {
        // Update notification with final success status
        await notificationService.updateImportProgress(notification.id, result.progress, 'completed');
        
        toast({
          title: "Pin Imported Successfully!",
          description: `Pin "${notification.metadata.pin_name}" has been added to your account.`
        });

        // Mark notification as read
        await pinImportService.markShareNotificationProcessed(notification.id);
        
        // Update local state to show completed import with progress log
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { 
            ...n, 
            is_read: true,
            metadata: {
              ...n.metadata,
              import_status: 'completed',
              import_progress: result.progress
            }
          } : n)
        );
      } else {
        // Update notification with failure status
        await notificationService.updateImportProgress(notification.id, result.progress, 'failed');
        
        toast({
          title: "Import Failed",
          description: result.error || "Failed to import pin",
          variant: "destructive"
        });

        // Update local state to show failed import with progress log  
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? {
            ...n,
            metadata: {
              ...n.metadata,
              import_status: 'failed',
              import_progress: result.progress
            }
          } : n)
        );
      }
    } catch (error) {
      // Update notification with error status
      await notificationService.updateImportProgress(notification.id, allProgressSteps, 'failed');
      
      toast({
        title: "Import Error",
        description: `Error importing pin: ${error}`,
        variant: "destructive"
      });
      
      // Update local state to show error
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? {
          ...n,
          metadata: {
            ...n.metadata,
            import_status: 'failed',
            import_progress: allProgressSteps
          }
        } : n)
      );
    } finally {
      setImportingPins(prev => {
        const newSet = new Set(prev);
        newSet.delete(pinId);
        return newSet;
      });
      setImportProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[pinId];
        return newProgress;
      });
    }
  };

  const loadNotifications = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      console.log('🔔 Loading notifications for user:', userId);
      // Get all recent notifications
      const allNotifs = await notificationService.getNotifications(userId, 20);
      console.log('🔔 Loaded notifications:', allNotifs.length, allNotifs);
      
      // Separate unread (active) and read (history) notifications
      const unreadNotifs = allNotifs.filter(n => !n.is_read);
      const readNotifs = allNotifs.filter(n => n.is_read);
      
      console.log('🔔 Unread notifications:', unreadNotifs.length);
      console.log('🔔 Read notifications:', readNotifs.length);
      
      setNotifications(unreadNotifs);
      setHistoryNotifications(readNotifs);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!userId) return;
    
    try {
      await notificationService.markSingleAsRead(notificationId, userId);
      
      // Find the notification and move it from active to history
      const notificationToMove = notifications.find(n => n.id === notificationId);
      if (notificationToMove) {
        const readNotification = { ...notificationToMove, is_read: true };
        
        // Remove from active notifications
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        
        // Add to history notifications at the beginning
        setHistoryNotifications(prev => [readNotification, ...prev]);
        
        // Show confirmation toast
        toast({
          title: "Notification archived",
          description: "Notification moved to archive",
        });
      }
      
      // Refresh the indicator
      if (window && (window as any).refreshNotificationIndicator) {
        (window as any).refreshNotificationIndicator();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to archive notification",
        variant: "destructive"
      });
    }
  };

  const toggleProgressLog = (notificationId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'error': return <AlertCircle className="h-3 w-3 text-red-600" />;
      case 'in-progress': return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />;
      default: return <Clock className="h-3 w-3 text-gray-600" />;
    }
  };

  console.log('🔔 NotificationSection render - loading:', loading, 'notifications:', notifications.length, 'historyNotifications:', historyNotifications.length, 'userId:', userId);

  if (loading) {
    return (
      <div className="px-2 py-1.5">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span>Loading notifications...</span>
        </div>
      </div>
    );
  }

  if (notifications.length === 0 && historyNotifications.length === 0) {
    console.log('🔔 Showing "No notifications" - both arrays empty');
    return (
      <div className="px-2 py-1.5">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Bell className="h-4 w-4" />
          <span>No notifications</span>
        </div>
      </div>
    );
  }

  // Show recent notifications (both unread and recently read)
  const recentNotifications = [...notifications, ...historyNotifications].slice(0, 5);
  
  if (recentNotifications.length > 0) {
    console.log('🔔 Showing recent notifications - total recent:', recentNotifications.length);
    return (
      <div className="px-2 py-1.5">
        <div className="flex items-center justify-between text-sm font-medium mb-2">
          <div className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>{notifications.length > 0 ? 'Notifications' : 'Recent Notifications'}</span>
          </div>
          {historyNotifications.length > 0 && (
            <button
              onClick={() => setShowArchiveDialog(true)}
              className="flex items-center space-x-1 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title={`View ${historyNotifications.length} archived notifications`}
            >
              <History className="h-3 w-3" />
              <span>Archive ({historyNotifications.length})</span>
            </button>
          )}
        </div>
        <div className="space-y-2">
          {recentNotifications.map((notification) => {
            const importStatus = notification.metadata?.import_status;
            const importProgressLog = notification.metadata?.import_progress || [];
            const isExpanded = expandedLogs.has(notification.id);
            const pinId = notification.metadata?.pin_id;
            const isCurrentlyImporting = importingPins.has(pinId);
            const currentProgress = importProgress[pinId];

            return (
              <div
                key={notification.id}
                className={`p-2 rounded-md text-xs border ${
                  notification.is_read 
                    ? 'bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700' 
                    : 'bg-blue-50 dark:bg-blue-900/20 text-foreground border-blue-200 dark:border-blue-800'
                }`}
              >
                {/* Main notification content */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{notification.title}</span>
                      {importStatus && getStatusIcon(importStatus)}
                    </div>
                    <div className="mt-1 text-gray-600 dark:text-gray-400">
                      {notification.message}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 mt-2">
                  {notification.notification_type === 'pin_shared' && (
                    <button
                      onClick={() => centerOnPin(notification)}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                    >
                      Center on pin
                    </button>
                  )}
                  
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 text-xs underline"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {recentNotifications.length >= 5 && historyNotifications.length > (5 - notifications.length) && (
            <div className="text-xs text-center text-gray-500 mt-2">
              {historyNotifications.length - (5 - notifications.length)} more in archive...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Bell className="h-4 w-4" />
        <span>No notifications found</span>
      </div>
    </div>
  );
}


export default function UserMenu({ user }: UserMenuProps) {
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const { settings, setSettings } = useSettings()
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'backing-up' | 'logging-out' | ''>('')
  const [syncDetails, setSyncDetails] = useState<any>(null)
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const [historyNotifications, setHistoryNotifications] = useState<Notification[]>([])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress': return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const centerOnPin = async (notification: Notification) => {
    if (!notification.metadata?.pin_id) {
      toast({ title: "Error", description: "Pin ID not found in notification", variant: "destructive" });
      return;
    }

    const pinId = notification.metadata.pin_id;
    const pinName = notification.metadata.pin_name || "pin";
    
    // Navigate to map-drawing page with pin centering parameters
    const url = `/map-drawing?centerPin=${pinId}&notification=${notification.id}`;
    window.location.href = url;
    
    // Show immediate feedback
    toast({
      title: "Navigating to Map",
      description: `Centering on ${pinName}...`,
    });
  };

  // Theme management
  useEffect(() => {
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem("theme") : null
    if (storedTheme) setTheme(storedTheme as 'light' | 'dark')
    else if (typeof window !== 'undefined' && window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark")
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (theme === "dark") document.documentElement.classList.add("dark")
      else document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", theme)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === "light" ? "dark" : "light"))
  }

  const toggleUnits = () => {
    if (settings) {
      setSettings({
        ...settings,
        units: settings.units === 'metric' ? 'imperial' : 'metric'
      })
    }
  }

  const handleSignOut = async () => {
    setShowSyncDialog(true)
    setIsSyncing(true)
    setSyncStatus('backing-up')
    setSyncDetails(null)

    try {
      // Step 1: Backup all data
      console.log('Starting data backup before logout...')
      const backupResult = await dataSyncService.backupUserData()
      
      setSyncDetails(backupResult.details)
      
      if (!backupResult.success) {
        // Show warning but allow logout
        toast({
          variant: "destructive",
          title: "Backup Warning",
          description: backupResult.message,
        })
      } else {
        toast({
          title: "Data Backed Up",
          description: `Saved ${backupResult.details?.pins || 0} pins, ${backupResult.details?.lines || 0} lines, ${backupResult.details?.areas || 0} areas`,
        })
      }

      // Step 2: Sign out
      setSyncStatus('logging-out')
      await supabase.auth.signOut()
      
      // Step 3: Clear local data after successful backup
      if (typeof window !== 'undefined') {
        localStorage.removeItem('map-drawing-pins')
        localStorage.removeItem('map-drawing-lines')
        localStorage.removeItem('map-drawing-areas')
        localStorage.removeItem('map-drawing-projects')
        localStorage.removeItem('map-drawing-tags')
      }

      // Step 4: Redirect
      setTimeout(() => {
        router.push('/auth')
        router.refresh()
      }, 1000)
      
    } catch (error) {
      console.error('Error during sign out:', error)
      toast({
        variant: "destructive",
        title: "Sign Out Error",
        description: "There was an error signing out. Please try again.",
      })
      setIsSyncing(false)
      setShowSyncDialog(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.user_metadata.avatar_url} alt={user.email} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <NotificationIndicator />
          </Button>
        </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 z-[10000] user-dropdown-menu" align="end" forceMount>
        {/* User Info */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.user_metadata.full_name || 'User'}
            </p>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Notifications Section */}
        <NotificationSection 
          showArchiveDialog={showArchiveDialog} 
          setShowArchiveDialog={setShowArchiveDialog}
          historyNotifications={historyNotifications}
          setHistoryNotifications={setHistoryNotifications}
          getStatusIcon={getStatusIcon}
          centerOnPin={centerOnPin}
        />
        
        <DropdownMenuSeparator />
        
        {/* Theme Toggle */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center space-x-2">
            <SunMoon className="h-4 w-4" />
            <Label htmlFor="theme-toggle" className="text-sm">Dark Mode</Label>
          </div>
          <Switch
            id="theme-toggle"
            checked={theme === 'dark'}
            onCheckedChange={toggleTheme}
          />
        </div>
        
        {/* Units Toggle */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center space-x-2">
            <Ruler className="h-4 w-4" />
            <Label htmlFor="units-toggle" className="text-sm">Imperial Units</Label>
          </div>
          <Switch
            id="units-toggle"
            checked={settings?.units === 'imperial'}
            onCheckedChange={toggleUnits}
            disabled={!settings}
          />
        </div>
        
        <DropdownMenuSeparator />
        
        {/* Navigation Items */}
        <Link href="/data-explorer">
          <DropdownMenuItem className="cursor-pointer">
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Data Explorer</span>
            {pathname === '/data-explorer' && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
          </DropdownMenuItem>
        </Link>
        
        <Link href="/map-drawing">
          <DropdownMenuItem className="cursor-pointer">
            <Map className="mr-2 h-4 w-4" />
            <span>Map Drawing</span>
            {pathname === '/map-drawing' && <div className="ml-auto w-2 h-2 bg-primary rounded-full" />}
          </DropdownMenuItem>
        </Link>
        
        <DropdownMenuSeparator />
        
        {/* Settings */}
        <DropdownMenuItem className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Sign Out */}
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Sync Dialog */}
    <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {syncStatus === 'backing-up' && (
              <>
                <Save className="h-5 w-5 animate-pulse" />
                Backing Up Your Data
              </>
            )}
            {syncStatus === 'logging-out' && (
              <>
                <LogOut className="h-5 w-5" />
                Signing Out
              </>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Data synchronization dialog
          </DialogDescription>
        </DialogHeader>
        {syncStatus === 'backing-up' && (
          <div className="space-y-3 mt-4">
            <p>Saving all your pins, lines, and areas to the cloud...</p>
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            {syncDetails && (
              <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
                <p>✓ Pins backed up: {syncDetails.pins || 0}</p>
                <p>✓ Lines backed up: {syncDetails.lines || 0}</p>
                <p>✓ Areas backed up: {syncDetails.areas || 0}</p>
                {syncDetails.errors && syncDetails.errors.length > 0 && (
                  <p className="text-destructive">⚠ Errors: {syncDetails.errors.length}</p>
                )}
              </div>
            )}
          </div>
        )}
        {syncStatus === 'logging-out' && (
          <div className="space-y-3 mt-4">
            <p>Your data has been saved. Signing you out...</p>
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Notification Archive Dialog */}
    <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Notification Archive
          </DialogTitle>
          <DialogDescription>
            View your archived notifications
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2">
          {historyNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No archived notifications</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyNotifications.map((notification) => {
                const importStatus = notification.metadata?.import_status;
                
                return (
                  <div
                    key={notification.id}
                    className="p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/50 text-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {notification.title}
                          </span>
                          {importStatus && getStatusIcon(importStatus)}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 text-xs">
                          {notification.message}
                        </p>
                        <p className="text-gray-500 dark:text-gray-500 text-xs mt-2">
                          Archived: {new Date(notification.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Action buttons for archived notifications */}
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {notification.notification_type === 'pin_shared' && (
                        <button
                          onClick={() => {
                            setShowArchiveDialog(false);
                            centerOnPin(notification);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                        >
                          Center on pin
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="border-t pt-4 flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {historyNotifications.length} archived notification{historyNotifications.length !== 1 ? 's' : ''}
          </span>
          <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}