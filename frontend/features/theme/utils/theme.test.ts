import { describe, expect, it } from 'vitest'
import { oppositeTheme, parseThemePreference, readThemeCookie } from './theme'

describe('parseThemePreference', () => {
    it('accepts only light and dark', () => {
        expect(parseThemePreference('light')).toBe('light')
        expect(parseThemePreference('dark')).toBe('dark')
    })

    it.each([undefined, null, '', 'DARK', 'mascotas', 1, { theme: 'dark' }])('ignores %j', value => {
        expect(parseThemePreference(value)).toBeNull()
    })
})

describe('readThemeCookie', () => {
    it('finds the theme among other cookies', () => {
        expect(readThemeCookie('i18n_redirected=es; theme=dark; other=1')).toBe('dark')
        expect(readThemeCookie('theme=light')).toBe('light')
    })

    it('decodes quoted or encoded values', () => {
        expect(readThemeCookie('theme=%64ark')).toBe('dark')
        expect(readThemeCookie('theme="dark"')).toBe('dark')
    })

    it('returns null when missing or invalid', () => {
        expect(readThemeCookie('')).toBeNull()
        expect(readThemeCookie('mytheme=dark')).toBeNull()
        expect(readThemeCookie('theme=purple')).toBeNull()
        expect(readThemeCookie('theme=%E0%A4%A')).toBeNull()
    })
})

describe('oppositeTheme', () => {
    it('switches between light and dark', () => {
        expect(oppositeTheme('light')).toBe('dark')
        expect(oppositeTheme('dark')).toBe('light')
    })
})
