import { Prisma } from '@prisma/client'
import { createError } from 'h3'
import { nightsInRange, parseDateOnly } from '~~/server/utils/dateRange'

export interface CreateBookingsInput {
  bedId: string
  from: string // 'YYYY-MM-DD'
  to: string // 'YYYY-MM-DD' (exclusif)
  guestId?: string
  guest?: {
    firstName: string
    lastName: string
    email?: string
    phone?: string
  }
}

export interface CreateBookingsResult {
  created: Awaited<ReturnType<Prisma.TransactionClient['booking']['create']>>[]
  guestId: string
  guestCreated: boolean
}

/**
 * Crée une série de réservations (une par nuit) dans une transaction Prisma.
 *
 * Vérifie séquentiellement :
 *  1. lit existant + caravane non soft-deleted
 *  2. aucune `CaravanUnavailability` ne chevauche la période
 *  3. capacité du lit non dépassée pour chaque nuit (en comptant les bookings
 *     déjà existants)
 *  4. unicité (bed, date, guest) — contrainte SQL `P2002` traduite en 409
 *
 * Toute erreur fait rollback la transaction. Le caller (handler HTTP ou tests)
 * fournit le `tx`, le body validé et l'`userId` du créateur.
 */
export async function createBookings(
  tx: Prisma.TransactionClient,
  body: CreateBookingsInput,
  userId: string
): Promise<CreateBookingsResult> {
  const nights = nightsInRange(body.from, body.to)
  if (nights.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Plage de dates invalide (la date de fin doit être après la date de début).'
    })
  }
  if (nights.length > 365) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Plage de dates trop longue (max 365 nuits).'
    })
  }

  // 1. Vérifier que le lit existe et que sa caravane est active
  const bed = await tx.bed.findUnique({
    where: { id: body.bedId },
    include: { caravan: true }
  })
  if (!bed) throw createError({ statusCode: 404, statusMessage: 'Lit introuvable' })
  if (bed.caravan.deletedAt) {
    throw createError({ statusCode: 400, statusMessage: 'Caravane retirée du plan.' })
  }

  // 2. Vérifier qu'aucune indisponibilité de la caravane ne chevauche.
  //    Règle d'overlap : indispo.from < to ET indispo.to > from.
  const blocking = await tx.caravanUnavailability.findFirst({
    where: {
      caravanId: bed.caravanId,
      from: { lt: parseDateOnly(body.to) },
      to: { gt: parseDateOnly(body.from) }
    }
  })
  if (blocking) {
    const fromStr = blocking.from.toISOString().slice(0, 10)
    const toStr = blocking.to.toISOString().slice(0, 10)
    throw createError({
      statusCode: 409,
      statusMessage: `Caravane indisponible du ${fromStr} au ${toStr}${blocking.reason ? ` (${blocking.reason})` : ''}.`
    })
  }

  // 3. Récupérer ou créer l'hôte
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
  if (!guestId) {
    throw createError({ statusCode: 400, statusMessage: 'guestId ou guest requis' })
  }

  // 4. Vérifier la capacité pour chaque nuit (compte des bookings existants)
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

  // 5. Créer les bookings (un par nuit). P2002 = duplication (bed,date,guest).
  const created: CreateBookingsResult['created'] = []
  for (const night of nights) {
    try {
      const b = await tx.booking.create({
        data: {
          bedId: body.bedId,
          guestId,
          date: night,
          createdById: userId
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

  return { created, guestId, guestCreated }
}
