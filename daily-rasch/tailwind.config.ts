import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0E1F1D',
          2: '#142826',
          card: '#1A302E',
          deep: '#08161A',
        },
        gold: {
          DEFAULT: '#C9A961',
          soft: '#D4B27F',
          dim: '#8C7848',
        },
        cream: {
          DEFAULT: '#E8E0D0',
          bright: '#F5EDD8',
        },
        muted: '#8C9694',
        line: {
          DEFAULT: 'rgba(201, 169, 97, 0.18)',
          strong: 'rgba(201, 169, 97, 0.38)',
        },
        positive: '#6BA77E',
        negative: '#D4715E',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        editorial: '0.18em',
        'editorial-wide': '0.25em',
      },
      borderRadius: {
        editorial: '2px',
      },
    },
  },
  plugins: [],
} satisfies Config
