import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { parseDateOnly } from '~~/server/utils/dateRange'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

// Liste les réservations dans [from, to) avec les infos hôte associées.
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { from, to } = await getValidatedQuery(event, querySchema.parse)

  const bookings = await prisma.booking.findMany({
    where: {
      date: {
        gte: parseDateOnly(from),
        lt: parseDateOnly(to)
      }
    },
    include: { guest: true },
    orderBy: [{ date: 'asc' }, { bedId: 'asc' }]
  })

  return bookings
})
