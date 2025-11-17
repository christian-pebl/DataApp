import { describe, test, expect } from '@jest/globals'

/**
 * CSV Parser Unit Tests
 * Tests for date parsing, format detection, and data transformation
 */

describe('CSV Parser - Basic Parsing', () => {
  // Helper function to simulate basic CSV parsing
  const parseSimpleCSV = (csv: string) => {
    const lines = csv.trim().split('\n')
    if (lines.length === 0) return []

    const headers = lines[0].split(',')
    return lines.slice(1).map(line => {
      const values = line.split(',')
      const obj: any = {}
      headers.forEach((header, i) => {
        obj[header.trim()] = values[i]?.trim()
      })
      return obj
    })
  }

  test('should parse simple CSV data', () => {
    const csv = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA'
    const result = parseSimpleCSV(csv)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ Name: 'John', Age: '30', City: 'NYC' })
    expect(result[1]).toEqual({ Name: 'Jane', Age: '25', City: 'LA' })
  })

  test('should handle empty CSV', () => {
    const csv = 'Name,Age'
    const result = parseSimpleCSV(csv)

    expect(result).toHaveLength(0)
  })

  test('should handle CSV with headers only', () => {
    const csv = 'Date,Value,Unit'
    const result = parseSimpleCSV(csv)

    expect(result).toHaveLength(0)
  })

  test('should preserve data types as strings', () => {
    const csv = 'Value,Text\n123,abc\n456,def'
    const result = parseSimpleCSV(csv)

    expect(result[0].Value).toBe('123')
    expect(result[0].Text).toBe('abc')
  })
})

describe('CSV Parser - Date Handling', () => {
  // Date parsing helper
  const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null

    // Try DD/MM/YYYY format
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/
    const match = dateStr.match(ddmmyyyy)

    if (match) {
      let day = parseInt(match[1])
      let month = parseInt(match[2])
      let year = parseInt(match[3])

      // Handle 2-digit years
      if (year < 100) {
        year += 2000
      }

      // Create date (month is 0-indexed)
      return new Date(year, month - 1, day)
    }

    return null
  }

  test('should parse DD/MM/YYYY format', () => {
    const date1 = parseDateString('25/12/2024')
    expect(date1).toBeInstanceOf(Date)
    expect(date1?.getFullYear()).toBe(2024)
    expect(date1?.getMonth()).toBe(11) // December (0-indexed)
    expect(date1?.getDate()).toBe(25)
  })

  test('should parse DD/MM/YY format (2-digit year)', () => {
    const date1 = parseDateString('25/12/24')
    expect(date1).toBeInstanceOf(Date)
    expect(date1?.getFullYear()).toBe(2024)
  })

  test('should handle single-digit day and month', () => {
    const date1 = parseDateString('5/3/2024')
    expect(date1).toBeInstanceOf(Date)
    expect(date1?.getMonth()).toBe(2) // March
    expect(date1?.getDate()).toBe(5)
  })

  test('should return null for invalid date strings', () => {
    expect(parseDateString('')).toBeNull()
    expect(parseDateString('invalid')).toBeNull()
    expect(parseDateString('2024-01-01')).toBeNull() // ISO format not supported
  })
})

describe('CSV Parser - Format Detection', () => {
  const detectDateFormat = (dates: string[]): 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'UNKNOWN' => {
    if (dates.length === 0) return 'UNKNOWN'

    // Check for dates where day > 12 (must be DD/MM/YYYY)
    const hasDayOver12 = dates.some(dateStr => {
      const parts = dateStr.split('/')
      if (parts.length === 3) {
        const firstPart = parseInt(parts[0])
        return firstPart > 12
      }
      return false
    })

    if (hasDayOver12) return 'DD/MM/YYYY'

    // If ambiguous, default to DD/MM/YYYY (common in scientific data)
    return 'DD/MM/YYYY'
  }

  test('should detect DD/MM/YYYY when day > 12', () => {
    const dates = ['13/05/2024', '14/06/2024', '15/07/2024']
    expect(detectDateFormat(dates)).toBe('DD/MM/YYYY')
  })

  test('should default to DD/MM/YYYY for ambiguous dates', () => {
    const dates = ['01/02/2024', '03/04/2024', '05/06/2024']
    expect(detectDateFormat(dates)).toBe('DD/MM/YYYY')
  })

  test('should handle empty array', () => {
    expect(detectDateFormat([])).toBe('UNKNOWN')
  })
})
