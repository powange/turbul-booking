import { prisma } from './db'

interface AuditEntry {
  userId: string | null
  action: string
  entityType: string
  entityId?: string | null
  payload?: unknown
}

export async function logAudit(entry: AuditEntry) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? undefined,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? undefined,
        payload: (entry.payload ?? undefined) as never
      }
    })
  } catch (err) {
    console.error('[audit] failed to write entry', err)
  }
}
