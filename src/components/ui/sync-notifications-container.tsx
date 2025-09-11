'use client'

import { SyncNotification } from './sync-notifications'

interface SyncNotificationsContainerProps {
  notifications: Array<{
    id: string
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
  }>
  onRemove: (id: string) => void
}

export function SyncNotificationsContainer({
  notifications,
  onRemove
}: SyncNotificationsContainerProps) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {notifications.map((notification, index) => (
        <div
          key={notification.id}
          style={{
            transform: `translateY(${index * -4}px)`,
            zIndex: 50 - index
          }}
        >
          <SyncNotification
            isOpen={true}
            onClose={() => onRemove(notification.id)}
            type={notification.type}
            status={notification.status}
            title={notification.title}
            message={notification.message}
            details={notification.details}
            onRetry={notification.onRetry}
          />
        </div>
      ))}
    </div>
  )
}