'use client'

import { useEffect, useState } from 'react'
import { Loader2, Save, LogOut, CheckCircle2, AlertCircle, Cloud, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SyncNotificationProps {
  isOpen: boolean
  onClose: () => void
  type: 'backup' | 'restore' | 'logout'
  status: 'loading' | 'success' | 'error'
  title: string
  message?: string
  details?: {
    pins?: number
    lines?: number
    areas?: number
    errors?: string[]
  }
  onRetry?: () => void
}

export function SyncNotification({
  isOpen,
  onClose,
  type,
  status,
  title,
  message,
  details,
  onRetry
}: SyncNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    if (status === 'success' && isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status, isOpen, onClose])

  if (!isVisible) return null

  const getIcon = () => {
    if (status === 'loading') {
      switch (type) {
        case 'backup':
          return <Save className="h-5 w-5 animate-pulse text-blue-500" />
        case 'restore':
          return <Cloud className="h-5 w-5 animate-pulse text-blue-500" />
        case 'logout':
          return <LogOut className="h-5 w-5 animate-pulse text-blue-500" />
        default:
          return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      }
    }
    
    if (status === 'success') {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }
    
    if (status === 'error') {
      return <AlertCircle className="h-5 w-5 text-red-500" />
    }

    return null
  }

  const getProgressColor = () => {
    switch (status) {
      case 'loading':
        return 'bg-blue-500'
      case 'success':
        return 'bg-green-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 transition-all duration-300 ease-in-out",
      isOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
    )}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-w-sm w-full p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {getIcon()}
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1 mb-3">
          <div 
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              getProgressColor(),
              status === 'loading' && "animate-pulse"
            )}
            style={{ 
              width: status === 'loading' ? '60%' : status === 'success' ? '100%' : '30%' 
            }}
          />
        </div>

        {/* Message */}
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            {message}
          </p>
        )}

        {/* Details */}
        {details && status !== 'loading' && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-3 space-y-1 text-xs">
            {details.pins !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pins:</span>
                <span className="font-medium">{details.pins}</span>
              </div>
            )}
            {details.lines !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Lines:</span>
                <span className="font-medium">{details.lines}</span>
              </div>
            )}
            {details.areas !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Areas:</span>
                <span className="font-medium">{details.areas}</span>
              </div>
            )}
            {details.errors && details.errors.length > 0 && (
              <div className="text-red-600 dark:text-red-400">
                <span>Errors: {details.errors.length}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions for error state */}
        {status === 'error' && onRetry && (
          <div className="flex space-x-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="flex-1"
            >
              Retry
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Hook to manage sync notifications
export function useSyncNotifications() {
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'backup' | 'restore' | 'logout'
    status: 'loading' | 'success' | 'error'
    title: string
    message?: string
    details?: any
    onRetry?: () => void
  }>>([])

  const showNotification = (notification: Omit<typeof notifications[0], 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setNotifications(prev => [...prev, { ...notification, id }])
    return id
  }

  const updateNotification = (id: string, updates: Partial<typeof notifications[0]>) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n))
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  return {
    notifications,
    showNotification,
    updateNotification,
    removeNotification,
    clearAllNotifications
  }
}