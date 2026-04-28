<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { authClient } from '~/lib/authClient'

definePageMeta({ layout: 'auth' })

useHead({ title: 'Connexion · Turbul' })

const route = useRoute()

const { data: status } = await useFetch('/api/auth-status')

// Si aucun utilisateur n'existe encore, on redirige vers la page d'inscription
// du premier compte.
if (status.value?.signupOpen) {
  await navigateTo('/signup')
}

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis')
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '', password: '' })
const loading = ref(false)
const errorMsg = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMsg.value = null
  try {
    const { error } = await authClient.signIn.email({
      email: event.data.email,
      password: event.data.password
    })
    if (error) {
      errorMsg.value = error.message ?? 'Identifiants invalides'
      return
    }
    const redirect = (route.query.redirect as string) || '/'
    await navigateTo(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <h1 class="text-xl font-semibold">
        Connexion
      </h1>
      <p class="text-sm text-muted">
        Turbul Booking — gestion des caravanes
      </p>
    </template>

    <UForm
      :state="state"
      :schema="schema"
      class="space-y-4"
      @submit="onSubmit"
    >
      <UFormField
        label="Email"
        name="email"
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
        label="Mot de passe"
        name="password"
        required
      >
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <UAlert
        v-if="errorMsg"
        color="error"
        variant="soft"
        :title="errorMsg"
      />

      <UButton
        type="submit"
        block
        :loading="loading"
      >
        Se connecter
      </UButton>
    </UForm>
  </UCard>
</template>
