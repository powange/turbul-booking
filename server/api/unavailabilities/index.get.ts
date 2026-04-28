import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'
import { parseDateOnly } from '~~/server/utils/dateRange'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

// Liste les indispos qui chevauchent la fenêtre [from, to) demandée.
// Une indispo chevauche si : indispo.from < to ET indispo.to > from.
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const { from, to } = await getValidatedQuery(event, querySchema.parse)

  const items = await prisma.caravanUnavailability.findMany({
    where: {
      from: { lt: parseDateOnly(to) },
      to: { gt: parseDateOnly(from) }
    },
    orderBy: [{ from: 'asc' }, { caravanId: 'asc' }]
  })

  return items.map(u => ({
    ...u,
    from: u.from.toISOString().slice(0, 10),
    to: u.to.toISOString().slice(0, 10),
    createdAt: u.createdAt.toISOString()
  }))
})
