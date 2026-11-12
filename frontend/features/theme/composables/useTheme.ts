import { computed } from 'vue'
import { parseThemePreference, THEME_COOKIE, themeCookieValueFor, type ThemePreference } from '../utils/theme'

const ONE_YEAR = 60 * 60 * 24 * 365

/** Cookie options promised by the privacy policy (section 7): one year, whole site. */
export const THEME_COOKIE_OPTIONS = { maxAge: ONE_YEAR, sameSite: 'lax', path: '/' } as const

/**
 * Colour theme preference. One shared state for the whole app (app.vue and every switch),
 * seeded from a cookie so the server renders the right theme on the first paint.
 * Following the system removes the cookie.
 */
export function useTheme() {
    const cookie = useCookie<string | null>(THEME_COOKIE, THEME_COOKIE_OPTIONS)
    const state = useState<ThemePreference>('theme-preference', () => parseThemePreference(cookie.value))

    const preference = computed<ThemePreference>({
        get: () => state.value,
        set: value => {
            state.value = value
            cookie.value = themeCookieValueFor(value)
        }
    })

    return { preference }
}
