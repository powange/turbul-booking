<script setup lang="ts">
import type { Landmark, LandmarkIcon } from '~~/shared/types'

const props = defineProps<{
  landmark: Landmark
  icons: LandmarkIcon[]
  canEdit: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: []
  /** Aperçu live : le parent mute la landmark en place pour un retour visuel
   *  immédiat sur la map, sans attendre le debounce + l'aller-retour PATCH. */
  preview: [patch: { sizePx?: number, color?: string | null, iconId?: string }]
  iconUploaded: [icon: LandmarkIcon]
  iconDeleted: [id: string]
}>()

const toast = useToast()

const form = reactive({
  name: props.landmark.name,
  iconId: props.landmark.iconId,
  sizePx: props.landmark.sizePx,
  color: props.landmark.color ?? '#1f2937'
})

watch(() => props.landmark.id, () => {
  form.name = props.landmark.name
  form.iconId = props.landmark.iconId
  form.sizePx = props.landmark.sizePx
  form.color = props.landmark.color ?? '#1f2937'
})

const currentIcon = computed(() => props.icons.find(i => i.id === form.iconId) ?? null)
const isSvg = computed(() => currentIcon.value?.format === 'svg')

const savingName = ref(false)
async function saveName() {
  const next = form.name.trim()
  if (!next) {
    form.name = props.landmark.name
    return
  }
  if (next === props.landmark.name) return
  savingName.value = true
  try {
    await $fetch(`/api/landmarks/${props.landmark.id}`, {
      method: 'PATCH',
      body: { name: next }
    })
    emit('saved')
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    savingName.value = false
  }
}

const savingIcon = ref(false)
async function selectIcon(iconId: string) {
  if (iconId === form.iconId) return
  form.iconId = iconId
  // Aperçu immédiat (le marker reflète la nouvelle icône avant que la
  // PATCH ne réponde).
  emit('preview', { iconId })
  savingIcon.value = true
  try {
    await $fetch(`/api/landmarks/${props.landmark.id}`, {
      method: 'PATCH',
      body: { iconId }
    })
    emit('saved')
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
    form.iconId = props.landmark.iconId
  } finally {
    savingIcon.value = false
  }
}

let sizeTimer: ReturnType<typeof setTimeout> | null = null
const savingSize = ref(false)
watch(() => form.sizePx, (sizePx) => {
  if (sizePx === props.landmark.sizePx) return
  // Aperçu immédiat sur la map. La PATCH est debouncée pour ne pas spammer
  // pendant un drag du slider.
  emit('preview', { sizePx })
  if (sizeTimer) clearTimeout(sizeTimer)
  sizeTimer = setTimeout(async () => {
    savingSize.value = true
    try {
      await $fetch(`/api/landmarks/${props.landmark.id}`, {
        method: 'PATCH',
        body: { sizePx }
      })
      emit('saved')
    } catch (err) {
      toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
    } finally {
      savingSize.value = false
    }
  }, 250)
})

