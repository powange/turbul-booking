import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

// Suppression d'un lit. Refusée s'il a déjà des réservations
// (la contrainte SQL onDelete: Restrict côté Booking → Bed lèvera P2003).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const bookingCount = await prisma.booking.count({ where: { bedId: id } })
  if (bookingCount > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ce lit a des réservations dans l\'historique et ne peut pas être supprimé.'
    })
  }

  const bed = await prisma.bed.findUnique({ where: { id } })
  if (!bed) throw createError({ statusCode: 404, statusMessage: 'Lit introuvable' })

  await prisma.bed.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'BED_DELETE',
    entityType: 'Bed',
    entityId: id,
    payload: { caravanId: bed.caravanId }
  })

  broadcast('bed:deleted', { id, caravanId: bed.caravanId })

  return { success: true }
})
