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

describe('Pet moderation and events', () => {
    const scores = { isPetReport: 0.9, showsAnimal: 0.9, inappropriate: 0 }

    it('starts pending review, unpublished and without events', () => {
        const pet = report()

        expect(pet.isPublic).toBe(false)
        expect(pet.toSnapshot()).toMatchObject({ moderationStatus: 'pending_review', moderatedAt: null })
        expect(pet.pullEvents()).toEqual([])
    })

    it('publishes on automatic approval', () => {
        const pet = report()
        pet.applyAutomaticModeration('approved', scores, now)

        expect(pet.isPublic).toBe(true)
        expect(pet.toSnapshot()).toMatchObject({ moderationScores: scores, moderatedAt: now })
        expect(pet.pullEvents()).toEqual([{ type: 'pet.published', occurredAt: now, payload: { petId: 'pet-1' } }])
    })

    it('stays hidden and silent when left for review', () => {
        const pet = report()
        pet.applyAutomaticModeration('pending_review', null, now)

        expect(pet.isPublic).toBe(false)
        expect(pet.pullEvents()).toEqual([])
    })

    it('is moderated automatically only once', () => {
        const pet = report()
        pet.applyAutomaticModeration('pending_review', null, now)

        expect(() => pet.applyAutomaticModeration('approved', scores, now)).toThrow(ConflictError)
    })

    it('lets only admins approve a pending pet', () => {
        const pet = report({}, 'user-1')
        pet.applyAutomaticModeration('pending_review', null, now)

        expect(() => pet.approve({ kind: 'user', userId: 'user-1' }, now)).toThrow(ForbiddenError)
        pet.approve({ kind: 'admin' }, now)
        expect(pet.isPublic).toBe(true)
        expect(pet.pullEvents().map(e => e.type)).toEqual(['pet.published'])
    })

    it('cannot approve a published pet again', () => {
        const pet = report()
        pet.applyAutomaticModeration('approved', scores, now)

        expect(() => pet.approve({ kind: 'admin' }, now)).toThrow(ConflictError)
    })

    it('records an event when reunited, and pulling clears events', () => {
        const pet = report()
        pet.markAsReunited({ kind: 'admin' }, now)

        expect(pet.pullEvents().map(e => e.type)).toEqual(['pet.reunited'])
        expect(pet.pullEvents()).toEqual([])
    })

    it('restores without pending events', () => {
        const pet = report()
        pet.markAsReunited({ kind: 'admin' }, now)

        expect(Pet.restore(pet.toSnapshot()).pullEvents()).toEqual([])
    })
})

describe('Pet editing', () => {
    const published = () => {
        const pet = report()
        pet.applyAutomaticModeration('approved', null, now)
        pet.pullEvents()
        return pet
    }

    it('changes any reported detail with the same rules as a report', () => {
        const pet = published()
        pet.edit(
            {
                reportType: 'lost',
                species: 'cat',
                name: ' Nala ',
                description: 'Gata gris',
                location: 'Sedaví',
                contact: 'ana@example.com',
                images: ['https://img/2.jpg', 'https://img/2.jpg'],
                eventDate: '2026-10-10'
            },
            { kind: 'admin' },
            now
        )

        expect(pet.toSnapshot()).toMatchObject({
            reportType: 'lost',
            species: 'cat',
            name: 'Nala',
            description: 'Gata gris',
            location: 'Sedaví',
            contact: 'ana@example.com',
            images: ['https://img/2.jpg'],
            alive: true,
            eventDate: '2026-10-10',
            id: 'pet-1',
            createdAt: now
        })
    })

    it('keeps omitted fields and clears the name when emptied', () => {
        const pet = published()
        pet.edit({ name: '', description: undefined }, { kind: 'admin' }, now)

        expect(pet.toSnapshot()).toMatchObject({ name: null, description: 'Perro marrón con collar rojo' })
    })

    it('records an event when a published pet changes, so search is updated', () => {
        const pet = published()
        pet.edit({ location: 'Benetússer' }, { kind: 'admin' }, now)

        expect(pet.pullEvents()).toEqual([{ type: 'pet.edited', occurredAt: now, payload: { petId: 'pet-1' } }])
    })

    it('records nothing when nothing changes or the pet is not published', () => {
        const pet = published()
        pet.edit({ location: 'Paiporta' }, { kind: 'admin' }, now)
        const hidden = report()
        hidden.edit({ location: 'Benetússer' }, { kind: 'admin' }, now)

        expect(pet.pullEvents()).toEqual([])
        expect(hidden.pullEvents()).toEqual([])
        expect(hidden.toSnapshot().location).toBe('Benetússer')
    })

    it('rejects invalid details without changing anything', () => {
        const pet = published()

        expect(() => pet.edit({ description: ' ', location: 'Sedaví' }, { kind: 'admin' }, now)).toThrow(
            ValidationError
        )
        expect(pet.toSnapshot().location).toBe('Paiporta')
    })

    it('requires managing the pet', () => {
        expect(() => published().edit({ location: 'Sedaví' }, { kind: 'anonymous' }, now)).toThrow(ForbiddenError)
    })

    it('reopens a reunited pet', () => {
        const pet = published()
        pet.markAsReunited({ kind: 'admin' }, now)
        pet.reopen({ kind: 'admin' })

        expect(pet.toSnapshot()).toMatchObject({ resolution: 'open', resolvedBy: null, resolvedAt: null })
        expect(() => pet.reopen({ kind: 'admin' })).toThrow(ConflictError)
        expect(() => published().reopen({ kind: 'anonymous' })).toThrow(ForbiddenError)
    })

    it('lets admins hide a published pet back to review', () => {
        const pet = published()
        const later = new Date('2026-10-20T10:00:00Z')
        pet.unpublish({ kind: 'admin' }, later)

        expect(pet.isPublic).toBe(false)
        expect(pet.toSnapshot().moderatedAt).toEqual(later)
        expect(pet.pullEvents()).toEqual([{ type: 'pet.unpublished', occurredAt: later, payload: { petId: 'pet-1' } }])
        expect(() => pet.unpublish({ kind: 'admin' }, later)).toThrow(ConflictError)
        expect(() => published().unpublish({ kind: 'user', userId: 'user-1' }, later)).toThrow(ForbiddenError)
    })
})
