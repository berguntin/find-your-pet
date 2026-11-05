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
                reunited: '#2F6F6A'
            }
        }
    },
    plugins: [require('@tailwindcss/typography'), require('daisyui')],
    daisyui: {
        logs: false,
        themes: [
            {
                // Warm and friendly: cream backgrounds, terracotta actions, dark brown text.
                mascotas: {
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
                }
            }
        ]
    }
}
