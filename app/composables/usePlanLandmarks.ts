import L from 'leaflet'
import type { Ref } from 'vue'
import type { Landmark, LandmarkIcon } from '~~/shared/types'

export interface UsePlanLandmarksOptions {
  landmarks: Ref<Landmark[]>
  icons: Ref<LandmarkIcon[]>
  selectedLandmarkId: Ref<string | null>
  canEdit: Ref<boolean>
  onSelect: (id: string | null) => void
  onMove: (id: string, lat: number, lng: number) => void
}

// Cache module-level des SVG déjà téléchargés (en string) — évite de
// re-fetch à chaque rerender. Clé = iconId. Pour les PNG, on ne pré-charge
// rien : on utilise une <img> avec l'URL.
const svgCache = new Map<string, string>()

/**
 * Normalise un SVG inliné pour qu'il se redimensionne à la taille de son
 * conteneur :
 *   - retire `width`/`height` du tag racine `<svg>` (sinon le SVG impose
 *     sa taille intrinsèque même si le conteneur fixe une autre dimension) ;
 *   - synthétise un `viewBox` à partir des width/height d'origine s'il
 *     n'y en a pas (sinon les coords internes restent en pixels absolus).
 *
 * Cette normalisation est aussi faite à l'upload (cf. svgSanitize), mais
 * la dupliquer côté client rend l'affichage robuste pour les icônes
 * uploadées avant ce fix.
 */
function normalizeSvgForInline(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/i, (_, rawAttrs: string) => {
    const widthMatch = /\bwidth\s*=\s*"([^"]+)"/i.exec(rawAttrs)
    const heightMatch = /\bheight\s*=\s*"([^"]+)"/i.exec(rawAttrs)
    const hasViewBox = /\bviewBox\s*=/i.test(rawAttrs)
    const hasFill = /\bfill\s*=/i.test(rawAttrs)

    let attrs = rawAttrs
      .replace(/\s+width\s*=\s*"[^"]*"/i, '')
      .replace(/\s+height\s*=\s*"[^"]*"/i, '')

    if (!hasViewBox && widthMatch && heightMatch) {
      const w = Number.parseFloat(widthMatch[1]!)
      const h = Number.parseFloat(heightMatch[1]!)
      if (Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
        attrs += ` viewBox="0 0 ${w} ${h}"`
      }
    }
    // `fill` est hérité par les enfants. Forcer `currentColor` sur la
    // racine colore les <path>/<circle> sans fill explicite (qui sinon
    // restent noirs, indépendamment de `color` CSS).
    if (!hasFill) {
      attrs += ` fill="currentColor"`
    }
    return `<svg${attrs}>`
  })
}

async function fetchSvgInline(iconId: string): Promise<string> {
  if (svgCache.has(iconId)) return svgCache.get(iconId)!
  const txt = await $fetch<string>(`/api/landmark-icons/${iconId}/file`, {
    responseType: 'text'
  })
  const normalized = normalizeSvgForInline(txt)
  svgCache.set(iconId, normalized)
  return normalized
}

const DEFAULT_COLOR = '#1f2937'

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function buildHtml(svgInline: string | null, icon: LandmarkIcon, lm: Landmark, selected: boolean): string {
  const size = Math.max(8, Math.min(256, lm.sizePx ?? 32))
  const color = lm.color ?? DEFAULT_COLOR
  const ringClass = selected ? 'landmark-pin landmark-pin--selected' : 'landmark-pin'
  if (icon.format === 'svg' && svgInline) {
    // SVG inliné : `color` CSS héritée par les `currentColor` du SVG.
    return `<div class="${ringClass}" style="width:${size}px;height:${size}px;color:${escapeAttr(color)}">${svgInline}</div>`
  }
  // PNG : <img> avec source authentifiée. Pas de color (ignoré pour PNG).
  return `<div class="${ringClass}" style="width:${size}px;height:${size}px"><img src="/api/landmark-icons/${encodeURIComponent(icon.id)}/file" alt="" draggable="false" style="width:100%;height:100%;display:block;pointer-events:none" /></div>`
}

