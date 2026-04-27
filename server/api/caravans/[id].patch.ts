import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  rotation: z.number().min(0).max(360).optional(),
  width: z.number().positive().max(20).optional(),
  length: z.number().positive().max(30).optional(),
  hasElectricity: z.boolean().optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' })

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  // hasElectricity est éditable par les MANAGER depuis le panneau de
  // consultation. Les autres champs (position, dimensions, nom…) restent
  // réservés aux ADMIN.
  const keys = Object.keys(body)
  const electricityOnly = keys.length === 1 && keys[0] === 'hasElectricity'
  const user = await requireRole(event, electricityOnly ? 'MANAGER' : 'ADMIN')

  const existing = await prisma.caravan.findFirst({ where: { id, deletedAt: null } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Caravane introuvable' })

  const caravan = await prisma.caravan.update({
    where: { id },
    data: body,
    include: { beds: { orderBy: { position: 'asc' } } }
  })

  await logAudit({
    userId: user.id,
    action: 'CARAVAN_UPDATE',
    entityType: 'Caravan',
    entityId: id,
    payload: body
  })

  broadcast('caravan:updated', caravan)

  return caravan
})
