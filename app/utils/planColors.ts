// Couleurs utilisées par les overlays Leaflet (polygones + markers).
// Alignées sur la charte "turbul" — synchronisées manuellement avec
// app/assets/css/main.css (@theme static --color-turbul-*). Toute évolution
// de la charte doit toucher les deux fichiers.
//
// Pourquoi des constantes JS plutôt que des var(--color-…) en CSS ?
// L.polygon({ color, fillColor }) attend des strings CSS résolues, et
// Leaflet ne reparse pas les styles via les CSS variables après chaque
// changement de thème.

const TURBUL = {
  400: '#df8055',
  500: '#cb6743',
  700: '#964530'
} as const

export const PLAN_COLORS = {
  caravan: {
    // Sélection : couleur de marque (terracotta)
    selected: { stroke: TURBUL[500], fill: TURBUL[400] },
    // Caravane raccordée à l'électricité : vert (sémantique "ready")
    powered: { stroke: '#16a34a', fill: '#22c55e' },
    // Caravane non raccordée : slate neutre
    neutral: { stroke: '#64748b', fill: '#94a3b8' }
  }
} as const

// Classes Tailwind pour les pins HTML — utilise l'alias `primary` qui
// pointe vers la palette `turbul` (cf. app/app.config.ts).
export const CARAVAN_PIN_CLASSES = {
  selected: 'bg-primary-500 border-primary-700',
  powered: 'bg-green-500 border-green-700',
  neutral: 'bg-slate-500 border-slate-700'
} as const
