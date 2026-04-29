import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  widthMeters: z.number().positive().max(10000),
  rotation: z.number().min(0).max(360).default(0),
  orientation: z.enum(['landscape', 'portrait']).default('landscape')
})

// Upsert singleton : crée ou met à jour la seule entrée. Si plusieurs
// entrées existaient (cas pathologique), on supprime les autres.
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const body = await readValidatedBody(event, schema.parse)

  const existing = await prisma.printFrame.findFirst({ orderBy: { updatedAt: 'desc' } })

  let frame
  if (existing) {
    frame = await prisma.printFrame.update({
      where: { id: existing.id },
      data: {
        lat: body.lat,
        lng: body.lng,
        widthMeters: body.widthMeters,
        rotation: body.rotation,
        orientation: body.orientation
      }
    })
    // Sécurité : si jamais d'autres entrées existaient, on les efface
    await prisma.printFrame.deleteMany({ where: { id: { not: existing.id } } })
  } else {
    frame = await prisma.printFrame.create({
      data: {
        lat: body.lat,
        lng: body.lng,
        widthMeters: body.widthMeters,
        rotation: body.rotation,
        orientation: body.orientation
      }
    })
  }

  await logAudit({
    userId: user.id,
    action: existing ? 'PRINT_FRAME_UPDATE' : 'PRINT_FRAME_CREATE',
    entityType: 'PrintFrame',
    entityId: frame.id,
    payload: body
  })

  const payload = {
    ...frame,
    createdAt: frame.createdAt.toISOString(),
    updatedAt: frame.updatedAt.toISOString()
  }

  broadcast('printFrame:updated', payload)

  return payload
})
