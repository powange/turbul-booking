import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'

const SECTIONS = ['caravans', 'zones', 'walls', 'printFrame', 'beds', 'guests', 'bookings', 'unavailabilities', 'caravanIssues'] as const

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

const wallSchema = z.object({
  id: z.string().min(1),
  color: z.string().min(1),
  thickness: z.number().positive(),
  points: z.array(z.tuple([z.number(), z.number()])).min(2)
})

const printFrameSchema = z.object({
  id: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  widthMeters: z.number().positive(),
  rotation: z.number(),
  orientation: z.enum(['landscape', 'portrait'])
})

const caravanIssueSchema = z.object({
  id: z.string().min(1),
  caravanId: z.string().min(1),
  label: z.string().min(1),
  createdAt: z.string().min(1).optional(),
  createdById: z.string().optional(),
  resolvedAt: z.string().nullable().optional(),
  resolvedById: z.string().nullable().optional()
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
    walls: z.array(wallSchema).optional(),
    printFrame: z.array(printFrameSchema).optional(),
    beds: z.array(bedSchema).optional(),
    guests: z.array(guestSchema).optional(),
    bookings: z.array(bookingSchema).optional(),
    unavailabilities: z.array(unavailabilitySchema).optional(),
    caravanIssues: z.array(caravanIssueSchema).optional()
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
    || (sectionsSet.has('caravanIssues') && body.data.caravanIssues?.length)
  if (needsUserLookup) {
    const users = await prisma.user.findMany({ select: { id: true } })
    validUserIds = new Set(users.map(u => u.id))
  }

  await prisma.$transaction(async (tx) => {
    // Suppression dans l'ordre des dépendances (FK)
    if (sectionsSet.has('bookings')) await tx.booking.deleteMany()
    if (sectionsSet.has('unavailabilities')) await tx.caravanUnavailability.deleteMany()
    if (sectionsSet.has('caravanIssues')) await tx.caravanIssue.deleteMany()
    if (sectionsSet.has('beds')) await tx.bed.deleteMany()
    if (sectionsSet.has('caravans')) await tx.caravan.deleteMany()
    if (sectionsSet.has('guests')) await tx.guest.deleteMany()
    if (sectionsSet.has('zones')) await tx.zone.deleteMany()
    if (sectionsSet.has('walls')) await tx.wall.deleteMany()
    if (sectionsSet.has('printFrame')) await tx.printFrame.deleteMany()

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
    if (sectionsSet.has('walls') && body.data.walls?.length) {
      await tx.wall.createMany({
        data: body.data.walls.map(w => ({
          id: w.id,
          color: w.color,
          thickness: w.thickness,
          points: w.points
        }))
      })
    }
    if (sectionsSet.has('printFrame') && body.data.printFrame?.length) {
      // Singleton : on ne garde que la première entrée (deleteMany a déjà tout vidé).
      const pf = body.data.printFrame[0]!
      await tx.printFrame.create({
        data: {
          id: pf.id,
          lat: pf.lat,
          lng: pf.lng,
          widthMeters: pf.widthMeters,
          rotation: pf.rotation,
          orientation: pf.orientation
        }
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
    if (sectionsSet.has('caravanIssues') && body.data.caravanIssues?.length) {
      await tx.caravanIssue.createMany({
        data: body.data.caravanIssues.map(i => ({
          id: i.id,
          caravanId: i.caravanId,
          label: i.label,
          createdAt: i.createdAt ? new Date(i.createdAt) : undefined,
          createdById: i.createdById && validUserIds!.has(i.createdById)
            ? i.createdById
            : user.id,
          resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : null,
          resolvedById: i.resolvedById && validUserIds!.has(i.resolvedById)
            ? i.resolvedById
            : null
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
