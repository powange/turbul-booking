import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'

const SECTIONS = ['caravans', 'zones', 'beds', 'guests', 'bookings', 'unavailabilities'] as const

const caravanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  rotation: z.number(),
  width: z.number().positive(),
  length: z.number().positive(),
  hasElectricity: z.boolean()
})

const zoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  points: z.array(z.tuple([z.number(), z.number()])).min(3)
})

const bedSchema = z.object({
  id: z.string().min(1),
  caravanId: z.string().min(1),
  label: z.string().min(1),
  capacity: z.number().int().min(1).max(3),
  position: z.number().int().default(0),
  hasCleanLinen: z.boolean().default(false)
})

const guestSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional()
})

const bookingSchema = z.object({
  id: z.string().min(1),
  bedId: z.string().min(1),
  guestId: z.string().min(1),
  date: z.string().min(1),
  createdById: z.string().optional()
})

const unavailabilitySchema = z.object({
  id: z.string().min(1),
  caravanId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().nullable().optional(),
  createdById: z.string().optional()
})

const bodySchema = z.object({
  sections: z.array(z.enum(SECTIONS)).min(1),
  data: z.object({
    caravans: z.array(caravanSchema).optional(),
    zones: z.array(zoneSchema).optional(),
    beds: z.array(bedSchema).optional(),
    guests: z.array(guestSchema).optional(),
    bookings: z.array(bookingSchema).optional(),
    unavailabilities: z.array(unavailabilitySchema).optional()
  })
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')
  const body = await readValidatedBody(event, bodySchema.parse)
  const sectionsSet = new Set(body.sections)

  // Pour les bookings, on remappe createdById vers l'utilisateur courant si
  // l'ID original n'existe pas dans la base de destination (cas typique de
  // l'import sur un nouveau serveur).
  let validUserIds: Set<string> | null = null
  const needsUserLookup = (sectionsSet.has('bookings') && body.data.bookings?.length)
    || (sectionsSet.has('unavailabilities') && body.data.unavailabilities?.length)
  if (needsUserLookup) {
    const users = await prisma.user.findMany({ select: { id: true } })
    validUserIds = new Set(users.map(u => u.id))
  }

  await prisma.$transaction(async (tx) => {
    // Suppression dans l'ordre des dépendances (FK)
    if (sectionsSet.has('bookings')) await tx.booking.deleteMany()
    if (sectionsSet.has('unavailabilities')) await tx.caravanUnavailability.deleteMany()
    if (sectionsSet.has('beds')) await tx.bed.deleteMany()
    if (sectionsSet.has('caravans')) await tx.caravan.deleteMany()
    if (sectionsSet.has('guests')) await tx.guest.deleteMany()
    if (sectionsSet.has('zones')) await tx.zone.deleteMany()

    // Création dans l'ordre inverse
    if (sectionsSet.has('caravans') && body.data.caravans?.length) {
      await tx.caravan.createMany({ data: body.data.caravans })
    }
    if (sectionsSet.has('zones') && body.data.zones?.length) {
      await tx.zone.createMany({
        data: body.data.zones.map(z => ({
          id: z.id,
          name: z.name,
          color: z.color,
          points: z.points
        }))
      })
    }
    if (sectionsSet.has('guests') && body.data.guests?.length) {
      await tx.guest.createMany({
        data: body.data.guests.map(g => ({
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          email: g.email ?? null,
          phone: g.phone ?? null
        }))
      })
    }
    if (sectionsSet.has('beds') && body.data.beds?.length) {
      await tx.bed.createMany({ data: body.data.beds })
    }
    if (sectionsSet.has('bookings') && body.data.bookings?.length) {
      await tx.booking.createMany({
        data: body.data.bookings.map(b => ({
          id: b.id,
          bedId: b.bedId,
          guestId: b.guestId,
          date: new Date(b.date),
          createdById: b.createdById && validUserIds!.has(b.createdById)
            ? b.createdById
            : user.id
        }))
      })
    }
    if (sectionsSet.has('unavailabilities') && body.data.unavailabilities?.length) {
      await tx.caravanUnavailability.createMany({
        data: body.data.unavailabilities.map(u => ({
          id: u.id,
          caravanId: u.caravanId,
          from: new Date(u.from),
          to: new Date(u.to),
          reason: u.reason ?? null,
          createdById: u.createdById && validUserIds!.has(u.createdById)
            ? u.createdById
            : user.id
        }))
      })
    }
  })

  await logAudit({
    userId: user.id,
    action: 'IMPORT',
    entityType: 'Backup',
    payload: {
      sections: body.sections,
      counts: Object.fromEntries(
        body.sections.map(s => [s, body.data[s]?.length ?? 0])
      )
    }
  })

  return { success: true }
})
