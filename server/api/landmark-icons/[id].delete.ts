import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

// Supprime une icône de la bibliothèque. Refus si elle est utilisée par au
// moins un point de repère (FK Restrict côté Prisma). On retourne 409 avec
// le décompte pour que le client puisse afficher un message clair.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const existing = await prisma.landmarkIcon.findUnique({
    where: { id },
    select: { id: true, name: true, _count: { select: { landmarks: true } } }
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Icône introuvable' })

  if (existing._count.landmarks > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Icône utilisée par ${existing._count.landmarks} point(s) de repère`
    })
  }

  await prisma.landmarkIcon.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'LANDMARK_ICON_DELETE',
    entityType: 'LandmarkIcon',
    entityId: id,
    payload: { name: existing.name }
  })

  broadcast('landmarkIcon:deleted', { id })

  return { success: true }
})
