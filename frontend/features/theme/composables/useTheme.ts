import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { PALETTES } from '../palettes'
import {
    oppositeTheme,
    parseThemePreference,
    readThemeCookie,
    safeDecode,
    THEME_COOKIE,
    THEME_COOKIE_MAX_AGE,
    type ThemePreference
} from '../utils/theme'

/** What the user picked with the toggle (from the theme cookie); null means "follow the system". */
const usePreferenceState = () => useState<ThemePreference | null>('theme-preference', () => null)
/** Whether the system asks for dark mode. Unknown (null) on the server and until the app is mounted. */
const useSystemDarkState = () => useState<boolean | null>('theme-system-dark', () => null)

/**
 * Keeps the theme cookie, the shared state and <html data-theme> in sync. Call it once, from app.vue.
 *
 * Without a cookie no data-theme is set and the CSS follows prefers-color-scheme on its own (no flash, no JS). With
 * one, the server already renders data-theme. Other tabs pick up a change through useCookie, which listens to
 * cookieStore or a BroadcastChannel; on top of that the cookie is read again whenever a tab becomes visible.
 */
export const useThemeSync = () => {
    const cookie = useCookie<ThemePreference | null>(THEME_COOKIE, {
        maxAge: THEME_COOKIE_MAX_AGE,
        sameSite: 'lax',
        path: '/',
        decode: value => parseThemePreference(safeDecode(value)),
        encode: value => encodeURIComponent(value ?? '')
    })
    const preference = usePreferenceState()
    const systemDark = useSystemDarkState()
    // The client starts from the server's value (hydrated with the payload) so the first render matches; the cookie may
    // have changed since (another tab), which is reconciled once mounted.
    if (import.meta.server) preference.value = parseThemePreference(cookie.value)

    watch(preference, value => {
        if (cookie.value !== value) cookie.value = value
    })
    watch(cookie, value => {
        const parsed = parseThemePreference(value)
        if (preference.value !== parsed) preference.value = parsed
    })

    onMounted(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const onSystemChange = (event: MediaQueryListEvent) => (systemDark.value = event.matches)
        const syncFromCookie = () => (preference.value = readThemeCookie(document.cookie))
        const onVisible = () => {
            if (document.visibilityState === 'visible') syncFromCookie()
        }
        systemDark.value = media.matches
        syncFromCookie()
        media.addEventListener('change', onSystemChange)
        document.addEventListener('visibilitychange', onVisible)
        onBeforeUnmount(() => {
            media.removeEventListener('change', onSystemChange)
            document.removeEventListener('visibilitychange', onVisible)
        })
    })

    useHead(() => ({
        htmlAttrs: { 'data-theme': preference.value ?? undefined },
        // Mobile browser UI colour: follows the system unless the user picked a theme.
        meta: preference.value
            ? // Its own key: reusing one of the keys below would keep their media attribute.
              [{ key: 'theme-color-chosen', name: 'theme-color', content: PALETTES[preference.value].browserColor }]
            : [
                  {
                      key: 'theme-color-light',
                      name: 'theme-color',
                      media: '(prefers-color-scheme: light)',
                      content: PALETTES.light.browserColor
                  },
                  {
                      key: 'theme-color-dark',
                      name: 'theme-color',
                      media: '(prefers-color-scheme: dark)',
                      content: PALETTES.dark.browserColor
                  }
              ]
    }))
}

/** Current theme and a toggle for it. The toggle stores the choice in the theme cookie (see useThemeSync). */
export const useTheme = () => {
    const preference = usePreferenceState()
    const systemDark = useSystemDarkState()

    /** The theme on screen, or null while unknown (server render without a cookie, before mounting). */
    const effective = computed<ThemePreference | null>(() => {
        if (preference.value) return preference.value
        if (systemDark.value === null) return null
        return systemDark.value ? 'dark' : 'light'
    })

    const toggle = () => {
        if (effective.value) preference.value = oppositeTheme(effective.value)
    }

    return { effective, toggle }
}
