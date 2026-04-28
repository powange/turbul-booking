import { describe, it, expect } from 'vitest'
import { parseDateOnly, formatDateOnly, nightsInRange } from '~~/server/utils/dateRange'

describe('parseDateOnly', () => {
  it('parses a YYYY-MM-DD into a UTC midnight Date', () => {
    const d = parseDateOnly('2026-04-28')
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(3)
    expect(d.getUTCDate()).toBe(28)
    expect(d.getUTCHours()).toBe(0)
    expect(d.getUTCMinutes()).toBe(0)
  })

  it('rejects invalid formats', () => {
    expect(() => parseDateOnly('2026-4-28')).toThrow(/Format de date invalide/)
    expect(() => parseDateOnly('28/04/2026')).toThrow()
    expect(() => parseDateOnly('')).toThrow()
    expect(() => parseDateOnly('2026-04-28T00:00:00')).toThrow()
  })

  it('handles month/day boundaries', () => {
    const a = parseDateOnly('2026-01-01')
    expect(a.getUTCMonth()).toBe(0)
    expect(a.getUTCDate()).toBe(1)
    const b = parseDateOnly('2026-12-31')
    expect(b.getUTCMonth()).toBe(11)
    expect(b.getUTCDate()).toBe(31)
  })
})

describe('formatDateOnly', () => {
  it('round-trips with parseDateOnly', () => {
    for (const iso of ['2026-01-01', '2026-04-28', '2026-12-31', '2024-02-29']) {
      expect(formatDateOnly(parseDateOnly(iso))).toBe(iso)
    }
  })

  it('pads single-digit months and days', () => {
    expect(formatDateOnly(parseDateOnly('2026-03-05'))).toBe('2026-03-05')
  })
})

describe('nightsInRange', () => {
  it('returns one night for a 1-day range', () => {
    const out = nightsInRange('2026-04-28', '2026-04-29')
    expect(out).toHaveLength(1)
    expect(formatDateOnly(out[0]!)).toBe('2026-04-28')
  })

  it('returns N nights for an N-day range (to is exclusive)', () => {
    const out = nightsInRange('2026-04-28', '2026-05-02')
    expect(out.map(formatDateOnly)).toEqual([
      '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01'
    ])
  })

  it('returns empty array when from === to', () => {
    expect(nightsInRange('2026-04-28', '2026-04-28')).toEqual([])
  })

  it('returns empty array when to < from', () => {
    expect(nightsInRange('2026-04-30', '2026-04-28')).toEqual([])
  })

  it('crosses month boundary', () => {
    const out = nightsInRange('2026-04-29', '2026-05-02')
    expect(out.map(formatDateOnly)).toEqual([
      '2026-04-29', '2026-04-30', '2026-05-01'
    ])
  })

  it('crosses year boundary', () => {
    const out = nightsInRange('2026-12-30', '2027-01-02')
    expect(out.map(formatDateOnly)).toEqual([
      '2026-12-30', '2026-12-31', '2027-01-01'
    ])
  })

  it('handles a leap day correctly', () => {
    const out = nightsInRange('2024-02-28', '2024-03-01')
    expect(out.map(formatDateOnly)).toEqual(['2024-02-28', '2024-02-29'])
  })

  it('returns independent Date copies (mutating one does not affect others)', () => {
    const out = nightsInRange('2026-04-28', '2026-04-30')
    out[0]!.setUTCDate(99)
    expect(formatDateOnly(out[1]!)).toBe('2026-04-29')
  })
})
