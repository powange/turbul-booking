<script setup lang="ts">
import type { Booking, Caravan, Bed, CaravanUnavailability } from '~~/shared/types'
import { formatDayShort, formatDayNum, isWeekend, isToday } from '~/utils/dates'

const props = defineProps<{
  caravans: Caravan[]
  bookings: Booking[]
  unavailabilities: CaravanUnavailability[]
  dates: string[]
  /**
   * Caravanes à masquer côté écran. Le filtre n'altère pas le DOM rendu :
   * on applique juste une classe `caravan-row-filtered` qui passe en
   * `display: none` à l'écran. La règle `@media print` la neutralise pour
   * que le PDF montre toujours toutes les caravanes (cf. main.css).
   */
  hiddenCaravanIds?: Set<string>
}>()

const emit = defineEmits<{
  cellClick: [caravan: Caravan, bed: Bed, date: string]
}>()

// Index : "bedId|date" -> Booking[]
const bookingsByCell = computed(() => {
  const map = new Map<string, Booking[]>()
  for (const b of props.bookings) {
    const key = `${b.bedId}|${b.date}`
    const arr = map.get(key)
    if (arr) arr.push(b)
    else map.set(key, [b])
  }
  return map
})

function bookingsFor(bedId: string, date: string): Booking[] {
  return bookingsByCell.value.get(`${bedId}|${date}`) ?? []
}

// Pour chaque caravane, on trie ses indispos et on regarde si une couvre la date.
const unavByCaravan = computed(() => {
  const map = new Map<string, CaravanUnavailability[]>()
  for (const u of props.unavailabilities) {
    const arr = map.get(u.caravanId)
    if (arr) arr.push(u)
    else map.set(u.caravanId, [u])
  }
  return map
})

function unavailabilityFor(caravanId: string, date: string): CaravanUnavailability | null {
  const list = unavByCaravan.value.get(caravanId)
  if (!list) return null
  return list.find(u => u.from <= date && u.to > date) ?? null
}

function bedRowClass(bookings: Booking[], capacity: number) {
  const n = bookings.length
  if (n === 0) return 'bg-default hover:bg-muted'
  if (n >= capacity) return 'bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60'
  return 'bg-emerald-100 dark:bg-emerald-900/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/60'
}
</script>

<template>
  <div class="overflow-x-auto border border-default rounded-md">
    <table class="w-full text-sm border-collapse">
      <thead class="bg-elevated sticky top-0 z-10">
        <tr>
          <th class="text-left px-3 py-2 sticky left-0 bg-elevated z-20 min-w-[140px]">
            Caravane
          </th>
          <th class="text-left px-3 py-2 sticky left-[140px] bg-elevated z-20 min-w-[120px]">
            Lit
          </th>
          <th class="text-center px-2 py-2 w-12">
            Cap.
          </th>
          <th
            v-for="d in dates"
            :key="d"
            class="text-center px-2 py-2 min-w-[110px]"
            :class="{ 'bg-muted': isWeekend(d), 'ring-2 ring-inset ring-primary/40': isToday(d) }"
          >
            <div class="text-xs uppercase text-muted">
              {{ formatDayShort(d) }}
            </div>
            <div class="font-semibold">
              {{ formatDayNum(d) }}
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template
          v-for="caravan in caravans"
          :key="caravan.id"
        >
          <tr
            v-if="caravan.beds.length === 0"
            :class="{ 'caravan-row-filtered': hiddenCaravanIds?.has(caravan.id) }"
          >
            <td class="px-3 py-2 sticky left-0 bg-default font-medium">
              {{ caravan.name }}
            </td>
            <td
              colspan="100"
              class="px-3 py-2 text-muted italic"
            >
              Aucun lit défini.
            </td>
          </tr>
          <tr
            v-for="(bed, idx) in caravan.beds"
            :key="bed.id"
            class="border-t border-default"
            :class="{ 'caravan-row-filtered': hiddenCaravanIds?.has(caravan.id) }"
          >
            <td
              v-if="idx === 0"
              :rowspan="caravan.beds.length"
              class="px-3 py-2 sticky left-0 bg-default font-medium align-top border-r border-default"
            >
              <div class="flex items-center gap-2">
                <UIcon
                  v-if="caravan.hasElectricity"
                  name="i-lucide-zap"
                  class="text-amber-500"
                  title="Raccordée à l'électricité"
                />
                {{ caravan.name }}
              </div>
            </td>
            <td class="px-3 py-2 sticky left-[140px] bg-default border-r border-default">
              {{ bed.label }}
            </td>
            <td class="text-center px-2 py-2 text-muted">
              {{ bed.capacity }}
            </td>
            <template
              v-for="d in dates"
              :key="d"
            >
              <td
                v-if="unavailabilityFor(caravan.id, d)"
                class="unav-cell px-1 py-1 cursor-pointer text-center border-r border-default last:border-r-0"
                :title="unavailabilityFor(caravan.id, d)?.reason || 'Caravane indisponible'"
                @click="emit('cellClick', caravan, bed, d)"
              >
                <UIcon
                  name="i-lucide-ban"
                  class="size-5 mx-auto text-error"
                />
              </td>
              <td
                v-else
                class="px-1 py-1 cursor-pointer text-center text-xs border-r border-default last:border-r-0"
                :class="bedRowClass(bookingsFor(bed.id, d), bed.capacity)"
                @click="emit('cellClick', caravan, bed, d)"
              >
                <div
                  v-if="bookingsFor(bed.id, d).length === 0"
                  class="text-muted"
                >
                  —
                </div>
                <div
                  v-else
                  class="space-y-0.5"
                >
                  <div
                    v-for="b in bookingsFor(bed.id, d)"
                    :key="b.id"
                    class="truncate font-medium"
                    :title="`${b.guest?.firstName} ${b.guest?.lastName}`"
                  >
                    {{ b.guest?.firstName }} {{ b.guest?.lastName.charAt(0) }}.
                  </div>
                  <div
                    v-if="bookingsFor(bed.id, d).length < bed.capacity"
                    class="text-[10px] text-muted"
                  >
                    +{{ bed.capacity - bookingsFor(bed.id, d).length }} libre{{ bed.capacity - bookingsFor(bed.id, d).length > 1 ? 's' : '' }}
                  </div>
                </div>
              </td>
            </template>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
/* Cellule d'indisponibilité : motif de hachures diagonales pour distinguer
   visuellement d'une cellule libre. */
.unav-cell {
  background-image: repeating-linear-gradient(
    45deg,
    var(--ui-bg-muted, #e5e7eb) 0,
    var(--ui-bg-muted, #e5e7eb) 6px,
    var(--ui-bg-elevated, #f3f4f6) 6px,
    var(--ui-bg-elevated, #f3f4f6) 12px
  );
}
.dark .unav-cell {
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.04) 0,
    rgba(255, 255, 255, 0.04) 6px,
    rgba(255, 255, 255, 0.08) 6px,
    rgba(255, 255, 255, 0.08) 12px
  );
}
</style>
