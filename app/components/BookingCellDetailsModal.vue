<script setup lang="ts">
import type { Bed, Booking, Caravan } from '~~/shared/types'
import { formatFullDate } from '~/utils/dates'

const props = defineProps<{
  open: boolean
  caravan: Caravan | null
  bed: Bed | null
  date: string | null
  bookings: Booking[]
  canEdit: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'add': []
}>()

const toast = useToast()

const remaining = computed(() => {
  if (!props.bed) return 0
  return props.bed.capacity - props.bookings.length
})

async function cancel(b: Booking) {
  if (!confirm(`Libérer ce lit pour ${b.guest?.firstName} ${b.guest?.lastName} la nuit du ${props.date} ?`)) return
  try {
    await $fetch(`/api/bookings/${b.id}`, { method: 'DELETE' })
    toast.add({ title: 'Réservation annulée', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? String(err),
      color: 'error'
    })
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="bed ? `${caravan?.name} — ${bed.label}` : ''"
    :description="date ? formatFullDate(date) : ''"
    :ui="{ content: 'max-w-md' }"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Capacité : {{ bed?.capacity }} place{{ (bed?.capacity ?? 0) > 1 ? 's' : '' }}
          · Occupé : {{ bookings.length }}
          <span v-if="remaining > 0">· {{ remaining }} libre{{ remaining > 1 ? 's' : '' }}</span>
        </p>

        <div v-if="bookings.length === 0" class="text-sm text-muted py-2">
          Aucun occupant pour cette nuit.
        </div>

        <ul v-else class="space-y-2">
          <li
            v-for="b in bookings"
            :key="b.id"
            class="flex items-center justify-between rounded-md border border-default p-3"
          >
            <div>
              <div class="font-medium">{{ b.guest?.lastName.toUpperCase() }} {{ b.guest?.firstName }}</div>
              <div v-if="b.guest?.email || b.guest?.phone" class="text-xs text-muted">
                <span v-if="b.guest?.email">{{ b.guest.email }}</span>
                <span v-if="b.guest?.email && b.guest?.phone"> · </span>
                <span v-if="b.guest?.phone">{{ b.guest.phone }}</span>
              </div>
            </div>
            <UButton
              v-if="canEdit"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="cancel(b)"
            />
          </li>
        </ul>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="ghost" @click="emit('update:open', false)">Fermer</UButton>
        <UButton
          v-if="canEdit && remaining > 0"
          icon="i-lucide-plus"
          @click="emit('add')"
        >
          Ajouter un occupant
        </UButton>
      </div>
    </template>
  </UModal>
</template>
