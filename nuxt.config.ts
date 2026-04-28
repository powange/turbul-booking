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

  // CSP + entêtes de durcissement, posés via routeRules pour s'appliquer à
  // toutes les routes (rendues + API + assets).
  // Notes :
  //   - 'unsafe-inline' sur scripts/styles : Nuxt injecte des scripts/styles
  //     inline pour l'hydratation. Le support nonce de Nuxt 4 est encore
  //     limité, on assouplit pragmatiquement.
  //   - 'unsafe-eval' : requis par certaines libs Vue/Nitro en dev (Vite).
  //   - tile.openstreetmap.org + arcgisonline.com : tuiles Leaflet.
  //   - ws:/wss: : WebSocket Nitro pour le realtime.
  // La page Plan ('/') reste en SPA pour éviter les mismatchs d'hydratation
  // sur les éléments dépendants de l'auth (canEdit, Leaflet client-only).
  routeRules: {
    '/': { ssr: false },
    '/**': {
      headers: {
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        // OpenStreetMap exige un Referer non vide en cross-origin (anti-bulk
        // download). 'strict-origin-when-cross-origin' envoie juste l'origine
        // — suffisant pour OSM et standard pour limiter la fuite d'URL.
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': [
          'default-src \'self\'',
          'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'',
          'style-src \'self\' \'unsafe-inline\'',
          'img-src \'self\' data: blob: https://*.tile.openstreetmap.org https://server.arcgisonline.com https://api.iconify.design',
          'font-src \'self\' data:',
          'connect-src \'self\' ws: wss: https://api.iconify.design',
          'frame-ancestors \'none\'',
          'base-uri \'self\'',
          'form-action \'self\''
        ].join('; ')
      }
    }
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
