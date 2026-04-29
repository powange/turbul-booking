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
  }

  function detach() {
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
