import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'

const SECTIONS = ['caravans', 'zones', 'beds', 'guests', 'bookings'] as const
type Section = typeof SECTIONS[number]

const querySchema = z.object({
  sections: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const { sections: raw } = await getValidatedQuery(event, querySchema.parse)

  const requested = raw
    .split(',')
    .map(s => s.trim())
    .filter((s): s is Section => (SECTIONS as readonly string[]).includes(s))

  if (requested.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Aucune section valide demandée' })
  }

  const result: Record<string, unknown> = {
    version: 1,
    exportedAt: new Date().toISOString()
  }

  if (requested.includes('caravans')) {
    result.caravans = await prisma.caravan.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, lat: true, lng: true,
        rotation: true, width: true, length: true, hasElectricity: true
      }
    })
  }
  if (requested.includes('zones')) {
    result.zones = await prisma.zone.findMany({
      select: { id: true, name: true, color: true, points: true }
    })
  }
  if (requested.includes('beds')) {
    result.beds = await prisma.bed.findMany({
      select: { id: true, caravanId: true, label: true, capacity: true, position: true }
    })
  }
  if (requested.includes('guests')) {
    result.guests = await prisma.guest.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, phone: true }
    })
  }
  if (requested.includes('bookings')) {
    result.bookings = await prisma.booking.findMany({
      select: { id: true, bedId: true, guestId: true, date: true, createdById: true }
    })
  }

  await logAudit({
    userId: user.id,
    action: 'EXPORT',
    entityType: 'Backup',
    payload: { sections: requested }
  })

  const filename = `turbul-export-${new Date().toISOString().slice(0, 10)}.json`
  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  return result
})