/**
 * Couche points de repère : un L.Marker par repère, icône configurable
 * (PNG ou SVG inliné, taille en pixels). Les SVG sont colorisés via la
 * propriété CSS `color` (les `fill`/`stroke` ont été remplacés par
 * `currentColor` à l'upload).
 *
 * Comme pour les caravanes, le marker est draggable en mode édition ;
 * cliquer dessus émet `onSelect`.
 */
export function usePlanLandmarks(opts: UsePlanLandmarksOptions) {
  let map: L.Map | null = null
  const markers = new Map<string, L.Marker>()

  function iconFor(lm: Landmark): LandmarkIcon | undefined {
    return opts.icons.value.find(i => i.id === lm.iconId)
  }

  function makeDivIcon(html: string, sizePx: number): L.DivIcon {
    return L.divIcon({
      className: 'landmark-marker',
      html,
      iconSize: [sizePx, sizePx],
      iconAnchor: [sizePx / 2, sizePx / 2]
    })
  }

  async function syncLandmark(lm: Landmark) {
    if (!map) return
    const icon = iconFor(lm)
    if (!icon) return // métadonnées d'icône pas encore chargées
    const selected = opts.selectedLandmarkId.value === lm.id

    let svgInline: string | null = null
    if (icon.format === 'svg') {
      try {
        svgInline = await fetchSvgInline(icon.id)
      } catch {
        svgInline = null // fallback : div vide, on retentera au prochain sync
      }
      if (!map) return // démontage pendant le fetch
    }

    const html = buildHtml(svgInline, icon, lm, selected)
    const sizePx = Math.max(8, Math.min(256, lm.sizePx ?? 32))
    const divIcon = makeDivIcon(html, sizePx)

    const existing = markers.get(lm.id)
    if (existing) {
      existing.setLatLng([lm.lat, lm.lng])
      existing.setIcon(divIcon)
      existing.dragging?.[opts.canEdit.value ? 'enable' : 'disable']()
    } else {
      const marker = L.marker([lm.lat, lm.lng], {
        draggable: opts.canEdit.value,
        icon: divIcon,
        autoPan: true
      })
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        // Hors mode édition, le repère est purement décoratif : pas de
        // sélection, pas de panneau. Même comportement que zones / murs.
        if (!opts.canEdit.value) return
        opts.onSelect(lm.id)
      })
      marker.on('dragend', () => {
        const ll = marker.getLatLng()
        opts.onMove(lm.id, ll.lat, ll.lng)
      })
      marker.addTo(map)
      markers.set(lm.id, marker)
    }
  }

  function removeLandmark(id: string) {
    const m = markers.get(id)
    if (m) {
      m.remove()
      markers.delete(id)
    }
  }

  function diffSync(list: Landmark[]) {
    if (!map) return
    const newIds = new Set(list.map(l => l.id))
    for (const id of [...markers.keys()]) {
      if (!newIds.has(id)) removeLandmark(id)
    }
    for (const lm of list) void syncLandmark(lm)
  }

  function attach(m: L.Map) {
    map = m
    diffSync(opts.landmarks.value)
  }

  function detach() {
    markers.forEach(m => m.remove())
    markers.clear()
    map = null
  }

  watch(opts.landmarks, list => diffSync(list), { deep: true })
  watch(opts.icons, () => {
    if (!map) return
    // Resync au cas où une icône utilisée vient d'être chargée (1er load
    // ou nouvelle icône remplaçant une référence cassée).
    for (const lm of opts.landmarks.value) void syncLandmark(lm)
  }, { deep: true })
  watch(opts.selectedLandmarkId, () => {
    if (!map) return
    for (const lm of opts.landmarks.value) void syncLandmark(lm)
  })
  // Toggle du mode édition : on resynchronise les markers pour que le drag
  // soit activé/désactivé. (Sans ce watch, un marker créé hors édition
  // resterait non-draggable même après activation du mode.)
  watch(opts.canEdit, () => {
    if (!map) return
    for (const lm of opts.landmarks.value) void syncLandmark(lm)
  })

  return { attach, detach }
}
