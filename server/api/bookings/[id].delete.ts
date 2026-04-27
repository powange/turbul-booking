import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

// Supprime une réservation (= libère un lit pour une nuit donnée).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const booking = await prisma.booking.findUnique({ where: { id } })
  if (!booking) throw createError({ statusCode: 404, statusMessage: 'Réservation introuvable' })

  await prisma.booking.delete({ where: { id } })

  await logAudit({
    userId: user.id,
    action: 'BOOKING_DELETE',
    entityType: 'Booking',
    entityId: id,
    payload: {
      bedId: booking.bedId,
      guestId: booking.guestId,
      date: booking.date.toISOString().slice(0, 10)
    }
  })

  broadcast('booking:deleted', {
    id,
    bedId: booking.bedId,
    guestId: booking.guestId,
    date: booking.date.toISOString().slice(0, 10)
  })

  return { success: true }
})
