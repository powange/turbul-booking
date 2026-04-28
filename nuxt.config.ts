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

  // La page Plan dépend entièrement de l'auth (canEdit) et de Leaflet
  // (client-only) ; SSR n'apporte rien et provoque des mismatchs d'hydratation.
  routeRules: {
    '/': { ssr: false }
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    experimental: {
      websocket: true
    }
  },

  // Polling activé via CHOKIDAR_USEPOLLING — utile dans le conteneur de dev
  // (sinon Vite ne voit pas certaines modifications de fichiers via bind mount).
  vite: {
    server: {
      watch: process.env.CHOKIDAR_USEPOLLING === 'true'
        ? { usePolling: true, interval: 500 }
        : undefined
    },
    // Pré-bundle pour éviter qu'un import CJS dynamique (leaflet) ne déclenche
    // un re-optimize + reload de la page côté client.
    optimizeDeps: {
      include: [
        'leaflet',
        '@geoman-io/leaflet-geoman-free',
        'better-auth/vue',
        'better-auth/client/plugins',
        'zod',
        '@vue/devtools-core',
        '@vue/devtools-kit'
      ]
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
