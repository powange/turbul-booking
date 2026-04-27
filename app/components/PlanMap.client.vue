<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { caravanCorners } from '~/utils/geo'
import type { Caravan } from '~~/shared/types'

const props = defineProps<{
  caravans: Caravan[]
  selectedId: string | null
  canEdit: boolean
  placeMode: boolean
}>()

const emit = defineEmits<{
  select: [id: string | null]
  move: [id: string, lat: number, lng: number]
  placeAt: [lat: number, lng: number]
}>()

const config = useRuntimeConfig()

const mapEl = ref<HTMLElement>()
let map: L.Map | null = null
let resizeObserver: ResizeObserver | null = null
const polygons = new Map<string, L.Polygon>()
const markers = new Map<string, L.Marker>()

function styleFor(c: Caravan, selected: boolean) {
  return {
    color: selected ? '#0ea5e9' : c.hasElectricity ? '#16a34a' : '#64748b',
    weight: selected ? 3 : 2,
    fillColor: selected ? '#0ea5e9' : c.hasElectricity ? '#22c55e' : '#94a3b8',
    fillOpacity: 0.45
  }
}

function makeIcon(c: Caravan, selected: boolean): L.DivIcon {
  const colorClass = selected
    ? 'bg-sky-500 border-sky-700'
    : c.hasElectricity ? 'bg-green-500 border-green-700' : 'bg-slate-500 border-slate-700'
  return L.divIcon({
    className: 'caravan-marker',
    html: `<div class="caravan-pin ${colorClass}" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch]!))
}

function syncCaravan(c: Caravan) {
  if (!map) return
  const selected = props.selectedId === c.id
  const corners = caravanCorners(c)

  // Polygone
  const existingPoly = polygons.get(c.id)
  if (existingPoly) {
    existingPoly.setLatLngs(corners)
    existingPoly.setStyle(styleFor(c, selected))
  } else {
    const polygon = L.polygon(corners, styleFor(c, selected))
    polygon.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      emit('select', c.id)
    })
    polygon.addTo(map)
    polygons.set(c.id, polygon)
  }

  // Marqueur central (déplacement + label)
  const existingMarker = markers.get(c.id)
  if (existingMarker) {
    existingMarker.setLatLng([c.lat, c.lng])
    existingMarker.setIcon(makeIcon(c, selected))
    existingMarker.dragging?.[props.canEdit ? 'enable' : 'disable']()
  } else {
    const marker = L.marker([c.lat, c.lng], {
      draggable: props.canEdit,
      icon: makeIcon(c, selected),
      autoPan: true
    })
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e)
      emit('select', c.id)
    })
    marker.on('drag', () => {
      const ll = marker.getLatLng()
      const newCorners = caravanCorners({ ...c, lat: ll.lat, lng: ll.lng })
      polygons.get(c.id)?.setLatLngs(newCorners)
    })
    marker.on('dragend', () => {
      const ll = marker.getLatLng()
      emit('move', c.id, ll.lat, ll.lng)
    })
    marker.addTo(map)
    markers.set(c.id, marker)
  }
}

function removeCaravan(id: string) {
  const p = polygons.get(id)
  if (p) { p.remove(); polygons.delete(id) }
  const m = markers.get(id)
  if (m) { m.remove(); markers.delete(id) }
}

function diffSync(list: Caravan[]) {
  if (!map) return
  const newIds = new Set(list.map(c => c.id))
  for (const id of [...polygons.keys()]) {
    if (!newIds.has(id)) removeCaravan(id)
  }
  for (const c of list) syncCaravan(c)
}

onMounted(() => {
  if (!mapEl.value) return
  const center: L.LatLngExpression = [
    config.public.mapDefaultLat as number,
    config.public.mapDefaultLng as number
  ]
  map = L.map(mapEl.value, { zoomControl: true, maxZoom: 22 }).setView(center, config.public.mapDefaultZoom as number)

  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 22,
    maxNativeZoom: 19
  })
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 22,
    maxNativeZoom: 22
  })
  osmLayer.addTo(map)
  L.control.layers({ Plan: osmLayer, Satellite: satelliteLayer }, undefined, { position: 'topright' }).addTo(map)

  map.on('click', (e) => {
    if (props.placeMode && props.canEdit) {
      emit('placeAt', e.latlng.lat, e.latlng.lng)
    } else {
      emit('select', null)
    }
  })

  diffSync(props.caravans)

  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(mapEl.value)
})

watch(() => props.caravans, list => diffSync(list), { deep: true })
watch(() => props.selectedId, () => {
  for (const c of props.caravans) syncCaravan(c)
})
watch(() => props.placeMode, (mode) => {
  if (!mapEl.value) return
  mapEl.value.style.cursor = mode ? 'crosshair' : ''
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  polygons.clear()
  markers.clear()
})
</script>

<template>
  <div ref="mapEl" class="w-full h-full" />
</template>

<style>
.caravan-marker {
  background: transparent;
  border: none;
}
.caravan-pin {
  display: inline-block;
  transform: translate(-50%, -50%);
  padding: 2px 8px;
  border-radius: 9999px;
  border-width: 2px;
  border-style: solid;
  font-size: 11px;
  font-weight: 600;
  color: white;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  pointer-events: auto;
}
</style>
