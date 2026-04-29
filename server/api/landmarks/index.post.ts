import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  name: z.string().trim().min(1, 'Nom requis').max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  iconId: z.string().min(1, 'iconId requis'),
  sizePx: z.number().int().min(8).max(256).default(32),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#rrggbb attendu)').nullable().optional()
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const body = await readValidatedBody(event, schema.parse)

  // Vérifie que l'icône existe (sinon Prisma renverrait une erreur cryptique
  // de FK).
  const icon = await prisma.landmarkIcon.findUnique({ where: { id: body.iconId }, select: { id: true } })
  if (!icon) throw createError({ statusCode: 400, statusMessage: 'Icône introuvable' })

  const landmark = await prisma.landmark.create({
    data: {
      name: body.name,
      lat: body.lat,
      lng: body.lng,
      iconId: body.iconId,
      sizePx: body.sizePx,
      color: body.color ?? null
    }
  })

  await logAudit({
    userId: user.id,
    action: 'LANDMARK_CREATE',
    entityType: 'Landmark',
    entityId: landmark.id,
    payload: body
  })

  broadcast('landmark:created', landmark)

  return landmark
})
