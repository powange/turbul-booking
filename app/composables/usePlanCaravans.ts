import L from 'leaflet'
import type { Ref } from 'vue'
import type { Caravan } from '~~/shared/types'
import { caravanCorners } from '~/utils/geo'
import { escapeHtml } from '~/utils/leafletGeo'
import { PLAN_COLORS, CARAVAN_PIN_CLASSES } from '~/utils/planColors'

export interface UsePlanCaravansOptions {
  caravans: Ref<Caravan[]>
  selectedId: Ref<string | null>
  canEdit: Ref<boolean>
  onSelect: (id: string | null) => void
  onMove: (id: string, lat: number, lng: number) => void
}

/**
 * Couche caravanes du plan : polygones (empreinte au sol) + markers (label
 * cliquable et draggable). La sélection est dérivée de `selectedId` ; le
 * drag du marker met à jour le polygone localement et émet `onMove` au
 * dragend pour persister.
 *
 * Cycle de vie : `attach(map)` au mount du map, `detach()` à l'unmount.
 * Les watches sur les props sont actifs en permanence mais no-op tant que
 * la map n'est pas attachée.
 */
export function usePlanCaravans(opts: UsePlanCaravansOptions) {
  let map: L.Map | null = null
  const polygons = new Map<string, L.Polygon>()
  const markers = new Map<string, L.Marker>()

  function styleFor(c: Caravan, selected: boolean) {
    const palette = selected
      ? PLAN_COLORS.caravan.selected
      : c.hasElectricity
        ? PLAN_COLORS.caravan.powered
        : PLAN_COLORS.caravan.neutral
    return {
      color: palette.stroke,
      weight: selected ? 3 : 2,
      fillColor: palette.fill,
      fillOpacity: 0.45
    }
  }

  function makeIcon(c: Caravan, selected: boolean): L.DivIcon {
    const colorClass = selected
      ? CARAVAN_PIN_CLASSES.selected
      : c.hasElectricity ? CARAVAN_PIN_CLASSES.powered : CARAVAN_PIN_CLASSES.neutral
    return L.divIcon({
      className: 'caravan-marker',
      html: `<div class="caravan-pin ${colorClass}" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    })
  }

  function syncCaravan(c: Caravan) {
    if (!map) return
    const selected = opts.selectedId.value === c.id
    const corners = caravanCorners(c)

    const existingPoly = polygons.get(c.id)
    if (existingPoly) {
      existingPoly.setLatLngs(corners)
      existingPoly.setStyle(styleFor(c, selected))
    } else {
      const polygon = L.polygon(corners, styleFor(c, selected))
      polygon.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        opts.onSelect(c.id)
      })
      polygon.addTo(map)
      polygons.set(c.id, polygon)
    }

    const existingMarker = markers.get(c.id)
    if (existingMarker) {
      existingMarker.setLatLng([c.lat, c.lng])
      existingMarker.setIcon(makeIcon(c, selected))
      existingMarker.dragging?.[opts.canEdit.value ? 'enable' : 'disable']()
    } else {
      const marker = L.marker([c.lat, c.lng], {
        draggable: opts.canEdit.value,
        icon: makeIcon(c, selected),
        autoPan: true
      })
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        opts.onSelect(c.id)
      })
      marker.on('drag', () => {
        const ll = marker.getLatLng()
        const newCorners = caravanCorners({ ...c, lat: ll.lat, lng: ll.lng })
        polygons.get(c.id)?.setLatLngs(newCorners)
      })
      marker.on('dragend', () => {
        const ll = marker.getLatLng()
        opts.onMove(c.id, ll.lat, ll.lng)
      })
      marker.addTo(map)
      markers.set(c.id, marker)
    }
  }

  function removeCaravan(id: string) {
    const p = polygons.get(id)
    if (p) {
      p.remove()
      polygons.delete(id)
    }
    const m = markers.get(id)
    if (m) {
      m.remove()
      markers.delete(id)
    }
  }

  function diffSync(list: Caravan[]) {
    if (!map) return
    const newIds = new Set(list.map(c => c.id))
    for (const id of [...polygons.keys()]) {
      if (!newIds.has(id)) removeCaravan(id)
    }
    for (const c of list) syncCaravan(c)
  }

  function attach(m: L.Map) {
    map = m
    diffSync(opts.caravans.value)
  }

  function detach() {
    polygons.forEach(p => p.remove())
    markers.forEach(m => m.remove())
    polygons.clear()
    markers.clear()
    map = null
  }

  watch(opts.caravans, list => diffSync(list), { deep: true })
  watch(opts.selectedId, () => {
    if (!map) return
    for (const c of opts.caravans.value) syncCaravan(c)
  })

  return { attach, detach }
}
