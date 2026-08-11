export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0A1628',
          soft: '#2A3A4F',
          muted: '#5C6B7E',
          faint: '#8A97A8',
        },
        mist: {
          DEFAULT: '#E8EEF4',
          light: '#F4F7FA',
          mid: '#D5DEE8',
        },
        signal: {
          DEFAULT: '#FF4D00',
          soft: '#FF7A40',
          wash: 'rgba(255, 77, 0, 0.12)',
        },
        live: {
          DEFAULT: '#00A878',
          wash: 'rgba(0, 168, 120, 0.15)',
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Figtree', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-live': 'pulse-live 2s ease-in-out infinite',
        'rise-in': 'rise-in 0.45s ease-out both',
        'fade-in': 'fade-in 0.35s ease-out both',
        'cursor-blink': 'cursor-blink 1s step-end infinite',
      },
      keyframes: {
        'pulse-live': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.55', transform: 'scale(0.85)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
