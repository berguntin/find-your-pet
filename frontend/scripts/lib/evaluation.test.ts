import { describe, expect, it } from 'vitest'
import { cosine, distribution, evaluate, percentile, type LabeledVector } from './evaluation'

const v = (animalId: string, photo: string, vector: number[]): LabeledVector => ({ animalId, photo, vector })

describe('evaluation helpers', () => {
    it('computes cosine similarity', () => {
        expect(cosine([1, 0], [1, 0])).toBeCloseTo(1)
        expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
        expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1)
    })

    it('computes nearest-rank percentiles and distributions', () => {
        const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        expect(percentile(sorted, 50)).toBe(5)
        expect(percentile(sorted, 95)).toBe(10)
        expect(distribution([3, 1, 2])).toEqual({ count: 3, min: 1, p5: 1, median: 2, p95: 3, max: 3 })
    })
})

describe('evaluate', () => {
    it('finds each animal first when its photos are close together', () => {
        const report = evaluate([
            v('rex', 'a', [1, 0.1, 0]),
            v('rex', 'b', [1, 0.15, 0]),
            v('luna', 'a', [0, 1, 0.1]),
            v('luna', 'b', [0.05, 1, 0.1]),
            v('toby', 'a', [0, 0, 1])
        ])

        expect(report).toMatchObject({ animals: 3, photos: 5, queries: 2, recallAt1: 1, recallAt5: 1 })
        expect(report.sameAnimal.median).toBeGreaterThan(report.differentAnimal.p95)
        expect(report.suggestedCalibration!.ceiling).toBeGreaterThan(report.suggestedCalibration!.floor)
    })

    it('measures misses and gives no calibration when animals cannot be told apart', () => {
        const report = evaluate([
            v('rex', 'a', [1, 0]),
            v('rex', 'b', [0, 1]),
            v('luna', 'a', [0.9, 0.1]),
            v('luna', 'b', [0.1, 0.9])
        ])

        expect(report.recallAt1).toBe(0)
        expect(report.suggestedCalibration).toBeNull()
    })
})
