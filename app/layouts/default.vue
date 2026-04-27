<script setup lang="ts">
const { user, role, signOut } = useAuth()

const navItems = computed(() => {
  const items: Array<{ label: string, to: string, icon: string }> = [
    { label: 'Plan', to: '/', icon: 'i-lucide-map' },
    { label: 'Réservations', to: '/bookings', icon: 'i-lucide-calendar-days' },
    { label: 'Hôtes', to: '/guests', icon: 'i-lucide-users-round' }
  ]
  if (role.value === 'ADMIN') {
    items.push({ label: 'Utilisateurs', to: '/admin/users', icon: 'i-lucide-shield-user' })
    items.push({ label: 'Audit', to: '/admin/audit', icon: 'i-lucide-history' })
    items.push({ label: 'Import/Export', to: '/admin/import-export', icon: 'i-lucide-database-backup' })
  }
  return items
})

const userMenu = computed(() => [
  [{
    label: user.value?.email ?? '',
    slot: 'account',
    disabled: true
  }],
  [{
    label: 'Se déconnecter',
    icon: 'i-lucide-log-out',
    onSelect: () => signOut()
  }]
])
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-tent" class="text-primary" />
          <span>Turbul Booking</span>
        </NuxtLink>
      </template>

      <UNavigationMenu :items="navItems" />

      <template #right>
        <UColorModeButton />
        <UDropdownMenu :items="userMenu">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-user"
            :label="user?.name ?? ''"
          />
        </UDropdownMenu>
      </template>

      <template #body>
        <UNavigationMenu :items="navItems" orientation="vertical" />
      </template>
    </UHeader>

    <UMain>
      <slot />
    </UMain>
  </UApp>
</template>
