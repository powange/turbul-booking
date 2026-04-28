<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { caravanCorners } from '~/utils/geo'
import { PLAN_COLORS, CARAVAN_PIN_CLASSES } from '~/utils/planColors'
import type { Caravan, Zone, Wall } from '~~/shared/types'

const props = defineProps<{
  caravans: Caravan[]
  zones: Zone[]
  walls: Wall[]
  selectedId: string | null
  selectedZoneId: string | null
  selectedWallId: string | null
  canEdit: boolean
  placeMode: boolean
  zoneDrawMode: boolean
  wallDrawMode: boolean
  draftZoneColor?: string
  draftWallColor?: string
  draftWallThickness?: number
}>()

const emit = defineEmits<{
  select: [id: string | null]
  selectZone: [id: string | null]
  selectWall: [id: string | null]
  move: [id: string, lat: number, lng: number]
  placeAt: [lat: number, lng: number]
  zoneCreated: [points: Array<[number, number]>]
  zoneEdited: [id: string, points: Array<[number, number]>]
  wallCreated: [points: Array<[number, number]>]
  wallEdited: [id: string, points: Array<[number, number]>]
}>()

const config = useRuntimeConfig()

const mapEl = ref<HTMLElement>()
let map: L.Map | null = null
let resizeObserver: ResizeObserver | null = null
const polygons = new Map<string, L.Polygon>()
const markers = new Map<string, L.Marker>()
const zonePolygons = new Map<string, L.Polygon>()
const ZONE_PANE = 'zonesPane'
const wallPolylines = new Map<string, L.Polyline>()
const WALL_PANE = 'wallsPane'

// L'id de la zone actuellement éditée via Geoman. Quand non null, on ignore
// les mises à jour de props sur cette zone pour ne pas désynchroniser les
// poignées de sommets.
let editingZoneId: string | null = null
let editingWallId: string | null = null

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

function zoneStyle(z: Zone) {
  return {
    color: z.color,
    weight: 2,
    fillColor: z.color,
    fillOpacity: z.filled ? 0.25 : 0
  }
}

function pointsToLatLngs(points: Array<[number, number]>): L.LatLngExpression[] {
  return points.map(([lat, lng]) => [lat, lng] as L.LatLngExpression)
}

function latLngsToPoints(layer: L.Polyline): Array<[number, number]> {
  const raw = layer.getLatLngs() as L.LatLng[] | L.LatLng[][]
  const ring = Array.isArray(raw[0]) ? (raw as L.LatLng[][])[0]! : (raw as L.LatLng[])
  return ring.map(ll => [ll.lat, ll.lng] as [number, number])
}

function enableZoneGeomanEdit(id: string) {
  const target = zonePolygons.get(id)
  if (!target) return
  target.pm.enable({
    allowSelfIntersection: false,
    snappable: false,
    draggable: true
  })
  const onUpdate = () => {
    emit('zoneEdited', id, latLngsToPoints(target))
  }
  target.on('pm:edit', onUpdate)
  target.on('pm:dragend', onUpdate)
}

