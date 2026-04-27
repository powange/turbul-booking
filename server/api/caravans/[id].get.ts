import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const caravan = await prisma.caravan.findFirst({
    where: { id, deletedAt: null },
    include: { beds: { orderBy: { position: 'asc' } } }
  })

  if (!caravan) throw createError({ statusCode: 404, statusMessage: 'Caravane introuvable' })

  return caravan
})
