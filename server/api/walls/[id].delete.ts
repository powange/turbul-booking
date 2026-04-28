import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const existing = await prisma.wall.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Mur introuvable' })

  await prisma.wall.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'WALL_DELETE',
    entityType: 'Wall',
    entityId: id
  })

  broadcast('wall:deleted', { id })

  return { success: true }
})
