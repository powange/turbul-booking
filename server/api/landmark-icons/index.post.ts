import { prisma } from '~~/server/utils/db'
import { requireRole } from '~~/server/utils/session'
import { logAudit } from '~~/server/utils/audit'
import { broadcast } from '~~/server/utils/realtime'
import { sanitizeSvg } from '~~/server/utils/svgSanitize'

const MAX_SIZE = 256 * 1024 // 256 KB
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

// Upload d'une icône (multipart). Champs attendus :
//   - file : binaire PNG ou SVG (≤ 256 KB)
//   - name : libellé d'affichage de l'icône
// Le format est déduit du content-type du fichier ; les SVG sont sanitisés
// avant insertion (whitelist stricte, fill/stroke → currentColor).
export default defineEventHandler(async (event) => {
  const user = await requireRole(event, 'ADMIN')

  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Multipart attendu' })

  const filePart = parts.find(p => p.name === 'file')
  const namePart = parts.find(p => p.name === 'name')
  if (!filePart || !filePart.data || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: 'Fichier manquant' })
  }
  const name = namePart?.data ? namePart.data.toString('utf8').trim() : ''
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Nom manquant' })
  if (name.length > 80) throw createError({ statusCode: 400, statusMessage: 'Nom trop long (max 80)' })

  if (filePart.data.length > MAX_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'Fichier trop volumineux (max 256 KB)' })
  }

  const declaredType = (filePart.type ?? '').toLowerCase()
  let format: 'png' | 'svg'
  let mimeType: string
  let storedData: Buffer

  if (declaredType === 'image/svg+xml' || filePart.filename.toLowerCase().endsWith('.svg')) {
    format = 'svg'
    mimeType = 'image/svg+xml'
    let raw: string
    try {
      raw = filePart.data.toString('utf8')
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'SVG illisible (UTF-8 attendu)' })
    }
    let cleaned: string
    try {
      cleaned = sanitizeSvg(raw)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SVG invalide'
      throw createError({ statusCode: 400, statusMessage: `SVG refusé : ${msg}` })
    }
    storedData = Buffer.from(cleaned, 'utf8')
  } else if (declaredType === 'image/png' || filePart.filename.toLowerCase().endsWith('.png')) {
    format = 'png'
    mimeType = 'image/png'
    if (filePart.data.length < PNG_MAGIC.length || !filePart.data.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
      throw createError({ statusCode: 400, statusMessage: 'PNG invalide (signature manquante)' })
    }
    storedData = filePart.data
  } else {
    throw createError({ statusCode: 415, statusMessage: 'Format non supporté (PNG ou SVG attendu)' })
  }

  const icon = await prisma.landmarkIcon.create({
    data: {
      name,
      format,
      mimeType,
      data: storedData,
      sizeBytes: storedData.length,
      createdById: user.id
    },
    select: {
      id: true,
      name: true,
      format: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      updatedAt: true,
      createdById: true
    }
  })

  await logAudit({
    userId: user.id,
    action: 'LANDMARK_ICON_CREATE',
    entityType: 'LandmarkIcon',
    entityId: icon.id,
    payload: { name, format, sizeBytes: icon.sizeBytes }
  })

  broadcast('landmarkIcon:created', icon)

  return icon
})
