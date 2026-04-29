import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')

  const result = await prisma.printFrame.deleteMany({})

  await logAudit({
    userId: user.id,
    action: 'PRINT_FRAME_DELETE',
    entityType: 'PrintFrame',
    payload: { deletedCount: result.count }
  })

  broadcast('printFrame:deleted', null)

  return { success: true, deletedCount: result.count }
})
