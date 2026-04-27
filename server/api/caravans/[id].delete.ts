import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

// Soft delete : la caravane disparaît du plan mais l'historique des
// nuitées et les lits restent en base.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const existing = await prisma.caravan.findFirst({ where: { id, deletedAt: null } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Caravane introuvable' })

  await prisma.caravan.update({
    where: { id },
    data: { deletedAt: new Date() }
  })

  await logAudit({
    userId: user.id,
    action: 'CARAVAN_DELETE',
    entityType: 'Caravan',
    entityId: id
  })

  broadcast('caravan:deleted', { id })

  return { success: true }
})
