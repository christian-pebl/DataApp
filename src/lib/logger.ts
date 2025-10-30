/**
 * MODULE: Logging Utility
 * PURPOSE: Centralized logging with environment-aware output and Sentry integration
 * DEPENDS_ON: @sentry/nextjs
 * USED_BY: All components and services (replaces console.log)
 *
 * IMPORTANT: This logger integrates with Sentry for production error tracking.
 * Console statements are removed in production, but errors are still sent to Sentry.
 */

import * as Sentry from '@sentry/nextjs'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  level?: LogLevel
  context?: string
  data?: unknown
  tags?: Record<string, string>
  userId?: string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isProduction = process.env.NODE_ENV === 'production'

  /**
   * Set user context for Sentry error tracking
   */
  setUser(userId: string, email?: string, username?: string): void {
    if (this.isProduction) {
      Sentry.setUser({ id: userId, email, username })
    }
  }

  /**
   * Clear user context (e.g., on logout)
   */
  clearUser(): void {
    if (this.isProduction) {
      Sentry.setUser(null)
    }
  }

  /**
   * Log a debug message (only in development)
   */
  debug(message: string, options?: LogOptions): void {
    if (this.isDevelopment) {
      this.log('debug', message, options)
    }
  }

  /**
   * Log an info message
   */
  info(message: string, options?: LogOptions): void {
    this.log('info', message, options)

    // Send breadcrumb to Sentry for context
    if (this.isProduction) {
      Sentry.addBreadcrumb({
        message,
        level: 'info',
        data: options?.data as Record<string, unknown>,
        category: options?.context,
      })
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, options?: LogOptions): void {
    this.log('warn', message, options)

    // Send warning to Sentry
    if (this.isProduction) {
      Sentry.captureMessage(message, {
        level: 'warning',
        tags: options?.tags,
        contexts: {
          context: {
            name: options?.context || 'unknown',
            data: options?.data as Record<string, unknown>,
          },
        },
      })
    }
  }

  /**
   * Log an error message and send to Sentry in production
   */
  error(message: string, error?: Error | unknown, options?: LogOptions): void {
    this.log('error', message, { ...options, data: error })

    // Send error to Sentry in production
    if (this.isProduction) {
      const scope = new Sentry.Scope()

      // Add context
      if (options?.context) {
        scope.setTag('context', options.context)
      }

      // Add custom tags
      if (options?.tags) {
        Object.entries(options.tags).forEach(([key, value]) => {
          scope.setTag(key, value)
        })
      }

      // Add extra data
      if (options?.data) {
        scope.setExtra('data', options.data)
      }

      // Capture the error
      if (error instanceof Error) {
        Sentry.captureException(error, { scope })
      } else {
        Sentry.captureMessage(message, { level: 'error', scope })
      }
    }
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, options?: LogOptions): void {
    const timestamp = new Date().toISOString()
    const context = options?.context ? `[${options.context}]` : ''
    const prefix = `${timestamp} ${level.toUpperCase()} ${context}`

    const logFn = this.getLogFunction(level)

    if (options?.data) {
      logFn(`${prefix} ${message}`, options.data)
    } else {
      logFn(`${prefix} ${message}`)
    }
  }

  /**
   * Get the appropriate console method based on log level
   */
  private getLogFunction(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case 'debug':
        return console.debug
      case 'info':
        return console.info
      case 'warn':
        return console.warn
      case 'error':
        return console.error
      default:
        return console.log
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export class for testing
export { Logger }

// Example usage:
//
// In components/services:
// logger.debug('Map initialized', { context: 'LeafletMap', data: { zoom: 10 } })
// logger.info('File uploaded successfully', { context: 'FileUpload', data: { fileName: 'data.csv' } })
// logger.warn('Slow query detected', { context: 'Supabase', tags: { table: 'pins' } })
// logger.error('Failed to create pin', error, { context: 'map-data-service', tags: { operation: 'create' } })
//
// Set user context (e.g., after login):
// logger.setUser(user.id, user.email, user.name)
//
// Clear user context (e.g., on logout):
// logger.clearUser()
//
// PRODUCTION BEHAVIOR:
// - debug() messages are never sent (development only)
// - info() messages create Sentry breadcrumbs for context
// - warn() messages are sent to Sentry as warnings
// - error() messages are sent to Sentry as errors with full stack traces
// - All console.* calls are removed in production, but Sentry captures everything
