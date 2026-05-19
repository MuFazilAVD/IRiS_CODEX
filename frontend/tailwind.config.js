/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'border-beam': 'border-beam calc(var(--duration) * 1s) infinite linear',
        'shine-pulse': 'shine-pulse var(--shine-pulse-duration, 14s) infinite linear',
      },
      colors: {
        iris: {
          navy: '#0D1B2A',
          navyLight: '#112233',
          blue: '#1A6B9A',
          blueLight: '#2980B9',
          teal: '#00BCD4',
          green: '#2ECC71',
          amber: '#F39C12',
          orange: '#E67E22',
          red: '#E74C3C',
          purple: '#8E44AD',
          bg: '#F5F7FA',
          surface: '#FAFBFC',
          border: '#E1E8ED',
          text: {
            primary: '#1A2332',
            secondary: '#546E7A',
            muted: '#90A4AE',
          },
        },
      },
      keyframes: {
        'border-beam': {
          '100%': {
            'offset-distance': '100%',
          },
        },
        'shine-pulse': {
          '0%': {
            'background-position': '0% 0%',
          },
          '50%': {
            'background-position': '100% 100%',
          },
          to: {
            'background-position': '0% 0%',
          },
        },
      },
    },
  },
  plugins: [],
}
