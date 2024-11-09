const { default: daisyui } = require('daisyui');

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts}",
  ],
  theme: {
    extend: {
      screens: {
        sm: '480px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      },
    },
  },
  plugins: [
    require('daisyui'),
  ],
  daisyui: {
    themes:[ 
      "light", "dark", "cupcake",
      {
        mytheme: {
        "primary": "#9e00ff",
        "secondary": "#3200ff",
        "accent": "#0000ff",
        "neutral": "#292413",
        "base-100": "#11242d",
        "info": "#00afe8",
        "success": "#00f7b3",    
        "warning": "#ff7d00",
        "error": "#ff0e4a",
      }
    }
  ]
  }
}
