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
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#rrggbb attendu)'),
  thickness: z.number().min(1).max(20),
  points: z.array(pointSchema).min(2, 'Au moins 2 sommets requis')
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const body = await readValidatedBody(event, schema.parse)

  const wall = await prisma.wall.create({
    data: {
      color: body.color,
      thickness: body.thickness,
      points: body.points
    }
  })

  await logAudit({
    userId: user.id,
    action: 'WALL_CREATE',
    entityType: 'Wall',
    entityId: wall.id,
    payload: body
  })

  broadcast('wall:created', wall)

  return wall
})
