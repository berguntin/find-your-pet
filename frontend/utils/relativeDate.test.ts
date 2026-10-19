import { describe, expect, it } from 'vitest'
import { formatRelativeDate } from './relativeDate'

const now = new Date('2026-10-20T10:00:00Z')

describe('formatRelativeDate', () => {
    it.each([
        ['2026-10-20', 'hoy'],
        ['2026-10-19', 'ayer'],
        ['2026-10-17', 'hace 3 días'],
        ['2026-10-06', 'hace 2 semanas'],
        ['2026-07-20', 'hace 3 meses'],
        ['2025-09-01', 'el año pasado']
    ])('describes %s as "%s" in Spanish', (date, expected) => {
        expect(formatRelativeDate(date, 'es', now)).toBe(expected)
    })

    it('speaks English too', () => {
        expect(formatRelativeDate('2026-10-17', 'en', now)).toBe('3 days ago')
    })

    it('ignores the time part of ISO dates', () => {
        expect(formatRelativeDate('2026-10-19T23:59:59Z', 'es', now)).toBe('ayer')
    })
})
