/** Colour theme preference: an explicit choice or following the operating system. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

/** Technical cookie that remembers an explicit choice (it is absent while following the system). */
export const THEME_COOKIE = 'theme'

/** daisyUI theme names (tailwind.config.js). */
export const DAISY_THEMES = { light: 'mascotas', dark: 'mascotas-dark' } as const

/** Browser UI colour (`theme-color`), matching each theme's `base-100`. */
export const THEME_COLORS = { light: '#FFFBF5', dark: '#1C1511' } as const

export function parseThemePreference(value: unknown): ThemePreference {
    return THEME_PREFERENCES.find(preference => preference === value) ?? 'system'
}

/** Value to store in the cookie: following the system stores nothing (privacy policy, section 7). */
export function themeCookieValueFor(preference: ThemePreference): 'light' | 'dark' | null {
    return preference === 'system' ? null : preference
}

/**
 * Value for `<html data-theme>`. Following the system leaves it unset so the CSS
 * `prefers-color-scheme` rules pick the theme: no flash and nothing to know on the server.
 */
export function dataThemeFor(preference: ThemePreference): string | undefined {
    return preference === 'system' ? undefined : DAISY_THEMES[preference]
}

// A type alias (not an interface) so it fits unhead's index-signature `Meta` type.
export type ThemeColorMeta = {
    name: 'theme-color'
    content: string
    media?: string
}

/**
 * Always the same two tags (one per OS scheme), only their colour changes. unhead patches
 * meta tags in place and would leave a stale `media` behind if the shape changed on the client.
 */
export function themeColorMetaFor(preference: ThemePreference): ThemeColorMeta[] {
    const colorFor = (scheme: 'light' | 'dark') => THEME_COLORS[preference === 'system' ? scheme : preference]
    return [
        { name: 'theme-color', content: colorFor('light'), media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: colorFor('dark'), media: '(prefers-color-scheme: dark)' }
    ]
}
