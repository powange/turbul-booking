<script setup lang="ts">
import { z } from 'zod'
import type { Caravan, Guest } from '~~/shared/types'
import { addDaysIso } from '~/utils/dates'

const props = defineProps<{
  open: boolean
  caravans: Caravan[]
  presetBedId?: string | null
  presetFrom?: string | null
  presetTo?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const toast = useToast()
const { search, create: createGuest } = useGuests()

type Mode = 'existing' | 'new'

const state = reactive<{
  caravanId: string
  bedId: string
  from: string
  to: string
  mode: Mode
  guestId: string | null
  guest: { firstName: string, lastName: string, email: string, phone: string }
}>({
  caravanId: '',
  bedId: '',
  from: '',
  to: '',
  mode: 'existing',
  guestId: null,
  guest: { firstName: '', lastName: '', email: '', phone: '' }
})

const caravanOptions = computed(() =>
  [...props.caravans]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(c => ({ label: c.name, value: c.id }))
)

const selectedCaravan = computed(() =>
  props.caravans.find(c => c.id === state.caravanId) ?? null
)

const bedOptions = computed(() =>
  (selectedCaravan.value?.beds ?? []).map(b => ({
    label: `${b.label} (${b.capacity}p)`,
    value: b.id
  }))
)

watch(() => state.caravanId, (caravanId) => {
  const caravan = props.caravans.find(c => c.id === caravanId)
  if (!caravan) {
    state.bedId = ''
    return
  }
  // Si la caravane n'a qu'un seul lit, on le sélectionne d'office
  if (caravan.beds.length === 1) {
    state.bedId = caravan.beds[0]!.id
    return
  }
  // Si le lit courant n'appartient pas à la nouvelle caravane, on le réinitialise
  if (!caravan.beds.some(b => b.id === state.bedId)) {
    state.bedId = ''
  }
})

const guestSearchTerm = ref('')
const guestResults = ref<Guest[]>([])
const guestSearchLoading = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(v: string) {
  guestSearchTerm.value = v
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    guestSearchLoading.value = true
    try {
      guestResults.value = await search(v)
    } finally {
      guestSearchLoading.value = false
    }
  }, 200)
}

watch(() => props.open, async (open) => {
  if (!open) return
  // Reset + apply presets
  if (props.presetBedId) {
    const owner = props.caravans.find(c => c.beds.some(b => b.id === props.presetBedId))
    state.caravanId = owner?.id ?? ''
    state.bedId = props.presetBedId
  } else if (props.caravans.length === 1) {
    // Une seule caravane fournie (ex. depuis le panneau d'une caravane sur le
    // plan) : on la sélectionne d'office. Le watcher sur caravanId
    // sélectionnera ensuite le seul lit s'il n'y en a qu'un.
    state.caravanId = props.caravans[0]!.id
    state.bedId = ''
  } else {
    state.caravanId = ''
    state.bedId = ''
  }
  state.from = props.presetFrom ?? ''
  state.to = props.presetTo ?? (props.presetFrom ? addDaysIso(props.presetFrom, 1) : '')
  state.mode = 'existing'
  state.guestId = null
  state.guest = { firstName: '', lastName: '', email: '', phone: '' }
  guestSearchTerm.value = ''
  // Charger une 1re liste d'hôtes
  guestSearchLoading.value = true
  try {
    guestResults.value = await search('')
  } finally {
    guestSearchLoading.value = false
  }
})

const submitting = ref(false)

