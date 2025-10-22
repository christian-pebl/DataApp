'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface PEBLLogoProps {
  variant?: 'horizontal' | 'icon' | 'stacked'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  href?: string
  priority?: boolean
}

const sizeClasses = {
  sm: {
    horizontal: { width: 64, height: 19 },  // 20% smaller
    icon: { width: 19, height: 19 },
    stacked: { width: 48, height: 38 }
  },
  md: {
    horizontal: { width: 96, height: 29 },  // 20% smaller
    icon: { width: 29, height: 29 },
    stacked: { width: 72, height: 58 }
  },
  lg: {
    horizontal: { width: 128, height: 38 }, // 20% smaller
    icon: { width: 38, height: 38 },
    stacked: { width: 96, height: 77 }
  },
  xl: {
    horizontal: { width: 160, height: 48 }, // 20% smaller
    icon: { width: 48, height: 48 },
    stacked: { width: 120, height: 96 }
  }
}

export function PEBLLogo({ 
  variant = 'horizontal', 
  size = 'md', 
  className, 
  href = '/',
  priority = false 
}: PEBLLogoProps) {
  const dimensions = sizeClasses[size][variant]
  
  // Choose logo file based on variant
  const getLogoSrc = () => {
    switch (variant) {
      case 'icon':
        return '/logos/PEBL Logo-3.svg' // Assuming this is the icon version
      case 'horizontal':
        return '/logos/PEBL Logo-1.svg' // Main horizontal logo
      case 'stacked':
        return '/logos/PEBL Logo-2.svg' // Stacked version
      default:
        return '/logos/PEBL Logo-1.svg'
    }
  }

  const LogoContent = () => (
    <div 
      className={cn(
        'flex items-center transition-colors hover:opacity-80',
        variant === 'stacked' && 'flex-col justify-center',
        className
      )}
      style={{ 
        width: dimensions.width, 
        height: dimensions.height,
      }}
    >
      <Image
        src={getLogoSrc()}
        alt="PEBL - Protecting Ecology Beyond Land"
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className="object-contain"
        style={{
          width: '100%',
          height: '100%',
          filter: 'brightness(0) saturate(100%) invert(60%) sepia(8%) saturate(348%) hue-rotate(190deg) brightness(95%) contrast(87%)',
          // This filter converts the logo to a light grey color (#6B7280 - tailwind gray-500)
        }}
      />
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="flex items-center">
        <LogoContent />
      </Link>
    )
  }

  return <LogoContent />
}

// Convenience components for specific use cases
export function PEBLLogoNav() {
  return <PEBLLogo variant="horizontal" size="md" href="/data-explorer" priority={true} />
}

export function PEBLLogoIcon({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  return <PEBLLogo variant="icon" size={size} href={null} />
}

export function PEBLLogoFooter() {
  return <PEBLLogo variant="stacked" size="sm" href="/data-explorer" />
}