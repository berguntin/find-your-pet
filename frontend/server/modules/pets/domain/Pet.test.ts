import { describe, expect, it } from 'vitest'
import { ConflictError, ForbiddenError, ValidationError } from '../../../shared/domain/errors'
import { Pet, type ReportPetData } from './Pet'

const now = new Date('2026-10-19T10:00:00Z')

const validData = (overrides: Partial<ReportPetData> = {}): ReportPetData => ({
    reportType: 'found',
    species: 'dog',
    name: '  Toby ',
    description: ' Perro marrón con collar rojo ',
    location: 'Paiporta',
    contact: '600000000',
    images: ['https://img/1.jpg'],
    alive: true,
    eventDate: '2026-10-18',
    ...overrides
})

const report = (overrides: Partial<ReportPetData> = {}, ownerId: string | null = null) =>
    Pet.report(validData(overrides), { id: 'pet-1', now, ownerId })

describe('Pet.report', () => {
    it('creates an open report with trimmed text', () => {
        const pet = report().toSnapshot()

        expect(pet).toMatchObject({
            id: 'pet-1',
            name: 'Toby',
            description: 'Perro marrón con collar rojo',
            resolution: 'open',
            resolvedBy: null,
            ownerId: null,
            createdAt: now
        })
    })

    it('treats an empty name as unknown', () => {
        expect(report({ name: '   ' }).toSnapshot().name).toBeNull()
    })

    it('always considers lost pets alive', () => {
        expect(report({ reportType: 'lost', alive: false }).toSnapshot().alive).toBe(true)
    })

    it('keeps the alive flag for found pets', () => {
        expect(report({ reportType: 'found', alive: false }).toSnapshot().alive).toBe(false)
    })

    it('removes duplicated images', () => {
        expect(report({ images: ['a', 'a', 'b'] }).toSnapshot().images).toEqual(['a', 'b'])
    })

    it.each([
        ['no images', { images: [] }],
        ['too many images', { images: Array.from({ length: 11 }, (_, i) => `img-${i}`) }],
        ['empty description', { description: '  ' }],
        ['empty location', { location: '' }],
        ['empty contact', { contact: '' }],
        ['too long name', { name: 'x'.repeat(61) }],
        ['malformed date', { eventDate: '18/10/2026' }],
        ['impossible date', { eventDate: '2026-02-30' }],
        ['future date', { eventDate: '2026-10-25' }],
        ['unknown species', { species: 'horse' as never }]
    ])('rejects %s', (_, overrides) => {
        expect(() => report(overrides)).toThrow(ValidationError)
    })
})

describe('Pet management', () => {
    it('lets an admin mark the pet as reunited', () => {
        const pet = report()
        pet.markAsReunited({ kind: 'admin' }, now)

        expect(pet.toSnapshot()).toMatchObject({ resolution: 'reunited', resolvedBy: 'admin', resolvedAt: now })
    })

    it('lets the owner mark the pet as reunited', () => {
        const pet = report({}, 'user-1')
        pet.markAsReunited({ kind: 'user', userId: 'user-1' }, now)

        expect(pet.toSnapshot().resolvedBy).toBe('owner')
    })

    it.each([
        ['anonymous visitors', { kind: 'anonymous' } as const, null],
        ['other users', { kind: 'user', userId: 'user-2' } as const, 'user-1'],
        ['users on anonymous reports', { kind: 'user', userId: 'user-1' } as const, null]
    ])('forbids %s', (_, actor, ownerId) => {
        expect(() => report({}, ownerId).markAsReunited(actor, now)).toThrow(ForbiddenError)
    })

    it('cannot be reunited twice', () => {
        const pet = report()
        pet.markAsReunited({ kind: 'admin' }, now)

        expect(() => pet.markAsReunited({ kind: 'admin' }, now)).toThrow(ConflictError)
    })
})
