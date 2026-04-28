<script setup lang="ts">
import { z } from 'zod'
import type { Role } from '~~/shared/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'created': []
}>()

const toast = useToast()
const { create } = useUsers()

const state = reactive({
  name: '',
  email: '',
  password: '',
  role: 'MANAGER' as Role
})

const submitting = ref(false)

watch(() => props.open, (v) => {
  if (v) {
    state.name = ''
    state.email = ''
    state.password = ''
    state.role = 'MANAGER'
  }
})

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'])
})

async function onSubmit() {
  const parsed = schema.safeParse(state)
  if (!parsed.success) {
    toast.add({ title: parsed.error.issues[0]!.message, color: 'error' })
    return
  }
  submitting.value = true
  try {
    await create(parsed.data)
    toast.add({ title: 'Utilisateur créé', color: 'success' })
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

const roleOptions = [
  { label: 'Administrateur', value: 'ADMIN' },
  { label: 'Gérant', value: 'MANAGER' },
  { label: 'Lecture seule', value: 'VIEWER' }
]

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pwd = ''
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  for (const v of arr) pwd += chars[v % chars.length]
  state.password = pwd
}
</script>

<template>
  <UModal
    :open="open"
    title="Créer un utilisateur"
    :ui="{ content: 'max-w-md' }"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          label="Nom complet"
          required
        >
          <UInput
            v-model="state.name"
            autocomplete="name"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Email"
          required
        >
          <UInput
            v-model="state.email"
            type="email"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Mot de passe initial"
          required
          help="Au moins 8 caractères. À communiquer à l'utilisateur."
        >
          <div class="flex gap-2">
            <UInput
              v-model="state.password"
              type="text"
              autocomplete="new-password"
              class="flex-1"
            />
            <UButton
              variant="outline"
              icon="i-lucide-shuffle"
              @click="generatePassword"
            >
              Générer
            </UButton>
          </div>
        </UFormField>

        <UFormField
          label="Rôle"
          required
        >
          <USelect
            v-model="state.role"
            :items="roleOptions"
            class="w-full"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          @click="emit('update:open', false)"
        >
          Annuler
        </UButton>
        <UButton
          :loading="submitting"
          icon="i-lucide-check"
          @click="onSubmit"
        >
          Créer le compte
        </UButton>
      </div>
    </template>
  </UModal>
</template>
