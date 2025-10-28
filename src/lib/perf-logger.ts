/**
 * Performance Logger
 * Provides concise, timestamped logging for tracking performance improvements
 */

type LogLevel = 'info' | 'warn' | 'error' | 'perf';

interface PerformanceMarker {
  name: string;
  startTime: number;
}

class PerformanceLogger {
  private markers: Map<string, PerformanceMarker> = new Map();
  private enabled: boolean = true;
  private minDurationMs: number = 100; // Only log operations taking 100ms or more

  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().slice(11, 23); // HH:mm:ss.SSS
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private log(level: LogLevel, message: string, data?: any) {
    if (!this.enabled) return;

    const timestamp = this.getTimestamp();
    const emoji = {
      info: '📋',
      warn: '⚠️',
      error: '❌',
      perf: '⚡'
    }[level];

    const prefix = `${emoji} [${timestamp}]`;

    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Start a performance marker
   */
  start(name: string) {
    this.markers.set(name, {
      name,
      startTime: performance.now()
    });
  }

  /**
   * End a performance marker and log the duration (only if >= minDurationMs)
   */
  end(name: string, additionalInfo?: string) {
    const marker = this.markers.get(name);
    if (!marker) {
      this.log('warn', `No marker found for: ${name}`);
      return;
    }

    const duration = performance.now() - marker.startTime;

    // Only log if duration exceeds threshold
    if (duration >= this.minDurationMs) {
      const info = additionalInfo ? ` - ${additionalInfo}` : '';
      this.log('perf', `${name}: ${this.formatDuration(duration)}${info}`);
    }

    this.markers.delete(name);
    return duration;
  }

  /**
   * Log info message
   */
  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: any) {
    this.log('error', message, error);
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Group related logs together
   */
  group(title: string) {
    if (!this.enabled) return;
    console.group(`📦 [${this.getTimestamp()}] ${title}`);
  }

  groupEnd() {
    if (!this.enabled) return;
    console.groupEnd();
  }
}

// Export singleton instance
export const perfLogger = new PerformanceLogger();

// Helper to measure async operations
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  perfLogger.start(name);
  try {
    const result = await fn();
    perfLogger.end(name);
    return result;
  } catch (error) {
    perfLogger.error(`${name} failed`, error);
    throw error;
  }
}
