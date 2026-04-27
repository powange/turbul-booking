<script setup lang="ts">
import { addDaysIso, todayIso } from '~/utils/dates'
import type { Caravan } from '~~/shared/types'

useHead({ title: 'Plan · Turbul Booking' })

const { hasRole } = useAuth()
const isAdmin = computed(() => hasRole('ADMIN'))
const canCreateBooking = computed(() => hasRole('MANAGER'))

// Mode édition (admin uniquement) : off par défaut. Le clic caravane ouvre la
// liste des réservations à venir, pas le panneau d'édition.
const editMode = ref(false)
const canEdit = computed(() => isAdmin.value && editMode.value)

const { caravans, isReady, refresh, ensureRealtime } = useCaravans()
const { zones, isReady: zonesReady, refresh: refreshZones, ensureRealtime: ensureZonesRealtime } = useZones()
const { bookings, fetchRange: fetchBookingsRange, ensureRealtime: ensureBookingsRealtime } = useBookings()

const selectedId = ref<string | null>(null)
const placeMode = ref(false)
const creating = ref(false)
const newCaravanName = ref('')

const selectedZoneId = ref<string | null>(null)
const zoneDrawMode = ref(false)
const draftZoneColor = ref('#3b82f6')

const bookingModalOpen = ref(false)
const bookingModalCaravan = ref<Caravan | null>(null)

const selectedCaravan = computed(() => caravans.value.find(c => c.id === selectedId.value) ?? null)
const selectedZone = computed(() => zones.value.find(z => z.id === selectedZoneId.value) ?? null)

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
    zoneDrawMode.value = false
    placeMode.value = false
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
    zoneDrawMode.value = false
    placeMode.value = false
  }
})

watch(zoneDrawMode, (mode) => {
  if (mode) {
    selectedId.value = null
    selectedZoneId.value = null
    placeMode.value = false
  }
})

watch(placeMode, (mode) => {
  if (mode) {
    selectedId.value = null
    selectedZoneId.value = null
    zoneDrawMode.value = false
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
  selectedZoneId.value = null
  newCaravanName.value = ''
})

// Tolérance aux erreurs SSR : si une des requêtes échoue, la page se rend
// quand même et useRealtime/HMR rafraîchira côté client.
await Promise.allSettled([
  refresh(),
  refreshZones(),
  fetchBookingsRange(todayIso(), addDaysIso(todayIso(), 90))
]).then((results) => {
  for (const r of results) {
    if (r.status === 'rejected') console.error('[index] initial refresh failed', r.reason)
  }
})

onMounted(() => {
  ensureRealtime()
  ensureZonesRealtime()
  ensureBookingsRealtime()
})

function openBookingFromCaravan() {
  if (!selectedCaravan.value) return
  bookingModalCaravan.value = selectedCaravan.value
  bookingModalOpen.value = true
}

async function moveCaravan(id: string, lat: number, lng: number) {
  try {
    await $fetch(`/api/caravans/${id}`, { method: 'PATCH', body: { lat, lng } })
  } catch (err: any) {
    toast.add({ title: 'Erreur lors du déplacement', description: err?.statusMessage ?? String(err), color: 'error' })
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
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err?.statusMessage ?? String(err), color: 'error' })
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
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err?.statusMessage ?? String(err), color: 'error' })
  }
}

async function updateZonePoints(id: string, points: Array<[number, number]>) {
  try {
    await $fetch(`/api/zones/${id}`, { method: 'PATCH', body: { points } })
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err?.statusMessage ?? String(err), color: 'error' })
  }
}
</script>

<template>
  <div class="relative h-[calc(100dvh-4rem)] w-full">
    <PlanMap
      :caravans="caravans"
      :zones="zones"
      :selected-id="selectedId"
      :selected-zone-id="selectedZoneId"
      :can-edit="canEdit"
      :place-mode="placeMode"
      :zone-draw-mode="zoneDrawMode"
      :draft-zone-color="draftZoneColor"
      @select="selectedId = $event"
      @select-zone="selectedZoneId = $event"
      @move="moveCaravan"
      @place-at="placeCaravanAt"
      @zone-created="createZone"
      @zone-edited="updateZonePoints"
    />

    <!-- Barre admin : switch mode édition (toujours visible pour ADMIN) puis
         actions de création quand le mode édition est activé. -->
    <div
      v-if="isAdmin"
      class="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-default/90 backdrop-blur rounded-full shadow-md px-4 py-2 border border-default"
    >
      <USwitch v-model="editMode" label="Mode édition" />

      <template v-if="editMode">
        <USeparator orientation="vertical" class="h-5" />
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
        </template>
      </template>
    </div>

    <!-- Indicateur "aucune caravane" -->
    <div
      v-if="isReady && zonesReady && caravans.length === 0 && zones.length === 0"
      class="absolute top-20 left-1/2 -translate-x-1/2 z-[999] bg-default/90 backdrop-blur rounded-md shadow px-4 py-2 border border-default text-sm text-muted"
    >
      Aucune caravane sur le plan pour le moment.
      <span v-if="canEdit">Cliquez sur "Caravane" ou "Zone" pour commencer.</span>
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

    <!-- Modal de création de réservation depuis une caravane -->
    <BookingCreateModal
      v-model:open="bookingModalOpen"
      :caravans="bookingModalCaravan ? [bookingModalCaravan] : []"
    />
  </div>
</template>