function syncZone(z: Zone) {
  if (!map) return
  const existing = zonePolygons.get(z.id)

  // Si le polygone existe déjà ET est en cours d'édition, on garde sa
  // géométrie locale (poignées Geoman) et on ne met à jour que le style/label.
  if (existing && editingZoneId === z.id) {
    existing.setStyle(zoneStyle(z))
    existing.getTooltip()?.setContent(z.name)
    return
  }

  const latlngs = pointsToLatLngs(z.points)

  if (existing) {
    existing.setLatLngs(latlngs)
    existing.setStyle(zoneStyle(z))
    existing.getTooltip()?.setContent(z.name)
  } else {
    const polygon = L.polygon(latlngs, {
      ...zoneStyle(z),
      pane: ZONE_PANE,
      interactive: true
    })
    polygon.bindTooltip(z.name, {
      permanent: true,
      direction: 'center',
      className: 'zone-label',
      interactive: false
    })
    polygon.on('click', (e) => {
      if (props.zoneDrawMode) return
      L.DomEvent.stopPropagation(e)
      if (props.canEdit) emit('selectZone', z.id)
    })
    polygon.addTo(map)
    zonePolygons.set(z.id, polygon)

    // Si la sélection a précédé l'arrivée des données (création WS),
    // on active maintenant le mode édition Geoman sur le nouveau polygone.
    if (editingZoneId === z.id) enableZoneGeomanEdit(z.id)
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

function startZoneDraw() {
  if (!map) return
  const color = props.draftZoneColor ?? '#3b82f6'
  map.pm.enableDraw('Polygon', {
    snappable: false,
    pathOptions: { color, fillColor: color, fillOpacity: 0.25, weight: 2 },
    hintlineStyle: { color, dashArray: [5, 5] },
    templineStyle: { color }
  })
}

function stopZoneDraw() {
  if (!map) return
  if (map.pm.globalDrawModeEnabled?.()) map.pm.disableDraw()
}

function wallStyle(w: Wall) {
  return {
    color: w.color,
    weight: w.thickness,
    opacity: 1,
    lineCap: 'round' as L.LineCapShape,
    lineJoin: 'round' as L.LineJoinShape
  }
}

function enableWallGeomanEdit(id: string) {
  const target = wallPolylines.get(id)
  if (!target) return
  target.pm.enable({
    allowSelfIntersection: true,
    snappable: false,
    draggable: true
  })
  const onUpdate = () => {
    emit('wallEdited', id, latLngsToPoints(target))
  }
  target.on('pm:edit', onUpdate)
  target.on('pm:dragend', onUpdate)
}

function syncWall(w: Wall) {
  if (!map) return
  const existing = wallPolylines.get(w.id)

  // Si la polyligne existe déjà ET est en cours d'édition, on garde sa
  // géométrie locale (poignées Geoman) et on ne met à jour que le style.
  if (existing && editingWallId === w.id) {
    existing.setStyle(wallStyle(w))
    return
  }

  const latlngs = pointsToLatLngs(w.points)

  if (existing) {
    existing.setLatLngs(latlngs)
    existing.setStyle(wallStyle(w))
  } else {
    const polyline = L.polyline(latlngs, {
      ...wallStyle(w),
      pane: WALL_PANE,
      interactive: true
    })
    polyline.on('click', (e) => {
      if (props.wallDrawMode) return
      L.DomEvent.stopPropagation(e)
      if (props.canEdit) emit('selectWall', w.id)
    })
    polyline.addTo(map)
    wallPolylines.set(w.id, polyline)

    // Si la sélection a précédé l'arrivée des données (création WS),
    // on active maintenant le mode édition Geoman sur la nouvelle polyligne.
    if (editingWallId === w.id) enableWallGeomanEdit(w.id)
  }
}

function removeWall(id: string) {
  const p = wallPolylines.get(id)
  if (!p) return
  p.pm?.disable?.()
  p.remove()
  wallPolylines.delete(id)
  if (editingWallId === id) editingWallId = null
}

function diffSyncWalls(list: Wall[]) {
  if (!map) return
  const newIds = new Set(list.map(w => w.id))
  for (const id of [...wallPolylines.keys()]) {
    if (!newIds.has(id)) removeWall(id)
  }
  for (const w of list) syncWall(w)
}

function startWallDraw() {
  if (!map) return
  const color = props.draftWallColor ?? '#1f2937'
  const weight = props.draftWallThickness ?? 3
  map.pm.enableDraw('Line', {
    snappable: false,
    pathOptions: { color, weight, lineCap: 'round', lineJoin: 'round' },
    hintlineStyle: { color, dashArray: [5, 5] },
    templineStyle: { color }
  })
}

function stopWallDraw() {
  if (!map) return
  if (map.pm.globalDrawModeEnabled?.()) map.pm.disableDraw()
}

function applyWallEditMode(id: string | null) {
  if (!map) return
  if (editingWallId && editingWallId !== id) {
    const prev = wallPolylines.get(editingWallId)
    if (prev) {
      prev.pm.disable()
      prev.off('pm:edit')
      prev.off('pm:dragend')
    }
  }
  editingWallId = id
  // Si la polyligne n'existe pas encore (sélection avant arrivée des données),
  // syncWall activera Geoman dès qu'elle sera créée.
  if (id) enableWallGeomanEdit(id)
}

function applyZoneEditMode(id: string | null) {
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
  // Si le polygone n'existe pas encore (sélection avant arrivée des données),
  // syncZone activera Geoman dès qu'il sera créé.
  if (id) enableZoneGeomanEdit(id)
}

function initMap() {
  if (map || !mapEl.value) return
  const center: L.LatLngExpression = [
    config.public.mapDefaultLat as number,
    config.public.mapDefaultLng as number
  ]
  map = L.map(mapEl.value, { zoomControl: true, maxZoom: 22 }).setView(center, config.public.mapDefaultZoom as number)

  // Pane pour les zones, sous overlayPane (caravanes) — z-index 350 < 400
  map.createPane(ZONE_PANE)
  const zonesPane = map.getPane(ZONE_PANE)
  if (zonesPane) zonesPane.style.zIndex = '350'

  // Pane pour les murs, entre les zones et les caravanes
  map.createPane(WALL_PANE)
  const wallsPane = map.getPane(WALL_PANE)
  if (wallsPane) wallsPane.style.zIndex = '360'

  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 22,
    maxNativeZoom: 19
  })
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 22,
    maxNativeZoom: 19
  })
  osmLayer.addTo(map)
  L.control.layers({ Plan: osmLayer, Satellite: satelliteLayer }, undefined, { position: 'topright' }).addTo(map)

  map.on('click', (e) => {
    if (props.placeMode && props.canEdit) {
      emit('placeAt', e.latlng.lat, e.latlng.lng)
      return
    }
    if (props.zoneDrawMode || props.wallDrawMode) return
    emit('select', null)
    emit('selectZone', null)
    emit('selectWall', null)
  })

  // Création de zone ou mur via Geoman. L'événement Geoman n'est pas typé
  // dans @types/leaflet, on cast minimal sur la forme attendue.
  map.on('pm:create', (e) => {
    const layer = (e as { layer: L.Polyline }).layer
    const points = latLngsToPoints(layer)
    layer.remove()
    if (props.zoneDrawMode) {
      emit('zoneCreated', points)
    } else if (props.wallDrawMode) {
      emit('wallCreated', points)
    }
  })

  diffSync(props.caravans)
  diffSyncZones(props.zones)
  diffSyncWalls(props.walls)
  if (props.zoneDrawMode) startZoneDraw()
  if (props.wallDrawMode) startWallDraw()
  if (props.selectedZoneId) applyZoneEditMode(props.selectedZoneId)
  if (props.selectedWallId) applyWallEditMode(props.selectedWallId)
}

