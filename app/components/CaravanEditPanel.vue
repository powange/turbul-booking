<script setup lang="ts">
import type { Caravan } from '~~/shared/types'

const props = defineProps<{
  caravan: Caravan
  canEdit: boolean
}>()

const emit = defineEmits<{
  close: []
  preview: [data: { rotation: number, width: number, length: number, hasElectricity: boolean }]
  saved: []
}>()

const toast = useToast()

// Édition locale (contrôlée) — synchronisée avec les props si la caravane change.
const form = reactive({
  name: props.caravan.name,
  rotation: props.caravan.rotation,
  width: props.caravan.width,
  length: props.caravan.length,
  hasElectricity: props.caravan.hasElectricity
})

watch(() => props.caravan.id, () => {
  form.name = props.caravan.name
  form.rotation = props.caravan.rotation
  form.width = props.caravan.width
  form.length = props.caravan.length
  form.hasElectricity = props.caravan.hasElectricity
})

// Auto-save avec débounce pour les champs visuels (rotation, dimensions, élec.).
// Aperçu instantané sur la carte via emit('preview'), persistance ~400ms après
// la dernière modification — pas besoin de bouton Enregistrer pour ces champs.
const dimsDirty = ref(false)
let dimsSaveTimer: ReturnType<typeof setTimeout> | null = null
let initializing = true

watch(
  [() => form.rotation, () => form.width, () => form.length, () => form.hasElectricity],
  () => {
    emit('preview', {
      rotation: form.rotation,
      width: form.width,
      length: form.length,
      hasElectricity: form.hasElectricity
    })
    if (initializing) return
    if (!canEditNow()) return
    dimsDirty.value = true
    if (dimsSaveTimer) clearTimeout(dimsSaveTimer)
    dimsSaveTimer = setTimeout(saveDimensions, 400)
  }
)

// Active l'auto-save après le premier tick (évite le watcher initial / les
// re-init du form lors d'un changement de caravane sélectionnée).
nextTick(() => {
  initializing = false
})

watch(() => props.caravan.id, () => {
  initializing = true
  nextTick(() => {
    initializing = false
  })
})

function canEditNow() {
  return props.canEdit
}

async function saveDimensions() {
  try {
    await $fetch(`/api/caravans/${props.caravan.id}`, {
      method: 'PATCH',
      body: {
        rotation: form.rotation,
        width: form.width,
        length: form.length,
        hasElectricity: form.hasElectricity
      }
    })
    dimsDirty.value = false
    emit('saved')
  } catch (err) {
    toast.add({
      title: 'Erreur enregistrement',
      description: errorMessage(err),
      color: 'error'
    })
  }
}

// Enregistrement explicite du nom (changement caractère-par-caractère ne doit
// pas déclencher un PATCH à chaque frappe).
const savingName = ref(false)
async function saveName() {
  if (form.name === props.caravan.name) return
  savingName.value = true
  try {
    await $fetch(`/api/caravans/${props.caravan.id}`, {
      method: 'PATCH',
      body: { name: form.name }
    })
    toast.add({ title: 'Nom enregistré', color: 'success' })
    emit('saved')
  } catch (err) {
    toast.add({
      title: 'Erreur',
      description: errorMessage(err),
      color: 'error'
    })
  } finally {
    savingName.value = false
  }
}