const formSchema = z.object({
  bedId: z.string().min(1, 'Lit requis'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date d\'arrivée invalide'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de départ invalide')
}).refine(d => d.to > d.from, { message: 'La date de départ doit être après l\'arrivée', path: ['to'] })

async function onSubmit() {
  // Validation
  const baseValid = formSchema.safeParse({ bedId: state.bedId, from: state.from, to: state.to })
  if (!baseValid.success) {
    toast.add({ title: baseValid.error.issues[0]!.message, color: 'error' })
    return
  }
  if (state.mode === 'existing' && !state.guestId) {
    toast.add({ title: 'Sélectionnez un hôte ou créez-en un nouveau.', color: 'error' })
    return
  }
  if (state.mode === 'new') {
    if (!state.guest.firstName.trim() || !state.guest.lastName.trim()) {
      toast.add({ title: 'Prénom et nom requis pour un nouvel hôte.', color: 'error' })
      return
    }
  }

  submitting.value = true
  try {
    const body: any = {
      bedId: state.bedId,
      from: state.from,
      to: state.to
    }
    if (state.mode === 'existing') {
      body.guestId = state.guestId
    } else {
      body.guest = {
        firstName: state.guest.firstName.trim(),
        lastName: state.guest.lastName.trim(),
        email: state.guest.email.trim() || undefined,
        phone: state.guest.phone.trim() || undefined
      }
    }
    await $fetch('/api/bookings', { method: 'POST', body })
    toast.add({ title: 'Réservation enregistrée', color: 'success' })
    emit('created')
    emit('update:open', false)
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    submitting.value = false
  }
}

const guestOptions = computed(() =>
  guestResults.value.map(g => ({
    label: `${g.lastName.toUpperCase()} ${g.firstName}${g.email ? ` — ${g.email}` : ''}`,
    value: g.id
  }))
)
</script>

<template>
  <UModal
    :open="open"
    title="Nouvelle réservation"
    :ui="{ content: 'max-w-lg' }"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Caravane" required>
            <USelect
              v-model="state.caravanId"
              :items="caravanOptions"
              placeholder="Sélectionner"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Lit" required>
            <USelect
              v-model="state.bedId"
              :items="bedOptions"
              :disabled="!state.caravanId || bedOptions.length <= 1"
              :placeholder="state.caravanId ? 'Sélectionner' : '—'"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Arrivée" required>
            <UInput v-model="state.from" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Départ (matin)" required help="Date du jour de départ (la nuit précédente est incluse)">
            <UInput v-model="state.to" type="date" class="w-full" />
          </UFormField>
        </div>

        <USeparator label="Hôte" />

        <URadioGroup
          v-model="state.mode"
          :items="[
            { value: 'existing', label: 'Hôte existant' },
            { value: 'new', label: 'Nouvel hôte' }
          ]"
          orientation="horizontal"
        />

        <template v-if="state.mode === 'existing'">
          <UFormField label="Rechercher un hôte">
            <UInput
              :model-value="guestSearchTerm"
              placeholder="Nom, prénom ou email"
              icon="i-lucide-search"
              class="w-full"
              @update:model-value="onSearchInput"
            />
          </UFormField>
          <div v-if="guestSearchLoading" class="text-sm text-muted">Recherche...</div>
          <div
            v-else-if="guestOptions.length === 0"
            class="text-sm text-muted"
          >
            Aucun hôte trouvé. Passez à "Nouvel hôte" pour en créer un.
          </div>
          <ul v-else class="max-h-48 overflow-y-auto border border-default rounded-md divide-y divide-default">
            <li
              v-for="g in guestOptions"
              :key="g.value"
              class="px-3 py-2 cursor-pointer hover:bg-muted text-sm"
              :class="{ 'bg-primary/10': state.guestId === g.value }"
              @click="state.guestId = g.value"
            >
              {{ g.label }}
            </li>
          </ul>
        </template>

        <template v-else>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Prénom" required>
              <UInput v-model="state.guest.firstName" class="w-full" />
            </UFormField>
            <UFormField label="Nom" required>
              <UInput v-model="state.guest.lastName" class="w-full" />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Email">
              <UInput v-model="state.guest.email" type="email" class="w-full" />
            </UFormField>
            <UFormField label="Téléphone">
              <UInput v-model="state.guest.phone" class="w-full" />
            </UFormField>
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="ghost" @click="emit('update:open', false)">Annuler</UButton>
        <UButton :loading="submitting" icon="i-lucide-check" @click="onSubmit">
          Enregistrer
        </UButton>
      </div>
    </template>
  </UModal>
</template>
