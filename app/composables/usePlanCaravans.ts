import L from 'leaflet'
import type { Ref } from 'vue'
import type { Booking, Caravan } from '~~/shared/types'
import { caravanCorners } from '~/utils/geo'
import { escapeHtml } from '~/utils/leafletGeo'
import { PLAN_COLORS, CARAVAN_PIN_CLASSES } from '~/utils/planColors'
import { todayIso } from '~/utils/dates'

export interface UsePlanCaravansOptions {
  caravans: Ref<Caravan[]>
  /**
   * Réservations utilisées pour déterminer si tous les lits occupés ce jour
   * ont du linge propre (icône lit dans le pin). Optionnel : si non fourni,
   * l'icône lit n'apparaît jamais.
   */
  bookings?: Ref<Booking[]>
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

  // SVG inline (Lucide) injectés dans le pin HTML — `currentColor` hérite
  // du blanc du pin pour rester lisibles sur le fond coloré.
  const ZAP_SVG = '<svg class="caravan-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>'
  const BED_SVG = '<svg class="caravan-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>'

  function pinIcons(c: Caravan): string {
    const parts: string[] = []
    if (c.hasElectricity) parts.push(ZAP_SVG)

    // Icône linge propre : seulement si la caravane héberge au moins un
    // hôte aujourd'hui ET que tous les lits avec une réservation du jour
    // ont leur linge marqué propre. Si personne n'arrive aujourd'hui, on
    // ne montre rien (pas d'info utile).
    if (opts.bookings) {
      const today = todayIso()
      const occupiedBedIds = new Set(
        opts.bookings.value.filter(b => b.date === today).map(b => b.bedId)
      )
      const occupiedBeds = c.beds.filter(b => occupiedBedIds.has(b.id))
      if (occupiedBeds.length > 0 && occupiedBeds.every(b => b.hasCleanLinen)) {
        parts.push(BED_SVG)
      }
    }

    return parts.join('')
  }

  function makeIcon(c: Caravan, selected: boolean): L.DivIcon {
    const colorClass = selected
      ? CARAVAN_PIN_CLASSES.selected
      : c.hasElectricity ? CARAVAN_PIN_CLASSES.powered : CARAVAN_PIN_CLASSES.neutral
    return L.divIcon({
      className: 'caravan-marker',
      html: `<div class="caravan-pin ${colorClass}" title="${escapeHtml(c.name)}">${pinIcons(c)}${escapeHtml(c.name)}</div>`,
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
  // Si on suit les bookings, leur évolution change l'icône "linge propre"
  // (un nouveau booking d'aujourd'hui peut faire apparaître ou disparaître
  // l'icône) — on resync les pins.
  if (opts.bookings) {
    watch(opts.bookings, () => {
      if (!map) return
      for (const c of opts.caravans.value) syncCaravan(c)
    }, { deep: true })
  }

  return { attach, detach }
}
