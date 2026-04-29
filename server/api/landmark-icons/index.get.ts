import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

// Liste les icônes — retourne uniquement les métadonnées (pas le contenu
// binaire). Le contenu est servi par GET /api/landmark-icons/[id]/file.
export default defineEventHandler(async (event) => {
  await requireUser(event)

  const icons = await prisma.landmarkIcon.findMany({
    select: {
      id: true,
      name: true,
      format: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      updatedAt: true,
      createdById: true
    },
    orderBy: { createdAt: 'asc' }
  })

  return icons
})
