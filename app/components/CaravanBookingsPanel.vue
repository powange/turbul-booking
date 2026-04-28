<script setup lang="ts">
import type { Bed, Booking, Caravan, CaravanUnavailability } from '~~/shared/types'
import { addDaysIso, formatFullDate, todayIso } from '~/utils/dates'

const props = defineProps<{
  caravan: Caravan
  bookings: Booking[]
  unavailabilities: CaravanUnavailability[]
  canManage: boolean
}>()

const emit = defineEmits<{
  close: []
  addBooking: []
}>()

const toast = useToast()
const { applyBedUpdate } = useCaravans()
const { applyCreated: applyUnavailabilityCreated, applyDeleted: applyUnavailabilityDeleted } = useUnavailabilities()

const bedIds = computed(() => new Set(props.caravan.beds.map(b => b.id)))

const groupedBookings = computed(() => {
  const today = todayIso()
  const upcoming = props.bookings
    .filter(b => bedIds.value.has(b.bedId) && b.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return props.caravan.beds.map(bed => ({
    bed,
    bookings: upcoming.filter(b => b.bedId === bed.id)
  }))
})

const totalUpcoming = computed(() =>
  groupedBookings.value.reduce((s, g) => s + g.bookings.length, 0)
)

// Switch "Raccordée à l'électricité" — éditable MANAGER+ via PATCH dédié
// (le serveur autorise MANAGER quand seul ce champ est dans le body).
const electricity = ref(props.caravan.hasElectricity)
watch(() => props.caravan.id, () => { electricity.value = props.caravan.hasElectricity })
watch(() => props.caravan.hasElectricity, (v) => { electricity.value = v })

const savingElectricity = ref(false)
let electricityTimer: ReturnType<typeof setTimeout> | null = null

watch(electricity, (v) => {
  if (!props.canManage) return
  if (v === props.caravan.hasElectricity) return
  if (electricityTimer) clearTimeout(electricityTimer)
  electricityTimer = setTimeout(async () => {
    savingElectricity.value = true
    try {
      await $fetch(`/api/caravans/${props.caravan.id}`, {
        method: 'PATCH',
        body: { hasElectricity: v }
      })
    } catch (err: any) {
      electricity.value = props.caravan.hasElectricity
      toast.add({
        title: 'Erreur',
        description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
        color: 'error'
      })
    } finally {
      savingElectricity.value = false
    }
  }, 250)
})

// Toggle "Linge propre" par lit — éditable MANAGER+ via PATCH dédié
// (le serveur autorise MANAGER quand seul ce champ est dans le body).
const togglingLinenIds = ref<string[]>([])

async function toggleLinen(bedId: string, current: boolean) {
  if (!props.canManage) return
  togglingLinenIds.value = [...togglingLinenIds.value, bedId]
  try {
    const updated = await $fetch<Bed>(`/api/beds/${bedId}`, {
      method: 'PATCH',
      body: { hasCleanLinen: !current }
    })
    // Mise à jour locale immédiate ; le broadcast WS qui suit fera juste
    // un no-op (state déjà à jour).
    applyBedUpdate(updated)
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    togglingLinenIds.value = togglingLinenIds.value.filter(id => id !== bedId)
  }
}

// ===== Indisponibilités =====
const caravanUnavailabilities = computed(() =>
  props.unavailabilities
    .filter(u => u.caravanId === props.caravan.id)
    .filter(u => u.to > todayIso()) // on cache les indispos déjà passées
    .sort((a, b) => a.from.localeCompare(b.from))
)

const showUnavForm = ref(false)
const unavForm = reactive({ from: todayIso(), to: addDaysIso(todayIso(), 1), reason: '' })
const creatingUnav = ref(false)

watch(showUnavForm, (open) => {
  if (open) {
    unavForm.from = todayIso()
    unavForm.to = addDaysIso(todayIso(), 1)
    unavForm.reason = ''
  }
})

async function createUnavailability() {
  if (!props.canManage) return
  if (!unavForm.from || !unavForm.to || unavForm.to <= unavForm.from) {
    toast.add({ title: 'Période invalide', description: 'La date de fin doit être postérieure à la date de début.', color: 'error' })
    return
  }
  creatingUnav.value = true
  try {
    const created = await $fetch<CaravanUnavailability>(
      `/api/caravans/${props.caravan.id}/unavailabilities`,
      {
        method: 'POST',
        body: {
          from: unavForm.from,
          to: unavForm.to,
          reason: unavForm.reason.trim() || undefined
        }
      }
    )
    applyUnavailabilityCreated(created)
    showUnavForm.value = false
    toast.add({ title: 'Indisponibilité enregistrée', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    creatingUnav.value = false
  }
}

const removingUnavIds = ref<string[]>([])

async function removeUnavailability(u: CaravanUnavailability) {
  if (!props.canManage) return
  if (!confirm(`Lever l'indisponibilité du ${formatFullDate(u.from)} au ${formatFullDate(addDaysIso(u.to, -1))} ?`)) return
  removingUnavIds.value = [...removingUnavIds.value, u.id]
  try {
    await $fetch(`/api/unavailabilities/${u.id}`, { method: 'DELETE' })
    applyUnavailabilityDeleted(u.id, u.caravanId)
    toast.add({ title: 'Indisponibilité levée', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    removingUnavIds.value = removingUnavIds.value.filter(id => id !== u.id)
  }
}

// Caravane bloquée actuellement (pour désactiver "Ajouter une réservation")
const isBlockedNow = computed(() => {
  const today = todayIso()
  return caravanUnavailabilities.value.some(u => u.from <= today && u.to > today)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between">
      <div class="min-w-0">
        <h2 class="font-semibold text-lg truncate">
          {{ caravan.name }}
        </h2>
        <p class="text-xs text-muted">
          {{ totalUpcoming }} nuit{{ totalUpcoming > 1 ? 's' : '' }} à venir
          · {{ caravan.beds.length }} lit{{ caravan.beds.length > 1 ? 's' : '' }}
        </p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        @click="emit('close')"
      />
    </div>

    <div class="px-4 py-3 border-b border-default flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm">
        <UIcon
          name="i-lucide-zap"
          class="text-muted"
        />
        <span>Raccordée à l'électricité</span>
        <UIcon
          v-if="savingElectricity"
          name="i-lucide-loader-circle"
          class="animate-spin text-muted"
        />
      </div>
      <USwitch
        v-model="electricity"
        :disabled="!canManage"
      />
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-5">
      <p
        v-if="caravan.beds.length === 0"
        class="text-sm text-muted"
      >
        Cette caravane n'a pas encore de lit défini.
      </p>

      <section
        v-for="group in groupedBookings"
        :key="group.bed.id"
        class="space-y-2"
      >
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold flex items-center gap-2">
            <UIcon
              name="i-lucide-bed"
              class="text-muted"
            />
            {{ group.bed.label }}
            <span class="text-xs text-muted font-normal">
              ({{ group.bed.capacity }} place{{ group.bed.capacity > 1 ? 's' : '' }})
            </span>
          </h3>
          <div class="flex items-center gap-2 text-xs text-muted">
            <span>Linge propre</span>
            <UIcon
              v-if="togglingLinenIds.includes(group.bed.id)"
              name="i-lucide-loader-circle"
              class="animate-spin"
            />
            <USwitch
              :model-value="group.bed.hasCleanLinen"
              :disabled="!canManage"
              size="xs"
              @update:model-value="toggleLinen(group.bed.id, group.bed.hasCleanLinen)"
            />
          </div>
        </div>

        <ul
          v-if="group.bookings.length"
          class="space-y-1.5"
        >
          <li
            v-for="b in group.bookings"
            :key="b.id"
            class="flex items-center justify-between gap-2 rounded-md border border-default px-3 py-2 text-sm"
          >
            <span class="truncate">{{ formatFullDate(b.date) }}</span>
            <span
              v-if="b.guest"
              class="text-muted text-xs whitespace-nowrap"
            >
              {{ b.guest.lastName.toUpperCase() }} {{ b.guest.firstName }}
            </span>
          </li>
        </ul>
        <p
          v-else
          class="text-xs text-muted italic"
        >
          Aucune nuit réservée à venir.
        </p>
      </section>

      <USeparator v-if="caravan.beds.length > 0" />

      <!-- Indisponibilités -->
      <section class="space-y-2">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold flex items-center gap-2">
            <UIcon
              name="i-lucide-ban"
              class="text-muted"
            />
            Indisponibilités
          </h3>
          <UButton
            v-if="canManage && !showUnavForm"
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            @click="showUnavForm = true"
          >
            Bloquer une période
          </UButton>
        </div>

        <div
          v-if="showUnavForm"
          class="rounded-md border border-default p-3 space-y-3 bg-elevated"
        >
          <div class="grid grid-cols-2 gap-2">
            <UFormField
              label="Du"
              required
            >
              <UInput
                v-model="unavForm.from"
                type="date"
                size="sm"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Au (exclu)"
              required
              help="Premier jour redevenu disponible"
            >
              <UInput
                v-model="unavForm.to"
                type="date"
                size="sm"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Motif (optionnel)">
            <UInput
              v-model="unavForm.reason"
              placeholder="ex : Maintenance"
              size="sm"
              class="w-full"
            />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton
              size="xs"
              variant="ghost"
              :disabled="creatingUnav"
              @click="showUnavForm = false"
            >
              Annuler
            </UButton>
            <UButton
              size="xs"
              :loading="creatingUnav"
              @click="createUnavailability"
            >
              Bloquer
            </UButton>
          </div>
        </div>

        <ul
          v-if="caravanUnavailabilities.length"
          class="space-y-1.5"
        >
          <li
            v-for="u in caravanUnavailabilities"
            :key="u.id"
            class="flex items-center justify-between gap-2 rounded-md border border-default px-3 py-2 text-sm"
          >
            <div class="min-w-0">
              <div class="truncate">
                Du {{ formatFullDate(u.from) }} au {{ formatFullDate(addDaysIso(u.to, -1)) }}
              </div>
              <div
                v-if="u.reason"
                class="text-xs text-muted truncate"
              >
                {{ u.reason }}
              </div>
            </div>
            <UButton
              v-if="canManage"
              icon="i-lucide-x"
              color="error"
              variant="ghost"
              size="xs"
              :loading="removingUnavIds.includes(u.id)"
              title="Lever l'indisponibilité"
              @click="removeUnavailability(u)"
            />
          </li>
        </ul>
        <p
          v-else-if="!showUnavForm"
          class="text-xs text-muted italic"
        >
          Aucune indisponibilité.
        </p>
      </section>
    </div>

    <div
      v-if="canManage && caravan.beds.length > 0"
      class="px-4 py-3 border-t border-default"
    >
      <UButton
        block
        icon="i-lucide-plus"
        :disabled="isBlockedNow"
        :title="isBlockedNow ? 'Caravane indisponible actuellement' : undefined"
        @click="emit('addBooking')"
      >
        Ajouter une réservation
      </UButton>
    </div>
  </div>
</template>
