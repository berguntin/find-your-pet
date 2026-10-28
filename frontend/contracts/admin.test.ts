import { describe, expect, it } from 'vitest'
import { adminListPetsQuerySchema, adminStatsQuerySchema, adminUpdatePetSchema, moderatePetSchema } from './admin'

describe('adminUpdatePetSchema', () => {
    it('accepts partial updates and trims text', () => {
        expect(adminUpdatePetSchema.parse({ location: '  Sedaví ', resolution: 'open' })).toEqual({
            location: 'Sedaví',
            resolution: 'open'
        })
        expect(adminUpdatePetSchema.parse({ name: null })).toEqual({ name: null })
    })

    it.each([
        ['unknown fields', { ownerId: 'x' }],
        ['empty description', { description: ' ' }],
        ['no images', { images: [] }],
        ['invalid dates', { eventDate: '21/10/2026' }],
        ['unknown resolutions', { resolution: 'lost' }]
    ])('rejects %s', (_, body) => {
        expect(adminUpdatePetSchema.safeParse(body).success).toBe(false)
    })
})

describe('admin queries', () => {
    it('lists by any moderation status or all of them', () => {
        expect(adminListPetsQuerySchema.parse({ moderationStatus: 'all' }).moderationStatus).toBe('all')
        expect(adminListPetsQuerySchema.safeParse({ moderationStatus: 'rejected' }).success).toBe(false)
    })

    it('accepts the three statistics periods, 30 days by default', () => {
        expect(adminStatsQuerySchema.parse({}).days).toBe(30)
        expect(adminStatsQuerySchema.parse({ days: '7' }).days).toBe(7)
        expect(adminStatsQuerySchema.safeParse({ days: '365' }).success).toBe(false)
    })

    it('moderates to any status', () => {
        expect(moderatePetSchema.parse({ status: 'pending_review' }).status).toBe('pending_review')
    })
})
