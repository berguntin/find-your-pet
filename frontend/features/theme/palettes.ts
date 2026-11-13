/**
 * Colour palettes for the light and dark themes: the single source for tailwind.config.js (daisyUI themes and the
 * extra CSS variables) and for the contrast test. Not under utils/ so it is not auto-imported into the app.
 */

export const THEME_NAMES = ['light', 'dark'] as const
/** Also the value of the theme cookie and of data-theme (see utils/theme.ts). */
export type ThemeName = (typeof THEME_NAMES)[number]

/** daisyUI colours. */
export type DaisyColors = Record<
    | 'primary'
    | 'primary-content'
    | 'secondary'
    | 'secondary-content'
    | 'accent'
    | 'accent-content'
    | 'neutral'
    | 'neutral-content'
    | 'base-100'
    | 'base-200'
    | 'base-300'
    | 'base-content'
    | 'info'
    | 'info-content'
    | 'success'
    | 'success-content'
    | 'warning'
    | 'warning-content'
    | 'error'
    | 'error-content',
    string
>

/** Colours daisyUI does not have, exposed as CSS variables and Tailwind colours (bg-surface, text-muted...). */
export interface ExtraColors {
    /** Raised cards and form fields. */
    surface: string
    /** Secondary text. */
    muted: string
    /** Borders of inputs and toggle buttons: at least 3:1 against the page and the surface (WCAG 1.4.11). */
    'field-border': string
    /** Lost/rejected and found/approved as text, icons and chart series on the page or the surface. */
    'lost-accent': string
    'found-accent': string
    /** Pending review: only for chart series (3:1), not for text. */
    'pending-accent': string
}

export interface Palette {
    colors: DaisyColors
    extra: ExtraColors
    /** Colour of the browser UI on mobile (meta theme-color). */
    browserColor: string
}

/**
 * Colours that do not change with the theme: report state badges (white text) and the dark "ink" layer used for the
 * footer, overlays on photos and modal backdrops, which must stay dark in both themes.
 */
export const FIXED_COLORS = {
    lost: '#B42318',
    found: '#1F7A4D',
    reunited: '#2F6F6A',
    ink: { DEFAULT: '#3B2A1E', content: '#FFFBF5' }
} as const

const shape = {
    '--rounded-box': '1.25rem',
    '--rounded-btn': '9999px',
    '--rounded-badge': '9999px',
    '--btn-text-case': 'none'
}

export const PALETTES: Record<ThemeName, Palette> = {
    // Warm and friendly: cream backgrounds, terracotta actions, dark brown text.
    light: {
        colors: {
            primary: '#C2511A',
            'primary-content': '#FFFFFF',
            secondary: '#2F6F6A',
            'secondary-content': '#FFFFFF',
            accent: '#F4B740',
            'accent-content': '#3B2A1E',
            neutral: '#3B2A1E',
            'neutral-content': '#FFFBF5',
            'base-100': '#FFFBF5',
            'base-200': '#F6EDE2',
            'base-300': '#EADBC8',
            'base-content': '#3B2A1E',
            info: '#2F6F6A',
            'info-content': '#FFFFFF',
            success: '#1F7A4D',
            'success-content': '#FFFFFF',
            warning: '#F4B740',
            'warning-content': '#3B2A1E',
            error: '#B42318',
            'error-content': '#FFFFFF'
        },
        extra: {
            surface: '#FFFFFF',
            muted: '#6B5646',
            'field-border': '#A08A76',
            'lost-accent': '#B42318',
            'found-accent': '#1F7A4D',
            'pending-accent': '#C98500'
        },
        browserColor: '#FFFBF5'
    },
    // The same warmth at night: dark brown backgrounds, cream text, lighter terracotta.
    dark: {
        colors: {
            primary: '#E07A43',
            'primary-content': '#1F1712',
            secondary: '#5FA8A1',
            'secondary-content': '#1F1712',
            accent: '#F4B740',
            'accent-content': '#1F1712',
            neutral: '#F3E7DA',
            'neutral-content': '#1F1712',
            'base-100': '#1F1712',
            'base-200': '#2A201A',
            'base-300': '#3A2C23',
            'base-content': '#F3E7DA',
            info: '#5FA8A1',
            'info-content': '#1F1712',
            success: '#4ADE80',
            'success-content': '#1F1712',
            warning: '#F4B740',
            'warning-content': '#1F1712',
            error: '#F87171',
            'error-content': '#1F1712'
        },
        extra: {
            surface: '#2A201A',
            muted: '#C2AE9C',
            'field-border': '#806A58',
            'lost-accent': '#F87171',
            'found-accent': '#4ADE80',
            'pending-accent': '#F4B740'
        },
        browserColor: '#1F1712'
    }
}

/** daisyUI theme definitions (colours plus the shared shape variables). */
export const daisyThemes = (): Record<string, Record<string, string>>[] =>
    THEME_NAMES.map(name => ({ [name]: { ...PALETTES[name].colors, ...shape } }))

/** '#C2511A' → '194 81 26', for rgb(var(--color-x) / <alpha-value>). */
export const hexToRgbChannels = (hex: string): string =>
    [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(' ')

/** CSS variables for the extra colours and the native controls' colour scheme. */
export const extraVariables = (name: ThemeName): Record<string, string> => ({
    'color-scheme': name,
    ...Object.fromEntries(
        Object.entries(PALETTES[name].extra).map(([key, hex]) => [`--color-${key}`, hexToRgbChannels(hex)])
    )
})
