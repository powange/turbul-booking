<script setup lang="ts">
import { addDaysIso, todayIso } from '~/utils/dates'
import type { Caravan } from '~~/shared/types'

useHead({ title: 'Plan · Turbul Booking' })

const { hasRole } = useAuth()
const isAdmin = computed(() => hasRole('ADMIN'))
const canCreateBooking = computed(() => hasRole('MANAGER'))

// Mode édition (admin uniquement) : off par défaut. Le clic caravane ouvre la
// liste des réservations à venir, pas le panneau d'édition.
// Persistance localStorage : on hydrate après onMounted pour éviter les
// mismatches SSR (le serveur ne connaît pas la valeur stockée côté client).
const EDIT_MODE_KEY = 'turbul:editMode'
const editMode = ref(false)
const canEdit = computed(() => isAdmin.value && editMode.value)

onMounted(() => {
  if (localStorage.getItem(EDIT_MODE_KEY) === '1') editMode.value = true
})

watch(editMode, (v) => {
  if (!import.meta.client) return
  if (v) localStorage.setItem(EDIT_MODE_KEY, '1')
  else localStorage.removeItem(EDIT_MODE_KEY)
})

const { caravans, isReady, refresh, ensureRealtime } = useCaravans()
const { zones, isReady: zonesReady, refresh: refreshZones, ensureRealtime: ensureZonesRealtime } = useZones()
const { walls, isReady: wallsReady, refresh: refreshWalls, ensureRealtime: ensureWallsRealtime } = useWalls()
const { bookings, fetchRange: fetchBookingsRange, ensureRealtime: ensureBookingsRealtime } = useBookings()
const { unavailabilities, fetchRange: fetchUnavailabilitiesRange, ensureRealtime: ensureUnavailabilitiesRealtime } = useUnavailabilities()
const { issues, refresh: refreshIssues, ensureRealtime: ensureIssuesRealtime } = useCaravanIssues()
const { frame: printFrame, refresh: refreshPrintFrame, ensureRealtime: ensurePrintFrameRealtime, applyUpdate: applyPrintFrameUpdate, applyDelete: applyPrintFrameDelete } = usePrintFrame()
const { landmarks, refresh: refreshLandmarks, ensureRealtime: ensureLandmarksRealtime } = useLandmarks()
const { icons: landmarkIcons, refresh: refreshLandmarkIcons, ensureRealtime: ensureLandmarkIconsRealtime, applyCreated: applyLandmarkIconCreated, applyDeleted: applyLandmarkIconDeleted } = useLandmarkIcons()

// Deep-link via `?caravan=ID` (depuis la page Maintenance) : la query
// param hydrate selectedId, qui ouvre le panneau de la caravane correspondante
// dès que les données sont chargées.
const route = useRoute()
const selectedId = ref<string | null>(typeof route.query.caravan === 'string' ? route.query.caravan : null)
const placeMode = ref(false)
const creating = ref(false)
const newCaravanName = ref('')

const selectedZoneId = ref<string | null>(null)
const zoneDrawMode = ref(false)
const draftZoneColor = ref('#3b82f6')

const selectedWallId = ref<string | null>(null)
const wallDrawMode = ref(false)
const draftWallColor = ref('#1f2937')
const draftWallThickness = ref(3)

const selectedLandmarkId = ref<string | null>(null)
const landmarkPlaceMode = ref(false)

const bookingModalOpen = ref(false)
const bookingModalCaravan = ref<Caravan | null>(null)

const selectedCaravan = computed(() => caravans.value.find(c => c.id === selectedId.value) ?? null)
const selectedZone = computed(() => zones.value.find(z => z.id === selectedZoneId.value) ?? null)
const selectedWall = computed(() => walls.value.find(w => w.id === selectedWallId.value) ?? null)
const selectedLandmark = computed(() => landmarks.value.find(l => l.id === selectedLandmarkId.value) ?? null)

// Snapshot pour pouvoir restaurer si l'utilisateur ferme le panneau sans
// avoir cliqué sur "Enregistrer" (l'aperçu live a modifié l'objet en place).
let previewSnapshot: { rotation: number, width: number, length: number, hasElectricity: boolean } | null = null
let previewDirty = false

