import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{vue,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans Thai'", 'ui-sans-serif', 'system-ui', 'sans-serif'],
        reading: ['ui-sans-serif', 'system-ui', 'sans-serif'],
        arabic: ["'UthmanicHafs'", "'Amiri'", 'serif'],
      },
    },
  },
} satisfies Config