// L'enveloppe automatique liée au suffix `.client.vue` peut faire fire
// onMounted avant que le ref de template soit lié. On attend donc que mapEl
// devienne disponible via un watch immediate (post-flush pour avoir le DOM).
const stopMapElWatch = watch(() => mapEl.value, (el) => {
  if (!el) return
  stopMapElWatch()

  const tryInit = () => {
    if (map || !el) return
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) initMap()
  }

  tryInit()
  requestAnimationFrame(tryInit)
  setTimeout(tryInit, 200)

  resizeObserver = new ResizeObserver(() => {
    if (!map) tryInit()
    else map.invalidateSize()
  })
  resizeObserver.observe(el)
}, { immediate: true, flush: 'post' })

watch(() => props.caravans, list => diffSync(list), { deep: true })
watch(() => props.selectedId, () => {
  for (const c of props.caravans) syncCaravan(c)
})
watch(() => props.placeMode, (mode) => {
  if (!mapEl.value) return
  mapEl.value.style.cursor = mode ? 'crosshair' : ''
})
watch(() => props.zones, list => diffSyncZones(list), { deep: true })
watch(() => props.zoneDrawMode, (mode) => {
  if (mode) startZoneDraw()
  else stopZoneDraw()
})
watch(() => props.selectedZoneId, id => applyZoneEditMode(id))
watch(() => props.draftZoneColor, () => {
  if (props.zoneDrawMode) {
    stopZoneDraw()
    startZoneDraw()
  }
})
watch(() => props.walls, list => diffSyncWalls(list), { deep: true })
watch(() => props.wallDrawMode, (mode) => {
  if (mode) startWallDraw()
  else stopWallDraw()
})
watch(() => props.selectedWallId, id => applyWallEditMode(id))
watch(() => props.draftWallColor, () => {
  if (props.wallDrawMode) {
    stopWallDraw()
    startWallDraw()
  }
})
watch(() => props.draftWallThickness, () => {
  if (props.wallDrawMode) {
    stopWallDraw()
    startWallDraw()
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  polygons.clear()
  markers.clear()
  zonePolygons.clear()
  wallPolylines.clear()
  editingZoneId = null
  editingWallId = null
})
</script>

<template>
  <div
    ref="mapEl"
    class="w-full h-full"
  />
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
.zone-label.leaflet-tooltip {
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  font-weight: 700;
  font-size: 13px;
  color: white;
  text-shadow:
    0 1px 3px rgba(0, 0, 0, 0.7),
    0 0 2px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
.zone-label.leaflet-tooltip::before {
  display: none;
}
</style>