watch(selectedId, async (newId, oldId) => {
  // Si on ferme un panneau qui avait un aperçu non sauvegardé, on resync depuis le serveur
  if (oldId && previewDirty) {
    await refresh()
  }
  previewDirty = false
  if (newId) {
    selectedZoneId.value = null
    selectedWallId.value = null
    selectedLandmarkId.value = null
    zoneDrawMode.value = false
    wallDrawMode.value = false
    placeMode.value = false
    landmarkPlaceMode.value = false
    const c = caravans.value.find(c => c.id === newId)
    previewSnapshot = c
      ? { rotation: c.rotation, width: c.width, length: c.length, hasElectricity: c.hasElectricity }
      : null
  } else {
    previewSnapshot = null
  }
})

watch(selectedZoneId, (id) => {
  if (id) {
    selectedId.value = null
    selectedWallId.value = null
    selectedLandmarkId.value = null
    zoneDrawMode.value = false
    wallDrawMode.value = false
    placeMode.value = false
    landmarkPlaceMode.value = false
  }
})

watch(selectedWallId, (id) => {
  if (id) {
    selectedId.value = null
    selectedZoneId.value = null
    selectedLandmarkId.value = null
    zoneDrawMode.value = false
    wallDrawMode.value = false
    placeMode.value = false
    landmarkPlaceMode.value = false
  }
})

watch(selectedLandmarkId, (id) => {
  if (id) {
    selectedId.value = null
    selectedZoneId.value = null
    selectedWallId.value = null
    zoneDrawMode.value = false
    wallDrawMode.value = false
    placeMode.value = false
    landmarkPlaceMode.value = false
  }
})

watch(zoneDrawMode, (mode) => {
  if (mode) {
    selectedId.value = null
    selectedZoneId.value = null
    selectedWallId.value = null
    selectedLandmarkId.value = null
    wallDrawMode.value = false
    placeMode.value = false
    landmarkPlaceMode.value = false
  }
})

watch(wallDrawMode, (mode) => {
  if (mode) {
    selectedId.value = null
    selectedZoneId.value = null
    selectedWallId.value = null
    selectedLandmarkId.value = null
    zoneDrawMode.value = false
    placeMode.value = false
    landmarkPlaceMode.value = false
  }
})

watch(placeMode, (mode) => {
  if (mode) {
    selectedId.value = null
    selectedZoneId.value = null
    selectedWallId.value = null
    selectedLandmarkId.value = null
    zoneDrawMode.value = false
    wallDrawMode.value = false
    landmarkPlaceMode.value = false
  }
})

watch(landmarkPlaceMode, (mode) => {
  if (mode) {
    selectedId.value = null
    selectedZoneId.value = null
    selectedWallId.value = null
    selectedLandmarkId.value = null
    zoneDrawMode.value = false
    wallDrawMode.value = false
    placeMode.value = false
  }
})

function onPreview(p: { rotation: number, width: number, length: number, hasElectricity: boolean }) {
  const c = selectedCaravan.value
  if (!c) return
  // Pas de mutation tant qu'on est encore aux valeurs initiales (évite le watcher initial)
  if (
    previewSnapshot
    && p.rotation === previewSnapshot.rotation
    && p.width === previewSnapshot.width
    && p.length === previewSnapshot.length
    && p.hasElectricity === previewSnapshot.hasElectricity
  ) return
  c.rotation = p.rotation
  c.width = p.width
  c.length = p.length
  c.hasElectricity = p.hasElectricity
  previewDirty = true
}

const toast = useToast()

// Quitter le mode édition : ranger les états réservés à l'admin pour ne pas
// laisser un panneau d'édition zone ou un mode de dessin actif en consultation.
watch(editMode, (active) => {
  if (active) return
  placeMode.value = false
  zoneDrawMode.value = false
  wallDrawMode.value = false
  landmarkPlaceMode.value = false
  selectedZoneId.value = null
  selectedWallId.value = null
  selectedLandmarkId.value = null
  newCaravanName.value = ''
})

