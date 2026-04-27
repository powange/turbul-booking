// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  nitro: {
    experimental: {
      websocket: true
    }
  },

  runtimeConfig: {
    // server-only
    databaseUrl: process.env.DATABASE_URL,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,
    betterAuthUrl: process.env.BETTER_AUTH_URL,

    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      // École de Cirque Turbul' — 68 chemin de Campagnole, 30900 Nîmes
      mapDefaultLat: Number(process.env.NUXT_PUBLIC_MAP_DEFAULT_LAT || 43.7828848),
      mapDefaultLng: Number(process.env.NUXT_PUBLIC_MAP_DEFAULT_LNG || 4.3543537),
      mapDefaultZoom: Number(process.env.NUXT_PUBLIC_MAP_DEFAULT_ZOOM || 19)
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
