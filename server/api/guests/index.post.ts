import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal(''))
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const body = await readValidatedBody(event, schema.parse)

  const guest = await prisma.guest.create({
    data: {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null
    }
  })

  await logAudit({
    userId: user.id,
    action: 'GUEST_CREATE',
    entityType: 'Guest',
    entityId: guest.id,
    payload: body
  })

  broadcast('guest:created', guest)

  return guest
})
