<script setup lang="ts">
useHead({ title: 'Plan · Turbul Booking' })

const { hasRole } = useAuth()
const canEdit = computed(() => hasRole('ADMIN'))

const { caravans, isReady, refresh, ensureRealtime } = useCaravans()

const selectedId = ref<string | null>(null)
const placeMode = ref(false)
const creating = ref(false)
const newCaravanName = ref('')

const selectedCaravan = computed(() => caravans.value.find(c => c.id === selectedId.value) ?? null)

const toast = useToast()

await refresh()

onMounted(() => {
  ensureRealtime()
})

async function moveCaravan(id: string, lat: number, lng: number) {
  try {
    await $fetch(`/api/caravans/${id}`, { method: 'PATCH', body: { lat, lng } })
  } catch (err: any) {
    toast.add({ title: 'Erreur lors du déplacement', description: err?.statusMessage ?? String(err), color: 'error' })
  }
}

async function placeCaravanAt(lat: number, lng: number) {
  if (!newCaravanName.value.trim()) {
    toast.add({ title: 'Donnez un nom à la caravane avant de cliquer sur le plan.', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const created = await $fetch<{ id: string }>('/api/caravans', {
      method: 'POST',
      body: {
        name: newCaravanName.value.trim(),
        lat,
        lng,
        rotation: 0,
        width: 2.5,
        length: 6,
        hasElectricity: false
      }
    })
    selectedId.value = created.id
    placeMode.value = false
    newCaravanName.value = ''
    toast.add({ title: 'Caravane créée', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Erreur', description: err?.statusMessage ?? String(err), color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="relative h-[calc(100vh-var(--ui-header-height,64px))] w-full">
    <ClientOnly>
      <PlanMap
        :caravans="caravans"
        :selected-id="selectedId"
        :can-edit="canEdit"
        :place-mode="placeMode"
        @select="selectedId = $event"
        @move="moveCaravan"
        @place-at="placeCaravanAt"
      />
      <template #fallback>
        <div class="h-full flex items-center justify-center text-muted">
          Chargement du plan...
        </div>
      </template>
    </ClientOnly>

    <!-- Barre d'action admin -->
    <div
      v-if="canEdit"
      class="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 bg-default/90 backdrop-blur rounded-full shadow-md px-3 py-2 border border-default"
    >
      <template v-if="!placeMode">
        <UButton
          icon="i-lucide-plus"
          size="sm"
          @click="placeMode = true"
        >
          Ajouter une caravane
        </UButton>
      </template>
      <template v-else>
        <UInput
          v-model="newCaravanName"
          placeholder="Nom de la caravane"
          size="sm"
          autofocus
        />
        <span class="text-xs text-muted hidden sm:inline">puis cliquez sur le plan</span>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="() => { placeMode = false; newCaravanName = '' }"
        >
          Annuler
        </UButton>
      </template>
    </div>

    <!-- Indicateur "aucune caravane" -->
    <div
      v-if="isReady && caravans.length === 0"
      class="absolute top-20 left-1/2 -translate-x-1/2 z-[999] bg-default/90 backdrop-blur rounded-md shadow px-4 py-2 border border-default text-sm text-muted"
    >
      Aucune caravane sur le plan pour le moment.
      <span v-if="canEdit">Cliquez sur "Ajouter une caravane" pour commencer.</span>
    </div>

    <!-- Panneau d'édition -->
    <USlideover
      :open="!!selectedCaravan"
      :ui="{ content: 'max-w-md w-full' }"
      @update:open="(v) => { if (!v) selectedId = null }"
    >
      <template #content>
        <CaravanEditPanel
          v-if="selectedCaravan"
          :caravan="selectedCaravan"
          :can-edit="canEdit"
          @close="selectedId = null"
        />
      </template>
    </USlideover>
  </div>
</template>
