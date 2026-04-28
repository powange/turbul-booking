import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const walls = await prisma.wall.findMany({
    orderBy: { createdAt: 'asc' }
  })

  return walls
})
