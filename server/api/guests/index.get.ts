import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

const querySchema = z.object({
  q: z.string().optional()
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { q } = await getValidatedQuery(event, querySchema.parse)

  const where = q
    ? {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' as const } },
          { lastName: { contains: q, mode: 'insensitive' as const } },
          { email: { contains: q, mode: 'insensitive' as const } }
        ]
      }
    : {}

  const guests = await prisma.guest.findMany({
    where,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: 50
  })

  return guests
})
