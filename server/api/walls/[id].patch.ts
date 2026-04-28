import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const pointSchema = z.tuple([
  z.number().min(-90).max(90),
  z.number().min(-180).max(180)
])

const schema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#rrggbb attendu)').optional(),
  thickness: z.number().min(1).max(20).optional(),
  points: z.array(pointSchema).min(2, 'Au moins 2 sommets requis').optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const existing = await prisma.wall.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Mur introuvable' })

  const wall = await prisma.wall.update({
    where: { id },
    data: body
  })

  await logAudit({
    userId: user.id,
    action: 'WALL_UPDATE',
    entityType: 'Wall',
    entityId: id,
    payload: body
  })

  broadcast('wall:updated', wall)

  return wall
})
