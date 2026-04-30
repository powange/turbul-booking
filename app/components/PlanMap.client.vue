<script setup lang="ts">
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { latLngsToPoints } from '~/utils/leafletGeo'
import { caravanCorners } from '~/utils/geo'
import type { Booking, Caravan, Landmark, LandmarkIcon, PrintFrame, Zone, Wall } from '~~/shared/types'

const props = defineProps<{
  caravans: Caravan[]
  zones: Zone[]
  walls: Wall[]
  landmarks: Landmark[]
  landmarkIcons: LandmarkIcon[]
  bookings: Booking[]
  printFrame: PrintFrame | null
  printFrameVisible: boolean
  selectedId: string | null
  selectedZoneId: string | null
  selectedWallId: string | null
  selectedLandmarkId: string | null
  canEdit: boolean
  placeMode: boolean
  zoneDrawMode: boolean
  wallDrawMode: boolean
  landmarkPlaceMode: boolean
  draftZoneColor?: string
  draftWallColor?: string
  draftWallThickness?: number
}>()

const emit = defineEmits<{
  select: [id: string | null]
  selectZone: [id: string | null]
  selectWall: [id: string | null]
  selectLandmark: [id: string | null]
  move: [id: string, lat: number, lng: number]
  placeAt: [lat: number, lng: number]
  placeLandmarkAt: [lat: number, lng: number]
  landmarkMoved: [id: string, lat: number, lng: number]
  zoneCreated: [points: Array<[number, number]>]
  zoneEdited: [id: string, points: Array<[number, number]>]
  wallCreated: [points: Array<[number, number]>]
  wallEdited: [id: string, points: Array<[number, number]>]
  printFrameMove: [lat: number, lng: number]
  printFrameResize: [widthMeters: number]
  printFrameRotate: [rotationDeg: number]
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

const printFrameLayer = usePlanPrintFrame({
  frame: toRef(props, 'printFrame'),
  visible: toRef(props, 'printFrameVisible'),
  canEdit: toRef(props, 'canEdit'),
  onMove: (lat, lng) => emit('printFrameMove', lat, lng),
  onResize: w => emit('printFrameResize', w),
  onRotate: r => emit('printFrameRotate', r)
})

const landmarksLayer = usePlanLandmarks({
  landmarks: toRef(props, 'landmarks'),
  icons: toRef(props, 'landmarkIcons'),
  selectedLandmarkId: toRef(props, 'selectedLandmarkId'),
  canEdit: toRef(props, 'canEdit'),
  onSelect: id => emit('selectLandmark', id),
  onMove: (id, lat, lng) => emit('landmarkMoved', id, lat, lng)
})

function initMap() {
  if (map || !mapEl.value) return
  const center: L.LatLngExpression = [
    config.public.mapDefaultLat as number,
    config.public.mapDefaultLng as number
  ]
  // `zoomSnap: 0` autorise un zoom fractionnaire — nécessaire pour caler
  // exactement le cadre PDF sur la feuille A4 lors de l'impression.
  // La rotation visuelle pour aligner le cadre PDF avec la feuille A4
  // est faite côté CSS (transform: rotate sur le conteneur Leaflet) en
  // mode print — voir onPrintChange. On a abandonné leaflet-rotate qui
  // polluait les handlers de drag (markers + map drag) après un cycle
  // setBearing → setBearing(0).
  map = L.map(mapEl.value, {
    zoomControl: true,
    maxZoom: 22,
    zoomSnap: 0
  }).setView(center, config.public.mapDefaultZoom as number)

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

  // Clic map vide : placer une caravane / repère (selon mode), ou désélectionner.
  map.on('click', (e) => {
    if (props.placeMode && props.canEdit) {
      emit('placeAt', e.latlng.lat, e.latlng.lng)
      return
    }
    if (props.landmarkPlaceMode && props.canEdit) {
      emit('placeLandmarkAt', e.latlng.lat, e.latlng.lng)
      return
    }
    if (props.zoneDrawMode || props.wallDrawMode) return
    emit('select', null)
    emit('selectZone', null)
    emit('selectWall', null)
    emit('selectLandmark', null)
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
  printFrameLayer.attach(map)
  landmarksLayer.attach(map)
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

// Curseur "crosshair" en mode placeMode/landmarkPlaceMode pour signaler
// que le clic place un élément. Le reste est géré par le parent.
watch([() => props.placeMode, () => props.landmarkPlaceMode], ([place, lmPlace]) => {
  if (!mapEl.value) return
  mapEl.value.style.cursor = (place || lmPlace) ? 'crosshair' : ''
})

// === Mode impression ===
// On utilise `matchMedia('print')` plutôt que `beforeprint` parce que ce
// dernier fire AVANT que la CSS print soit appliquée — Leaflet calculerait
// alors le zoom avec la taille écran, pas avec la taille A4 paysage.
// matchMedia change à l'instant où le viewport print est actif, donc
// `invalidateSize` + le calcul de zoom voient la bonne géométrie.
let savedView: { center: L.LatLng, zoom: number } | null = null
let printMql: MediaQueryList | null = null

// Résolution Web Mercator au niveau de zoom 0 à l'équateur (m/px).
const EARTH_CIRCUMFERENCE_M = 40_075_016.686
const M_PER_PX_AT_Z0_EQUATOR = EARTH_CIRCUMFERENCE_M / 256

/**
 * Calcule le zoom Leaflet (potentiellement fractionnaire) qui fait tenir
 * exactement un rectangle de `widthMeters` × `heightMeters` à la latitude
 * `lat` dans un viewport pixel `Vw` × `Vh`. On veut le zoom MAXIMAL pour
 * lequel le rectangle rentre toujours — ainsi il remplit la page.
 */
function zoomToFitRectangle(
  widthMeters: number,
  heightMeters: number,
  lat: number,
  viewportPxW: number,
  viewportPxH: number
): number {
  const cosLat = Math.cos((lat * Math.PI) / 180)
  // À zoom z, m_per_px = M_PER_PX_AT_Z0_EQUATOR * cosLat / 2^z
  // pixel_size_of_rect_w = widthMeters / m_per_px ≤ viewportPxW
  // ⇒ 2^z ≤ viewportPxW * M_PER_PX_AT_Z0_EQUATOR * cosLat / widthMeters
  const zW = Math.log2((viewportPxW * M_PER_PX_AT_Z0_EQUATOR * cosLat) / widthMeters)
  const zH = Math.log2((viewportPxH * M_PER_PX_AT_Z0_EQUATOR * cosLat) / heightMeters)
  return Math.min(zW, zH)
}

function fitFallbackBounds(): L.LatLngBoundsExpression | null {
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
  for (const lm of props.landmarks) {
    points.push([lm.lat, lm.lng])
  }
  return points.length ? points : null
}

function onPrintChange(e: MediaQueryListEvent) {
  if (!map || !mapEl.value) return
  if (e.matches) {
    // Entrée en mode impression : sauve la vue actuelle (idempotent —
    // certains navigateurs firent matches=true plusieurs fois).
    if (!savedView) {
      savedView = { center: map.getCenter(), zoom: map.getZoom() }
    }

    if (props.printFrame) {
      const f = props.printFrame
      // 1) On applique la rotation visuelle via CSS (transform: rotate)
      //    sur le conteneur Leaflet — pas via setBearing. Avantage :
      //    aucun état Leaflet n'est touché, donc rien à "nettoyer" en
      //    sortie de print, donc pas de pollution des handlers de drag.
      //    La rotation est inverse de celle du cadre, pour faire
      //    apparaître le cadre axe-aligné à l'écran.
      mapEl.value.style.setProperty('--print-rotation', `${-f.rotation}deg`)
      // 2) Refresh des dimensions (le conteneur Leaflet a été agrandi
      //    par la CSS print pour ne pas clipper la rotation).
      map.invalidateSize({ animate: false })
      // 3) Calcul de zoom MANUEL pour faire tenir le cadre dans la page.
      //    On utilise les dimensions de la PAGE (pas du conteneur Leaflet
      //    agrandi), récupérées via la bbox de .plan-map-print-root —
      //    qui est en `position: fixed; inset: 0` = exactement la page.
      const printRoot = mapEl.value.closest('.plan-map-print-root') as HTMLElement | null
      const pageRect = printRoot?.getBoundingClientRect()
      const pageW = pageRect?.width ?? window.innerWidth
      const pageH = pageRect?.height ?? window.innerHeight
      const longM = f.widthMeters
      const shortM = f.widthMeters * (210 / 297)
      const localWidthM = f.orientation === 'landscape' ? longM : shortM
      const localHeightM = f.orientation === 'landscape' ? shortM : longM
      const zoom = zoomToFitRectangle(localWidthM, localHeightM, f.lat, pageW, pageH)
      map.setView([f.lat, f.lng], zoom, { animate: false })
    } else {
      // Pas de cadre PDF : auto-fit sur tous les éléments.
      map.invalidateSize({ animate: false })
      const bounds = fitFallbackBounds()
      if (bounds) map.fitBounds(bounds, { padding: [0, 0], animate: false })
    }
  } else if (savedView) {
    // Sortie : retire la rotation CSS et restaure la vue précédente.
    mapEl.value.style.removeProperty('--print-rotation')
    map.setView(savedView.center, savedView.zoom, { animate: false })
    savedView = null
    map.invalidateSize({ animate: false })
  }
}

if (import.meta.client) {
  printMql = window.matchMedia('print')
  printMql.addEventListener('change', onPrintChange)
}

/** Recentre la map sur la position + zoom par défaut (config runtime). */
function recenter() {
  if (!map) return
  map.setView(
    [
      config.public.mapDefaultLat as number,
      config.public.mapDefaultLng as number
    ],
    config.public.mapDefaultZoom as number,
    { animate: true }
  )
}

defineExpose({ recenter })

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
  printFrameLayer.detach()
  landmarksLayer.detach()
  map?.remove()
  map = null
})
</script>

<template>
  <div
    ref="mapEl"
    class="w-full h-full plan-map-canvas"
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
.print-frame-marker {
  background: transparent;
  border: none;
}
.print-frame-pin {
  display: inline-block;
  transform: translate(-50%, -50%);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px dashed #cb6743;
  background: rgba(255, 255, 255, 0.85);
  color: #cb6743;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  cursor: move;
  pointer-events: auto;
}
.print-frame-corner {
  width: 12px;
  height: 12px;
  background: white;
  border: 2px solid #cb6743;
  border-radius: 2px;
  cursor: nwse-resize;
  pointer-events: auto;
}
.print-frame-rotate {
  width: 22px;
  height: 22px;
  background: #cb6743;
  border: 2px solid white;
  border-radius: 9999px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  pointer-events: auto;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.print-frame-rotate svg {
  width: 12px;
  height: 12px;
}
.print-frame-rotate:active {
  cursor: grabbing;
}
.landmark-marker {
  background: transparent;
  border: none;
}
.landmark-pin {
  display: block;
  pointer-events: auto;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
}
.landmark-pin svg {
  width: 100%;
  height: 100%;
  display: block;
}
.landmark-pin--selected {
  outline: 2px solid #cb6743;
  outline-offset: 2px;
  border-radius: 4px;
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
/* Le span interne reçoit un offset vertical appliqué par le decluttering
   greedy (cf. usePlanZones.ts) via la custom property `--declutter-y`.
   Transition douce pour éviter le snap à chaque zoom/move quand un
   label change de slot. La CSS print écrase entièrement `transform`
   pour appliquer sa contre-rotation, donc pas de conflit là-bas.
   `max-width` + wrapping pour que les noms longs (ex. "Cuisine
   collective") passent sur plusieurs lignes au lieu de s'étirer. */
.zone-label-inner {
  display: inline-block;
  max-width: 8em;
  text-align: center;
  white-space: normal;
  overflow-wrap: break-word;
  line-height: 1.15;
  transform: translateY(var(--declutter-y, 0));
  transition: transform 150ms ease-out;
}
</style>
