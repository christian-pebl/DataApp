/**
 * MODULE: Logging Utility
 * PURPOSE: Centralized logging with environment-aware output
 * DEPENDS_ON: None
 * USED_BY: All components and services (replaces console.log)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogOptions {
  level?: LogLevel
  context?: string
  data?: unknown
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

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
  }

  /**
   * Log a warning message
   */
  warn(message: string, options?: LogOptions): void {
    this.log('warn', message, options)
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, options?: LogOptions): void {
    this.log('error', message, { ...options, data: error })
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
// logger.debug('Map initialized', { context: 'LeafletMap', data: { zoom: 10 } })
// logger.info('File uploaded successfully')
// logger.warn('Slow query detected', { context: 'Supabase' })
// logger.error('Failed to create pin', error, { context: 'map-data-service' })
