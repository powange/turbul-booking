<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { latLngsToPoints } from '~/utils/leafletGeo'
import { caravanCorners } from '~/utils/geo'
import type { Booking, Caravan, Zone, Wall } from '~~/shared/types'

const props = defineProps<{
  caravans: Caravan[]
  zones: Zone[]
  walls: Wall[]
  bookings: Booking[]
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

// === Couches ===
// Chaque couche a son propre état + ses watches sur les props pertinentes.
// Elles sont attachées à la map dans initMap() et nettoyées au démontage.
const caravansLayer = usePlanCaravans({
  caravans: toRef(props, 'caravans'),
  bookings: toRef(props, 'bookings'),
  selectedId: toRef(props, 'selectedId'),
  canEdit: toRef(props, 'canEdit'),
  onSelect: id => emit('select', id),
  onMove: (id, lat, lng) => emit('move', id, lat, lng)
})

const zonesLayer = usePlanZones({
  zones: toRef(props, 'zones'),
  selectedZoneId: toRef(props, 'selectedZoneId'),
  zoneDrawMode: toRef(props, 'zoneDrawMode'),
  draftZoneColor: toRef(props, 'draftZoneColor'),
  canEdit: toRef(props, 'canEdit'),
  onSelectZone: id => emit('selectZone', id),
  onZoneCreated: points => emit('zoneCreated', points),
  onZoneEdited: (id, points) => emit('zoneEdited', id, points)
})

const wallsLayer = usePlanWalls({
  walls: toRef(props, 'walls'),
  selectedWallId: toRef(props, 'selectedWallId'),
  wallDrawMode: toRef(props, 'wallDrawMode'),
  draftWallColor: toRef(props, 'draftWallColor'),
  draftWallThickness: toRef(props, 'draftWallThickness'),
  canEdit: toRef(props, 'canEdit'),
  onSelectWall: id => emit('selectWall', id),
  onWallCreated: points => emit('wallCreated', points),
  onWallEdited: (id, points) => emit('wallEdited', id, points)
})

function initMap() {
  if (map || !mapEl.value) return
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
    maxNativeZoom: 19
  })
  osmLayer.addTo(map)
  L.control.layers({ Plan: osmLayer, Satellite: satelliteLayer }, undefined, { position: 'topright' }).addTo(map)

  // Clic map vide : placer une caravane (mode placeMode), ou désélectionner.
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

  // Geoman émet pm:create à la fin d'un dessin. On route vers la couche
  // dont le mode draw est actif (au plus un à la fois, garanti par
  // les watchers du parent).
  map.on('pm:create', (e) => {
    const layer = (e as unknown as { layer: L.Layer & { getLatLngs: () => L.LatLng[] | L.LatLng[][] | L.LatLng[][][] } }).layer
    const points = latLngsToPoints(layer)
    layer.remove()
    if (props.zoneDrawMode) zonesLayer.onPmCreate(points)
    else if (props.wallDrawMode) wallsLayer.onPmCreate(points)
  })

  caravansLayer.attach(map)
  zonesLayer.attach(map)
  wallsLayer.attach(map)
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

// Curseur "crosshair" en mode placeMode pour signaler que le clic place
// une caravane. Le reste de l'état placeMode est géré par le parent.
watch(() => props.placeMode, (mode) => {
  if (!mapEl.value) return
  mapEl.value.style.cursor = mode ? 'crosshair' : ''
})

// === Mode impression ===
// On utilise `matchMedia('print')` plutôt que `beforeprint` parce que ce
// dernier fire AVANT que la CSS print soit appliquée — Leaflet calculerait
// alors `fitBounds` avec la taille écran, pas avec la taille A4 paysage.
// matchMedia change à l'instant où le viewport print est actif, donc
// `invalidateSize` + `fitBounds` voient la bonne géométrie.
let savedView: { center: L.LatLng, zoom: number } | null = null
let printMql: MediaQueryList | null = null

function computeContentBounds(): L.LatLngBoundsExpression | null {
  const points: L.LatLngTuple[] = []
  for (const c of props.caravans) {
    for (const corner of caravanCorners(c)) points.push(corner as L.LatLngTuple)
  }
  for (const z of props.zones) {
    for (const p of z.points) points.push(p)
  }
  for (const w of props.walls) {
    for (const p of w.points) points.push(p)
  }
  return points.length ? points : null
}

function onPrintChange(e: MediaQueryListEvent) {
  if (!map) return
  if (e.matches) {
    // Entrée en mode impression : sauve, recadre.
    savedView = { center: map.getCenter(), zoom: map.getZoom() }
    map.invalidateSize({ animate: false })
    const bounds = computeContentBounds()
    if (bounds) map.fitBounds(bounds, { padding: [20, 20], animate: false })
  } else if (savedView) {
    // Sortie : restaure la vue précédente.
    map.setView(savedView.center, savedView.zoom, { animate: false })
    savedView = null
    map.invalidateSize({ animate: false })
  }
}

if (import.meta.client) {
  printMql = window.matchMedia('print')
  printMql.addEventListener('change', onPrintChange)
}

onBeforeUnmount(() => {
  if (printMql) {
    printMql.removeEventListener('change', onPrintChange)
    printMql = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  caravansLayer.detach()
  zonesLayer.detach()
  wallsLayer.detach()
  map?.remove()
  map = null
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
  display: inline-flex;
  align-items: center;
  gap: 3px;
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
.caravan-pin-icon {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
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
