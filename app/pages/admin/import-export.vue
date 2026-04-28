<script setup lang="ts">
useHead({ title: 'Import/Export · Turbul Booking' })
definePageMeta({ middleware: ['admin'] })

const toast = useToast()

const SECTIONS = [
  { key: 'caravans', label: 'Caravanes' },
  { key: 'zones', label: 'Zones' },
  { key: 'beds', label: 'Lits' },
  { key: 'guests', label: 'Hôtes' },
  { key: 'bookings', label: 'Réservations' },
  { key: 'unavailabilities', label: 'Indisponibilités' }
] as const
type Section = typeof SECTIONS[number]['key']

// ===== Export =====
const exportSelected = ref<Set<Section>>(new Set(SECTIONS.map(s => s.key)))
const exporting = ref(false)

function isExportChecked(key: Section) {
  return exportSelected.value.has(key)
}
function setExportChecked(key: Section, value: boolean) {
  const next = new Set(exportSelected.value)
  if (value) next.add(key)
  else next.delete(key)
  exportSelected.value = next
}

async function downloadExport() {
  if (exportSelected.value.size === 0) return
  exporting.value = true
  try {
    const sections = [...exportSelected.value].join(',')
    const blob = await $fetch<Blob>('/api/admin/export', {
      query: { sections },
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `turbul-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.add({ title: 'Export téléchargé', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Erreur d\'export',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    exporting.value = false
  }
}

// ===== Import =====
type ImportPayload = Partial<Record<Section, unknown[]>> & { version?: number }

const importData = ref<ImportPayload | null>(null)
const importFileName = ref<string | null>(null)
const importSelected = ref<Set<Section>>(new Set())
const importing = ref(false)
const confirmOpen = ref(false)

const counts = computed<Record<Section, number | null> | null>(() => {
  if (!importData.value) return null
  const out = {} as Record<Section, number | null>
  for (const s of SECTIONS) {
    const v = importData.value[s.key]
    out[s.key] = Array.isArray(v) ? v.length : null
  }
  return out
})

function isImportChecked(key: Section) {
  return importSelected.value.has(key)
}
function setImportChecked(key: Section, value: boolean) {
  const next = new Set(importSelected.value)
  if (value) next.add(key)
  else next.delete(key)
  importSelected.value = next
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) {
    importData.value = null
    importFileName.value = null
    importSelected.value = new Set()
    return
  }
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as ImportPayload
    importData.value = parsed
    importFileName.value = file.name
    importSelected.value = new Set(
      SECTIONS.filter(s => Array.isArray(parsed[s.key])).map(s => s.key)
    )
  } catch {
    importData.value = null
    importFileName.value = null
    importSelected.value = new Set()
    toast.add({ title: 'Fichier invalide', description: 'JSON invalide', color: 'error' })
  }
}

async function performImport() {
  if (importSelected.value.size === 0 || !importData.value) return
  importing.value = true
  try {
    await $fetch('/api/admin/import', {
      method: 'POST',
      body: {
        sections: [...importSelected.value],
        data: importData.value
      }
    })
    toast.add({ title: 'Import réussi', color: 'success' })
    confirmOpen.value = false
    importData.value = null
    importFileName.value = null
    importSelected.value = new Set()
  } catch (err: any) {
    toast.add({
      title: 'Erreur d\'import',
      description: err?.data?.statusMessage ?? err?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">
        Import / Export
      </h1>
      <p class="text-sm text-muted mt-1">
        Sauvegarde et restauration des données du plan, hôtes et réservations.
      </p>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-download" />
          <h2 class="text-lg font-semibold">
            Exporter
          </h2>
        </div>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          Sélectionnez les sections à inclure dans le fichier d'export.
        </p>

        <div class="space-y-2">
          <UCheckbox
            v-for="s in SECTIONS"
            :key="s.key"
            :model-value="isExportChecked(s.key)"
            :label="s.label"
            @update:model-value="(v: boolean) => setExportChecked(s.key, v)"
          />
        </div>

        <UButton
          icon="i-lucide-download"
          :disabled="exportSelected.size === 0"
          :loading="exporting"
          @click="downloadExport"
        >
          Télécharger l'export
        </UButton>
      </div>
    </UCard>

    <UCard>
      <template #header>
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-upload" />
          <h2 class="text-lg font-semibold">
            Importer
          </h2>
        </div>
      </template>

      <div class="space-y-4">
        <UAlert
          color="warning"
          variant="soft"
          icon="i-lucide-triangle-alert"
          title="Action destructive"
          description="Les sections sélectionnées remplaceront entièrement les données existantes (suppression puis insertion). Opération irréversible."
        />

        <input
          type="file"
          accept="application/json,.json"
          class="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-elevated file:text-default hover:file:bg-accented file:cursor-pointer"
          @change="onFileChange"
        >

        <div
          v-if="importFileName"
          class="text-sm text-muted"
        >
          Fichier chargé : <span class="font-medium text-default">{{ importFileName }}</span>
        </div>

        <div
          v-if="counts"
          class="space-y-2"
        >
          <p class="text-sm font-medium">
            Contenu détecté :
          </p>
          <div class="space-y-2 ml-1">
            <div
              v-for="s in SECTIONS"
              :key="s.key"
              class="flex items-center gap-3"
            >
              <UCheckbox
                :model-value="isImportChecked(s.key)"
                :disabled="counts[s.key] === null"
                @update:model-value="(v: boolean) => setImportChecked(s.key, v)"
              />
              <span :class="counts[s.key] === null ? 'text-muted text-sm' : 'text-sm'">
                <span class="font-medium">{{ s.label }}</span>
                —
                <span v-if="counts[s.key] === null">absent du fichier</span>
                <span v-else>{{ counts[s.key] }} entrées</span>
              </span>
            </div>
          </div>
        </div>

        <UButton
          color="error"
          icon="i-lucide-upload"
          :disabled="importSelected.size === 0 || !importData"
          @click="confirmOpen = true"
        >
          Restaurer les sections sélectionnées
        </UButton>
      </div>
    </UCard>

    <UModal
      v-model:open="confirmOpen"
      title="Confirmer l'import"
    >
      <template #body>
        <p class="mb-3">
          Vous allez <strong>supprimer entièrement</strong> les données existantes des sections suivantes
          puis les remplacer par le contenu du fichier :
        </p>
        <ul class="list-disc list-inside mb-3 space-y-1">
          <li
            v-for="key in [...importSelected]"
            :key="key"
          >
            <span class="font-medium">{{ SECTIONS.find(s => s.key === key)?.label }}</span>
            <span class="text-muted"> ({{ counts?.[key] ?? 0 }} entrées)</span>
          </li>
        </ul>
        <p class="text-sm text-muted">
          Cette action est irréversible. Pensez à exporter une sauvegarde au préalable.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="confirmOpen = false"
          >
            Annuler
          </UButton>
          <UButton
            color="error"
            :loading="importing"
            @click="performImport"
          >
            Confirmer l'import
          </UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
