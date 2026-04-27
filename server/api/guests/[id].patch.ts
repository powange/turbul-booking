import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().max(40).nullable().optional().or(z.literal(''))
}).refine(d => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const data: Record<string, unknown> = {}
  if (body.firstName !== undefined) data.firstName = body.firstName.trim()
  if (body.lastName !== undefined) data.lastName = body.lastName.trim()
  if (body.email !== undefined) data.email = (body.email || null) && body.email!.trim() || null
  if (body.phone !== undefined) data.phone = (body.phone || null) && body.phone!.trim() || null

  const guest = await prisma.guest.update({ where: { id }, data })

  await logAudit({
    userId: user.id,
    action: 'GUEST_UPDATE',
    entityType: 'Guest',
    entityId: id,
    payload: body
  })

  broadcast('guest:updated', guest)

  return guest
})
