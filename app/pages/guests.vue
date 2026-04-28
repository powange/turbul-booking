<script setup lang="ts">
import type { Guest } from '~~/shared/types'
import { formatFullDate } from '~/utils/dates'

useHead({ title: 'Hôtes · Turbul Booking' })

const { search } = useGuests()

const query = ref('')
const guests = ref<Guest[]>([])
const loading = ref(false)

async function refresh() {
  loading.value = true
  try {
    guests.value = await search(query.value)
  } finally {
    loading.value = false
  }
}

await refresh()

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(refresh, 250)
})

interface GuestDetail extends Guest {
  bookings: Array<{
    id: string
    date: string
    bed: {
      id: string
      label: string
      caravan: { id: string, name: string, deletedAt: string | null }
    }
  }>
}

const selected = ref<GuestDetail | null>(null)
const detailOpen = ref(false)
const loadingDetail = ref(false)

async function open(g: Guest) {
  detailOpen.value = true
  loadingDetail.value = true
  try {
    selected.value = await $fetch<GuestDetail>(`/api/guests/${g.id}`)
  } finally {
    loadingDetail.value = false
  }
}

// Regroupe les nuitées consécutives en séjours pour l'affichage.
type Stay = {
  caravan: string
  caravanDeleted: boolean
  bed: string
  from: string
  to: string
  nights: number
}

const stays = computed<Stay[]>(() => {
  const list = selected.value?.bookings
  if (!list || list.length === 0) return []

  const sorted = [...list].sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)))
  const out: Stay[] = []
  let cur: Stay | null = null

  for (const b of sorted) {
    const dateIso = b.date.slice(0, 10)
    const sameBed = cur && cur.bed === b.bed.label && cur.caravan === b.bed.caravan.name
    const isNext = cur && nextDay(cur.to) === dateIso
    if (cur && sameBed && isNext) {
      cur.to = dateIso
      cur.nights++
    } else {
      if (cur) out.push(cur)
      cur = {
        caravan: b.bed.caravan.name,
        caravanDeleted: !!b.bed.caravan.deletedAt,
        bed: b.bed.label,
        from: dateIso,
        to: dateIso,
        nights: 1
      }
    }
  }
  if (cur) out.push(cur)
  return out.reverse() // plus récent en premier
})

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + 1)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const totalNights = computed(() => selected.value?.bookings.length ?? 0)
</script>

<template>
  <UContainer class="py-6 space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h1 class="text-xl font-semibold">
          Hôtes
        </h1>
        <p class="text-sm text-muted">
          {{ guests.length }} résultat{{ guests.length > 1 ? 's' : '' }}{{ guests.length === 50 ? ' (50 max)' : '' }}
        </p>
      </div>
      <UInput
        v-model="query"
        placeholder="Rechercher par nom, prénom ou email"
        icon="i-lucide-search"
        :loading="loading"
        class="w-80"
      />
    </div>

    <div class="border border-default rounded-md overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-elevated">
          <tr>
            <th class="text-left px-3 py-2">
              Nom
            </th>
            <th class="text-left px-3 py-2">
              Prénom
            </th>
            <th class="text-left px-3 py-2 hidden sm:table-cell">
              Email
            </th>
            <th class="text-left px-3 py-2 hidden md:table-cell">
              Téléphone
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!loading && guests.length === 0">
            <td
              colspan="4"
              class="px-3 py-6 text-center text-muted"
            >
              Aucun hôte n'a encore été enregistré.
            </td>
          </tr>
          <tr
            v-for="g in guests"
            :key="g.id"
            class="border-t border-default cursor-pointer hover:bg-muted/40"
            @click="open(g)"
          >
            <td class="px-3 py-2 font-medium">
              {{ g.lastName.toUpperCase() }}
            </td>
            <td class="px-3 py-2">
              {{ g.firstName }}
            </td>
            <td class="px-3 py-2 text-muted hidden sm:table-cell">
              {{ g.email ?? '—' }}
            </td>
            <td class="px-3 py-2 text-muted hidden md:table-cell">
              {{ g.phone ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <USlideover
      v-model:open="detailOpen"
      :ui="{ content: 'max-w-md w-full' }"
    >
      <template #content>
        <div class="flex flex-col h-full">
          <div class="px-4 py-3 border-b border-default flex items-center justify-between">
            <div v-if="selected">
              <h2 class="font-semibold text-lg">
                {{ selected.lastName.toUpperCase() }} {{ selected.firstName }}
              </h2>
              <p class="text-xs text-muted">
                {{ totalNights }} nuit{{ totalNights > 1 ? 's' : '' }} cumulée{{ totalNights > 1 ? 's' : '' }}
              </p>
            </div>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              @click="detailOpen = false"
            />
          </div>

          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <div
              v-if="loadingDetail"
              class="text-muted text-sm"
            >
              Chargement...
            </div>
            <template v-else-if="selected">
              <div
                v-if="selected.email || selected.phone"
                class="text-sm text-muted space-y-0.5"
              >
                <div v-if="selected.email">
                  <UIcon
                    name="i-lucide-mail"
                    class="inline mr-1"
                  />{{ selected.email }}
                </div>
                <div v-if="selected.phone">
                  <UIcon
                    name="i-lucide-phone"
                    class="inline mr-1"
                  />{{ selected.phone }}
                </div>
              </div>

              <div>
                <h3 class="text-sm font-semibold text-muted mb-2">
                  Séjours
                </h3>
                <p
                  v-if="stays.length === 0"
                  class="text-sm text-muted"
                >
                  Aucun séjour enregistré.
                </p>
                <ul
                  v-else
                  class="space-y-2"
                >
                  <li
                    v-for="(s, i) in stays"
                    :key="i"
                    class="rounded-md border border-default p-3 text-sm"
                  >
                    <div class="font-medium">
                      {{ s.caravan }}
                      <UBadge
                        v-if="s.caravanDeleted"
                        label="retirée"
                        size="xs"
                        color="neutral"
                        variant="subtle"
                        class="ml-1"
                      />
                      — {{ s.bed }}
                    </div>
                    <div class="text-muted text-xs mt-0.5">
                      {{ s.nights }} nuit{{ s.nights > 1 ? 's' : '' }} ·
                      <span v-if="s.from === s.to">{{ formatFullDate(s.from) }}</span>
                      <span v-else>du {{ formatFullDate(s.from) }} au {{ formatFullDate(s.to) }}</span>
                    </div>
                  </li>
                </ul>
              </div>
            </template>
          </div>
        </div>
      </template>
    </USlideover>
  </UContainer>
</template>
