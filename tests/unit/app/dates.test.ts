import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  todayIso,
  addDaysIso,
  rangeDays,
  formatDayShort,
  formatDayNum,
  formatMonthShort,
  formatFullDate,
  isWeekend,
  isToday,
  startOfWeekMondayIso
} from '~/utils/dates'

describe('addDaysIso', () => {
  it('adds positive days', () => {
    expect(addDaysIso('2026-04-28', 1)).toBe('2026-04-29')
    expect(addDaysIso('2026-04-28', 7)).toBe('2026-05-05')
  })

  it('subtracts via negative', () => {
    expect(addDaysIso('2026-04-28', -1)).toBe('2026-04-27')
    expect(addDaysIso('2026-05-01', -1)).toBe('2026-04-30')
  })

  it('handles 0', () => {
    expect(addDaysIso('2026-04-28', 0)).toBe('2026-04-28')
  })

  it('crosses year boundary', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('respects leap year (Feb 29 → Mar 1)', () => {
    expect(addDaysIso('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDaysIso('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDaysIso('2025-02-28', 1)).toBe('2025-03-01')
  })
})

describe('rangeDays', () => {
  it('returns days in [from, to)', () => {
    expect(rangeDays('2026-04-28', '2026-05-02')).toEqual([
      '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01'
    ])
  })

  it('returns empty when from === to', () => {
    expect(rangeDays('2026-04-28', '2026-04-28')).toEqual([])
  })

  it('returns empty when to < from', () => {
    expect(rangeDays('2026-04-30', '2026-04-28')).toEqual([])
  })
})

describe('startOfWeekMondayIso', () => {
  it('returns the Monday of the week for each weekday', () => {
    // 2026-04-27 is a Monday
    expect(startOfWeekMondayIso('2026-04-27')).toBe('2026-04-27') // lundi
    expect(startOfWeekMondayIso('2026-04-28')).toBe('2026-04-27') // mardi
    expect(startOfWeekMondayIso('2026-04-29')).toBe('2026-04-27') // mercredi
    expect(startOfWeekMondayIso('2026-04-30')).toBe('2026-04-27') // jeudi
    expect(startOfWeekMondayIso('2026-05-01')).toBe('2026-04-27') // vendredi
    expect(startOfWeekMondayIso('2026-05-02')).toBe('2026-04-27') // samedi
    expect(startOfWeekMondayIso('2026-05-03')).toBe('2026-04-27') // dimanche
  })

  it('crosses month boundary backwards (Mon 1 May → Mon 27 Apr if Sunday picked)', () => {
    // 2026-05-03 (dim) → lundi précédent = 2026-04-27
    expect(startOfWeekMondayIso('2026-05-03')).toBe('2026-04-27')
  })

  it('crosses year boundary backwards', () => {
    // 2027-01-01 is a Friday → Monday = 2026-12-28
    expect(startOfWeekMondayIso('2027-01-01')).toBe('2026-12-28')
  })

  it('is idempotent : startOfWeek(startOfWeek(d)) === startOfWeek(d)', () => {
    for (const iso of ['2026-04-28', '2026-05-03', '2027-01-01', '2024-02-29']) {
      const once = startOfWeekMondayIso(iso)
      expect(startOfWeekMondayIso(once)).toBe(once)
    }
  })

  it('handles a leap-year week containing Feb 29', () => {
    // 2024-02-29 is a Thursday → Monday = 2024-02-26
    expect(startOfWeekMondayIso('2024-02-29')).toBe('2024-02-26')
  })
})

describe('isWeekend', () => {
  it('Saturday and Sunday are weekend', () => {
    expect(isWeekend('2026-05-02')).toBe(true) // sam
    expect(isWeekend('2026-05-03')).toBe(true) // dim
  })

  it('Monday to Friday are not', () => {
    for (const iso of ['2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01']) {
      expect(isWeekend(iso)).toBe(false)
    }
  })
})

describe('formatters (locale fr-FR)', () => {
  it('formatDayShort returns 3-letter weekday without trailing dot', () => {
    expect(formatDayShort('2026-04-27')).toMatch(/^lun/i)
    expect(formatDayShort('2026-04-27')).not.toContain('.')
  })

  it('formatDayNum returns the day-of-month', () => {
    expect(formatDayNum('2026-04-27')).toBe('27')
    expect(formatDayNum('2026-04-01')).toBe('1')
  })

  it('formatMonthShort returns 3-letter month without trailing dot', () => {
    expect(formatMonthShort('2026-04-15')).toMatch(/^avr/i)
    expect(formatMonthShort('2026-04-15')).not.toContain('.')
  })

  it('formatFullDate returns long french date', () => {
    expect(formatFullDate('2026-04-27')).toMatch(/lundi/i)
    expect(formatFullDate('2026-04-27')).toContain('27')
    expect(formatFullDate('2026-04-27')).toMatch(/avril/i)
    expect(formatFullDate('2026-04-27')).toContain('2026')
  })
})

describe('todayIso / isToday', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('todayIso returns the local-civil-day in YYYY-MM-DD', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T10:30:00'))
    expect(todayIso()).toBe('2026-04-28')
  })

  it('isToday matches todayIso', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-28T10:30:00'))
    expect(isToday('2026-04-28')).toBe(true)
    expect(isToday('2026-04-27')).toBe(false)
  })
})
