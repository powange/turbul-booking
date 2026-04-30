import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free' // augmente Leaflet avec `layer.pm.*`
import type { Ref } from 'vue'
import type { Zone } from '~~/shared/types'
import { escapeHtml, latLngsToPoints, pointsToLatLngs } from '~/utils/leafletGeo'

export interface UsePlanZonesOptions {
  zones: Ref<Zone[]>
  selectedZoneId: Ref<string | null>
  zoneDrawMode: Ref<boolean>
  draftZoneColor: Ref<string | undefined>
  canEdit: Ref<boolean>
  onSelectZone: (id: string | null) => void
  onZoneCreated: (points: Array<[number, number]>) => void
  onZoneEdited: (id: string, points: Array<[number, number]>) => void
}

/**
 * Couche zones décoratives — polygones libres dessinés via Geoman, avec
 * label centré. La zone sélectionnée passe en mode édition Geoman
 * (poignées de sommets, drag), et son `pm:edit`/`pm:dragend` émet la
 * nouvelle géométrie au parent.
 *
 * Panes : les polygones de zone sont placés dans `tilePane` (z-index 200)
 * — en-dessous de l'overlay (400) où vivent caravanes et murs. L'historique
 * voulait éviter les panes custom pour compatibilité leaflet-rotate ; on a
 * abandonné ce plugin mais l'organisation des panes reste valide.
 */
