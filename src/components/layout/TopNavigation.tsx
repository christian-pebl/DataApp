'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, BarChart3, Settings, SunMoon, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import UserMenu from '@/components/auth/UserMenu'
import { User } from '@supabase/supabase-js'
import { useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { PEBLLogoNav } from '@/components/branding/PEBLLogo'

interface TopNavigationProps {
  user: User
}

const NavigationItems = ({ pathname, onItemClick }: { pathname: string; onItemClick?: () => void }) => (
  <>
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href="/data-explorer" passHref>
          <Button 
            variant={pathname === '/data-explorer' ? "secondary" : "ghost"} 
            size="icon" 
            className="h-9 w-9"
            aria-label="Data Explorer"
            onClick={onItemClick}
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
            onClick={onItemClick}
          >
            <Map className="h-5 w-5" />
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>Map Mode</p>
      </TooltipContent>
    </Tooltip>
  </>
)

export default function TopNavigation({ user }: TopNavigationProps) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)

  const closeSheet = () => setIsOpen(false)

  return (
    <TooltipProvider>
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
        <div className="flex h-full items-center justify-between px-4 w-full">
          {/* Left side - PEBL Logo */}
          <div className="flex items-center">
            <PEBLLogoNav />
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              <NavigationItems pathname={pathname} />
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Mobile Navigation */}
            {isMobile && (
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <SheetHeader>
                    <SheetTitle className="text-lg font-futura font-semibold">Navigation</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col space-y-2 pt-4">
                      <Link href="/data-explorer" passHref>
                        <Button 
                          variant={pathname === '/data-explorer' ? "secondary" : "ghost"} 
                          className="w-full justify-start"
                          onClick={closeSheet}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Data Explorer
                        </Button>
                      </Link>
                      <Link href="/map-drawing" passHref>
                        <Button 
                          variant={pathname === '/map-drawing' ? "secondary" : "ghost"} 
                          className="w-full justify-start"
                          onClick={closeSheet}
                        >
                          <Map className="mr-2 h-4 w-4" />
                          Map Mode
                        </Button>
                      </Link>
                  </div>
                </SheetContent>
              </Sheet>
            )}
            
            <UserMenu user={user} />
          </div>
        </div>
      </nav>
    </TooltipProvider>
  )
}
