<script setup lang="ts">
import type { CaravanIssue } from '~~/shared/types'

useHead({ title: 'Maintenance · Turbul Booking' })
definePageMeta({ middleware: ['manager'] })

const toast = useToast()

const { caravans, refresh: refreshCaravans, ensureRealtime: ensureCaravansRealtime } = useCaravans()
const {
  issues,
  refresh: refreshIssues,
  ensureRealtime: ensureIssuesRealtime,
  applyCreated: applyIssueCreated,
  applyUpdated: applyIssueUpdated,
  applyDeleted: applyIssueDeleted
} = useCaravanIssues()

await Promise.all([refreshCaravans(), refreshIssues()])

onMounted(() => {
  ensureCaravansRealtime()
  ensureIssuesRealtime()
})

const caravanById = computed(() => {
  const map = new Map<string, typeof caravans.value[number]>()
  for (const c of caravans.value) map.set(c.id, c)
  return map
})

// === Ajout ===
const newCaravanId = ref<string>('')
const newLabel = ref('')
const creating = ref(false)

const caravanCreateOptions = computed(() =>
  [...caravans.value]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(c => ({ label: c.name, value: c.id }))
)

async function createIssue() {
  if (!newCaravanId.value || !newLabel.value.trim()) return
  creating.value = true
  try {
    const created = await $fetch<CaravanIssue>(`/api/caravans/${newCaravanId.value}/issues`, {
      method: 'POST',
      body: { label: newLabel.value.trim() }
    })
    applyIssueCreated(created)
    newLabel.value = ''
    toast.add({ title: 'Problème ajouté', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    creating.value = false
  }
}

// === Filtres ===
type Status = 'open' | 'all' | 'resolved'
const statusFilter = ref<Status>('open')
const filterCaravanIds = ref<string[]>([])
const search = ref('')

const statusOptions = [
  { label: 'À traiter', value: 'open' },
  { label: 'Tous', value: 'all' },
  { label: 'Résolus', value: 'resolved' }
] as const

const filterCaravanOptions = computed(() =>
  [...caravans.value]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(c => ({ label: c.name, value: c.id }))
)

const filteredIssues = computed(() => {
  let items = [...issues.value]

  if (statusFilter.value === 'open') items = items.filter(i => !i.resolvedAt)
  else if (statusFilter.value === 'resolved') items = items.filter(i => i.resolvedAt)

  if (filterCaravanIds.value.length > 0) {
    const set = new Set(filterCaravanIds.value)
    items = items.filter(i => set.has(i.caravanId))
  }

  const q = search.value.trim().toLowerCase()
  if (q) items = items.filter(i => i.label.toLowerCase().includes(q))

  // Tri : ouverts d'abord (createdAt desc), puis résolus (resolvedAt desc)
  return items.sort((a, b) => {
    if (!a.resolvedAt && b.resolvedAt) return -1
    if (a.resolvedAt && !b.resolvedAt) return 1
    if (!a.resolvedAt && !b.resolvedAt) return b.createdAt.localeCompare(a.createdAt)
    return (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')
  })
})

function resetFilters() {
  statusFilter.value = 'open'
  filterCaravanIds.value = []
  search.value = ''
}

// === Actions sur un item ===
const togglingIds = ref<string[]>([])

async function toggleResolved(issue: CaravanIssue) {
  togglingIds.value = [...togglingIds.value, issue.id]
  try {
    const updated = await $fetch<CaravanIssue>(`/api/issues/${issue.id}`, {
      method: 'PATCH',
      body: { resolved: !issue.resolvedAt }
    })
    applyIssueUpdated(updated)
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    togglingIds.value = togglingIds.value.filter(id => id !== issue.id)
  }
}

const removingIds = ref<string[]>([])

async function removeIssue(issue: CaravanIssue) {
  if (!confirm(`Supprimer définitivement "${issue.label}" du journal ?`)) return
  removingIds.value = [...removingIds.value, issue.id]
  try {
    await $fetch(`/api/issues/${issue.id}`, { method: 'DELETE' })
    applyIssueDeleted(issue.id)
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    removingIds.value = removingIds.value.filter(id => id !== issue.id)
  }
}

// === Formatage ===
const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return dateFmt.format(new Date(iso))
}
</script>

<template>
  <UContainer class="py-6 space-y-4">
    <div class="flex flex-wrap items-center gap-2 justify-between">
      <div>
        <h1 class="text-xl font-semibold">
          Maintenance
        </h1>
        <p class="text-sm text-muted">
          Journal des problèmes signalés sur les caravanes.
        </p>
      </div>
    </div>

    <!-- Ajout d'un problème -->
    <UCard>
      <template #header>
        <h2 class="text-sm font-semibold flex items-center gap-2">
          <UIcon name="i-lucide-plus" />
          Signaler un nouveau problème
        </h2>
      </template>
      <form
        class="flex flex-wrap items-center gap-2"
        @submit.prevent="createIssue"
      >
        <USelect
          v-model="newCaravanId"
          :items="caravanCreateOptions"
          placeholder="Caravane…"
          class="min-w-48"
        />
        <UInput
          v-model="newLabel"
          placeholder="Décrire le problème…"
          class="flex-1 min-w-64"
        />
        <UButton
          type="submit"
          icon="i-lucide-plus"
          :loading="creating"
          :disabled="!newCaravanId || !newLabel.trim()"
        >
          Ajouter
        </UButton>
      </form>
    </UCard>

    <!-- Filtres -->
    <div class="flex flex-wrap items-center gap-2">
      <USelect
        v-model="statusFilter"
        :items="statusOptions"
        class="min-w-40"
      />
      <USelectMenu
        v-model="filterCaravanIds"
        :items="filterCaravanOptions"
        value-key="value"
        multiple
        :placeholder="filterCaravanIds.length === 0 ? 'Toutes les caravanes' : `${filterCaravanIds.length}/${caravans.length} sélectionnée(s)`"
        icon="i-lucide-filter"
        class="min-w-56"
      />
      <UInput
        v-model="search"
        placeholder="Rechercher dans les libellés…"
        icon="i-lucide-search"
        class="min-w-64"
      />
      <UButton
        v-if="statusFilter !== 'open' || filterCaravanIds.length > 0 || search"
        variant="ghost"
        icon="i-lucide-x"
        @click="resetFilters"
      >
        Réinitialiser
      </UButton>
    </div>

    <p class="text-sm text-muted">
      {{ filteredIssues.length }} problème{{ filteredIssues.length > 1 ? 's' : '' }} affiché{{ filteredIssues.length > 1 ? 's' : '' }}
    </p>

    <!-- Tableau -->
    <div class="overflow-x-auto border border-default rounded-md">
      <table class="w-full text-sm border-collapse">
        <thead class="bg-elevated">
          <tr>
            <th class="text-left px-3 py-2">
              Caravane
            </th>
            <th class="text-left px-3 py-2">
              Problème
            </th>
            <th class="text-center px-3 py-2 w-24">
              Statut
            </th>
            <th class="text-left px-3 py-2 w-44">
              Créé le
            </th>
            <th class="text-left px-3 py-2 w-44">
              Résolu le
            </th>
            <th class="text-center px-3 py-2 w-24">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="issue in filteredIssues"
            :key="issue.id"
            class="border-t border-default"
          >
            <td class="px-3 py-2">
              <NuxtLink
                :to="{ path: '/', query: { caravan: issue.caravanId } }"
                class="underline text-primary hover:opacity-80"
              >
                {{ caravanById.get(issue.caravanId)?.name ?? '?' }}
              </NuxtLink>
            </td>
            <td
              class="px-3 py-2"
              :class="issue.resolvedAt ? 'line-through text-muted' : ''"
            >
              {{ issue.label }}
            </td>
            <td class="px-3 py-2 text-center">
              <UBadge
                :color="issue.resolvedAt ? 'success' : 'warning'"
                variant="soft"
                size="sm"
              >
                {{ issue.resolvedAt ? 'Résolu' : 'À traiter' }}
              </UBadge>
            </td>
            <td class="px-3 py-2 text-muted">
              {{ fmtDate(issue.createdAt) }}
            </td>
            <td class="px-3 py-2 text-muted">
              {{ fmtDate(issue.resolvedAt) }}
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center justify-center gap-1">
                <UButton
                  :icon="issue.resolvedAt ? 'i-lucide-rotate-ccw' : 'i-lucide-check'"
                  :color="issue.resolvedAt ? 'neutral' : 'success'"
                  variant="ghost"
                  size="xs"
                  :loading="togglingIds.includes(issue.id)"
                  :title="issue.resolvedAt ? 'Réouvrir' : 'Marquer résolu'"
                  @click="toggleResolved(issue)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="removingIds.includes(issue.id)"
                  title="Supprimer"
                  @click="removeIssue(issue)"
                />
              </div>
            </td>
          </tr>
          <tr v-if="filteredIssues.length === 0">
            <td
              colspan="6"
              class="px-3 py-8 text-center text-muted italic"
            >
              Aucun problème ne correspond aux filtres.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UContainer>
</template>
