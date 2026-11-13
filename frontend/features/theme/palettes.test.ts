import { describe, expect, it } from 'vitest'
import { extraVariables, FIXED_COLORS, hexToRgbChannels, PALETTES, THEME_NAMES, type Palette } from './palettes'

/** WCAG 2.x relative luminance. */
const luminance = (hex: string): number => {
    const [r, g, b] = hexToRgbChannels(hex)
        .split(' ')
        .map(channel => Number(channel) / 255)
        .map(value => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a: string, b: string): number => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (light + 0.05) / (dark + 0.05)
}

const TEXT = 4.5
const UI = 3

/** [description, foreground, background, minimum ratio] */
const pairs = ({ colors: c, extra: e }: Palette): [string, string, string, number][] => [
    ['text on page', c['base-content'], c['base-100'], TEXT],
    ['text on base-200', c['base-content'], c['base-200'], TEXT],
    ['text on surface', c['base-content'], e.surface, TEXT],
    ['muted text on page', e.muted, c['base-100'], TEXT],
    ['muted text on surface', e.muted, e.surface, TEXT],
    ['muted text on base-200', e.muted, c['base-200'], TEXT],
    ['primary button', c['primary-content'], c.primary, TEXT],
    ['secondary button', c['secondary-content'], c.secondary, TEXT],
    ['neutral button', c['neutral-content'], c.neutral, TEXT],
    ['accent', c['accent-content'], c.accent, TEXT],
    ['info', c['info-content'], c.info, TEXT],
    ['success', c['success-content'], c.success, TEXT],
    ['warning', c['warning-content'], c.warning, TEXT],
    ['error', c['error-content'], c.error, TEXT],
    ['focus ring on page', c.primary, c['base-100'], UI],
    ['focus ring on surface', c.primary, e.surface, UI],
    ['field border on page', e['field-border'], c['base-100'], UI],
    ['field border on surface', e['field-border'], e.surface, UI],
    ['lost text on page', e['lost-accent'], c['base-100'], TEXT],
    ['lost text on surface', e['lost-accent'], e.surface, TEXT],
    ['found text on page', e['found-accent'], c['base-100'], TEXT],
    ['found text on surface', e['found-accent'], e.surface, TEXT],
    ['pending chart on surface', e['pending-accent'], e.surface, UI]
]

describe('theme palettes', () => {
    describe.each(THEME_NAMES)('%s', name => {
        it.each(pairs(PALETTES[name]))('%s keeps contrast (%s on %s ≥ %d:1)', (_, foreground, background, minimum) => {
            expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum)
        })
    })

    // Badges use white text and overlays the ink content colour on every theme.
    it.each([
        ['lost badge', '#FFFFFF', FIXED_COLORS.lost],
        ['found badge', '#FFFFFF', FIXED_COLORS.found],
        ['reunited badge', '#FFFFFF', FIXED_COLORS.reunited],
        ['deceased badge', '#FFFFFF', FIXED_COLORS.ink.DEFAULT],
        ['text on the ink layer', FIXED_COLORS.ink.content, FIXED_COLORS.ink.DEFAULT]
    ])('fixed colours: %s keeps 4.5:1', (_, foreground, background) => {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(TEXT)
    })

    it('exposes the extra colours as rgb channels and sets the native colour scheme', () => {
        expect(hexToRgbChannels('#C2511A')).toBe('194 81 26')
        expect(extraVariables('dark')).toMatchObject({ 'color-scheme': 'dark', '--color-surface': '42 32 26' })
    })

    it('defines the same extra colours in every theme', () => {
        expect(Object.keys(PALETTES.dark.extra)).toEqual(Object.keys(PALETTES.light.extra))
    })
})
