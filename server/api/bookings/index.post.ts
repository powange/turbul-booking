import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'
import { nightsInRange, parseDateOnly } from '~~/server/utils/dateRange'

const guestInputSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal(''))
})

const schema = z.object({
  bedId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestId: z.string().min(1).optional(),
  guest: guestInputSchema.optional()
}).refine(d => d.guestId || d.guest, { message: 'guestId ou guest requis' })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const body = await readValidatedBody(event, schema.parse)

  const nights = nightsInRange(body.from, body.to)
  if (nights.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Plage de dates invalide (la date de fin doit être après la date de début).' })
  }
  if (nights.length > 365) {
    throw createError({ statusCode: 400, statusMessage: 'Plage de dates trop longue (max 365 nuits).' })
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Vérifier que le lit existe et que sa caravane est active
    const bed = await tx.bed.findUnique({
      where: { id: body.bedId },
      include: { caravan: true }
    })
    if (!bed) throw createError({ statusCode: 404, statusMessage: 'Lit introuvable' })
    if (bed.caravan.deletedAt) throw createError({ statusCode: 400, statusMessage: 'Caravane retirée du plan.' })

    // 2. Récupérer ou créer l'hôte
    let guestId = body.guestId
    let guestCreated = false
    if (!guestId && body.guest) {
      const newGuest = await tx.guest.create({
        data: {
          firstName: body.guest.firstName.trim(),
          lastName: body.guest.lastName.trim(),
          email: body.guest.email?.trim() || null,
          phone: body.guest.phone?.trim() || null
        }
      })
      guestId = newGuest.id
      guestCreated = true
    }

    // 3. Vérifier la capacité pour chaque nuit
    const occupancy = await tx.booking.groupBy({
      by: ['date'],
      where: {
        bedId: body.bedId,
        date: { gte: parseDateOnly(body.from), lt: parseDateOnly(body.to) }
      },
      _count: { _all: true }
    })
    const occupancyByDate = new Map(
      occupancy.map(o => [o.date.toISOString().slice(0, 10), o._count._all])
    )
    for (const night of nights) {
      const key = night.toISOString().slice(0, 10)
      const current = occupancyByDate.get(key) ?? 0
      if (current >= bed.capacity) {
        throw createError({
          statusCode: 409,
          statusMessage: `Lit complet pour la nuit du ${key} (capacité ${bed.capacity}).`
        })
      }
    }

    // 4. Créer les bookings (un par nuit)
    const created: Array<Awaited<ReturnType<typeof tx.booking.create>>> = []
    for (const night of nights) {
      try {
        const b = await tx.booking.create({
          data: {
            bedId: body.bedId,
            guestId: guestId!,
            date: night,
            createdById: user.id
          },
          include: { guest: true }
        })
        created.push(b)
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw createError({
            statusCode: 409,
            statusMessage: `Cet hôte est déjà attribué à ce lit pour la nuit du ${night.toISOString().slice(0, 10)}.`
          })
        }
        throw err
      }
    }

    return { created, guestId: guestId!, guestCreated }
  })

  await logAudit({
    userId: user.id,
    action: 'BOOKING_CREATE',
    entityType: 'Booking',
    payload: { bedId: body.bedId, guestId: result.guestId, from: body.from, to: body.to, nights: nights.length }
  })

  for (const b of result.created) {
    broadcast('booking:created', b)
  }
  if (result.guestCreated) {
    const g = await prisma.guest.findUnique({ where: { id: result.guestId } })
    if (g) broadcast('guest:created', g)
  }

  return result.created
})
