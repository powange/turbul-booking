import { prisma } from '~~/server/utils/db'
import { requireUser } from '~~/server/utils/session'

// Sert le contenu binaire d'une icône (PNG ou SVG sanitisé). Cache long
// (immutable) puisqu'un id ne se réutilise pas — pas de payload tampon
// HTTP intermédiaire à invalider.
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id manquant' })

  const icon = await prisma.landmarkIcon.findUnique({
    where: { id },
    select: { mimeType: true, data: true }
  })
  if (!icon) throw createError({ statusCode: 404, statusMessage: 'Icône introuvable' })

  setHeader(event, 'Content-Type', icon.mimeType)
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return icon.data
})
