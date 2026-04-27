import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  label: z.string().min(1).max(60).optional(),
  capacity: z.number().int().min(1).max(3).optional(),
  position: z.number().int().min(0).optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const bed = await prisma.bed.update({
    where: { id },
    data: body
  })

  await logAudit({
    userId: user.id,
    action: 'BED_UPDATE',
    entityType: 'Bed',
    entityId: id,
    payload: body
  })

  broadcast('bed:updated', bed)

  return bed
})
