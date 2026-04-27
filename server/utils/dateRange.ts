// Utilitaires de plages de dates sans timezone (jours civils).

export function parseDateOnly(s: string): Date {
  // Accepte "YYYY-MM-DD" et renvoie une Date à minuit UTC
  // (Prisma @db.Date stocke un jour civil sans timezone).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) throw new Error(`Format de date invalide : ${s}`)
  const [, y, mo, d] = m
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)))
}

export function formatDateOnly(d: Date): string {
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

/** Renvoie la liste des nuits dans [from, to) (to exclus). */
export function nightsInRange(fromIso: string, toIso: string): Date[] {
  const from = parseDateOnly(fromIso)
  const to = parseDateOnly(toIso)
  if (to <= from) return []
  const out: Date[] = []
  for (let d = new Date(from); d < to; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(new Date(d))
  }
  return out
}
