import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'
import { nightsInRange } from '~~/server/utils/dateRange'
import { createBookings } from '~~/server/services/bookings'

const guestInputSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal(''))
})

const schema = z.object({
  bedId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestId: z.string().min(1).optional(),
  guest: guestInputSchema.optional()
}).refine(d => d.guestId || d.guest, { message: 'guestId ou guest requis' })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const body = await readValidatedBody(event, schema.parse)

  const result = await prisma.$transaction(tx => createBookings(tx, body, user.id))

  await logAudit({
    userId: user.id,
    action: 'BOOKING_CREATE',
    entityType: 'Booking',
    payload: {
      bedId: body.bedId,
      guestId: result.guestId,
      from: body.from,
      to: body.to,
      nights: nightsInRange(body.from, body.to).length
    }
  })

  for (const b of result.created) {
    broadcast('booking:created', b)
  }
  if (result.guestCreated) {
    const g = await prisma.guest.findUnique({ where: { id: result.guestId } })
    if (g) broadcast('guest:created', g)
  }

  return result.created
})
