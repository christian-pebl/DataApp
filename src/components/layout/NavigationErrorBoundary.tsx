'use client'

import React, { Component, ReactNode } from 'react'
import { PEBLLogoNav } from '@/components/branding/PEBLLogo'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

// Fallback navigation that ALWAYS shows the PEBL logo
const FallbackNavigation = () => (
  <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-14">
    <div className="flex h-full items-center justify-between px-4 w-full">
      <div className="flex items-center">
        <PEBLLogoNav />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8" />
      </div>
    </div>
  </nav>
)

export class NavigationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('NavigationErrorBoundary caught error:', error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Navigation Error Boundary caught an error:', error, errorInfo)
    
    // In production, you might want to send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendErrorToService(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // Always render the navigation structure with PEBL logo
      return this.props.fallback || <FallbackNavigation />
    }

    return this.props.children
  }
}

// HOC wrapper for easy use
export function withNavigationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  const WrappedComponent = (props: P) => (
    <NavigationErrorBoundary>
      <Component {...props} />
    </NavigationErrorBoundary>
  )
  
  WrappedComponent.displayName = `withNavigationErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}