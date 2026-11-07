import { describe, expect, it } from 'vitest'
import { safeReturnTo } from './returnTo'

describe('safeReturnTo', () => {
    it.each(['/', '/mascota/123', '/admin?tab=pending', '/en/registrar'])('keeps same-site path %s', path => {
        expect(safeReturnTo(path)).toBe(path)
    })

    it.each([
        undefined,
        42,
        '',
        'mascota/123',
        'https://evil.example',
        '//evil.example',
        '/\\evil.example',
        '/\t/evil.example',
        '/auth/google',
        '/mascota/ñ',
        '/a b',
        `/${'a'.repeat(600)}`
    ])('falls back for %s', value => {
        expect(safeReturnTo(value, '/fallback')).toBe('/fallback')
    })
})
