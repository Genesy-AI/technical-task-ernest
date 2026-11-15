import { describe, expect, it } from 'vitest'
import { parseYearsAtCompany } from './parseYearsAtCompany'

describe('parseYearsAtCompany', () => {
  it('converts numeric strings to integers', () => {
    expect(parseYearsAtCompany('5')).toBe(5)
    expect(parseYearsAtCompany(' 12 ')).toBe(12)
    expect(parseYearsAtCompany('0')).toBe(0)
  })

  it('keeps integer numbers, including 0', () => {
    expect(parseYearsAtCompany(3)).toBe(3)
    expect(parseYearsAtCompany(0)).toBe(0)
  })

  it('returns null for missing values', () => {
    expect(parseYearsAtCompany(undefined)).toBeNull()
    expect(parseYearsAtCompany(null)).toBeNull()
    expect(parseYearsAtCompany('')).toBeNull()
    expect(parseYearsAtCompany('   ')).toBeNull()
  })

  it('throws for values that are not a whole number of 0 or more', () => {
    const message = 'yearsAtCompany must be a whole number of 0 or more'
    expect(() => parseYearsAtCompany('abc')).toThrow(message)
    expect(() => parseYearsAtCompany('5 years')).toThrow(message)
    expect(() => parseYearsAtCompany('2.5')).toThrow(message)
    expect(() => parseYearsAtCompany(2.5)).toThrow(message)
    expect(() => parseYearsAtCompany('-1')).toThrow(message)
    expect(() => parseYearsAtCompany(true)).toThrow(message)
    expect(() => parseYearsAtCompany({})).toThrow(message)
  })
})