// Tolérance aux erreurs SSR : si une des requêtes échoue, la page se rend
// quand même et useRealtime/HMR rafraîchira côté client.
await Promise.allSettled([
  refresh(),
  refreshZones(),
  refreshWalls(),
  fetchBookingsRange(todayIso(), addDaysIso(todayIso(), 90)),
  fetchUnavailabilitiesRange(todayIso(), addDaysIso(todayIso(), 90)),
  refreshIssues(),
  refreshPrintFrame(),
  refreshLandmarks(),
  refreshLandmarkIcons()
]).then((results) => {
  for (const r of results) {
    if (r.status === 'rejected') console.error('[index] initial refresh failed', r.reason)
  }
})

onMounted(() => {
  ensureRealtime()
  ensureZonesRealtime()
  ensureWallsRealtime()
  ensureBookingsRealtime()
  ensureUnavailabilitiesRealtime()
  ensureIssuesRealtime()
  ensurePrintFrameRealtime()
  ensureLandmarksRealtime()
  ensureLandmarkIconsRealtime()
})

function openBookingFromCaravan() {
  if (!selectedCaravan.value) return
  bookingModalCaravan.value = selectedCaravan.value
  bookingModalOpen.value = true
}

function printPlan() {
  if (import.meta.client) window.print()
}

const planMapRef = ref<{ recenter: () => void } | null>(null)
function recenterMap() {
  planMapRef.value?.recenter()
}

async function moveCaravan(id: string, lat: number, lng: number) {
  try {
    await $fetch(`/api/caravans/${id}`, { method: 'PATCH', body: { lat, lng } })
  } catch (err) {
    toast.add({ title: 'Erreur lors du déplacement', description: errorMessage(err), color: 'error' })
  }
}

