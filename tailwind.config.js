import typography from '@tailwindcss/typography'

export default {
  content: ["./**/*.{html,js}"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      spacing: {
        section: 'clamp(4rem, 15vw, 12rem)',
        gutter: 'clamp(1rem, 5vw, 3rem)',
        micro: '0.125rem',
      },
      colors: {
        papier: {
          DEFAULT: '#F5F2EB',
          dark: '#E8E4D9',
        },
      },
      transitionTimingFunction: {
        'in-expo': 'cubic-bezier(0.95, 0.05, 0.795, 0.035)',
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      transitionDuration: {
        400: '400ms',
        800: '800ms',
      },
    },
  },
  plugins: [typography],
}