import { describe, expect, it } from 'vitest'
import { formatProbability, niceMax, percentChange, percentOf } from './adminStats'

describe('admin stats helpers', () => {
    it('computes the change between periods', () => {
        expect(percentChange(15, 10)).toBe(50)
        expect(percentChange(5, 10)).toBe(-50)
        expect(percentChange(3, 0)).toBeNull()
    })

    it('computes shares', () => {
        expect(percentOf(1, 3)).toBe(33)
        expect(percentOf(0, 0)).toBe(0)
    })

    it('formats probabilities', () => {
        expect(formatProbability(0.876)).toBe('88%')
        expect(formatProbability(0)).toBe('0%')
        expect(formatProbability(null)).toBe('—')
    })

    it('rounds axis maxima up to 1, 2 or 5 times a power of ten', () => {
        expect([0, 1, 3, 7, 10, 11, 42, 180].map(niceMax)).toEqual([1, 1, 5, 10, 10, 20, 50, 200])
    })
})
