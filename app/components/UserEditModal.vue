<script setup lang="ts">
import { z } from 'zod'
import type { AdminUser, Role } from '~~/shared/types'

const props = defineProps<{
  open: boolean
  user: AdminUser | null
  isSelf: boolean
}>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  'updated': []
}>()

const toast = useToast()
const { update, resetPassword } = useUsers()

const tab = ref<'profile' | 'password'>('profile')

const profile = reactive({
  name: '',
  email: '',
  role: 'VIEWER' as Role
})
const newPassword = ref('')

watch(() => props.user, (u) => {
  if (u) {
    profile.name = u.name
    profile.email = u.email
    profile.role = u.role
    newPassword.value = ''
    tab.value = 'profile'
  }
}, { immediate: true })

const profileSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  role: z.enum(['ADMIN', 'MANAGER', 'VIEWER'])
})

const submittingProfile = ref(false)
async function saveProfile() {
  if (!props.user) return
  const parsed = profileSchema.safeParse(profile)
  if (!parsed.success) {
    toast.add({ title: parsed.error.issues[0]!.message, color: 'error' })
    return
  }
  submittingProfile.value = true
  try {
    await update(props.user.id, parsed.data)
    toast.add({ title: 'Utilisateur mis à jour', color: 'success' })
    emit('updated')
    emit('update:open', false)
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    submittingProfile.value = false
  }
}

const submittingPassword = ref(false)
async function savePassword() {
  if (!props.user) return
  if (newPassword.value.length < 8) {
    toast.add({ title: 'Mot de passe trop court (8 caractères minimum).', color: 'error' })
    return
  }
  if (!confirm(`Réinitialiser le mot de passe de ${props.user.name} ?\n\nToutes ses sessions seront déconnectées.`)) return

  submittingPassword.value = true
  try {
    await resetPassword(props.user.id, newPassword.value)
    toast.add({ title: 'Mot de passe réinitialisé', color: 'success' })
    newPassword.value = ''
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  } finally {
    submittingPassword.value = false
  }
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let pwd = ''
  const arr = new Uint32Array(12)
  crypto.getRandomValues(arr)
  for (const v of arr) pwd += chars[v % chars.length]
  newPassword.value = pwd
}

const roleOptions = [
  { label: 'Administrateur', value: 'ADMIN' },
  { label: 'Gérant', value: 'MANAGER' },
  { label: 'Lecture seule', value: 'VIEWER' }
]

const tabs = [
  { label: 'Profil', value: 'profile', icon: 'i-lucide-user' },
  { label: 'Mot de passe', value: 'password', icon: 'i-lucide-key' }
]
</script>

<template>
  <UModal
    :open="open"
    :title="user ? `Modifier ${user.name}` : 'Modifier l\'utilisateur'"
    :ui="{ content: 'max-w-md' }"
    @update:open="(v) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UTabs
          v-model="tab"
          :items="tabs"
        />

        <div
          v-if="tab === 'profile'"
          class="space-y-4"
        >
          <UFormField
            label="Nom complet"
            required
          >
            <UInput
              v-model="profile.name"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Email"
            required
          >
            <UInput
              v-model="profile.email"
              type="email"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Rôle"
            required
          >
            <USelect
              v-model="profile.role"
              :items="roleOptions"
              class="w-full"
            />
          </UFormField>

          <UAlert
            v-if="isSelf && profile.role !== 'ADMIN'"
            color="warning"
            variant="soft"
            icon="i-lucide-alert-triangle"
            title="Vous êtes en train de retirer votre propre statut administrateur."
          />
        </div>

        <div
          v-if="tab === 'password'"
          class="space-y-4"
        >
          <UFormField
            label="Nouveau mot de passe"
            help="Au moins 8 caractères. À communiquer à l'utilisateur."
          >
            <div class="flex gap-2">
              <UInput
                v-model="newPassword"
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

          <UAlert
            color="info"
            variant="soft"
            icon="i-lucide-info"
            description="Toutes les sessions actives de cet utilisateur seront déconnectées."
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton
          variant="ghost"
          @click="emit('update:open', false)"
        >
          Fermer
        </UButton>
        <UButton
          v-if="tab === 'profile'"
          :loading="submittingProfile"
          icon="i-lucide-save"
          @click="saveProfile"
        >
          Enregistrer
        </UButton>
        <UButton
          v-else
          :loading="submittingPassword"
          color="warning"
          icon="i-lucide-key"
          @click="savePassword"
        >
          Réinitialiser le mot de passe
        </UButton>
      </div>
    </template>
  </UModal>
</template>
