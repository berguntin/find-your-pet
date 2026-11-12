import { describe, expect, it } from 'vitest'
import { dataThemeFor, parseThemePreference, themeColorMetaFor, themeCookieValueFor } from './theme'

describe('themeCookieValueFor', () => {
    it('stores explicit choices', () => {
        expect(themeCookieValueFor('light')).toBe('light')
        expect(themeCookieValueFor('dark')).toBe('dark')
    })

    it('removes the cookie when following the system', () => {
        expect(themeCookieValueFor('system')).toBeNull()
    })
})

describe('parseThemePreference', () => {
    it('keeps a known preference', () => {
        expect(parseThemePreference('light')).toBe('light')
        expect(parseThemePreference('dark')).toBe('dark')
        expect(parseThemePreference('system')).toBe('system')
    })

    it('falls back to the system for missing or tampered values', () => {
        expect(parseThemePreference(undefined)).toBe('system')
        expect(parseThemePreference(null)).toBe('system')
        expect(parseThemePreference('neon')).toBe('system')
        expect(parseThemePreference(1)).toBe('system')
    })
})

describe('dataThemeFor', () => {
    it('maps explicit choices to daisyUI themes', () => {
        expect(dataThemeFor('light')).toBe('mascotas')
        expect(dataThemeFor('dark')).toBe('mascotas-dark')
    })

    it('leaves the attribute unset when following the system', () => {
        expect(dataThemeFor('system')).toBeUndefined()
    })
})

describe('themeColorMetaFor', () => {
    it('uses a single colour for an explicit choice', () => {
        expect(themeColorMetaFor('dark')).toEqual([{ name: 'theme-color', content: '#1C1511' }])
    })

    it('offers both colours by media query when following the system', () => {
        expect(themeColorMetaFor('system').map(meta => meta.media)).toEqual([
            '(prefers-color-scheme: light)',
            '(prefers-color-scheme: dark)'
        ])
    })
})
