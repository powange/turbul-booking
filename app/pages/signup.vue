<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: 'auth' })

useHead({ title: 'Création du premier compte · Turbul' })

const { data: status, refresh } = await useFetch('/api/auth-status')

// Si l'inscription n'est plus ouverte (un compte existe déjà), on renvoie vers /login
if (!status.value?.signupOpen) {
  await navigateTo('/login')
}

const schema = z.object({
  name: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Au moins 8 caractères'),
  passwordConfirm: z.string()
}).refine(d => d.password === d.passwordConfirm, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['passwordConfirm']
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ name: '', email: '', password: '', passwordConfirm: '' })
const loading = ref(false)
const errorMsg = ref<string | null>(null)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  errorMsg.value = null
  try {
    const res = await $fetch.raw('/api/auth/signup-first', {
      method: 'POST',
      body: {
        name: event.data.name,
        email: event.data.email,
        password: event.data.password
      }
    }).catch((e) => {
      errorMsg.value = e?.data?.message ?? e?.statusMessage ?? 'Erreur lors de la création du compte'
      return null
    })

    if (!res) return

    await refresh()
    await navigateTo('/')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard class="w-full max-w-md">
    <template #header>
      <h1 class="text-xl font-semibold">
        Premier compte administrateur
      </h1>
      <p class="text-sm text-muted">
        Aucun utilisateur n'existe encore. Ce compte sera l'administrateur du système.
      </p>
    </template>

    <UForm
      :state="state"
      :schema="schema"
      class="space-y-4"
      @submit="onSubmit"
    >
      <UFormField label="Nom complet" name="name" required>
        <UInput v-model="state.name" autocomplete="name" class="w-full" />
      </UFormField>

      <UFormField label="Email" name="email" required>
        <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
      </UFormField>

      <UFormField label="Mot de passe" name="password" required help="Au moins 8 caractères">
        <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>

      <UFormField label="Confirmer le mot de passe" name="passwordConfirm" required>
        <UInput v-model="state.passwordConfirm" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>

      <UAlert
        v-if="errorMsg"
        color="error"
        variant="soft"
        :title="errorMsg"
      />

      <UButton type="submit" block :loading="loading">
        Créer le compte administrateur
      </UButton>
    </UForm>
  </UCard>
</template>
