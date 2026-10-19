import { describe, expect, it } from 'vitest'
import { formatDate } from './index'

describe('formatDate', () => {
    it('formats dates as dd/mm/yyyy', () => {
        expect(formatDate('2026-10-18T12:00:00Z')).toBe('18/10/2026')
    })
})
