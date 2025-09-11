'use client'

import { useEffect } from 'react'
import { dataSyncService } from '@/lib/supabase/data-sync-service'
import { useSyncNotifications } from '@/components/ui/sync-notifications'
import { SyncNotificationsContainer } from '@/components/ui/sync-notifications-container'

interface DataRestoreNotificationsProps {
  isActive: boolean
  onComplete: () => void
}

export function DataRestoreNotifications({ isActive, onComplete }: DataRestoreNotificationsProps) {
  const { notifications, showNotification, updateNotification, removeNotification } = useSyncNotifications()

  useEffect(() => {
    if (isActive) {
      restoreUserData()
    }
  }, [isActive])

  const restoreUserData = async () => {
    const notificationId = showNotification({
      type: 'restore',
      status: 'loading',
      title: 'Welcome Back!',
      message: 'Restoring your saved pins, lines, and areas...'
    })
    
    try {
      console.log('Starting data restoration after login...')
      const result = await dataSyncService.restoreUserData()
      
      if (result.success) {
        updateNotification(notificationId, {
          status: 'success',
          title: 'Data Restored',
          message: 'Your data has been successfully loaded',
          details: result.details
        })
        
        // Auto-complete after showing success
        setTimeout(() => {
          onComplete()
        }, 3000)
      } else {
        updateNotification(notificationId, {
          status: 'error',
          title: 'Restoration Error',
          message: result.message || 'Failed to restore some data. You can continue with local data.',
          onRetry: () => {
            removeNotification(notificationId)
            restoreUserData()
          }
        })
      }
    } catch (error) {
      console.error('Error restoring data:', error)
      updateNotification(notificationId, {
        status: 'error',
        title: 'Restoration Failed',
        message: 'Failed to restore your data. You can continue with local data.',
        onRetry: () => {
          removeNotification(notificationId)
          restoreUserData()
        }
      })
    }
  }

  return (
    <SyncNotificationsContainer 
      notifications={notifications}
      onRemove={removeNotification}
    />
  )
}