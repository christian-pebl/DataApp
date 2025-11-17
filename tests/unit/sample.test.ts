import { describe, test, expect } from '@jest/globals'

/**
 * Sample Unit Tests
 * These tests verify basic functionality and serve as templates
 */

describe('Sample Test Suite', () => {
  test('should pass basic assertion', () => {
    expect(true).toBe(true)
  })

  test('should perform basic arithmetic', () => {
    expect(2 + 2).toBe(4)
    expect(10 - 5).toBe(5)
  })

  test('should handle arrays', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(arr).toHaveLength(5)
    expect(arr).toContain(3)
  })

  test('should handle objects', () => {
    const obj = { name: 'Test', value: 42 }
    expect(obj).toHaveProperty('name')
    expect(obj.value).toBe(42)
  })
})

describe('String Utilities', () => {
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

  test('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
    expect(capitalize('world')).toBe('World')
  })

  test('should handle empty string', () => {
    expect(capitalize('')).toBe('')
  })
})

describe('Array Utilities', () => {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  const average = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0

  test('should calculate sum', () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15)
    expect(sum([10, 20, 30])).toBe(60)
  })

  test('should calculate average', () => {
    expect(average([1, 2, 3, 4, 5])).toBe(3)
    expect(average([10, 20, 30])).toBe(20)
  })

  test('should handle empty array', () => {
    expect(sum([])).toBe(0)
    expect(average([])).toBe(0)
  })
})
