import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Logger } from '../logger'

describe('Logger', () => {
  let logger: Logger
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>
    info: ReturnType<typeof vi.spyOn>
    warn: ReturnType<typeof vi.spyOn>
    error: ReturnType<typeof vi.spyOn>
  }

  beforeEach(() => {
    logger = new Logger()
    // Spy on console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
  })

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks()
  })

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test message')
      expect(consoleSpy.info).toHaveBeenCalled()
    })

    it('should include context when provided', () => {
      logger.info('Test message', { context: 'TestContext' })
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
      )
    })

    it('should include data when provided', () => {
      const testData = { key: 'value' }
      logger.info('Test message', { data: testData })
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.any(String),
        testData
      )
    })
  })

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Warning message')
      expect(consoleSpy.warn).toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Error message')
      expect(consoleSpy.error).toHaveBeenCalled()
    })

    it('should log error objects', () => {
      const error = new Error('Test error')
      logger.error('Error occurred', error)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.any(String),
        error
      )
    })
  })

  describe('debug', () => {
    it('should only log debug messages in development', () => {
      // In test environment (NODE_ENV !== 'development'), debug should not log
      logger.debug('Debug message')
      // Test environment is not development, so debug should not be called
      expect(consoleSpy.debug).toHaveBeenCalledTimes(0)
    })
  })

  describe('log formatting', () => {
    it('should include timestamp in log messages', () => {
      logger.info('Test message')
      const callArgs = consoleSpy.info.mock.calls[0][0] as string
      // Check for ISO timestamp format (contains 'T' and 'Z')
      expect(callArgs).toMatch(/\d{4}-\d{2}-\d{2}T/)
    })

    it('should include log level in uppercase', () => {
      logger.info('Test message')
      const callArgs = consoleSpy.info.mock.calls[0][0] as string
      expect(callArgs).toContain('INFO')
    })
  })
})
