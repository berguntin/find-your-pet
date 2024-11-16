/** @type {import('tailwindcss').Config} */
export default {
    content: [],
    theme: {
        extend: {}
    },
    plugins: [require('daisyui')],
    daisyui: {
        themes: [
            {
                mytheme: {
                    primary: '#00cbc5',

                    'primary-content': '#000f0e',

                    secondary: '#00799e',

                    'secondary-content': '#d3e4ec',

                    accent: '#00cbff',

                    'accent-content': '#000f16',

                    neutral: '#141414',

                    'neutral-content': '#cacaca',

                    'base-100': '#FAFAFA',

                    'base-200': '#d3dede',

                    'base-300': '#E1EEFF',

                    'base-content': '#141616',

                    info: '#008ef9',

                    'info-content': '#000715',

                    success: '#00f19c',

                    'success-content': '#001409',

                    warning: '#e64d00',

                    'warning-content': '#130200',

                    error: '#ff4b86',

                    'error-content': '#160206'
                }
            }
        ]
    }
}
