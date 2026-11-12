import { computed } from 'vue'
import { parseThemePreference, THEME_COOKIE, themeCookieValueFor, type ThemePreference } from '../utils/theme'

const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Colour theme preference, kept in a cookie so the server renders the right theme
 * on the first paint. Following the system removes the cookie.
 */
export function useTheme() {
    const cookie = useCookie<string | null>(THEME_COOKIE, { maxAge: ONE_YEAR, sameSite: 'lax', path: '/' })

    const preference = computed<ThemePreference>({
        get: () => parseThemePreference(cookie.value),
        set: value => {
            cookie.value = themeCookieValueFor(value)
        }
    })

    return { preference }
}
