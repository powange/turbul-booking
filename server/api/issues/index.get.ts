import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

// Liste exhaustive des issues — volume attendu faible (qq dizaines max
// même sur la durée), pas de fenêtre temporelle ni de pagination pour
// l'instant. Tri : ouvertes en haut (plus récentes d'abord), puis
// résolues (plus récemment résolues d'abord).
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const items = await prisma.caravanIssue.findMany({
    orderBy: [
      { resolvedAt: { sort: 'asc', nulls: 'first' } },
      { createdAt: 'desc' }
    ]
  })
  return items.map(i => ({
    ...i,
    createdAt: i.createdAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null
  }))
})
