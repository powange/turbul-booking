<script setup lang="ts">
import type { Bed, Caravan } from '~~/shared/types'
import { addDaysIso, formatFullDate, rangeDays, todayIso } from '~/utils/dates'

useHead({ title: 'Réservations · Turbul Booking' })

const { hasRole } = useAuth()
const canEdit = computed(() => hasRole('MANAGER'))

const { caravans, refresh: refreshCaravans, ensureRealtime: ensureCaravansRealtime } = useCaravans()
const { bookings, fetchRange, ensureRealtime: ensureBookingsRealtime } = useBookings()

const startIso = ref(todayIso())
const days = ref(7)

const fromIso = computed(() => startIso.value)
const toIso = computed(() => addDaysIso(startIso.value, days.value))
const dates = computed(() => rangeDays(fromIso.value, toIso.value))

await refreshCaravans()
await fetchRange(fromIso.value, toIso.value)

watch([fromIso, toIso], async ([f, t]) => {
  await fetchRange(f, t)
})

onMounted(() => {
  ensureCaravansRealtime()
  ensureBookingsRealtime()
})

// Modals
const createOpen = ref(false)
const detailsOpen = ref(false)
const presetBedId = ref<string | null>(null)
const presetFrom = ref<string | null>(null)
const presetTo = ref<string | null>(null)
const detailsCaravan = ref<Caravan | null>(null)
const detailsBed = ref<Bed | null>(null)
const detailsDate = ref<string | null>(null)

const detailsBookings = computed(() => {
  if (!detailsBed.value || !detailsDate.value) return []
  return bookings.value.filter(b => b.bedId === detailsBed.value!.id && b.date === detailsDate.value)
})

function onCellClick(caravan: Caravan, bed: Bed, date: string) {
  detailsCaravan.value = caravan
  detailsBed.value = bed
  detailsDate.value = date
  detailsOpen.value = true
}

function openCreateFromDetails() {
  presetBedId.value = detailsBed.value?.id ?? null
  presetFrom.value = detailsDate.value
  presetTo.value = detailsDate.value ? addDaysIso(detailsDate.value, 1) : null
  detailsOpen.value = false
  createOpen.value = true
}

function openCreateBlank() {
  presetBedId.value = null
  presetFrom.value = todayIso()
  presetTo.value = addDaysIso(todayIso(), 1)
  createOpen.value = true
}

function shiftDays(delta: number) {
  startIso.value = addDaysIso(startIso.value, delta)
}

function goToday() {
  startIso.value = todayIso()
}

const dayOptions = [
  { label: '3 jours', value: 3 },
  { label: '7 jours', value: 7 },
  { label: '14 jours', value: 14 },
  { label: '30 jours', value: 30 }
]
</script>

<template>
  <UContainer class="py-6 space-y-4">
    <div class="flex flex-wrap items-center gap-2 justify-between">
      <div>
        <h1 class="text-xl font-semibold">Réservations</h1>
        <p class="text-sm text-muted">
          Du {{ formatFullDate(fromIso) }} au {{ formatFullDate(addDaysIso(toIso, -1)) }}
        </p>
      </div>
      <UButton
        v-if="canEdit"
        icon="i-lucide-plus"
        @click="openCreateBlank"
      >
        Nouvelle réservation
      </UButton>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <UFieldGroup>
        <UButton icon="i-lucide-chevron-left" variant="outline" @click="shiftDays(-days)" />
        <UButton variant="outline" @click="goToday">Aujourd'hui</UButton>
        <UButton icon="i-lucide-chevron-right" variant="outline" @click="shiftDays(days)" />
      </UFieldGroup>

      <UInput v-model="startIso" type="date" />

      <USelect v-model="days" :items="dayOptions" />
    </div>

    <BookingsGrid
      :caravans="caravans"
      :bookings="bookings"
      :dates="dates"
      @cell-click="onCellClick"
    />

    <p v-if="caravans.length === 0" class="text-sm text-muted">
      Aucune caravane n'est définie pour le moment. Allez sur le <NuxtLink to="/" class="underline">plan</NuxtLink> pour en ajouter.
    </p>

    <BookingCellDetailsModal
      v-model:open="detailsOpen"
      :caravan="detailsCaravan"
      :bed="detailsBed"
      :date="detailsDate"
      :bookings="detailsBookings"
      :can-edit="canEdit"
      @add="openCreateFromDetails"
    />

    <BookingCreateModal
      v-model:open="createOpen"
      :caravans="caravans"
      :preset-bed-id="presetBedId"
      :preset-from="presetFrom"
      :preset-to="presetTo"
      @created="() => { /* WS push the update */ }"
    />
  </UContainer>
</template>
