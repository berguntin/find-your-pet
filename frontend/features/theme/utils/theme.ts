import type { ThemeName } from '../palettes'

/** A theme the user picked explicitly. Its value is also the daisyUI theme name used in data-theme. */
export type ThemePreference = ThemeName

export const THEME_COOKIE = 'theme'
/** One year: it only stores the appearance the user chose. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Anything other than 'light' or 'dark' (missing, tampered cookie...) means "follow the system". */
export const parseThemePreference = (value: unknown): ThemePreference | null =>
    value === 'light' || value === 'dark' ? value : null

/** decodeURIComponent throws on malformed values (another app on the domain, a tampered cookie). */
export const safeDecode = (value: string): string | null => {
    try {
        return decodeURIComponent(value)
    } catch {
        return null
    }
}

/** Reads the theme preference from a document.cookie string. */
export const readThemeCookie = (cookies: string): ThemePreference | null => {
    for (const part of cookies.split(';')) {
        const [name, ...rest] = part.trim().split('=')
        if (name === THEME_COOKIE) return parseThemePreference(safeDecode(rest.join('=')))
    }
    return null
}

export const oppositeTheme = (theme: ThemePreference): ThemePreference => (theme === 'dark' ? 'light' : 'dark')
