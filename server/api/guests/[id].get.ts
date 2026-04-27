import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

// Détail d'un hôte avec son historique complet de nuitées.
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const guest = await prisma.guest.findUnique({
    where: { id },
    include: {
      bookings: {
        include: {
          bed: {
            include: {
              caravan: { select: { id: true, name: true, deletedAt: true } }
            }
          }
        },
        orderBy: { date: 'desc' }
      }
    }
  })

  if (!guest) throw createError({ statusCode: 404, statusMessage: 'Hôte introuvable' })

  return guest
})