const deleting = ref(false)
async function remove() {
  if (!confirm(`Supprimer la caravane "${props.caravan.name}" du plan ?\n\nL'historique des nuitées est conservé.`)) return
  deleting.value = true
  try {
    await $fetch(`/api/caravans/${props.caravan.id}`, { method: 'DELETE' })
    toast.add({ title: 'Caravane supprimée', color: 'success' })
    emit('close')
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}

// Lits
const newBed = reactive({ label: '', capacity: 1 })
const addingBed = ref(false)
async function addBed() {
  if (!newBed.label.trim()) return
  addingBed.value = true
  try {
    await $fetch(`/api/caravans/${props.caravan.id}/beds`, {
      method: 'POST',
      body: { label: newBed.label.trim(), capacity: newBed.capacity }
    })
    newBed.label = ''
    newBed.capacity = 1
    toast.add({ title: 'Lit ajouté', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    addingBed.value = false
  }
}

async function updateBed(id: string, data: { label?: string, capacity?: number }) {
  try {
    await $fetch(`/api/beds/${id}`, { method: 'PATCH', body: data })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

async function removeBed(id: string, label: string) {
  if (!confirm(`Supprimer le lit "${label}" ?`)) return
  try {
    await $fetch(`/api/beds/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Lit supprimé', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}

const totalCapacity = computed(() => props.caravan.beds.reduce((s, b) => s + b.capacity, 0))

const capacityOptions = [
  { label: '1 place', value: 1 },
  { label: '2 places', value: 2 },
  { label: '3 places', value: 3 }
]
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between">
      <div>
        <h2 class="font-semibold text-lg">
          {{ caravan.name }}
        </h2>
        <p class="text-xs text-muted">
          {{ caravan.beds.length }} lit{{ caravan.beds.length > 1 ? 's' : '' }} · {{ totalCapacity }} place{{ totalCapacity > 1 ? 's' : '' }} · {{ caravan.hasElectricity ? 'Électricité' : 'Sans électricité' }}
        </p>
      </div>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        @click="emit('close')"
      />
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-6">
      <fieldset
        :disabled="!canEdit"
        class="space-y-4"
      >
        <legend class="text-sm font-semibold text-muted mb-2">
          Caractéristiques
        </legend>

        <UFormField label="Nom">
          <UInput
            v-model="form.name"
            class="w-full"
            :loading="savingName"
            @blur="saveName"
            @keydown.enter="saveName"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Largeur (m)">
            <UInput
              v-model.number="form.width"
              type="number"
              step="0.1"
              min="0.5"
              max="20"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Longueur (m)">
            <UInput
              v-model.number="form.length"
              type="number"
              step="0.1"
              min="0.5"
              max="30"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField :label="`Rotation : ${Math.round(form.rotation)}°`">
          <input
            v-model.number="form.rotation"
            type="range"
            min="0"
            max="360"
            step="1"
            class="w-full"
          >
        </UFormField>

        <USwitch
          v-model="form.hasElectricity"
          label="Raccordée à l'électricité"
        />

        <p
          v-if="canEdit"
          class="text-xs text-muted flex items-center gap-1.5"
        >
          <UIcon
            v-if="dimsDirty"
            name="i-lucide-loader-circle"
            class="animate-spin"
          />
          <UIcon
            v-else
            name="i-lucide-check"
            class="text-success"
          />
          {{ dimsDirty ? 'Enregistrement…' : 'Modifications enregistrées automatiquement' }}
        </p>
      </fieldset>

      <USeparator />

      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-muted">
            Lits
          </h3>
        </div>

        <ul
          v-if="caravan.beds.length"
          class="space-y-2"
        >
          <li
            v-for="bed in caravan.beds"
            :key="bed.id"
            class="flex items-center gap-2 rounded-md border border-default p-2"
          >
            <UInput
              :model-value="bed.label"
              :disabled="!canEdit"
              size="sm"
              class="flex-1"
              @blur="(e: FocusEvent) => updateBed(bed.id, { label: (e.target as HTMLInputElement).value })"
            />
            <USelect
              :model-value="bed.capacity"
              :items="capacityOptions"
              :disabled="!canEdit"
              size="sm"
              class="w-32"
              @update:model-value="(v: number) => updateBed(bed.id, { capacity: Number(v) })"
            />
            <USwitch
              :model-value="bed.hasCleanLinen"
              :disabled="!canEdit"
              size="xs"
              title="Linge propre"
              @update:model-value="(v: boolean) => updateBed(bed.id, { hasCleanLinen: v })"
            />
            <UButton
              v-if="canEdit"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              @click="removeBed(bed.id, bed.label)"
            />
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          Aucun lit pour cette caravane.
        </p>

        <div
          v-if="canEdit"
          class="flex items-end gap-2 pt-2"
        >
          <UFormField
            label="Nouveau lit"
            class="flex-1"
          >
            <UInput
              v-model="newBed.label"
              placeholder="ex: Lit haut"
              size="sm"
            />
          </UFormField>
          <USelect
            v-model="newBed.capacity"
            :items="capacityOptions"
            size="sm"
            class="w-32"
          />
          <UButton
            icon="i-lucide-plus"
            size="sm"
            :loading="addingBed"
            @click="addBed"
          >
            Ajouter
          </UButton>
        </div>
      </section>
    </div>

    <div
      v-if="canEdit"
      class="px-4 py-3 border-t border-default"
    >
      <UButton
        block
        color="error"
        variant="soft"
        icon="i-lucide-trash-2"
        :loading="deleting"
        @click="remove"
      >
        Supprimer la caravane
      </UButton>
    </div>
  </div>
</template>
