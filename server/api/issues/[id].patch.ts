import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

// Le PATCH gère deux usages : modifier le label, et toggler la résolution.
// `resolved: true` → marque résolu (sauf si déjà résolu, no-op).
// `resolved: false` → réouvre (sauf si déjà ouvert, no-op).
const schema = z.object({
  label: z.string().min(1).optional(),
  resolved: z.boolean().optional()
}).refine(d => Object.keys(d).length > 0, { message: 'Aucun champ à mettre à jour' })

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const existing = await prisma.caravanIssue.findUnique({ where: { id } })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Item introuvable' })

  const data: { label?: string, resolvedAt?: Date | null, resolvedById?: string | null } = {}
  if (body.label !== undefined) data.label = body.label.trim()
  if (body.resolved !== undefined) {
    if (body.resolved) {
      // Marquer résolu — on n'écrase pas une résolution déjà existante.
      if (!existing.resolvedAt) {
        data.resolvedAt = new Date()
        data.resolvedById = user.id
      }
    } else {
      // Réouvrir
      data.resolvedAt = null
      data.resolvedById = null
    }
  }

  const updated = await prisma.caravanIssue.update({ where: { id }, data })

  await logAudit({
    userId: user.id,
    action: body.resolved === true
      ? 'ISSUE_RESOLVE'
      : body.resolved === false ? 'ISSUE_REOPEN' : 'ISSUE_UPDATE',
    entityType: 'CaravanIssue',
    entityId: id,
    payload: { caravanId: updated.caravanId, ...body }
  })

  const payload = {
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    resolvedAt: updated.resolvedAt?.toISOString() ?? null
  }

  broadcast('issue:updated', payload)

  return payload
})
