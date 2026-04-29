import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireUser(event)

  const landmarks = await prisma.landmark.findMany({
    orderBy: { createdAt: 'asc' }
  })

  return landmarks
})
