// Utilitaires de dates "YYYY-MM-DD" sans timezone (jours civils).
// On utilise Intl pour afficher en français sans dépendance lourde.

export function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  const yy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function rangeDays(fromIso: string, toIso: string): string[] {
  const out: string[] = []
  let cur = fromIso
  while (cur < toIso) {
    out.push(cur)
    cur = addDaysIso(cur, 1)
  }
  return out
}

const dayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
const dayNum = new Intl.DateTimeFormat('fr-FR', { day: 'numeric' })
const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' })
const fullDate = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d))
}

export function formatDayShort(iso: string): string {
  return dayShort.format(isoToDate(iso)).replace('.', '')
}

export function formatDayNum(iso: string): string {
  return dayNum.format(isoToDate(iso))
}

export function formatMonthShort(iso: string): string {
  return monthShort.format(isoToDate(iso)).replace('.', '')
}

export function formatFullDate(iso: string): string {
  return fullDate.format(isoToDate(iso))
}

export function isWeekend(iso: string): boolean {
  const d = isoToDate(iso).getUTCDay()
  return d === 0 || d === 6
}

export function isToday(iso: string): boolean {
  return iso === todayIso()
}
