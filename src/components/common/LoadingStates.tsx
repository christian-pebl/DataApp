'use client'

import React from 'react'
import { Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  }
  
  return (
    <Loader2 className={cn('animate-spin', sizeClasses[size], className)} />
  )
}

interface LoadingCardProps {
  title?: string
  description?: string
  showSpinner?: boolean
}

export function LoadingCard({ 
  title = 'Loading...', 
  description = 'Please wait while we fetch your data',
  showSpinner = true 
}: LoadingCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        {showSpinner && (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

interface LoadingSkeletonProps {
  type?: 'text' | 'card' | 'chart' | 'table'
  lines?: number
  className?: string
}

export function LoadingSkeleton({ type = 'text', lines = 3, className }: LoadingSkeletonProps) {
  if (type === 'text') {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={cn(
              'h-4',
              i === lines - 1 ? 'w-3/4' : 'w-full'
            )} 
          />
        ))}
      </div>
    )
  }
  
  if (type === 'card') {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (type === 'chart') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="flex justify-center space-x-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    )
  }
  
  if (type === 'table') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex space-x-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-28" />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex space-x-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    )
  }
  
  return <Skeleton className={cn('h-4 w-full', className)} />
}

interface StatusIndicatorProps {
  status: 'idle' | 'loading' | 'success' | 'error' | 'warning'
  message?: string
  size?: 'sm' | 'md' | 'lg'
}

export function StatusIndicator({ status, message, size = 'md' }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }
  
  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }
  
  const renderIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className={cn('animate-spin text-blue-500', sizeClasses[size])} />
      case 'success':
        return <CheckCircle2 className={cn('text-green-500', sizeClasses[size])} />
      case 'error':
        return <AlertCircle className={cn('text-red-500', sizeClasses[size])} />
      case 'warning':
        return <AlertCircle className={cn('text-yellow-500', sizeClasses[size])} />
      case 'idle':
        return <Clock className={cn('text-gray-400', sizeClasses[size])} />
      default:
        return null
    }
  }
  
  return (
    <div className="flex items-center gap-2">
      {renderIcon()}
      {message && (
        <span className={cn('text-muted-foreground', textSizeClasses[size])}>
          {message}
        </span>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  icon?: React.ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && (
        <p className="text-muted-foreground mb-4 max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}