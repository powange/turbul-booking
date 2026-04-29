import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  iconId: z.string().min(1).optional(),
  sizePx: z.number().int().min(8).max(256).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#rrggbb attendu)').nullable().optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const existing = await prisma.landmark.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Repère introuvable' })

  if (body.iconId && body.iconId !== existing.iconId) {
    const icon = await prisma.landmarkIcon.findUnique({ where: { id: body.iconId }, select: { id: true } })
    if (!icon) throw createError({ statusCode: 400, statusMessage: 'Icône introuvable' })
  }

  const landmark = await prisma.landmark.update({
    where: { id },
    data: body
  })

  await logAudit({
    userId: user.id,
    action: 'LANDMARK_UPDATE',
    entityType: 'Landmark',
    entityId: id,
    payload: body
  })

  broadcast('landmark:updated', landmark)

  return landmark
})
