<script setup lang="ts">
import type { Wall } from '~~/shared/types'

const props = defineProps<{
  wall: Wall
  canEdit: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const toast = useToast()

const form = reactive({
  color: props.wall.color,
  thickness: props.wall.thickness
})

watch(() => props.wall.id, () => {
  form.color = props.wall.color
  form.thickness = props.wall.thickness
})

let colorTimer: ReturnType<typeof setTimeout> | null = null
const savingColor = ref(false)
watch(() => form.color, (color) => {
  if (color === props.wall.color) return
  if (colorTimer) clearTimeout(colorTimer)
  colorTimer = setTimeout(async () => {
    savingColor.value = true
    try {
      await $fetch(`/api/walls/${props.wall.id}`, {
        method: 'PATCH',
        body: { color }
      })
      emit('saved')
    } catch (err: any) {
      toast.add({ title: 'Erreur', description: err?.statusMessage ?? String(err), color: 'error' })
    } finally {
      savingColor.value = false
    }
  }, 250)
})

let thicknessTimer: ReturnType<typeof setTimeout> | null = null
const savingThickness = ref(false)
watch(() => form.thickness, (thickness) => {
  if (thickness === props.wall.thickness) return
  if (thicknessTimer) clearTimeout(thicknessTimer)
  thicknessTimer = setTimeout(async () => {
    savingThickness.value = true
    try {
      await $fetch(`/api/walls/${props.wall.id}`, {
        method: 'PATCH',
        body: { thickness }
      })
      emit('saved')
    } catch (err: any) {
      toast.add({ title: 'Erreur', description: err?.statusMessage ?? String(err), color: 'error' })
    } finally {
      savingThickness.value = false
    }
  }, 250)
})

const deleting = ref(false)
async function remove() {
  if (!confirm('Supprimer ce mur ?')) return
  deleting.value = true
  try {
    await $fetch(`/api/walls/${props.wall.id}`, { method: 'DELETE' })
    toast.add({ title: 'Mur supprimé', color: 'success' })
    emit('close')
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err?.statusMessage ?? String(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}

const presetColors = [
  '#1f2937', '#0f172a', '#475569', '#92400e', '#78350f',
  '#7f1d1d', '#365314', '#134e4a', '#3b82f6', '#a855f7'
]
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between">
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="inline-block w-4 h-4 rounded-sm border border-default flex-shrink-0"
          :style="{ background: wall.color }"
        />
        <h2 class="font-semibold text-lg truncate">
          Mur
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

        <UFormField :label="`Épaisseur (${form.thickness}px)`">
          <input
            v-model.number="form.thickness"
            type="range"
            min="1"
            max="20"
            step="1"
            class="w-full"
          >
        </UFormField>

        <p
          v-if="canEdit"
          class="text-xs text-muted flex items-center gap-1.5"
        >
          <UIcon
            v-if="savingColor || savingThickness"
            name="i-lucide-loader-circle"
            class="animate-spin"
          />
          <UIcon
            v-else
            name="i-lucide-info"
          />
          Glissez les sommets du mur sur la carte pour le modifier.
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
        Supprimer le mur
      </UButton>
    </div>
  </div>
</template>
