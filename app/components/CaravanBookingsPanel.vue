<script setup lang="ts">
import type { Booking, Caravan } from '~~/shared/types'
import { formatFullDate, todayIso } from '~/utils/dates'

const props = defineProps<{
  caravan: Caravan
  bookings: Booking[]
  canManage: boolean
}>()

const emit = defineEmits<{
  close: []
  addBooking: []
}>()

const toast = useToast()

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
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between">
      <div class="min-w-0">
        <h2 class="font-semibold text-lg truncate">{{ caravan.name }}</h2>
        <p class="text-xs text-muted">
          {{ totalUpcoming }} nuit{{ totalUpcoming > 1 ? 's' : '' }} à venir
          · {{ caravan.beds.length }} lit{{ caravan.beds.length > 1 ? 's' : '' }}
        </p>
      </div>
      <UButton icon="i-lucide-x" color="neutral" variant="ghost" @click="emit('close')" />
    </div>

    <div class="px-4 py-3 border-b border-default flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm">
        <UIcon name="i-lucide-zap" class="text-muted" />
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
      <p v-if="caravan.beds.length === 0" class="text-sm text-muted">
        Cette caravane n'a pas encore de lit défini.
      </p>

      <section
        v-for="group in groupedBookings"
        :key="group.bed.id"
        class="space-y-2"
      >
        <h3 class="text-sm font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-bed" class="text-muted" />
          {{ group.bed.label }}
          <span class="text-xs text-muted font-normal">
            ({{ group.bed.capacity }} place{{ group.bed.capacity > 1 ? 's' : '' }})
          </span>
        </h3>

        <ul v-if="group.bookings.length" class="space-y-1.5">
          <li
            v-for="b in group.bookings"
            :key="b.id"
            class="flex items-center justify-between gap-2 rounded-md border border-default px-3 py-2 text-sm"
          >
            <span class="truncate">{{ formatFullDate(b.date) }}</span>
            <span v-if="b.guest" class="text-muted text-xs whitespace-nowrap">
              {{ b.guest.lastName.toUpperCase() }} {{ b.guest.firstName }}
            </span>
          </li>
        </ul>
        <p v-else class="text-xs text-muted italic">
          Aucune nuit réservée à venir.
        </p>
      </section>
    </div>

    <div v-if="canManage && caravan.beds.length > 0" class="px-4 py-3 border-t border-default">
      <UButton
        block
        icon="i-lucide-plus"
        @click="emit('addBooking')"
      >
        Ajouter une réservation
      </UButton>
    </div>
  </div>
</template>
