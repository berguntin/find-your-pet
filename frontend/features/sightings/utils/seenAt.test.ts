import { describe, expect, it } from 'vitest'
import { fromDateTimeLocal, sightingSupport, toDateTimeLocal } from './seenAt'

describe('seenAt helpers', () => {
    it('round-trips a local date and time', () => {
        const date = new Date(2026, 10, 8, 9, 5)
        const local = toDateTimeLocal(date)

        expect(local).toBe('2026-11-08T09:05')
        expect(fromDateTimeLocal(local)).toBe(date.toISOString())
    })

    it('returns null for empty or invalid values', () => {
        expect(fromDateTimeLocal('')).toBeNull()
        expect(fromDateTimeLocal('nope')).toBeNull()
    })
})

describe('sightingSupport', () => {
    it('reads verified sightings by who verified them, and the rest as progress', () => {
        expect(sightingSupport({ verified: true, verifiedBy: 'owner', points: 3 }, 3).kind).toBe('owner')
        expect(sightingSupport({ verified: true, verifiedBy: 'community', points: 4 }, 3).kind).toBe('community')
        expect(sightingSupport({ verified: false, verifiedBy: null, points: 2 }, 3)).toEqual({
            kind: 'progress',
            points: 2,
            threshold: 3
        })
    })
})
