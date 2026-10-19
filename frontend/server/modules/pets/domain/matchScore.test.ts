import { describe, expect, it } from 'vitest'
import { matchPercentage } from './matchScore'

const calibration = { floor: 0.6, ceiling: 0.9 }

describe('matchPercentage', () => {
    it.each([
        [0.59, null],
        [0.6, 0],
        [0.75, 50],
        [0.9, 100],
        [0.99, 100]
    ])('maps similarity %s to %s', (similarity, expected) => {
        expect(matchPercentage(similarity, calibration)).toBe(expected)
    })

    it('rejects a calibration whose ceiling is not above its floor', () => {
        expect(() => matchPercentage(0.8, { floor: 0.9, ceiling: 0.9 })).toThrow()
    })
})
