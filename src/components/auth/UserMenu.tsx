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
import { SunMoon, Settings, LogOut, Ruler, Map, BarChart3, Loader2, Save } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useSettings } from '@/hooks/use-settings'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { dataSyncService } from '@/lib/supabase/data-sync-service'
import { useToast } from '@/hooks/use-toast'
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
    </>
  )
}