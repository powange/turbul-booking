import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  label: z.string().min(1).max(60),
  capacity: z.number().int().min(1).max(3)
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const caravanId = getRouterParam(event, 'id')
  if (!caravanId) throw createError({ statusCode: 400, statusMessage: 'id caravane manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const caravan = await prisma.caravan.findFirst({ where: { id: caravanId, deletedAt: null } })
  if (!caravan) throw createError({ statusCode: 404, statusMessage: 'Caravane introuvable' })

  const last = await prisma.bed.findFirst({
    where: { caravanId },
    orderBy: { position: 'desc' }
  })
  const nextPosition = last ? last.position + 1 : 0

  const bed = await prisma.bed.create({
    data: {
      caravanId,
      label: body.label,
      capacity: body.capacity,
      position: nextPosition
    }
  })

  await logAudit({
    userId: user.id,
    action: 'BED_CREATE',
    entityType: 'Bed',
    entityId: bed.id,
    payload: { caravanId, ...body }
  })

  broadcast('bed:created', bed)

  return bed
})
