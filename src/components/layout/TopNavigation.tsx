'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, BarChart3, Settings, SunMoon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import UserMenu from '@/components/auth/UserMenu'
import { User } from '@supabase/supabase-js'

interface TopNavigationProps {
  user: User
}

export default function TopNavigation({ user }: TopNavigationProps) {
  const pathname = usePathname()

  return (
    <TooltipProvider>
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <div className="container flex h-full items-center justify-between px-4">
          {/* Left side - App title */}
          <div className="flex items-center">
            <Link href="/data-explorer" passHref>
              <h1 className="text-xl font-semibold text-foreground cursor-pointer hover:text-primary transition-colors">
                DataMap
              </h1>
            </Link>
          </div>

          {/* Center - Navigation icons */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/data-explorer" passHref>
                  <Button 
                    variant={pathname === '/data-explorer' ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-9 w-9"
                    aria-label="Data Explorer"
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Data Explorer</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/map-drawing" passHref>
                  <Button 
                    variant={pathname === '/map-drawing' ? "secondary" : "ghost"} 
                    size="icon" 
                    className="h-9 w-9"
                    aria-label="Map Mode"
                  >
                    <Map className="h-5 w-5" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Map Mode</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center">
            <UserMenu user={user} />
          </div>
        </div>
      </nav>
    </TooltipProvider>
  )
}
