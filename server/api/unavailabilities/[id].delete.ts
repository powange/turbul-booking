import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const existing = await prisma.caravanUnavailability.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Indisponibilité introuvable' })

  await prisma.caravanUnavailability.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'UNAVAILABILITY_DELETE',
    entityType: 'CaravanUnavailability',
    entityId: id,
    payload: { caravanId: existing.caravanId }
  })

  broadcast('unavailability:deleted', { id, caravanId: existing.caravanId })

  return { success: true }
})
