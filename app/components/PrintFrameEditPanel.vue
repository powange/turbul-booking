<script setup lang="ts">
import type { PrintFrame, PrintFrameOrientation } from '~~/shared/types'

const props = defineProps<{
  frame: PrintFrame | null
  /** Coordonnées du centre de la vue Leaflet actuelle (pour placer un nouveau cadre). */
  mapCenter: { lat: number, lng: number } | null
}>()

const emit = defineEmits<{
  close: []
  /** Émis avec les paramètres du cadre — le parent persiste via PUT. */
  save: [data: { lat: number, lng: number, widthMeters: number, rotation: number, orientation: PrintFrameOrientation }]
  remove: []
}>()

const toast = useToast()

const widthInput = ref(props.frame?.widthMeters ?? 50)
const rotationInput = ref(props.frame?.rotation ?? 0)
const orientationInput = ref<PrintFrameOrientation>(props.frame?.orientation ?? 'landscape')

watch(() => props.frame, (f) => {
  widthInput.value = f?.widthMeters ?? 50
  rotationInput.value = f?.rotation ?? 0
  orientationInput.value = f?.orientation ?? 'landscape'
})

const shortMeters = computed(() => Math.round(widthInput.value * (210 / 297) * 10) / 10)

const saving = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (!props.frame) return
  const w = Number(widthInput.value)
  const r = Number(rotationInput.value)
  const o = orientationInput.value
  if (!Number.isFinite(w) || w <= 0) return
  if (!Number.isFinite(r)) return
  if (
    w === props.frame.widthMeters
    && r === props.frame.rotation
    && o === props.frame.orientation
  ) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saving.value = true
    emit('save', {
      lat: props.frame!.lat,
      lng: props.frame!.lng,
      widthMeters: w,
      rotation: r,
      orientation: o
    })
    setTimeout(() => {
      saving.value = false
    }, 600)
  }, 350)
}

watch([widthInput, rotationInput, orientationInput], scheduleSave)

function createHere() {
  if (!props.mapCenter) {
    toast.add({ title: 'Carte non prête', color: 'error' })
    return
  }
  emit('save', {
    lat: props.mapCenter.lat,
    lng: props.mapCenter.lng,
    widthMeters: widthInput.value,
    rotation: rotationInput.value,
    orientation: orientationInput.value
  })
}

function remove() {
  if (!confirm('Supprimer le cadre PDF ? L\'export reprendra l\'auto-cadrage par défaut.')) return
  emit('remove')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 border-b border-default flex items-center justify-between">
      <h2 class="font-semibold text-lg flex items-center gap-2">
        <UIcon name="i-lucide-square-dashed" />
        Cadre PDF
      </h2>
      <UButton
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        @click="emit('close')"
      />
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      <p class="text-sm text-muted">
        Cadre rectangulaire au ratio A4 (297 × 210). Sert de zone d'export
        pour l'impression / PDF du plan. Drag-déplaçable depuis la carte.
        Si non défini, l'export auto-cadre sur l'ensemble des éléments.
      </p>

      <div
        v-if="!frame"
        class="space-y-3"
      >
        <p class="text-sm">
          Aucun cadre n'est défini.
        </p>
        <UFormField label="Orientation">
          <URadioGroup
            v-model="orientationInput"
            :items="[
              { label: 'Paysage', value: 'landscape' },
              { label: 'Portrait', value: 'portrait' }
            ]"
            orientation="horizontal"
          />
        </UFormField>
        <UFormField label="Grand côté (m)">
          <UInput
            v-model.number="widthInput"
            type="number"
            min="1"
            step="1"
            class="w-full"
          />
        </UFormField>
        <UButton
          icon="i-lucide-square-plus"
          block
          @click="createHere"
        >
          Créer au centre de la vue
        </UButton>
      </div>

      <div
        v-else
        class="space-y-3"
      >
        <UFormField label="Orientation">
          <URadioGroup
            v-model="orientationInput"
            :items="[
              { label: 'Paysage', value: 'landscape' },
              { label: 'Portrait', value: 'portrait' }
            ]"
            orientation="horizontal"
          />
        </UFormField>

        <UFormField label="Grand côté (m)">
          <UInput
            v-model.number="widthInput"
            type="number"
            min="1"
            step="1"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="`Rotation : ${Math.round(rotationInput)}°`">
          <input
            v-model.number="rotationInput"
            type="range"
            min="0"
            max="360"
            step="1"
            class="w-full"
          >
        </UFormField>

        <p class="text-xs text-muted">
          Petit côté : {{ shortMeters }} m
          <span
            v-if="saving"
            class="ml-2"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="animate-spin inline align-text-bottom"
            />
            Enregistrement…
          </span>
        </p>

        <p class="text-xs text-muted">
          Centre : {{ frame.lat.toFixed(6) }}, {{ frame.lng.toFixed(6) }}
          <br>
          (déplacer en glissant l'étiquette "Cadre PDF" sur la carte)
        </p>
      </div>
    </div>

    <div
      v-if="frame"
      class="px-4 py-3 border-t border-default"
    >
      <UButton
        block
        color="error"
        variant="soft"
        icon="i-lucide-trash-2"
        @click="remove"
      >
        Supprimer le cadre
      </UButton>
    </div>
  </div>
</template>
