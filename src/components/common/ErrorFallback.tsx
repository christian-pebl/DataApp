'use client'

import React from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRouter } from 'next/navigation'

interface ErrorFallbackProps {
  error?: Error
  resetError?: () => void
  title?: string
  description?: string
  showHomeButton?: boolean
}

export function ErrorFallback({ 
  error, 
  resetError, 
  title = "Something went wrong",
  description = "An error occurred while loading this component",
  showHomeButton = false
}: ErrorFallbackProps) {
  const router = useRouter()

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
          <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {process.env.NODE_ENV === 'development' && error && (
          <div className="rounded-md bg-muted p-4">
            <h4 className="text-sm font-medium mb-2">Error Details (Development)</h4>
            <code className="text-xs break-words text-destructive">
              {error.message}
            </code>
            {error.stack && (
              <pre className="text-xs mt-2 overflow-auto max-h-32 text-muted-foreground">
                {error.stack}
              </pre>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {resetError && (
            <Button onClick={resetError} className="flex-1">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          {showHomeButton && (
            <Button 
              variant="outline" 
              onClick={() => router.push('/')} 
              className="flex-1"
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function ComponentErrorFallback({ error, resetError }: { error?: Error; resetError?: () => void }) {
  return (
    <div className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          Component Error
        </h3>
      </div>
      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
        This component failed to load properly.
      </p>
      {process.env.NODE_ENV === 'development' && error && (
        <div className="mb-3">
          <code className="text-xs text-yellow-800 dark:text-yellow-200 break-words">
            {error.message}
          </code>
        </div>
      )}
      {resetError && (
        <Button onClick={resetError} size="sm" variant="outline" className="h-7 text-xs">
          <RefreshCcw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  )
}