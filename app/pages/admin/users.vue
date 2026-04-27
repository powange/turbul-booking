<script setup lang="ts">
import type { AdminUser } from '~~/shared/types'

useHead({ title: 'Utilisateurs · Turbul Booking' })

definePageMeta({ middleware: ['admin'] })

const { user: currentUser } = useAuth()
const { users, refresh, remove } = useUsers()
const toast = useToast()

await refresh()

const createOpen = ref(false)
const editOpen = ref(false)
const editTarget = ref<AdminUser | null>(null)

function openEdit(u: AdminUser) {
  editTarget.value = u
  editOpen.value = true
}

async function deleteUser(u: AdminUser) {
  if (!confirm(`Supprimer définitivement le compte de ${u.name} (${u.email}) ?\n\nL'historique des réservations qu'il a créées est conservé (réassigné à votre compte).`)) return
  try {
    await remove(u.id)
    toast.add({ title: 'Utilisateur supprimé', color: 'success' })
  } catch (err: any) {
    toast.add({
      title: 'Erreur',
      description: err?.statusMessage ?? err?.data?.statusMessage ?? String(err),
      color: 'error'
    })
  }
}

function roleColor(role: string) {
  if (role === 'ADMIN') return 'error' as const
  if (role === 'MANAGER') return 'primary' as const
  return 'neutral' as const
}

function roleLabel(role: string) {
  if (role === 'ADMIN') return 'Administrateur'
  if (role === 'MANAGER') return 'Gérant'
  return 'Lecture seule'
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })
function fmt(d: string) {
  return dateFmt.format(new Date(d))
}
</script>

<template>
  <UContainer class="py-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">Utilisateurs</h1>
        <p class="text-sm text-muted">{{ users.length }} compte{{ users.length > 1 ? 's' : '' }}</p>
      </div>
      <UButton icon="i-lucide-user-plus" @click="createOpen = true">
        Nouvel utilisateur
      </UButton>
    </div>

    <div class="border border-default rounded-md overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-elevated">
          <tr>
            <th class="text-left px-3 py-2">Nom</th>
            <th class="text-left px-3 py-2">Email</th>
            <th class="text-left px-3 py-2">Rôle</th>
            <th class="text-left px-3 py-2 hidden sm:table-cell">Créé le</th>
            <th class="px-3 py-2 w-32" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="u in users"
            :key="u.id"
            class="border-t border-default"
          >
            <td class="px-3 py-2 font-medium">
              {{ u.name }}
              <UBadge
                v-if="u.id === currentUser?.id"
                label="vous"
                size="xs"
                color="primary"
                variant="subtle"
                class="ml-1"
              />
            </td>
            <td class="px-3 py-2 text-muted">{{ u.email }}</td>
            <td class="px-3 py-2">
              <UBadge :color="roleColor(u.role)" variant="subtle">{{ roleLabel(u.role) }}</UBadge>
            </td>
            <td class="px-3 py-2 text-muted hidden sm:table-cell">{{ fmt(u.createdAt) }}</td>
            <td class="px-3 py-2 text-right">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="openEdit(u)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                :disabled="u.id === currentUser?.id"
                @click="deleteUser(u)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UserCreateModal v-model:open="createOpen" @created="refresh" />
    <UserEditModal
      v-model:open="editOpen"
      :user="editTarget"
      :is-self="editTarget?.id === currentUser?.id"
      @updated="refresh"
    />
  </UContainer>
</template>
