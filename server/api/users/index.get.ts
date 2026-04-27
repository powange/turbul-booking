import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
  })

  return users
})