let colorTimer: ReturnType<typeof setTimeout> | null = null
const savingColor = ref(false)
watch(() => form.color, (color) => {
  if (!isSvg.value) return
  if (color === (props.landmark.color ?? '#1f2937')) return
  emit('preview', { color })
  if (colorTimer) clearTimeout(colorTimer)
  colorTimer = setTimeout(async () => {
    savingColor.value = true
    try {
      await $fetch(`/api/landmarks/${props.landmark.id}`, {
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

const deleting = ref(false)
async function remove() {
  if (!confirm(`Supprimer le repère "${props.landmark.name}" ?`)) return
  deleting.value = true
  try {
    await $fetch(`/api/landmarks/${props.landmark.id}`, { method: 'DELETE' })
    toast.add({ title: 'Repère supprimé', color: 'success' })
    emit('close')
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    deleting.value = false
  }
}

// === Upload d'une nouvelle icône (intégré au panneau) ===
const fileInput = ref<HTMLInputElement | null>(null)
const uploadName = ref('')
const uploading = ref(false)
const pendingFile = ref<File | null>(null)

function pickFile() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 256 * 1024) {
    toast.add({ title: 'Fichier trop volumineux', description: 'Max 256 KB.', color: 'error' })
    target.value = ''
    return
  }
  pendingFile.value = file
  if (!uploadName.value.trim()) {
    // Pré-remplit le nom à partir du nom de fichier (sans extension).
    uploadName.value = file.name.replace(/\.[^.]+$/, '').slice(0, 80)
  }
}

async function uploadIcon() {
  if (!pendingFile.value) return
  if (!uploadName.value.trim()) {
    toast.add({ title: 'Nommez l\'icône avant l\'envoi', color: 'warning' })
    return
  }
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', pendingFile.value)
    fd.append('name', uploadName.value.trim())
    const created = await $fetch<LandmarkIcon>('/api/landmark-icons', {
      method: 'POST',
      body: fd
    })
    emit('iconUploaded', created)
    pendingFile.value = null
    uploadName.value = ''
    if (fileInput.value) fileInput.value.value = ''
    // Sélectionne immédiatement la nouvelle icône.
    await selectIcon(created.id)
    toast.add({ title: 'Icône ajoutée', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  } finally {
    uploading.value = false
  }
}

async function deleteIcon(icon: LandmarkIcon) {
  if (!confirm(`Supprimer l'icône "${icon.name}" de la bibliothèque ?`)) return
  try {
    await $fetch(`/api/landmark-icons/${icon.id}`, { method: 'DELETE' })
    emit('iconDeleted', icon.id)
    toast.add({ title: 'Icône supprimée', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Erreur', description: errorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between">
      <h2 class="font-semibold text-lg flex items-center gap-2">
        <UIcon name="i-lucide-map-pin" />
        Point de repère
      </h2>
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
        class="space-y-5"
      >
        <UFormField label="Libellé">
          <UInput
            v-model="form.name"
            class="w-full"
            :loading="savingName"
            placeholder="Ex: Accueil, Sanitaires…"
            @blur="saveName"
            @keydown.enter="saveName"
          />
          <template #help>
            Le libellé n'est pas affiché sur la carte, uniquement ici.
          </template>
        </UFormField>

        <UFormField label="Icône">
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="icon in props.icons"
              :key="icon.id"
              type="button"
              class="relative aspect-square border rounded-md flex items-center justify-center p-1.5 transition-colors"
              :class="form.iconId === icon.id ? 'border-primary border-2 bg-primary/5' : 'border-default hover:bg-elevated'"
              :title="icon.name"
              @click="selectIcon(icon.id)"
            >
              <img
                :src="`/api/landmark-icons/${icon.id}/file`"
                :alt="icon.name"
                class="w-full h-full object-contain"
                :style="icon.format === 'svg' ? { color: form.color } : undefined"
              >
              <button
                v-if="canEdit && icon.id !== form.iconId"
                type="button"
                class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-default border border-default text-muted hover:text-error hover:border-error flex items-center justify-center text-[10px] leading-none"
                title="Supprimer cette icône"
                @click.stop="deleteIcon(icon)"
              >
                ×
              </button>
            </button>
          </div>
          <template #help>
            <span
              v-if="savingIcon"
              class="text-xs"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="animate-spin inline align-text-bottom"
              />
              Enregistrement…
            </span>
            <span v-else>{{ props.icons.length }} icône(s) dans la bibliothèque</span>
          </template>
        </UFormField>

        <UFormField label="Téléverser une nouvelle icône">
          <div class="space-y-2">
            <input
              ref="fileInput"
              type="file"
              accept=".png,.svg,image/png,image/svg+xml"
              class="hidden"
              @change="onFileChange"
            >
            <div class="flex items-center gap-2">
              <UButton
                icon="i-lucide-upload"
                variant="outline"
                size="sm"
                @click="pickFile"
              >
                Choisir un fichier
              </UButton>
              <span
                v-if="pendingFile"
                class="text-xs text-muted truncate"
              >{{ pendingFile.name }}</span>
            </div>
            <template v-if="pendingFile">
              <UInput
                v-model="uploadName"
                placeholder="Nom de l'icône"
                size="sm"
              />
              <UButton
                icon="i-lucide-check"
                size="sm"
                block
                :loading="uploading"
                @click="uploadIcon"
              >
                Ajouter à la bibliothèque
              </UButton>
            </template>
            <p class="text-xs text-muted">
              PNG ou SVG, 256 KB max. Les SVG sont sanitisés et colorisables.
            </p>
          </div>
        </UFormField>

        <UFormField :label="`Taille : ${form.sizePx}px`">
          <input
            v-model.number="form.sizePx"
            type="range"
            min="16"
            max="96"
            step="2"
            class="w-full"
          >
          <template #help>
            <span
              v-if="savingSize"
              class="text-xs"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="animate-spin inline align-text-bottom"
              />
              Enregistrement…
            </span>
          </template>
        </UFormField>

        <UFormField
          v-if="isSvg"
          label="Couleur"
        >
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
          <template #help>
            <span
              v-if="savingColor"
              class="text-xs"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="animate-spin inline align-text-bottom"
              />
              Enregistrement…
            </span>
            <span
              v-else
              class="text-xs"
            >
              Couleur appliquée via <code>currentColor</code> au SVG.
            </span>
          </template>
        </UFormField>

        <p
          v-else-if="currentIcon"
          class="text-xs text-muted flex items-center gap-1.5"
        >
          <UIcon name="i-lucide-info" />
          Le PNG est rendu tel quel — pas de couleur configurable.
        </p>

        <p
          v-if="canEdit"
          class="text-xs text-muted flex items-center gap-1.5"
        >
          <UIcon name="i-lucide-info" />
          Glissez le repère sur la carte pour le déplacer.
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
        Supprimer le repère
      </UButton>
    </div>
  </div>
</template>