async function placeCaravanAt(lat: number, lng: number) {
  if (!newCaravanName.value.trim()) {
    toast.add({ title: 'Donnez un nom à la caravane avant de cliquer sur le plan.', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const created = await $fetch<{ id: string }>('/api/caravans', {
      method: 'POST',
      body: {
        name: newCaravanName.value.trim(),
        lat,
        lng,
        rotation: 0,
        width: 2.5,
        length: 6,
        hasElectricity: false
      }
    })
    selectedId.value = created.id
    placeMode.value = false
    newCaravanName.value = ''
    toast.add({ title: 'Caravane créée', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    creating.value = false
  }
}

async function createZone(points: Array<[number, number]>) {
  try {
    const created = await $fetch<{ id: string }>('/api/zones', {
      method: 'POST',
      body: {
        name: 'Nouvelle zone',
        color: draftZoneColor.value,
        points
      }
    })
    zoneDrawMode.value = false
    selectedZoneId.value = created.id
    toast.add({ title: 'Zone créée', description: 'Renomme-la dans le panneau.', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

async function updateZonePoints(id: string, points: Array<[number, number]>) {
  try {
    await $fetch(`/api/zones/${id}`, { method: 'PATCH', body: { points } })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

async function createWall(points: Array<[number, number]>) {
  try {
    const created = await $fetch<{ id: string }>('/api/walls', {
      method: 'POST',
      body: {
        color: draftWallColor.value,
        thickness: draftWallThickness.value,
        points
      }
    })
    wallDrawMode.value = false
    selectedWallId.value = created.id
    toast.add({ title: 'Mur créé', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

async function updateWallPoints(id: string, points: Array<[number, number]>) {
  try {
    await $fetch(`/api/walls/${id}`, { method: 'PATCH', body: { points } })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

// === Points de repère ===

// Bootstrap : si la bibliothèque est vide, on ne peut pas placer de repère
// (FK iconId NOT NULL). On ouvre alors un modal d'upload pour créer la 1re
// icône, puis on enchaîne sur le mode placement.
const landmarkBootstrapOpen = ref(false)
const landmarkBootstrapFile = ref<File | null>(null)
const landmarkBootstrapName = ref('')
const landmarkBootstrapUploading = ref(false)
const landmarkBootstrapInput = ref<HTMLInputElement | null>(null)

function onLandmarkButtonClick() {
  if (landmarkIcons.value.length === 0) {
    landmarkBootstrapOpen.value = true
    return
  }
  landmarkPlaceMode.value = true
}

function onLandmarkBootstrapFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 256 * 1024) {
    toast.add({ title: 'Fichier trop volumineux', description: 'Max 256 KB.', color: 'error' })
    target.value = ''
    return
  }
  landmarkBootstrapFile.value = file
  if (!landmarkBootstrapName.value.trim()) {
    landmarkBootstrapName.value = file.name.replace(/\.[^.]+$/, '').slice(0, 80)
  }
}

async function uploadFirstLandmarkIcon() {
  if (!landmarkBootstrapFile.value || !landmarkBootstrapName.value.trim()) return
  landmarkBootstrapUploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', landmarkBootstrapFile.value)
    fd.append('name', landmarkBootstrapName.value.trim())
    await $fetch('/api/landmark-icons', { method: 'POST', body: fd })
    landmarkBootstrapOpen.value = false
    landmarkBootstrapFile.value = null
    landmarkBootstrapName.value = ''
    if (landmarkBootstrapInput.value) landmarkBootstrapInput.value.value = ''
    landmarkPlaceMode.value = true
    toast.add({ title: 'Icône ajoutée', description: 'Cliquez sur le plan pour placer le repère.', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    landmarkBootstrapUploading.value = false
  }
}

async function placeLandmarkAt(lat: number, lng: number) {
  // Le mode placement n'est activable que si la bibliothèque a au moins
  // une icône (cf. bouton désactivé dans la barre admin), donc on prend
  // la première icône comme défaut. L'utilisateur la changera dans le panneau.
  const defaultIcon = landmarkIcons.value[0]
  if (!defaultIcon) {
    toast.add({ title: 'Téléversez d\'abord une icône', color: 'warning' })
    landmarkPlaceMode.value = false
    return
  }
  try {
    const created = await $fetch<{ id: string }>('/api/landmarks', {
      method: 'POST',
      body: {
        name: 'Nouveau repère',
        lat,
        lng,
        iconId: defaultIcon.id,
        sizePx: 32,
        color: defaultIcon.format === 'svg' ? '#1f2937' : null
      }
    })
    landmarkPlaceMode.value = false
    selectedLandmarkId.value = created.id
    toast.add({ title: 'Repère créé', description: 'Renomme-le dans le panneau.', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

async function moveLandmark(id: string, lat: number, lng: number) {
  try {
    await $fetch(`/api/landmarks/${id}`, { method: 'PATCH', body: { lat, lng } })
  } catch (err) {
    toast.add({ title: 'Erreur lors du déplacement', description: errorMessage(err), color: 'error' })
  }
}

// Aperçu live depuis le panneau d'édition : on mute la landmark
// sélectionnée en place. Le watcher deep dans usePlanLandmarks détecte la
// mutation et redessine le marker, sans attendre le PATCH/realtime.
function onLandmarkPreview(patch: { sizePx?: number, color?: string | null, iconId?: string }) {
  const lm = selectedLandmark.value
  if (!lm) return
  if (patch.sizePx !== undefined) lm.sizePx = patch.sizePx
  if (patch.color !== undefined) lm.color = patch.color
  if (patch.iconId !== undefined) lm.iconId = patch.iconId
}

// === Cadre PDF ===
const printFramePanelOpen = ref(false)
// Centre de la vue actuelle, mis à jour quand on ouvre le panneau pour
// "Créer au centre de la vue".
const mapCenter = ref<{ lat: number, lng: number } | null>(null)

function openPrintFramePanel() {
  // Approximation : on prend le centre par défaut de l'app si on ne peut pas
  // lire la vue Leaflet d'ici. PrintFrameEditPanel l'utilise uniquement pour
  // la création initiale du cadre.
  mapCenter.value = {
    lat: caravans.value[0]?.lat ?? Number(useRuntimeConfig().public.mapDefaultLat),
    lng: caravans.value[0]?.lng ?? Number(useRuntimeConfig().public.mapDefaultLng)
  }
  printFramePanelOpen.value = true
}

async function savePrintFrame(data: { lat: number, lng: number, widthMeters: number, rotation: number, orientation: 'landscape' | 'portrait' }) {
  try {
    const updated = await $fetch('/api/print-frame', { method: 'PUT', body: data })
    applyPrintFrameUpdate(updated)
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

async function deletePrintFrame() {
  try {
    await $fetch('/api/print-frame', { method: 'DELETE' })
    applyPrintFrameDelete()
    printFramePanelOpen.value = false
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

// Drags depuis la map → on persiste le delta concerné, en gardant les
// autres paramètres inchangés.
async function onPrintFrameMove(lat: number, lng: number) {
  if (!printFrame.value) return
  await savePrintFrame({
    lat,
    lng,
    widthMeters: printFrame.value.widthMeters,
    rotation: printFrame.value.rotation,
    orientation: printFrame.value.orientation
  })
}
async function onPrintFrameResize(widthMeters: number) {
  if (!printFrame.value) return
  await savePrintFrame({
    lat: printFrame.value.lat,
    lng: printFrame.value.lng,
    widthMeters,
    rotation: printFrame.value.rotation,
    orientation: printFrame.value.orientation
  })
}
async function onPrintFrameRotate(rotationDeg: number) {
  if (!printFrame.value) return
  await savePrintFrame({
    lat: printFrame.value.lat,
    lng: printFrame.value.lng,
    widthMeters: printFrame.value.widthMeters,
    rotation: rotationDeg,
    orientation: printFrame.value.orientation
  })
}
</script>

<template>
  <div
    class="relative h-[calc(100dvh-4rem)] w-full plan-map-print-root"
    :class="`print-orientation-${printFrame?.orientation ?? 'landscape'}`"
  >
    <div class="absolute top-3 left-3 z-1000 print:hidden flex items-center gap-2">
      <UButton
        variant="outline"
        size="sm"
        icon="i-lucide-printer"
        class="bg-default/90 backdrop-blur"
        @click="printPlan"
      >
        Imprimer / PDF
      </UButton>
      <UButton
        variant="outline"
        size="sm"
        icon="i-lucide-locate-fixed"
        class="bg-default/90 backdrop-blur"
        title="Recentrer la map"
        @click="recenterMap"
      />
    </div>
    <PlanMap
      ref="planMapRef"
      :caravans="caravans"
      :zones="zones"
      :walls="walls"
      :landmarks="landmarks"
      :landmark-icons="landmarkIcons"
      :bookings="bookings"
      :print-frame="printFrame"
      :print-frame-visible="canEdit"
      :selected-id="selectedId"
      :selected-zone-id="selectedZoneId"
      :selected-wall-id="selectedWallId"
      :selected-landmark-id="selectedLandmarkId"
      :can-edit="canEdit"
      :place-mode="placeMode"
      :zone-draw-mode="zoneDrawMode"
      :wall-draw-mode="wallDrawMode"
      :landmark-place-mode="landmarkPlaceMode"
      :draft-zone-color="draftZoneColor"
      :draft-wall-color="draftWallColor"
      :draft-wall-thickness="draftWallThickness"
      @select="selectedId = $event"
      @select-zone="selectedZoneId = $event"
      @select-wall="selectedWallId = $event"
      @select-landmark="selectedLandmarkId = $event"
      @move="moveCaravan"
      @place-at="placeCaravanAt"
      @place-landmark-at="placeLandmarkAt"
      @landmark-moved="moveLandmark"
      @zone-created="createZone"
      @zone-edited="updateZonePoints"
      @wall-created="createWall"
      @wall-edited="updateWallPoints"
      @print-frame-move="onPrintFrameMove"
      @print-frame-resize="onPrintFrameResize"
      @print-frame-rotate="onPrintFrameRotate"
    />

    <!-- Barre admin : switch mode édition (toujours visible pour ADMIN) puis
         actions de création quand le mode édition est activé. -->
    <div
      v-if="isAdmin"
      class="absolute top-3 left-1/2 -translate-x-1/2 z-1000 flex items-center gap-3 bg-default/90 backdrop-blur rounded-full shadow-md px-4 py-2 border border-default print:hidden"
    >
      <USwitch
        v-model="editMode"
        label="Mode édition"
      />

      <template v-if="editMode">
        <USeparator
          orientation="vertical"
          class="h-5"
        />
        <template v-if="placeMode">
          <UInput
            v-model="newCaravanName"
            placeholder="Nom de la caravane"
            size="sm"
            autofocus
          />
          <span class="text-xs text-muted hidden sm:inline">puis cliquez sur le plan</span>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="() => { placeMode = false; newCaravanName = '' }"
          >
            Annuler
          </UButton>
        </template>
        <template v-else-if="zoneDrawMode">
          <input
            v-model="draftZoneColor"
            type="color"
            class="w-7 h-7 rounded border border-default cursor-pointer"
            title="Couleur de la zone"
          >
          <span class="text-xs text-muted hidden sm:inline">cliquez les sommets, double-clic pour fermer</span>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="zoneDrawMode = false"
          >
            Annuler
          </UButton>
        </template>
        <template v-else-if="wallDrawMode">
          <input
            v-model="draftWallColor"
            type="color"
            class="w-7 h-7 rounded border border-default cursor-pointer"
            title="Couleur du mur"
          >
          <input
            v-model.number="draftWallThickness"
            type="range"
            min="1"
            max="20"
            step="1"
            class="w-24"
            :title="`Épaisseur (${draftWallThickness}px)`"
          >
          <span class="text-xs text-muted hidden sm:inline">cliquez les sommets, double-clic pour terminer</span>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="wallDrawMode = false"
          >
            Annuler
          </UButton>
        </template>
        <template v-else-if="landmarkPlaceMode">
          <span class="text-xs text-muted hidden sm:inline">cliquez sur le plan pour placer un repère</span>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="landmarkPlaceMode = false"
          >
            Annuler
          </UButton>
        </template>
        <template v-else>
          <UButton
            icon="i-lucide-plus"
            size="sm"
            @click="placeMode = true"
          >
            Caravane
          </UButton>
          <UButton
            icon="i-lucide-shapes"
            color="neutral"
            variant="soft"
            size="sm"
            @click="zoneDrawMode = true"
          >
            Zone
          </UButton>
          <UButton
            icon="i-lucide-minus"
            color="neutral"
            variant="soft"
            size="sm"
            @click="wallDrawMode = true"
          >
            Mur
          </UButton>
          <UButton
            icon="i-lucide-map-pin"
            color="neutral"
            variant="soft"
            size="sm"
            @click="onLandmarkButtonClick"
          >
            Repère
          </UButton>
          <UButton
            icon="i-lucide-square-dashed"
            color="neutral"
            variant="soft"
            size="sm"
            @click="openPrintFramePanel"
          >
            Cadre PDF
          </UButton>
        </template>
      </template>
    </div>

    <!-- Indicateur "aucun élément" -->
    <div
      v-if="isReady && zonesReady && wallsReady && caravans.length === 0 && zones.length === 0 && walls.length === 0 && landmarks.length === 0"
      class="absolute top-20 left-1/2 -translate-x-1/2 z-999 bg-default/90 backdrop-blur rounded-md shadow px-4 py-2 border border-default text-sm text-muted print:hidden"
    >
      Aucun élément sur le plan pour le moment.
      <span v-if="canEdit">Cliquez sur "Caravane", "Zone", "Mur" ou "Repère" pour commencer.</span>
      <span v-else-if="isAdmin">Activez le mode édition pour en ajouter.</span>
    </div>

    <!-- Panneau caravane : édition complète si mode édition, sinon liste des
         réservations à venir avec bouton de création (si MANAGER+). -->
    <USlideover
      :open="!!selectedCaravan"
      :ui="{ content: 'max-w-md w-full' }"
      @update:open="(v) => { if (!v) selectedId = null }"
    >
      <template #content>
        <CaravanEditPanel
          v-if="selectedCaravan && editMode"
          :caravan="selectedCaravan"
          :can-edit="canEdit"
          @close="selectedId = null"
          @preview="onPreview"
          @saved="previewDirty = false"
        />
        <CaravanBookingsPanel
          v-else-if="selectedCaravan"
          :caravan="selectedCaravan"
          :bookings="bookings"
          :unavailabilities="unavailabilities"
          :issues="issues"
          :can-manage="canCreateBooking"
          @close="selectedId = null"
          @add-booking="openBookingFromCaravan"
        />
      </template>
    </USlideover>

    <!-- Panneau d'édition zone : non-modal pour laisser la map interactive
         (drag des sommets via Geoman). Fermeture via la croix du panneau ou
         clic sur la map vide (qui set selectedZoneId à null). -->
    <USlideover
      :open="!!selectedZone"
      :modal="false"
      :dismissible="false"
      :ui="{ content: 'max-w-md w-full pointer-events-auto' }"
      @update:open="(v) => { if (!v) selectedZoneId = null }"
    >
      <template #content>
        <ZoneEditPanel
          v-if="selectedZone"
          :zone="selectedZone"
          :can-edit="canEdit"
          @close="selectedZoneId = null"
        />
      </template>
    </USlideover>

    <!-- Panneau d'édition mur : idem zone, non-modal pour laisser la map interactive. -->
    <USlideover
      :open="!!selectedWall"
      :modal="false"
      :dismissible="false"
      :ui="{ content: 'max-w-md w-full pointer-events-auto' }"
      @update:open="(v) => { if (!v) selectedWallId = null }"
    >
      <template #content>
        <WallEditPanel
          v-if="selectedWall"
          :wall="selectedWall"
          :can-edit="canEdit"
          @close="selectedWallId = null"
        />
      </template>
    </USlideover>

    <!-- Panneau d'édition d'un point de repère : non-modal (drag sur la map). -->
    <USlideover
      :open="!!selectedLandmark"
      :modal="false"
      :dismissible="false"
      :ui="{ content: 'max-w-md w-full pointer-events-auto' }"
      @update:open="(v) => { if (!v) selectedLandmarkId = null }"
    >
      <template #content>
        <LandmarkEditPanel
          v-if="selectedLandmark"
          :landmark="selectedLandmark"
          :icons="landmarkIcons"
          :can-edit="canEdit"
          @close="selectedLandmarkId = null"
          @preview="onLandmarkPreview"
          @icon-uploaded="applyLandmarkIconCreated"
          @icon-deleted="applyLandmarkIconDeleted"
        />
      </template>
    </USlideover>

    <!-- Bootstrap : upload de la 1re icône quand la bibliothèque est vide. -->
    <UModal v-model:open="landmarkBootstrapOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <h3 class="font-semibold text-lg flex items-center gap-2">
            <UIcon name="i-lucide-image-plus" />
            Première icône de repère
          </h3>
          <p class="text-sm text-muted">
            Pour créer un point de repère, il faut au moins une icône (PNG ou
            SVG, 256 KB max). Les SVG peuvent être recolorés via la palette.
          </p>
          <input
            ref="landmarkBootstrapInput"
            type="file"
            accept=".png,.svg,image/png,image/svg+xml"
            class="hidden"
            @change="onLandmarkBootstrapFile"
          >
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-upload"
              variant="outline"
              size="sm"
              @click="landmarkBootstrapInput?.click()"
            >
              Choisir un fichier
            </UButton>
            <span
              v-if="landmarkBootstrapFile"
              class="text-xs text-muted truncate"
            >{{ landmarkBootstrapFile.name }}</span>
          </div>
          <UInput
            v-if="landmarkBootstrapFile"
            v-model="landmarkBootstrapName"
            placeholder="Nom de l'icône"
            size="sm"
          />
          <div class="flex items-center justify-end gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              @click="landmarkBootstrapOpen = false"
            >
              Annuler
            </UButton>
            <UButton
              icon="i-lucide-check"
              size="sm"
              :disabled="!landmarkBootstrapFile || !landmarkBootstrapName.trim()"
              :loading="landmarkBootstrapUploading"
              @click="uploadFirstLandmarkIcon"
            >
              Ajouter et placer
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Panneau d'édition du cadre PDF (singleton). -->
    <USlideover
      v-model:open="printFramePanelOpen"
      :modal="false"
      :dismissible="false"
      :ui="{ content: 'max-w-md w-full pointer-events-auto' }"
    >
      <template #content>
        <PrintFrameEditPanel
          :frame="printFrame"
          :map-center="mapCenter"
          @close="printFramePanelOpen = false"
          @save="savePrintFrame"
          @remove="deletePrintFrame"
        />
      </template>
    </USlideover>

    <!-- Modal de création de réservation depuis une caravane -->
    <BookingCreateModal
      v-model:open="bookingModalOpen"
      :caravans="bookingModalCaravan ? [bookingModalCaravan] : []"
    />
  </div>
</template>
