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
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#rrggbb attendu)'),
  points: z.array(pointSchema).min(3, 'Au moins 3 sommets requis')
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const body = await readValidatedBody(event, schema.parse)

  const zone = await prisma.zone.create({
    data: {
      name: body.name,
      color: body.color,
      points: body.points
    }
  })

  await logAudit({
    userId: user.id,
    action: 'ZONE_CREATE',
    entityType: 'Zone',
    entityId: zone.id,
    payload: body
  })

  broadcast('zone:created', zone)

  return zone
})
