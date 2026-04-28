import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { createBookings } from '~~/server/services/bookings'
import { testPrisma, resetDb, seedManager, seedCaravan, seedBed, seedGuest } from './setup'

let managerId: string
let caravanId: string
let bedId: string
let guestId: string

beforeAll(async () => {
  // Reset complet en début de suite (auth inclus pour repartir vierge)
  await resetDb({ truncateAuth: true })
})

beforeEach(async () => {
  // Reset entre tests, puis seed des fixtures de base
  await resetDb({ truncateAuth: true })
  const manager = await seedManager()
  managerId = manager.id
  const caravan = await seedCaravan()
  caravanId = caravan.id
  const bed = await seedBed(caravanId, { capacity: 2 })
  bedId = bed.id
  const guest = await seedGuest()
  guestId = guest.id
})

afterAll(async () => {
  await testPrisma.$disconnect()
})

describe('createBookings — happy path', () => {
  it('creates one booking per night for a 3-night range', async () => {
    const result = await testPrisma.$transaction(tx =>
      createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-07', guestId }, managerId)
    )
    expect(result.created).toHaveLength(3)
    expect(result.created.map(b => b.date.toISOString().slice(0, 10))).toEqual([
      '2026-05-04', '2026-05-05', '2026-05-06'
    ])
    expect(result.guestCreated).toBe(false)
    expect(result.guestId).toBe(guestId)
  })

  it('creates a new guest when only the inline guest object is provided', async () => {
    const result = await testPrisma.$transaction(tx =>
      createBookings(tx, {
        bedId,
        from: '2026-05-04',
        to: '2026-05-05',
        guest: { firstName: 'Alice', lastName: 'Martin', email: 'alice@x.fr' }
      }, managerId)
    )
    expect(result.guestCreated).toBe(true)
    const guests = await testPrisma.guest.findMany({ where: { firstName: 'Alice' } })
    expect(guests).toHaveLength(1)
    expect(guests[0]!.email).toBe('alice@x.fr')
    expect(result.created).toHaveLength(1)
  })
})

describe('createBookings — validation errors', () => {
  it('rejects when to <= from (no nights)', async () => {
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-04', guestId }, managerId)
      )
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: expect.stringContaining('Plage de dates invalide') })
  })

  it('rejects when range exceeds 365 nights', async () => {
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-01-01', to: '2027-02-01', guestId }, managerId)
      )
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: expect.stringContaining('trop longue') })
  })

  it('rejects with 404 when bed does not exist', async () => {
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId: 'nope', from: '2026-05-04', to: '2026-05-05', guestId }, managerId)
      )
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects with 400 when caravan is soft-deleted', async () => {
    await testPrisma.caravan.update({ where: { id: caravanId }, data: { deletedAt: new Date() } })
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-05', guestId }, managerId)
      )
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: expect.stringContaining('Caravane retirée') })
  })

  it('rejects with 400 when neither guestId nor guest is provided', async () => {
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-05' }, managerId)
      )
    ).rejects.toMatchObject({ statusCode: 400, statusMessage: expect.stringContaining('guestId ou guest requis') })
  })
})

describe('createBookings — capacity', () => {
  it('rejects with 409 when bed is already at capacity for one of the nights', async () => {
    // Capacité = 2, on remplit la nuit du 5 avec 2 hôtes
    const guest2 = await seedGuest({ firstName: 'Bob', lastName: 'Other' })
    await testPrisma.booking.createMany({
      data: [
        { bedId, guestId, date: new Date('2026-05-05T00:00:00Z'), createdById: managerId },
        { bedId, guestId: guest2.id, date: new Date('2026-05-05T00:00:00Z'), createdById: managerId }
      ]
    })
    const guest3 = await seedGuest({ firstName: 'Charlie', lastName: 'Three' })
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-07', guestId: guest3.id }, managerId)
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: expect.stringContaining('2026-05-05')
    })
  })

  it('atomically rolls back: no booking persists when one night fails capacity', async () => {
    const guest2 = await seedGuest({ firstName: 'Bob', lastName: 'Other' })
    await testPrisma.booking.createMany({
      data: [
        { bedId, guestId, date: new Date('2026-05-06T00:00:00Z'), createdById: managerId },
        { bedId, guestId: guest2.id, date: new Date('2026-05-06T00:00:00Z'), createdById: managerId }
      ]
    })
    const guest3 = await seedGuest({ firstName: 'Charlie', lastName: 'Three' })
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-07', guestId: guest3.id }, managerId)
      )
    ).rejects.toMatchObject({ statusCode: 409 })
    // Aucun booking pour guest3 ne doit avoir été persisté
    const persisted = await testPrisma.booking.count({ where: { guestId: guest3.id } })
    expect(persisted).toBe(0)
  })
})

describe('createBookings — caravan unavailability', () => {
  it('rejects with 409 when the period overlaps an unavailability', async () => {
    await testPrisma.caravanUnavailability.create({
      data: {
        caravanId,
        from: new Date('2026-05-05T00:00:00Z'),
        to: new Date('2026-05-08T00:00:00Z'),
        reason: 'Maintenance',
        createdById: managerId
      }
    })
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-06', guestId }, managerId)
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: expect.stringContaining('Maintenance')
    })
  })

  it('accepts a booking strictly before an unavailability (to <= unav.from)', async () => {
    await testPrisma.caravanUnavailability.create({
      data: {
        caravanId,
        from: new Date('2026-05-08T00:00:00Z'),
        to: new Date('2026-05-10T00:00:00Z'),
        createdById: managerId
      }
    })
    const result = await testPrisma.$transaction(tx =>
      createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-08', guestId }, managerId)
    )
    expect(result.created).toHaveLength(4)
  })
})

describe('createBookings — uniqueness', () => {
  it('rejects with 409 when (bed, date, guest) already exists', async () => {
    await testPrisma.booking.create({
      data: { bedId, guestId, date: new Date('2026-05-05T00:00:00Z'), createdById: managerId }
    })
    await expect(
      testPrisma.$transaction(tx =>
        createBookings(tx, { bedId, from: '2026-05-04', to: '2026-05-07', guestId }, managerId)
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      statusMessage: expect.stringContaining('déjà attribué')
    })
  })
})
