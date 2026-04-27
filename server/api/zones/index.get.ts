import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const zones = await prisma.zone.findMany({
    orderBy: { createdAt: 'asc' }
  })

  return zones
})
