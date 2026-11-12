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
                // Cards and form fields: white on the light theme, a lifted brown on the dark one (base.css).
                surface: 'rgb(var(--surface) / <alpha-value>)'
            }
        }
    },
    plugins: [require('@tailwindcss/typography'), require('daisyui')],
    daisyui: {
        logs: false,
        // Applied by prefers-color-scheme while <html> has no data-theme (preference "system").
        darkTheme: 'mascotas-dark',
        themes: [
            {
                // Warm and friendly: cream backgrounds, terracotta actions, dark brown text.
                mascotas: {
                    'color-scheme': 'light',
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
                    'error-content': '#FFFFFF',
                    '--rounded-box': '1.25rem',
                    '--rounded-btn': '9999px',
                    '--rounded-badge': '9999px',
                    '--btn-text-case': 'none'
                },
                // Same warmth at night: deep brown backgrounds, lighter terracotta, cream text.
                // Every content colour keeps at least 4.5:1 contrast with its background.
                'mascotas-dark': {
                    'color-scheme': 'dark',
                    primary: '#E8834E',
                    'primary-content': '#1C1511',
                    secondary: '#6FC0B6',
                    'secondary-content': '#10201E',
                    accent: '#F4B740',
                    'accent-content': '#3B2A1E',
                    neutral: '#F3E7DA',
                    'neutral-content': '#1C1511',
                    'base-100': '#1C1511',
                    'base-200': '#150F0C',
                    'base-300': '#3A2C22',
                    'base-content': '#F3E7DA',
                    info: '#6FC0B6',
                    'info-content': '#10201E',
                    success: '#5CCB95',
                    'success-content': '#0E2A1C',
                    warning: '#F4B740',
                    'warning-content': '#3B2A1E',
                    error: '#F47A6E',
                    'error-content': '#2A0F0C',
                    '--rounded-box': '1.25rem',
                    '--rounded-btn': '9999px',
                    '--rounded-badge': '9999px',
                    '--btn-text-case': 'none'
                }
            }
        ]
    }
}
