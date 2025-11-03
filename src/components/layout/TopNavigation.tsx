'use client'

import { useEffect, useState, useCallback } from 'react'
import UserMenu from '@/components/auth/UserMenu'
import { User } from '@supabase/supabase-js'
import { PEBLLogoNav } from '@/components/branding/PEBLLogo'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogIn } from 'lucide-react'
import Link from 'next/link'

interface TopNavigationProps {
  user: User | null
}

// Navigation skeleton component for loading states
const NavigationSkeleton = () => (
  <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
    <div className="flex h-full items-center justify-between px-4 w-full">
      <div className="flex items-center">
        <PEBLLogoNav />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
      </div>
    </div>
  </nav>
)

// Error fallback navigation - still shows logo and login button
const NavigationError = () => (
  <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
    <div className="flex h-full items-center justify-between px-4 w-full">
      <div className="flex items-center">
        <PEBLLogoNav />
      </div>
      <div className="flex items-center gap-2">
        <Link href="/auth">
          <Button variant="default" size="sm" className="gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
        </Link>
      </div>
    </div>
  </nav>
)

export default function TopNavigation({ user: initialUser }: TopNavigationProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [isLoading, setIsLoading] = useState(!initialUser) // Start loading if no initial user
  const [isHydrated, setIsHydrated] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Safe supabase client creation with error handling
  const [supabase] = useState(() => {
    try {
      return createClient()
    } catch (error) {
      console.error('Failed to create Supabase client:', error)
      setAuthError('Authentication service unavailable')
      return null
    }
  })

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Robust auth state management
  const initializeAuth = useCallback(async () => {
    if (!supabase) return

    try {
      setIsLoading(true)
      setAuthError(null)
      
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting session:', error)
        setAuthError('Failed to get session')
        return
      }
      
      setUser(session?.user ?? null)
    } catch (error) {
      console.error('Unexpected error during auth initialization:', error)
      setAuthError('Authentication initialization failed')
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (!isHydrated || !supabase) return

    initializeAuth()

    // Listen for auth changes with robust error handling
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        console.log('Auth state changed:', event, session?.user?.email || 'no user')
        setUser(session?.user ?? null)
        setAuthError(null)
      } catch (error) {
        console.error('Error handling auth state change:', error)
        setAuthError('Auth state update failed')
      } finally {
        setIsLoading(false)
      }
    })

    return () => {
      try {
        subscription.unsubscribe()
      } catch (error) {
        console.error('Error unsubscribing from auth changes:', error)
      }
    }
  }, [isHydrated, supabase, initializeAuth])

  // Handle pre-hydration state
  if (!isHydrated) {
    return (
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <div className="flex h-full items-center justify-between px-4 w-full">
          <div className="flex items-center">
            <PEBLLogoNav />
          </div>
          <div className="flex items-center gap-2">
            {initialUser ? (
              <UserMenu user={initialUser} />
            ) : (
              <Link href="/auth">
                <Button variant="default" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>
    )
  }

  // Handle auth errors - still show navigation with logo
  if (authError) {
    return <NavigationError />
  }

  // Don't show loading skeleton if there's an auth error
  // as we already have a fallback for that

  // Main navigation render - this structure is ALWAYS rendered
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
      <div className="flex h-full items-center justify-between px-4 w-full">
        {/* Left side - PEBL Logo - ALWAYS visible regardless of any state */}
        <div className="flex items-center">
          <PEBLLogoNav />
        </div>

        {/* Right side - User menu with robust error handling */}
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu user={user} />
          ) : isLoading ? (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          ) : (
            <Link href="/auth">
              <Button variant="default" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
