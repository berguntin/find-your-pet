import { describe, expect, it } from 'vitest'
import { ConflictError, ForbiddenError, ValidationError } from '../../../shared/domain/errors'
import { Sighting, type ReportSightingData } from './Sighting'

const now = new Date('2026-11-08T12:00:00Z')
const data = (overrides: Partial<ReportSightingData> = {}): ReportSightingData => ({
    description: '  Lo vi cruzando la calle Mayor hacia el parque  ',
    area: ' Paiporta centro ',
    seenAt: new Date('2026-11-08T09:30:00Z'),
    ...overrides
})
const report = (overrides: Partial<ReportSightingData> = {}) =>
    Sighting.report(data(overrides), { id: 'sighting-1', petId: 'pet-1', authorId: 'author', now })
const published = () => {
    const sighting = report()
    sighting.applyAutomaticModeration('approved', null, now)
    sighting.pullEvents()
    return sighting
}

describe('Sighting', () => {
    it('is reported pending review, trimmed and without validations', () => {
        expect(report().toSnapshot()).toEqual({
            id: 'sighting-1',
            petId: 'pet-1',
            authorId: 'author',
            description: 'Lo vi cruzando la calle Mayor hacia el parque',
            area: 'Paiporta centro',
            seenAt: new Date('2026-11-08T09:30:00Z'),
            images: [],
            moderationStatus: 'pending_review',
            moderationScores: null,
            moderatedAt: null,
            verifiedAt: null,
            verifiedBy: null,
            validations: [],
            version: 0,
            createdAt: now
        })
    })

    it.each([
        ['a too short description', { description: 'lo vi' }, 'description'],
        ['a too long description', { description: 'x'.repeat(1001) }, 'description'],
        ['a too short area', { area: 'P' }, 'area'],
        ['a too long area', { area: 'x'.repeat(121) }, 'area'],
        ['too many images', { images: ['a', 'b', 'c', 'd'] }, 'images'],
        ['a date in the future', { seenAt: new Date('2026-11-08T13:00:00Z') }, 'seenAt'],
        ['an invalid date', { seenAt: new Date('nope') }, 'seenAt'],
        ['a date over a year ago', { seenAt: new Date('2025-11-01T00:00:00Z') }, 'seenAt']
    ])('rejects %s', (_, overrides, field) => {
        expect(() => report(overrides)).toThrow(ValidationError)
        try {
            report(overrides)
        } catch (error) {
            expect((error as ValidationError).details).toEqual({ field })
        }
    })

    it('tolerates phone clocks a few minutes ahead', () => {
        expect(() => report({ seenAt: new Date('2026-11-08T12:05:00Z') })).not.toThrow()
    })

    it('records an event when it is published, once', () => {
        const sighting = report()
        sighting.applyAutomaticModeration('pending_review', null, now)
        expect(sighting.pullEvents()).toEqual([])

        sighting.approve({ kind: 'admin' }, now)
        sighting.approve({ kind: 'admin' }, now)

        expect(sighting.isPublic).toBe(true)
        expect(sighting.pullEvents()).toEqual([
            { type: 'sighting.published', occurredAt: now, payload: { sightingId: 'sighting-1', petId: 'pet-1' } }
        ])
    })

    it('only lets admins approve or hide it', () => {
        const sighting = report()
        expect(() => sighting.approve({ kind: 'user', userId: 'author' }, now)).toThrow(ForbiddenError)
        sighting.approve({ kind: 'admin' }, now)
        expect(() => sighting.unpublish({ kind: 'anonymous' }, now)).toThrow(ForbiddenError)
        sighting.unpublish({ kind: 'admin' }, now)
        expect(sighting.isPublic).toBe(false)
    })

    it('is verified by three different people', () => {
        const sighting = published()
        sighting.validate('ana', 'owner', now)
        sighting.validate('luis', 'owner', now)
        expect(sighting.isVerified).toBe(false)
        expect(sighting.points).toBe(2)

        sighting.validate('marta', 'owner', now)

        expect(sighting.isVerified).toBe(true)
        expect(sighting.toSnapshot()).toMatchObject({ verifiedAt: now, verifiedBy: 'community' })
        expect(sighting.pullEvents()).toEqual([
            { type: 'sighting.verified', occurredAt: now, payload: { sightingId: 'sighting-1', petId: 'pet-1' } }
        ])
    })

    it("is verified by the pet's owner alone", () => {
        const sighting = published()
        sighting.validate('owner', 'owner', now)

        expect(sighting.points).toBe(3)
        expect(sighting.toSnapshot()).toMatchObject({ verifiedBy: 'owner' })
    })

    it('stays verified and records the event only once', () => {
        const sighting = published()
        sighting.validate('owner', 'owner', now)
        sighting.validate('ana', 'owner', now)

        expect(sighting.points).toBe(4)
        expect(sighting.pullEvents()).toHaveLength(1)
    })

    it('treats pets without an owner as community-only', () => {
        const sighting = published()
        sighting.validate('ana', null, now)
        expect(sighting.points).toBe(1)
    })

    it('cannot be validated by its author, twice by the same person, or before it is published', () => {
        const sighting = published()
        expect(() => sighting.validate('author', 'owner', now)).toThrow(ForbiddenError)
        sighting.validate('ana', 'owner', now)
        expect(() => sighting.validate('ana', 'owner', now)).toThrow(ConflictError)
        expect(() => report().validate('ana', 'owner', now)).toThrow(ConflictError)
    })

    it('tells who may validate it', () => {
        const sighting = published()
        sighting.validate('ana', null, now)

        expect(sighting.canBeValidatedBy('luis')).toBe(true)
        expect(sighting.canBeValidatedBy('ana')).toBe(false)
        expect(sighting.canBeValidatedBy('author')).toBe(false)
        expect(sighting.canBeValidatedBy(null)).toBe(false)
        expect(report().canBeValidatedBy('luis')).toBe(false)
        expect(sighting.hasValidated(null)).toBe(false)
        expect(sighting.isAuthor(null)).toBe(false)
    })

    it("can be sent back to review by the pet's family, once published", () => {
        const sighting = published()
        sighting.hideForReview(now)

        expect(sighting.isPublic).toBe(false)
        expect(() => sighting.hideForReview(now)).toThrow(ConflictError)
    })

    it('can be deleted by its author or an admin', () => {
        const sighting = published()
        expect(sighting.canBeDeletedBy({ kind: 'user', userId: 'author' })).toBe(true)
        expect(sighting.canBeDeletedBy({ kind: 'admin' })).toBe(true)
        expect(sighting.canBeDeletedBy({ kind: 'user', userId: 'ana' })).toBe(false)
        expect(sighting.canBeDeletedBy({ kind: 'anonymous' })).toBe(false)
    })

    it('restores a copy that does not share state', () => {
        const sighting = published()
        sighting.validate('ana', null, now)
        const copy = Sighting.restore(sighting.toSnapshot())
        copy.validate('luis', null, now)

        expect(sighting.points).toBe(1)
        expect(copy.points).toBe(2)
    })
})
