<script setup lang="ts">
import { addDaysIso, todayIso } from '~/utils/dates'

useHead({ title: 'Journal d\'audit · Turbul Booking' })

definePageMeta({ middleware: ['admin'] })

interface AuditLog {
  id: string
  userId: string | null
  action: string
  entityType: string
  entityId: string | null
  payload: Record<string, unknown> | null
  createdAt: string
  user: { id: string, name: string, email: string, role: string } | null
}

interface ListResponse {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
}

const filters = reactive({
  from: addDaysIso(todayIso(), -30),
  to: todayIso(),
  action: '' as string,
  entityType: '' as string,
  userId: '' as string
})

const page = ref(1)
const pageSize = 50

interface DistinctResponse {
  actions: string[]
  entityTypes: string[]
  users: { id: string, name: string, email: string, role: string }[]
}

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

const { data: distinct } = await useFetch<DistinctResponse>('/api/audit-logs/distinct', { headers })
const { data, refresh: refreshLogs, status } = await useFetch<ListResponse>('/api/audit-logs', {
  query: computed(() => ({
    from: filters.from || undefined,
    to: filters.to || undefined,
    action: filters.action || undefined,
    entityType: filters.entityType || undefined,
    userId: filters.userId || undefined,
    page: page.value,
    pageSize
  })),
  headers,
  watch: false
})

watch([filters, page], () => refreshLogs(), { deep: true })

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / pageSize)))

const actionOptions = computed(() => [
  { label: 'Toutes', value: '' },
  ...((distinct.value?.actions ?? []).map(a => ({ label: a, value: a })))
])

const entityOptions = computed(() => [
  { label: 'Toutes', value: '' },
  ...((distinct.value?.entityTypes ?? []).map(e => ({ label: e, value: e })))
])

const userOptions = computed(() => [
  { label: 'Tous', value: '' },
  ...((distinct.value?.users ?? []).map(u => ({ label: `${u.name} (${u.email})`, value: u.id })))
])

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
function fmtDate(d: string) {
  return dateFmt.format(new Date(d))
}

const ACTION_COLOR: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'info'> = {
  CARAVAN_CREATE: 'success',
  CARAVAN_UPDATE: 'primary',
  CARAVAN_DELETE: 'error',
  BED_CREATE: 'success',
  BED_UPDATE: 'primary',
  BED_DELETE: 'error',
  BOOKING_CREATE: 'success',
  BOOKING_DELETE: 'error',
  GUEST_CREATE: 'success',
  GUEST_UPDATE: 'primary',
  USER_CREATE: 'success',
  USER_UPDATE: 'primary',
  USER_DELETE: 'error',
  USER_PASSWORD_RESET: 'warning'
}
function actionColor(a: string) {
  return ACTION_COLOR[a] ?? 'info'
}

function resetFilters() {
  filters.from = addDaysIso(todayIso(), -30)
  filters.to = todayIso()
  filters.action = ''
  filters.entityType = ''
  filters.userId = ''
  page.value = 1
}

const expanded = ref<Set<string>>(new Set())
function toggle(id: string) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
}
</script>

<template>
  <UContainer class="py-6 space-y-4">
    <div>
      <h1 class="text-xl font-semibold">
        Journal d'audit
      </h1>
      <p class="text-sm text-muted">
        {{ data?.total ?? 0 }} action{{ (data?.total ?? 0) > 1 ? 's' : '' }} enregistrée{{ (data?.total ?? 0) > 1 ? 's' : '' }} sur la période sélectionnée
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 border border-default rounded-md">
      <UFormField label="Du">
        <UInput
          v-model="filters.from"
          type="date"
        />
      </UFormField>
      <UFormField label="Au (inclus)">
        <UInput
          v-model="filters.to"
          type="date"
        />
      </UFormField>
      <UFormField label="Action">
        <USelect
          v-model="filters.action"
          :items="actionOptions"
        />
      </UFormField>
      <UFormField label="Entité">
        <USelect
          v-model="filters.entityType"
          :items="entityOptions"
        />
      </UFormField>
      <UFormField label="Utilisateur">
        <USelect
          v-model="filters.userId"
          :items="userOptions"
        />
      </UFormField>
      <div class="sm:col-span-2 lg:col-span-5 flex justify-end">
        <UButton
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          @click="resetFilters"
        >
          Réinitialiser
        </UButton>
      </div>
    </div>

    <div class="border border-default rounded-md overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-elevated">
          <tr>
            <th class="text-left px-3 py-2 w-40">
              Date
            </th>
            <th class="text-left px-3 py-2">
              Utilisateur
            </th>
            <th class="text-left px-3 py-2">
              Action
            </th>
            <th class="text-left px-3 py-2">
              Entité
            </th>
            <th class="text-left px-3 py-2">
              Détail
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending'">
            <td
              colspan="5"
              class="px-3 py-6 text-center text-muted"
            >
              Chargement...
            </td>
          </tr>
          <tr v-else-if="!data?.logs.length">
            <td
              colspan="5"
              class="px-3 py-6 text-center text-muted"
            >
              Aucune entrée pour ces filtres.
            </td>
          </tr>
          <template
            v-for="log in data.logs"
            v-else
            :key="log.id"
          >
            <tr class="border-t border-default align-top">
              <td class="px-3 py-2 text-muted whitespace-nowrap">
                {{ fmtDate(log.createdAt) }}
              </td>
              <td class="px-3 py-2">
                <span v-if="log.user">{{ log.user.name }}</span>
                <span
                  v-else
                  class="text-muted italic"
                >(supprimé)</span>
              </td>
              <td class="px-3 py-2">
                <UBadge
                  :color="actionColor(log.action)"
                  variant="subtle"
                >
                  {{ log.action }}
                </UBadge>
              </td>
              <td class="px-3 py-2 text-muted">
                {{ log.entityType }}<span v-if="log.entityId"> · {{ log.entityId.slice(0, 8) }}…</span>
              </td>
              <td class="px-3 py-2">
                <UButton
                  v-if="log.payload"
                  size="xs"
                  variant="ghost"
                  :icon="expanded.has(log.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  @click="toggle(log.id)"
                >
                  {{ expanded.has(log.id) ? 'Masquer' : 'Afficher' }}
                </UButton>
                <span
                  v-else
                  class="text-muted text-xs"
                >—</span>
              </td>
            </tr>
            <tr
              v-if="log.payload && expanded.has(log.id)"
              class="bg-muted/30 border-t border-default"
            >
              <td
                colspan="5"
                class="px-3 py-2"
              >
                <pre class="text-xs overflow-x-auto whitespace-pre-wrap">{{ JSON.stringify(log.payload, null, 2) }}</pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">Page {{ page }} / {{ totalPages }}</span>
      <UFieldGroup>
        <UButton
          icon="i-lucide-chevron-left"
          variant="outline"
          size="sm"
          :disabled="page <= 1"
          @click="page--"
        />
        <UButton
          icon="i-lucide-chevron-right"
          variant="outline"
          size="sm"
          :disabled="page >= totalPages"
          @click="page++"
        />
      </UFieldGroup>
    </div>
  </UContainer>
</template>
