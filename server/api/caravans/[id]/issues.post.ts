import { z } from 'zod'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

const schema = z.object({
  label: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'MANAGER')
  const caravanId = getRouterParam(event, 'id')
  if (!caravanId) throw createError({ statusCode: 400, statusMessage: 'id caravane manquant' })

  const body = await readValidatedBody(event, schema.parse)

  const caravan = await prisma.caravan.findFirst({ where: { id: caravanId, deletedAt: null } })
  if (!caravan) throw createError({ statusCode: 404, statusMessage: 'Caravane introuvable' })

  const created = await prisma.caravanIssue.create({
    data: {
      caravanId,
      label: body.label.trim(),
      createdById: user.id
    }
  })

  await logAudit({
    userId: user.id,
    action: 'ISSUE_CREATE',
    entityType: 'CaravanIssue',
    entityId: created.id,
    payload: { caravanId, label: created.label }
  })

  const payload = {
    ...created,
    createdAt: created.createdAt.toISOString(),
    resolvedAt: created.resolvedAt?.toISOString() ?? null
  }

  broadcast('issue:created', payload)

  return payload
})
