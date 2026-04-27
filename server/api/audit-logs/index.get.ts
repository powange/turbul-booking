import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { parseDateOnly } from '~~/server/utils/dateRange'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50)
})

export default defineEventHandler(async (event) => {
  await requireRole(event, 'ADMIN')
  const q = await getValidatedQuery(event, querySchema.parse)

  const where: Prisma.AuditLogWhereInput = {}
  if (q.from || q.to) {
    where.createdAt = {}
    if (q.from) (where.createdAt as Prisma.DateTimeFilter).gte = parseDateOnly(q.from)
    if (q.to) {
      // "to" inclusif → on borne au début du jour suivant
      const next = parseDateOnly(q.to)
      next.setUTCDate(next.getUTCDate() + 1)
      ;(where.createdAt as Prisma.DateTimeFilter).lt = next
    }
  }
  if (q.action) where.action = q.action
  if (q.entityType) where.entityType = q.entityType
  if (q.userId) where.userId = q.userId

  const [total, logs] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: q.pageSize,
      skip: (q.page - 1) * q.pageSize
    })
  ])

  return {
    logs,
    total,
    page: q.page,
    pageSize: q.pageSize
  }
})
