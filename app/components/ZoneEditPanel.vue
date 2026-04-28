<script setup lang="ts">
import type { Zone } from '~~/shared/types'

const props = defineProps<{
  zone: Zone
  canEdit: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()

const form = reactive({
  name: props.zone.name,
  color: props.zone.color,
  filled: props.zone.filled
})

watch(() => props.zone.id, () => {
  form.name = props.zone.name
  form.color = props.zone.color
  form.filled = props.zone.filled
})

const savingName = ref(false)
async function saveName() {
  if (form.name === props.zone.name) return
  if (!form.name.trim()) {
    form.name = props.zone.name
    return
  }
  savingName.value = true
  try {
    await $fetch(`/api/zones/${props.zone.id}`, {
      method: 'PATCH',
      body: { name: form.name.trim() }
    })
    toast.add({ title: 'Nom enregistré', color: 'success' })
    emit('saved')
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    savingName.value = false
  }
}

let colorTimer: ReturnType<typeof setTimeout> | null = null
const savingColor = ref(false)
watch(() => form.color, (color) => {
  if (color === props.zone.color) return
  if (colorTimer) clearTimeout(colorTimer)
  colorTimer = setTimeout(async () => {
    savingColor.value = true
    try {
      await $fetch(`/api/zones/${props.zone.id}`, {
        method: 'PATCH',
        body: { color }
      })
      emit('saved')
    } catch (err) {
      toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
    } finally {
      savingColor.value = false
    }
  }, 250)
})

const savingFilled = ref(false)
watch(() => form.filled, async (filled) => {
  if (filled === props.zone.filled) return
  savingFilled.value = true
  try {
    await $fetch(`/api/zones/${props.zone.id}`, {
      method: 'PATCH',
      body: { filled }
    })
    emit('saved')
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
    form.filled = props.zone.filled
  } finally {
    savingFilled.value = false
  }
})

const deleting = ref(false)
async function remove() {
  if (!confirm(`Supprimer la zone "${props.zone.name}" ?`)) return
  deleting.value = true
  try {
    await $fetch(`/api/zones/${props.zone.id}`, { method: 'DELETE' })
    toast.add({ title: 'Zone supprimée', color: 'success' })
    emit('close')
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}

const presetColors = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7',
  '#ec4899', '#14b8a6', '#64748b', '#0ea5e9', '#84cc16'
]
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="inline-block w-4 h-4 rounded-sm border border-default flex-shrink-0"
          :style="{ background: zone.color }"
        />
        <h2 class="font-semibold text-lg truncate">
          Zone
        </h2>
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
        <UFormField label="Nom">
          <UInput
            v-model="form.name"
            class="w-full"
            :loading="savingName"
            @blur="saveName"
            @keydown.enter="saveName"
          />
        </UFormField>

        <UFormField label="Couleur">
          <div class="flex items-center gap-3">
            <input
              v-model="form.color"
              type="color"
              class="w-10 h-10 rounded border border-default cursor-pointer"
            >
            <UInput
              v-model="form.color"
              class="flex-1"
            />
          </div>
          <div class="flex flex-wrap gap-1.5 mt-2">
            <button
              v-for="c in presetColors"
              :key="c"
              type="button"
              class="w-6 h-6 rounded border border-default"
              :style="{ background: c }"
              :title="c"
              @click="form.color = c"
            />
          </div>
        </UFormField>

        <UFormField label="Remplir la zone">
          <USwitch
            v-model="form.filled"
            :loading="savingFilled"
          />
        </UFormField>

        <p
          v-if="canEdit"
          class="text-xs text-muted flex items-center gap-1.5"
        >
          <UIcon
            v-if="savingColor || savingFilled"
            name="i-lucide-loader-circle"
            class="animate-spin"
          />
          <UIcon
            v-else
            name="i-lucide-info"
          />
          Glissez les sommets de la zone sur la carte pour la modifier.
        </p>
      </fieldset>
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
        Supprimer la zone
      </UButton>
    </div>
  </div>
</template>
