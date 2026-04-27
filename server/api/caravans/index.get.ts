import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

// Liste toutes les caravanes actives (non soft-deleted) avec leurs lits.
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const caravans = await prisma.caravan.findMany({
    where: { deletedAt: null },
    include: {
      beds: { orderBy: { position: 'asc' } }
    },
    orderBy: { createdAt: 'asc' }
  })

  return caravans
})
