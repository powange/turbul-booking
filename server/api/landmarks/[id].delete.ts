import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const existing = await prisma.landmark.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Repère introuvable' })

  await prisma.landmark.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'LANDMARK_DELETE',
    entityType: 'Landmark',
    entityId: id
  })

  broadcast('landmark:deleted', { id })

  return { success: true }
})
