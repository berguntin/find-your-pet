import plugin from 'tailwindcss/plugin'
import { daisyThemes, extraVariables, PALETTES } from './features/theme/palettes'

/** Extra colours read from CSS variables, so they follow the active theme. */
const extraColor = name => `rgb(var(--color-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
    content: [],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Nunito', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
            },
            colors: {
                // Report states. Every pair keeps at least 4.5:1 contrast with white text.
                lost: '#B42318',
                found: '#1F7A4D',
                reunited: '#2F6F6A',
                ...Object.fromEntries(Object.keys(PALETTES.light.extra).map(name => [name, extraColor(name)]))
            }
        }
    },
    plugins: [
        require('@tailwindcss/typography'),
        require('daisyui'),
        // Same selectors daisyUI uses: light by default, dark when the system asks for it and the user has not chosen
        // light, and whatever the user chose (data-theme, from the theme cookie).
        plugin(({ addBase }) =>
            addBase({
                ':root': extraVariables('light'),
                '@media (prefers-color-scheme: dark)': { ':root:not([data-theme=light])': extraVariables('dark') },
                '[data-theme=light]': extraVariables('light'),
                '[data-theme=dark]': extraVariables('dark')
            })
        )
    ],
    daisyui: {
        logs: false,
        // The first theme is the default; darkTheme applies when prefers-color-scheme is dark and no data-theme is set.
        themes: daisyThemes(),
        darkTheme: 'dark'
    }
}
