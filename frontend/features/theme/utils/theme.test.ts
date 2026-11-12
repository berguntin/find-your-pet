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
    const meta = (light: string, dark: string) => [
        { name: 'theme-color', content: light, media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: dark, media: '(prefers-color-scheme: dark)' }
    ]

    it('follows the OS scheme when following the system', () => {
        expect(themeColorMetaFor('system')).toEqual(meta('#FFFBF5', '#1C1511'))
    })

    it('keeps the same two tags with the chosen colour for an explicit choice', () => {
        expect(themeColorMetaFor('light')).toEqual(meta('#FFFBF5', '#FFFBF5'))
        expect(themeColorMetaFor('dark')).toEqual(meta('#1C1511', '#1C1511'))
    })
})
