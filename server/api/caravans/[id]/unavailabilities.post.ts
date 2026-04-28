import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'
import { parseDateOnly } from '~~/server/utils/dateRange'

const schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(200).optional()
}).refine(d => d.to > d.from, {
  message: 'La date de fin doit être postérieure à la date de début (exclusive).',
  path: ['to']
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const caravanId = getRouterParam(event, 'id')
  if (!caravanId) throw createError({ statusCode: 400, statusMessage: 'id caravane manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const caravan = await prisma.caravan.findFirst({ where: { id: caravanId, deletedAt: null } })
  if (!caravan) throw createError({ statusCode: 404, statusMessage: 'Caravane introuvable' })

  const created = await prisma.caravanUnavailability.create({
    data: {
      caravanId,
      from: parseDateOnly(body.from),
      to: parseDateOnly(body.to),
      reason: body.reason?.trim() || null,
      createdById: user.id
    }
  })

  await logAudit({
    userId: user.id,
    action: 'UNAVAILABILITY_CREATE',
    entityType: 'CaravanUnavailability',
    entityId: created.id,
    payload: { caravanId, from: body.from, to: body.to, reason: created.reason }
  })

  // Sérialisation des dates pour le client (format ISO YYYY-MM-DD).
  const payload = {
    ...created,
    from: created.from.toISOString().slice(0, 10),
    to: created.to.toISOString().slice(0, 10),
    createdAt: created.createdAt.toISOString()
  }

  broadcast('unavailability:created', payload)

  return payload
})
