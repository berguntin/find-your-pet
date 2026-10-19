import { describe, expect, it } from 'vitest'
import { decideModeration, type ModerationScores } from './moderation'

const scores = (overrides: Partial<ModerationScores> = {}): ModerationScores => ({
    isPetReport: 0.95,
    showsAnimal: 0.9,
    inappropriate: 0.01,
    ...overrides
})

describe('decideModeration', () => {
    it('approves a confident, clean pet report', () => {
        expect(decideModeration(scores())).toBe('approved')
    })

    it.each([
        ['it is clearly not a pet report', { isPetReport: 0.1 }],
        ['it is clearly inappropriate', { inappropriate: 0.9 }],
        ['it is inappropriate even if it is a pet report', { isPetReport: 0.99, inappropriate: 0.75 }]
    ])('rejects when %s', (_, overrides) => {
        expect(decideModeration(scores(overrides))).toBe('rejected')
    })

    it.each([
        ['the pet report score is in the middle', { isPetReport: 0.5 }],
        ['the images may not show an animal', { showsAnimal: 0.3 }],
        ['inappropriate content is possible', { inappropriate: 0.4 }],
        ['the moderator refused a question', { showsAnimal: null }],
        ['the moderator refused every question', { isPetReport: null, showsAnimal: null, inappropriate: null }]
    ])('sends to review when %s', (_, overrides) => {
        expect(decideModeration(scores(overrides))).toBe('pending_review')
    })

    it('sends to review when the moderator was unavailable', () => {
        expect(decideModeration(null)).toBe('pending_review')
    })

    it('uses the thresholds at their boundaries', () => {
        expect(decideModeration(scores({ isPetReport: 0.8 }))).toBe('approved')
        expect(decideModeration(scores({ isPetReport: 0.3 }))).toBe('pending_review')
        expect(decideModeration(scores({ inappropriate: 0.2 }))).toBe('pending_review')
        expect(decideModeration(scores({ inappropriate: 0.7 }))).toBe('rejected')
    })

    it('accepts custom thresholds', () => {
        const strict = {
            approveIsPetReport: 0.99,
            approveShowsAnimal: 0.5,
            approveInappropriate: 0.2,
            rejectIsPetReport: 0.3,
            rejectInappropriate: 0.7
        }

        expect(decideModeration(scores({ isPetReport: 0.95 }), strict)).toBe('pending_review')
    })
})
