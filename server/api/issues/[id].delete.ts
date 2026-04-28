import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const existing = await prisma.caravanIssue.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Item introuvable' })

  await prisma.caravanIssue.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'ISSUE_DELETE',
    entityType: 'CaravanIssue',
    entityId: id,
    payload: { caravanId: existing.caravanId, label: existing.label }
  })

  broadcast('issue:deleted', { id, caravanId: existing.caravanId })

  return { success: true }
})
