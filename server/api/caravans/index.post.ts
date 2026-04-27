import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  name: z.string().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  rotation: z.number().min(0).max(360).default(0),
  width: z.number().positive().max(20).default(2.5),
  length: z.number().positive().max(30).default(6),
  hasElectricity: z.boolean().default(false)
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const body = await readValidatedBody(event, schema.parse)

  const caravan = await prisma.caravan.create({
    data: body,
    include: { beds: true }
  })

  await logAudit({
    userId: user.id,
    action: 'CARAVAN_CREATE',
    entityType: 'Caravan',
    entityId: caravan.id,
    payload: body
  })

  broadcast('caravan:created', caravan)

  return caravan
})