export function usePlanZones(opts: UsePlanZonesOptions) {
  let map: L.Map | null = null
  const zonePolygons = new Map<string, L.Polygon>()
  let editingZoneId: string | null = null

  function zoneStyle(z: Zone) {
    return {
      color: z.color,
      weight: 2,
      fillColor: z.color,
      fillOpacity: z.filled ? 0.25 : 0
    }
  }

  function enableGeomanEdit(id: string) {
    const target = zonePolygons.get(id)
    if (!target) return
    target.pm.enable({
      allowSelfIntersection: false,
      snappable: false,
      draggable: true
    })
    const onUpdate = () => {
      opts.onZoneEdited(id, latLngsToPoints(target))
    }
    target.on('pm:edit', onUpdate)
    target.on('pm:dragend', onUpdate)
  }

  // Le contenu est enveloppé dans un span enfant pour pouvoir lui appliquer
  // une transformation CSS (contre-rotation en mode print) sans casser le
  // `translate3d` que Leaflet pose sur l'élément tooltip lui-même.
  function tooltipHtml(name: string): string {
    return `<span class="zone-label-inner">${escapeHtml(name)}</span>`
  }

  function syncZone(z: Zone) {
    if (!map) return
    const existing = zonePolygons.get(z.id)

    // Si le polygone existe ET est en cours d'édition, on garde sa
    // géométrie locale (poignées Geoman) et on ne met à jour que le
    // style/label.
    if (existing && editingZoneId === z.id) {
      existing.setStyle(zoneStyle(z))
      existing.getTooltip()?.setContent(tooltipHtml(z.name))
      return
    }

    const latlngs = pointsToLatLngs(z.points)

    if (existing) {
      existing.setLatLngs(latlngs)
      existing.setStyle(zoneStyle(z))
      existing.getTooltip()?.setContent(tooltipHtml(z.name))
    } else {
      const polygon = L.polygon(latlngs, {
        ...zoneStyle(z),
        pane: 'tilePane',
        interactive: true
      })
      polygon.bindTooltip(tooltipHtml(z.name), {
        permanent: true,
        direction: 'center',
        className: 'zone-label',
        interactive: false
      })
      polygon.on('click', (e) => {
        if (opts.zoneDrawMode.value) return
        L.DomEvent.stopPropagation(e)
        if (opts.canEdit.value) opts.onSelectZone(z.id)
      })
      polygon.addTo(map)
      zonePolygons.set(z.id, polygon)

      // Si la sélection a précédé l'arrivée des données (création WS),
      // on active maintenant l'édition Geoman sur le nouveau polygone.
      if (editingZoneId === z.id) enableGeomanEdit(z.id)
    }
  }

  function removeZone(id: string) {
    const p = zonePolygons.get(id)
    if (!p) return
    p.pm?.disable?.()
    p.unbindTooltip()
    p.remove()
    zonePolygons.delete(id)
    if (editingZoneId === id) editingZoneId = null
  }

  function diffSyncZones(list: Zone[]) {
    if (!map) return
    const newIds = new Set(list.map(z => z.id))
    for (const id of [...zonePolygons.keys()]) {
      if (!newIds.has(id)) removeZone(id)
    }
    for (const z of list) syncZone(z)
    scheduleDeclutter()
  }

  // ============ Decluttering des labels ============
  // Algorithme greedy : trie les zones par taille décroissante (priorité
  // aux grandes), garde la 1re centrée, déplace verticalement les
  // suivantes si leur bbox chevauche une déjà placée.
  // Déclencheurs : après un sync des zones, après zoomend/moveend.
  // L'offset est appliqué en `translateY` sur le `<span class="zone-label-inner">`
  // (transform indépendant du `translate3d` que Leaflet pose sur le tooltip
  // outer pour le positionner au centre du polygone).

  let declutterScheduled = false
  function scheduleDeclutter() {
    if (declutterScheduled) return
    declutterScheduled = true
    requestAnimationFrame(() => {
      declutterScheduled = false
      applyLabelDeclutter()
    })
  }

  function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
    return !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top)
  }

  function shiftRect(r: DOMRect, dy: number): DOMRect {
    return {
      x: r.x,
      y: r.y + dy,
      left: r.left,
      right: r.right,
      top: r.top + dy,
      bottom: r.bottom + dy,
      width: r.width,
      height: r.height,
      toJSON: () => r.toJSON()
    } as DOMRect
  }

  const STEP_PX = 18
  const MAX_TRIES = 10

  function applyLabelDeclutter() {
    if (!map) return
    type Entry = { span: HTMLElement, baseBbox: DOMRect, priority: number }
    const entries: Entry[] = []

    for (const polygon of zonePolygons.values()) {
      const ttEl = polygon.getTooltip()?.getElement()
      if (!ttEl) continue
      const span = ttEl.querySelector('.zone-label-inner') as HTMLElement | null
      if (!span) continue
      // Reset l'offset précédent avant de mesurer (via la custom property
      // `--declutter-y` pour ne PAS conflicter avec la CSS print qui
      // pose un `transform: rotate(...)` sur ce même span).
      span.style.setProperty('--declutter-y', '0px')

      // Priorité = aire de la bbox du polygone en pixels écran. Les
      // grandes zones gardent leur label centré ; les petites cèdent.
      const bounds = polygon.getBounds()
      const sw = map.latLngToContainerPoint(bounds.getSouthWest())
      const ne = map.latLngToContainerPoint(bounds.getNorthEast())
      const priority = Math.abs((ne.x - sw.x) * (ne.y - sw.y))

      // getBoundingClientRect après reset = position centrée native
      const baseBbox = span.getBoundingClientRect()
      // Skip les labels invisibles (hors viewport, span vide, etc.)
      if (baseBbox.width === 0 || baseBbox.height === 0) continue
      entries.push({ span, baseBbox, priority })
    }

    entries.sort((a, b) => b.priority - a.priority)

    const placed: DOMRect[] = []
    for (const e of entries) {
      let bbox = e.baseBbox
      let offsetY = 0
      let tries = 0
      while (tries < MAX_TRIES && placed.some(p => rectsOverlap(p, bbox))) {
        // Alterne ±step pour pousser le label dans la direction la moins
        // encombrée (1: +step, 2: -step, 3: +2step, 4: -2step, ...)
        const sign = tries % 2 === 0 ? 1 : -1
        const magnitude = Math.ceil((tries + 1) / 2) * STEP_PX
        offsetY = sign * magnitude
        bbox = shiftRect(e.baseBbox, offsetY)
        tries++
      }
      if (offsetY !== 0) {
        e.span.style.setProperty('--declutter-y', `${offsetY}px`)
      }
      placed.push(bbox)
    }
  }

  function applyEditMode(id: string | null) {
    if (!map) return
    if (editingZoneId && editingZoneId !== id) {
      const prev = zonePolygons.get(editingZoneId)
      if (prev) {
        prev.pm.disable()
        prev.off('pm:edit')
        prev.off('pm:dragend')
      }
    }
    editingZoneId = id
    if (id) enableGeomanEdit(id)
  }

  function startDraw() {
    if (!map) return
    const color = opts.draftZoneColor.value ?? '#3b82f6'
    map.pm.enableDraw('Polygon', {
      snappable: false,
      pathOptions: { color, fillColor: color, fillOpacity: 0.25, weight: 2 },
      hintlineStyle: { color, dashArray: [5, 5] },
      templineStyle: { color }
    })
  }

  function stopDraw() {
    if (!map) return
    if (map.pm.globalDrawModeEnabled?.()) map.pm.disableDraw()
  }

  function attach(m: L.Map) {
    map = m
    diffSyncZones(opts.zones.value)
    if (opts.zoneDrawMode.value) startDraw()
    if (opts.selectedZoneId.value) applyEditMode(opts.selectedZoneId.value)
    // Re-decluttering au déplacement / zoom (les positions screen des
    // tooltips changent → les collisions changent).
    m.on('zoomend moveend', scheduleDeclutter)
  }

  function detach() {
    map?.off('zoomend moveend', scheduleDeclutter)
    zonePolygons.forEach(p => p.remove())
    zonePolygons.clear()
    editingZoneId = null
    map = null
  }

  watch(opts.zones, list => diffSyncZones(list), { deep: true })
  watch(opts.zoneDrawMode, (mode) => {
    if (mode) startDraw()
    else stopDraw()
  })
  watch(opts.selectedZoneId, id => applyEditMode(id))
  watch(opts.draftZoneColor, () => {
    if (opts.zoneDrawMode.value) {
      stopDraw()
      startDraw()
    }
  })

  return { attach, detach, onPmCreate: opts.onZoneCreated }
}
