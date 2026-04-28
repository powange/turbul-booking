/**
 * Extrait un message lisible d'une erreur quelconque, sans `any`.
 * Couvre les formes courantes :
 * - $fetch (Nuxt) : `err.statusMessage` ou `err.data.statusMessage`
 * - JS standard : `err.message`
 * - autre : fallback `String(err)`
 */
export function errorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as {
      statusMessage?: unknown
      data?: { statusMessage?: unknown }
      message?: unknown
    }
    if (typeof e.statusMessage === 'string') return e.statusMessage
    if (e.data && typeof e.data.statusMessage === 'string') return e.data.statusMessage
    if (typeof e.message === 'string') return e.message
  }
  return String(err)
}
