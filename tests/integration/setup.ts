import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma client dédié aux tests d'intégration. On exige `TEST_DATABASE_URL`
// pour empêcher de pointer involontairement sur la base de dev (le `resetDb`
// est destructif). En CI : pointer sur le service Postgres dédié. En local :
// pointer sur une base séparée (ex: turbul_test).
const connectionString = process.env.TEST_DATABASE_URL
if (!connectionString) {
  throw new Error(
    'TEST_DATABASE_URL doit être définie pour les tests d\'intégration. '
    + 'Ne pas pointer sur la base de dev — les tests TRUNCATE toutes les tables.'
  )
}

export const testPrisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString })
})

/**
 * Tronque toutes les tables métier pour repartir d'un état vierge.
 * `RESTART IDENTITY CASCADE` réinitialise les séquences et nettoie les FK.
 * Les tables better-auth (User/Session/Account/Verification) ne sont pas
 * tronquées par défaut — on garde la possibilité de seed un user persistant
 * en tête de suite. `truncateAuth: true` les inclut.
 */
export async function resetDb(opts: { truncateAuth?: boolean } = {}) {
  const tables = [
    'Booking',
    'CaravanUnavailability',
    'Bed',
    'Caravan',
    'Guest',
    'Zone',
    'Wall',
    'AuditLog'
  ]
  if (opts.truncateAuth) {
    tables.push('Verification', 'Session', 'Account', 'User')
  }
  // Quotes nécessaires : Prisma génère les noms de tables avec PascalCase.
  const list = tables.map(t => `"${t}"`).join(', ')
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

/**
 * Crée un user MANAGER de test. Retourne son id pour `createdById`.
 * better-auth normalement gère l'inscription, mais pour les tests on
 * insère directement (pas besoin de hash de password ni de session).
 */
export async function seedManager(overrides: Partial<{ id: string, email: string, name: string }> = {}) {
  const id = overrides.id ?? `test-user-${Math.random().toString(36).slice(2, 10)}`
  return testPrisma.user.create({
    data: {
      id,
      email: overrides.email ?? `${id}@test.local`,
      name: overrides.name ?? 'Test Manager',
      role: 'MANAGER',
      emailVerified: true
    }
  })
}

export async function seedCaravan(overrides: Partial<{ name: string, lat: number, lng: number }> = {}) {
  return testPrisma.caravan.create({
    data: {
      name: overrides.name ?? 'Test Caravan',
      lat: overrides.lat ?? 43.78,
      lng: overrides.lng ?? 4.35,
      hasElectricity: false
    }
  })
}

export async function seedBed(caravanId: string, overrides: Partial<{ label: string, capacity: number }> = {}) {
  return testPrisma.bed.create({
    data: {
      caravanId,
      label: overrides.label ?? 'Lit 1',
      capacity: overrides.capacity ?? 2
    }
  })
}

export async function seedGuest(overrides: Partial<{ firstName: string, lastName: string }> = {}) {
  return testPrisma.guest.create({
    data: {
      firstName: overrides.firstName ?? 'Jean',
      lastName: overrides.lastName ?? 'Dupont'
    }
  })
}
